BEGIN;
SET LOCAL search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.membership_change_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  actor text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.membership_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_change_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_membership_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'sales' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.type <> 'monthly_fee' THEN RETURN OLD; END IF;
    ELSIF NEW.type <> 'monthly_fee' THEN RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.membership_change_log(user_id, table_name, operation, before_data, after_data, actor)
  VALUES (CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
    TG_TABLE_NAME, TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    coalesce(nullif(current_setting('app.membership_actor', true), ''), 'database'));
  RETURN coalesce(NEW, OLD);
END;
$$;
CREATE TRIGGER membership_history_audit AFTER INSERT OR UPDATE OR DELETE ON public.membership_history
FOR EACH ROW EXECUTE FUNCTION public.log_membership_change();
CREATE TRIGGER membership_sales_audit AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.log_membership_change();

SELECT set_config('app.membership_actor', '20261104_contract_normalization', true);

-- Preserve a recoverable snapshot before normalizing legacy overlaps.
INSERT INTO public.membership_change_log(user_id, table_name, operation, before_data, actor)
SELECT user_id, 'membership_history', 'BASELINE', to_jsonb(h), '20261104_contract_normalization'
FROM public.membership_history h;

INSERT INTO public.membership_history(user_id, store_id, status, start_date, plan, monthly_fee)
SELECT u.id, u.store_id, u.status, (u.created_at AT TIME ZONE 'Asia/Tokyo')::date,
  coalesce(u.plan, '未契約'), coalesce(u.monthly_fee, 0)
FROM public.users u WHERE u.role <> 'ADMIN'
AND NOT EXISTS (SELECT 1 FROM public.membership_history h WHERE h.user_id = u.id);

-- Same-day duplicates have a deterministic winner: the most recently created row.
DELETE FROM public.membership_history h USING (
  SELECT id, row_number() OVER (PARTITION BY user_id, start_date ORDER BY created_at DESC, id DESC) AS rank
  FROM public.membership_history
) d WHERE h.id = d.id AND d.rank > 1;

WITH boundaries AS (
  SELECT id, lead(start_date) OVER (PARTITION BY user_id ORDER BY start_date) AS next_start
  FROM public.membership_history
)
UPDATE public.membership_history h SET end_date = b.next_start - 1
FROM boundaries b WHERE h.id = b.id AND b.next_start IS NOT NULL
AND (h.end_date IS NULL OR h.end_date >= b.next_start);

ALTER TABLE public.membership_history ADD CONSTRAINT membership_period_valid
CHECK (end_date IS NULL OR end_date >= start_date);
ALTER TABLE public.membership_history ADD CONSTRAINT membership_fee_valid
CHECK (monthly_fee IS NULL OR monthly_fee >= 0);
ALTER TABLE public.membership_history ADD CONSTRAINT membership_new_fee_required
CHECK (monthly_fee IS NOT NULL) NOT VALID;
ALTER TABLE public.membership_history ADD CONSTRAINT membership_period_no_overlap
EXCLUDE USING gist (user_id WITH =, daterange(start_date, end_date, '[]') WITH &&);

