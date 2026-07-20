'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStoreChange } from '@/hooks/useStoreChange'
import Icon from '@/components/ui/icons'
import AppModal from '@/components/ui/AppModal'
import Button from '@/components/ui/Button'
import { autoBreakMinutes, calculatePayrollTotals, findHourlyWage, payableHours, PayRate } from '@/lib/payroll'

type PayrollRow = {
  id: string | null
  shiftId: string | null
  workDate: string
  scheduledStart: string | null
  scheduledEnd: string | null
  clockIn: string
  clockOut: string
  breakMinutes: number
  transportationEnabled: boolean
  attended: boolean
  memo: string
  source: 'shift' | 'saved'
}

type PayrollItem = {
  trainer: {
    id: string
    fullName: string
    storeId: string
    dailyTransportationCost: number
    breakRuleThresholdMinutes: number
    breakRuleMinutes: number
  }
  rates: PayRate[]
  month: {
    allowance_amount: number
    adjustment_amount: number
    memo: string | null
    status: 'draft' | 'confirmed'
    changed_after_confirm: boolean
  } | null
  totals: {
    payableHourTotal: number
    basePay: number
    transportationDays: number
    transportationPay: number
    totalPay: number
  }
  rows: PayrollRow[]
}

type StoreOption = {
  id: string
  name: string
}

