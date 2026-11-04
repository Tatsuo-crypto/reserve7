import { test, expect } from '@playwright/test'
import { contractAtDate, monthlyContract, monthlyMovement, monthlySales, type ContractPeriod } from '../../src/lib/membership-ledger'

const member = { id: 'member', full_name: '契約テスト', status: 'suspended', plan: '休会', monthly_fee: 0, billing_start_month: '2026-03-01', store_id: 'store' }
const rows: ContractPeriod[] = [
  { user_id: 'member', status: 'active', start_date: '2026-02-28', end_date: '2026-09-30', plan: '月4回', monthly_fee: 26620, store_id: 'store' },
  { user_id: 'member', status: 'active', start_date: '2026-10-01', end_date: '2026-10-31', plan: '月2回', monthly_fee: 15400, store_id: 'store' },
  { user_id: 'member', status: 'suspended', start_date: '2026-11-01', end_date: '2026-12-31', plan: '休会', monthly_fee: 0, store_id: 'store' },
  { user_id: 'member', status: 'active', start_date: '2027-01-01', end_date: null, plan: '月2回', monthly_fee: 15400, store_id: 'store' },
]
const members = new Map([['member', member]])

test('current suspension cannot change historical fees', () => {
  expect(monthlyContract(member, rows, '2026-09').amount).toBe(26620)
  expect(monthlyContract(member, rows, '2026-10').amount).toBe(15400)
  expect(monthlyContract(member, rows, '2026-11').amount).toBe(0)
  expect(monthlyContract(member, rows, '2027-01').amount).toBe(15400)
  expect(monthlyContract(member, rows, '2026-02').billable).toBe(false)
})

test('all monthly screens share the same amount and one row per member', () => {
  for (const month of ['2026-03', '2026-10', '2026-11', '2027-01']) {
    const contract = monthlyContract(member, rows, month)
    const sales = monthlySales(rows, members, month, 'store')
    expect(sales.length).toBe(contract.billable ? 1 : 0)
    expect(sales.reduce((sum, item) => sum + (item.amount || 0), 0)).toBe(contract.amount)
  }
  expect(monthlySales(rows, members, '2026-10', 'other-store')).toEqual([])
})

test('historical missing fee is unknown and never replaced by a current fee or a standard fee', () => {
  const unknown = [{ ...rows[0], monthly_fee: null }]
  expect(monthlyContract(member, unknown, '2026-03')).toMatchObject({ amount: null, needsReview: true })
})

test('expired contracts do not extend automatically across gaps', () => {
  const gap = rows.slice(0, 2)
  expect(monthlyContract(member, gap, '2026-11')).toMatchObject({ billable: false, amount: 0, status: 'withdrawn' })
})

test('a return counts once, while a plan change is not a new member', () => {
  expect(monthlyMovement(rows, members, '2026-03').new).toBe(1)
  expect(monthlyMovement(rows, members, '2026-10').new).toBe(0)
  expect(monthlyMovement(rows, members, '2026-11')).toMatchObject({ new: 0, withdrawn: 0, suspended: 1 })
  expect(monthlyMovement(rows, members, '2027-01')).toMatchObject({ new: 1, active: 1, suspended: 0 })
})

test('withdrawal counts in the final billed month', () => {
  expect(monthlyMovement(rows.slice(0, 2), members, '2026-10').withdrawn).toBe(1)
  expect(monthlyMovement(rows.slice(0, 2), members, '2026-11').withdrawn).toBe(0)
})

test('future changes do not overwrite the current contract; expired suspension stays suspended', () => {
  expect(contractAtDate(member, rows, '2026-09-15')).toMatchObject({ plan: '月4回', monthly_fee: 26620, status: 'active' })
  expect(contractAtDate(member, rows, '2026-11-04')).toMatchObject({ status: 'suspended', monthly_fee: 0 })
  expect(contractAtDate(member, rows.slice(0, 3), '2027-01-05')).toMatchObject({ status: 'suspended' })
})

test('an explicit zero fee is distinct from an unknown fee', () => {
  expect(monthlyContract(member, [{ ...rows[0], monthly_fee: 0 }], '2026-03')).toMatchObject({ amount: 0, needsReview: false })
})

test('withdrawal during a paid month preserves that month and stops the following month', () => {
  const periods = [
    { ...rows[0], end_date: '2026-10-14' },
    { ...rows[1], start_date: '2026-10-15', end_date: null, status: 'withdrawn', plan: '退会', monthly_fee: 0 },
  ]
  expect(monthlyContract(member, periods, '2026-10').amount).toBe(26620)
  expect(monthlyContract(member, periods, '2026-11').amount).toBe(0)
  expect(monthlyMovement(periods, members, '2026-10').withdrawn).toBe(1)
})
