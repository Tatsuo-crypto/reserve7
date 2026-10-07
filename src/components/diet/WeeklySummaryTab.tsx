'use client'

import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeeklySummaryPanel from './WeeklySummaryPanel'

interface WeeklySummaryTabProps {
    userId?: string
    token: string
    isAdmin?: boolean
    weekOffset?: number
    onWeekOffsetChange?: (updater: (prev: number) => number) => void
    showWeekSwitcher?: boolean
}

/** 管理者側「週間まとめ」タブ用のラッパー。会員側は WeeklyTab.tsx 内で直接パネルを使う。 */
export default function WeeklySummaryTab({ userId, token, isAdmin, weekOffset: controlledWeekOffset, onWeekOffsetChange, showWeekSwitcher = true }: WeeklySummaryTabProps) {
    const { weeklyStats, loading, weekOffset, setWeekOffset } = useWeeklyProgress(token, {
        userId,
        isAdmin,
        weekOffset: controlledWeekOffset,
        onWeekOffsetChange,
    })

    return (
        <div className="space-y-2 pb-24 animate-fadeIn">
            {!loading && (
                <WeeklySummaryPanel
                    weeklyStats={weeklyStats}
                    weekOffset={weekOffset}
                    setWeekOffset={setWeekOffset}
                    showWeekSwitcher={showWeekSwitcher}
                />
            )}
        </div>
    )
}
