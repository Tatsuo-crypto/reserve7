'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addDays, differenceInMinutes, endOfMonth, format, isAfter, isSameDay, parse, setHours, setMinutes, startOfMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import Icon from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import { Shift, ShiftRequest } from '@/types'

interface Staff {
  id: string
  name: string
  email: string
  storeId: string
}

function getMonthDays(monthDate: Date) {
  const first = startOfMonth(monthDate)
  const last = endOfMonth(monthDate)
  const days: (Date | null)[] = []

  for (let i = 0; i < first.getDay(); i += 1) days.push(null)
  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(first.getFullYear(), first.getMonth(), day))
  }
  while (days.length % 7 !== 0) days.push(null)

  return days
}

function formatHours(start: string, end: string) {
  const hours = Math.round((differenceInMinutes(new Date(end), new Date(start)) / 60) * 10) / 10
  return `${Number.isInteger(hours) ? hours.toFixed(0) : hours}h`
}

function formatHourValue(hours: number) {
  const rounded = Math.round(hours * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}h`
}

function makeDateTime(dateValue: string, timeValue: string) {
  const base = parse(dateValue, 'yyyy-MM-dd', new Date())
  const [hour, minute] = timeValue.split(':').map(Number)
  return setMinutes(setHours(base, hour), minute)
}

export default function StaffShiftSubmitPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'confirmed' | 'request'>('request')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [requests, setRequests] = useState<ShiftRequest[]>([])
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('22:00')
  const [weeklyRepeat, setWeeklyRepeat] = useState(false)

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth])
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth])
  const dateValue = format(selectedDate, 'yyyy-MM-dd')

  const timeOptions = useMemo(() => {
    const options: string[] = []
    for (let hour = 6; hour <= 23; hour += 1) {
      const h = String(hour).padStart(2, '0')
      options.push(`${h}:00`)
      options.push(`${h}:30`)
    }
    return options
  }, [])

  const fetchData = async () => {
    if (!token) return

    try {
      setLoading(true)
      const authRes = await fetch(`/api/auth/trainer-token?token=${token}`)
      if (!authRes.ok) {
        const data = await authRes.json().catch(() => ({}))
        setError(data.error || '無効なURLです')
        return
      }

      const authData = await authRes.json()
      setStaff(authData.trainer)

      const params = new URLSearchParams({
        token,
        start: monthStart.toISOString(),
        end: monthEnd.toISOString()
      })

      const [shiftRes, requestRes] = await Promise.all([
        fetch(`/api/trainer/shifts?${params}`),
        fetch(`/api/trainer/shift-requests?${params}`)
      ])

      if (shiftRes.ok) {
        const data = await shiftRes.json()
        setShifts(data.shifts || [])
      }

      if (requestRes.ok) {
        const data = await requestRes.json()
        setRequests(data.requests || [])
      }
    } catch (err) {
      console.error(err)
      setError('データを取得できませんでした。画面を再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token, monthStart.getTime(), monthEnd.getTime()])

  const nextShift = useMemo(() => {
    const now = new Date()
    return shifts
      .filter(shift => isAfter(new Date(shift.end_time), now))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
  }, [shifts])

  const calendarDays = useMemo(() => getMonthDays(currentMonth), [currentMonth])

  const getDayItems = (day: Date) => {
    const dayShifts = shifts.filter(shift => isSameDay(new Date(shift.start_time), day))
    const dayRequests = requests.filter(request => isSameDay(new Date(request.start_time), day))
    return { dayShifts, dayRequests }
  }

  const handleSubmitRequest = async () => {
    const start = makeDateTime(dateValue, startTime)
    const end = makeDateTime(dateValue, endTime)

    if (!isAfter(end, start)) {
      alert('終了時間は開始時間より後にしてください')
      return
    }

    const requestRows = [{ startTime: start.toISOString(), endTime: end.toISOString() }]

    if (weeklyRepeat) {
      let nextDate = addDays(selectedDate, 7)
      while (nextDate <= monthEnd) {
        const nextStart = makeDateTime(format(nextDate, 'yyyy-MM-dd'), startTime)
        const nextEnd = makeDateTime(format(nextDate, 'yyyy-MM-dd'), endTime)
        requestRows.push({ startTime: nextStart.toISOString(), endTime: nextEnd.toISOString() })
        nextDate = addDays(nextDate, 7)
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/trainer/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, requests: requestRows })
      })

      if (!res.ok) {
        alert('提出できませんでした。もう一度お試しください。')
        return
      }

      setActiveTab('confirmed')
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-surface-base text-text-secondary">読み込み中...</div>
  }

  if (error || !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base px-6 text-center">
        <div>
          <p className="text-lg text-text-primary">アクセスできません</p>
          <p className="mt-2 text-sm text-text-secondary">{error || '無効なURLです'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base pb-10">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-raised/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/staff/${token}`)}
            className="h-10 w-10 rounded-full border border-border-subtle bg-surface-base p-0 text-brand-500"
            aria-label="戻る"
          >
            <Icon name="chevronLeft" size={22} />
          </Button>
          <div className="text-center">
            <h1 className="text-base font-semibold text-text-primary">シフト</h1>
            <p className="text-xs text-text-secondary">{staff.name}</p>
          </div>
          <div className="h-10 w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-brand-500" />
            <h2 className="text-base font-semibold text-text-primary">次の勤務</h2>
          </div>
          {nextShift ? (
            <div className="rounded-2xl bg-surface-base p-4">
              <p className="text-2xl font-semibold tabular-nums text-text-primary">
                {format(new Date(nextShift.start_time), 'M/d(E)', { locale: ja })}
              </p>
              <p className="mt-2 text-base tabular-nums text-text-secondary">
                {format(new Date(nextShift.start_time), 'HH:mm')}〜{format(new Date(nextShift.end_time), 'HH:mm')}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-base p-4 text-sm text-text-secondary">確定シフトはまだありません</div>
          )}
        </section>

        <div className="flex rounded-2xl bg-surface-overlay p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('confirmed')}
            className={`h-11 flex-1 rounded-2xl px-0 text-sm hover:bg-surface-raised ${activeTab === 'confirmed' ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'}`}
          >
            確定シフト
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('request')}
            className={`h-11 flex-1 rounded-2xl px-0 text-sm hover:bg-surface-raised ${activeTab === 'request' ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'}`}
          >
            希望提出
          </Button>
        </div>

        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
          <div className="mb-4 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="h-10 w-10 rounded-full bg-surface-base p-0 text-text-secondary"
            >
              <Icon name="chevronLeft" size={19} />
            </Button>
            <p className="text-base font-semibold text-text-primary">{format(currentMonth, 'yyyy年M月', { locale: ja })}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="h-10 w-10 rounded-full bg-surface-base p-0 text-text-secondary"
            >
              <Icon name="chevronRight" size={19} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted">
            {['日', '月', '火', '水', '木', '金', '土'].map(day => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="h-12 rounded-2xl" />

              const { dayShifts, dayRequests } = getDayItems(day)
              const selected = isSameDay(day, selectedDate)
              const hasConfirmed = dayShifts.length > 0
              const hasRequest = dayRequests.length > 0
              const hours = activeTab === 'confirmed'
                ? dayShifts.reduce((sum, item) => sum + differenceInMinutes(new Date(item.end_time), new Date(item.start_time)) / 60, 0)
                : dayRequests.reduce((sum, item) => sum + differenceInMinutes(new Date(item.end_time), new Date(item.start_time)) / 60, 0)

              return (
                <Button
                  key={day.toISOString()}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedDate(day)}
                  className={`h-14 rounded-2xl border px-0 text-center transition active:scale-[0.98] ${
                    selected
                      ? 'border-brand-500 bg-brand-500/20'
                      : hasConfirmed
                        ? 'border-border-subtle bg-surface-base'
                        : hasRequest
                          ? 'border-brand-500/40 bg-brand-500/10'
                          : 'border-transparent bg-surface-base/65'
                  }`}
                >
                  <div className={`text-xs tabular-nums ${selected ? 'text-brand-200' : 'text-text-secondary'}`}>{day.getDate()}</div>
                  {hours > 0 && <div className="mt-1 text-xs tabular-nums text-text-primary">{formatHourValue(hours)}</div>}
                </Button>
              )
            })}
          </div>
        </section>

        {activeTab === 'request' ? (
          <section className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-brand-500" />
              <h2 className="text-base font-semibold text-text-primary">{format(selectedDate, 'M/d(E)', { locale: ja })}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs text-text-secondary">開始</label>
                <select value={startTime} onChange={event => setStartTime(event.target.value)} className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-3 text-text-primary">
                  {timeOptions.map(time => <option key={`start-${time}`} value={time}>{time}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs text-text-secondary">終了</label>
                <select value={endTime} onChange={event => setEndTime(event.target.value)} className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-3 text-text-primary">
                  {timeOptions.map(time => <option key={`end-${time}`} value={time}>{time}</option>)}
                </select>
              </div>
            </div>
            <label className="mt-4 flex h-12 items-center justify-between rounded-2xl border border-border-subtle bg-surface-base px-4">
              <span className="text-sm text-text-primary">今月の同じ曜日にも追加</span>
              <input type="checkbox" checked={weeklyRepeat} onChange={event => setWeeklyRepeat(event.target.checked)} className="h-5 w-5 rounded-lg border-border-subtle text-brand-600 focus:ring-brand-500" />
            </label>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSubmitRequest}
              disabled={saving}
              className="mt-4 h-12 w-full rounded-2xl bg-brand-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              希望に追加
            </Button>
          </section>
        ) : (
          <section className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
            <div className="space-y-2">
              {shifts.length > 0 ? shifts.map(shift => (
                <div key={shift.id} className="flex items-center justify-between rounded-2xl bg-surface-base px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{format(new Date(shift.start_time), 'M/d(E)', { locale: ja })}</p>
                    <p className="text-xs tabular-nums text-text-secondary">{format(new Date(shift.start_time), 'HH:mm')}〜{format(new Date(shift.end_time), 'HH:mm')}</p>
                  </div>
                  <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs text-brand-200">{formatHours(shift.start_time, shift.end_time)}</span>
                </div>
              )) : (
                <div className="rounded-2xl bg-surface-base p-4 text-sm text-text-secondary">この月の確定シフトはありません</div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
