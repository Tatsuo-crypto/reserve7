'use client'

import { useState, useRef, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, setHours, setMinutes, differenceInMinutes, getDay, isAfter, isBefore, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, ShiftTemplate } from '@/types'

interface ShiftCalendarProps {
  currentDate: Date
  shifts: Shift[]
  templates?: ShiftTemplate[]
  trainerName?: string
  onShiftCreate: (start: Date, end: Date) => Promise<void>
  onShiftUpdate: (shiftId: string, start: Date, end: Date) => Promise<void>
  onShiftDelete: (shiftId: string) => Promise<void>
  loading?: boolean
  selectionMode?: boolean
  selectedShiftIds?: string[]
  onShiftSelect?: (shiftId: string) => void
}

export default function ShiftCalendar({ 
  currentDate, 
  shifts, 
  templates = [], 
  trainerName, 
  onShiftCreate, 
  onShiftUpdate, 
  onShiftDelete, 
  loading,
  selectionMode = false,
  selectedShiftIds = [],
  onShiftSelect
}: ShiftCalendarProps) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calendar constants
  const START_HOUR = 9
  const END_HOUR = 23
  const HOUR_HEIGHT = 40 // px per hour
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  // Generate days for the week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday start
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6)
  })

  // Helper to calculate position style for a shift
  const getShiftStyle = (start: Date, end: Date) => {
    // Calculate top offset
    const startHour = start.getHours()
    const startMin = start.getMinutes()
    const top = ((startHour - START_HOUR) * 60 + startMin) * (HOUR_HEIGHT / 60)

    // Calculate height
    const durationMins = differenceInMinutes(end, start)
    const height = durationMins * (HOUR_HEIGHT / 60)

    return {
      top: `${Math.max(0, top)}px`,
      height: `${Math.max(20, height)}px`, // Minimum height for visibility
    }
  }

  const handleTimeSlotClick = (day: Date, hour: number) => {
    // Create a default 1-hour shift
    const start = setMinutes(setHours(day, hour), 0)
    const end = setMinutes(setHours(day, hour + 1), 0)
    onShiftCreate(start, end)
  }

  const handleShiftClick = (e: React.MouseEvent, shift: Shift) => {
    e.stopPropagation()
    if (selectionMode) {
      onShiftSelect?.(shift.id)
    } else {
      setSelectedShift(shift)
      setEditModalOpen(true)
    }
  }

  // Helper to extract surname
  const getSurname = (fullName?: string) => {
    if (!fullName) return ''
    const trimmed = fullName.trim()
    if (!trimmed) return ''
    const parts = trimmed.split(/[\s　]+/)
    return parts[0] || trimmed
  }

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] min-h-[600px] border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header: Days of week */}
      <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="p-2 border-r border-gray-200 text-center text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10">
          時間
        </div>
        {weekDays.map(day => (
          <div key={day.toString()} className={`p-2 text-center border-r border-gray-200 last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-blue-50' : ''}`}>
            <div className="text-xs font-medium text-gray-500">{format(day, 'E', { locale: ja })}</div>
            <div className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-900'}`}>
              {format(day, 'M/d')}
            </div>
          </div>
        ))}
      </div>

      {/* Body: Scrollable time grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative">
        <div className="grid grid-cols-8 relative min-h-full">
          
          {/* Time axis */}
          <div className="border-r border-gray-200 bg-white sticky left-0 z-10 w-full">
            {hours.map(hour => (
              <div key={hour} className="h-[40px] border-b border-gray-100 text-xs text-gray-400 text-center relative">
                <span className="absolute top-1 left-0 right-0">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Days columns */}
          {weekDays.map(day => {
            const dayShifts = shifts.filter(s => isSameDay(new Date(s.start_time), day))
            
            // Find templates for this day (0-6, matches date-fns getDay)
            const dayTemplates = templates.filter(t => t.day_of_week === getDay(day))

            return (
              <div key={day.toString()} className="relative border-r border-gray-200 last:border-r-0 bg-white group">
                {/* Background grid lines */}
                {hours.map(hour => (
                  <div 
                    key={`${day}-${hour}`} 
                    className="h-[40px] border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleTimeSlotClick(day, hour)}
                  />
                ))}

                {/* Templates (Ghost Shifts) */}
                {dayTemplates.map((tmpl, idx) => {
                  // Parse "HH:MM:SS" to Date objects on the current day
                  const start = parse(tmpl.start_time, 'HH:mm:ss', day)
                  const end = parse(tmpl.end_time, 'HH:mm:ss', day)
                  const surname = getSurname(trainerName)
                  
                  // Check for overlap with actual shifts
                  const hasOverlap = dayShifts.some(shift => {
                    const shiftStart = new Date(shift.start_time)
                    const shiftEnd = new Date(shift.end_time)
                    return (start < shiftEnd && end > shiftStart)
                  })

                  if (hasOverlap) return null

                  return (
                    <div
                      key={`tmpl-${idx}`}
                      className="absolute inset-x-1 rounded bg-indigo-50 border border-indigo-200 pointer-events-none z-0 flex items-center justify-center overflow-hidden"
                      style={getShiftStyle(start, end)}
                    >
                      <div className="w-full text-center px-0.5">
                        <div className="text-[10px] text-indigo-900 leading-tight break-words font-medium">
                          {surname}
                        </div>
                        {/* 
                        <div className="text-[9px] text-indigo-700 font-medium leading-tight">
                          (固定)
                        </div>
                        */}
                      </div>
                    </div>
                  )
                })}

                {/* Shifts */}
                {dayShifts.map(shift => {
                  const surname = getSurname(shift.trainer?.full_name || trainerName)
                  const isSelected = selectedShiftIds.includes(shift.id)

                  return (
                    <div
                      key={shift.id}
                      className={`absolute inset-x-1 rounded border cursor-pointer z-10 shadow-sm transition-colors overflow-hidden flex items-center justify-center
                        ${isSelected 
                          ? 'bg-orange-100 border-orange-400 hover:bg-orange-200 ring-2 ring-orange-400 ring-opacity-50' 
                          : 'bg-indigo-100 border-indigo-300 hover:bg-indigo-200'
                        }`}
                      style={getShiftStyle(new Date(shift.start_time), new Date(shift.end_time))}
                      onClick={(e) => handleShiftClick(e, shift)}
                    >
                      <div className="w-full px-0.5 text-center">
                        <span className={`relative z-50 text-[10px] leading-tight break-words block ${isSelected ? 'text-orange-900 font-medium' : 'text-indigo-900'}`}>
                          {surname}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && selectedShift && (
        <ShiftEditModal
          shift={selectedShift}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false)
            setSelectedShift(null)
          }}
          onSave={onShiftUpdate}
          onDelete={onShiftDelete}
        />
      )}
    </div>
  )
}

// Helper to generate time options (30 min intervals)
const generateTimeOptions = () => {
  const options = []
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0')
    options.push(`${hour}:00`)
    options.push(`${hour}:30`)
  }
  return options
}

// Sub-component for editing shift
function ShiftEditModal({ shift, isOpen, onClose, onSave, onDelete }: { 
  shift: Shift, 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (id: string, s: Date, e: Date) => Promise<void>,
  onDelete: (id: string) => Promise<void>
}) {
  const [startTime, setStartTime] = useState(format(new Date(shift.start_time), 'HH:mm'))
  const [endTime, setEndTime] = useState(format(new Date(shift.end_time), 'HH:mm'))
  const [loading, setLoading] = useState(false)
  const timeOptions = generateTimeOptions()

  const handleSave = async () => {
    setLoading(true)
    try {
      const baseDate = new Date(shift.start_time)
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      
      const newStart = setMinutes(setHours(baseDate, sh), sm)
      const newEnd = setMinutes(setHours(baseDate, eh), em)
      
      // Validation
      if (isAfter(newStart, newEnd) || newStart.getTime() === newEnd.getTime()) {
        alert('終了時間は開始時間より後に設定してください')
        setLoading(false)
        return
      }

      await onSave(shift.id, newStart, newEnd)
      onClose()
    } catch (e) {
      console.error(e)
      alert('保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('このシフトを削除しますか？')) return
    setLoading(true)
    try {
      await onDelete(shift.id)
      onClose()
    } catch (e) {
      console.error(e)
      alert('削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-80">
        <h3 className="text-lg font-medium mb-4">シフト編集</h3>
        <p className="text-sm text-gray-500 mb-4">{format(new Date(shift.start_time), 'yyyy/MM/dd (E)', { locale: ja })}</p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">開始</label>
            <select
              className="w-full border rounded p-2"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`start-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">終了</label>
            <select
              className="w-full border rounded p-2"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`end-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between">
          <button 
            onClick={handleDelete}
            className="px-3 py-2 text-red-600 text-sm hover:bg-red-50 rounded"
            disabled={loading}
          >
            削除
          </button>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-3 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded"
              disabled={loading}
            >
              キャンセル
            </button>
            <button 
              onClick={handleSave}
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              disabled={loading}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
