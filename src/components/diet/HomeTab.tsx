'use client'

import { useState, useEffect, useMemo } from 'react'
import { useOnlineLessons, getJoinStatus } from '@/hooks/useOnlineLessons'
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeightWeeklyCompare from './WeightWeeklyCompare'

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

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    const showNotifBanner = notifPermission === 'default'

    return (
        <div className="space-y-4 animate-fadeIn">
            {/* Card 1: 本日のオンラインレッスン（当日開催時のみ） */}
            {todayLesson && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-[11px] font-normal text-blue-100 tracking-widest uppercase mb-1">本日のオンラインレッスン</p>
                        <h3 className="text-lg font-normal mb-1">{todayLesson.lesson.title}</h3>
                        <p className="text-sm text-blue-100 mb-4">
                            {todayLesson.lesson.start_time?.substring(0, 5)}〜{todayLesson.lesson.end_time?.substring(0, 5)}
                        </p>
                        <button
                            onClick={() => window.open(todayLesson.lesson.meet_url, '_blank')}
                            disabled={!todayLesson.status.canJoin}
                            className={`w-full py-3 rounded-xl font-normal transition-all ${todayLesson.status.canJoin ? 'bg-white text-blue-700 active:scale-95 shadow' : 'bg-white/20 text-white/70'}`}
                        >
                            {todayLesson.status.canJoin ? '参加する' : todayLesson.status.label}
                        </button>
                    </div>
                </div>
            )}

            {/* Card 2: 次回予約（常時） */}
            <button
                onClick={() => onNavigate?.('res')}
                className="w-full text-left bg-white rounded-3xl p-5 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
            >
                <p className="text-[11px] font-normal text-gray-400 tracking-widest uppercase mb-1">次回予約</p>
                {nextReservation ? (
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-normal text-gray-800">{formatReservationDate(nextReservation.start_time)}</p>
                            <p className="text-sm text-gray-400">{formatReservationTitle(nextReservation.title)}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400">今後の予約はありません</p>
                        <span className="text-xs font-normal text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">予約する</span>
                    </div>
                )}
            </button>

            {/* Card 3: 体重ひとこと（今週平均・先週比。PR3: WeightWeeklyCompareに統一） */}
            {weeklyStats?.weight?.thisWeekAvg !== null && weeklyStats?.weight?.thisWeekAvg !== undefined && (
                <button
                    onClick={() => onNavigate?.('analyze')}
                    className="w-full text-left bg-white rounded-3xl p-5 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
                >
                    <WeightWeeklyCompare weight={weeklyStats.weight} compact />
                </button>
            )}

            {/* Card 4: 今日の記録（常時） */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <p className="text-[11px] font-normal text-gray-400 tracking-widest uppercase mb-3">今日の記録</p>
                <div className="flex items-center gap-4">
                    {todayCalorie.hasRecord ? (
                        <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                    ) : (
                        <div className="shrink-0 w-10 h-10 rounded-full border-2 border-gray-200" />
                    )}
                    <p className="text-sm text-gray-600">
                        {todayCalorie.hasRecord ? '今日の記録は完了しています' : '今日の記録はまだです'}
                    </p>
                </div>
                <button
                    onClick={() => onNavigate?.('record')}
                    className="w-full mt-4 py-3 rounded-xl font-normal bg-blue-600 text-white active:scale-[0.98] transition-transform"
                >
                    記録する
                </button>
            </div>

            {/* 通知未許可バナー */}
            {showNotifBanner && (
                <button
                    onClick={() => onOpenSettings?.()}
                    className="w-full text-left flex items-center gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100 active:scale-[0.99] transition-transform"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-normal text-gray-600">通知を許可すると予約やレッスンのお知らせが届きます</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            )}
        </div>
    )
}
