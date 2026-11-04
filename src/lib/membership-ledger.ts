export type ContractStatus = 'active' | 'suspended' | 'withdrawn'

export type ContractPeriod = {
  id?: string
  user_id?: string
  status: string
  start_date: string
  end_date: string | null
  plan?: string | null
  monthly_fee?: number | null
  store_id?: string | null
  created_at?: string
}

export type BillingMember = {
  id?: string
  plan?: string | null
  status?: string | null
  monthly_fee?: number | null
  billing_start_month?: string | null
  store_id?: string | null
}

export function japanDate(date = new Date()): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function countsAsMember(member: BillingMember, date = japanDate()) {
  return member.status === 'active' && Boolean(member.plan) && !['都度', '未契約'].includes(member.plan!) && (!member.billing_start_month || member.billing_start_month <= date)
}

export function monthBounds(month: string) {
  const [year, index] = month.split('-').map(Number)
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10),
  }
}

export function latestContract<T extends ContractPeriod>(periods: T[], date: string): T | null {
  return periods.filter(row => row.start_date <= date).sort((a, b) =>
    b.start_date.localeCompare(a.start_date) ||
    (b.created_at || '').localeCompare(a.created_at || '') ||
    (b.id || '').localeCompare(a.id || '')
  )[0] || null
}

export function contractAtDate(member: BillingMember, periods: ContractPeriod[], date = japanDate()) {
  const row = latestContract(periods, date)
  if (!row) {
    return { ...member, status: periods.length ? 'withdrawn' : member.status, contract: null }
  }
  const ended = Boolean(row.end_date && row.end_date < date)
  // Suspension remains a suspension until an explicit return or withdrawal.
  const status = ended && row.status === 'active' ? 'withdrawn' : row.status
  return {
    ...member,
    status,
    plan: row.plan,
    monthly_fee: row.monthly_fee,
    store_id: row.store_id ?? member.store_id,
    contract: row,
  }
}

export function monthlyContract(member: BillingMember, periods: ContractPeriod[], month: string) {
  const { start, end } = monthBounds(month)
  // A withdrawal part-way through a paid month does not erase that month's fee.
  const paidPeriods = periods.filter(row => row.status === 'active' && row.plan !== '未契約' && row.start_date <= end && (!row.end_date || row.end_date >= start))
  const row = latestContract(paidPeriods, end) || latestContract(periods, end)
  const billingStarted = !member.billing_start_month || member.billing_start_month <= end
  const endedBeforeMonth = Boolean(row?.end_date && row.end_date < start)
  const status = row && endedBeforeMonth && row.status === 'active' ? 'withdrawn' : (row?.status || 'withdrawn')
  const billable = Boolean(row && row.plan !== '未契約' && status === 'active' && !endedBeforeMonth && billingStarted)
  const amount = billable ? row!.monthly_fee ?? null : 0
  return {
    month,
    row,
    plan: row?.plan || '',
    status,
    billable,
    amount,
    needsReview: billable && (amount === null || !row?.plan),
    storeId: row?.store_id ?? member.store_id,
  }
}

export function monthlySales<T extends ContractPeriod>(periods: T[], members: Map<string, BillingMember>, month: string, storeId?: string | null) {
  const byUser = new Map<string, T[]>()
  for (const row of periods) {
    if (!row.user_id) continue
    const list = byUser.get(row.user_id) || []
    list.push(row)
    byUser.set(row.user_id, list)
  }
  return Array.from(byUser.entries()).flatMap(([userId, rows]) => {
    const contract = monthlyContract(members.get(userId) || {}, rows, month)
    if (!contract.billable || (storeId && storeId !== 'all' && contract.storeId !== storeId)) return []
    return [{ userId, ...contract }]
  })
}

export function monthlyMovement(periods: ContractPeriod[], members: Map<string, BillingMember & { full_name?: string }>, month: string, storeId?: string | null) {
  const byUser = new Map<string, ContractPeriod[]>()
  for (const row of periods) {
    if (!row.user_id) continue
    byUser.set(row.user_id, [...(byUser.get(row.user_id) || []), row])
  }
  const { start, end } = monthBounds(month)
  const previousDate = new Date(`${start}T00:00:00Z`)
  previousDate.setUTCDate(0)
  const nextDate = new Date(`${end}T00:00:00Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  const previousMonth = previousDate.toISOString().slice(0, 7)
  const nextMonth = nextDate.toISOString().slice(0, 7)
  const newMembers: { user_id: string; full_name: string; plan: string; date: string }[] = []
  const withdrawnMembers: typeof newMembers = []
  const suspendedMembers: typeof newMembers = []
  let active = 0
  for (const [userId, rows] of Array.from(byUser)) {
    const member = members.get(userId) || {}
    const current = monthlyContract(member, rows, month)
    if (storeId && storeId !== 'all' && current.storeId !== storeId) continue
    const previous = monthlyContract(member, rows, previousMonth)
    const next = monthlyContract(member, rows, nextMonth)
    const atEnd = contractAtDate(member, rows, end)
    const label = { user_id: userId, full_name: member.full_name || '不明', plan: current.plan, date: start }
    if (current.billable && countsAsMember(atEnd, end)) active++
    if (current.billable && current.plan !== '都度' && !previous.billable) {
      const billedStart = member.billing_start_month || current.row?.start_date || start
      newMembers.push({ ...label, date: billedStart.slice(0, 7) === month ? billedStart : start })
    }
    if (current.billable && !next.billable && next.status === 'withdrawn') {
      withdrawnMembers.push({ ...label, date: current.row?.end_date || end })
    }
    if (atEnd.status === 'suspended') suspendedMembers.push({ ...label, date: atEnd.contract?.start_date || start })
  }
  return { month, active, new: newMembers.length, withdrawn: withdrawnMembers.length, suspended: suspendedMembers.length, newMembers, withdrawnMembers, suspendedMembers }
}
