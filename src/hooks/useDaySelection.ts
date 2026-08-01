'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WeeklyProgressStats } from './useWeeklyProgress'

const WEEKDAY_LABELS_JA = ['日', '月', '火', '水', '木', '金', '土']

/**
 * AR-1: 「日」表示のための日付選択。
 *
 * 週表示と同じ上部ナビゲータを日送りに切り替えて使う。データ取得自体は
 * useWeeklyProgress が週単位で行っているため、週の端をまたぐ日送りでは
 * weekOffset も一緒に動かして、必要な週が読み込まれるようにする。
 */
export function useDaySelection(
    weeklyStats: WeeklyProgressStats | null,
    weekOffset: number,
    setWeekOffset: (updater: (prev: number) => number) => void,
    enabled: boolean,
) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const todayStr = useMemo(() => new Date().toLocaleDateString('sv-SE'), [])

    const weekDates = useMemo(() => (weeklyStats?.weekDays ?? []).map(d => d.date), [weeklyStats])

    // 週を切り替えたなどで選択日が表示中の週から外れたら、その週の既定日に戻す
    useEffect(() => {
        if (!selectedDate || weekDates.length === 0) return
        if (!weekDates.includes(selectedDate)) setSelectedDate(null)
    }, [selectedDate, weekDates])

    // 既定は「今日」。今日が表示中の週に無ければ、その週の最終日(未来は選ばない)
    const defaultDate = useMemo(() => {
        if (weekDates.length === 0) return todayStr
        if (weekDates.includes(todayStr)) return todayStr
        const pastDates = weekDates.filter(d => d <= todayStr)
        return pastDates.length > 0 ? pastDates[pastDates.length - 1] : weekDates[0]
    }, [weekDates, todayStr])

    const effectiveDate = selectedDate ?? defaultDate

    const shiftDate = (dateStr: string, days: number) => {
        const d = new Date(`${dateStr}T00:00:00`)
        d.setDate(d.getDate() + days)
        return d.toLocaleDateString('sv-SE')
    }

    const goPrevDay = () => {
        const next = shiftDate(effectiveDate, -1)
        if (weekDates.length > 0 && next < weekDates[0]) setWeekOffset(prev => prev - 1)
        setSelectedDate(next)
    }

    const goNextDay = () => {
        const next = shiftDate(effectiveDate, 1)
        if (next > todayStr) return
        if (weekDates.length > 0 && next > weekDates[weekDates.length - 1]) setWeekOffset(prev => prev + 1)
        setSelectedDate(next)
    }

    const dayLabel = useMemo(() => {
        if (effectiveDate === todayStr) return '今日'
        const d = new Date(`${effectiveDate}T00:00:00`)
        return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS_JA[d.getDay()]})`
    }, [effectiveDate, todayStr])

    const dayActual = weeklyStats?.dailyActual?.[effectiveDate] ?? {}
    const dayTarget = weeklyStats?.dailyTarget?.[effectiveDate] ?? {}

    return {
        enabled,
        selectedDate: effectiveDate,
        dayLabel,
        dayActual,
        dayTarget,
        goPrevDay,
        goNextDay,
        /** AT-1: 記録チェック表の曜日タップから、その日を直接選ぶ用 */
        selectDate: setSelectedDate,
        isNextDayDisabled: effectiveDate >= todayStr,
    }
}
