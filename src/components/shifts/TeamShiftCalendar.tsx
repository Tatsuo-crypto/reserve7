'use client'

import { useState, useRef } from 'react'
import { format, isSameDay, setHours, setMinutes, parseISO, differenceInMinutes, isAfter, parse, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, Trainer, ShiftTemplate, ShiftTemplateException } from '@/types'
import Button from '@/components/ui/Button'

interface TeamShiftCalendarProps {
  currentDate: Date
  trainers: Trainer[]
  shifts: Shift[]
  templates?: ShiftTemplate[]
  templateExceptions?: ShiftTemplateException[]
  onShiftCreate: (trainerId: string, start: Date, end: Date) => Promise<void>
  onShiftUpdate: (shiftId: string, start: Date, end: Date) => Promise<void>
  onShiftDelete: (shiftId: string) => Promise<void>
  onTemplateDelete?: (trainerId: string, templateId: string | null, date: Date, startTime: string, endTime: string) => Promise<void>
  loading?: boolean
  selectionMode?: boolean
  selectedShiftIds?: string[]
  onShiftSelect?: (shiftId: string) => void
}

// Generate time options (10 min intervals)
const generateTimeOptions = () => {
  const options = []
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0')
    for (let minute = 0; minute < 60; minute += 10) {
      options.push(`${hour}:${minute.toString().padStart(2, '0')}`)
    }
  }
  return options
}

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
  templateExceptions = [],
  onShiftCreate, 
  onShiftUpdate, 
  onShiftDelete, 
  onTemplateDelete,
  loading,
  selectionMode = false,
  selectedShiftIds = [],
  onShiftSelect
}: TeamShiftCalendarProps) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [templateShiftDraft, setTemplateShiftDraft] = useState<{ trainerId: string; templateId: string; start: Date; end: Date; startTime: string; endTime: string } | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [selectedTrainerForCreate, setSelectedTrainerForCreate] = useState<string>('')
  
  const containerRef = useRef<HTMLDivElement>(null)

  // Calendar constants
  const START_HOUR = 9
  const END_HOUR = 23
  const HOUR_HEIGHT = 40 // px per hour
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const selectedDay = currentDate

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

  const handleTimeSlotClick = (day: Date, hour: number, trainerId: string) => {
    setSelectedDate(day)
    setSelectedTime(hour)
    setSelectedTrainerForCreate(trainerId)
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

  const handleTemplateClick = (e: React.MouseEvent, item: CalendarItem) => {
    e.stopPropagation()
    if (selectionMode) return
    const template = item.data as ShiftTemplate
    setTemplateShiftDraft({
      trainerId: item.trainerId,
      templateId: template.id,
      start: item.start,
      end: item.end,
      startTime: template.start_time,
      endTime: template.end_time
    })
  }

  const isTemplateDeleted = (template: ShiftTemplate, date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const templateStart = template.start_time.slice(0, 8)
    const templateEnd = template.end_time.slice(0, 8)

    return templateExceptions.some(exception => (
      exception.trainer_id === template.trainer_id &&
      exception.work_date === dateKey &&
      (exception.template_id ? exception.template_id === template.id : true) &&
      exception.start_time.slice(0, 8) === templateStart &&
      exception.end_time.slice(0, 8) === templateEnd
    ))
  }

  const buildTrainerItems = (trainerId: string) => {
    const trainerItems: CalendarItem[] = []

    shifts
      .filter(s => s.trainer_id === trainerId && isSameDay(parseISO(s.start_time), selectedDay))
      .forEach(s => {
        trainerItems.push({
          id: s.id,
          trainerId: s.trainer_id,
          start: parseISO(s.start_time),
          end: parseISO(s.end_time),
          type: 'shift',
          data: s
        })
      })

    templates
      .filter(t => t.trainer_id === trainerId && t.day_of_week === getDay(selectedDay) && !isTemplateDeleted(t, selectedDay))
      .forEach(t => {
        const start = parse(t.start_time, 'HH:mm:ss', selectedDay)
        const end = parse(t.end_time, 'HH:mm:ss', selectedDay)
        const hasOverlap = trainerItems.some(item => start < item.end && end > item.start)

        if (!hasOverlap) {
          trainerItems.push({
            id: `template-${t.id}-${trainerId}-${selectedDay.toISOString()}`,
            trainerId: t.trainer_id,
            start,
            end,
            type: 'template',
            data: t
          })
        }
      })

    return trainerItems.sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  return (
    <div className="flex h-[calc(100vh-250px)] min-h-[600px] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface-raised">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-full border-b border-border-strong bg-surface-base"
          style={{ gridTemplateColumns: `56px repeat(${Math.max(trainers.length, 1)}, minmax(96px, 1fr))` }}
        >
          <div className="sticky left-0 z-20 border-r border-border-strong bg-surface-base p-2 text-center text-xs font-normal text-text-secondary">
            時間
          </div>
          {trainers.map(trainer => (
            <div key={trainer.id} className="border-r border-border-strong p-2 text-center last:border-r-0">
              <div className="truncate text-sm font-normal text-text-primary">{getSurname(trainer.full_name)}</div>
            </div>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-auto">
        <div
          className="grid min-w-full"
          style={{ gridTemplateColumns: `56px repeat(${Math.max(trainers.length, 1)}, minmax(96px, 1fr))` }}
        >
          
          <div className="border-r border-border-strong bg-surface-raised sticky left-0 z-10 w-full">
            {hours.map(hour => (
              <div key={hour} className="h-[40px] border-b border-border-subtle text-xs text-text-muted text-center relative">
                <span className="absolute top-1 left-0 right-0">{hour}:00</span>
              </div>
            ))}
          </div>

          {trainers.map(trainer => {
            const trainerItems = buildTrainerItems(trainer.id)
            
            return (
              <div key={trainer.id} className="relative border-r border-border-strong last:border-r-0 bg-surface-raised group">
                {hours.map(hour => (
                  <div 
                    key={`${trainer.id}-${hour}`} 
                    className="h-[40px] border-b border-border-subtle hover:bg-surface-base cursor-pointer"
                    onClick={() => handleTimeSlotClick(selectedDay, hour, trainer.id)}
                  />
                ))}

                {trainerItems.map(item => {
                  const displayTime = `${format(item.start, 'H:mm')}〜${format(item.end, 'H:mm')}`
                  if (item.type === 'template') {
                    return (
                      <div
                        key={item.id}
                        className="absolute inset-x-1 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border-l-2 border-sky-400 bg-surface-overlay/80 shadow-sm hover:bg-surface-overlay"
                        style={getItemStyle(item, trainerItems)}
                        onClick={(e) => handleTemplateClick(e, item)}
                      >
                        <span className="px-1 text-center text-xs leading-tight text-sky-200">{displayTime}</span>
                      </div>
                    )
                  } else {
                    const shift = item.data as Shift
                    const isSelected = selectedShiftIds.includes(shift.id)
                    
                    return (
                      <div
                        key={item.id}
                        className={`absolute inset-x-1 cursor-pointer overflow-hidden rounded-lg border-l-2 shadow-sm transition-all flex items-center justify-center ${
                          isSelected
                            ? 'border-brand-400 bg-brand-500/25 ring-2 ring-brand-400/70'
                            : 'border-brand-500 bg-surface-overlay hover:bg-brand-500/15'
                        }`}
                        style={getItemStyle(item, trainerItems)}
                        onClick={(e) => handleShiftClick(e, shift)}
                        title={`${trainer.full_name}: ${format(item.start, 'HH:mm')} - ${format(item.end, 'HH:mm')}`}
                      >
                        <span className={`px-1 text-center text-xs leading-tight ${isSelected ? 'text-brand-100' : 'text-text-primary'}`}>
                          {displayTime}
                        </span>
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
        <div className="absolute inset-0 bg-surface-raised bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      )}

      {/* Create Modal */}
      {createModalOpen && selectedDate && selectedTime !== null && (
        <ShiftCreateModal
          trainers={trainers}
          date={selectedDate}
          initialHour={selectedTime}
          initialTrainerId={selectedTrainerForCreate}
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false)
            setSelectedDate(null)
            setSelectedTime(null)
            setSelectedTrainerForCreate('')
          }}
          onSave={onShiftCreate}
        />
      )}

      {templateShiftDraft && (
        <TemplateShiftCreateModal
          trainerName={trainers.find(t => t.id === templateShiftDraft.trainerId)?.full_name || ''}
          start={templateShiftDraft.start}
          end={templateShiftDraft.end}
          isOpen={!!templateShiftDraft}
          onClose={() => setTemplateShiftDraft(null)}
          onSave={async (start, end) => {
            await onShiftCreate(templateShiftDraft.trainerId, start, end)
            setTemplateShiftDraft(null)
          }}
          onDelete={onTemplateDelete ? async () => {
            await onTemplateDelete(
              templateShiftDraft.trainerId,
              templateShiftDraft.templateId,
              templateShiftDraft.start,
              templateShiftDraft.startTime,
              templateShiftDraft.endTime
            )
            setTemplateShiftDraft(null)
          } : undefined}
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

function ShiftCreateModal({ trainers, date, initialHour, initialTrainerId, isOpen, onClose, onSave }: {
  trainers: Trainer[],
  date: Date,
  initialHour: number,
  initialTrainerId?: string,
  isOpen: boolean,
  onClose: () => void,
  onSave: (trainerId: string, s: Date, e: Date) => Promise<void>
}) {
  const [trainerId, setTrainerId] = useState(initialTrainerId || trainers[0]?.id || '')
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
      alert('保存できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
      <div className="bg-surface-raised rounded-lg shadow-xl p-6 w-80">
        <h3 className="text-xl font-semibold mb-1">シフト追加</h3>
        <p className="text-sm text-text-secondary mb-4">{format(date, 'yyyy/MM/dd (E)', { locale: ja })}</p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-text-secondary mb-1">トレーナー</label>
            <select
              className="w-full border rounded-lg p-2"
              value={trainerId}
              onChange={e => setTrainerId(e.target.value)}
            >
              {trainers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">開始</label>
            <select
              className="w-full border rounded-lg p-2"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`create-start-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">終了</label>
            <select
              className="w-full border rounded-lg p-2"
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
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="px-3 py-2 text-text-secondary text-sm hover:bg-surface-overlay rounded-lg"
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            className="px-3 py-2 bg-brand-700 text-white text-sm rounded-lg hover:bg-brand-800"
            disabled={loading}
          >
            保存
          </Button>
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
      alert('保存できませんでした。もう一度お試しください。')
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
      alert('削除できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
      <div className="bg-surface-raised rounded-lg shadow-xl p-6 w-80">
        <h3 className="text-xl font-semibold mb-1">シフト編集</h3>
        <p className="text-sm text-text-secondary mb-1">{trainerName}</p>
        <p className="text-sm text-text-secondary mb-4">{format(parseISO(shift.start_time), 'yyyy/MM/dd (E)', { locale: ja })}</p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-text-secondary mb-1">開始</label>
            <select
              className="w-full border rounded-lg p-2"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`edit-start-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">終了</label>
            <select
              className="w-full border rounded-lg p-2"
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
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            className="px-3 py-2 text-red-400 text-sm hover:bg-red-500/25 rounded-lg"
            disabled={loading}
          >
            削除
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="px-3 py-2 text-text-secondary text-sm hover:bg-surface-overlay rounded-lg"
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              className="px-3 py-2 bg-brand-700 text-white text-sm rounded-lg hover:bg-brand-800"
              disabled={loading}
            >
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateShiftCreateModal({ trainerName, start, end, isOpen, onClose, onSave, onDelete }: {
  trainerName: string,
  start: Date,
  end: Date,
  isOpen: boolean,
  onClose: () => void,
  onSave: (s: Date, e: Date) => Promise<void>,
  onDelete?: () => Promise<void>
}) {
  const [startTime, setStartTime] = useState(format(start, 'HH:mm'))
  const [endTime, setEndTime] = useState(format(end, 'HH:mm'))
  const [loading, setLoading] = useState(false)
  const timeOptions = generateTimeOptions()

  const handleSave = async () => {
    setLoading(true)
    try {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      const newStart = setMinutes(setHours(start, sh), sm)
      const newEnd = setMinutes(setHours(start, eh), em)

      if (isAfter(newStart, newEnd) || newStart.getTime() === newEnd.getTime()) {
        alert('終了時間は開始時間より後に設定してください')
        setLoading(false)
        return
      }

      await onSave(newStart, newEnd)
      onClose()
    } catch (e) {
      console.error(e)
      alert('保存できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm('この日のシフトを削除しますか？')) return
    setLoading(true)
    try {
      await onDelete()
    } catch (e) {
      console.error(e)
      alert('削除できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
      <div className="bg-surface-raised rounded-lg shadow-xl p-6 w-80">
        <h3 className="text-xl font-semibold mb-1">シフト変更</h3>
        <p className="text-sm text-text-secondary mb-1">{trainerName}</p>
        <p className="text-sm text-text-secondary mb-4">{format(start, 'yyyy/MM/dd (E)', { locale: ja })}</p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-text-secondary mb-1">開始</label>
            <select
              className="w-full border rounded-lg p-2"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`template-team-start-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">終了</label>
            <select
              className="w-full border rounded-lg p-2"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
            >
              {timeOptions.map(t => (
                <option key={`template-team-end-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="px-3 py-2 text-red-400 text-sm hover:bg-red-500/25 rounded-lg"
              disabled={loading}
            >
              削除
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="px-3 py-2 text-text-secondary text-sm hover:bg-surface-overlay rounded-lg"
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              className="px-3 py-2 bg-brand-700 text-white text-sm rounded-lg hover:bg-brand-800"
              disabled={loading}
            >
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
