'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import TimelineView from './TimelineView'
import { useStoreChange } from '@/hooks/useStoreChange'
import Icon from '@/components/ui/icons'

interface Reservation {
  id: string
  title: string
  startTime: string
  endTime: string
  notes?: string
  memo?: string
  trainerId?: string
  client: {
    id: string
    fullName: string
    email: string
    plan?: string
    storeId?: string
  }
}

interface Shift {
  id: string
  trainerId: string
  trainerName: string
  startTime: string
  endTime: string
}

interface ShiftTemplate {
  id: string
  trainerId: string
  trainerName: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string
  type: 'reservation' | 'blocked' | 'guest' | 'training'
  clientName?: string
  plan?: string
  notes?: string
  trainerId?: string
}

interface CalendarViewProps {
  onViewModeChange?: (mode: 'month' | 'timeline') => void
  onBackToMonth?: () => void
  trainerToken?: string | null
}

interface Trainer {
  id: string
  name: string
  email: string
}

type CalendarApiData = {
  reservations: Reservation[]
  shifts: Shift[]
  templates: ShiftTemplate[]
  trainers: Trainer[]
}

const CALENDAR_CACHE_MS = 30 * 1000
const calendarDataCache = new Map<string, { timestamp: number, data: CalendarApiData }>()
const calendarDataPromises = new Map<string, Promise<CalendarApiData>>()

function getCalendarMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    key,
  }
}

async function fetchCalendarPayload(url: string, cacheKey: string, force = false): Promise<CalendarApiData> {
  if (!force) {
    const cached = calendarDataCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CALENDAR_CACHE_MS) {
      return cached.data
    }

    const inflight = calendarDataPromises.get(cacheKey)
    if (inflight) return inflight
  }

  const promise = fetch(url, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Calendar API error: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      const data = result.data || result
      return {
        reservations: data.reservations || [],
        shifts: data.shifts || [],
        templates: data.templates || [],
        trainers: data.trainers || [],
      }
    })
    .then((data) => {
      calendarDataCache.set(cacheKey, {
        timestamp: Date.now(),
        data,
      })
      return data
    })
    .finally(() => {
      calendarDataPromises.delete(cacheKey)
    })

  calendarDataPromises.set(cacheKey, promise)
  return promise
}

