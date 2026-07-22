'use client'

import { useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/icons'
import Button from '@/components/ui/Button'

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

interface Trainer {
  id: string
  name: string
  email: string
}

const HOUR_HEIGHT = 48
const TIMELINE_START_HOUR = 8
const TIME_SLOTS = Array.from({ length: 16 }, (_, index) =>
  `${String(index + TIMELINE_START_HOUR).padStart(2, '0')}:00`
)

function formatJstDate(value: string) {
  return new Date(value).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo'
  }).split('/').map(part => part.padStart(2, '0')).join('-')
}

function parseClockMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

interface TimelineViewProps {
  selectedDate: string
  events: CalendarEvent[]
  shifts?: Shift[]
  templates?: ShiftTemplate[]
  trainers?: Trainer[]
  onBack: () => void
  onEventsUpdate: () => void
  onDateChange?: (date: string) => void
  trainerToken?: string | null
}

export default function TimelineView({ selectedDate, events, shifts = [], templates = [], trainers = [], onBack, onEventsUpdate, onDateChange, trainerToken }: TimelineViewProps) {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)
  const router = useRouter()
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState<{ id: string; type?: 'reservation' | 'blocked' | 'guest' | 'training' } | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    notes: '',
    trainerId: ''
  })
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)

  const timeSlots = TIME_SLOTS

  // Filter events for selected date
  const dayEvents = useMemo(() => events.filter(event => event.date === selectedDate), [events, selectedDate])
  // Parse event time and calculate position
  const parseEventTime = (timeStr: string) => {
    const [startTime, endTime] = timeStr.split(' - ')
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    return { startMinutes, endMinutes, startTime, endTime }
  }

  const selectedDayOfWeek = useMemo(() => {
    return new Date(`${selectedDate}T00:00:00+09:00`).getDay()
  }, [selectedDate])

  const shiftsByTrainer = useMemo(() => {
    const grouped = new Map<string, { id: string; start: Date; end: Date; startMinutes: number; endMinutes: number }[]>()

    for (const shift of shifts) {
      if (formatJstDate(shift.startTime) !== selectedDate) continue

      const start = new Date(shift.startTime)
      const end = new Date(shift.endTime)
      const item = {
        id: shift.id,
        start,
        end,
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        endMinutes: end.getHours() * 60 + end.getMinutes(),
      }
      const current = grouped.get(shift.trainerId) || []
      current.push(item)
      grouped.set(shift.trainerId, current)
    }

    return grouped
  }, [selectedDate, shifts])

  const templatesByTrainer = useMemo(() => {
    const grouped = new Map<string, { id: string; start: Date; end: Date; startMinutes: number; endMinutes: number }[]>()

    for (const template of templates) {
      if (template.dayOfWeek !== selectedDayOfWeek) continue

      const start = new Date(`${selectedDate}T${template.startTime}+09:00`)
      const end = new Date(`${selectedDate}T${template.endTime}+09:00`)
      const item = {
        id: template.id,
        start,
        end,
        startMinutes: parseClockMinutes(template.startTime),
        endMinutes: parseClockMinutes(template.endTime),
      }
      const current = grouped.get(template.trainerId) || []
      current.push(item)
      grouped.set(template.trainerId, current)
    }

    return grouped
  }, [selectedDate, selectedDayOfWeek, templates])

  const availabilityByTrainer = useMemo(() => {
    const grouped = new Map<string, { start: Date, end: Date, type: 'shift' | 'template' }[]>()

    for (const trainer of trainers) {
      const trainerShifts = shiftsByTrainer.get(trainer.id) || []
      const items: { start: Date, end: Date, type: 'shift' | 'template' }[] = trainerShifts.map(shift => ({
        start: shift.start,
        end: shift.end,
        type: 'shift'
      }))

      const trainerTemplates = templatesByTrainer.get(trainer.id) || []
      for (const template of trainerTemplates) {
        const hasOverlap = trainerShifts.some(shift => template.start < shift.end && template.end > shift.start)
        if (!hasOverlap) {
          items.push({ start: template.start, end: template.end, type: 'template' })
        }
      }

      grouped.set(trainer.id, items)
    }

    return grouped
  }, [shiftsByTrainer, templatesByTrainer, trainers])

  const eventsByTrainer = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    const firstTrainer = trainers[0]

    const trainerIsAvailable = (trainerId: string, startMinutes: number, endMinutes: number) => {
      const trainerShifts = shiftsByTrainer.get(trainerId) || []
      if (trainerShifts.some(shift => startMinutes < shift.endMinutes && endMinutes > shift.startMinutes)) {
        return true
      }

      const trainerTemplates = templatesByTrainer.get(trainerId) || []
      return trainerTemplates.some(template => startMinutes < template.endMinutes && endMinutes > template.startMinutes)
    }

    for (const event of dayEvents) {
      let targetTrainerId = event.trainerId || ''

      if (!targetTrainerId) {
        if (trainers.length === 1) {
          targetTrainerId = trainers[0].id
        } else {
          const { startMinutes, endMinutes } = parseEventTime(event.time)
          targetTrainerId = trainers.find(trainer => trainerIsAvailable(trainer.id, startMinutes, endMinutes))?.id || firstTrainer?.id || ''
        }
      }

      if (!targetTrainerId) continue
      const current = grouped.get(targetTrainerId) || []
      current.push(event)
      grouped.set(targetTrainerId, current)
    }

    return grouped
  }, [dayEvents, shiftsByTrainer, templatesByTrainer, trainers])

  const eventLayoutByTrainer = useMemo(() => {
    const layouts = new Map<string, Map<string, { column: number, totalColumns: number }>>()

    for (const trainer of trainers) {
      const trainerEvents = eventsByTrainer.get(trainer.id) || []
      const sortedEvents = [...trainerEvents].sort((a, b) => {
        const aStart = parseEventTime(a.time).startMinutes
        const bStart = parseEventTime(b.time).startMinutes
        return aStart - bStart
      })

      const eventColumns = new Map<string, { column: number, totalColumns: number }>()

      sortedEvents.forEach((event) => {
        const { startMinutes, endMinutes } = parseEventTime(event.time)
        const usedColumns = new Set<number>()
        let maxOverlapColumns = 0

        sortedEvents.forEach((otherEvent) => {
          if (otherEvent.id === event.id) return
          const { startMinutes: otherStart, endMinutes: otherEnd } = parseEventTime(otherEvent.time)
          if (startMinutes < otherEnd && endMinutes > otherStart) {
            const otherColumn = eventColumns.get(otherEvent.id)
            if (otherColumn) {
              usedColumns.add(otherColumn.column)
              maxOverlapColumns = Math.max(maxOverlapColumns, otherColumn.totalColumns)
            }
          }
        })

        let column = 0
        while (usedColumns.has(column)) column++
        eventColumns.set(event.id, { column, totalColumns: Math.max(maxOverlapColumns, column + 1) })
      })

      sortedEvents.forEach((event) => {
        const { startMinutes, endMinutes } = parseEventTime(event.time)
        let maxColumns = eventColumns.get(event.id)?.totalColumns || 1

        sortedEvents.forEach((otherEvent) => {
          if (otherEvent.id === event.id) return
          const { startMinutes: otherStart, endMinutes: otherEnd } = parseEventTime(otherEvent.time)
          if (startMinutes < otherEnd && endMinutes > otherStart) {
            const otherInfo = eventColumns.get(otherEvent.id)
            if (otherInfo) maxColumns = Math.max(maxColumns, otherInfo.totalColumns)
          }
        })

        const current = eventColumns.get(event.id)
        if (current) eventColumns.set(event.id, { ...current, totalColumns: maxColumns })
      })

      layouts.set(trainer.id, eventColumns)
    }

    return layouts
  }, [eventsByTrainer, trainers])

  // Calculate position in timeline (pixel-based) - 8時スタート対応
  const getEventPosition = (startMinutes: number, endMinutes: number) => {
    const startHour = startMinutes / 60 - TIMELINE_START_HOUR
    const durationHours = (endMinutes - startMinutes) / 60

    const top = startHour * HOUR_HEIGHT
    const height = durationHours * HOUR_HEIGHT

    return { top, height }
  }

  const [isNavigating, setIsNavigating] = useState(false)
  const isScrollingRef = useRef(false)
  const touchStartYRef = useRef<number | null>(null)

  // Format selected date
  const formatSelectedDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    const dayOfWeek = dayNames[date.getDay()]
    return `${year}年${month}月${day}日(${dayOfWeek})`
  }

  // Handle timeline click to create reservation - 8時スタート対応
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>, trainerId?: string) => {
    // If clicking on a specific event, don't trigger creation
    if ((e.target as HTMLElement).closest('.event-item')) return
    if (isNavigating) return

    // iOS Safari scroll vs tap heuristic: abort click if a scroll was detected
    if (isScrollingRef.current) {
      // It was a scroll, abort tap
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const hourHeight = 48
    const clickedHour = Math.floor(clickY / hourHeight) + 8 // 8時スタートなので8を足す

    if (clickedHour >= 8 && clickedHour <= 23) {
      const startTime = `${String(clickedHour).padStart(2, '0')}:00`
      const endHour = clickedHour + 1
      const endTime = `${String(endHour).padStart(2, '0')}:00`

      setSelectedTimeSlot(`${startTime} - ${endTime}`)
      if (trainerId) setSelectedTrainerId(trainerId)

      // Navigate to New Reservation page with prefilled startTime
      const startDateTime = `${selectedDate}T${startTime}`
      let url = `/admin/reservations/new?startTime=${encodeURIComponent(startDateTime)}`
      if (trainerToken) url += `&trainerToken=${trainerToken}`
      if (trainerId) url += `&trainerId=${trainerId}`

      setIsNavigating(true)
      window.location.href = url
    }
  }

  // 日付変更関数
  const changeDate = (days: number) => {
    try {
      const date = new Date(selectedDate + 'T00:00:00')
      date.setDate(date.getDate() + days)

      // タイムゾーン問題を回避するため、ローカル時間で日付をフォーマット
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const newDate = `${year}-${month}-${day}`

      if (onDateChange) {
        onDateChange(newDate)
      }
    } catch (error) {
      console.error('Date change error:', error)
    }
  }

  const handleModalSuccess = () => {
    onEventsUpdate() // Refresh events
  }

  // Open edit modal from an event click
  const openEditFromEvent = (e: React.MouseEvent<HTMLDivElement>, ev: CalendarEvent) => {
    e.stopPropagation()
    // Parse start and end from ev.time "HH:MM - HH:MM"
    const [startStr, endStr] = ev.time.split(' - ')
    const startIso = `${selectedDate}T${startStr}`
    const endIso = `${selectedDate}T${endStr}`
    setEditingReservation({ id: ev.id, type: ev.type })
    setEditFormData({
      title: ev.title || '',
      startTime: startIso,
      endTime: endIso,
      notes: ev.notes || '',
      trainerId: ev.trainerId || ''
    })
    setShowEditModal(true)
  }

  // Start time change handler to preserve duration
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = e.target.value

    if (editFormData.startTime && editFormData.endTime && newStartTime) {
      const currentStart = new Date(editFormData.startTime)
      const currentEnd = new Date(editFormData.endTime)
      const newStart = new Date(newStartTime)

      if (!isNaN(currentStart.getTime()) && !isNaN(currentEnd.getTime()) && !isNaN(newStart.getTime())) {
        const duration = currentEnd.getTime() - currentStart.getTime()
        const newEnd = new Date(newStart.getTime() + duration)

        // Format new end time as YYYY-MM-DDThh:mm
        const year = newEnd.getFullYear()
        const month = String(newEnd.getMonth() + 1).padStart(2, '0')
        const day = String(newEnd.getDate()).padStart(2, '0')
        const hours = String(newEnd.getHours()).padStart(2, '0')
        const minutes = String(newEnd.getMinutes()).padStart(2, '0')
        const newEndTime = `${year}-${month}-${day}T${hours}:${minutes}`

        setEditFormData(prev => ({
          ...prev,
          startTime: newStartTime,
          endTime: newEndTime
        }))
        return
      }
    }

    setEditFormData(prev => ({ ...prev, startTime: newStartTime }))
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReservation) return
    try {
      const url = trainerToken
        ? `/api/reservations/${editingReservation.id}?token=${trainerToken}`
        : `/api/reservations/${editingReservation.id}`

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editFormData.title,
          startTime: new Date(editFormData.startTime).toISOString(),
          endTime: new Date(editFormData.endTime).toISOString(),
          notes: editFormData.notes,
          trainerId: editFormData.trainerId,
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || '予約を更新できませんでした。もう一度お試しください。')
        return
      }
      setShowEditModal(false)
      setEditingReservation(null)
      onEventsUpdate()
    } catch (err) {
      console.error(err)
      alert('予約を更新できませんでした。もう一度お試しください。')
    }
  }

  const handleDeleteReservation = async () => {
    if (!editingReservation) return
    // Show custom confirm modal instead of window.confirm (fixes iOS PWA freeze)
    setShowDeleteConfirmModal(true)
  }

  const executeDeleteReservation = async () => {
    if (!editingReservation) return
    setShowDeleteConfirmModal(false)
    try {
      const url = trainerToken
        ? `/api/reservations/${editingReservation.id}?token=${trainerToken}`
        : `/api/reservations/${editingReservation.id}`

      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || '予約を削除できませんでした。もう一度お試しください。')
        return
      }
      setShowEditModal(false)
      setEditingReservation(null)
      onEventsUpdate()
    } catch (err) {
      console.error(err)
      alert('予約を削除できませんでした。もう一度お試しください。')
    }
  }

  // 苗字のみを抽出
  const extractLastName = (fullName: string) => {
    if (!fullName) return ''
    const nameParts = fullName.split(/\s|　/)
    return nameParts[0] || fullName
  }

  // タイトルから苗字と回数を抽出
  const formatReservationTitle = (title: string, plan?: string) => {
    if (!title) return ''
    if (!title.match(/\d+\/\d+/)) return title
    const match = title.match(/^(.+?)(\d+\/\d+)$/)
    if (match) {
      const fullName = match[1].trim()
      const count = match[2]
      const lastName = extractLastName(fullName)
      if (plan === '都度') return lastName
      return `${lastName}${count}`
    }
    return title
  }

  return (
    <div className="flex h-[calc(100vh-100px)] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface-raised shadow-sm sm:h-[calc(100vh-140px)]">
      {/* 固定ヘッダー: 日付ナビ+トレーナー名は親のスクロールに含めず、常に表示する。
          中身(時間帯グリッド)だけを下のTimeline Bodyで独立スクロールさせる */}
      <div className="shrink-0 rounded-t-lg bg-surface-raised">
        {/* Header */}
        <div className="px-4 py-4">
          <div className="flex flex-col items-center space-y-2">
            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => changeDate(-1)}
                className="p-2 text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded-lg flex-shrink-0"
                title="前の日"
              >
                <Icon name="chevronLeft" size={20} />
              </Button>
              <h2 className="text-xl font-semibold text-text-primary whitespace-nowrap">
                {formatSelectedDate(selectedDate)}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => changeDate(1)}
                className="p-2 text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded-lg flex-shrink-0"
                title="次の日"
              >
                <Icon name="chevronRight" size={20} />
              </Button>
            </div>
          </div>
        </div>

        {/* Trainer Headers */}
        <div className="flex border-b border-border-strong ml-12">
          {trainers.map((trainer) => (
            <div key={trainer.id} className="flex-1 text-center py-2 font-normal text-text-secondary border-l border-border-strong bg-surface-base">
              {trainer.name}
            </div>
          ))}
          {/* Fallback column for unassigned if needed, or just hide?
              User requested specific layout. Let's stick to trainers.
          */}
        </div>
      </div>

      {/* Timeline Body: このブロックだけが独立してスクロールする(親をflex-1 min-h-0にして高さを確定させることで、
          overflow-y-autoが実際にスクロールコンテナとして機能するようにしている) */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex relative min-h-[768px]"> {/* 16 hours * 48px */}
            {/* Time Labels */}
            <div className="w-12 flex-shrink-0 relative bg-surface-raised z-10">
              {timeSlots.map((time, index) => (
                <div
                  key={time}
                  className="absolute right-2 text-xs text-text-secondary transform -translate-y-2"
                  style={{ top: `${index * 48}px` }}
                >
                  {time}
                </div>
              ))}
            </div>

            {/* Trainer Columns */}
            <div className="flex flex-1 relative bg-surface-overlay">
              {trainers.map((trainer, trainerIndex) => (
                <div
                  key={trainer.id}
                  className="flex-1 relative border-l border-border-strong transition-colors"
                  style={{ height: `${timeSlots.length * 48}px` }}
                  onTouchStart={(e) => {
                    touchStartYRef.current = e.touches[0].clientY
                  }}
                  onTouchMove={(e) => {
                    // If we move enough, it's definitely a scroll
                    if (touchStartYRef.current !== null && e.touches.length > 0) {
                      const touchCurrentY = e.touches[0].clientY
                      if (Math.abs(touchCurrentY - touchStartYRef.current) > 5) {
                        isScrollingRef.current = true
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (isScrollingRef.current) {
                      // Reset the scrolling flag after a short delay (after click event fires)
                      setTimeout(() => {
                        isScrollingRef.current = false
                      }, 300)
                    }
                  }}
                  onClick={(e) => {
                    handleTimelineClick(e, trainer.id)
                  }}
                >
                  {/* Availability Blocks (Shifts & Templates): シフトが入っている＝予約可能な時間帯を薄いオレンジで示す。
                      時間の罫線はこのブロック内では描画せず、下のHour Grid Lines(全体に1系統のみ)に一本化する */}
                  {(availabilityByTrainer.get(trainer.id) || []).map((item, idx) => {
                    const startMinutes = item.start.getHours() * 60 + item.start.getMinutes()
                    const endMinutes = item.end.getHours() * 60 + item.end.getMinutes()
                    const top = ((startMinutes - (TIMELINE_START_HOUR * 60)) / 60) * HOUR_HEIGHT
                    const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT

                    return (
                      <div
                        key={`avail-${idx}`}
                        className="absolute w-full rounded-2xl border border-orange-500/25 bg-orange-500/10 z-0 pointer-events-none"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                        }}
                      />
                    )
                  })}

                  {/* Reservations */}
                  {(eventsByTrainer.get(trainer.id) || []).map((event) => {
                      const { startMinutes, endMinutes, startTime: startStr, endTime: endStr } = parseEventTime(event.time)
                      const top = ((startMinutes - (TIMELINE_START_HOUR * 60)) / 60) * HOUR_HEIGHT
                      const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT

                      const layoutInfo = eventLayoutByTrainer.get(trainer.id)?.get(event.id) || { column: 0, totalColumns: 1 }
                      const widthPercent = 100 / layoutInfo.totalColumns
                      const leftPercent = layoutInfo.column * widthPercent

                      const isTrial = event.title.includes('体験')
                      const isGuest = event.type === 'guest' || (event.title && event.title.includes('ゲスト'))
                      const isTraining = event.type === 'training'
                      const colorClass = isTrial
                        ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                        : isGuest
                          ? 'bg-purple-500/25 border border-purple-500/40 text-purple-200'
                          : isTraining
                            ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300'
                            : event.type === 'blocked'
                              ? 'bg-surface-overlay border border-border-strong text-text-secondary'
                              : 'bg-brand-700 border border-brand-800 text-white'

                      return (
                        <div
                          key={`${event.id}-${trainer.id}`}
                          className={`absolute px-1 py-1 rounded-lg text-xs font-normal ${colorClass} z-10`}
                          style={{
                            top: `${top}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            height: `${height}px`,
                            borderLeftWidth: '4px'
                          }}
                          onClick={(e) => openEditFromEvent(e, event)}
                        >
                          <div className="truncate font-normal leading-tight">{formatReservationTitle(event.title, event.plan)}</div>
                        </div>
                      )
                    })}
                </div>
              ))}

              {/* Hour Grid Lines (Background for all) - Moved after columns to be on top of availability */}
              <div className="absolute inset-0 z-[5] pointer-events-none">
                {timeSlots.map((time, index) => (
                  <div
                    key={`grid-${time}`}
                    className="absolute left-0 right-0 border-t border-border-strong"
                    style={{ top: `${index * 48}px` }}
                  />
                ))}
              </div>

              {/* Current Time Indicator */}
              {(() => {
                const todayStr = new Date().toLocaleDateString('ja-JP', {
                  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo'
                }).split('/').map(part => part.padStart(2, '0')).join('-')
                if (selectedDate !== todayStr) return null
                const now = new Date()
                const currentHour = now.getHours()
                const currentMinute = now.getMinutes()
                if (currentHour < 8) return null
                const currentTimePosition = ((currentHour - 8) + currentMinute / 60) * 48
                return (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-400 z-20 pointer-events-none"
                    style={{ top: `${currentTimePosition}px` }}
                  >
                    <div className="absolute -left-2 -top-1 w-2 h-2 bg-red-400 rounded-full"></div>
                  </div>
                )
              })()}

            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 px-4 py-2.5 border-t border-border-strong bg-surface-base">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs">
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <div className="h-2.5 w-2.5 shrink-0 rounded-lg border border-brand-800 bg-brand-700"></div>
            <span className="text-text-secondary">予約</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <div className="h-2.5 w-2.5 shrink-0 rounded-lg border border-blue-500/30 bg-blue-500/15"></div>
            <span className="text-text-secondary">体験</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <div className="h-2.5 w-2.5 shrink-0 rounded-lg border border-border-strong bg-surface-overlay"></div>
            <span className="text-text-secondary">予約不可時間</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <div className="h-2.5 w-2.5 shrink-0 rounded-lg border border-purple-500/40 bg-purple-500/25"></div>
            <span className="text-text-secondary">ゲスト</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <div className="h-2.5 w-2.5 shrink-0 rounded-lg border border-orange-500/25 bg-orange-500/10"></div>
            <span className="text-text-secondary">予約可能時間(シフト)</span>
          </div>
        </div>
      </div>

      {/* Loading Overlay for Navigation */}
      {isNavigating && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-surface-raised p-6 rounded-2xl shadow-xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4"></div>
            <p className="text-text-primary font-normal">予約画面へ移動中...</p>
            <p className="text-text-secondary text-xs mt-2">少々お待ちください</p>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingReservation && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-surface-raised shadow-xl rounded-2xl max-h-[90vh] flex flex-col border border-border-subtle">
            <div className="p-6 overflow-y-auto">
              <h3 className="text-xl font-semibold text-text-primary mb-4">予約の変更</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">タイトル</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">担当トレーナー</label>
                  <select
                    value={editFormData.trainerId || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, trainerId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">指定なし（フリー）</option>
                    {trainers.map(tr => (
                      <option key={tr.id} value={tr.id}>{tr.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">開始時刻</label>
                  <input
                    type="datetime-local"
                    value={editFormData.startTime}
                    onChange={handleStartTimeChange}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">終了時刻</label>
                  <input
                    type="datetime-local"
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">メモ</label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex items-center justify-between pt-4">
                  <div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteReservation}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      削除
                    </Button>
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => { setShowEditModal(false); setEditingReservation(null) }}
                      className="px-4 py-2 bg-surface-overlay text-text-secondary rounded-lg hover:bg-surface-overlay transition-colors"
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      className="px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition-colors"
                    >
                      更新
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 overflow-y-auto h-full w-full z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative p-6 w-full max-w-sm shadow-xl rounded-2xl bg-surface-raised">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-500/15 mb-4">
                <Icon name="trash" size={28} className="text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">予約を削除しますか？</h3>
              <p className="text-sm text-text-secondary mb-6">この操作は取り消せません。</p>
              <div className="flex justify-center space-x-3 w-full">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="flex-1 px-4 py-3 border border-border-strong text-text-secondary bg-surface-raised rounded-2xl hover:bg-surface-base transition-colors font-normal shadow-sm"
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="md"
                  onClick={executeDeleteReservation}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-colors font-normal shadow-sm"
                >
                  削除する
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
