'use client'

import { useState, useEffect } from 'react'
import TimelineView from './TimelineView'

interface Reservation {
  id: string
  title: string
  startTime: string
  endTime: string
  notes?: string
  client: {
    id: string
    fullName: string
    email: string
    plan?: string
  }
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string
  type: 'reservation' | 'blocked'
  clientName?: string
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Get calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        setLoading(true)
        
        const response = await fetch('/api/reservations')
        console.log('Calendar API response status:', response.status)
        setDebugInfo(`API Status: ${response.status}`)
        
        if (response.ok) {
          const result = await response.json()
          console.log('Calendar API result:', result)
          const data = result.data || result
          console.log('Calendar API data:', data)
          const reservations: Reservation[] = data.reservations || []
          console.log('Reservations count:', reservations.length)
          setDebugInfo(`API Status: ${response.status}, Count: ${reservations.length}`)
          
          if (reservations.length > 0) {
            console.log('First reservation:', reservations[0])
            
            // Transform reservations to calendar events
            const calendarEvents: CalendarEvent[] = reservations.map(reservation => {
              console.log('Processing reservation:', reservation)
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
              
              const event: CalendarEvent = {
                id: reservation.id,
                title: reservation.title,
                date: dateInJST,
                time: `${startTime} - ${endTime}`,
                type: reservation.client.id === 'blocked' ? 'blocked' : 'reservation',
                clientName: reservation.client.id === 'blocked' ? '予約不可' : reservation.client.fullName
              }
              console.log('Created event:', event)
              return event
            })
            
            console.log('All calendar events:', calendarEvents)
            setEvents(calendarEvents)
            setDebugInfo(`API Status: ${response.status}, Count: ${reservations.length}, Events: ${calendarEvents.length}`)
          } else {
            setDebugInfo(`API Status: ${response.status}, Count: 0 (no reservations)`)
            setEvents([])
          }
        } else {
          const errorText = await response.text()
          console.error('Calendar API error:', response.status, errorText)
          setDebugInfo(`API Error: ${response.status} - ${errorText}`)
          setEvents([])
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error)
        setDebugInfo(`Fetch Error: ${error}`)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchCalendarData()
  }, [currentDate])

  // Calendar utilities
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getEventsForDate = (dateStr: string) => {
    return events.filter(event => event.date === dateStr)
  }

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr)
    setViewMode('timeline')
  }

  const handleBackToMonth = () => {
    setViewMode('month')
    setSelectedDate('')
  }

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-24 bg-gray-50 border border-gray-200"></div>
      )
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayEvents = getEventsForDate(dateStr)
      const isToday = dateStr === new Date().toISOString().split('T')[0]

      days.push(
        <div
          key={day}
          className={`h-24 border border-gray-200 p-1 overflow-hidden cursor-pointer ${
            isToday ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'
          }`}
          onClick={() => handleDateClick(dateStr)}
        >
          <div className={`text-sm font-medium mb-1 ${
            isToday ? 'text-blue-600' : 'text-gray-900'
          }`}>
            {day}
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 2).map(event => (
              <div
                key={event.id}
                className={`text-xs px-1 py-0.5 rounded truncate ${
                  event.type === 'reservation'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}
                title={`${event.title} (${event.time})`}
              >
                {event.title}
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div className="text-xs text-gray-500 px-1">
                +{dayEvents.length - 2} more
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
        onBack={handleBackToMonth}
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
                  
                  return {
                    id: reservation.id,
                    title: reservation.title,
                    date: dateInJST,
                    time: `${startTime} - ${endTime}`,
                    type: reservation.client.id === 'blocked' ? 'blocked' : 'reservation',
                    clientName: reservation.client.id === 'blocked' ? '予約不可' : reservation.client.fullName
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
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
      {/* Calendar Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            カレンダー表示
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-lg font-medium text-gray-900 min-w-[120px] text-center">
              {formatMonth(currentDate)}
            </h3>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="p-6">
        {/* Debug Info */}
        {debugInfo && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">Debug: {debugInfo}</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2 text-gray-600">読み込み中...</span>
          </div>
        ) : (
          <>
            {/* Days of week header */}
            <div className="grid grid-cols-7 mb-2">
              {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-700 border-b border-gray-200">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0">
              {renderCalendarDays()}
            </div>
          </>
        )}
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
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-gray-600">今日</span>
          </div>
        </div>
      </div>
    </div>
  )
}
