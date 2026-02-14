'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import TimelineView from './TimelineView'
import { useSession } from 'next-auth/react'
import { useStoreChange } from '@/hooks/useStoreChange'

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

export default function CalendarView({ onViewModeChange, onBackToMonth, trainerToken }: CalendarViewProps = {}) {
  const { data: session } = useSession()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const { count: storeChangeCount } = useStoreChange()

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

  // Get calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        setLoading(true)

        // Run Google Calendar sync in background (detect events deleted from app)
        const syncUrl = trainerToken
          ? `/api/reservations/sync?token=${trainerToken}`
          : `/api/reservations/sync`
        fetch(syncUrl, { method: 'POST', cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .then(result => {
            if (result?.deleted > 0) {
              console.log(`🔄 Sync: ${result.deleted} reservations removed (deleted from Google Calendar)`)
              // Re-fetch reservations after sync
              fetchCalendarData()
            }
          })
          .catch(() => {}) // Ignore sync errors silently

        const timestamp = new Date().getTime()
        const reservationsUrl = trainerToken 
          ? `/api/reservations?token=${trainerToken}&_t=${timestamp}`
          : `/api/reservations?_t=${timestamp}`
          
        const shiftsUrl = trainerToken
          ? `/api/shifts?token=${trainerToken}&_t=${timestamp}`
          : `/api/shifts?_t=${timestamp}`

        const [resResponse, shiftsResponse] = await Promise.all([
          fetch(reservationsUrl, { cache: 'no-store' }),
          fetch(shiftsUrl, { cache: 'no-store' })
        ])

        setDebugInfo(`API Status: Res=${resResponse.status}, Shifts=${shiftsResponse.status}`)

        if (resResponse.ok) {
          const result = await resResponse.json()
          const data = result.data || result
          const reservations: Reservation[] = data.reservations || []
          setDebugInfo(prev => `${prev}, ResCount=${reservations.length}`)

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
        } else {
          const errorText = await resResponse.text()
          console.error('Calendar API error:', resResponse.status, errorText)
        }

        if (shiftsResponse.ok) {
          const result = await shiftsResponse.json()
          const data = result.data || result
          const fetchedShifts: Shift[] = data.shifts || []
          const fetchedTemplates: ShiftTemplate[] = data.templates || []
          const fetchedTrainers: Trainer[] = data.trainers || []
          setShifts(fetchedShifts)
          setTemplates(fetchedTemplates)
          setTrainers(fetchedTrainers)
          setDebugInfo(prev => `${prev}, ShiftsCount=${fetchedShifts.length}, TemplatesCount=${fetchedTemplates.length}`)
        } else {
          console.error('Shifts API error:', shiftsResponse.status)
        }

      } catch (error) {
        console.error('Failed to fetch calendar data:', error)
        setDebugInfo(`Fetch Error: ${error}`)
      } finally {
        setLoading(false)
      }
    }

    fetchCalendarData()
  }, [session, storeChangeCount, trainerToken])

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

  const getEventsForDate = useCallback((dateStr: string) => {
    const dayEvents = events.filter(event => event.date === dateStr)
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
  }, [events])

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
        <div key={`empty-${i}`} className="h-[115px] bg-gray-50 border border-gray-100"></div>
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
          className="h-[115px] p-1 overflow-hidden cursor-pointer flex flex-col bg-white hover:bg-gray-50 border border-gray-100"
          onClick={() => handleDateClick(dateStr)}
        >
          <div className="text-sm font-medium mb-1 flex-shrink-0 flex justify-start">
            {isToday ? (
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {day}
              </div>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center text-gray-900">
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
                ? 'bg-blue-100 text-blue-800 border border-blue-200'    // Trial = Blue (highest priority)
                : isGuest
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'   // Guest = Purple
                  : isTraining
                    ? 'bg-orange-100 text-orange-800 border border-orange-200' // Training = Orange
                    : event.type === 'reservation'
                      ? 'bg-green-100 text-green-800 border border-green-200'  // Regular = Green
                      : 'bg-red-100 text-red-800 border border-red-200'        // Blocked = Red

              return (
                <div
                  key={event.id}
                  className={`h-[14px] text-[10px] px-0.5 flex items-center rounded truncate leading-none mb-0.5 font-medium ${colorClass}`}
                  title={`${event.title} (${event.time})`}
                >
                  {formatReservationTitle(event.title, event.plan)}
                </div>
              )
            })}
            {dayEvents.length > 4 && (
              <div className="text-[8px] text-gray-500 px-0.5">
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
          setSelectedDate(newDate)
        }}
        onEventsUpdate={() => {
          // Refresh events when new reservation is created
          const fetchCalendarData = async () => {
            try {
              const response = await fetch('/api/reservations')
              if (response.ok) {
                const result = await response.json()
                const data = result.data || result
                const reservations = data.reservations || []

                const calendarEvents = reservations.map((reservation: any) => {
                  const startDate = new Date(reservation.startTime)
                  const endDate = new Date(reservation.endTime)

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

                  const dateInJST = startDate.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    timeZone: 'Asia/Tokyo'
                  }).split('/').map(part => part.padStart(2, '0')).join('-')

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
              }
            } catch (error) {
              console.error('Failed to refresh events:', error)
            }
          }
          fetchCalendarData()
        }}
      />
    )
  }

  return (
    <div className="w-full">
      {/* White container: Month title -> Calendar grid -> Legend */}
      <div className="bg-white p-0">
        {/* Month Navigation */}
        <div className="p-4">
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-xl sm:text-lg font-medium text-gray-900 min-w-[160px] text-center">
              {formatMonth(currentDate)}
            </h3>
            <button
              onClick={() => navigateMonth('next')}
              className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        {/* Calendar Body */}
        <div className="px-0 pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-gray-600">読み込み中...</span>
            </div>
          ) : (
            <div className="">
              {/* Days of week header (no divider line) */}
              <div className="grid grid-cols-7 mb-1">
                {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
                  <div key={day} className={`p-2 text-center text-sm font-medium ${index === 5 ? 'text-blue-500' : index === 6 ? 'text-red-500' : 'text-gray-700'
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
        <div className="px-4 py-3">
          <div className="flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
              <span className="text-gray-600">予約</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
              <span className="text-gray-600">予約不可時間</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
              <span className="text-gray-600">ゲスト</span>
            </div>
          </div>
        </div>
      </div>
      {/* Button to navigate to reservation list */}
      <div className="mt-4 flex justify-center">
        <Link
          href={trainerToken ? `/admin/reservations?trainerToken=${trainerToken}` : '/admin/reservations'}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 transition-colors"
        >
          予約一覧を見る
        </Link>
      </div>
    </div>
  )
}
