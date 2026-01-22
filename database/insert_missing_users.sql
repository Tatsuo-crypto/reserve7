-- SQL to insert missing users from CSV
-- Generated at 2026-01-04T08:02:35.019Z

-- Drop plan check constraint to allow legacy/custom plan names
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_plan_values;

INSERT INTO public.users (full_name, email, password_hash, status, store_id, plan)
VALUES
('pistolmark@gmail.com', 'pistolmark@gmail.com-', '', 'active', '43296d78-13f3-4061-8d75-d38dfe907a5d', '【2号店】60分コース×2回'),
('ohisama33yui26@gmail.com', 'ohisama33yui26@gmail.com-', '', 'active', '43296d78-13f3-4061-8d75-d38dfe907a5d', '【2号店】60分コース×6回'),
('marikyon2@gmail.com', 'marikyon2@gmail.com-', '', 'active', '43296d78-13f3-4061-8d75-d38dfe907a5d', '【2号店】60分コース×6回')
ON CONFLICT (email) DO NOTHING;
