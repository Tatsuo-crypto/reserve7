'use client'

import { useEffect, useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

interface RecordCalendarProps {
    userId: string
    token: string
    isAdmin: boolean
}

const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export default function RecordCalendar({ userId, token, isAdmin }: RecordCalendarProps) {
    const [displayMonth, setDisplayMonth] = useState(() => {
        const today = new Date()
        return new Date(today.getFullYear(), today.getMonth(), 1)
    })
    const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true)
            try {
                const params = isAdmin
                    ? `userId=${encodeURIComponent(userId)}`
                    : `token=${encodeURIComponent(token)}`
                const response = await fetch(`/api/diet/logs?${params}`)
                if (!response.ok) throw new Error('Failed to fetch diet logs')

                const result = await response.json()
                const dates = new Set<string>(
                    (result.data || [])
                        .filter((log: any) => (Number(log.calories) || 0) > 0)
                        .map((log: any) => log.date)
                )
                setRecordedDates(dates)
            } catch (error) {
                console.error('Failed to fetch record calendar:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchRecords()
    }, [userId, token, isAdmin])

    const calendarDays = useMemo(() => {
        const year = displayMonth.getFullYear()
        const month = displayMonth.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const start = new Date(year, month, 1 - firstDay.getDay())
        const totalCells = Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7) * 7

        return Array.from({ length: totalCells }, (_, index) => {
            const date = new Date(start)
            date.setDate(start.getDate() + index)
            return {
                date,
                dateString: formatDate(date),
                isCurrentMonth: date.getMonth() === month,
            }
        })
    }, [displayMonth])

    const recordedCount = calendarDays.filter(
        day => day.isCurrentMonth && recordedDates.has(day.dateString)
    ).length
    const todayString = formatDate(new Date())
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const canMoveNext = displayMonth < currentMonthStart

    const moveMonth = (amount: number) => {
        setDisplayMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1))
    }

    return (
        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-brand-500" />
                    <h2 className="text-base font-normal text-text-primary">記録カレンダー</h2>
                </div>
                <span className="text-sm font-normal tabular-nums text-text-secondary">
                    {loading ? '-' : `${recordedCount}日`}
                </span>
            </div>

            <div className="mb-4 flex items-center justify-between">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => moveMonth(-1)}
                    aria-label="前の月"
                    className="flex h-9 w-9 items-center justify-center rounded-full p-0 text-text-secondary transition-colors hover:bg-surface-overlay"
                >
                    <Icon name="chevronLeft" size={18} />
                </Button>
                <div className="text-sm font-normal tabular-nums text-text-primary">
                    {displayMonth.getFullYear()}年{displayMonth.getMonth() + 1}月
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => moveMonth(1)}
                    disabled={!canMoveNext}
                    aria-label="次の月"
                    className="flex h-9 w-9 items-center justify-center rounded-full p-0 text-text-secondary transition-colors hover:bg-surface-overlay disabled:opacity-20"
                >
                    <Icon name="chevronRight" size={18} />
                </Button>
            </div>

            <div className="grid grid-cols-7 gap-y-2">
                {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                    <div key={day} className="text-center text-xs font-normal text-text-muted">
                        {day}
                    </div>
                ))}
                {calendarDays.map(day => {
                    const isRecorded = recordedDates.has(day.dateString)
                    const isToday = day.dateString === todayString
                    return (
                        <div key={day.dateString} className="flex aspect-square items-center justify-center">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-normal tabular-nums transition-colors ${
                                    !day.isCurrentMonth
                                        ? 'text-transparent'
                                        : isRecorded
                                            ? 'bg-brand-500 text-white'
                                            : 'bg-surface-overlay text-text-secondary'
                                } ${isToday ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-surface-raised' : ''}`}
                            >
                                {day.date.getDate()}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
