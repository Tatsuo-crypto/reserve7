export type PayrollMonthRange = {
  monthStartDate: string
  nextMonthStartDate: string
  startIso: string
  endIso: string
}

export type PayRate = {
  hourly_wage: number
  effective_from: string
  effective_to?: string | null
}

export type PayrollWorkRow = {
  work_date: string
  clock_in: string
  clock_out: string
  break_minutes: number
  transportation_enabled?: boolean
}

export function getPayrollMonthRange(month: string): PayrollMonthRange {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('月の形式が正しくありません')
  }

  const [year, monthIndex] = month.split('-').map(Number)
  const start = new Date(`${month}-01T00:00:00+09:00`)
  const nextYear = monthIndex === 12 ? year + 1 : year
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1
  const nextMonthText = `${nextYear}-${String(nextMonth).padStart(2, '0')}`
  const end = new Date(`${nextMonthText}-01T00:00:00+09:00`)

  return {
    monthStartDate: `${month}-01`,
    nextMonthStartDate: `${nextMonthText}-01`,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  }
}

export function toTokyoDateString(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export function minutesBetween(start: string, end: string, breakMinutes: number): number {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return 0
  const rawMinutes = Math.floor((endTime - startTime) / 60000)
  return Math.max(0, rawMinutes - Math.max(0, breakMinutes || 0))
}

export function payableHours(start: string, end: string, breakMinutes: number): number {
  return minutesBetween(start, end, breakMinutes) / 60
}

export function findHourlyWage(rates: PayRate[], workDate: string): number {
  const matched = rates
    .filter(rate => {
      const fromOk = rate.effective_from <= workDate
      const toOk = !rate.effective_to || rate.effective_to >= workDate
      return fromOk && toOk
    })
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]

  return matched?.hourly_wage || 0
}

export function calculatePayrollTotals(
  rows: PayrollWorkRow[],
  rates: PayRate[],
  dailyTransportationCost: number,
  allowanceAmount: number,
  adjustmentAmount: number
) {
  let payableHourTotal = 0
  let basePay = 0
  const transportationDates = new Set<string>()

  rows.forEach(row => {
    const hours = payableHours(row.clock_in, row.clock_out, row.break_minutes)
    const wage = findHourlyWage(rates, row.work_date)
    payableHourTotal += hours
    basePay += Math.round(hours * wage)

    if (hours > 0 && row.transportation_enabled !== false) {
      transportationDates.add(row.work_date)
    }
  })

  const transportationPay = transportationDates.size * Math.max(0, dailyTransportationCost || 0)
  const totalPay = basePay + transportationPay + (allowanceAmount || 0) + (adjustmentAmount || 0)

  return {
    payableHourTotal,
    basePay,
    transportationDays: transportationDates.size,
    transportationPay,
    totalPay
  }
}