export default function CalendarView({ onViewModeChange, onBackToMonth, trainerToken }: CalendarViewProps = {}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const { count: storeChangeCount } = useStoreChange()
  const lastFetchRef = useRef<{ key: string, at: number } | null>(null)

  // Note: タイトルの採番はサーバ側で行うため、フロントでは変更しない

  // 苗字のみを抽出（スペース区切りの最初の部分）
  const extractLastName = (fullName: string) => {
    if (!fullName) return ''
    // 半角スペースまたは全角スペースで分割
    const nameParts = fullName.split(/\s|　/)
    return nameParts[0] || fullName
  }

  // タイトルから苗字と回数を抽出（例：「東條成美1/6」→「東條1/6」）
  const formatReservationTitle = (title: string, plan?: string) => {
    if (!title) return ''

    // 「予約不可」などの特殊なタイトルはそのまま返す
    if (!title.match(/\d+\/\d+/)) return title

    // 「名前X/Y」の形式から「苗字X/Y」を抽出
    const match = title.match(/^(.+?)(\d+\/\d+)$/)
    if (match) {
      const fullName = match[1].trim()
      const count = match[2]
      const lastName = extractLastName(fullName)

      // 都度会員の場合は回数を表示しない
      if (plan === '都度') {
        return lastName
      }

      return `${lastName}${count}`
    }

    return title
  }

  // Reset to month view when component mounts (e.g., after creating a reservation)
  useEffect(() => {
    setViewMode('month')
    setSelectedDate('')
  }, [])

  const fetchCalendarData = useCallback(async (force = false) => {
    try {
      setLoading(true)

      const range = getCalendarMonthRange(currentDate)
      const params = new URLSearchParams({
        start: range.start,
        end: range.end,
      })
      if (trainerToken) {
        params.append('token', trainerToken)
      }

      const cacheKey = params.toString()
      const data = await fetchCalendarPayload(`/api/calendar?${cacheKey}`, cacheKey, force)
      const reservations = data.reservations
      setDebugInfo(`API Status: Calendar=200, ResCount=${reservations.length}`)

      if (reservations.length > 0) {
        // Transform reservations to calendar events (タイトルはサーバの値をそのまま使用)
        const calendarEvents: CalendarEvent[] = reservations.map(reservation => {
          const startDate = new Date(reservation.startTime)
          const endDate = new Date(reservation.endTime)

          // Use JST timezone for consistent display
          const startTime = startDate.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Tokyo'
          })
          const endTime = endDate.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Tokyo'
          })

          // Use JST for date as well
          const dateInJST = startDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Asia/Tokyo'
          }).split('/').map(part => part.padStart(2, '0')).join('-')

          // Determine type based on title and client ID
          const isBlocked = reservation.client.id === 'blocked' || (reservation.title && reservation.title.includes('予約不可'))
          const isTrial = reservation.title && reservation.title.includes('体験')
          const isGuest = reservation.client.id === 'guest' || (reservation.title && reservation.title.includes('ゲスト')) || reservation.client.email === 'guest@system'
          const isTraining = reservation.client.id === 'training' || reservation.title === '研修'

          return {
            id: reservation.id,
            title: reservation.title,
            date: dateInJST,
            time: `${startTime} - ${endTime}`,
            type: isTraining ? 'training' : isBlocked ? 'blocked' : (isGuest ? 'guest' : 'reservation'),
            clientName: isTraining ? '研修' : isBlocked ? '予約不可' : isTrial ? '体験' : (isGuest ? 'Guest' : extractLastName(reservation.client.fullName)),
            plan: reservation.client.plan,
            notes: reservation.memo || reservation.notes || '',
            trainerId: (reservation as any).trainerId
          }
        })

        setEvents(calendarEvents)
      } else {
        setEvents([])
      }
      setShifts(data.shifts)
      setTemplates(data.templates)
      setTrainers(data.trainers)
      setDebugInfo(prev => `${prev}, ShiftsCount=${data.shifts.length}, TemplatesCount=${data.templates.length}`)

    } catch (error) {
      console.error('Failed to fetch calendar data:', error)
      setDebugInfo(`Fetch Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentDate, trainerToken])

  // Get calendar data
  useEffect(() => {
    const range = getCalendarMonthRange(currentDate)
    const fetchKey = `${trainerToken || 'admin'}:${storeChangeCount}:${range.key}`
    const lastFetch = lastFetchRef.current
    if (lastFetch?.key === fetchKey && Date.now() - lastFetch.at < 2000) {
      return
    }
    lastFetchRef.current = { key: fetchKey, at: Date.now() }

    fetchCalendarData()
  }, [currentDate, fetchCalendarData, storeChangeCount, trainerToken])

  const handleCalendarSync = useCallback(async () => {
    if (syncing) return
    try {
      setSyncing(true)
      const syncUrl = trainerToken
        ? `/api/reservations/sync?token=${trainerToken}`
        : `/api/reservations/sync`
      const response = await fetch(syncUrl, { method: 'POST', cache: 'no-store' })
      if (!response.ok) {
        console.error('Calendar sync error:', response.status)
        return
      }
      const result = await response.json()
      if (result?.deleted > 0) {
        console.log(`Sync: ${result.deleted} reservations removed`)
      }
      await fetchCalendarData(true)
    } catch (error) {
      console.error('Calendar sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }, [fetchCalendarData, syncing, trainerToken])

  // Helper functions (memoized)
  const formatMonth = useCallback((date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      timeZone: 'Asia/Tokyo'
    })
  }, [])

  const getDaysInMonth = useCallback((date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }, [])

  const getFirstDayOfMonth = useCallback((date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    // 月曜日始まりに調整: 日曜日(0)を6に、月曜日(1)を0に
    return (day + 6) % 7
  }, [])

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()

    for (const event of events) {
      const current = grouped.get(event.date) || []
      current.push(event)
      grouped.set(event.date, current)
    }

    return grouped
  }, [events])

  const getEventsForDate = useCallback((dateStr: string) => {
    const dayEvents = eventsByDate.get(dateStr) || []
    // Deduplicate training events: show only one per time slot
    const seen = new Set<string>()
    return dayEvents.filter(event => {
      if (event.type === 'training') {
        const key = `training-${event.time}`
        if (seen.has(key)) return false
        seen.add(key)
      }
      return true
    })
  }, [eventsByDate])

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }, [])

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr)
    setViewMode('timeline')
    if (onViewModeChange) {
      onViewModeChange('timeline')
    }
  }, [onViewModeChange])

  const handleBackToMonth = useCallback(() => {
    setViewMode('month')
    setSelectedDate('')
    if (onViewModeChange) {
      onViewModeChange('month')
    }
    if (onBackToMonth) {
      onBackToMonth()
    }
  }, [onViewModeChange, onBackToMonth])

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-[85px] bg-surface-base border border-border-subtle"></div>
      )
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayEvents = getEventsForDate(dateStr)
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const isToday = dateStr === todayStr

      days.push(
        <div
          key={day}
          className="h-[85px] p-1 overflow-hidden cursor-pointer flex flex-col bg-surface-raised hover:bg-surface-base border border-border-subtle"
          onClick={() => handleDateClick(dateStr)}
        >
          <div className="text-sm font-normal mb-1 flex-shrink-0 flex justify-start">
            {isToday ? (
              <div className="w-6 h-6 bg-brand-500 text-white rounded-full flex items-center justify-center text-xs font-normal">
                {day}
              </div>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center text-text-primary font-normal">
                {day}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {dayEvents.slice(0, 4).map(event => {
              // Determine color based on reservation type
              // Check trial BEFORE other types to ensure trial reservations are blue
              const isTrial = event.title.includes('体験')
              const isGuest = event.type === 'guest'
              const isTraining = event.type === 'training'
              const colorClass = isTrial
                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'    // Trial = Blue (highest priority)
                : isGuest
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-500/40'   // Guest = Purple(明るめ)
                  : isTraining
                    ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' // Training = Orange
                    : event.type === 'reservation'
                      ? 'bg-brand-700 text-white border border-brand-800'  // Regular = Brand orange(AA準拠の700), white text
                      : 'bg-surface-overlay text-text-secondary border border-border-strong'  // Blocked = Neutral(視認性を上げた濃さ)

              return (
                <div
                  key={event.id}
                  className={`h-[14px] text-[10px] px-0.5 flex items-center rounded truncate leading-none mb-0.5 font-normal ${colorClass}`}
                  title={`${event.title} (${event.time})`}
                >
                  {formatReservationTitle(event.title, event.plan)}
                </div>
              )
            })}
            {dayEvents.length > 4 && (
              <div className="text-[8px] text-text-secondary px-0.5">
                +{dayEvents.length - 4}
              </div>
            )}
          </div>
        </div>
      )
    }

    return days
  }

  // Show timeline view if selected
  if (viewMode === 'timeline' && selectedDate) {
    return (
      <TimelineView
        selectedDate={selectedDate}
        events={events}
        shifts={shifts}
        templates={templates}
        trainers={trainers}
        onBack={handleBackToMonth}
        trainerToken={trainerToken}
        onDateChange={(newDate) => {
          const nextDate = new Date(`${newDate}T00:00:00`)
          if (
            nextDate.getFullYear() !== currentDate.getFullYear() ||
            nextDate.getMonth() !== currentDate.getMonth()
          ) {
            setCurrentDate(nextDate)
          }
          setSelectedDate(newDate)
        }}
        onEventsUpdate={fetchCalendarData}
      />
    )
  }

  return (
    <div className="w-full">
      {/* White container: Month title -> Calendar grid -> Legend */}
      <div className="bg-surface-raised p-0">
        {/* Month Navigation */}
        <div className="py-2 px-4">
          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-3 text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded-md"
              aria-label="前の月"
            >
              <Icon name="chevronLeft" size={24} />
            </button>
            <div className="flex items-center justify-center gap-2 min-w-0">
              <h3 className="text-xl sm:text-lg font-normal text-text-primary min-w-[160px] text-center">
                {formatMonth(currentDate)}
              </h3>
              <button
                onClick={handleCalendarSync}
                disabled={syncing}
                className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary disabled:opacity-50"
                aria-label="Googleカレンダーと同期"
                title="Googleカレンダーと同期"
              >
                <Icon name="refresh" size={18} className={syncing ? 'animate-spin' : ''} />
              </button>
            </div>
            <button
              onClick={() => navigateMonth('next')}
              className="p-3 text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded-md"
              aria-label="次の月"
            >
              <Icon name="chevronRight" size={24} />
            </button>
          </div>
        </div>
        {/* Calendar Body */}
        <div className="px-0 pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
              <span className="ml-2 text-text-secondary">読み込み中...</span>
            </div>
          ) : (
            <div className="">
              {/* Days of week header (no divider line) */}
              <div className="grid grid-cols-7 mb-1">
                {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
                  <div key={day} className={`p-2 text-center text-sm font-normal ${index === 5 ? 'text-brand-300' : index === 6 ? 'text-brand-600' : 'text-text-secondary'
                    }`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0">
                {renderCalendarDays()}
              </div>
            </div>
          )}
        </div>

        {/* Legend inside white container */}
        <div className="px-4 py-1">
          <div className="flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-brand-700 border border-brand-800 rounded"></div>
              <span className="text-text-secondary">予約</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-surface-overlay border border-border-strong rounded"></div>
              <span className="text-text-secondary">予約不可時間</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500/25 border border-purple-500/40 rounded"></div>
              <span className="text-text-secondary">ゲスト</span>
            </div>
          </div>
        </div>

      </div>

      {/* Button to navigate to reservation list - Placed below the card on the Y-axis */}
      <div className="mt-6 pb-8 flex justify-center">
        <Link
          href={trainerToken ? `/admin/reservations?trainerToken=${trainerToken}` : '/admin/reservations'}
          className="inline-flex items-center px-8 py-3 bg-brand-500/15 text-brand-300 text-[11px] font-normal rounded-2xl hover:bg-brand-500/25 transition-colors uppercase tracking-widest border border-brand-500/20"
        >
          予約一覧を見る
        </Link>
      </div>
    </div>
  )
}
