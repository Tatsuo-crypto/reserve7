'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

type AttendanceShift = {
  id: string
  startTime: string
  endTime: string
  attended: boolean
}

type AttendanceResponse = {
  trainer: {
    id: string
    name: string
    storeId: string
  }
  date: string
  shifts: AttendanceShift[]
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00+09:00`)
  return parsed.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo'
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo'
  })
}

function todayTokyo() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export default function TrainerAttendancePage() {
  const params = useParams()
  const token = params?.token as string
  const [data, setData] = useState<AttendanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAttendance = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/trainer/attendance?token=${token}&_t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) {
        setError('出勤データを取得できませんでした。画面を再読み込みしてください。')
        return
      }
      const nextData = await response.json()
      setData(nextData)
      setError(null)
    } catch (err) {
      console.error(err)
      setError('出勤データを取得できませんでした。画面を再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchAttendance()
  }, [token])

  const toggleAttendance = async (shift: AttendanceShift) => {
    try {
      setSavingId(shift.id)
      const response = await fetch('/api/trainer/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          shiftId: shift.id,
          startTime: shift.startTime,
          endTime: shift.endTime,
          attended: !shift.attended
        })
      })
      if (!response.ok) {
        alert('保存できませんでした。もう一度お試しください。')
        return
      }
      await fetchAttendance()
    } catch (err) {
      console.error(err)
      alert('保存できませんでした。もう一度お試しください。')
    } finally {
      setSavingId(null)
    }
  }

  const isToday = data?.date === todayTokyo()
  const heading = data?.date && !isToday ? '次回の出勤' : '今日の出勤'
  const emptyText = data?.date && !isToday ? '今後のシフトはありません' : '今日のシフトはありません'
  const hasAttended = data?.shifts.some(shift => shift.attended) === true

  return (
    <div className="min-h-screen bg-surface-base pb-28">
      <header className="sticky top-0 z-50 h-16 border-b border-border-subtle bg-surface-raised/80 backdrop-blur-md">
        <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center px-4">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">出勤</h1>
          {data?.trainer && (
            <div className="absolute right-4 top-1/2 flex h-10 -translate-y-1/2 items-center gap-1 rounded-full border border-border-subtle bg-surface-raised px-4 shadow-sm">
              <span className="whitespace-nowrap text-sm font-normal text-text-secondary">
                {data.trainer.name}
              </span>
              <span className="ml-1 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-normal text-white">
                トレーナー
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-5">
        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
          {hasAttended && (
            <div className="mb-5 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-900/30">
                <Icon name="check" size={34} />
              </div>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xl font-semibold text-text-primary">{heading}</div>
              <div className="mt-1 text-sm text-text-secondary">
                {data?.date ? formatDate(data.date) : ''}
              </div>
            </div>
            {!hasAttended && (
              <Icon name="checkCircle" size={24} className="text-brand-500" />
            )}
          </div>

          {loading && (
            <div className="rounded-2xl bg-surface-base px-4 py-5 text-center text-sm text-text-secondary">
              読み込み中...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl bg-surface-base px-4 py-5 text-center text-sm text-text-secondary">
              {error}
            </div>
          )}

          {!loading && !error && data?.shifts.length === 0 && (
            <div className="rounded-2xl bg-surface-base px-4 py-5 text-center text-sm text-text-secondary">
              {emptyText}
            </div>
          )}

          {!loading && !error && data?.shifts.map(shift => (
            (() => {
              const canToggle = isToday && savingId !== shift.id
              return (
            <div
              key={shift.id}
              className={`mb-3 rounded-2xl border px-4 py-4 last:mb-0 ${
                shift.attended
                  ? 'border-brand-600/70 bg-brand-900/20'
                  : 'border-border-subtle bg-surface-base'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-normal text-text-primary">
                    {formatTime(shift.startTime)}〜{formatTime(shift.endTime)}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {shift.attended ? '出勤済み' : '未出勤'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toggleAttendance(shift)}
                  disabled={!canToggle}
                  className={`h-10 rounded-full px-4 text-sm font-normal transition active:scale-[0.98] disabled:opacity-50 ${
                    shift.attended
                      ? 'bg-surface-raised text-text-secondary'
                      : !isToday
                        ? 'bg-surface-overlay text-text-muted'
                      : 'bg-brand-700 text-white'
                  }`}
                >
                  {shift.attended ? '取消' : '出勤'}
                </Button>
              </div>
            </div>
              )
            })()
          ))}
        </section>
      </main>
    </div>
  )
}
