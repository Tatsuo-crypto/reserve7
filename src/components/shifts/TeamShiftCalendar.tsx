'use client'

import { useState, useRef } from 'react'
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, setHours, setMinutes, parseISO, differenceInMinutes, isAfter, parse, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, Trainer, ShiftTemplate } from '@/types'

interface TeamShiftCalendarProps {
  currentDate: Date
  trainers: Trainer[]
  shifts: Shift[]
  templates?: ShiftTemplate[]
  onShiftCreate: (trainerId: string, start: Date, end: Date) => Promise<void>
  onShiftUpdate: (shiftId: string, start: Date, end: Date) => Promise<void>
  onShiftDelete: (shiftId: string) => Promise<void>
  loading?: boolean
  selectionMode?: boolean
  selectedShiftIds?: string[]
  onShiftSelect?: (shiftId: string) => void
}

// Generate time options (30 min intervals)
const generateTimeOptions = () => {
  const options = []
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0')
    options.push(`${hour}:00`)
    options.push(`${hour}:30`)
  }
  return options
}

// Color palette for trainers
const TRAINER_COLORS = [
  { bg: 'bg-blue-200', border: 'border-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-green-200', border: 'border-green-400', dot: 'bg-green-500' },
  { bg: 'bg-orange-200', border: 'border-orange-400', dot: 'bg-orange-500' },
  { bg: 'bg-purple-200', border: 'border-purple-400', dot: 'bg-purple-500' },
  { bg: 'bg-pink-200', border: 'border-pink-400', dot: 'bg-pink-500' },
  { bg: 'bg-yellow-200', border: 'border-yellow-400', dot: 'bg-yellow-500' },
  { bg: 'bg-teal-200', border: 'border-teal-400', dot: 'bg-teal-500' },
  { bg: 'bg-red-200', border: 'border-red-400', dot: 'bg-red-500' },
]

interface CalendarItem {
  id: string
  trainerId: string
  start: Date
  end: Date
  type: 'shift' | 'template'
  data: Shift | ShiftTemplate
}

// Helper to extract surname
const getSurname = (fullName?: string) => {
  if (!fullName) return '(不明)'
  const trimmed = fullName.trim()
  if (!trimmed) return '(不明)'
  // Split by full-width or half-width space
  const parts = trimmed.split(/[\s　]+/)
  return parts[0] || trimmed
}

