import { test, expect, type Page } from '@playwright/test'
import { monthlyPlanChangeSchema } from '../../src/lib/monthly-membership'
import { applyCurrentMembership } from '../../src/lib/membership-utils'

test.use({ timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' })

const baseChange = { month: '2026-10', plan: '月4回', monthlyFee: 26400, status: 'active' as const }
test('contract validation rejects missing amounts and empty or inconsistent plans', () => {
  for (const monthlyFee of [undefined, null, '', '26400', -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(monthlyPlanChangeSchema.safeParse({ ...baseChange, monthlyFee }).success).toBe(false)
  }
  for (const plan of ['', ' ', null, '退会', '休会']) {
    expect(monthlyPlanChangeSchema.safeParse({ ...baseChange, plan }).success).toBe(false)
  }
  for (const month of ['2026-13', '2026-00', '2026-1', 'invalid']) {
    expect(monthlyPlanChangeSchema.safeParse({ ...baseChange, month }).success).toBe(false)
  }
  expect(monthlyPlanChangeSchema.safeParse({ ...baseChange, status: 'suspended' }).success).toBe(false)
  expect(monthlyPlanChangeSchema.safeParse({ ...baseChange, monthlyFee: 0 }).success).toBe(true)
})

test('future changes do not replace the currently effective contract', () => {
  const member = { status: 'active', plan: '月4回', monthly_fee: 26400 }
  const histories = [
    { status: 'active' as const, plan: '月4回', monthly_fee: 26400, start_date: '2026-11-01', end_date: '2026-11-30' },
    { status: 'active' as const, plan: '月2回', monthly_fee: 15400, start_date: '2026-12-01', end_date: null },
  ]
  expect(applyCurrentMembership(member, histories, '2026-11-04')).toEqual(member)
  expect(applyCurrentMembership(member, histories, '2026-12-01')).toMatchObject({ plan: '月2回', monthly_fee: 15400 })
})

async function contractFixture(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+09:00'))
  const writes: any[] = []
  const payments = ['2026-10', '2026-11'].map(month => ({ month, plan: '月4回', expectedAmount: 25000, actualAmount: null, status: 'unpaid', paymentDate: null, targetDate: null, membershipStatus: 'active' }))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let result: any = { data: [] }
    if (path === '/api/auth/session') result = { user: { id: 'admin-demo', role: 'ADMIN', email: 'tandjgym@gmail.com' }, expires: '2099-01-01' }
    if (path === '/api/admin/members/contract-preview') result = { data: { id: 'contract-preview', full_name: '確認用 会員', plan: '月4回', monthly_fee: 25000, status: 'active' } }
    if (path === '/api/admin/members/contract-preview/payments') result = { data: { payments } }
    if (path === '/api/admin/members/contract-preview/monthly-plan') {
      writes.push(route.request().postDataJSON())
      result = { data: { success: true } }
    }
    await route.fulfill({ json: result })
  })
  return writes
}

test('returning members are directed to their existing contract before duplicate registration', async ({ page }) => {
  const writes: any[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/session') return route.fulfill({ json: { user: { role: 'ADMIN', email: 'tandjgym@gmail.com' }, expires: '2099-01-01' } })
    if (path === '/api/admin/stores') return route.fulfill({ json: { stores: [{ id: 'store', name: '1号店' }] } })
    if (path === '/api/admin/members' && route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON())
      return route.fulfill({ status: 409, json: { error: '同じ氏名の会員が登録されています', duplicates: [{ id: 'existing', full_name: '復帰 会員' }] } })
    }
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto('/admin/members/new')
  await page.getByLabel('氏名', { exact: true }).fill('復帰 会員')
  await page.getByRole('button', { name: '登録', exact: true }).click()
  await expect(page.getByRole('link', { name: '復帰 会員の契約・復帰を設定' })).toHaveAttribute('href', '/admin/members/existing/history')
  expect(writes[0].allowDuplicateName).toBe(false)
  await page.getByRole('checkbox', { name: '同姓同名の別人として登録する' }).check()
  await page.getByRole('button', { name: '登録', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1].allowDuplicateName).toBe(true)
})

for (const width of [320, 1280]) {
  test(`contract editing requires an explicit fee and records the selected scope at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const writes = await contractFixture(page)
    await page.goto('/admin/members/contract-preview/history')
    await page.getByRole('row').filter({ hasText: '2026年11月' }).getByRole('button', { name: '編集' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('適用範囲')).toHaveValue('continuing')
    await expect(dialog.getByLabel('月額費用')).toHaveValue('25000')
    await dialog.getByLabel('月額費用').fill('')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('月額費用を入力')
    expect(writes).toHaveLength(0)
    await dialog.getByLabel('プラン', { exact: true }).selectOption('月4回')
    await dialog.getByLabel('月額費用').fill('26400')
    await dialog.getByLabel('月額費用').blur()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await dialog.screenshot({ path: testInfo.outputPath(`monthly-contract-${width}.png`) })
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes[0]).toMatchObject({ month: '2026-11', plan: '月4回', monthlyFee: 26400, applyScope: 'continuing' })
    await page.getByRole('row').filter({ hasText: '2026年10月' }).getByRole('button', { name: '編集' }).click()
    await expect(dialog.getByLabel('適用範囲')).toHaveValue('month')
    await dialog.getByLabel('月額費用').fill('0')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes[1]).toMatchObject({ month: '2026-10', monthlyFee: 0, applyScope: 'month' })
    await page.getByRole('button', { name: 'プランを追加・復帰' }).click()
    await expect(dialog.getByLabel('月額費用')).toHaveValue('25000')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  })
}
