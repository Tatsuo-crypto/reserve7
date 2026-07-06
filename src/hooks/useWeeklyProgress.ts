'use client'

import { useState, useEffect, useMemo } from 'react'

export interface WeightWeeklyStats {
    thisWeekAvg: number | null
    lastWeekAvg: number | null
    diffAbs: number | null
    diffPercent: number | null
    recordedDays: number
    lastWeekRecordedDays: number
}

export interface WeeklyProgressStats {
    actual: Record<string, number>
    targets: Record<string, number>
    counts: Record<string, number>
    /** 記録した日数だけで割った平均値（例: 4日しか記録が無ければその4日間の平均）。 */
    avgOnRecordedDays: Record<string, number>
    /** 前週の週合計・記録日数・記録日平均（H-2の前週比の算出に使用）。 */
    previousActual: Record<string, number>
    previousCounts: Record<string, number>
    previousAvgOnRecordedDays: Record<string, number>
    weekRangeStr: string
    dietTargetPerDay: Record<string, number>
    lifeTargetPerDay: Record<string, number>
    /** 体重は「積み上げ量」ではなく週平均同士の比較で見るため、他指標とは別枠で保持する。 */
    weight: WeightWeeklyStats
}

interface UseWeeklyProgressOptions {
    /** Server-side userId lookup (admin view). Provide either userId+isAdmin or rely on token alone. */
    userId?: string
    isAdmin?: boolean
    /** Controlled week offset (0 = this week, -1 = last week, ...). If omitted, the hook manages its own state. */
    weekOffset?: number
    onWeekOffsetChange?: (updater: (prev: number) => number) => void
    /** Today's unsaved draft data (used on the member Home/Record screens to reflect not-yet-saved edits). */
    todayDraft?: any
}

const METRIC_KEYS = ['calories', 'protein', 'fat', 'carbs', 'sugar', 'fiber', 'salt', 'steps', 'water', 'sleep', 'workout'] as const

/**
 * Shared weekly actual-vs-target calculation used by the member Home summary,
 * the Analyze tab's collapsible "週間目標" section, and the admin diet-plan
 * Progress view. Extracted so the three call sites never drift out of sync.
 */
