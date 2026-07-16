'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths, setHours, setMinutes, isAfter, isSameDay, differenceInMinutes, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, Trainer, ShiftTemplate, ShiftTemplateException } from '@/types'
import ShiftCalendar from '@/components/shifts/ShiftCalendar'
import TeamShiftCalendar from '@/components/shifts/TeamShiftCalendar'
import TemplateModal from '@/components/shifts/TemplateModal'
import Icon from '@/components/ui/icons'
import AppModal from '@/components/ui/AppModal'

function formatHoursLabel(hours: number) {
  const rounded = Math.round(hours * 100) / 100
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}h`
}

const WEEKDAY_LABELS_BY_DAY = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_LABELS_MONDAY_START = ['月', '火', '水', '木', '金', '土', '日']

function getMonthCalendarDays(monthDate: Date) {
  const firstDay = startOfMonth(monthDate)
  const lastDay = endOfMonth(monthDate)
  const cells: (Date | null)[] = []
  const leadingEmptyCount = (firstDay.getDay() + 6) % 7

  for (let i = 0; i < leadingEmptyCount; i += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), day))
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

function getShiftHours(start: Date, end: Date) {
  return Math.max(0, differenceInMinutes(end, start) / 60)
}

function getTrainerLabel(trainer?: Trainer) {
  return trainer?.full_name || trainer?.name || 'スタッフ'
}

function getShortTrainerLabel(trainer?: Trainer) {
  const name = getTrainerLabel(trainer)
  return name.trim().split(/[\s　]+/)[0] || name
}

function formatTemplateRange(template: ShiftTemplate) {
  return `${template.start_time.slice(0, 5)}〜${template.end_time.slice(0, 5)}`
}

function getMondayStartDayOrder(dayOfWeek: number) {
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1
}

function formatDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value.slice(0, 8)
}

function isTemplateException(
  exception: ShiftTemplateException,
  template: ShiftTemplate,
  date: Date
) {
  return (
    exception.trainer_id === template.trainer_id &&
    exception.work_date === formatDateKey(date) &&
    (exception.template_id ? exception.template_id === template.id : true) &&
    normalizeTime(exception.start_time) === normalizeTime(template.start_time) &&
    normalizeTime(exception.end_time) === normalizeTime(template.end_time)
  )
}

function FixedShiftOverview({
  trainers,
  templates,
  onEdit
}: {
  trainers: Trainer[]
  templates: ShiftTemplate[]
  onEdit: (trainerId: string) => void
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-brand-500" />
          <h2 className="text-base font-semibold text-text-primary">固定シフト</h2>
        </div>
        <span className="rounded-full bg-surface-base px-3 py-1 text-xs tabular-nums text-text-secondary">
          {templates.length}件
        </span>
      </div>

      <div className="space-y-2">
        {trainers.length > 0 ? trainers.map(trainer => {
          const trainerTemplates = templates
            .filter(template => template.trainer_id === trainer.id)
            .sort((a, b) => (
              getMondayStartDayOrder(a.day_of_week) - getMondayStartDayOrder(b.day_of_week) ||
              a.start_time.localeCompare(b.start_time)
            ))

          return (
            <div key={trainer.id} className="rounded-2xl border border-border-subtle bg-surface-base px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-text-primary">{getTrainerLabel(trainer)}</p>
                <button
                  type="button"
                  onClick={() => onEdit(trainer.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-200 active:scale-95"
                  aria-label={`${getTrainerLabel(trainer)}の固定シフトを編集`}
                >
                  <Icon name="pencil" size={17} />
                </button>
              </div>

              <div className="space-y-2">
                {trainerTemplates.length > 0 ? trainerTemplates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between rounded-xl border border-brand-500/20 bg-brand-500/10 px-3 py-2"
                  >
                    <span className="text-sm text-brand-100">{WEEKDAY_LABELS_BY_DAY[template.day_of_week]}</span>
                    <span className="text-sm tabular-nums text-text-primary">{formatTemplateRange(template)}</span>
                  </div>
                )) : (
                  <span className="text-sm text-text-muted">未設定</span>
                )}
              </div>
            </div>
          )
        }) : (
          <div className="rounded-2xl bg-surface-base p-6 text-center text-sm text-text-secondary">
            対象トレーナーがいません
          </div>
        )}
      </div>
    </section>
  )
}

function OverallCalendarSection({
  currentDate,
  selectedDate,
  shifts,
  templates,
  templateExceptions,
  trainers,
  selectedTrainerId,
  viewMode,
  onDaySelect,
  onPrevMonth,
  onNextMonth,
  onToday,
  actions,
  children
}: {
  currentDate: Date
  selectedDate: Date | null
  shifts: Shift[]
  templates: ShiftTemplate[]
  templateExceptions: ShiftTemplateException[]
  trainers: Trainer[]
  selectedTrainerId: string
  viewMode: 'individual' | 'team'
  onDaySelect: (day: Date) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  const days = getMonthCalendarDays(currentDate)
  const selectedWeekStart = selectedDate ? startOfWeek(selectedDate, { weekStartsOn: 1 }) : null
  const selectedWeekEnd = selectedWeekStart ? addDays(selectedWeekStart, 6) : null
  const weekLabel = selectedWeekStart && selectedWeekEnd
    ? `${format(selectedWeekStart, 'M/d', { locale: ja })}〜${format(selectedWeekEnd, 'M/d', { locale: ja })}`
    : ''
  const weekRows = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7))
  const trainerIds = viewMode === 'individual'
    ? (selectedTrainerId ? [selectedTrainerId] : [])
    : trainers.map(trainer => trainer.id)

  const getDayHours = (day: Date) => {
    const dayShifts = shifts.filter(shift => trainerIds.includes(shift.trainer_id) && isSameDay(new Date(shift.start_time), day))
    const dayTemplates = templates.filter(template => (
      trainerIds.includes(template.trainer_id) &&
      template.day_of_week === getDay(day) &&
      !templateExceptions.some(exception => isTemplateException(exception, template, day))
    ))

    const shiftHours = dayShifts.reduce((sum, shift) => (
      sum + getShiftHours(new Date(shift.start_time), new Date(shift.end_time))
    ), 0)

    const templateHours = dayTemplates.reduce((sum, template) => {
      const start = setMinutes(setHours(day, Number(template.start_time.slice(0, 2))), Number(template.start_time.slice(3, 5)))
      const end = setMinutes(setHours(day, Number(template.end_time.slice(0, 2))), Number(template.end_time.slice(3, 5)))
      const hasOverlap = dayShifts.some(shift => {
        const shiftStart = new Date(shift.start_time)
        const shiftEnd = new Date(shift.end_time)
        return start < shiftEnd && end > shiftStart
      })
      return hasOverlap ? sum : sum + getShiftHours(start, end)
    }, 0)

    return shiftHours + templateHours
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-brand-500" />
          <h2 className="text-base font-semibold text-text-primary">全体カレンダー</h2>
        </div>
        <div className="flex items-center gap-2">
          {weekLabel && <span className="rounded-full bg-surface-base px-3 py-1 text-xs tabular-nums text-text-secondary">{weekLabel}</span>}
          {actions}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={onPrevMonth} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-base text-text-secondary active:scale-95">
            <Icon name="chevronLeft" size={18} />
          </button>
          <div className="text-center">
            <p className="text-lg font-semibold tabular-nums text-text-primary">{format(currentDate, 'yyyy年M月', { locale: ja })}</p>
            <button type="button" onClick={onToday} className="mt-1 rounded-full bg-surface-base px-3 py-1 text-xs text-text-secondary">
              今日
            </button>
          </div>
          <button type="button" onClick={onNextMonth} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-base text-text-secondary active:scale-95">
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-base p-3">
          <div className="mb-2 grid grid-cols-7 text-center text-[10px] text-text-muted">
            {WEEKDAY_LABELS_MONDAY_START.map(day => <div key={day}>{day}</div>)}
          </div>
          <div className="space-y-1">
            {weekRows.map((row, rowIndex) => {
              const rowSelected = Boolean(selectedWeekStart && row.some(day => day && isSameDay(startOfWeek(day, { weekStartsOn: 1 }), selectedWeekStart)))

              return (
                <div
                  key={`week-row-${rowIndex}`}
                  className={`grid grid-cols-7 gap-1 rounded-2xl border p-1 transition ${
                    rowSelected
                      ? 'border-brand-500/75 bg-brand-500/10 shadow-[0_0_0_1px_rgba(249,115,22,0.18)]'
                      : 'border-transparent'
                  }`}
                >
                  {row.map((day, index) => {
                    if (!day) return <div key={`empty-${rowIndex}-${index}`} className="min-h-12 rounded-lg" />

                    const hours = getDayHours(day)
                    const hasWork = hours > 0

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => onDaySelect(day)}
                        disabled={viewMode === 'individual' && !selectedTrainerId}
                        className={`min-h-12 rounded-xl border px-1 py-1 text-center transition active:scale-[0.98] disabled:opacity-40 ${
                          hasWork
                            ? 'border-brand-500/25 bg-brand-500/12'
                            : rowSelected
                              ? 'border-transparent bg-surface-base/80'
                              : 'border-transparent bg-surface-raised/45 hover:bg-surface-overlay'
                        }`}
                      >
                        <div className={`text-xs tabular-nums ${hasWork || rowSelected ? 'text-text-primary' : 'text-text-muted'}`}>
                          {day.getDate()}
                        </div>
                        {hasWork && (
                          <div className="mt-1 truncate text-[10px] tabular-nums text-brand-100">
                            {formatHoursLabel(hours)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {children && (
        <div className="border-t border-border-subtle">
          {children}
        </div>
      )}
    </section>
  )
}

export default function ShiftManagementPage() {
  // Force rebuild to fix ReferenceError
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // State
  const [viewMode, setViewMode] = useState<'individual' | 'team'>('individual')
  const [allTrainers, setAllTrainers] = useState<Trainer[]>([])
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [templateExceptions, setTemplateExceptions] = useState<ShiftTemplateException[]>([])
  const [loading, setLoading] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateTrainerId, setTemplateTrainerId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createDate, setCreateDate] = useState<Date | null>(null)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [currentStoreId, setCurrentStoreId] = useState<string>('')
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([])

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/dashboard')
  }, [status, session, router])

  // Handle Store Switcher
  useEffect(() => {
    const updateStoreFromCookie = () => {
      const match = document.cookie.match(/(^|;)\s*admin_store_preference=([^;]+)/)
      const storeId = match ? match[2] : ''
      setCurrentStoreId(storeId)
      console.log('Store updated from cookie:', storeId)
    }

    updateStoreFromCookie()

    const handleStoreChange = () => {
      console.log('Store change event received')
      updateStoreFromCookie()
    }

    window.addEventListener('storeChange', handleStoreChange)
    return () => window.removeEventListener('storeChange', handleStoreChange)
  }, [])

  // Fetch all active trainers on mount
  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const timestamp = new Date().getTime()
        const res = await fetch(`/api/admin/trainers?status=active&_t=${timestamp}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setAllTrainers(data.trainers || [])
          console.log('Fetched all trainers:', data.trainers?.length)
        }
      } catch (e) {
        console.error('Failed to fetch trainers', e)
      }
    }
    if (status === 'authenticated') fetchTrainers()
  }, [status])

  // Filter trainers based on current store
  const filteredTrainers = useMemo(() => allTrainers.filter(t => {
    // If currentStoreId is empty or 'all', show all trainers (or maybe just show none/default?)
    // Usually for admin, if no store selected, maybe show all.
    // But if we want strictly store-based, we should filter.
    if (!currentStoreId || currentStoreId === 'all') return true
    return t.store_id === currentStoreId
  }), [allTrainers, currentStoreId])

  const selectableTrainers = filteredTrainers.length > 0 ? filteredTrainers : allTrainers

  // Auto-select first trainer if selection becomes invalid or empty
  useEffect(() => {
    // Determine the effective storeId (cookie or fallback to first trainer's store if no cookie)
    // Actually, if we use filteredTrainers, we implicitly respect the store.
    
    if (selectableTrainers.length > 0) {
      const isSelectedValid = selectableTrainers.some(t => t.id === selectedTrainerId)
      if (!isSelectedValid) {
        setSelectedTrainerId(selectableTrainers[0].id)
      }
    } else {
      if (selectedTrainerId) {
        setSelectedTrainerId('')
      }
    }
  }, [selectableTrainers, selectedTrainerId])

  // Fetch templates and shifts
  // Combined effect to avoid race conditions or redundant fetches
  useEffect(() => {
    let isCancelled = false

    const fetchData = async () => {
      // Determine effective storeId
      const storeId = (currentStoreId && currentStoreId !== 'all') 
        ? currentStoreId 
        : ((session?.user as any)?.storeId || allTrainers[0]?.store_id)
      
      // If we are in individual mode but no trainer selected (and we have trainers), wait for auto-select
      if (viewMode === 'individual' && !selectedTrainerId && selectableTrainers.length > 0) {
        return
      }

      setLoading(true)
      // Clear data immediately to prevent displaying stale data from previous trainer/week
      setShifts([])
      setTemplates([])
      setTemplateExceptions([])

      try {
        const start = startOfMonth(currentDate)
        const end = endOfMonth(currentDate)
        const timestamp = new Date().getTime()
        
        // 1. Fetch Templates
        let templatesUrl = ''
        if (viewMode === 'individual' && selectedTrainerId) {
          templatesUrl = `/api/admin/shifts/templates?trainerId=${selectedTrainerId}&_t=${timestamp}`
        } else if (viewMode === 'team' && storeId) {
          templatesUrl = `/api/admin/shifts/templates?storeId=${storeId}&_t=${timestamp}`
        }
        
        if (templatesUrl) {
          const tRes = await fetch(templatesUrl, { cache: 'no-store' })
          if (tRes.ok && !isCancelled) {
            const tData = await tRes.json()
            setTemplates(tData.templates || [])
          }
        }

        // 2. Fetch Shifts
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
          _t: timestamp.toString()
        })

        let shouldFetchShifts = false
        if (viewMode === 'individual' && selectedTrainerId) {
          params.set('trainerId', selectedTrainerId)
          shouldFetchShifts = true
        } else if (storeId) {
          params.set('storeId', storeId)
          shouldFetchShifts = true
        }

        if (shouldFetchShifts) {
          const sRes = await fetch(`/api/admin/shifts?${params}`, { cache: 'no-store' })
          if (sRes.ok && !isCancelled) {
            const sData = await sRes.json()
            setShifts(sData.shifts || [])
          }

          const eRes = await fetch(`/api/admin/shifts/template-exceptions?${params}`, { cache: 'no-store' })
          if (eRes.ok && !isCancelled) {
            const eData = await eRes.json()
            setTemplateExceptions(eData.exceptions || [])
          }
        }

      } catch (e) {
        console.error('Failed to fetch data', e)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    // Only run if we have basic data loaded
    if (status === 'authenticated' && (allTrainers.length > 0 || (currentStoreId && currentStoreId !== 'all'))) {
      fetchData()
    }

    return () => {
      isCancelled = true
    }
  }, [selectedTrainerId, currentDate, viewMode, allTrainers, session, currentStoreId, selectableTrainers.length])

  // Handlers
  const handlePrevPeriod = () => setCurrentDate(subDays(currentDate, viewMode === 'team' ? 1 : 7))
  const handleNextPeriod = () => setCurrentDate(addDays(currentDate, viewMode === 'team' ? 1 : 7))
  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedWeekDate(today)
  }

  const refreshShifts = async () => {
    // Clear selection on refresh
    setSelectedShiftIds([])
    
    const storeId = (currentStoreId && currentStoreId !== 'all')
      ? currentStoreId
      : ((session?.user as any)?.storeId || allTrainers[0]?.store_id)
      
    setLoading(true)
    try {
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      const timestamp = new Date().getTime()
      
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        _t: timestamp.toString()
      })

      let shouldFetch = false
      if (viewMode === 'individual' && selectedTrainerId) {
        params.set('trainerId', selectedTrainerId)
        shouldFetch = true
      } else if (storeId) {
        params.set('storeId', storeId)
        shouldFetch = true
      }

      const templatesParams = new URLSearchParams({ _t: timestamp.toString() })
      let templatesUrl = ''
      if (viewMode === 'individual' && selectedTrainerId) {
        templatesParams.set('trainerId', selectedTrainerId)
        templatesUrl = `/api/admin/shifts/templates?${templatesParams}`
      } else if (storeId) {
        templatesParams.set('storeId', storeId)
        templatesUrl = `/api/admin/shifts/templates?${templatesParams}`
      }

      const [shiftsRes, templatesRes, exceptionsRes] = await Promise.all([
        shouldFetch ? fetch(`/api/admin/shifts?${params}`, { cache: 'no-store' }) : Promise.resolve(null),
        templatesUrl ? fetch(templatesUrl, { cache: 'no-store' }) : Promise.resolve(null),
        shouldFetch ? fetch(`/api/admin/shifts/template-exceptions?${params}`, { cache: 'no-store' }) : Promise.resolve(null)
      ])

      if (shiftsRes?.ok) {
        const data = await shiftsRes.json()
        setShifts(data.shifts || [])
      }

      if (templatesRes?.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates || [])
      }

      if (exceptionsRes?.ok) {
        const data = await exceptionsRes.json()
        setTemplateExceptions(data.exceptions || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPrevWeek = async () => {
    if (!selectedTrainerId) return

    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      const prevStart = subDays(start, 7)

      const res = await fetch('/api/admin/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy_previous_week',
          trainerId: selectedTrainerId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          sourceStartDate: prevStart.toISOString()
        })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`${data.count}件のシフトをコピーしました`)
        refreshShifts()
      } else {
        const err = await res.json()
        alert(`コピーに失敗しました: ${err.message || '不明なエラー'}`)
      }
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyTemplates = async () => {
    if (!selectedTrainerId) return
    if (!confirm('現在の週に固定シフトを反映しますか？\n※現在登録されているシフトは上書きされます。')) return

    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })

      const res = await fetch('/api/admin/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_from_templates',
          trainerId: selectedTrainerId,
          startDate: start.toISOString(),
          endDate: end.toISOString()
        })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`${data.count}件のシフトを作成しました`)
        refreshShifts()
      } else {
        const err = await res.json()
        alert(`反映に失敗しました: ${err.message || '不明なエラー'}`)
      }
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // Selection Handlers
  const handleShiftSelect = (shiftId: string) => {
    setSelectedShiftIds(prev => {
      if (prev.includes(shiftId)) {
        return prev.filter(id => id !== shiftId)
      } else {
        return [...prev, shiftId]
      }
    })
  }

  const handleBulkDelete = async () => {
    if (selectedShiftIds.length === 0) return
    if (!confirm(`${selectedShiftIds.length}件のシフトを削除しますか？`)) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_delete',
          trainerId: viewMode === 'individual' ? selectedTrainerId : undefined, // Only restrict to trainer in individual mode
          shiftIds: selectedShiftIds
        })
      })

      if (res.ok) {
        // const data = await res.json()
        // alert(`${data.count}件のシフトを削除しました`)
        setSelectedShiftIds([])
        setSelectionMode(false)
        refreshShifts()
      } else {
        const err = await res.json()
        alert(`削除に失敗しました: ${err.message || '不明なエラー'}`)
      }
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // CRUD Operations passed to Calendar
  const handleShiftCreate = async (trainerId: string, start: Date, end: Date) => {
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: trainerId,
          startTime: start.toISOString(),
          endTime: end.toISOString()
        })
      })
      if (res.ok) refreshShifts()
    } catch (e) {
      console.error(e)
      alert('作成に失敗しました')
    }
  }

  const handleShiftUpdate = async (id: string, start: Date, end: Date) => {
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: start.toISOString(),
          endTime: end.toISOString()
        })
      })
      if (res.ok) refreshShifts()
    } catch (e) {
      console.error(e)
      alert('更新に失敗しました')
    }
  }

  const handleShiftDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) refreshShifts()
    } catch (e) {
      console.error(e)
      alert('削除に失敗しました')
    }
  }

  const handleTemplateOccurrenceDelete = async (
    trainerId: string,
    templateId: string | null,
    date: Date,
    startTime: string,
    endTime: string
  ) => {
    try {
      const res = await fetch('/api/admin/shifts/template-exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId,
          templateId,
          workDate: formatDateKey(date),
          startTime,
          endTime
        })
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error?.message || error?.error || 'Failed to delete template occurrence')
      }

      await refreshShifts()
    } catch (e) {
      console.error(e)
      alert('削除に失敗しました。マイグレーションが未適用の場合は、追加されたSQLを実行してください。')
    }
  }

  const handleShiftCreateFromCalendar = async (trainerId: string, start: Date, end: Date, weeklyFixed: boolean) => {
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId,
          startTime: start.toISOString(),
          endTime: end.toISOString()
        })
      })
      if (!res.ok) throw new Error('Failed to create shift')

      if (weeklyFixed) {
        const nextTemplates = templates
          .filter(template => template.trainer_id === trainerId && template.day_of_week !== getDay(start))
          .map(template => ({
            dayOfWeek: template.day_of_week,
            startTime: template.start_time.slice(0, 5),
            endTime: template.end_time.slice(0, 5)
          }))

        nextTemplates.push({
          dayOfWeek: getDay(start),
          startTime: format(start, 'HH:mm'),
          endTime: format(end, 'HH:mm')
        })

        const templateRes = await fetch('/api/admin/shifts/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trainerId,
            templates: nextTemplates
          })
        })

        if (!templateRes.ok) throw new Error('Failed to save template')
      }

      await refreshShifts()
    } catch (e) {
      console.error(e)
      alert('作成に失敗しました')
    }
  }

  if (status === 'loading') return <div className="p-8 text-center">読み込み中...</div>

  const selectedTrainer = selectableTrainers.find(t => t.id === selectedTrainerId)
  const activeWeekDate = selectedWeekDate || currentDate
  const weekStart = startOfWeek(activeWeekDate, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  const weekLabel = `${format(weekStart, 'M/d', { locale: ja })}〜${format(weekEnd, 'M/d', { locale: ja })}`
  const scheduleTrainers = viewMode === 'individual'
    ? (selectedTrainer ? [selectedTrainer] : [])
    : filteredTrainers

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-24 px-4 sm:px-6 lg:px-8 space-y-4">

      <section className="space-y-3">
        <div className="flex bg-surface-overlay p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`h-10 flex-1 rounded-lg text-sm font-normal transition-all ${
              viewMode === 'individual' 
                ? 'bg-surface-raised text-text-primary shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            個人
          </button>
          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={`h-10 flex-1 rounded-lg text-sm font-normal transition-all ${
              viewMode === 'team' 
                ? 'bg-surface-raised text-text-primary shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            店舗
          </button>
        </div>

        {viewMode === 'individual' && (
          <div>
            {selectableTrainers.length > 0 ? (
              <select
                value={selectedTrainerId}
                onChange={(event) => setSelectedTrainerId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-4 text-sm text-text-primary"
              >
                {selectableTrainers.map(trainer => (
                  <option key={trainer.id} value={trainer.id}>{getTrainerLabel(trainer)}</option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-border-subtle bg-surface-base px-4 py-4 text-center text-sm text-text-secondary">
                対象トレーナーがいません
              </div>
            )}
          </div>
        )}

        {viewMode === 'team' && (
          <div className="rounded-xl border border-border-subtle bg-surface-base px-4 py-3">
            <p className="text-sm text-text-primary">店舗全体 <span className="ml-2 text-xs text-text-secondary">{filteredTrainers.length}名</span></p>
          </div>
        )}
      </section>

      <FixedShiftOverview
        trainers={scheduleTrainers}
        templates={templates || []}
        onEdit={(trainerId) => {
          setTemplateTrainerId(trainerId)
          setTemplateModalOpen(true)
        }}
      />

      <OverallCalendarSection
        currentDate={currentDate}
        selectedDate={selectedWeekDate}
        shifts={shifts}
        templates={templates || []}
        templateExceptions={templateExceptions}
        trainers={scheduleTrainers}
        selectedTrainerId={selectedTrainerId}
        viewMode={viewMode}
        onDaySelect={(day) => {
          const weekStartDate = startOfWeek(day, { weekStartsOn: 1 })
          setCurrentDate(day)
          setSelectedWeekDate(weekStartDate)
        }}
        onPrevMonth={() => {
          setCurrentDate(subMonths(currentDate, 1))
          setSelectedWeekDate(null)
        }}
        onNextMonth={() => {
          setCurrentDate(addMonths(currentDate, 1))
          setSelectedWeekDate(null)
        }}
        onToday={handleToday}
        actions={
          selectedWeekDate ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setActionMenuOpen(prev => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-base text-text-secondary active:scale-95"
                aria-label="シフト操作"
              >
                <Icon name="ellipsisVertical" size={17} />
              </button>

              {actionMenuOpen && (
                <div className="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuOpen(false)
                      setSelectionMode(true)
                    }}
                    className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm text-text-primary hover:bg-surface-overlay disabled:opacity-40"
                    disabled={viewMode === 'individual' && !selectedTrainerId}
                  >
                    <Icon name="checkCircle" size={17} className="text-text-secondary" />
                    複数選択
                  </button>

                  {viewMode === 'individual' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen(false)
                          handleCopyPrevWeek()
                        }}
                        className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm text-text-primary hover:bg-surface-overlay disabled:opacity-40"
                        disabled={!selectedTrainerId || loading}
                      >
                        <Icon name="copy" size={17} className="text-text-secondary" />
                        先週からコピー
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen(false)
                          handleApplyTemplates()
                        }}
                        className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm text-text-primary hover:bg-surface-overlay disabled:opacity-40"
                        disabled={!selectedTrainerId || loading}
                      >
                        <Icon name="refresh" size={17} className="text-text-secondary" />
                        固定シフトを反映
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null
        }
      >
        {selectedWeekDate && (
          <>
            {selectionMode && (
              <div className="flex items-center justify-center gap-2 border-b border-border-subtle px-4 py-3">
                <span className="rounded-full bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{selectedShiftIds.length}件</span>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedShiftIds.length === 0 || loading}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-normal text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <Icon name="trash" size={16} className="mr-1.5" />
                  削除
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode(false)
                    setSelectedShiftIds([])
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-surface-base px-3 text-sm font-normal text-text-secondary active:scale-[0.98]"
                >
                  <Icon name="close" size={16} className="mr-1.5 text-text-secondary" />
                  キャンセル
                </button>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <p className="text-sm font-semibold text-text-primary">選択週のシフト</p>
              <span className="text-xs tabular-nums text-text-secondary">{weekLabel}</span>
            </div>

            {viewMode === 'individual' ? (
              selectedTrainerId ? (
                <ShiftCalendar
                  currentDate={selectedWeekDate}
                  shifts={shifts}
                  templates={templates || []}
                  templateExceptions={templateExceptions}
                  trainerName={selectableTrainers.find(t => t.id === selectedTrainerId)?.full_name || ''}
                  loading={loading}
                  onShiftCreate={(start, end) => handleShiftCreate(selectedTrainerId, start, end)}
                  onShiftUpdate={handleShiftUpdate}
                  onShiftDelete={handleShiftDelete}
                  onTemplateDelete={(templateId, date, startTime, endTime) => (
                    handleTemplateOccurrenceDelete(selectedTrainerId, templateId, date, startTime, endTime)
                  )}
                  selectionMode={selectionMode}
                  selectedShiftIds={selectedShiftIds}
                  onShiftSelect={handleShiftSelect}
                />
              ) : (
                <div className="flex h-64 items-center justify-center px-6 text-center">
                  <div>
                    <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-brand-500" />
                    <p className="text-sm text-text-secondary">トレーナーを選択してください</p>
                  </div>
                </div>
              )
            ) : (
              <TeamShiftCalendar
                currentDate={selectedWeekDate}
                trainers={filteredTrainers}
                shifts={shifts}
                templates={templates || []}
                templateExceptions={templateExceptions}
                loading={loading}
                onShiftCreate={handleShiftCreate}
                onShiftUpdate={handleShiftUpdate}
                onShiftDelete={handleShiftDelete}
                onTemplateDelete={handleTemplateOccurrenceDelete}
                selectionMode={selectionMode}
                selectedShiftIds={selectedShiftIds}
                onShiftSelect={handleShiftSelect}
              />
            )}
          </>
        )}
      </OverallCalendarSection>

      {selectedWeekDate && (
          <button
            type="button"
            onClick={() => {
              setCreateDate(selectedWeekDate)
              setCreateModalOpen(true)
            }}
            disabled={viewMode === 'individual' && !selectedTrainerId}
            className="sticky bottom-4 z-20 flex h-14 w-full items-center justify-center rounded-2xl bg-brand-600 text-base font-semibold text-white shadow-lg shadow-black/30 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="plus" size={20} className="mr-2" />
            シフトを追加
          </button>
      )}

      {/* Template Modal */}
      {(templateTrainerId || selectedTrainerId) && templateModalOpen && (
        <TemplateModal
          isOpen={templateModalOpen}
          onClose={() => {
            setTemplateModalOpen(false)
            setTemplateTrainerId(null)
          }}
          trainerId={templateTrainerId || selectedTrainerId}
          onSave={async () => {
            setTemplateModalOpen(false)
            setTemplateTrainerId(null)
            await refreshShifts()
          }}
        />
      )}

      {createModalOpen && (
        <ShiftQuickCreateModal
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false)
            setCreateDate(null)
          }}
          currentDate={createDate || currentDate}
          viewMode={viewMode}
          trainers={viewMode === 'individual' && selectedTrainer ? [selectedTrainer] : filteredTrainers}
          selectedTrainerId={selectedTrainerId}
          onSave={async (trainerId, start, end, weeklyFixed) => {
            await handleShiftCreateFromCalendar(trainerId, start, end, weeklyFixed)
            setCreateModalOpen(false)
            setCreateDate(null)
          }}
        />
      )}
    </div>
  )
}

function ShiftQuickCreateModal({
  isOpen,
  onClose,
  currentDate,
  viewMode,
  trainers,
  selectedTrainerId,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  currentDate: Date
  viewMode: 'individual' | 'team'
  trainers: Trainer[]
  selectedTrainerId: string
  onSave: (trainerId: string, start: Date, end: Date, weeklyFixed: boolean) => Promise<void>
}) {
  const defaultTrainerId = viewMode === 'individual' ? selectedTrainerId : (trainers[0]?.id || '')
  const [trainerId, setTrainerId] = useState(defaultTrainerId)
  const [dateValue, setDateValue] = useState(format(currentDate, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('20:00')
  const [weeklyFixed, setWeeklyFixed] = useState(false)
  const [loading, setLoading] = useState(false)

  const timeOptions = useMemo(() => {
    const options: string[] = []
    for (let i = 6; i <= 23; i += 1) {
      const hour = i.toString().padStart(2, '0')
      for (let minute = 0; minute < 60; minute += 10) {
        options.push(`${hour}:${minute.toString().padStart(2, '0')}`)
      }
    }
    return options
  }, [])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!trainerId) {
      alert('トレーナーを選択してください')
      return
    }

    const baseDate = new Date(`${dateValue}T00:00:00`)
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const start = setMinutes(setHours(baseDate, startHour), startMinute)
    const end = setMinutes(setHours(baseDate, endHour), endMinute)

    if (isAfter(start, end) || start.getTime() === end.getTime()) {
      alert('終了時間は開始時間より後に設定してください')
      return
    }

    setLoading(true)
    try {
      await onSave(trainerId, start, end, weeklyFixed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppModal
      title="シフトを追加"
      onClose={onClose}
      size="sm"
      align="bottom"
      bodyClassName="space-y-4 p-5"
      footer={(
        <>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-text-secondary">キャンセル</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm text-white disabled:opacity-50"
          >
            登録
          </button>
        </>
      )}
    >
          {viewMode === 'team' && (
            <div>
              <label className="mb-2 block text-xs text-text-secondary">トレーナー</label>
              <select
                value={trainerId}
                onChange={event => setTrainerId(event.target.value)}
                className="h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-text-primary"
              >
                {trainers.map(trainer => (
                  <option key={trainer.id} value={trainer.id}>{trainer.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs text-text-secondary">日付</label>
            <input
              type="date"
              value={dateValue}
              onChange={event => setDateValue(event.target.value)}
              className="h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-text-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-xs text-text-secondary">開始</label>
              <select
                value={startTime}
                onChange={event => setStartTime(event.target.value)}
                className="h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-text-primary"
              >
                {timeOptions.map(time => <option key={`start-${time}`} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs text-text-secondary">終了</label>
              <select
                value={endTime}
                onChange={event => setEndTime(event.target.value)}
                className="h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-text-primary"
              >
                {timeOptions.map(time => <option key={`end-${time}`} value={time}>{time}</option>)}
              </select>
            </div>
          </div>

          <label className="flex min-h-12 items-center justify-between rounded-xl border border-border-subtle bg-surface-base px-3">
            <span className="text-sm text-text-primary">毎週固定</span>
            <input
              type="checkbox"
              checked={weeklyFixed}
              onChange={event => setWeeklyFixed(event.target.checked)}
              className="h-5 w-5 rounded border-border-subtle text-brand-600 focus:ring-brand-500"
            />
          </label>
    </AppModal>
  )
}