export default function TeamShiftCalendar({ 
  currentDate, 
  trainers, 
  shifts, 
  templates = [],
  onShiftCreate, 
  onShiftUpdate, 
  onShiftDelete, 
  loading,
  selectionMode = false,
  selectedShiftIds = [],
  onShiftSelect
}: TeamShiftCalendarProps) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  
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

  // Calculate item position
  const getItemStyle = (item: CalendarItem, dayItems: CalendarItem[]) => {
    const start = item.start
    const end = item.end
    
    // Calculate top offset
    const startHour = start.getHours()
    const startMin = start.getMinutes()
    const top = ((startHour - START_HOUR) * 60 + startMin) * (HOUR_HEIGHT / 60)

    // Calculate height
    const durationMins = differenceInMinutes(end, start)
    const height = durationMins * (HOUR_HEIGHT / 60)

    // Calculate width and left offset for overlapping items
    // Filter items that overlap with the current item
    const overlaps = dayItems.filter(s => {
      // Check for time overlap
      return (start < s.end && end > s.start)
    }).sort((a, b) => {
      // Sort by start time, then by type (shifts on top/right?), then by trainer
      const timeDiff = a.start.getTime() - b.start.getTime()
      if (timeDiff !== 0) return timeDiff
      // Prefer templates first in sort so they might appear left? Or random?
      // Actually consistent ordering is key
      return a.id.localeCompare(b.id)
    })
    
    const index = overlaps.findIndex(s => s.id === item.id)
    const count = overlaps.length
    
    // If there are overlaps, divide width
    const width = count > 1 ? 95 / count : 95
    const left = count > 1 ? index * width : 0

    return {
      top: `${Math.max(0, top)}px`,
      height: `${Math.max(20, height)}px`,
      width: `${width}%`,
      left: `${left}%`,
      zIndex: 10 + index
    }
  }

  const handleTimeSlotClick = (day: Date, hour: number) => {
    setSelectedDate(day)
    setSelectedTime(hour)
    setCreateModalOpen(true)
  }

  const handleShiftClick = (e: React.MouseEvent, shift: Shift) => {
    e.stopPropagation()
    if (selectionMode) {
      onShiftSelect?.(shift.id)
    } else {
      setSelectedShift(shift)
    }
  }

  const getTrainerColor = (trainerId: string) => {
    const index = trainers.findIndex(t => t.id === trainerId)
    return TRAINER_COLORS[index % TRAINER_COLORS.length] || TRAINER_COLORS[0]
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
            // Prepare items for this day
            const dayItems: CalendarItem[] = []

            // 1. Add Shifts
            shifts
              .filter(s => isSameDay(parseISO(s.start_time), day))
              .forEach(s => {
                dayItems.push({
                  id: s.id,
                  trainerId: s.trainer_id,
                  start: parseISO(s.start_time),
                  end: parseISO(s.end_time),
                  type: 'shift',
                  data: s
                })
              })

            // 2. Add Templates
            templates
              .filter(t => t.day_of_week === getDay(day))
              .forEach((t, idx) => {
                const start = parse(t.start_time, 'HH:mm:ss', day)
                const end = parse(t.end_time, 'HH:mm:ss', day)
                
                // Check if there is already an actual shift for this trainer that overlaps with this template
                // If so, don't show the template (Actual shift overrides template)
                const hasOverlap = dayItems.some(item => 
                  item.type === 'shift' && 
                  item.trainerId === t.trainer_id && 
                  (start < item.end && end > item.start)
                )

                if (!hasOverlap) {
                  dayItems.push({
                    id: `template-${t.id}-${day.toISOString()}`, // Unique ID for this day instance
                    trainerId: t.trainer_id,
                    start,
                    end,
                    type: 'template',
                    data: t
                  })
                }
              })

            // Sort items
            dayItems.sort((a, b) => a.start.getTime() - b.start.getTime())
            
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

                {/* Render Items */}
                {dayItems.map(item => {
                  let displayName = ''
                  let fullDisplayName = ''

                  // Resolve Trainer Name
                  if (item.type === 'shift') {
                    const shift = item.data as Shift
                    // Try embedded trainer first, then lookup
                    const rawName = shift.trainer?.full_name || trainers.find(t => t.id === item.trainerId)?.full_name
                    fullDisplayName = rawName || `ID:${item.trainerId}`
                    displayName = getSurname(rawName) || (rawName ? rawName : '(不明)')
                  } else {
                    // Template only has ID lookup
                    const trainer = trainers.find(t => t.id === item.trainerId)
                    const rawName = trainer?.full_name
                    fullDisplayName = rawName || `ID:${item.trainerId}`
                    displayName = getSurname(rawName) || (rawName ? rawName : '(不明)')
                  }

                  if (item.type === 'template') {
                    // Template (Fixed) Shift
                    const template = item.data as ShiftTemplate
                    const colors = getTrainerColor(template.trainer_id)
                    
                    return (
                      <div
                        key={item.id}
                        className={`absolute rounded ${colors.bg} border ${colors.border} hover:opacity-90 pointer-events-none shadow-sm flex items-center justify-center overflow-hidden`}
                        style={getItemStyle(item, dayItems)}
                      >
                         <div className="w-full text-center px-0.5">
                          <div className="text-[10px] text-black leading-tight break-words font-medium">
                            {displayName}
                          </div>
                          {/* 
                          <div className="text-[9px] text-gray-600 font-medium leading-tight">
                            (固定)
                          </div>
                          */}
                        </div>
                      </div>
                    )
                  } else {
                    // Actual Shift
                    const shift = item.data as Shift
                    const colors = getTrainerColor(shift.trainer_id)
                    const isSelected = selectedShiftIds.includes(shift.id)
                    
                    return (
                      <div
                        key={item.id}
                        className={`absolute rounded ${isSelected 
                          ? 'bg-orange-100 border-orange-400 ring-2 ring-orange-400 ring-opacity-50 z-20' 
                          : `${colors.bg} ${colors.border}`} border hover:opacity-90 cursor-pointer shadow-sm transition-all flex items-center justify-center overflow-hidden`}
                        style={getItemStyle(item, dayItems)}
                        onClick={(e) => handleShiftClick(e, shift)}
                        title={`${fullDisplayName}: ${format(item.start, 'HH:mm')} - ${format(item.end, 'HH:mm')}`}
                      >
                        <div className="w-full px-0.5 text-center">
                          <span className={`relative z-50 text-[10px] ${isSelected ? 'text-orange-900 font-medium' : 'text-black'} leading-tight break-words block`}>
                            {displayName}
                          </span>
                        </div>
                      </div>
                    )
                  }
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

      {/* Create Modal */}
      {createModalOpen && selectedDate && selectedTime !== null && (
        <ShiftCreateModal
          trainers={trainers}
          date={selectedDate}
          initialHour={selectedTime}
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false)
            setSelectedDate(null)
            setSelectedTime(null)
          }}
          onSave={onShiftCreate}
        />
      )}

      {/* Edit Modal */}
      {selectedShift && (
        <ShiftEditModal
          shift={selectedShift}
          trainerName={trainers.find(t => t.id === selectedShift.trainer_id)?.full_name || ''}
          isOpen={!!selectedShift}
          onClose={() => setSelectedShift(null)}
          onSave={onShiftUpdate}
          onDelete={onShiftDelete}
        />
      )}
    </div>
  )
}

