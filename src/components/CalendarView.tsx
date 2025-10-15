'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TimelineView from './TimelineView'
import { useSession } from 'next-auth/react'

interface Reservation {
  id: string
  title: string
  startTime: string
  endTime: string
  notes?: string
  memo?: string
  client: {
    id: string
    fullName: string
    email: string
    plan?: string
    storeId?: string
  }
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string
  type: 'reservation' | 'blocked'
  clientName?: string
  notes?: string
}

export default function CalendarView() {
  const { data: session } = useSession()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Note: タイトルの採番はサーバ側で行うため、フロントでは変更しない

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
            
            // Transform reservations to calendar events (タイトルはサーバの値をそのまま使用)
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
                clientName: reservation.client.id === 'blocked' ? '予約不可' : reservation.client.fullName,
                notes: reservation.memo || reservation.notes || ''
              }
              console.log('Created event:', event)
              return event
            })
            
            console.log('All calendar events:', calendarEvents)
            setEvents(calendarEvents)
            setDebugInfo(`API Status: ${response.status}, Count: ${reservations.length}, Events: ${calendarEvents.length}`)
          } else {
            setEvents([])
            setDebugInfo(`API Status: ${response.status}, Count: 0, Events: 0`)
          }
        } else {
          const errorText = await response.text()
          console.error('Calendar API error:', response.status, errorText)
          setDebugInfo(`API Error: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error)
        setDebugInfo(`Fetch Error: ${error}`)
      } finally {
        setLoading(false)
      }
    }

    fetchCalendarData()
  }, [session])

  // Helper functions
  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long',
      timeZone: 'Asia/Tokyo'
    })
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getEventsForDate = (dateStr: string) => {
    return events.filter(event => event.date === dateStr)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
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
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const isToday = dateStr === todayStr

      days.push(
        <div
          key={day}
          className="h-24 border border-gray-200 p-1 overflow-hidden cursor-pointer flex flex-col bg-white hover:bg-gray-50"
          onClick={() => handleDateClick(dateStr)}
        >
          <div className="text-sm font-medium mb-1 flex-shrink-0 flex justify-start">
            {isToday ? (
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {day}
              </div>
            ) : (
              <span className="text-gray-900">{day}</span>
            )}
          </div>
          <div className="flex-1 min-h-0 space-y-0 overflow-hidden">
            {dayEvents.slice(0, 4).map(event => (
              <div
                key={event.id}
                className={`text-[8px] px-0.5 py-0 rounded truncate leading-none ${
                  event.type === 'reservation'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}
                title={`${event.title} (${event.time})`}
              >
                {event.title}
              </div>
            ))}
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
                    clientName: reservation.client.id === 'blocked' ? '予約不可' : reservation.client.fullName,
                    notes: reservation.memo || reservation.notes || ''
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
    <div className="rounded-lg w-full">
      {/* White container: Month title -> Calendar grid -> Legend */}
      <div className="mx-2 sm:mx-4 bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        {/* Month Navigation */}
        <div className="">
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-base sm:text-sm font-medium text-gray-900 min-w-[160px] text-center">
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
        <div className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-gray-600">読み込み中...</span>
            </div>
          ) : (
            <div className="">
              {/* Days of week header (no divider line) */}
              <div className="grid grid-cols-7 mb-1">
                {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                  <div key={day} className={`p-2 text-center text-sm font-medium ${
                    index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
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
        <div className="px-6 py-3">
          <div className="flex items-center justify-center space-x-6 text-sm">
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
      </div>
      {/* Button to navigate to reservation list */}
      <div className="mt-4 flex justify-center">
        <Link
          href="/admin/reservations"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 transition-colors"
        >
          予約一覧を見る
        </Link>
      </div>
    </div>
  )
}