type PayrollBreakdownRow = {
  key: string
  trainerName: string
  workDate: string
  clockIn: string
  clockOut: string
  hours: number
  wage: number
  pay: number
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function nextMonthStartDate(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  const nextYear = monthIndex === 12 ? year + 1 : year
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

function formatYen(value: number) {
  return `${Math.round(value || 0).toLocaleString('ja-JP')}円`
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

function toDateTimeLocal(value: string) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDateTimeLocal(value: string) {
  if (!value) return ''
  return new Date(value).toISOString()
}

function localDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

function getMonthCalendarDays(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  const firstDay = new Date(year, monthIndex - 1, 1)
  const lastDay = new Date(year, monthIndex, 0)
  const cells: (Date | null)[] = []

  const leadingEmptyDays = (firstDay.getDay() + 6) % 7

  for (let i = 0; i < leadingEmptyDays; i += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(year, monthIndex - 1, day))
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

function toDateKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatTime(value: string) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDateLabel(value: string) {
  return format(new Date(`${value}T00:00:00`), 'M/d(E)', { locale: ja })
}

function buildPayrollBreakdown(items: PayrollItem[]) {
  const rows: PayrollBreakdownRow[] = items
    .flatMap(item => item.rows.map((row, index) => {
      const hours = payableHours(row.clockIn, row.clockOut, row.breakMinutes)
      const wage = findHourlyWage(item.rates, row.workDate)
      return {
        key: `${item.trainer.id}-${row.id || row.shiftId || index}`,
        trainerName: item.trainer.fullName,
        workDate: row.workDate,
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        hours,
        wage,
        pay: Math.round(hours * wage)
      }
    }))
    .filter(row => row.hours > 0)
    .sort((a, b) => a.clockIn.localeCompare(b.clockIn))

  const basePay = rows.reduce((sum, row) => sum + row.pay, 0)
  const transportationPay = items.reduce((sum, item) => sum + item.totals.transportationPay, 0)
  const adjustmentPay = items.reduce((sum, item) => (
    sum + (item.month?.allowance_amount || 0) + (item.month?.adjustment_amount || 0)
  ), 0)
  const hours = rows.reduce((sum, row) => sum + row.hours, 0)

  return {
    rows,
    hours,
    basePay,
    transportationPay,
    adjustmentPay,
    totalPay: basePay + transportationPay + adjustmentPay
  }
}

function PayrollWorkCalendar({ rows, month }: { rows: PayrollRow[], month: string }) {
  const days = getMonthCalendarDays(month)
  const rowsByDate = rows.reduce<Record<string, PayrollRow[]>>((acc, row) => {
    if (!acc[row.workDate]) acc[row.workDate] = []
    acc[row.workDate].push(row)
    return acc
  }, {})

  return (
    <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-base p-3">
      <div className="mb-2 grid grid-cols-7 text-center text-xs text-text-muted">
        {['月', '火', '水', '木', '金', '土', '日'].map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="min-h-12 rounded-lg" />
          }

          const key = toDateKey(day)
          const workRows = rowsByDate[key] || []
          const hasWork = workRows.length > 0
          const attended = workRows.some(row => row.attended)
          const totalHours = workRows.reduce((sum, row) => sum + payableHours(row.clockIn, row.clockOut, row.breakMinutes), 0)
          const timeLabel = `${formatHours(totalHours)}h`

          return (
            <div
              key={key}
              className={`min-h-12 rounded-lg border px-1 py-1 text-center ${
                hasWork
                  ? 'border-brand-500/45 bg-brand-500/15'
                  : 'border-transparent bg-surface-raised/40'
              }`}
            >
              <div className={`text-xs tabular-nums ${hasWork ? 'text-brand-200' : 'text-text-muted'}`}>
                {day.getDate()}
              </div>
              {hasWork && (
                <div className="mt-1 flex items-center justify-center gap-1 truncate text-xs tabular-nums text-text-primary">
                  <span>{timeLabel}</span>
                  {attended && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminPayrollPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { currentStoreId } = useStoreChange()
  const adminStoreId = currentStoreId || (session as any)?.user?.storeId || ''

  const [month, setMonth] = useState(currentMonth())
  const [storeScope, setStoreScope] = useState<'mine' | 'all'>('all')
  const [payrollTrainerId, setPayrollTrainerId] = useState('')
  const [stores, setStores] = useState<StoreOption[]>([])
  const [items, setItems] = useState<PayrollItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<PayrollItem | null>(null)
  const [editRows, setEditRows] = useState<PayrollRow[]>([])
  const [allowanceAmount, setAllowanceAmount] = useState('0')
  const [adjustmentAmount, setAdjustmentAmount] = useState('0')
  const [breakRuleThresholdHours, setBreakRuleThresholdHours] = useState('8')
  const [breakRuleMinutes, setBreakRuleMinutes] = useState('120')
  const [hourlyWage, setHourlyWage] = useState('')
  const [hourlyWageEffectiveFrom, setHourlyWageEffectiveFrom] = useState('')
  const [memo, setMemo] = useState('')
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTrainerId, setSettingsTrainerId] = useState('')
  const [settingsHourlyWage, setSettingsHourlyWage] = useState('')
  const [settingsHourlyWageEffectiveFrom, setSettingsHourlyWageEffectiveFrom] = useState('')
  const [settingsBreakRuleThresholdHours, setSettingsBreakRuleThresholdHours] = useState('8')
  const [settingsBreakRuleMinutes, setSettingsBreakRuleMinutes] = useState('2')
  const [settingsTransportationCost, setSettingsTransportationCost] = useState('0')

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch('/api/admin/stores?status=active', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setStores((data.stores || []).map((store: any) => ({ id: store.id, name: store.name })))
      } catch {}
    }
    fetchStores()
  }, [])

  const storeNameById = useMemo(() => {
    const map: Record<string, string> = {}
    stores.forEach(store => { map[store.id] = store.name })
    return map
  }, [stores])

  const fetchPayroll = async () => {
    if (storeScope === 'mine' && !adminStoreId) return
    const params = new URLSearchParams({ month })
    params.set('storeId', storeScope === 'mine' ? adminStoreId : 'all')
    params.set('_t', String(Date.now()))

    try {
      setLoading(true)
      const res = await fetch(`/api/admin/payroll?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(data.payroll || [])
    } catch (error) {
      console.error(error)
      setItems([])
      alert('給与データを読み込めませんでした。画面を再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, storeScope, adminStoreId])

  useEffect(() => {
    if (items.length === 0) {
      setPayrollTrainerId('')
      return
    }
    if (!items.some(item => item.trainer.id === payrollTrainerId)) {
      setPayrollTrainerId(items[0].trainer.id)
    }
  }, [items, payrollTrainerId])

  const openDetail = (item: PayrollItem) => {
    setSelected(item)
    setEditRows(item.rows)
    setAllowanceAmount(String(item.month?.allowance_amount || 0))
    setAdjustmentAmount(String(item.month?.adjustment_amount || 0))
    setBreakRuleThresholdHours(String((item.trainer.breakRuleThresholdMinutes || 480) / 60))
    setBreakRuleMinutes(String(item.trainer.breakRuleMinutes || 120))
    const nextRate = [...(item.rates || [])]
      .filter(rate => rate.effective_from >= `${month}-01`)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
    const latestRate = [...(item.rates || [])]
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
    setHourlyWage(String(nextRate?.hourly_wage || latestRate?.hourly_wage || ''))
    setHourlyWageEffectiveFrom(nextRate?.effective_from || nextMonthStartDate(month))
    setMemo(item.month?.memo || '')
  }

  const updateRow = (index: number, patch: Partial<PayrollRow>) => {
    setEditRows(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  const currentBreakRule = useMemo(() => ({
    thresholdMinutes: Math.max(0, Math.round(Number(breakRuleThresholdHours || 0) * 60)),
    breakMinutes: Math.max(0, Math.floor(Number(breakRuleMinutes || 0)))
  }), [breakRuleThresholdHours, breakRuleMinutes])

  const updateRowTime = (index: number, patch: Partial<PayrollRow>) => {
    setEditRows(rows => rows.map((row, i) => {
      if (i !== index) return row
      const nextRow = { ...row, ...patch }
      return {
        ...nextRow,
        breakMinutes: autoBreakMinutes(nextRow.clockIn, nextRow.clockOut, currentBreakRule)
      }
    }))
  }

  const applyBreakRuleToRows = () => {
    setEditRows(rows => rows.map(row => ({
      ...row,
      breakMinutes: autoBreakMinutes(row.clockIn, row.clockOut, currentBreakRule)
    })))
  }

  const addRow = () => {
    const date = `${month}-01`
    setEditRows(rows => [
      ...rows,
      {
        id: null,
        shiftId: null,
        workDate: date,
        scheduledStart: null,
        scheduledEnd: null,
        clockIn: localDateTimeIso(date, '09:00'),
        clockOut: localDateTimeIso(date, '10:00'),
        breakMinutes: autoBreakMinutes(localDateTimeIso(date, '09:00'), localDateTimeIso(date, '10:00'), currentBreakRule),
        transportationEnabled: true,
        attended: false,
        memo: '',
        source: 'saved'
      }
    ])
  }

  const removeUnsavedRow = (index: number) => {
    setEditRows(rows => rows.filter((_, i) => i !== index))
  }

  const detailTotals = useMemo(() => {
    if (!selected) return null
    return calculatePayrollTotals(
      editRows.map(row => ({
        work_date: row.workDate,
        clock_in: row.clockIn,
        clock_out: row.clockOut,
        break_minutes: row.breakMinutes,
        transportation_enabled: row.transportationEnabled
      })),
      selected.rates,
      selected.trainer.dailyTransportationCost,
      Number(allowanceAmount || 0),
      Number(adjustmentAmount || 0)
    )
  }, [selected, editRows, allowanceAmount, adjustmentAmount])

  const saveDetail = async (statusValue: 'draft' | 'confirmed') => {
    if (!selected) return
    try {
      setSaving(true)
      const res = await fetch('/api/admin/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trainerId: selected.trainer.id,
          month,
          rows: editRows,
          allowanceAmount: Number(allowanceAmount || 0),
          adjustmentAmount: Number(adjustmentAmount || 0),
          memo,
          status: statusValue
        })
      })
      if (!res.ok) throw new Error(await res.text())
      setSelected(null)
      await fetchPayroll()
    } catch (error) {
      console.error(error)
      alert('保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const selectedPayrollItem = useMemo(() => {
    return items.find(item => item.trainer.id === payrollTrainerId) || null
  }, [items, payrollTrainerId])

  const breakdownItems = useMemo(() => {
    return selectedPayrollItem ? [selectedPayrollItem] : []
  }, [selectedPayrollItem])

  const summaryTotals = useMemo(() => {
    if (!selectedPayrollItem) return { hours: 0, total: 0 }
    return {
      hours: selectedPayrollItem.totals.payableHourTotal,
      total: selectedPayrollItem.totals.totalPay
    }
  }, [selectedPayrollItem])

  const summaryBreakdown = useMemo(() => buildPayrollBreakdown(breakdownItems), [breakdownItems])
  const settingsItem = useMemo(() => {
    return items.find(item => item.trainer.id === settingsTrainerId) || items[0] || null
  }, [items, settingsTrainerId])

  const hydratePayrollSettings = (item: PayrollItem) => {
    const latestRate = [...(item.rates || [])]
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
    setSettingsTrainerId(item.trainer.id)
    setSettingsHourlyWage(String(latestRate?.hourly_wage || ''))
    setSettingsHourlyWageEffectiveFrom(nextMonthStartDate(month).slice(0, 7))
    setSettingsBreakRuleThresholdHours(String((item.trainer.breakRuleThresholdMinutes || 480) / 60))
    setSettingsBreakRuleMinutes(String((item.trainer.breakRuleMinutes || 120) / 60))
    setSettingsTransportationCost(String(item.trainer.dailyTransportationCost || 0))
  }

  const openPayrollSettings = () => {
    const item = selectedPayrollItem || settingsItem || items[0]
    if (!item) return
    hydratePayrollSettings(item)
    setSettingsOpen(true)
  }

  const changeSettingsTrainer = (trainerId: string) => {
    const item = items.find(payrollItem => payrollItem.trainer.id === trainerId)
    if (!item) return
    hydratePayrollSettings(item)
  }

  const savePayrollSettings = async () => {
    if (!settingsTrainerId) return
    try {
      setSaving(true)
      const res = await fetch('/api/admin/payroll/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trainerId: settingsTrainerId,
          dailyTransportationCost: Number(settingsTransportationCost || 0),
          breakRuleThresholdMinutes: Math.max(0, Math.round(Number(settingsBreakRuleThresholdHours || 0) * 60)),
          breakRuleMinutes: Math.max(0, Math.round(Number(settingsBreakRuleMinutes || 0) * 60)),
          hourlyWage: settingsHourlyWage ? Number(settingsHourlyWage) : undefined,
          hourlyWageEffectiveFrom: settingsHourlyWageEffectiveFrom ? `${settingsHourlyWageEffectiveFrom}-01` : undefined
        })
      })
      if (!res.ok) throw new Error(await res.text())
      setSettingsOpen(false)
      await fetchPayroll()
    } catch (error) {
      console.error(error)
      alert('給与設定を保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
      <div className="mb-4 rounded-2xl bg-surface-raised p-4 shadow">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sr-only">月</span>
            <input
              type="month"
              className="h-10 w-full rounded-full border border-border-subtle bg-surface-base px-3 text-sm text-text-primary"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label className="relative block">
            <span className="sr-only">店舗</span>
            <select
              className="h-10 w-full appearance-none rounded-full border border-border-subtle bg-surface-base px-3 pr-11 text-sm text-text-primary"
              value={storeScope}
              onChange={(e) => setStoreScope(e.target.value as 'mine' | 'all')}
            >
              <option value="mine" disabled={!adminStoreId}>自店舗</option>
              <option value="all">全店舗</option>
            </select>
            <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-text-secondary" />
          </label>
          <label className="relative col-span-2 block">
            <span className="sr-only">スタッフ</span>
            <select
              className="h-10 w-full appearance-none rounded-full border border-border-subtle bg-surface-base px-3 pr-11 text-sm text-text-primary disabled:opacity-50"
              value={payrollTrainerId}
              onChange={(e) => setPayrollTrainerId(e.target.value)}
              disabled={items.length === 0}
            >
              {items.length === 0 ? (
                <option value="">スタッフ未選択</option>
              ) : items.map(item => (
                <option key={item.trainer.id} value={item.trainer.id}>{item.trainer.fullName}</option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-text-secondary" />
          </label>
        </div>
      </div>

      {selectedPayrollItem && (
        <div className="mb-4 rounded-2xl bg-surface-raised p-5 shadow">
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs text-text-muted">支給見込み</div>
            <div className="mt-1 text-2xl font-normal leading-tight text-text-primary">
              {formatYen(selectedPayrollItem.totals.totalPay)}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface-base px-4 py-3">
              <div className="text-xs text-text-muted">勤務</div>
              <div className="mt-1 text-base font-normal text-text-primary">{formatHours(selectedPayrollItem.totals.payableHourTotal)}時間</div>
            </div>
            <div className="rounded-2xl bg-surface-base px-4 py-3">
              <div className="text-xs text-text-muted">出勤</div>
              <div className="mt-1 text-base font-normal text-text-primary">{selectedPayrollItem.totals.transportationDays}日</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => openDetail(selectedPayrollItem)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 text-sm text-text-primary transition hover:bg-zinc-900 active:scale-[0.99]"
            >
              <Icon name="documentText" size={16} className="text-text-secondary" />
              給与詳細
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={openPayrollSettings}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 text-sm text-text-primary transition hover:bg-zinc-900 active:scale-[0.99]"
            >
              <Icon name="settings" size={16} className="text-text-secondary" />
              給与設定
            </Button>
          </div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl bg-surface-raised px-4 py-8 text-center text-sm text-text-secondary">
          給与対象スタッフがいません
        </div>
      )}

      {selected && detailTotals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-surface-raised rounded-lg border border-border-strong shadow-lg w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border-subtle flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-normal text-text-primary">{selected.trainer.fullName}</h2>
                <p className="text-xs text-text-muted mt-1">{month} の給与明細</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0 text-text-muted hover:text-text-primary" onClick={() => setSelected(null)}>
                <Icon name="close" size={20} />
              </Button>
            </div>

            <div className="overflow-auto p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-surface-base rounded-lg p-3">
                  <div className="text-xs text-text-muted">計算時間</div>
                  <div className="text-lg text-text-primary mt-1">{formatHours(detailTotals.payableHourTotal)}時間</div>
                </div>
                <div className="bg-surface-base rounded-lg p-3">
                  <div className="text-xs text-text-muted">基本給</div>
                  <div className="text-lg text-text-primary mt-1">{formatYen(detailTotals.basePay)}</div>
                </div>
                <div className="bg-surface-base rounded-lg p-3">
                  <div className="text-xs text-text-muted">交通費</div>
                  <div className="text-lg text-text-primary mt-1">{formatYen(detailTotals.transportationPay)}</div>
                </div>
                <div className="bg-surface-base rounded-lg p-3">
                  <div className="text-xs text-text-muted">手当・調整</div>
                  <div className="text-lg text-text-primary mt-1">{formatYen(Number(allowanceAmount || 0) + Number(adjustmentAmount || 0))}</div>
                </div>
                <div className="bg-surface-base rounded-lg p-3">
                  <div className="text-xs text-text-muted">支給見込み</div>
                  <div className="text-lg text-text-primary mt-1">{formatYen(detailTotals.totalPay)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs text-text-secondary">
                  手当
                  <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" type="number" value={allowanceAmount} onChange={(e) => setAllowanceAmount(e.target.value)} />
                </label>
                <label className="text-xs text-text-secondary">
                  調整金額
                  <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} />
                </label>
                <label className="text-xs text-text-secondary">
                  メモ
                  <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={memo} onChange={(e) => setMemo(e.target.value)} />
                </label>
              </div>

            </div>

            <div className="p-4 border-t border-border-subtle flex justify-end gap-3">
              <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setSelected(null)} disabled={saving}>キャンセル</Button>
              <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => saveDetail('draft')} disabled={saving}>保存</Button>
              <Button type="button" size="sm" className="rounded-lg" onClick={() => saveDetail('confirmed')} disabled={saving}>確定</Button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && settingsItem && (
        <AppModal
          title="給与設定"
          onClose={() => setSettingsOpen(false)}
          bodyClassName="space-y-3 p-4"
          footer={(
            <>
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setSettingsOpen(false)} disabled={saving}>キャンセル</Button>
              <Button type="button" size="sm" className="rounded-full px-5" onClick={savePayrollSettings} disabled={saving}>保存</Button>
            </>
          )}
        >
              <label className="block text-xs text-text-secondary">
                スタッフ
                <select
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2.5 text-sm text-text-primary"
                  value={settingsTrainerId}
                  onChange={(event) => changeSettingsTrainer(event.target.value)}
                >
                  {items.map(item => (
                    <option key={item.trainer.id} value={item.trainer.id}>{item.trainer.fullName}</option>
                  ))}
                </select>
              </label>

              <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base">
                <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
                  <span className="h-4 w-1 rounded-full bg-brand-500" />
                  <h3 className="text-sm font-normal text-text-primary">時給</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  <label className="text-xs text-text-secondary">
                    適用月
                    <input
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5 text-sm text-text-primary"
                      type="month"
                      value={settingsHourlyWageEffectiveFrom}
                      onChange={(event) => setSettingsHourlyWageEffectiveFrom(event.target.value)}
                    />
                  </label>
                  <label className="text-xs text-text-secondary">
                    時給
                    <div className="mt-1 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5">
                      <input
                        className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-text-primary outline-none"
                        type="number"
                        min="0"
                        value={settingsHourlyWage}
                        onChange={(event) => setSettingsHourlyWage(event.target.value)}
                      />
                      <span className="text-xs text-text-muted">円</span>
                    </div>
                  </label>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base">
                <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
                  <span className="h-4 w-1 rounded-full bg-brand-500" />
                  <h3 className="text-sm font-normal text-text-primary">勤務条件</h3>
                </div>
                <label className="flex min-h-14 items-center justify-between gap-3 border-b border-border-subtle px-3 py-2 text-xs text-text-secondary">
                  <span className="shrink-0">休憩</span>
                  <div className="flex min-w-0 items-center justify-end gap-1.5">
                    <input
                      className="w-14 rounded-lg border border-border-subtle bg-surface-raised px-2 py-2 text-center text-sm tabular-nums text-text-primary outline-none focus:border-brand-500"
                      type="number"
                      min="0"
                      step="0.5"
                      value={settingsBreakRuleThresholdHours}
                      onChange={(event) => setSettingsBreakRuleThresholdHours(event.target.value)}
                    />
                    <span className="whitespace-nowrap text-text-muted">時間以上</span>
                    <span className="text-brand-400">→</span>
                    <input
                      className="w-14 rounded-lg border border-border-subtle bg-surface-raised px-2 py-2 text-center text-sm tabular-nums text-text-primary outline-none focus:border-brand-500"
                      type="number"
                      min="0"
                      step="0.5"
                      value={settingsBreakRuleMinutes}
                      onChange={(event) => setSettingsBreakRuleMinutes(event.target.value)}
                    />
                    <span className="whitespace-nowrap text-text-muted">時間</span>
                  </div>
                </label>
                <label className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 text-xs text-text-secondary">
                  <span className="shrink-0">交通費</span>
                  <div className="flex items-center justify-end gap-1.5">
                    <input
                      className="w-24 rounded-lg border border-border-subtle bg-surface-raised px-2 py-2 text-right text-sm tabular-nums text-text-primary outline-none focus:border-brand-500"
                      type="number"
                      min="0"
                      value={settingsTransportationCost}
                      onChange={(event) => setSettingsTransportationCost(event.target.value)}
                    />
                    <span className="whitespace-nowrap text-text-muted">円 / 日</span>
                  </div>
                </label>
              </section>
        </AppModal>
      )}

      {breakdownOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBreakdownOpen(false)} />
          <div className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border-subtle bg-surface-raised shadow-xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-4">
              <div>
                <h2 className="text-lg font-normal text-text-primary">支給計算</h2>
                <p className="mt-1 text-xs text-text-muted">{formatHours(summaryBreakdown.hours)}時間 / {formatYen(summaryBreakdown.totalPay)}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" className="h-9 w-9 rounded-full bg-surface-base p-0 text-text-secondary" onClick={() => setBreakdownOpen(false)}>
                <Icon name="close" size={18} />
              </Button>
            </div>

            <div className="overflow-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {selectedPayrollItem && (
                <div className="mb-4">
                  <PayrollWorkCalendar rows={selectedPayrollItem.rows} month={month} />
                </div>
              )}

              <div className="space-y-2">
                {summaryBreakdown.rows.map(row => (
                  <div key={row.key} className="rounded-2xl border border-border-subtle bg-surface-base px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-text-primary">
                          {formatDateLabel(row.workDate)}
                          <span className="ml-2 text-text-secondary">{row.trainerName}</span>
                        </div>
                        <div className="mt-1 text-xs tabular-nums text-text-secondary">
                          {formatTime(row.clockIn)}〜{formatTime(row.clockOut)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm tabular-nums text-text-primary">{formatYen(row.pay)}</div>
                        <div className="mt-1 text-xs tabular-nums text-text-secondary">
                          {formatYen(row.wage)} × {formatHours(row.hours)}h = {formatYen(row.pay)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 rounded-2xl border border-border-subtle bg-surface-base p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">基本給</span>
                  <span className="tabular-nums text-text-primary">{formatYen(summaryBreakdown.basePay)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">交通費</span>
                  <span className="tabular-nums text-text-primary">{formatYen(summaryBreakdown.transportationPay)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">手当・調整</span>
                  <span className="tabular-nums text-text-primary">{formatYen(summaryBreakdown.adjustmentPay)}</span>
                </div>
                <div className="flex justify-between border-t border-border-subtle pt-3 text-base">
                  <span className="text-text-primary">合計</span>
                  <span className="tabular-nums text-text-primary">{formatYen(summaryBreakdown.totalPay)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
