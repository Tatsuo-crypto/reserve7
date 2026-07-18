'use client'

import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeeklyProgressPanel from './WeeklyProgressPanel'
import { WeeklyPanelSkeleton } from '@/components/ui/Skeleton'

interface ProgressTabProps {
    userId: string;
    token: string;
    weekOffset?: number;
    onWeekOffsetChange?: (updater: (prev: number) => number) => void;
    showWeekSwitcher?: boolean;
    /** I-4: 管理者側のタブ分割用。'nutrition'/'life'を渡すとパネルの片側だけ表示する。 */
    sections?: 'all' | 'nutrition' | 'life';
}

export default function ProgressTab({ userId, token, weekOffset: controlledWeekOffset, onWeekOffsetChange, showWeekSwitcher = true, sections = 'all' }: ProgressTabProps) {
    const { weeklyStats, loading, weekOffset, setWeekOffset } = useWeeklyProgress(token, {
        weekOffset: controlledWeekOffset,
        onWeekOffsetChange,
    })

    if (loading) return <WeeklyPanelSkeleton />

    return (
        <div className="space-y-4 pb-24 animate-fadeIn">
            <WeeklyProgressPanel
                weeklyStats={weeklyStats}
                weekOffset={weekOffset}
                setWeekOffset={setWeekOffset}
                showWeekSwitcher={showWeekSwitcher}
                sections={sections}
            />

            <div className="text-center pt-4">
                <p className="text-xs font-normal text-text-muted uppercase tracking-widest italic">Weekly Progress Metrics - Trainer View</p>
            </div>
        </div>
    )
}
