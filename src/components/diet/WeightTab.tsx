'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeightWeeklyCompare from './WeightWeeklyCompare'
import Card from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'

interface WeightTabProps {
    userId?: string
    token: string
    isAdmin?: boolean
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const HISTORY_WEEKS = 8

/**
 * J-1/J-3: 体重タブ。今週平均・先週比・減少率（WeightWeeklyCompare）に加え、
 * 先週・先々週…と遡って週平均を並べる履歴リストを表示する。
 * 体重推移グラフ（目標体重ライン付き）はPR-J2で別途追加予定。
 */
export default function WeightTab({ userId, token, isAdmin }: WeightTabProps) {
    const { weeklyStats, loading } = useWeeklyProgress(token, { userId, isAdmin })
    const [lifestyleLogs, setLifestyleLogs] = useState<any[]>([])
    const [historyLoading, setHistoryLoading] = useState(true)

    useEffect(() => {
        const fetchLogs = async () => {
            setHistoryLoading(true)
            try {
                const params = isAdmin && userId
                    ? `userId=${encodeURIComponent(userId)}`
                    : `token=${encodeURIComponent(token || '')}`
                const res = await fetch(`/api/lifestyle/logs?${params}`)
                const data = await res.json()
                setLifestyleLogs(data.data || [])
            } catch (e) {
                console.error(e)
            } finally {
                setHistoryLoading(false)
            }
        }
        if (token || (isAdmin && userId)) fetchLogs()
    }, [token, userId, isAdmin])

    const weekHistory = useMemo(() => {
        const getWeekRange = (offset: number) => {
            const now = new Date()
            now.setDate(now.getDate() + (offset * 7))
            const day = now.getDay()
            const diff = now.getDate() - day + (day === 0 ? -6 : 1)
            const monday = new Date(now.setDate(diff))
            monday.setHours(0, 0, 0, 0)
            const sunday = new Date(monday)
            sunday.setDate(monday.getDate() + 6)
            sunday.setHours(23, 59, 59, 999)
            return { monday, sunday }
        }

        const avgWeightInRange = (monday: Date, sunday: Date) => {
            const records = lifestyleLogs.filter(l => {
                if (l.weight === null || l.weight === undefined || Number(l.weight) <= 0) return false
                const d = new Date(l.date)
                return d >= monday && d <= sunday
            })
            if (records.length === 0) return null
            return records.reduce((sum, l) => sum + Number(l.weight), 0) / records.length
        }

        const formatRange = (monday: Date, sunday: Date) => {
            const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`
            return `${fmt(monday)}〜${fmt(sunday)}`
        }

        // 先週(-1)から遡ってHISTORY_WEEKS週分。差分計算のため、1つ古い週まで余分に平均を求める。
        const rows: { rangeStr: string; avg: number | null; diffAbs: number | null; diffPercent: number | null }[] = []
        for (let offset = -1; offset >= -HISTORY_WEEKS; offset--) {
            const { monday, sunday } = getWeekRange(offset)
            const avg = avgWeightInRange(monday, sunday)
            const { monday: prevMonday, sunday: prevSunday } = getWeekRange(offset - 1)
            const prevAvg = avgWeightInRange(prevMonday, prevSunday)

            const diffAbs = avg !== null && prevAvg !== null ? Number((avg - prevAvg).toFixed(1)) : null
            const diffPercent = avg !== null && prevAvg !== null && prevAvg !== 0
                ? Number((((avg - prevAvg) / prevAvg) * 100).toFixed(1))
                : null

            rows.push({ rangeStr: formatRange(monday, sunday), avg, diffAbs, diffPercent })
        }
        return rows
    }, [lifestyleLogs])

    if (loading) {
        return (
            <div className="space-y-4 pb-24">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        )
    }

    return (
        <div className="space-y-4 pb-24 animate-fadeIn">
            <WeightWeeklyCompare weight={weeklyStats?.weight} />

            <Card padding="sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-brand-500 rounded-full"></div>
                    <h3 className="text-sm font-semibold text-text-primary">週別の体重平均</h3>
                </div>

                {historyLoading ? (
                    <div className="space-y-3 py-2">
                        <SkeletonCard className="p-4" />
                        <SkeletonCard className="p-4" />
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle">
                        {weekHistory.map((row, i) => (
                            <div key={i} className="py-3">
                                <p className="text-xs font-normal text-text-muted tabular-nums mb-1">{row.rangeStr}</p>
                                <div className="flex items-baseline gap-3 flex-wrap">
                                    <span className="text-sm font-normal text-text-primary tabular-nums">
                                        {row.avg !== null ? `平均 ${row.avg.toFixed(1)}kg` : '記録なし'}
                                    </span>
                                    {row.diffAbs !== null && (
                                        <span className={`text-sm font-normal tabular-nums whitespace-nowrap ${row.diffAbs < 0 ? 'text-blue-600' : row.diffAbs > 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                                            先週差 {row.diffAbs > 0 ? '+' : ''}{row.diffAbs.toFixed(1)}kg
                                            {row.diffPercent !== null && (
                                                <span className="ml-1">（{row.diffPercent > 0 ? '+' : ''}{row.diffPercent.toFixed(1)}%）</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )
}