CREATE UNIQUE INDEX IF NOT EXISTS sales_one_monthly_payment
ON public.sales(user_id, target_date) WHERE type = 'monthly_fee' AND target_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_member_contract_snapshot(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.membership_history%ROWTYPE; today date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
BEGIN
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  SELECT * INTO c FROM public.membership_history WHERE user_id = p_user_id AND start_date <= today
  ORDER BY start_date DESC, created_at DESC, id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM set_config('app.contract_sync', 'on', true);
  UPDATE public.users SET plan = c.plan, monthly_fee = c.monthly_fee,
    status = CASE WHEN c.status = 'active' AND c.end_date < today THEN 'withdrawn' ELSE c.status END,
    store_id = coalesce(c.store_id, store_id)
  WHERE id = p_user_id;
  PERFORM set_config('app.contract_sync', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_member_contract(
  p_user_id uuid, p_start_date date, p_end_date date, p_status text, p_plan text,
  p_monthly_fee integer, p_store_id uuid DEFAULT NULL, p_actor text DEFAULT 'admin',
  p_payment jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  member public.users%ROWTYPE;
  original public.membership_history%ROWTYPE;
  boundary date;
  finish date := p_end_date;
  target_store uuid;
  current_contract public.membership_history%ROWTYPE;
  payment public.sales%ROWTYPE;
  paid_date date;
  target_month date;
BEGIN
  SELECT * INTO member FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR member.role = 'ADMIN' THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF p_start_date IS NULL OR p_status IS NULL OR p_status NOT IN ('active', 'suspended', 'withdrawn')
    OR p_monthly_fee IS NULL OR p_monthly_fee < 0
    OR (p_status <> 'active' AND p_monthly_fee <> 0)
    OR (p_status = 'active' AND coalesce(p_plan, '') IN ('休会', '退会'))
    OR (p_end_date IS NOT NULL AND p_end_date < p_start_date)
  THEN RAISE EXCEPTION 'Invalid contract'; END IF;

  PERFORM set_config('app.membership_actor', p_actor, true);
  SELECT * INTO current_contract FROM public.membership_history
  WHERE user_id = p_user_id AND start_date <= p_start_date
  ORDER BY start_date DESC, created_at DESC, id DESC LIMIT 1;
  target_store := coalesce(p_store_id, current_contract.store_id, member.store_id);

  IF finish IS NULL THEN
    -- An existing scheduled change is preserved, including a scheduled return.
    SELECT min(start_date) INTO boundary FROM public.membership_history
    WHERE user_id = p_user_id AND start_date > p_start_date
      AND (status, plan, monthly_fee, store_id) IS DISTINCT FROM
          (current_contract.status, current_contract.plan, current_contract.monthly_fee, current_contract.store_id);
    IF boundary IS NOT NULL THEN finish := boundary - 1; END IF;
  END IF;

  FOR original IN SELECT * FROM public.membership_history
    WHERE user_id = p_user_id AND (end_date IS NULL OR end_date >= p_start_date)
      AND (finish IS NULL OR start_date <= finish) ORDER BY start_date FOR UPDATE
  LOOP
    DELETE FROM public.membership_history WHERE id = original.id;
    IF original.start_date < p_start_date THEN
      INSERT INTO public.membership_history(user_id, store_id, status, start_date, end_date, plan, monthly_fee, notes)
      VALUES (p_user_id, original.store_id, original.status, original.start_date, p_start_date - 1, original.plan, original.monthly_fee, original.notes);
    END IF;
    IF finish IS NOT NULL AND (original.end_date IS NULL OR original.end_date > finish) THEN
      INSERT INTO public.membership_history(user_id, store_id, status, start_date, end_date, plan, monthly_fee, notes)
      VALUES (p_user_id, original.store_id, original.status, finish + 1, original.end_date, original.plan, original.monthly_fee, original.notes);
    END IF;
  END LOOP;
  INSERT INTO public.membership_history(user_id, store_id, status, start_date, end_date, plan, monthly_fee)
  VALUES (p_user_id, target_store, p_status, p_start_date, finish, p_plan, p_monthly_fee);

  IF p_payment IS NOT NULL THEN
    target_month := (p_payment->>'target_date')::date;
    paid_date := nullif(p_payment->>'payment_date', '')::date;
    IF target_month IS NULL OR target_month <> date_trunc('month', p_start_date)::date THEN
      RAISE EXCEPTION 'Invalid payment month';
    END IF;
    SELECT * INTO payment FROM public.sales
    WHERE user_id = p_user_id AND target_date = target_month AND type = 'monthly_fee' FOR UPDATE;
    IF FOUND THEN
      -- A plan correction does not rewrite an already received amount.
      UPDATE public.sales SET
        amount = CASE WHEN payment.status = 'paid' AND paid_date IS NOT NULL THEN payment.amount ELSE p_monthly_fee END,
        status = CASE WHEN paid_date IS NULL THEN 'unpaid' ELSE 'paid' END,
        payment_date = paid_date, memo = p_payment->>'memo', updated_at = now()
      WHERE id = payment.id;
    ELSIF paid_date IS NOT NULL OR nullif(p_payment->>'memo', '') IS NOT NULL THEN
      INSERT INTO public.sales(user_id, store_id, type, target_date, amount, status, payment_date, memo)
      VALUES (p_user_id, target_store, 'monthly_fee', target_month, p_monthly_fee,
        CASE WHEN paid_date IS NULL THEN 'unpaid' ELSE 'paid' END, paid_date, p_payment->>'memo');
    END IF;
  END IF;
  PERFORM public.sync_member_contract_snapshot(p_user_id);
  RETURN jsonb_build_object('startDate', p_start_date, 'endDate', finish);
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_member_contract_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.contract_sync', true) IS DISTINCT FROM 'on'
    AND (NEW.plan, NEW.monthly_fee, NEW.status) IS DISTINCT FROM (OLD.plan, OLD.monthly_fee, OLD.status)
  THEN RAISE EXCEPTION 'Use monthly contract settings to change plan, fee or status'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_member_contract_fields BEFORE UPDATE ON public.users
FOR EACH ROW WHEN (OLD.role <> 'ADMIN') EXECUTE FUNCTION public.guard_member_contract_fields();

CREATE OR REPLACE FUNCTION public.initialize_member_contract() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role <> 'ADMIN' THEN
    PERFORM public.save_member_contract(NEW.id, (NEW.created_at AT TIME ZONE 'Asia/Tokyo')::date,
      NULL, coalesce(NEW.status, 'active'), coalesce(NEW.plan, '未契約'),
      CASE WHEN NEW.status IN ('suspended', 'withdrawn') THEN 0 ELSE coalesce(NEW.monthly_fee, 0) END,
      NEW.store_id, 'member_registration');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER initialize_member_contract AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.initialize_member_contract();

CREATE OR REPLACE FUNCTION public.move_member_contract_store() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.contract_sync', true) IS DISTINCT FROM 'on' AND NEW.role <> 'ADMIN' THEN
    PERFORM public.save_member_contract(NEW.id, (now() AT TIME ZONE 'Asia/Tokyo')::date,
      NULL, NEW.status, NEW.plan, NEW.monthly_fee, NEW.store_id, 'store_transfer');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER move_member_contract_store AFTER UPDATE OF store_id ON public.users
FOR EACH ROW WHEN (OLD.store_id IS DISTINCT FROM NEW.store_id) EXECUTE FUNCTION public.move_member_contract_store();

REVOKE ALL ON FUNCTION public.save_member_contract(uuid,date,date,text,text,integer,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_member_contract(uuid,date,date,text,text,integer,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.sync_member_contract_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_member_contract_snapshot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_all_member_contract_snapshots() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE member_id uuid; synced integer := 0; BEGIN
  FOR member_id IN SELECT DISTINCT user_id FROM public.membership_history LOOP
    PERFORM public.sync_member_contract_snapshot(member_id);
    synced := synced + 1;
  END LOOP;
  RETURN synced;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_all_member_contract_snapshots() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_member_contract_snapshots() TO service_role;
SELECT public.sync_all_member_contract_snapshots();

NOTIFY pgrst, 'reload schema';
COMMIT;
