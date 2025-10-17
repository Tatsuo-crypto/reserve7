'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import QuickReservationModal from './QuickReservationModal'

interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string
  type: 'reservation' | 'blocked'
  clientName?: string
  notes?: string
}

interface TimelineViewProps {
  selectedDate: string
  events: CalendarEvent[]
  onBack: () => void
  onEventsUpdate: () => void
}

export default function TimelineView({ selectedDate, events, onBack, onEventsUpdate }: TimelineViewProps) {
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const router = useRouter()
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState<{ id: string; type?: 'reservation' | 'blocked' } | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    notes: ''
  })
  // Generate time slots (0:00 - 23:00, hourly)
  const generateTimeSlots = () => {
    const slots: string[] = []
    for (let hour = 0; hour <= 23; hour++) {
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

  // Calculate position in timeline (pixel-based)
  const getEventPosition = (startMinutes: number, endMinutes: number) => {
    const hourHeight = 48 // 1時間あたりのピクセル数
    const startHour = startMinutes / 60
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
    return `${year}年${month}月${day}日（${dayOfWeek}）`
  }

  // Handle timeline click to create reservation
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const hourHeight = 48
    const clickedHour = Math.floor(clickY / hourHeight)
    
    if (clickedHour >= 0 && clickedHour < 24) {
      const startTime = `${String(clickedHour).padStart(2, '0')}:00`
      const endHour = clickedHour + 1
      const endTime = `${String(endHour).padStart(2, '0')}:00`
      
      setSelectedTimeSlot(`${startTime} - ${endTime}`)
      // Navigate to New Reservation page with prefilled startTime
      const startDateTime = `${selectedDate}T${startTime}`
      router.push(`/admin/reservations/new?startTime=${encodeURIComponent(startDateTime)}`)
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
      notes: ev.notes || ''
    })
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReservation) return
    try {
      const res = await fetch(`/api/reservations/${editingReservation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editFormData.title,
          startTime: new Date(editFormData.startTime).toISOString(),
          endTime: new Date(editFormData.endTime).toISOString(),
          notes: editFormData.notes,
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
      const res = await fetch(`/api/reservations/${editingReservation.id}`, {
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

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {formatSelectedDate(selectedDate)}
            </h2>
          </div>
          <div className="text-sm text-gray-500 whitespace-nowrap">
            {dayEvents.length}件の予約
          </div>
        </div>
      </div>

      {/* Timeline Body */}
      <div className="p-6">
        <div className="flex">
          {/* Time Labels */}
          <div className="w-20 flex-shrink-0 relative">
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="absolute right-2 text-xs text-gray-500 transform -translate-y-2"
                style={{ top: `${index * 48}px` }}
              >
                {time}
              </div>
            ))}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200"></div>
          </div>

          {/* Timeline Content */}
          <div 
            className="flex-1 relative ml-4 cursor-pointer" 
            style={{ height: `${timeSlots.length * 48}px` }}
            onClick={handleTimelineClick}
          >
            {/* Hour Grid Lines */}
            {timeSlots.map((time, index) => (
              <div
                key={`grid-${time}`}
                className="absolute left-0 right-0 border-t border-gray-200"
                style={{ top: `${index * 48}px` }}
              />
            ))}
            
            {/* Current time indicator (only for today's timeline in JST) */}
            {(() => {
              // Build today's date string in JST to match selectedDate format (YYYY-MM-DD)
              const todayStr = new Date().toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                timeZone: 'Asia/Tokyo',
              }).split('/').map(part => part.padStart(2, '0')).join('-')

              if (selectedDate !== todayStr) return null

              const now = new Date()
              const currentHour = now.getHours()
              const currentMinute = now.getMinutes()
              const currentTimePosition = (currentHour + currentMinute / 60) * 48

              return (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-400 z-50 pointer-events-none"
                  style={{ top: `${currentTimePosition}px` }}
                >
                  <div className="absolute -left-2 -top-1 w-2 h-2 bg-red-400 rounded-full"></div>
                </div>
              )
            })()}

            {/* Events */}
            {(() => {
              const dayEventsFiltered = events.filter(event => event.date === selectedDate)
              
              // Sort events by start time
              const sortedEvents = [...dayEventsFiltered].sort((a, b) => {
                const aStart = parseEventTime(a.time).startMinutes
                const bStart = parseEventTime(b.time).startMinutes
                return aStart - bStart
              })
              
              // Assign columns to events
              const eventColumns = new Map<string, { column: number, totalColumns: number }>()
              
              sortedEvents.forEach((event) => {
                const { startMinutes, endMinutes } = parseEventTime(event.time)
                
                // Find all overlapping events that have already been assigned columns
                const usedColumns = new Set<number>()
                let maxOverlapColumns = 0
                
                sortedEvents.forEach((otherEvent) => {
                  if (otherEvent.id === event.id) return
                  
                  const { startMinutes: otherStart, endMinutes: otherEnd } = parseEventTime(otherEvent.time)
                  
                  // Check if they overlap
                  if (startMinutes < otherEnd && endMinutes > otherStart) {
                    const otherColumn = eventColumns.get(otherEvent.id)
                    if (otherColumn) {
                      usedColumns.add(otherColumn.column)
                      maxOverlapColumns = Math.max(maxOverlapColumns, otherColumn.totalColumns)
                    }
                  }
                })
                
                // Find first available column
                let column = 0
                while (usedColumns.has(column)) {
                  column++
                }
                
                const totalColumns = Math.max(maxOverlapColumns, column + 1)
                eventColumns.set(event.id, { column, totalColumns })
              })
              
              // Update totalColumns for all overlapping events
              sortedEvents.forEach((event) => {
                const { startMinutes, endMinutes } = parseEventTime(event.time)
                let maxColumns = eventColumns.get(event.id)?.totalColumns || 1
                
                sortedEvents.forEach((otherEvent) => {
                  if (otherEvent.id === event.id) return
                  const { startMinutes: otherStart, endMinutes: otherEnd } = parseEventTime(otherEvent.time)
                  
                  if (startMinutes < otherEnd && endMinutes > otherStart) {
                    const otherInfo = eventColumns.get(otherEvent.id)
                    if (otherInfo) {
                      maxColumns = Math.max(maxColumns, otherInfo.totalColumns)
                    }
                  }
                })
                
                const current = eventColumns.get(event.id)
                if (current) {
                  eventColumns.set(event.id, { ...current, totalColumns: maxColumns })
                }
              })
              
              return dayEventsFiltered.map((event, index) => {
                const [startTime] = event.time.split(' - ')
                const [hours, minutes] = startTime.split(':').map(Number)
                const topPosition = (hours * 48) + (minutes * 48 / 60)
                
                const layoutInfo = eventColumns.get(event.id) || { column: 0, totalColumns: 1 }
                const widthPercent = 100 / layoutInfo.totalColumns
                const leftPercent = layoutInfo.column * widthPercent
                
                // Determine color based on reservation type
                // Check trial BEFORE blocked to ensure trial reservations are blue
                const isTrial = event.title.includes('体験')
                const colorClass = isTrial
                  ? 'bg-blue-100 border border-blue-200 text-blue-800'  // Trial = Blue (highest priority)
                  : event.type === 'blocked'
                  ? 'bg-red-100 border border-red-200 text-red-800'      // Blocked = Red
                  : 'bg-green-100 border border-green-200 text-green-800'  // Regular = Green
                
                console.log('Timeline event color:', {
                  title: event.title,
                  type: event.type,
                  isTrial,
                  colorClass: colorClass.split(' ')[0]
                })
                
                return (
                  <div
                    key={`${event.id}-${index}`}
                    className={`absolute px-2 py-1 rounded text-xs font-medium ${colorClass}`}
                    style={{ 
                      top: `${topPosition}px`,
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      height: '46px',
                      zIndex: 10,
                      paddingLeft: '4px',
                      paddingRight: '4px'
                    }}
                    onClick={(e) => openEditFromEvent(e, event)}
                  >
                    <div className="truncate font-semibold">{event.title}</div>
                    {/* Hide notes for trial reservations */}
                    {event.notes && !isTrial && (
                      <div className="text-xs opacity-75 truncate">{event.notes}</div>
                    )}
                  </div>
                )
              })
            })()}

            {/* Empty State */}
            {events.filter(event => event.date === selectedDate).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">この日に予約はありません</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span className="text-gray-600">予約</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-gray-600">体験</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
            <span className="text-gray-600">予約不可時間</span>
          </div>
        </div>
      </div>

      {/* Quick Reservation Modal */}
      {showQuickModal && (
        <QuickReservationModal
          isOpen={showQuickModal}
          onClose={() => setShowQuickModal(false)}
          selectedDate={selectedDate}
          selectedTime={selectedTimeSlot}
          onSuccess={handleModalSuccess}
        />
      )}

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
                  <input
                    type="datetime-local"
                    value={editFormData.startTime}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, startTime: e.target.value }))}
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