export function useWeeklyProgress(token: string, options: UseWeeklyProgressOptions = {}) {
    const { userId, isAdmin, weekOffset: controlledWeekOffset, onWeekOffsetChange, todayDraft } = options

    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [lifestyleLogs, setLifestyleLogs] = useState<any[]>([])
    const [dietGoals, setDietGoals] = useState<any[]>([])
    const [lifestyleSettings, setLifestyleSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const [internalWeekOffset, setInternalWeekOffset] = useState(0)
    const weekOffset = controlledWeekOffset ?? internalWeekOffset
    const setWeekOffset = onWeekOffsetChange ?? setInternalWeekOffset

    const todayStr = new Date().toLocaleDateString('sv-SE')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const params = isAdmin && userId
                    ? `userId=${encodeURIComponent(userId)}`
                    : `token=${encodeURIComponent(token || '')}`

                const [dietLogRes, lifeLogRes, dietGoalRes, lifeSettingRes] = await Promise.all([
                    fetch(`/api/diet/logs?${params}`),
                    fetch(`/api/lifestyle/logs?${params}`),
                    fetch(`/api/diet/goals?${params}`),
                    fetch(`/api/lifestyle/settings?${params}`)
                ])

                const [dietLogData, lifeLogData, dietGoalData, lifeSettingData] = await Promise.all([
                    dietLogRes.json(),
                    lifeLogRes.json(),
                    dietGoalRes.json(),
                    lifeSettingRes.json()
                ])

                setDietLogs(dietLogData.data || [])
                setLifestyleLogs(lifeLogData.data || [])
                setDietGoals(dietGoalData.data || [])
                setLifestyleSettings(lifeSettingData.data || null)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        if (token || (isAdmin && userId)) fetchData()
    }, [token, userId, isAdmin])

    const weeklyStats: WeeklyProgressStats | null = useMemo(() => {
        if (!dietLogs.length && !lifestyleLogs.length && !dietGoals.length && !todayDraft) return null

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

        const { monday, sunday } = getWeekRange(weekOffset)
        const { monday: prevMonday, sunday: prevSunday } = getWeekRange(weekOffset - 1)

        const weekRangeStr = `${monday.getMonth() + 1}/${monday.getDate()} 〜 ${sunday.getMonth() + 1}/${sunday.getDate()}`

        const processLogs = (logs: any[], isDiet: boolean, weekMonday: Date, weekSunday: Date) => {
            let processed = logs.filter(log => {
                const logDate = new Date(log.date)
                const isThisWeek = logDate >= weekMonday && logDate <= weekSunday
                const isToday = log.date === todayStr
                return isThisWeek && (!todayDraft || !isToday)
            })

            if (todayDraft) {
                const draftDate = todayDraft.selectedDate
                const draftDateObj = new Date(draftDate)
                const isDraftInThisWeek = draftDateObj >= weekMonday && draftDateObj <= weekSunday

                if (isDraftInThisWeek) {
                    const todayData = isDiet ? todayDraft.ocrResult : {
                        date: draftDate,
                        steps: todayDraft.touchedFields?.includes('steps') ? (parseInt(todayDraft.steps) || 0) : null,
                        water: todayDraft.touchedFields?.includes('water') ? (parseFloat(todayDraft.water) || 0) : null,
                        sleep: todayDraft.touchedFields?.includes('sleep') ? (parseFloat(todayDraft.sleep) || 0) : null,
                        weight: todayDraft.touchedFields?.includes('weight') ? (parseFloat(todayDraft.weight) || 0) : null,
                        habits: todayDraft.habits || { workout: 0 }
                    }

                    if (todayData && (!isDiet || todayDraft.ocrResult)) {
                        processed.push({ ...todayData, date: draftDate })
                    }
                }
            }

            return processed
        }

        const targetDateStr = sunday.toLocaleDateString('sv-SE')
        const currentDietGoal = [...dietGoals]
            .filter(g => g.start_date <= targetDateStr)
            .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
            || dietGoals[dietGoals.length - 1]
            || { calories: 0, protein: 0, fat: 0, carbs: 0 }

        const dietTargetPerDay = {
            calories: Number(currentDietGoal.calories || 0),
            protein: Number(currentDietGoal.protein || 0),
            fat: Number(currentDietGoal.fat || 0),
            carbs: Number(currentDietGoal.carbs || 0),
            sugar: Number(currentDietGoal.sugar ?? 0),
            fiber: Number(currentDietGoal.fiber ?? 0),
            salt: Number(currentDietGoal.salt ?? 6.5),
        }

        const lifeTargets = lifestyleSettings?.habit_targets || {
            steps: 8000,
            water: 2.0,
            workout: 3,
            sleep: 8.0
        }
        const daysInWeek = 7

        // 1週間分の実績・記録日数・体重の平均をまとめて計算するヘルパー（今週・前週の両方で使う）
        const aggregateWeek = (weekMonday: Date, weekSunday: Date) => {
            const weekDietLogs = processLogs(dietLogs, true, weekMonday, weekSunday)
            const weekLifeLogs = processLogs(lifestyleLogs, false, weekMonday, weekSunday)

            const actual = {
                calories: weekDietLogs.reduce((sum, log) => sum + (Number(log.calories) || 0), 0),
                protein: weekDietLogs.reduce((sum, log) => sum + (Number(log.protein) || 0), 0),
                fat: weekDietLogs.reduce((sum, log) => sum + (Number(log.fat) || 0), 0),
                carbs: weekDietLogs.reduce((sum, log) => sum + (Number(log.carbs) || 0), 0),
                sugar: weekDietLogs.reduce((sum, log) => sum + (Number(log.sugar) || 0), 0),
                fiber: weekDietLogs.reduce((sum, log) => sum + (Number(log.fiber) || 0), 0),
                salt: weekDietLogs.reduce((sum, log) => sum + (Number(log.salt) || 0), 0),
                steps: weekLifeLogs.reduce((sum, log) => {
                    const val = log.steps
                    return sum + (val !== null && val !== undefined ? Number(val) : 0)
                }, 0),
                water: weekLifeLogs.reduce((sum, log) => {
                    const val = log.water_liters ?? log.water ?? log.water_intake ?? log.water_amount
                    return sum + (val !== null && val !== undefined ? Number(val) : 0)
                }, 0),
                sleep: weekLifeLogs.reduce((sum, log) => {
                    const val = log.sleep_hours ?? log.sleep
                    return sum + (val !== null && val !== undefined ? Number(val) : 0)
                }, 0),
                workout: weekLifeLogs.reduce((sum, log) => sum + ((log.habits?.workout || 0) > 0 ? 1 : 0), 0),
            }

            const counts = {
                calories: weekDietLogs.filter(log => (Number(log.calories) || 0) > 0).length,
                protein: weekDietLogs.filter(log => (Number(log.protein) || 0) > 0).length,
                fat: weekDietLogs.filter(log => (Number(log.fat) || 0) > 0).length,
                carbs: weekDietLogs.filter(log => (Number(log.carbs) || 0) > 0).length,
                sugar: weekDietLogs.filter(log => (Number(log.sugar) || 0) > 0).length,
                fiber: weekDietLogs.filter(log => (Number(log.fiber) || 0) > 0).length,
                salt: weekDietLogs.filter(log => (Number(log.salt) || 0) > 0).length,
                steps: weekLifeLogs.filter(log => log.steps !== null && log.steps !== undefined).length,
                water: weekLifeLogs.filter(log => {
                    const val = log.water_liters ?? log.water ?? log.water_intake ?? log.water_amount
                    return val !== null && val !== undefined && Number(val) > 0
                }).length,
                sleep: weekLifeLogs.filter(log => {
                    const val = log.sleep_hours ?? log.sleep
                    return val !== null && val !== undefined && Number(val) > 0
                }).length,
                workout: weekLifeLogs.filter(log => (log.habits?.workout || 0) > 0).length,
            }

            const weightRecords = weekLifeLogs.filter(log => log.weight !== null && log.weight !== undefined && Number(log.weight) > 0)
            const weightAvg = weightRecords.length > 0
                ? weightRecords.reduce((sum, log) => sum + Number(log.weight), 0) / weightRecords.length
                : null

            return { actual, counts, weightAvg, weightRecordedDays: weightRecords.length }
        }

        const thisWeek = aggregateWeek(monday, sunday)
        const lastWeek = aggregateWeek(prevMonday, prevSunday)

        const avgOnRecordedDays: Record<string, number> = {}
        const previousAvgOnRecordedDays: Record<string, number> = {}
        for (const key of METRIC_KEYS) {
            avgOnRecordedDays[key] = thisWeek.counts[key as keyof typeof thisWeek.counts] > 0
                ? thisWeek.actual[key as keyof typeof thisWeek.actual] / thisWeek.counts[key as keyof typeof thisWeek.counts]
                : 0
            previousAvgOnRecordedDays[key] = lastWeek.counts[key as keyof typeof lastWeek.counts] > 0
                ? lastWeek.actual[key as keyof typeof lastWeek.actual] / lastWeek.counts[key as keyof typeof lastWeek.counts]
                : 0
        }

        const weight: WeightWeeklyStats = {
            thisWeekAvg: thisWeek.weightAvg,
            lastWeekAvg: lastWeek.weightAvg,
            diffAbs: thisWeek.weightAvg !== null && lastWeek.weightAvg !== null ? Number((thisWeek.weightAvg - lastWeek.weightAvg).toFixed(1)) : null,
            diffPercent: thisWeek.weightAvg !== null && lastWeek.weightAvg !== null && lastWeek.weightAvg !== 0
                ? Number((((thisWeek.weightAvg - lastWeek.weightAvg) / lastWeek.weightAvg) * 100).toFixed(1))
                : null,
            recordedDays: thisWeek.weightRecordedDays,
            lastWeekRecordedDays: lastWeek.weightRecordedDays,
        }

        const targets = {
            calories: dietTargetPerDay.calories * daysInWeek,
            protein: dietTargetPerDay.protein * daysInWeek,
            fat: dietTargetPerDay.fat * daysInWeek,
            carbs: dietTargetPerDay.carbs * daysInWeek,
            sugar: dietTargetPerDay.sugar * daysInWeek,
            fiber: dietTargetPerDay.fiber * daysInWeek,
            salt: dietTargetPerDay.salt * daysInWeek,
            steps: (lifeTargets.steps || lifeTargets.step_target || 8000) * daysInWeek,
            water: (lifeTargets.water || lifeTargets.water_target || 2.0) * daysInWeek,
            sleep: (lifeTargets.sleep || lifeTargets.sleep_target || 8.0) * daysInWeek,
            workout: lifeTargets.workout || lifeTargets.habit_targets?.workout || 3,
        }

        return {
            actual: thisWeek.actual,
            targets,
            counts: thisWeek.counts,
            avgOnRecordedDays,
            previousActual: lastWeek.actual,
            previousCounts: lastWeek.counts,
            previousAvgOnRecordedDays,
            weekRangeStr,
            dietTargetPerDay,
            lifeTargetPerDay: {
                steps: lifeTargets.steps || lifeTargets.step_target || 8000,
                water: lifeTargets.water || lifeTargets.water_target || 2.0,
                sleep: lifeTargets.sleep || lifeTargets.sleep_target || 8.0,
                workout: lifeTargets.workout || lifeTargets.habit_targets?.workout || 3
            },
            weight,
        }
    }, [dietLogs, lifestyleLogs, dietGoals, lifestyleSettings, weekOffset, todayDraft, todayStr])

    return { weeklyStats, loading, weekOffset, setWeekOffset }
}