function ShiftCreateModal({ trainers, date, initialHour, isOpen, onClose, onSave }: {
  trainers: Trainer[],
  date: Date,
  initialHour: number,
  isOpen: boolean,
  onClose: () => void,
  onSave: (trainerId: string, s: Date, e: Date) => Promise<void>
}) {
  const [trainerId, setTrainerId] = useState(trainers[0]?.id || '')
  const [startTime, setStartTime] = useState(`${initialHour.toString().padStart(2, '0')}:00`)
  const [endTime, setEndTime] = useState(`${(initialHour + 1).toString().padStart(2, '0')}:00`)
  const [loading, setLoading] = useState(false)
  const timeOptions = generateTimeOptions()

  const handleSave = async () => {
    if (!trainerId) {
      alert('トレーナーを選択してください')
      return
    }
    setLoading(true)
    try {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      
      const newStart = setMinutes(setHours(date, sh), sm)
      const newEnd = setMinutes(setHours(date, eh), em)
      
      if (isAfter(newStart, newEnd) || newStart.getTime() === newEnd.getTime()) {
        alert('終了時間は開始時間より後に設定してください')
        setLoading(false)
        return
      }

      await onSave(trainerId, newStart, newEnd)
      onClose()
    } catch (e) {
      console.error(e)
      alert('保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-80">
        <h3 className="text-lg font-medium mb-1">シフト追加</h3>
        <p className="text-sm text-gray-500 mb-4">{format(date, 'yyyy/MM/dd (E)', { locale: ja })}</p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">トレーナー</label>
            <select
              className="w-full border rounded p-2"
              value={trainerId}
              onChange={e => setTrainerId(e.target.value)}
            >
              {trainers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">開始</label>
            <select
              className="w-full border rounded p-2"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`create-start-${t}`} value={t}>{t}</option>
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
                <option key={`create-end-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
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
  )
}

function ShiftEditModal({ shift, trainerName, isOpen, onClose, onSave, onDelete }: { 
  shift: Shift, 
  trainerName: string,
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (id: string, s: Date, e: Date) => Promise<void>,
  onDelete: (id: string) => Promise<void>
}) {
  const [startTime, setStartTime] = useState(format(parseISO(shift.start_time), 'HH:mm'))
  const [endTime, setEndTime] = useState(format(parseISO(shift.end_time), 'HH:mm'))
  const [loading, setLoading] = useState(false)
  const timeOptions = generateTimeOptions()

  const handleSave = async () => {
    setLoading(true)
    try {
      const baseDate = parseISO(shift.start_time)
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      
      const newStart = setMinutes(setHours(baseDate, sh), sm)
      const newEnd = setMinutes(setHours(baseDate, eh), em)
      
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
        <h3 className="text-lg font-medium mb-1">シフト編集</h3>
        <p className="text-sm text-gray-500 mb-1">{trainerName}</p>
        <p className="text-sm text-gray-500 mb-4">{format(parseISO(shift.start_time), 'yyyy/MM/dd (E)', { locale: ja })}</p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">開始</label>
            <select
              className="w-full border rounded p-2"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`edit-start-${t}`} value={t}>{t}</option>
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
                <option key={`edit-end-${t}`} value={t}>{t}</option>
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
