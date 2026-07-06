'use client'

import { useState } from 'react'
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeeklyProgressPanel from './WeeklyProgressPanel'
import WeeklySummaryPanel from './WeeklySummaryPanel'

interface WeeklyTabProps {
    userId: string
    token: string
    isAdmin: boolean
}

/**
 * ボトムナビ「週間」タブ。今日/週間の切り替えは持たず、常に週間サマリーだけを表示する。
 * 日々の記録（食事写真・体重・水分など）はホームの「記録する」ボタンから行う。
 *
 * 上部の「詳細」「週間まとめ」で表示を切り替えられる。デフォルトは既存の「詳細」
 * （＝これまでの週間目標パネル）で、H-6の絶対制約（週間目標パネルを削除・到達困難にしない）
 * を維持したまま、体重・食事・生活を1ページにまとめた新しい「週間まとめ」ビューを追加する。
 */
export default function WeeklyTab({ userId, token, isAdmin }: WeeklyTabProps) {
    const { weeklyStats, weekOffset, setWeekOffset } = useWeeklyProgress(token, { userId, isAdmin })
    const [view, setView] = useState<'detail' | 'summary'>('detail')

    return (
        <div className="space-y-4 animate-fadeIn pb-24">
            <div className="px-2 flex justify-center">
                <div className="inline-flex bg-gray-100 rounded-full p-1">
                    <button
                        onClick={() => setView('detail')}
                        className={`px-4 py-1.5 rounded-full text-xs font-normal transition-all ${view === 'detail' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                    >
                        詳細
                    </button>
                    <button
                        onClick={() => setView('summary')}
                        className={`px-4 py-1.5 rounded-full text-xs font-normal transition-all ${view === 'summary' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                    >
                        週間まとめ
                    </button>
                </div>
            </div>

            {view === 'detail' ? (
                <WeeklyProgressPanel
                    weeklyStats={weeklyStats}
                    weekOffset={weekOffset}
                    setWeekOffset={setWeekOffset}
                    showWeekSwitcher
                />
            ) : (
                <WeeklySummaryPanel
                    weeklyStats={weeklyStats}
                    weekOffset={weekOffset}
                    setWeekOffset={setWeekOffset}
                    showWeekSwitcher
                />
            )}
        </div>
    )
}
