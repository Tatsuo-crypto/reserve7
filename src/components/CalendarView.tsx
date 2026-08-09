'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import TimelineView from './TimelineView'
import { useStoreChange } from '@/hooks/useStoreChange'
import Icon from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import { reservationChipClass, RESERVATION_LEGEND_ORDER, RESERVATION_LEGEND_CLASSES, RESERVATION_LEGEND_LABELS } from '@/lib/reservation-colors'

/**
 * BF-2: 1マスに何枚のチップが入るかの計算。
 *
 * BF-1では「(行の高さ − 日付欄) ÷ 15px」というざっくり計算にしていたため、
 * セルの上下パディング4pxを勘定に入れておらず、4枚目が2pxほどはみ出して
 * 下が切れていた。マス目の実寸をそのまま式にする。
 *
 *   セルの中身 = 上下パディング + 日付欄 + (チップ × n) + (隙間 × (n−1))
 *
 * また「4枚目まではどの端末でも必ず入る」ことをオーナー指定の要件とし、
 * MIN_ROW_HEIGHT を4枚ぶんちょうどの高さにする(画面が低い端末でも4枚は死守)。
 */
const CELL_PADDING_Y = 4   // p-[2px] の上下
const DAY_NUMBER_H = 18    // 日付の数字 h-4(16px) + mb-0.5(2px)
const CHIP_H = 13          // h-[13px]
const CHIP_GAP = 1         // space-y-[1px]
const MIN_VISIBLE_CHIPS = 4

const rowHeightForChips = (chips: number) =>
  CELL_PADDING_Y + DAY_NUMBER_H + chips * CHIP_H + (chips - 1) * CHIP_GAP

const MIN_ROW_HEIGHT = rowHeightForChips(MIN_VISIBLE_CHIPS)

