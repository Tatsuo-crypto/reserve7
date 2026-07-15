'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStoreChange } from '@/hooks/useStoreChange'
import Icon from '@/components/ui/icons'
import { calculatePayrollTotals, findHourlyWage, payableHours, PayRate } from '@/lib/payroll'

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
  memo: string
  source: 'shift' | 'saved'
}

type PayrollItem = {
  trainer: {
    id: string
    fullName: string
    storeId: string
    dailyTransportationCost: number
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

  for (let i = 0; i < firstDay.getDay(); i += 1) {
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
    <div className="mt-4 rounded-xl border border-border-subtle bg-surface-base p-3">
      <div className="mb-2 grid grid-cols-7 text-center text-[10px] text-text-muted">
        {['日', '月', '火', '水', '木', '金', '土'].map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="min-h-12 rounded-lg" />
          }

          const key = toDateKey(day)
          const workRows = rowsByDate[key] || []
          const hasWork = workRows.length > 0
          const firstRow = workRows[0]
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
                <div className="mt-1 truncate text-[10px] tabular-nums text-text-primary">
                  {timeLabel}
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
  const [storeScope, setStoreScope] = useState<'mine' | 'all'>(adminStoreId ? 'mine' : 'all')
  const [stores, setStores] = useState<StoreOption[]>([])
  const [items, setItems] = useState<PayrollItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<PayrollItem | null>(null)
  const [editRows, setEditRows] = useState<PayrollRow[]>([])
  const [allowanceAmount, setAllowanceAmount] = useState('0')
  const [adjustmentAmount, setAdjustmentAmount] = useState('0')
  const [memo, setMemo] = useState('')
  const [breakdownOpen, setBreakdownOpen] = useState(false)

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
    if (adminStoreId) setStoreScope('mine')
  }, [adminStoreId])

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

    try {
      setLoading(true)
      const res = await fetch(`/api/admin/payroll?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(data.payroll || [])
    } catch (error) {
      console.error(error)
      setItems([])
      alert('給与データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, storeScope, adminStoreId])

  const openDetail = (item: PayrollItem) => {
    setSelected(item)
    setEditRows(item.rows)
    setAllowanceAmount(String(item.month?.allowance_amount || 0))
    setAdjustmentAmount(String(item.month?.adjustment_amount || 0))
    setMemo(item.month?.memo || '')
  }

  const updateRow = (index: number, patch: Partial<PayrollRow>) => {
    setEditRows(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row))
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
        breakMinutes: 0,
        transportationEnabled: true,
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
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const summaryTotals = useMemo(() => {
    return items.reduce((acc, item) => ({
      hours: acc.hours + item.totals.payableHourTotal,
      total: acc.total + item.totals.totalPay
    }), { hours: 0, total: 0 })
  }, [items])

  const summaryBreakdown = useMemo(() => buildPayrollBreakdown(items), [items])

  if (status === 'loading') return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
      <div className="bg-surface-raised shadow rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-normal text-text-primary">給与計算</h1>
            <p className="text-xs text-text-muted mt-1">予定シフトを下書きにして、実勤務を確認します</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              className="border border-border-strong rounded-md px-2 py-1.5 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <select
              className="border border-border-strong rounded-md px-2 py-1.5 text-sm"
              value={storeScope}
              onChange={(e) => setStoreScope(e.target.value as 'mine' | 'all')}
            >
              <option value="mine" disabled={!adminStoreId}>自店舗</option>
              <option value="all">全店舗</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          type="button"
          onClick={() => setBreakdownOpen(true)}
          className="bg-surface-raised shadow rounded-lg p-4 text-left transition active:scale-[0.99]"
        >
          <div className="text-xs text-text-muted">合計時間</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="text-2xl font-normal text-text-primary">{formatHours(summaryTotals.hours)}時間</div>
            <Icon name="chevronRight" size={18} className="text-text-muted" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => setBreakdownOpen(true)}
          className="bg-surface-raised shadow rounded-lg p-4 text-left transition active:scale-[0.99]"
        >
          <div className="text-xs text-text-muted">支給見込み</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="text-2xl font-normal text-text-primary">{formatYen(summaryTotals.total)}</div>
            <Icon name="chevronRight" size={18} className="text-text-muted" />
          </div>
        </button>
      </div>

      <div className="bg-surface-raised shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-text-secondary text-sm">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">給与対象スタッフがいません</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {items.map(item => (
              <button
                key={item.trainer.id}
                className="w-full text-left px-4 py-4 hover:bg-surface-base transition-colors"
                onClick={() => openDetail(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-normal text-text-primary">{item.trainer.fullName}</span>
                      {item.month?.status === 'confirmed' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300">確定済み</span>
                      )}
                      {item.month?.changed_after_confirm && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">確定後に変更あり</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-1">{storeNameById[item.trainer.storeId] || ''}</div>
                  </div>
                  <Icon name="chevronRight" size={20} className="text-text-muted" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3 text-xs">
                  <div><span className="text-text-muted">勤務</span><div className="text-text-primary">{formatHours(item.totals.payableHourTotal)}時間</div></div>
                  <div><span className="text-text-muted">基本給</span><div className="text-text-primary">{formatYen(item.totals.basePay)}</div></div>
                  <div><span className="text-text-muted">出勤日</span><div className="text-text-primary">{item.totals.transportationDays}日</div></div>
                  <div><span className="text-text-muted">交通費</span><div className="text-text-primary">{formatYen(item.totals.transportationPay)}</div></div>
                  <div><span className="text-text-muted">調整</span><div className="text-text-primary">{formatYen((item.month?.allowance_amount || 0) + (item.month?.adjustment_amount || 0))}</div></div>
                  <div><span className="text-text-muted">合計</span><div className="text-text-primary">{formatYen(item.totals.totalPay)}</div></div>
                </div>
                <PayrollWorkCalendar rows={item.rows} month={month} />
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && detailTotals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-surface-raised rounded-lg border border-border-strong shadow-lg w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border-subtle flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-normal text-text-primary">{selected.trainer.fullName}</h2>
                <p className="text-xs text-text-muted mt-1">{month} の給与明細</p>
              </div>
              <button className="p-2 text-text-muted hover:text-text-primary" onClick={() => setSelected(null)}>
                <Icon name="close" size={20} />
              </button>
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
                  <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm" type="number" value={allowanceAmount} onChange={(e) => setAllowanceAmount(e.target.value)} />
                </label>
                <label className="text-xs text-text-secondary">
                  調整金額
                  <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm" type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} />
                </label>
                <label className="text-xs text-text-secondary">
                  メモ
                  <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm" value={memo} onChange={(e) => setMemo(e.target.value)} />
                </label>
              </div>

              <div className="flex justify-between items-center gap-3">
                <h3 className="text-sm font-normal text-text-primary">勤務明細</h3>
                <button className="px-3 py-1.5 text-xs rounded-full bg-surface-overlay text-text-secondary hover:bg-surface-base" onClick={addRow}>
                  勤務を追加
                </button>
              </div>

              <div className="space-y-3">
                {editRows.map((row, index) => {
                  const hours = payableHours(row.clockIn, row.clockOut, row.breakMinutes)
                  const wage = findHourlyWage(selected.rates, row.workDate)
                  const rowPay = Math.round(hours * wage)
                  return (
                    <div key={`${row.id || row.shiftId || 'new'}-${index}`} className="border border-border-subtle rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                        <label className="text-xs text-text-secondary">
                          出勤
                          <input
                            className="mt-1 w-full border rounded-md px-2 py-2 text-sm"
                            type="datetime-local"
                            value={toDateTimeLocal(row.clockIn)}
                            onChange={(e) => updateRow(index, { clockIn: fromDateTimeLocal(e.target.value), workDate: e.target.value.slice(0, 10) })}
                          />
                        </label>
                        <label className="text-xs text-text-secondary">
                          退勤
                          <input
                            className="mt-1 w-full border rounded-md px-2 py-2 text-sm"
                            type="datetime-local"
                            value={toDateTimeLocal(row.clockOut)}
                            onChange={(e) => updateRow(index, { clockOut: fromDateTimeLocal(e.target.value) })}
                          />
                        </label>
                        <label className="text-xs text-text-secondary">
                          休憩分
                          <input
                            className="mt-1 w-full border rounded-md px-2 py-2 text-sm"
                            type="number"
                            min="0"
                            value={row.breakMinutes}
                            onChange={(e) => updateRow(index, { breakMinutes: Number(e.target.value || 0) })}
                          />
                        </label>
                        <label className="text-xs text-text-secondary">
                          交通費
                          <select
                            className="mt-1 w-full border rounded-md px-2 py-2 text-sm"
                            value={row.transportationEnabled ? 'yes' : 'no'}
                            onChange={(e) => updateRow(index, { transportationEnabled: e.target.value === 'yes' })}
                          >
                            <option value="yes">対象</option>
                            <option value="no">対象外</option>
                          </select>
                        </label>
                        <div className="text-xs">
                          <div className="text-text-muted">計算</div>
                          <div className="text-text-primary mt-1">
                            {formatYen(wage)} × {formatHours(hours)}時間 = {formatYen(rowPay)}
                          </div>
                        </div>
                        <div className="flex justify-end">
                          {!row.id && !row.shiftId && (
                            <button className="p-2 text-text-muted hover:text-red-400" onClick={() => removeUnsavedRow(index)}>
                              <Icon name="trash" size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        className="mt-3 w-full border rounded-md px-3 py-2 text-sm"
                        placeholder="メモ"
                        value={row.memo}
                        onChange={(e) => updateRow(index, { memo: e.target.value })}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle flex justify-end gap-3">
              <button className="px-3 py-2 text-sm rounded-md border" onClick={() => setSelected(null)} disabled={saving}>キャンセル</button>
              <button className="px-3 py-2 text-sm rounded-md border" onClick={() => saveDetail('draft')} disabled={saving}>保存</button>
              <button className="px-3 py-2 text-sm rounded-md bg-brand-700 text-white hover:bg-brand-800" onClick={() => saveDetail('confirmed')} disabled={saving}>確定</button>
            </div>
          </div>
        </div>
      )}

      {breakdownOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBreakdownOpen(false)} />
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-border-subtle bg-surface-raised shadow-xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-4">
              <div>
                <h2 className="text-lg font-normal text-text-primary">支給計算</h2>
                <p className="mt-1 text-xs text-text-muted">{formatHours(summaryBreakdown.hours)}時間 / {formatYen(summaryBreakdown.totalPay)}</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-base text-text-secondary" onClick={() => setBreakdownOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="overflow-auto p-4">
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
