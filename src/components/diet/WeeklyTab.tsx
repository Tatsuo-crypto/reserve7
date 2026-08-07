'use client'

import { useState } from 'react'
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeeklyProgressPanel from './WeeklyProgressPanel'
import RecordCalendar from './RecordCalendar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

interface WeeklyTabProps {
    userId: string
    token: string
    isAdmin: boolean
}

/**
 * ボトムナビ「習慣」タブ。分析タブから週間目標パネルを独立させ、
 * カロリー・栄養・水分・歩数・トレーニングなどの週次確認をまとめる。
 */
export default function WeeklyTab({ userId, token, isAdmin }: WeeklyTabProps) {
    const { weeklyStats, weekOffset, setWeekOffset } = useWeeklyProgress(token, { userId, isAdmin })
    const [calendarOpen, setCalendarOpen] = useState(false)

    return (
        // BG-1: 管理者側(WeeklySummaryTab)と同じ余白・同じレイアウトに揃える。
        // simpleMemberView は会員側だけ別レイアウト(1枚の一覧カード)にするフラグだったが、
        // 同じ数値を見る画面が管理者と会員で違う形になっていたため廃止した。
        <div className="space-y-2 animate-fadeIn pb-24">
            <WeeklyProgressPanel
                weeklyStats={weeklyStats}
                weekOffset={weekOffset}
                setWeekOffset={setWeekOffset}
                showWeekSwitcher
            />
            <section className="space-y-3">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCalendarOpen(open => !open)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border-subtle bg-surface-raised px-4 py-3 text-left shadow-sm active:scale-[0.99]"
                >
                    <span className="flex items-center gap-2 text-xl font-semibold text-text-primary">
                        <span className="h-5 w-1 rounded-full bg-brand-500" />
                        記録カレンダー
                    </span>
                    <Icon name={calendarOpen ? 'chevronUp' : 'chevronDown'} size={18} className="text-text-muted" />
                </Button>
                {calendarOpen && <RecordCalendar userId={userId} token={token} isAdmin={isAdmin} />}
            </section>
        </div>
    )
}