const chipCapacity = (rowHeight: number) =>
  Math.max(
    MIN_VISIBLE_CHIPS,
    Math.floor((rowHeight - CELL_PADDING_Y - DAY_NUMBER_H + CHIP_GAP) / (CHIP_H + CHIP_GAP))
  )

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
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const { count: storeChangeCount, currentStoreId } = useStoreChange()
  // BF-1: Googleカレンダーと同じく、月グリッドを画面の高さいっぱいに広げる。
  // 行の高さが可変になるので「1日に何件のチップが入るか」も可変になる。
  // 親ページの構造が3種類(dashboard / admin/calendar / trainer)あり、どれも
  // 高さが固定されたflexチェーンになっていないため、グリッド自身の位置を実測して
  // 「ビューポート下端まで」を計算する方式にしている。
  const gridRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const [gridHeight, setGridHeight] = useState<number | null>(null)
  const [maxChipsPerDay, setMaxChipsPerDay] = useState(4)

  const lastFetchRef = useRef<{ key: string, at: number } | null>(null)
  const lastAvailabilityFetchRef = useRef<string | null>(null)

  // Note: タイトルの採番はサーバ側で行うため、フロントでは変更しない

  // 苗字のみを抽出（スペース区切りの最初の部分）
  const extractLastName = useCallback((fullName: string) => {
    if (!fullName) return ''
    // 半角スペースまたは全角スペースで分割
    const nameParts = fullName.split(/\s|　/)
    return nameParts[0] || fullName
  }, [])

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

  const buildCalendarParams = useCallback((scope: 'reservations' | 'availability' | 'all') => {
    const range = getCalendarMonthRange(currentDate)
    const params = new URLSearchParams({
      start: range.start,
      end: range.end,
      scope,
    })
    if (trainerToken) {
      params.append('token', trainerToken)
    }
    return params
  }, [currentDate, trainerToken])

  const applyReservations = useCallback((reservations: Reservation[]) => {
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
  }, [extractLastName])

  const fetchReservationsData = useCallback(async (force = false) => {
    try {
      setLoading(true)

      const params = buildCalendarParams('reservations')
      const queryString = params.toString()
      const cacheKey = `${queryString}:store=${currentStoreId || 'default'}:storeChange=${storeChangeCount}`
      const data = await fetchCalendarPayload(`/api/calendar?${queryString}`, cacheKey, force)
      applyReservations(data.reservations)

    } catch (error) {
      console.error('Failed to fetch calendar reservations:', error)
      setDebugInfo(`Fetch Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [applyReservations, buildCalendarParams, currentStoreId, storeChangeCount])

  const fetchAvailabilityData = useCallback(async (force = false) => {
    try {
      setAvailabilityLoading(true)

      const params = buildCalendarParams('availability')
      const queryString = params.toString()
      const cacheKey = `${queryString}:store=${currentStoreId || 'default'}:storeChange=${storeChangeCount}`
      const data = await fetchCalendarPayload(`/api/calendar?${queryString}`, cacheKey, force)
      setShifts(data.shifts)
      setTemplates(data.templates)
      setTrainers(data.trainers)
      setDebugInfo(prev => `${prev}, ShiftsCount=${data.shifts.length}, TemplatesCount=${data.templates.length}`)

    } catch (error) {
      console.error('Failed to fetch calendar availability:', error)
      lastAvailabilityFetchRef.current = null
      setDebugInfo(`Fetch Error: ${error}`)
    } finally {
      setAvailabilityLoading(false)
    }
  }, [buildCalendarParams, currentStoreId, storeChangeCount])

  const fetchCalendarData = useCallback(async (force = false) => {
    await Promise.all([
      fetchReservationsData(force),
      fetchAvailabilityData(force),
    ])
  }, [fetchAvailabilityData, fetchReservationsData])

  // Get calendar data
  useEffect(() => {
    const range = getCalendarMonthRange(currentDate)
    const fetchKey = `${trainerToken || 'admin'}:${currentStoreId || 'default'}:${storeChangeCount}:${range.key}`
    const lastFetch = lastFetchRef.current
    if (lastFetch?.key === fetchKey && Date.now() - lastFetch.at < 2000) {
      return
    }
    lastFetchRef.current = { key: fetchKey, at: Date.now() }

    fetchReservationsData()
  }, [currentDate, currentStoreId, fetchReservationsData, storeChangeCount, trainerToken])

  useEffect(() => {
    if (viewMode === 'timeline' && selectedDate && !availabilityLoading) {
      const range = getCalendarMonthRange(currentDate)
      const fetchKey = `${trainerToken || 'admin'}:${currentStoreId || 'default'}:${storeChangeCount}:${range.key}`
      if (lastAvailabilityFetchRef.current === fetchKey) return
      lastAvailabilityFetchRef.current = fetchKey
      void fetchAvailabilityData()
    }
  }, [availabilityLoading, currentDate, currentStoreId, fetchAvailabilityData, selectedDate, storeChangeCount, trainerToken, viewMode])

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

  // BF-1: 月グリッドの行数(月によって5行/6行が変わる)。高さ計算と行定義の両方で使う。
  const gridRowCount = useMemo(() => {
    return Math.ceil((getFirstDayOfMonth(currentDate) + getDaysInMonth(currentDate)) / 7)
  }, [currentDate, getFirstDayOfMonth, getDaysInMonth])

  /**
   * BF-1: グリッドの高さと、1マスに入るチップ数を実測して決める。
   *
   * 「ビューポートの高さ - グリッド上端の位置 - 凡例の高さ - 下部ナビの高さ」が使える高さ。
   * 下部ナビは fixed のためレイアウト上の高さを持たず、放っておくと凡例がナビの裏に隠れる
   * (オーナー指摘: 凡例が予約ボタンに被る)。data-bottom-nav を実測して必ず避ける。
   */
  useEffect(() => {
    const NAV_FAB_OVERHANG = 18 // 中央の丸ボタンがナビ上端から飛び出す分(-translate-y-4)
    const BREATHING = 6

    const measure = () => {
      const grid = gridRef.current
      if (!grid) return

      const gridTop = grid.getBoundingClientRect().top
      const nav = document.querySelector('[data-bottom-nav]')
      const navH = nav ? nav.getBoundingClientRect().height + NAV_FAB_OVERHANG : 0
      const legendH = legendRef.current?.getBoundingClientRect().height ?? 0

      const available = window.innerHeight - gridTop - legendH - navH - BREATHING
      const height = Math.max(gridRowCount * MIN_ROW_HEIGHT, available)

      setGridHeight(height)
      setMaxChipsPerDay(chipCapacity(height / gridRowCount))
    }

    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [gridRowCount, viewMode, loading])

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

    // BF-1: 枠線は各セルの右・下だけに引く。全辺に引くと隣同士で線が重なって
    // 2pxの太い罫線になり、Googleカレンダーのような細い方眼にならない。
    // グリッド側で上端・左端の線を引いて閉じる。
    const cellBorder = 'border-r border-b border-border-subtle'

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className={`bg-surface-base ${cellBorder}`}></div>
      )
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayEvents = getEventsForDate(dateStr)
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const isToday = dateStr === todayStr
      // BF-1: 入る枚数は行の高さ次第で変わる。溢れる場合は最後の1枠を「+N」に使う。
      const overflowing = dayEvents.length > maxChipsPerDay
      const visibleEvents = overflowing ? dayEvents.slice(0, maxChipsPerDay - 1) : dayEvents
      const hiddenEventCount = overflowing ? dayEvents.length - (maxChipsPerDay - 1) : 0

      days.push(
        <div
          key={day}
          className={`min-h-0 p-[2px] overflow-hidden cursor-pointer flex flex-col bg-surface-raised hover:bg-surface-base ${cellBorder}`}
          onClick={() => handleDateClick(dateStr)}
        >
          <div className="h-4 text-cell font-normal mb-0.5 flex-shrink-0 flex justify-start">
            {isToday ? (
              <div className="w-4 h-4 bg-brand-500 text-white rounded-full flex items-center justify-center text-cell font-normal">
                {day}
              </div>
            ) : (
              <div className="w-4 h-4 flex items-center justify-center text-text-primary font-normal">
                {day}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden space-y-[1px]">
            {visibleEvents.map(event => {
              // BD-1: 配色は src/lib/reservation-colors.ts に集約(タイムラインと凡例で共通)
              const colorClass = reservationChipClass(event)

              return (
                <div
                  key={event.id}
                  className={`h-[13px] min-w-0 text-cell px-[3px] flex items-center rounded-[3px] truncate font-normal ${colorClass}`}
                  title={`${event.title} (${event.time})`}
                >
                  {formatReservationTitle(event.title, event.plan)}
                </div>
              )
            })}
            {hiddenEventCount > 0 && (
              <div className="h-[13px] min-w-0 text-cell px-[3px] flex items-center rounded-[3px] text-text-secondary font-normal">
                +{hiddenEventCount}
              </div>
            )}
          </div>
        </div>
      )
    }

    // BF-1: 最終行の余りを空セルで埋めて、グリッドを常に長方形にする。
    // 埋めないと最終週だけ罫線が途切れて方眼が崩れる(8/31の行が該当していた)。
    const trailing = (7 - ((firstDay + daysInMonth) % 7)) % 7
    for (let i = 0; i < trailing; i++) {
      days.push(
        <div key={`trailing-${i}`} className={`bg-surface-base ${cellBorder}`}></div>
      )
    }

    return days
  }

  // Show timeline view if selected
  if (viewMode === 'timeline' && selectedDate) {
    if (availabilityLoading && trainers.length === 0) {
      return (
        <div className="flex h-[520px] items-center justify-center bg-surface-raised">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
        </div>
      )
    }

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
    // BF-1: Googleカレンダーと同じく画面いっぱいに広げるため、カード(角丸・枠線・影)を外し、
    // 親ページの左右パディング(dashboardは px-2)を打ち消して端まで届かせる。
    // 幅は指定しない。ブロック要素の自動幅 + 負のマージンで、親のパディングぶん外へ広げる
    // (w-full を併用すると左だけはみ出して右が揃わなくなる)。
    <div className="-mx-2 sm:mx-0">
      <div className="bg-surface-raised">
        {/* Month Navigation */}
        <div className="py-1 px-2">
          <div className="relative flex h-11 items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="absolute left-1 p-2 text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded-lg"
              aria-label="前の月"
            >
              <Icon name="chevronLeft" size={24} />
            </Button>
            <h3 className="text-xl font-normal text-text-primary text-center">
              {formatMonth(currentDate)}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCalendarSync}
              disabled={syncing}
              className="absolute right-12 h-10 w-10 p-0 rounded-full text-text-secondary bg-surface-overlay hover:bg-surface-base hover:text-brand-500 border border-border-subtle disabled:opacity-50"
              aria-label="Googleカレンダーと同期"
              title="Googleカレンダーと同期"
            >
              <Icon name="refresh" size={22} className={syncing ? 'animate-spin' : ''} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="absolute right-1 p-2 text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded-lg"
              aria-label="次の月"
            >
              <Icon name="chevronRight" size={24} />
            </Button>
          </div>
        </div>
        {/* Calendar Body */}
        <div className="px-0 pb-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
              <span className="ml-2 text-text-secondary">読み込み中...</span>
            </div>
          ) : (
            <div className="">
              {/* Days of week header (no divider line) */}
              <div className="grid grid-cols-7">
                {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
                  <div key={day} className={`py-1 text-center text-xs font-normal ${index === 5 ? 'text-brand-500' : index === 6 ? 'text-brand-500' : 'text-text-secondary'
                    }`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid: 高さは実測(BF-1)。上端・左端の罫線はここで引く。 */}
              <div
                ref={gridRef}
                className="grid grid-cols-7 gap-0 border-t border-l border-border-subtle"
                style={{
                  // minHeightは実測前の初回描画用。これが無いと行が中身の高さまで潰れ、
                  // 計測後に一瞬で伸びるちらつきになる。
                  minHeight: gridRowCount * MIN_ROW_HEIGHT,
                  height: gridHeight ?? undefined,
                  gridTemplateRows: `repeat(${gridRowCount}, minmax(0, 1fr))`,
                }}
              >
                {renderCalendarDays()}
              </div>
            </div>
          )}
        </div>

        {/* Legend: 高さを実測してグリッドの取り分から差し引く(BF-1)。下部ナビの裏に隠れない。 */}
        <div ref={legendRef} className="px-3 py-1.5">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
            {RESERVATION_LEGEND_ORDER.map(key => (
              <div key={key} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <div className={`h-2.5 w-2.5 shrink-0 rounded-lg ${RESERVATION_LEGEND_CLASSES[key]}`}></div>
                <span className="text-text-secondary">{RESERVATION_LEGEND_LABELS[key]}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
