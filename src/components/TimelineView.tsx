'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

  // Generate time slots (8:00 - 23:00, hourly)
  const generateTimeSlots = () => {
    const slots: string[] = []
    for (let hour = 8; hour <= 23; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Filter events for selected date
  const dayEvents = events.filter(event => event.date === selectedDate)
  // Parse event time and calculate position
  const parseEventTime = (timeStr: string) => {
    const [startTime, endTime] = timeStr.split(' - ')
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    return { startMinutes, endMinutes, startTime, endTime }
  }

  // Calculate position in timeline (pixel-based) - 8時スタート対応
  const getEventPosition = (startMinutes: number, endMinutes: number) => {
    const hourHeight = 48 // 1時間あたりのピクセル数
    const startHour = startMinutes / 60 - 8 // 8時スタートなので8を引く
    const durationHours = (endMinutes - startMinutes) / 60

    const top = startHour * hourHeight
    const height = durationHours * hourHeight

    return { top, height }
  }

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

      router.push(url)
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
        alert(data.error || '予約の更新に失敗しました')
        return
      }
      setShowEditModal(false)
      setEditingReservation(null)
      onEventsUpdate()
    } catch (err) {
      console.error(err)
      alert('予約の更新に失敗しました')
    }
  }

  const handleDeleteReservation = async () => {
    if (!editingReservation) return
    if (!confirm('この予約を削除しますか？')) return
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
        alert(data.error || '予約の削除に失敗しました')
        return
      }
      setShowEditModal(false)
      setEditingReservation(null)
      onEventsUpdate()
    } catch (err) {
      console.error(err)
      alert('予約の削除に失敗しました')
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
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md flex-shrink-0"
              title="前の日"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900 whitespace-nowrap">
              {formatSelectedDate(selectedDate)}
            </h2>
            <button
              onClick={() => changeDate(1)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md flex-shrink-0"
              title="次の日"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Body */}
      <div className="flex flex-col h-full">
        {/* Trainer Headers */}
        <div className="flex border-b border-gray-200 ml-12">
          {trainers.map((trainer) => (
            <div key={trainer.id} className="flex-1 text-center py-2 font-bold text-gray-700 border-l border-gray-200 bg-gray-50">
              {trainer.name}
            </div>
          ))}
          {/* Fallback column for unassigned if needed, or just hide? 
              User requested specific layout. Let's stick to trainers. 
          */}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex relative min-h-[768px]"> {/* 16 hours * 48px */}
            {/* Time Labels */}
            <div className="w-12 flex-shrink-0 relative bg-white z-10">
              {timeSlots.map((time, index) => (
                <div
                  key={time}
                  className="absolute right-2 text-xs text-gray-500 transform -translate-y-2"
                  style={{ top: `${index * 48}px` }}
                >
                  {time}
                </div>
              ))}
            </div>

            {/* Trainer Columns */}
            <div className="flex flex-1 relative bg-gray-300">
              {trainers.map((trainer, trainerIndex) => (
                <div
                  key={trainer.id}
                  className="flex-1 relative border-l border-gray-200 transition-colors"
                  style={{ height: `${timeSlots.length * 48}px` }}
                  onClick={(e) => handleTimelineClick(e, trainer.id)}
                >
                  {/* Availability Blocks (Shifts & Templates) */}
                  {(() => {
                    // Filter shifts for this trainer
                    const trainerShifts = shifts.filter(s =>
                      s.trainerId === trainer.id &&
                      new Date(s.startTime).toLocaleDateString('ja-JP', {
                        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo'
                      }).split('/').map(p => p.padStart(2, '0')).join('-') === selectedDate
                    )

                    // Filter templates for this trainer
                    const jstDate = new Date(`${selectedDate}T00:00:00+09:00`)
                    const dayOfWeek = jstDate.getDay()
                    const trainerTemplates = templates.filter(t =>
                      t.trainerId === trainer.id && t.dayOfWeek === dayOfWeek
                    )

                    // Merge and Deduplicate
                    const availabilityItems: { start: Date, end: Date, type: 'shift' | 'template' }[] = []

                    // Add shifts
                    trainerShifts.forEach(s => {
                      availabilityItems.push({
                        start: new Date(s.startTime),
                        end: new Date(s.endTime),
                        type: 'shift'
                      })
                    })

                    // Add templates if no overlap with shifts
                    trainerTemplates.forEach(t => {
                      const start = new Date(`${selectedDate}T${t.startTime}+09:00`)
                      const end = new Date(`${selectedDate}T${t.endTime}+09:00`)

                      const hasOverlap = trainerShifts.some(s => {
                        const sStart = new Date(s.startTime)
                        const sEnd = new Date(s.endTime)
                        return (start < sEnd && end > sStart)
                      })

                      if (!hasOverlap) {
                        availabilityItems.push({ start, end, type: 'template' })
                      }
                    })

                    return availabilityItems.map((item, idx) => {
                      const timelineStartMinutes = 8 * 60
                      const startMinutes = item.start.getHours() * 60 + item.start.getMinutes()
                      const endMinutes = item.end.getHours() * 60 + item.end.getMinutes()

                      // Handle crossing midnight or just clamp? Assuming 8-23 for now
                      const top = ((startMinutes - timelineStartMinutes) / 60) * 48
                      const height = ((endMinutes - startMinutes) / 60) * 48

                      return (
                        <div
                          key={`avail-${idx}`}
                          className="absolute w-full bg-white z-0 pointer-events-none"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                          }}
                        />
                      )
                    })
                  })()}

                  {/* Reservations */}
                  {(() => {
                    const trainerEvents = dayEvents.filter(event => {
                      // 1. Explicit Assignment: If event has trainerId, match it strictly
                      if (event.trainerId) {
                        return event.trainerId === trainer.id
                      }

                      // 2. Store 1 Logic (Single Trainer): Show all unassigned events
                      if (trainers.length === 1) {
                        return true
                      }

                      // 3. Store 2 Logic (Multiple Trainers): Assign to first available trainer
                      const { startMinutes, endMinutes } = parseEventTime(event.time)

                      // Helper to check overlap with a specific trainer (reused logic)
                      const checkOverlapWithTrainer = (tid: string) => {
                        // Check shifts
                        const tShifts = shifts.filter(s => s.trainerId === tid)
                        const shiftOverlap = tShifts.some(s => {
                          const sDate = new Date(s.startTime).toLocaleDateString('ja-JP', {
                            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo'
                          }).split('/').map(p => p.padStart(2, '0')).join('-')
                          if (sDate !== selectedDate) return false

                          const sStart = new Date(s.startTime)
                          const sEnd = new Date(s.endTime)
                          const sStartM = sStart.getHours() * 60 + sStart.getMinutes()
                          const sEndM = sEnd.getHours() * 60 + sEnd.getMinutes()

                          return (startMinutes < sEndM && endMinutes > sStartM)
                        })
                        if (shiftOverlap) return true

                        // Check templates
                        const jstDate = new Date(`${selectedDate}T00:00:00+09:00`)
                        const dayOfWeek = jstDate.getDay()
                        const tTemplates = templates.filter(t => t.trainerId === tid && t.dayOfWeek === dayOfWeek)
                        const templateOverlap = tTemplates.some(t => {
                          const tStartH = parseInt(t.startTime.split(':')[0])
                          const tStartM = parseInt(t.startTime.split(':')[1])
                          const tEndH = parseInt(t.endTime.split(':')[0])
                          const tEndM = parseInt(t.endTime.split(':')[1])
                          const tStartTotal = tStartH * 60 + tStartM
                          const tEndTotal = tEndH * 60 + tEndM

                          return (startMinutes < tEndTotal && endMinutes > tStartTotal)
                        })
                        return templateOverlap
                      }

                      // Find the FIRST trainer who is available for this time slot
                      const firstAvailableTrainer = trainers.find(t => checkOverlapWithTrainer(t.id))

                      if (firstAvailableTrainer) {
                        // If we found an available trainer, show this event ONLY if this column belongs to them
                        return trainer.id === firstAvailableTrainer.id
                      } else {
                        // If NO ONE is available (e.g. completely off-hours), fallback to the first trainer (index 0)
                        return trainerIndex === 0
                      }
                    })

                    // We need to layout overlapping events WITHIN this column if any
                    // Reuse the column logic but restricted to this container width
                    // Actually, let's keep it simple: simpler width division if overlaps

                    // Assign columns to events within this trainer column
                    const sortedEvents = [...trainerEvents].sort((a, b) => {
                      const aStart = parseEventTime(a.time).startMinutes
                      const bStart = parseEventTime(b.time).startMinutes
                      return aStart - bStart
                    })

                    const eventColumns = new Map<string, { column: number, totalColumns: number }>()
                    // ... (Reuse the overlap logic) ...
                    // For brevity, I will copy the logic but scoped here.

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
                      const totalColumns = Math.max(maxOverlapColumns, column + 1)
                      eventColumns.set(event.id, { column, totalColumns })
                    })

                    // Second pass for totalColumns
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


                    return trainerEvents.map((event, index) => {
                      const { startMinutes, endMinutes, startTime: startStr, endTime: endStr } = parseEventTime(event.time)
                      const top = ((startMinutes - (8 * 60)) / 60) * 48
                      const height = ((endMinutes - startMinutes) / 60) * 48

                      const layoutInfo = eventColumns.get(event.id) || { column: 0, totalColumns: 1 }
                      const widthPercent = 100 / layoutInfo.totalColumns
                      const leftPercent = layoutInfo.column * widthPercent

                      const isTrial = event.title.includes('体験')
                      const isGuest = event.type === 'guest' || (event.title && event.title.includes('ゲスト'))
                      const isTraining = event.type === 'training'
                      const colorClass = isTrial
                        ? 'bg-blue-300 bg-opacity-50 border border-blue-500 text-blue-900'
                        : isGuest
                          ? 'bg-purple-300 bg-opacity-50 border border-purple-500 text-purple-900'
                          : isTraining
                            ? 'bg-orange-300 bg-opacity-50 border border-orange-500 text-orange-900'
                            : event.type === 'blocked'
                              ? 'bg-red-300 bg-opacity-50 border border-red-500 text-red-900'
                              : 'bg-green-300 bg-opacity-50 border border-green-500 text-green-900'

                      return (
                        <div
                          key={`${event.id}-${trainer.id}`}
                          className={`absolute px-1 py-1 rounded text-xs font-medium ${colorClass} z-10`}
                          style={{
                            top: `${top}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            height: `${height}px`,
                            borderLeftWidth: '4px'
                          }}
                          onClick={(e) => openEditFromEvent(e, event)}
                        >
                          <div className="truncate font-bold leading-tight">{formatReservationTitle(event.title, event.plan)}</div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ))}

              {/* Hour Grid Lines (Background for all) - Moved after columns to be on top of availability */}
              <div className="absolute inset-0 z-[5] pointer-events-none">
                {timeSlots.map((time, index) => (
                  <div
                    key={`grid-${time}`}
                    className="absolute left-0 right-0 border-t border-gray-300"
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
                    className="absolute left-0 right-0 border-t-2 border-red-400 z-50 pointer-events-none"
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
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-300 bg-opacity-50 border border-green-500 rounded"></div>
            <span className="text-gray-600">予約</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-300 bg-opacity-50 border border-blue-500 rounded"></div>
            <span className="text-gray-600">体験</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-300 bg-opacity-50 border border-red-500 rounded"></div>
            <span className="text-gray-600">予約不可時間</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-300 bg-opacity-50 border border-purple-500 rounded"></div>
            <span className="text-gray-600">ゲスト</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingReservation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">予約の変更</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">担当トレーナー</label>
                  <select
                    value={editFormData.trainerId || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, trainerId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">指定なし（フリー）</option>
                    {trainers.map(tr => (
                      <option key={tr.id} value={tr.id}>{tr.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
                  <input
                    type="datetime-local"
                    value={editFormData.startTime}
                    onChange={handleStartTimeChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
                  <input
                    type="datetime-local"
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between pt-4">
                  <div>
                    <button
                      type="button"
                      onClick={handleDeleteReservation}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => { setShowEditModal(false); setEditingReservation(null) }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      更新
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
