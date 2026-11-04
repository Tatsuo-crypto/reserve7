const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const testRequire = process.env.PG_TEST_MODULE_ROOT
  ? createRequire(path.join(process.env.PG_TEST_MODULE_ROOT, 'package.json'))
  : require
const { PGlite } = testRequire('@electric-sql/pglite')
const { btree_gist } = testRequire('@electric-sql/pglite/contrib/btree_gist')

async function main() {
  const db = new PGlite({ extensions: { btree_gist } })
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA extensions;
    CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text, role text DEFAULT 'CLIENT', status text DEFAULT 'active', plan text, monthly_fee integer, store_id uuid, billing_start_month date, created_at timestamptz DEFAULT now());
    CREATE TABLE membership_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), store_id uuid, status text, plan text, monthly_fee integer, start_date date, end_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), store_id uuid, type text, amount integer, target_date date, payment_date date, status text, memo text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  `)
  const snapshotPath = process.env.MEMBERSHIP_TEST_SNAPSHOT
  if (snapshotPath) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    for (const row of snapshot.users) {
      await db.query('INSERT INTO users(id, full_name, status, plan, monthly_fee, store_id, billing_start_month, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [row.id, row.full_name, row.status, row.plan, row.monthly_fee, row.store_id, row.billing_start_month, row.created_at])
    }
    for (const row of snapshot.history) {
      await db.query('INSERT INTO membership_history(id,user_id,store_id,status,plan,monthly_fee,start_date,end_date,notes,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [row.id,row.user_id,row.store_id,row.status,row.plan,row.monthly_fee,row.start_date,row.end_date,row.notes,row.created_at])
    }
    for (const row of snapshot.sales) {
      await db.query('INSERT INTO sales(id,user_id,type,amount,target_date,payment_date,status,memo) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [row.id,row.user_id,row.type,row.amount,row.target_date,row.payment_date,row.status,row.memo])
    }
  }
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261104_unify_member_contracts.sql'), 'utf8'))
  const overlaps = await db.query('SELECT count(*)::integer AS count FROM membership_history a JOIN membership_history b ON a.user_id=b.user_id AND a.id<b.id AND daterange(a.start_date,a.end_date,\'[]\') && daterange(b.start_date,b.end_date,\'[]\')')
  assert.equal(overlaps.rows[0].count, 0)

  const id = '00000000-0000-4000-8000-000000000001'
  await db.query('INSERT INTO users(id,full_name,plan,monthly_fee,created_at) VALUES($1,$2,$3,$4,$5)', [id,'契約テスト','月4回',26620,'2026-03-01T00:00:00Z'])
  const save = (start, end, status, plan, fee, payment = null) => db.query('SELECT save_member_contract($1,$2,$3,$4,$5,$6,NULL,$7,$8)', [id,start,end,status,plan,fee,'transaction-test',payment])
  await save('2026-10-01',null,'active','月2回',15400)
  await save('2026-11-01',null,'suspended','休会',0)
  let rows = (await db.query('SELECT start_date::text,end_date::text,plan,monthly_fee FROM membership_history WHERE user_id=$1 ORDER BY start_date', [id])).rows
  assert.deepEqual(rows.map(row => [row.start_date,row.end_date,row.monthly_fee]), [['2026-03-01','2026-09-30',26620],['2026-10-01','2026-10-31',15400],['2026-11-01',null,0]])

  await save('2026-12-01',null,'active','月2回',15400)
  await save('2026-11-01',null,'suspended','休会',0)
  rows = (await db.query('SELECT start_date::text,end_date::text,plan,monthly_fee FROM membership_history WHERE user_id=$1 ORDER BY start_date', [id])).rows
  assert(rows.some(row => row.start_date === '2026-12-01' && row.monthly_fee === 15400), 'Scheduled return must remain')
  await save('2026-06-01','2026-06-30','active','月2回',12000)
  assert.equal((await db.query("SELECT monthly_fee FROM membership_history WHERE user_id=$1 AND start_date <= '2026-07-01' AND (end_date IS NULL OR end_date >= '2026-07-01')", [id])).rows[0].monthly_fee,26620)

  await save('2026-10-01','2026-10-31','active','月2回',15400,{target_date:'2026-10-01',memo:'入金メモのみ'})
  assert.equal((await db.query('SELECT status FROM sales WHERE user_id=$1', [id])).rows[0].status,'unpaid')
  await save('2026-10-01','2026-10-31','active','月2回',15400,{target_date:'2026-10-01',payment_date:'2026-10-03',memo:'入金済み'})
  await save('2026-10-01','2026-10-31','active','月2回',14000,{target_date:'2026-10-01',payment_date:'2026-10-03',memo:'契約訂正'})
  assert.equal((await db.query('SELECT amount FROM sales WHERE user_id=$1', [id])).rows[0].amount,15400, 'Contract edits must preserve received amounts')

  const before = JSON.stringify((await db.query('SELECT * FROM membership_history WHERE user_id=$1 ORDER BY start_date', [id])).rows)
  await assert.rejects(save('2026-07-01',null,'active','月8回',46200,{target_date:'not-a-date'}))
  assert.equal(JSON.stringify((await db.query('SELECT * FROM membership_history WHERE user_id=$1 ORDER BY start_date', [id])).rows),before, 'Failed payment must roll back the contract')
  await assert.rejects(db.query("INSERT INTO membership_history(user_id,status,plan,monthly_fee,start_date) VALUES($1,'active','月4回',26620,'2026-09-01')", [id]), /overlap/)
  await assert.rejects(db.query('UPDATE users SET monthly_fee=999 WHERE id=$1', [id]), /monthly contract/)
  await Promise.all([save('2027-02-01',null,'active','月2回',15400),save('2027-02-01',null,'active','月4回',26400)])
  assert.equal((await db.query("SELECT count(*)::int AS count FROM membership_history WHERE user_id=$1 AND start_date='2027-02-01'", [id])).rows[0].count,1)
  assert((await db.query('SELECT count(*)::int AS count FROM membership_change_log WHERE user_id=$1', [id])).rows[0].count > 0)
  console.log('PASS: legacy normalization, registration, suspension, return, historical correction, payment preservation, rollback, overlap prevention, direct-write guard, concurrent saves and audit trail')
  await db.close()
}
main().catch(error => { console.error(error); process.exitCode = 1 })
