'use client'

import { useState } from 'react'
import QuickReservationModal from './QuickReservationModal'

interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string
  type: 'reservation' | 'blocked'
  clientName?: string
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
  // Generate time slots (0:00 - 23:00, hourly)
  const generateTimeSlots = () => {
    const slots = []
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
      setShowQuickModal(true)
    }
  }

  const handleModalSuccess = () => {
    onEventsUpdate() // Refresh events
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                タイムライン表示
              </h2>
              <p className="text-sm text-gray-600">
                {formatSelectedDate(selectedDate)}
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
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
            
            {/* Current time indicator */}
            {(() => {
              const now = new Date()
              const currentHour = now.getHours()
              const currentMinute = now.getMinutes()
              const currentTimePosition = (currentHour + currentMinute / 60) * 48
              
              return (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-400 z-10"
                  style={{ top: `${currentTimePosition}px` }}
                >
                  <div className="absolute -left-2 -top-1 w-2 h-2 bg-red-400 rounded-full"></div>
                </div>
              )
            })()}

            {/* Events */}
            {events
              .filter(event => event.date === selectedDate)
              .map((event, index) => {
                const [startTime] = event.time.split(' - ')
                const [hours, minutes] = startTime.split(':').map(Number)
                const topPosition = (hours * 48) + (minutes * 48 / 60)
                
                return (
                  <div
                    key={`${event.id}-${index}`}
                    className={`absolute left-0 right-0 mx-1 px-2 py-1 rounded text-xs font-medium ${
                      event.type === 'blocked' 
                        ? 'bg-red-100 border border-red-200 text-red-800'
                        : 'bg-green-100 border border-green-200 text-green-800'
                    }`}
                    style={{ 
                      top: `${topPosition}px`,
                      height: '46px',
                      zIndex: 10
                    }}
                  >
                    <div className="truncate font-semibold">{event.title}</div>
                    <div className="text-xs opacity-75">{event.time}</div>
                  </div>
                )
              })}

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
            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
            <span className="text-gray-600">予約不可時間</span>
          </div>
        </div>
      </div>

      {/* Quick Reservation Modal */}
      <QuickReservationModal
        isOpen={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        selectedDate={selectedDate}
        selectedTime={selectedTimeSlot}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
