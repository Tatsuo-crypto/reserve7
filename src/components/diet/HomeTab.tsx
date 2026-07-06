'use client'

import { useState, useEffect, useMemo } from 'react'
import { useOnlineLessons, getJoinStatus } from '@/hooks/useOnlineLessons'
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeightWeeklyCompare from './WeightWeeklyCompare'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

interface HomeTabProps {
    token: string
    userName: string
    todayDraft?: any
    onNavigate?: (tab: 'res' | 'record' | 'analyze') => void
    onOpenSettings?: () => void
}

/**
 * Home = 「今日の秘書」。数字の一覧ではなく、今日やることを最大4枚のカードで見せる。
 * 個々の栄養素・生活ログのバーはすべて分析タブへ移設済み（WeeklyProgressPanel）。
 */
export default function HomeTab({ token, userName, todayDraft, onNavigate, onOpenSettings }: HomeTabProps) {
    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [, setLifestyleLogs] = useState<any[]>([])
    const [dietGoals, setDietGoals] = useState<any[]>([])
    const [nextReservation, setNextReservation] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')

    const { lessons } = useOnlineLessons(token)
    const { weeklyStats } = useWeeklyProgress(token, { todayDraft })

    const todayStr = new Date().toLocaleDateString('sv-SE')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const [dietLogRes, lifeLogRes, dietGoalRes, resRes] = await Promise.all([
                    fetch(`/api/diet/logs?token=${token}`),
                    fetch(`/api/lifestyle/logs?token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`),
                    fetch(`/api/client/reservations?token=${token}`),
                ])

                const [dietLogData, lifeLogData, dietGoalData, resData] = await Promise.all([
                    dietLogRes.json(),
                    lifeLogRes.json(),
                    dietGoalRes.json(),
                    resRes.json(),
                ])

                setDietLogs(dietLogData.data || [])
                setLifestyleLogs(lifeLogData.data || [])
                setDietGoals(dietGoalData.data || [])

                const future = (resData?.data?.futureReservations || []) as any[]
                const sorted = [...future].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                setNextReservation(sorted[0] || null)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        if (token) fetchData()
    }, [token])

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotifPermission(Notification.permission)
        }
    }, [])

    // --- Card 1: today's online lesson ---
    const todayLesson = useMemo(() => {
        for (const lesson of lessons) {
            const status = getJoinStatus(lesson)
            if (status.isToday) return { lesson, status }
        }
        return null
    }, [lessons])

    // --- Card 4: today's calorie ring ---
    const todayCalorie = useMemo(() => {
        let actualCalories: number | null = null

        const todayLog = dietLogs.find(l => l.date === todayStr)
        if (todayLog) actualCalories = Number(todayLog.calories) || 0

        if (todayDraft?.selectedDate === todayStr && todayDraft?.ocrResult) {
            actualCalories = Number(todayDraft.ocrResult.calories) || actualCalories || 0
        }

        const targetDateStr = todayStr
        const currentGoal = [...dietGoals]
            .filter(g => g.start_date <= targetDateStr)
            .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
            || dietGoals[dietGoals.length - 1]
            || null

        const target = currentGoal?.calories ? Number(currentGoal.calories) : null
        const hasRecord = actualCalories !== null

        const pct = (hasRecord && target) ? Math.min(100, Math.round(((actualCalories as number) / target) * 100)) : 0

        return { actual: actualCalories, target, pct, hasRecord }
    }, [dietLogs, dietGoals, todayDraft, todayStr])

    const formatReservationDate = (dateStr: string) => {
        const d = new Date(dateStr)
        const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
        const h = String(d.getHours()).padStart(2, '0')
        const m = String(d.getMinutes()).padStart(2, '0')
        return `${d.getMonth() + 1}/${d.getDate()}(${weekday}) ${h}:${m}`
    }

    const formatReservationTitle = (title: string) => {
        const matchWithSlash = title.match(/(\d+)\/(\d+)$/)
        const matchWithoutSlash = title.match(/(\d+)$/)
        if (matchWithSlash) return `パーソナル${matchWithSlash[1]}回目`
        if (matchWithoutSlash) return `パーソナル${matchWithoutSlash[1]}回目`
        return title
    }

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>

    const showNotifBanner = notifPermission === 'default'

    return (
        <div className="space-y-4 animate-fadeIn">
            {/* Card 1: 本日のオンラインレッスン（当日開催時のみ） */}
            {todayLesson && (
                <div className="bg-gradient-to-r from-brand-600 to-brand-800 rounded-2xl p-5 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-[11px] font-normal text-brand-100 tracking-widest uppercase mb-1">本日のオンラインレッスン</p>
                        <h3 className="text-lg font-semibold mb-1">{todayLesson.lesson.title}</h3>
                        <p className="text-sm text-brand-100 mb-4">
                            {todayLesson.lesson.start_time?.substring(0, 5)}〜{todayLesson.lesson.end_time?.substring(0, 5)}
                        </p>
                        <button
                            onClick={() => window.open(todayLesson.lesson.meet_url, '_blank')}
                            disabled={!todayLesson.status.canJoin}
                            className={`w-full py-3 rounded-xl font-normal transition-all ${todayLesson.status.canJoin ? 'bg-white text-brand-700 active:scale-95 shadow' : 'bg-white/20 text-white/70'}`}
                        >
                            {todayLesson.status.canJoin ? '参加する' : todayLesson.status.label}
                        </button>
                    </div>
                </div>
            )}

            {/* Card 2: 次回予約（常時） */}
            <button
                onClick={() => onNavigate?.('res')}
                className="w-full text-left active:scale-[0.99] transition-transform"
            >
                <Card padding="sm">
                    <p className="text-[11px] font-normal text-gray-400 tracking-widest uppercase mb-1">次回予約</p>
                    {nextReservation ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-base font-semibold text-gray-800">{formatReservationDate(nextReservation.start_time)}</p>
                                <p className="text-sm text-gray-400">{formatReservationTitle(nextReservation.title)}</p>
                            </div>
                            <Icon name="chevronRight" className="text-gray-300" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">今後の予約はありません</p>
                            <span className="text-xs font-normal text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full">予約する</span>
                        </div>
                    )}
                </Card>
            </button>

            {/* Card 3: 体重ひとこと（今週平均・先週比。PR3: WeightWeeklyCompareに統一） */}
            {weeklyStats?.weight?.thisWeekAvg !== null && weeklyStats?.weight?.thisWeekAvg !== undefined && (
                <button
                    onClick={() => onNavigate?.('analyze')}
                    className="w-full text-left active:scale-[0.99] transition-transform"
                >
                    <Card padding="sm">
                        <WeightWeeklyCompare weight={weeklyStats.weight} compact />
                    </Card>
                </button>
            )}

            {/* Card 4: 今日の記録（常時） */}
            <Card padding="sm">
                <p className="text-[11px] font-normal text-gray-400 tracking-widest uppercase mb-3">今日の記録</p>
                <div className="flex items-center gap-4">
                    {todayCalorie.hasRecord ? (
                        <div className="shrink-0 w-10 h-10 rounded-full bg-state-success-500 flex items-center justify-center">
                            <Icon name="check" size={20} className="text-white" />
                        </div>
                    ) : (
                        <div className="shrink-0 w-10 h-10 rounded-full border-2 border-gray-200" />
                    )}
                    <p className="text-sm text-gray-600">
                        {todayCalorie.hasRecord ? '今日の記録は完了しています' : '今日の記録はまだです'}
                    </p>
                </div>
                <Button onClick={() => onNavigate?.('record')} fullWidth className="mt-4">
                    記録する
                </Button>
            </Card>

            {/* 通知未許可バナー */}
            {showNotifBanner && (
                <button
                    onClick={() => onOpenSettings?.()}
                    className="w-full text-left flex items-center gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100 active:scale-[0.99] transition-transform"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
                        <Icon name="bell" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-normal text-gray-600">通知を許可すると予約やレッスンのお知らせが届きます</p>
                    </div>
                    <Icon name="chevronRight" size={16} className="text-gray-300" />
                </button>
            )}
        </div>
    )
}
