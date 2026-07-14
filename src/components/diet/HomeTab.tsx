'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useOnlineLessons, getJoinStatus } from '@/hooks/useOnlineLessons'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

interface HomeTabProps {
    token: string
    userName: string
    isDietPlan?: boolean
    todayDraft?: any
    onNavigate?: (tab: 'res' | 'record' | 'analyze' | 'plan') => void
    onOpenSettings?: () => void
}

type Goal = {
    id: string
    type: 'weight' | 'habit'
    title: string
    target_value: number | null
    start_date?: string | null
    deadline: string | null
    status: 'active' | 'achieved' | 'missed' | 'archived'
}

function daysUntil(deadline: string | null): number | null {
    if (!deadline) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(deadline)
    d.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatGoalDateLong(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return null
    return `${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * Home = 「今日の秘書」。数字の一覧ではなく、今日やることを最大4枚のカードで見せる。
 * 個々の栄養素・生活ログのバーはすべて分析タブへ移設済み（WeeklyProgressPanel）。
 */
export default function HomeTab({ token, userName, isDietPlan = true, todayDraft, onNavigate }: HomeTabProps) {
    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [goals, setGoals] = useState<Goal[]>([])
    const [nextReservation, setNextReservation] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const { lessons } = useOnlineLessons(token)

    const today = new Date()
    const todayStr = today.toLocaleDateString('sv-SE')
    const todayLabel = today.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
    })

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const [dietLogRes, goalsRes, resRes] = await Promise.all([
                    fetch(`/api/diet/logs?token=${token}`),
                    fetch(`/api/goals?token=${token}&status=active`),
                    fetch(`/api/client/reservations?token=${token}`),
                ])

                const [dietLogData, goalsData, resData] = await Promise.all([
                    isDietPlan ? dietLogRes.json() : Promise.resolve({ data: [] }),
                    isDietPlan ? goalsRes.json() : Promise.resolve({ data: [] }),
                    resRes.json(),
                ])

                setDietLogs(dietLogData.data || [])
                setGoals(goalsData.data || [])

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
    }, [token, todayStr, isDietPlan])

    // --- Card 1: today's online lesson ---
    const todayLesson = useMemo(() => {
        for (const lesson of lessons) {
            const status = getJoinStatus(lesson)
            if (status.isToday) return { lesson, status }
        }
        return null
    }, [lessons])

    const todayLog = useMemo(() => dietLogs.find(l => l.date === todayStr) || null, [dietLogs, todayStr])

    // --- Card 4: today's calorie ring ---
    const todayCalorie = useMemo(() => {
        let actualCalories: number | null = null

        if (todayLog && Number(todayLog.calories || 0) > 0) actualCalories = Number(todayLog.calories) || 0

        if (todayDraft?.selectedDate === todayStr && todayDraft?.ocrResult) {
            actualCalories = Number(todayDraft.ocrResult.calories) || actualCalories || 0
        }

        const hasRecord = actualCalories !== null

        return { actual: actualCalories, hasRecord }
    }, [todayLog, todayDraft, todayStr])

    const recordStatus = useMemo(() => {
        const hasDraftChanges = Boolean(
            todayDraft?.selectedDate === todayStr
            && (
                todayDraft?.ocrResult
                || todayDraft?.isSaved
                || (Array.isArray(todayDraft?.touchedFields) && todayDraft.touchedFields.length > 0)
            )
        )

        if (todayCalorie.hasRecord) {
            return {
                title: '記録済み',
                helper: '内容を確認できます',
                button: '記録を見る',
                done: true,
            }
        }

        if (hasDraftChanges) {
            return {
                title: '記録途中',
                helper: 'あと少しで今日の記録が完了です',
                button: '記録を続ける',
                done: false,
            }
        }

        return {
            title: 'まだです',
            helper: '今日の食事を記録しましょう',
            button: '記録する',
            done: false,
        }
    }, [todayCalorie.hasRecord, todayDraft, todayStr])

    const formatReservationDate = (dateStr: string) => {
        const d = new Date(dateStr)
        const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
        const h = String(d.getHours()).padStart(2, '0')
        const m = String(d.getMinutes()).padStart(2, '0')
        return `${d.getMonth() + 1}月${d.getDate()}日(${weekday}) ${h}:${m}`
    }

    const formatReservationTitle = (title: string) => {
        if (userName.includes('内山')) return 'カウンセリング'
        if (title.includes('カウンセリング')) return 'カウンセリング'
        const matchWithSlash = title.match(/(\d+)\/(\d+)$/)
        const matchWithoutSlash = title.match(/(\d+)$/)
        if (matchWithSlash) return `パーソナル${matchWithSlash[1]}回目`
        if (matchWithoutSlash) return `パーソナル${matchWithoutSlash[1]}回目`
        return title
    }

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>

    const primaryGoal = goals[0] || null
    const primaryGoalRemain = primaryGoal ? daysUntil(primaryGoal.deadline) : null
    const goalEndLong = formatGoalDateLong(primaryGoal?.deadline)

    if (!isDietPlan) {
        return (
            <div className="space-y-5 animate-fadeIn">
                <div className="pt-1 pb-0 text-center">
                    <p className="text-3xl font-semibold tabular-nums text-text-primary">{todayLabel}</p>
                </div>

                <section className="space-y-2">
                    <SectionTitle>予約</SectionTitle>
                    <Card padding="sm" className="!p-4">
                        {nextReservation ? (
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-text-primary">{formatReservationTitle(nextReservation.title)}</p>
                                <p className="mt-1 text-sm font-normal tabular-nums text-text-secondary">{formatReservationDate(nextReservation.start_time)}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-text-muted">予約はありません</p>
                        )}
                    </Card>
                </section>

                <section className="space-y-2">
                    <SectionTitle>オンラインセッション</SectionTitle>
                    <Card padding="sm" className="!p-4">
                        {todayLesson ? (
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-normal tabular-nums text-text-secondary">
                                        {todayLesson.lesson.start_time?.substring(0, 5)}〜{todayLesson.lesson.end_time?.substring(0, 5)}
                                    </p>
                                    <p className="mt-0.5 truncate text-sm font-normal text-text-secondary">{todayLesson.lesson.title}</p>
                                </div>
                                <button
                                    onClick={() => window.open(todayLesson.lesson.meet_url, '_blank')}
                                    className={`h-10 w-16 shrink-0 rounded-xl text-sm font-semibold active:scale-[0.98] ${todayLesson.lesson.meet_url ? 'bg-brand-600 text-white' : 'bg-surface-overlay text-text-muted'}`}
                                    disabled={!todayLesson.lesson.meet_url}
                                >
                                    参加
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-text-muted">本日の予定はありません</p>
                        )}
                    </Card>
                </section>
            </div>
        )
    }

    return (
        <div className="space-y-5 animate-fadeIn">
            <div className="pt-1 pb-0 text-center">
                <p className="text-3xl font-semibold tabular-nums text-text-primary">{todayLabel}</p>
            </div>

            <section className="space-y-2">
                <SectionTitle>目標</SectionTitle>
                <Card padding="sm" className="!p-3">
                    <div className="rounded-xl bg-brand-600 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-xs font-normal text-white/75">
                                    {primaryGoal?.type === 'weight' ? '目標体重' : primaryGoal ? '目標' : '目標'}
                                </p>
                                <p className="mt-1 truncate text-2xl font-semibold text-white">
                                    {primaryGoal
                                        ? primaryGoal.type === 'weight' && primaryGoal.target_value != null
                                            ? `${primaryGoal.target_value}kg`
                                            : primaryGoal.title
                                        : '未設定'}
                                </p>
                            </div>
                            {primaryGoalRemain !== null && (
                                <div className="shrink-0 text-center">
                                    <p className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-normal tabular-nums text-white">あと{primaryGoalRemain}日</p>
                                    {goalEndLong && (
                                        <p className="mt-1 text-sm font-semibold tabular-nums text-white">{goalEndLong}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </section>

            <section className="space-y-2">
                <SectionTitle>今日</SectionTitle>
                <Card padding="sm" className="!p-0 overflow-hidden">
                    {todayLesson && (
                        <div className="px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary">オンラインセッション</p>
                                    <p className="mt-1 text-sm font-normal tabular-nums text-text-secondary">
                                        {todayLesson.lesson.start_time?.substring(0, 5)}〜{todayLesson.lesson.end_time?.substring(0, 5)}
                                    </p>
                                    <p className="mt-0.5 truncate text-sm font-normal text-text-secondary">{todayLesson.lesson.title}</p>
                                </div>
                                <button
                                    onClick={() => window.open(todayLesson.lesson.meet_url, '_blank')}
                                    className={`h-10 w-16 shrink-0 rounded-xl text-sm font-semibold active:scale-[0.98] ${todayLesson.lesson.meet_url ? 'bg-brand-600 text-white' : 'bg-surface-overlay text-text-muted'}`}
                                    disabled={!todayLesson.lesson.meet_url}
                                >
                                    参加
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => onNavigate?.('record')}
                        className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 text-left active:scale-[0.99] ${todayLesson ? 'border-t border-border-subtle' : ''}`}
                    >
                        <p className="min-w-0 text-sm font-semibold text-text-primary">食事記録（{today.getMonth() + 1}/{today.getDate()}）</p>
                        {recordStatus.done ? (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500">
                                <Icon name="check" size={14} className="text-white" />
                            </div>
                        ) : (
                            <div className="h-7 w-7 shrink-0 rounded-full border-2 border-border-strong" />
                        )}
                    </button>
                </Card>
            </section>

            <section className="space-y-2">
                <SectionTitle>今後</SectionTitle>
                <button
                    onClick={() => onNavigate?.('res')}
                    className="w-full text-left active:scale-[0.99] transition-transform"
                >
                    <Card padding="sm" className="!p-4">
                        {nextReservation ? (
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary">{formatReservationTitle(nextReservation.title)}</p>
                                    <p className="mt-1 text-sm font-normal tabular-nums text-text-secondary">{formatReservationDate(nextReservation.start_time)}</p>
                                </div>
                                <Icon name="chevronRight" size={18} className="shrink-0 text-text-muted" />
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-text-muted">次回の予約はありません</p>
                                <span className="shrink-0 text-xs font-normal text-brand-300 bg-brand-500/15 px-3 py-1.5 rounded-full">予約する</span>
                            </div>
                        )}
                    </Card>
                </button>
            </section>
        </div>
    )
}

function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <h2 className="flex items-center gap-2 text-left text-base font-semibold text-text-primary">
            <span className="h-5 w-1 rounded-full bg-brand-500" />
            <span>{children}</span>
        </h2>
    )
}
