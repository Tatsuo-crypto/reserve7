'use client'

import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Member } from '@/types'
import type { GoalFormValues, HabitTargetsValues } from '@/components/diet/GoalPlanForm'

// Reusing some logic from members page
import { getStatusDotColor } from '@/lib/utils/member'
import { calculateAragonPlan, caloriesFromMacros, NEAT_LEVELS } from '@/lib/utils/dietGoalCalc'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

const PanelLoading = () => (
    <div className="flex h-56 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-600" />
    </div>
)

const AnalyzeTab = dynamic(() => import('@/components/diet/AnalyzeTab'), {
    ssr: false,
    loading: PanelLoading,
})

const WeeklySummaryTab = dynamic(() => import('@/components/diet/WeeklySummaryTab'), {
    ssr: false,
    loading: PanelLoading,
})

const WeightTab = dynamic(() => import('@/components/diet/WeightTab'), {
    ssr: false,
    loading: PanelLoading,
})

const GoalsTab = dynamic(() => import('@/components/diet/GoalsTab'), {
    ssr: false,
    loading: PanelLoading,
})

const GoalPlanForm = dynamic(() => import('@/components/diet/GoalPlanForm'), {
    ssr: false,
    loading: PanelLoading,
})

const GoalEditModal = dynamic(() => import('@/components/diet/GoalEditModal'), {
    ssr: false,
    loading: PanelLoading,
})

const GOAL_SUGGESTIONS = [
    'お酒を週2回までにする',
    'お菓子を控える',
    '寝る前1時間はスマホを見ない',
    '揚げ物を控える',
    '21時以降は食べない',
    'ジュースを控える',
    '週3回以上運動する',
    '湯船に浸かる'
]

// TARGET CONSTANTS
const DEFAULT_PROTEIN = 100;
const DEFAULT_FAT = 40;
const DEFAULT_CARBS = 300;
const DEFAULT_FIBER = 20;
const DEFAULT_SUGAR = 280;
const DEFAULT_SALT = 6;

type TabType = 'panel' | 'weight' | 'graph' | 'goals' | 'plan';
type PeriodType = '1w' | '1m' | '3m' | '6m' | '1y' | 'all';

function getRecordDate(record: any) {
    const value = record?.date || record?.recorded_date || record?.created_at || record?.target_date
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function getWeekRange(weekOffset = 0) {
    const anchor = new Date()
    anchor.setDate(anchor.getDate() + (weekOffset * 7))
    const day = anchor.getDay()
    const daysFromMonday = day === 0 ? 6 : day - 1
    const start = new Date(anchor)
    start.setDate(anchor.getDate() - daysFromMonday)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    const prevEnd = new Date(start)
    prevEnd.setMilliseconds(-1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - 6)
    prevStart.setHours(0, 0, 0, 0)

    return { start, end, prevStart, prevEnd }
}

function filterByRange(records: any[], start: Date, end: Date) {
    return records.filter(record => {
        const date = getRecordDate(record)
        return date && date >= start && date <= end
    })
}

function average(records: any[], key: string) {
    return averageByKeys(records, [key])
}

function averageByKeys(records: any[], keys: string[]) {
    const values = records
        .map(record => {
            const raw = keys.map(key => record?.[key]).find(value => value !== null && value !== undefined)
            return Number(raw || 0)
        })
        .filter(value => Number.isFinite(value) && value > 0)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toDateInputValue(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function addDaysToDateInput(value: string, days: number) {
    const date = new Date(`${value}T00:00:00`)
    date.setDate(date.getDate() + days)
    return toDateInputValue(date)
}

function nextSundayOnOrAfter(value: string) {
    const date = new Date(`${value}T00:00:00`)
    const day = date.getDay()
    const daysUntilSunday = day === 0 ? 0 : 7 - day
    date.setDate(date.getDate() + daysUntilSunday)
    return toDateInputValue(date)
}

function normalizeGoalValues(values: GoalFormValues): GoalFormValues {
    const fiber = Math.max(0, Math.round(Number(values.fiber || 0)))
    const carbs = Math.max(0, Math.round(Number(values.carbs || 0)))
    const targetCalories = Math.max(0, Math.round(Number(values.targetCalories || 0)))
    const trainingCalories = Math.max(0, Math.round(Number(values.trainingCalories ?? targetCalories)))
    const restCalories = Math.max(0, Math.round(Number(values.restCalories ?? targetCalories)))
    return {
        ...values,
        protein: Math.max(0, Math.round(Number(values.protein || 0))),
        fat: Math.max(0, Math.round(Number(values.fat || 0))),
        carbs,
        fiber,
        sugar: Math.max(0, Math.round(Number(values.sugar ?? Math.max(0, carbs - fiber)))),
        salt: Math.max(0, Number(values.salt || 0)),
        targetCalories,
        dayTypeEnabled: Boolean(values.dayTypeEnabled),
        trainingCalories,
        trainingProtein: Math.max(0, Math.round(Number(values.trainingProtein ?? values.protein ?? 0))),
        trainingFat: Math.max(0, Math.round(Number(values.trainingFat ?? values.fat ?? 0))),
        trainingCarbs: Math.max(0, Math.round(Number(values.trainingCarbs ?? values.carbs ?? 0))),
        restCalories,
        restProtein: Math.max(0, Math.round(Number(values.restProtein ?? values.protein ?? 0))),
        restFat: Math.max(0, Math.round(Number(values.restFat ?? values.fat ?? 0))),
        restCarbs: Math.max(0, Math.round(Number(values.restCarbs ?? values.carbs ?? 0))),
        dayTypeFieldsAvailable: Boolean(values.dayTypeFieldsAvailable),
    }
}

function goalRecordToFormValues(record: any): GoalFormValues {
    return {
        protein: Math.round(Number(record.protein || DEFAULT_PROTEIN)),
        fat: Math.round(Number(record.fat || DEFAULT_FAT)),
        carbs: Math.round(Number(record.carbs || DEFAULT_CARBS)),
        fiber: Math.round(Number(record.fiber || DEFAULT_FIBER)),
        sugar: Math.round(Number(record.sugar || (Number(record.carbs || DEFAULT_CARBS) - Number(record.fiber || DEFAULT_FIBER)))),
        targetCalories: Math.round(Number(record.calories || 1600)),
        salt: Number(record.salt || DEFAULT_SALT),
        startDate: record.start_date,
        title: record.title || '',
        dayTypeEnabled: Boolean(record.day_type_enabled),
        trainingCalories: Math.round(Number(record.training_calories || record.calories || 1600)),
        trainingProtein: Math.round(Number(record.training_protein || record.protein || DEFAULT_PROTEIN)),
        trainingFat: Math.round(Number(record.training_fat || record.fat || DEFAULT_FAT)),
        trainingCarbs: Math.round(Number(record.training_carbs || record.carbs || DEFAULT_CARBS)),
        restCalories: Math.round(Number(record.rest_calories || record.calories || 1600)),
        restProtein: Math.round(Number(record.rest_protein || record.protein || DEFAULT_PROTEIN)),
        restFat: Math.round(Number(record.rest_fat || record.fat || DEFAULT_FAT)),
        restCarbs: Math.round(Number(record.rest_carbs || record.carbs || DEFAULT_CARBS)),
        dayTypeFieldsAvailable: Object.prototype.hasOwnProperty.call(record, 'day_type_enabled'),
    }
}

function goalFormValuesToPayload(values: GoalFormValues) {
    const calories = values.dayTypeEnabled
        ? (values.trainingCalories ?? values.targetCalories)
        : values.targetCalories
    return {
        title: values.title,
        calories,
        protein: values.protein,
        fat: values.fat,
        carbs: values.carbs,
        sugar: values.sugar,
        fiber: values.fiber,
        salt: values.salt,
    }
}

function goalFormValuesToDietSaveBody(values: GoalFormValues) {
    return {
        startDate: values.startDate,
        ...goalFormValuesToPayload(values),
    }
}

function goalFormValuesToDayTypeSettings(values: GoalFormValues, habitTargets?: HabitTargetsValues) {
    return {
        ...(habitTargets?.diet_day_type_targets || {}),
        day_type_enabled: Boolean(values.dayTypeEnabled),
        training_calories: values.trainingCalories ?? values.targetCalories,
        training_protein: values.trainingProtein ?? values.protein,
        training_fat: values.trainingFat ?? values.fat,
        training_carbs: values.trainingCarbs ?? values.carbs,
        rest_calories: values.restCalories ?? values.targetCalories,
        rest_protein: values.restProtein ?? values.protein,
        rest_fat: values.restFat ?? values.fat,
        rest_carbs: values.restCarbs ?? values.carbs,
    }
}

function applyDayTypeSettingsToGoal(values: GoalFormValues, settings: any): GoalFormValues {
    if (!settings) return values
    return {
        ...values,
        dayTypeEnabled: Boolean(settings.day_type_enabled),
        trainingCalories: Math.round(Number(settings.training_calories ?? values.targetCalories)),
        trainingProtein: Math.round(Number(settings.training_protein ?? values.protein)),
        trainingFat: Math.round(Number(settings.training_fat ?? values.fat)),
        trainingCarbs: Math.round(Number(settings.training_carbs ?? values.carbs)),
        restCalories: Math.round(Number(settings.rest_calories ?? values.targetCalories)),
        restProtein: Math.round(Number(settings.rest_protein ?? values.protein)),
        restFat: Math.round(Number(settings.rest_fat ?? values.fat)),
        restCarbs: Math.round(Number(settings.rest_carbs ?? values.carbs)),
        dayTypeFieldsAvailable: true,
    }
}

function DietPlanPageContent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [members, setMembers] = useState<Member[]>([])
    const [loadingMembers, setLoadingMembers] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedMember, setSelectedMember] = useState<Member | null>(null)
    
    const [loadingData, setLoadingData] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [activeTab, setActiveTab] = useState<TabType>('panel')
    const [showDailyRecords, setShowDailyRecords] = useState(false)
    const [editingCurrentPlan, setEditingCurrentPlan] = useState(false)
    // アラゴン式カロリー計算の入力（初回のみ表示するカードで使用）
    const [aragonInput, setAragonInput] = useState({
        targetWeight: '',
        periodWeeks: '12',
        weeklyTrainingHours: '3',
        neat: NEAT_LEVELS[0].value,
    })
    // O-7: スライダー化に伴い、体重が取得できた時点で目標体重の初期値を設定する
    // (数値入力と違い空欄のままだとスライダーの初期位置を描画できないため)
    const aragonWeightInitialized = useRef(false)
    const [goalModal, setGoalModal] = useState<{
        mode: 'new' | 'edit'
        recordId?: string
        initialValues: GoalFormValues
        initialHabitTargets: HabitTargetsValues
    } | null>(null)
    const [analysisPeriod, setAnalysisPeriod] = useState<PeriodType>('1m')
    const [selectedWeek, setSelectedWeek] = useState<string>('')
    const [showWeightAvg, setShowWeightAvg] = useState(false)
    const [summaryWeekOffset, setSummaryWeekOffset] = useState(0)
    const [sharedState, setSharedState] = useState<any>({
        selectedDate: new Date().toISOString().split('T')[0],
        habits: { workout: 0 }
    })

    const today = new Date().toISOString().split('T')[0];

    const [nutrientForm, setNutrientForm] = useState<GoalFormValues>({
        protein: DEFAULT_PROTEIN,
        fat: DEFAULT_FAT,
        carbs: DEFAULT_CARBS,
        sugar: DEFAULT_SUGAR,
        fiber: DEFAULT_FIBER,
        salt: DEFAULT_SALT,
        targetCalories: 1600,
        startDate: today,
        title: '',
        dayTypeEnabled: false,
        trainingCalories: 1600,
        trainingProtein: DEFAULT_PROTEIN,
        trainingFat: DEFAULT_FAT,
        trainingCarbs: DEFAULT_CARBS,
        restCalories: 1600,
        restProtein: DEFAULT_PROTEIN,
        restFat: DEFAULT_FAT,
        restCarbs: DEFAULT_CARBS,
        dayTypeFieldsAvailable: false,
    })

    const [lifestyleSettings, setLifestyleSettings] = useState({
        visible_items: { steps: true, sleep: true, water: true, workout: true },
        visible_tabs: { input: true, analyze: true, progress: true }
    })

    const [habitTargets, setHabitTargets] = useState<any>({
        steps: null,
        sleep: null,
        water: null,
        workout: null
    })

    const [quitGoals, setQuitGoals] = useState<string[]>([])
    const [newQuitGoal, setNewQuitGoal] = useState('')

    // Analysis data
    const [dietHistory, setDietHistory] = useState<any[]>([])
    const [weightHistory, setWeightHistory] = useState<any[]>([])
    const [lifestyleHistory, setLifestyleHistory] = useState<any[]>([])
    const [intakeHistory, setIntakeHistory] = useState<any[]>([])

    const fetchMemberData = useCallback(async (userId: string, token: string) => {
        setLoadingData(true)
        try {
            const [dietRes, lifestyleRes, trackingRes, logsRes, lifeLogsRes] = await Promise.all([
                fetch(`/api/diet/goals?token=${token}`),
                fetch(`/api/lifestyle/settings?userId=${userId}`),
                fetch(`/api/admin/member-tracking/${userId}`),
                fetch(`/api/diet/logs?token=${token}`),
                fetch(`/api/lifestyle/logs?token=${token}`)
            ])

            if (dietRes.ok) {
                const text = await dietRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    setDietHistory(data || [])
                    if (data && data.length > 0) {
                        const latest = data[0]
                        setNutrientForm(goalRecordToFormValues(latest))
                    }
                }
            }

            if (lifestyleRes.ok) {
                const text = await lifestyleRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    if (data) {
                        setLifestyleSettings({
                            visible_items: data.visible_items || { steps: true, sleep: true, water: true, workout: true },
                            visible_tabs: data.visible_tabs || { input: true, analyze: true, progress: true }
                        })
                        if (data.quit_goals) setQuitGoals(data.quit_goals)
                        if (data.habit_targets) setHabitTargets(data.habit_targets)
                        else setHabitTargets({ steps: null, sleep: null, water: null, workout: null })
                        if (data.habit_targets?.diet_day_type_targets) {
                            setNutrientForm(prev => applyDayTypeSettingsToGoal(prev, data.habit_targets.diet_day_type_targets))
                        }
                    }
                }
            }

            if (trackingRes.ok) {
                const text = await trackingRes.text()
                if (text) {
                    const json = JSON.parse(text)
                    setWeightHistory(json.data?.weightRecords || [])
                    setLifestyleHistory(json.data?.lifestyleLogs || [])
                }
            }

            if (lifeLogsRes.ok) {
                const text = await lifeLogsRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    if (data) setLifestyleHistory(data)
                }
            }

            if (logsRes.ok) {
                const text = await logsRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    setIntakeHistory(data || [])
                }
            }
        } catch (error) {
            console.error('Fetch member data error:', error)
        } finally {
            setLoadingData(false)
        }
    }, [])

    // Fetch members
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const response = await fetch('/api/admin/members?diet_only=true')
                if (response.ok) {
                    const text = await response.text()
                    if (text) {
                        const result = JSON.parse(text)
                        const data = result.data || result
                        const fetchedMembers = data.members || []
                        setMembers(fetchedMembers)
                        
                        const userId = searchParams.get('userId')
                        const requestedTab = searchParams.get('tab')
                        if (userId) {
                            const member = fetchedMembers.find((m: Member) => m.id === userId)
                            if (member) {
                                setSelectedMember(member)
                                if (requestedTab && ['panel', 'weight', 'graph', 'goals', 'plan'].includes(requestedTab)) {
                                    setActiveTab(requestedTab as TabType)
                                }
                                // name未指定でdeep-linkされた場合もヘッダーに会員名を出せるよう補完する
                                if (!searchParams.get('name')) {
                                    const tabParam = requestedTab ? `&tab=${requestedTab}` : ''
                                    router.replace(`/admin/diet-plan?userId=${member.id}${tabParam}&name=${encodeURIComponent(member.full_name || '')}`)
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Fetch members error:', error)
            } finally {
                setLoadingMembers(false)
            }
        }
        if (status === 'authenticated') {
            fetchMembers()
        }
    }, [status, searchParams])

    useEffect(() => {
        if (selectedMember) {
            fetchMemberData(selectedMember.id, selectedMember.access_token || '')
        }
    }, [selectedMember, fetchMemberData])

    // K-2/K-4: 「現在の目標設定」インライン保存とモーダル保存（新規作成・履歴編集）の両方から呼ぶ共通処理
    const saveGoalPlan = async (values: GoalFormValues, targetHabitTargets: HabitTargetsValues): Promise<boolean> => {
        if (!selectedMember) return false
        const normalizedValues = normalizeGoalValues(values)
        setMessage('')
        try {
            const dietSave = fetch(`/api/diet/goals?token=${selectedMember.access_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goalFormValuesToDietSaveBody(normalizedValues))
            })

            const lifestyleSave = fetch('/api/lifestyle/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedMember.id,
                    visibleItems: lifestyleSettings.visible_items,
                    visibleTabs: lifestyleSettings.visible_tabs,
                    quit_goals: quitGoals,
                    habit_targets: {
                        ...targetHabitTargets,
                        diet_day_type_targets: goalFormValuesToDayTypeSettings(normalizedValues, targetHabitTargets),
                    }
                })
            })

            const [dietRes, lifestyleRes] = await Promise.all([dietSave, lifestyleSave])

            if (dietRes.ok && lifestyleRes.ok) {
                setMessage('設定を保存しました')
                await fetchMemberData(selectedMember.id, selectedMember.access_token || '')
                setTimeout(() => setMessage(''), 3000)
                return true
            }
            const dietError = dietRes.ok ? '' : await dietRes.text()
            const lifestyleError = lifestyleRes.ok ? '' : await lifestyleRes.text()
            console.error('Save goal failed:', { dietStatus: dietRes.status, dietError, lifestyleStatus: lifestyleRes.status, lifestyleError })
            setMessage('保存できませんでした。もう一度お試しください。')
            return false
        } catch (error) {
            console.error('Save error:', error)
            setMessage('保存できませんでした。もう一度お試しください。')
            return false
        }
    }

    const updateGoalPlan = async (recordId: string, values: GoalFormValues, targetHabitTargets: HabitTargetsValues): Promise<boolean> => {
        if (!selectedMember) return false
        const normalizedValues = normalizeGoalValues(values)
        setMessage('')
        try {
            const dietSave = fetch(`/api/diet/goals/${recordId}?token=${selectedMember.access_token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goalFormValuesToDietSaveBody(normalizedValues))
            })

            const lifestyleSave = fetch('/api/lifestyle/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedMember.id,
                    visibleItems: lifestyleSettings.visible_items,
                    visibleTabs: lifestyleSettings.visible_tabs,
                    quit_goals: quitGoals,
                    habit_targets: {
                        ...targetHabitTargets,
                        diet_day_type_targets: goalFormValuesToDayTypeSettings(normalizedValues, targetHabitTargets),
                    }
                })
            })

            const [dietRes, lifestyleRes] = await Promise.all([dietSave, lifestyleSave])

            if (dietRes.ok && lifestyleRes.ok) {
                setMessage('設定を保存しました')
                await fetchMemberData(selectedMember.id, selectedMember.access_token || '')
                setTimeout(() => setMessage(''), 3000)
                return true
            }
            const dietError = dietRes.ok ? '' : await dietRes.text()
            const lifestyleError = lifestyleRes.ok ? '' : await lifestyleRes.text()
            console.error('Update goal failed:', { dietStatus: dietRes.status, dietError, lifestyleStatus: lifestyleRes.status, lifestyleError })
            setMessage('保存できませんでした。もう一度お試しください。')
            return false
        } catch (error) {
            console.error('Update error:', error)
            setMessage('保存できませんでした。もう一度お試しください。')
            return false
        }
    }

    const handleSave = async () => {
        setSaving(true)
        const ok = await saveGoalPlan(nutrientForm, habitTargets)
        setSaving(false)
        return ok
    }

    const handleDeleteHistory = async (id: string) => {
        try {
            const response = await fetch(`/api/diet/goals/${id}?token=${selectedMember?.access_token}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                setMessage('履歴を削除しました')
                await fetchMemberData(selectedMember!.id, selectedMember!.access_token || '')
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (error) {
            console.error('Delete history error:', error)
        }
    }

    // K-2: 統合グラフのバーをタップして開く編集モーダル
    const openEditGoalModal = (record: any) => {
        const baseValues = goalRecordToFormValues(record)
        const isLatestRecord = Boolean(record?.start_date && dietHistory[0]?.start_date === record.start_date)
        const initialValues = isLatestRecord && habitTargets?.diet_day_type_targets
            ? applyDayTypeSettingsToGoal(baseValues, habitTargets.diet_day_type_targets)
            : baseValues

        setGoalModal({
            mode: 'edit',
            recordId: record.id,
            initialValues,
            initialHabitTargets: habitTargets,
        })
    }

    // K-4: 新規作成時は現在の設定値をそのまま複製し、開始日は次の日曜日にする
    const openNewGoalModal = () => {
        const existingDates = new Set(dietHistory.map(goal => goal?.start_date).filter(Boolean))
        const sortedDates = Array.from(existingDates).sort()
        const latestDate = sortedDates[sortedDates.length - 1]
        let nextStartDate = nextSundayOnOrAfter(latestDate && latestDate >= today ? addDaysToDateInput(latestDate, 1) : today)
        while (existingDates.has(nextStartDate)) {
            nextStartDate = addDaysToDateInput(nextStartDate, 7)
        }

        setGoalModal({
            mode: 'new',
            initialValues: normalizeGoalValues({ ...nutrientForm, startDate: nextStartDate, title: '' }),
            initialHabitTargets: habitTargets,
        })
    }

    const handleModalSave = async (values: GoalFormValues, targetHabitTargets: HabitTargetsValues) => {
        const valuesWithSunday = goalModal?.mode === 'new'
            ? { ...values, startDate: nextSundayOnOrAfter(values.startDate) }
            : values
        const ok = goalModal?.mode === 'edit' && goalModal.recordId
            ? await updateGoalPlan(goalModal.recordId, valuesWithSunday, targetHabitTargets)
            : await saveGoalPlan(valuesWithSunday, targetHabitTargets)
        if (ok) setGoalModal(null)
    }

    const handleModalDelete = async () => {
        if (!goalModal?.recordId) return
        await handleDeleteHistory(goalModal.recordId)
        setGoalModal(null)
    }

    const latestWeight = useMemo(() => {
        const sorted = [...weightHistory]
            .filter(record => record.weight || record.weight_kg)
            .sort((a, b) => String(b.date || b.created_at || '').localeCompare(String(a.date || a.created_at || '')))
        const latest = sorted[0]
        const value = latest?.weight ?? latest?.weight_kg
        return value ? Number(value) : null
    }, [weightHistory])

    // アラゴン式カロリー計算（現在体重・目標体重・期間・週トレ時間・NEATから算出）
    const aragonResult = useMemo(() => {
        const targetWeight = parseFloat(aragonInput.targetWeight)
        const periodWeeks = parseFloat(aragonInput.periodWeeks)
        const weeklyTrainingHours = parseFloat(aragonInput.weeklyTrainingHours)
        if (!latestWeight || !targetWeight || !periodWeeks || Number.isNaN(weeklyTrainingHours)) return null
        return calculateAragonPlan({
            currentWeightKg: latestWeight,
            targetWeightKg: targetWeight,
            periodWeeks,
            weeklyTrainingHours,
            neat: aragonInput.neat,
        })
    }, [latestWeight, aragonInput])

    // O-7: 目標体重スライダーの初期位置。体重記録が取得できた最初の1回だけ、
    // 現在体重から2kg減を初期値にする（リアルタイム反映のスライダーは
    // 数値入力と違い空欄のままだと表示位置を決められないため）
    useEffect(() => {
        if (latestWeight && !aragonWeightInitialized.current) {
            aragonWeightInitialized.current = true
            setAragonInput(prev => prev.targetWeight
                ? prev
                : { ...prev, targetWeight: String(Math.round(Math.max(30, latestWeight - 2) * 2) / 2) }
            )
        }
    }, [latestWeight])

    // O-7: 目標期間スライダー下の推奨帯ゲージ用の計算。
    // 安全上限(体重の1%/週)に対して現在のペースがどこにあるかを可視化する。
    const aragonPeriodSliderMin = 1
    const aragonPeriodSliderMax = 52
    const aragonPeriodWeeksNum = parseFloat(aragonInput.periodWeeks) || aragonPeriodSliderMin
    const aragonParsedTargetWeight = parseFloat(aragonInput.targetWeight)
    const aragonMaxSafeWeeklyLossKg = latestWeight ? Math.round(latestWeight * 0.01 * 100) / 100 : 0
    const aragonWeightLossNeeded = (latestWeight && !Number.isNaN(aragonParsedTargetWeight))
        ? latestWeight - aragonParsedTargetWeight
        : 0
    const aragonSafeMinPeriodWeeks = (aragonWeightLossNeeded > 0 && aragonMaxSafeWeeklyLossKg > 0)
        ? Math.ceil(aragonWeightLossNeeded / aragonMaxSafeWeeklyLossKg)
        : null
    const aragonSafeBandPct = aragonSafeMinPeriodWeeks !== null
        ? Math.min(100, Math.max(0, ((aragonSafeMinPeriodWeeks - aragonPeriodSliderMin) / (aragonPeriodSliderMax - aragonPeriodSliderMin)) * 100))
        : 0
    const aragonSelectedPeriodPct = Math.min(100, Math.max(0, ((aragonPeriodWeeksNum - aragonPeriodSliderMin) / (aragonPeriodSliderMax - aragonPeriodSliderMin)) * 100))
    const aragonRequestedPaceKg = (latestWeight && !Number.isNaN(aragonParsedTargetWeight) && aragonPeriodWeeksNum > 0)
        ? Math.round(((latestWeight - aragonParsedTargetWeight) / aragonPeriodWeeksNum) * 100) / 100
        : null
    const aragonPaceExceedsSafe = aragonRequestedPaceKg !== null && aragonRequestedPaceKg > aragonMaxSafeWeeklyLossKg

    const weeklySummary = useMemo(() => {
        const { start, end, prevStart, prevEnd } = getWeekRange(summaryWeekOffset)
        const weekIntake = filterByRange(intakeHistory, start, end)
        const weekLifestyle = filterByRange(lifestyleHistory, start, end)
        const weekWeight = filterByRange(weightHistory, start, end)
        const prevWeight = filterByRange(weightHistory, prevStart, prevEnd)
        const prevLifestyle = filterByRange(lifestyleHistory, prevStart, prevEnd)
        const targetDateStr = end.toLocaleDateString('sv-SE')
        const currentDietGoal = [...dietHistory]
            .filter(goal => goal?.start_date && goal.start_date <= targetDateStr)
            .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
        const effectiveTargetCalories = Number(currentDietGoal?.calories || nutrientForm.targetCalories)
        const effectiveTargetProtein = Number(currentDietGoal?.protein || nutrientForm.protein)
        const effectiveTargetFat = Number(currentDietGoal?.fat || nutrientForm.fat)
        const effectiveTargetCarbs = Number(currentDietGoal?.carbs || nutrientForm.carbs)
        const effectiveTargetFiber = Number(currentDietGoal?.fiber || nutrientForm.fiber || DEFAULT_FIBER)

        const avgCalories = average(weekIntake, 'calories')
        const avgProtein = average(weekIntake, 'protein')
        const avgFat = average(weekIntake, 'fat')
        const avgCarbs = average(weekIntake, 'carbs')
        const avgFiber = average(weekIntake, 'fiber')
        const avgWeight = average(weekWeight, 'weight') ?? average(weekWeight, 'weight_kg') ?? average(weekLifestyle, 'weight') ?? average(weekLifestyle, 'weight_kg')
        const prevAvgWeight = average(prevWeight, 'weight') ?? average(prevWeight, 'weight_kg') ?? average(prevLifestyle, 'weight') ?? average(prevLifestyle, 'weight_kg')
        const avgSteps = average(weekLifestyle, 'steps')
        const avgWater = averageByKeys(weekLifestyle, ['water_liters', 'water'])
        const prevAvgWater = averageByKeys(prevLifestyle, ['water_liters', 'water'])
        const avgSleep = averageByKeys(weekLifestyle, ['sleep_hours', 'sleep'])
        const workouts = weekLifestyle.filter(record => Number(record?.habits?.workout || record?.workout || 0) > 0).length

        return {
            dateLabel: `${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1}/${end.getDate()}`,
            targetCalories: effectiveTargetCalories,
            targetProtein: effectiveTargetProtein,
            targetFat: effectiveTargetFat,
            targetCarbs: effectiveTargetCarbs,
            targetFiber: effectiveTargetFiber,
            recordedMeals: weekIntake.length,
            recordedHabits: weekLifestyle.length,
            avgCalories,
            calorieDiff: avgCalories === null ? null : Math.round(avgCalories - effectiveTargetCalories),
            avgProtein,
            avgFat,
            avgCarbs,
            avgFiber,
            avgWeight,
            weightDiff: avgWeight !== null && prevAvgWeight !== null ? avgWeight - prevAvgWeight : null,
            avgSteps,
            avgWater,
            waterDiff: avgWater !== null && prevAvgWater !== null ? avgWater - prevAvgWater : null,
            avgSleep,
            workouts,
        }
    }, [intakeHistory, lifestyleHistory, weightHistory, dietHistory, nutrientForm.targetCalories, summaryWeekOffset])

    const goalChartData = useMemo(() => {
        const sorted = [...dietHistory]
            .filter(goal => goal?.start_date)
            .sort((a, b) => a.start_date.localeCompare(b.start_date))

        return sorted.map((goal, index) => {
            const [year, month, day] = goal.start_date.split('-')
            const protein = Math.round(Number(goal.protein || 0))
            const fat = Math.round(Number(goal.fat || 0))
            const carbs = Math.round(Number(goal.carbs || 0))
            const calories = Number(goal.calories || 0)
            const isLatest = index === sorted.length - 1
            const dayTypeEnabled = Boolean(goal.day_type_enabled) || (isLatest && nutrientForm.dayTypeEnabled)
            const trainingCalories = Math.round(Number(
                goal.training_calories ?? (isLatest ? nutrientForm.trainingCalories : null) ?? calories
            ))
            const restCalories = Math.round(Number(
                goal.rest_calories ?? (isLatest ? nutrientForm.restCalories : null) ?? calories
            ))

            const startDate = new Date(goal.start_date)
            const next = sorted[index + 1]
            const endDate = next ? new Date(next.start_date) : new Date()
            const periodDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
            const isOngoing = !next
            const endLabel = isOngoing
                ? '継続中'
                : `${endDate.getMonth() + 1}/${endDate.getDate()}`

            return {
                date: goal.start_date,
                displayDate: `${Number(month)}/${Number(day)}`,
                fullDate: `${year}/${Number(month)}/${Number(day)}`,
                periodDays,
                periodLabel: `${Number(month)}/${Number(day)}〜${endLabel}（${periodDays}日間）`,
                isCurrent: isLatest,
                dayTypeEnabled,
                calories: Math.round(calories),
                trainingCalories,
                restCalories,
                protein,
                fat,
                carbs,
                trainingProtein: Math.round(Number(goal.training_protein ?? (isLatest ? nutrientForm.trainingProtein : null) ?? protein)),
                trainingFat: Math.round(Number(goal.training_fat ?? (isLatest ? nutrientForm.trainingFat : null) ?? fat)),
                trainingCarbs: Math.round(Number(goal.training_carbs ?? (isLatest ? nutrientForm.trainingCarbs : null) ?? carbs)),
                restProtein: Math.round(Number(goal.rest_protein ?? (isLatest ? nutrientForm.restProtein : null) ?? protein)),
                restFat: Math.round(Number(goal.rest_fat ?? (isLatest ? nutrientForm.restFat : null) ?? fat)),
                restCarbs: Math.round(Number(goal.rest_carbs ?? (isLatest ? nutrientForm.restCarbs : null) ?? carbs)),
            }
        })
    }, [dietHistory, nutrientForm])

    // アラゴン式の算出結果（カロリー・P/F/Cとも既に確定済み）をそのまま目標に反映する
    const applyAragonPlanToGoal = () => {
        if (!aragonResult) return
        setNutrientForm(prev => ({
            ...prev,
            protein: aragonResult.protein,
            fat: aragonResult.fat,
            carbs: aragonResult.carbs,
            sugar: Math.max(0, aragonResult.carbs - (prev.fiber || DEFAULT_FIBER)),
            targetCalories: caloriesFromMacros(aragonResult.protein, aragonResult.fat, aragonResult.carbs),
            title: prev.title || 'アラゴン式計算から作成',
        }))
        setEditingCurrentPlan(true)
    }

    if (status === 'loading' || loadingMembers) {
        return <div className="min-h-screen flex items-center justify-center bg-surface-base"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>
    }

    const filteredMembers = members.filter(m => 
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`min-h-screen bg-surface-base pb-12 text-text-primary ${selectedMember ? 'pt-0' : 'pt-4'}`}>
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
                {!selectedMember ? (
                    <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
                        <div className="p-8 border-b border-border-subtle">
                            <h2 className="text-xl font-normal mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-brand-500 rounded-full"></span>
                                会員を選択
                            </h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="名前やメールアドレスで検索..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-surface-base border border-border-subtle rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-normal"
                                />
                                <Icon name="search" size={24} className="absolute left-4 top-4.5 text-text-muted" />
                            </div>
                        </div>
                        <div className="divide-y divide-border-subtle max-h-[60vh] overflow-y-auto px-4 pb-4">
                            {filteredMembers.map(member => (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    fullWidth
                                    key={member.id}
                                    onClick={() => {
                                        setSelectedMember(member)
                                        // ヘッダーのタイトル(Navigation.tsx)が会員名を表示できるよう、URLにも反映しておく
                                        router.replace(`/admin/diet-plan?userId=${member.id}&name=${encodeURIComponent(member.full_name || '')}`)
                                    }}
                                    className="w-full flex items-center px-6 py-5 hover:bg-brand-500/10 transition-all rounded-2xl group mt-2"
                                >
                                    <div className="flex-1 flex items-center gap-4 text-left">
                                        <div className={`w-3 h-3 rounded-full ${getStatusDotColor(member.status)} shadow-sm`} />
                                        <div>
                                            <div className="font-normal text-text-primary group-hover:text-brand-600 transition-colors">{member.full_name}</div>
                                            <div className="text-xs font-normal text-text-muted uppercase tracking-widest">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-normal text-text-muted bg-surface-base px-4 py-2 rounded-full group-hover:bg-brand-500 group-hover:text-white transition-all uppercase tracking-widest">選択</div>
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 mt-0">
                        {/* Q-3: ライトモード時代のrgba(249,250,251,...)という白いシャドウが黒背景で
                            発光ブロブのように見えてしまっていたため、素の背景色のみで区切る形に変更 */}
                        <div className="sticky top-16 z-40 max-w-2xl mx-auto bg-surface-base px-1 pt-2 pb-2">
                            <div className="grid grid-cols-5 bg-surface-raised/95 backdrop-blur-md p-1.5 rounded-2xl border border-border-subtle shadow-sm gap-1">
                                {[
                                    { id: 'panel', label: '週間' },
                                    { id: 'weight', label: '体重' },
                                    { id: 'graph', label: 'グラフ' },
                                    { id: 'goals', label: '目標' },
                                    { id: 'plan', label: 'カロリー\n設定' }
                                ].map(tab => (
                                    <Button type="button" variant="ghost" size="sm" key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`min-w-0 h-12 px-1 text-xs sm:text-sm leading-tight font-normal transition-all duration-300 rounded-2xl flex items-center justify-center text-center ${activeTab === tab.id ? 'bg-surface-overlay text-text-primary shadow-xl scale-[1.02]' : 'text-text-muted hover:text-text-secondary hover:bg-surface-base/50'}`}>
                                        <span className="whitespace-pre-line">{tab.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* J-1: 週間パネルタブ（初期表示）。WeeklySummaryPanel全項目 + 折りたたみ「日別の記録」 */}
                        {!loadingData && activeTab === 'panel' && (
                            <div className="space-y-4 animate-fadeIn">
                                <WeeklySummaryTab
                                    userId={selectedMember.id}
                                    token={selectedMember.access_token!}
                                    isAdmin={true}
                                    weekOffset={summaryWeekOffset}
                                    onWeekOffsetChange={setSummaryWeekOffset}
                                    showWeekSwitcher={true}
                                />

                                <div className="bg-surface-raised rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        fullWidth
                                        onClick={() => setShowDailyRecords(!showDailyRecords)}
                                        className="w-full flex items-center justify-between px-8 py-6"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                                            <h2 className="text-base font-normal text-text-primary">日別の記録</h2>
                                        </div>
                                        <Icon name="chevronDown" size={20} className={`text-text-muted transition-transform duration-300 ${showDailyRecords ? 'rotate-180' : ''}`} />
                                    </Button>
                                    {showDailyRecords && (
                                        <div className="overflow-x-auto px-8 pb-8 animate-fadeIn">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-border-subtle">
                                                        <th className="py-4 text-xs font-normal text-text-muted uppercase tracking-widest">日付</th>
                                                        <th className="py-4 text-xs font-normal text-text-muted uppercase tracking-widest text-right">カロリー</th>
                                                        <th className="py-4 text-xs font-normal text-text-muted uppercase tracking-widest text-center">P/F/C (g)</th>
                                                        <th className="py-4 text-xs font-normal text-text-muted uppercase tracking-widest text-center">糖質/繊維/塩</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border-subtle">
                                                    {intakeHistory.length > 0 ? intakeHistory.map((h, i) => (
                                                        <tr key={i} className="group hover:bg-surface-base transition-colors">
                                                            <td className="py-5 text-sm font-normal text-text-primary">
                                                                {h.date.slice(5).replace(/-/g, '/')}
                                                                {h.image_url && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-brand-500/15 text-brand-300 uppercase tracking-tighter font-bold">Image</span>}
                                                            </td>
                                                            <td className="py-5 text-sm font-normal text-text-primary text-right tabular-nums">{h.calories?.toLocaleString()} <span className="text-xs text-text-muted">kcal</span></td>
                                                            <td className="py-5 text-sm font-normal text-text-secondary text-center tabular-nums">
                                                                <span className="text-amber-600">{Math.round(h.protein)}</span>
                                                                <span className="mx-1 text-text-muted">/</span>
                                                                <span className="text-purple-500">{Math.round(h.fat)}</span>
                                                                <span className="mx-1 text-text-muted">/</span>
                                                                <span className="text-blue-600">{Math.round(h.carbs)}</span>
                                                            </td>
                                                            <td className="py-5 text-sm font-normal text-text-secondary text-center tabular-nums">
                                                                <span className="text-text-secondary">{Math.round(h.sugar)}</span>
                                                                <span className="mx-1 text-text-muted">/</span>
                                                                <span className="text-text-secondary">{Math.round(h.fiber)}</span>
                                                                <span className="mx-1 text-text-muted">/</span>
                                                                <span className="text-text-muted">{h.salt ?? 0}</span>
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={4} className="py-20 text-center text-sm font-normal text-text-muted italic">記録がまだありません</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* J-1: 体重タブ。PR-J1時点ではWeightWeeklyCompareのみ（推移グラフ+目標体重ラインはPR-J2で追加） */}
                        {!loadingData && activeTab === 'weight' && (
                            <WeightTab userId={selectedMember.id} token={selectedMember.access_token!} isAdmin={true} />
                        )}

                        {/* J-1: グラフタブ。既存AnalyzeTabのグラフ群一式（期間切替そのまま） */}
                        {!loadingData && activeTab === 'graph' && (
                            <AnalyzeTab userId={selectedMember.id} token={selectedMember.access_token!} isAdmin={true} todayDraft={sharedState} showWeeklyGoals={false} />
                        )}

                        {/* M-2: 目標タブ（体重・習慣の成果ゴール。期限＋達成/未達成を管理） */}
                        {!loadingData && activeTab === 'goals' && (
                            <GoalsTab userId={selectedMember.id} token={selectedMember.access_token!} isAdmin={true} />
                        )}

                        {!loadingData && activeTab === 'plan' && (
                            <div className="space-y-12 pb-40 animate-fadeIn">
                                {/* 基礎情報からカロリー計算（アラゴン式）: 最初の目標設定時だけ必要なため、
                                    目標設定の履歴が既にある会員には表示しない */}
                                {dietHistory.length === 0 && (
                                <div className="bg-surface-raised rounded-2xl p-8 sm:p-10 shadow-sm border border-border-subtle space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                                        <h2 className="text-xl font-normal text-text-primary tracking-tight">基礎情報からカロリー計算</h2>
                                    </div>

                                    {!latestWeight ? (
                                        <div className="rounded-2xl bg-surface-base border border-border-subtle p-5 text-sm text-text-secondary leading-relaxed">
                                            計算には現在の体重の記録が必要です。会員に体重を記録してもらうと自動で計算できるようになります。
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <DietProfileStat label="現在の体重" value={`${latestWeight}kg`} />
                                                <div className="space-y-1">
                                                    <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">週のトレーニング時間</label>
                                                    <input type="number" value={aragonInput.weeklyTrainingHours} onChange={(e) => setAragonInput(prev => ({ ...prev, weeklyTrainingHours: e.target.value }))} className="w-full bg-surface-base border-none rounded-2xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                                                </div>
                                            </div>

                                            {/* O-7: 数値入力→スライダー化。既存の計算ロジック(dietGoalCalc.ts)は無変更 */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-xs font-normal text-text-muted uppercase tracking-widest">最終目標体重</label>
                                                    <span className="text-sm font-semibold text-text-primary tabular-nums">
                                                        {aragonInput.targetWeight || '--'}<span className="text-xs font-normal text-text-muted ml-0.5">kg</span>
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={Math.max(30, Math.floor(latestWeight - 30))}
                                                    max={Math.ceil(latestWeight + 10)}
                                                    step={0.5}
                                                    value={aragonInput.targetWeight || latestWeight}
                                                    onChange={(e) => setAragonInput(prev => ({ ...prev, targetWeight: e.target.value }))}
                                                    className="w-full h-2 accent-brand-600 cursor-pointer"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-xs font-normal text-text-muted uppercase tracking-widest">目標期間</label>
                                                    <span className="text-sm font-semibold text-text-primary tabular-nums">
                                                        {aragonInput.periodWeeks}<span className="text-xs font-normal text-text-muted ml-0.5">週間</span>
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={aragonPeriodSliderMin}
                                                    max={aragonPeriodSliderMax}
                                                    step={1}
                                                    value={aragonInput.periodWeeks}
                                                    onChange={(e) => setAragonInput(prev => ({ ...prev, periodWeeks: e.target.value }))}
                                                    className="w-full h-2 accent-brand-600 cursor-pointer"
                                                />
                                                {/* O-6: 推奨帯ゲージ。安全上限(体重の1%/週)以内かをペース選択と同時に可視化する */}
                                                <div className="relative h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                                                    {aragonSafeMinPeriodWeeks !== null && (
                                                        <>
                                                            <div className="absolute inset-y-0 left-0 bg-state-danger-500/20" style={{ width: `${aragonSafeBandPct}%` }} />
                                                            <div className="absolute inset-y-0 bg-state-success-500/20" style={{ left: `${aragonSafeBandPct}%`, right: 0 }} />
                                                        </>
                                                    )}
                                                    <div
                                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-surface-raised border-2 border-brand-600 shadow-sm"
                                                        style={{ left: `${aragonSelectedPeriodPct}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between px-1">
                                                    <span className={`text-xs ${aragonPaceExceedsSafe ? 'text-state-danger-600' : 'text-text-muted'}`}>
                                                        {aragonRequestedPaceKg === null ? '' : aragonRequestedPaceKg > 0 ? `週${aragonRequestedPaceKg}kg減` : aragonRequestedPaceKg < 0 ? `週${Math.abs(aragonRequestedPaceKg)}kg増` : '変化なし'}
                                                    </span>
                                                    <span className="text-xs text-text-muted">安全上限 週{aragonMaxSafeWeeklyLossKg}kg</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">日常の活動量（NEAT）</label>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {NEAT_LEVELS.map(level => (
                                                        <Button
                                                            type="button"
                                                            variant={aragonInput.neat === level.value ? 'primary' : 'secondary'}
                                                            size="sm"
                                                            key={level.value}
                                                            onClick={() => setAragonInput(prev => ({ ...prev, neat: level.value }))}
                                                            className={`text-xs py-3 px-2 rounded-2xl transition-colors ${aragonInput.neat === level.value ? 'bg-brand-700 text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-overlay'}`}
                                                        >
                                                            {level.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            {aragonResult ? (
                                                <>
                                                    {aragonResult.paceExceeded && (
                                                        <div className="rounded-2xl bg-amber-500/15 border border-amber-500/25 p-4 text-xs text-amber-300 leading-relaxed">
                                                            希望ペース（週{aragonResult.requestedWeeklyLossKg}kg減）が安全上限（週{aragonResult.maxSafeWeeklyLossKg}kg減）を超えています。筋肉を落とさないため、12週間後の中間目標体重 {aragonResult.tbwKg}kg を採用して計算しています。
                                                        </div>
                                                    )}
                                                    <div className="bg-surface-base/80 rounded-2xl p-8 text-center border border-border-subtle/50">
                                                        <p className="text-xs font-normal text-text-muted mb-1 uppercase tracking-widest">目標摂取カロリー</p>
                                                        <div className="flex items-baseline justify-center gap-1 mb-4">
                                                            <span className="text-4xl font-normal text-text-primary tabular-nums">{aragonResult.targetCalories.toLocaleString()}</span>
                                                            <span className="text-sm font-normal text-text-muted">kcal / 日</span>
                                                        </div>
                                                        <p className="text-xs text-text-secondary">
                                                            <span className="text-amber-500">P {aragonResult.protein}g</span>
                                                            <span className="mx-1 text-text-muted">/</span>
                                                            <span className="text-purple-500">F {aragonResult.fat}g</span>
                                                            <span className="mx-1 text-text-muted">/</span>
                                                            <span className="text-blue-500">C {aragonResult.carbs}g</span>
                                                        </p>
                                                        <Button type="button" onClick={applyAragonPlanToGoal} className="mt-4 w-full sm:w-auto px-6 py-3 rounded-2xl bg-brand-700 text-white text-sm hover:bg-brand-800 transition-colors">目標に反映</Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="rounded-2xl bg-surface-base border border-border-subtle p-5 text-sm text-text-secondary leading-relaxed">
                                                    最終目標体重・目標期間・週のトレーニング時間を入力すると計算されます。
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                )}

                                {/* L-2: 現在の目標設定。デフォルトは閲覧専用のコンパクト表示、「編集」で統一フォームを展開 */}
                                <div className="bg-surface-raised rounded-2xl p-8 sm:p-10 shadow-sm border border-border-subtle">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                                            <h2 className="text-xl font-normal text-text-primary tracking-tight">現在の目標設定</h2>
                                        </div>
                                        {!editingCurrentPlan && (
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCurrentPlan(true)} className="text-xs text-brand-300 bg-brand-500/15 px-4 py-2 rounded-full hover:bg-brand-500/25">編集</Button>
                                        )}
                                    </div>
                                    {editingCurrentPlan ? (
                                        <GoalPlanForm
                                            values={nutrientForm}
                                            onValuesChange={setNutrientForm}
                                            habitTargets={habitTargets}
                                            onHabitTargetsChange={setHabitTargets}
                                            showStartDate={false}
                                            onSave={async () => {
                                                const ok = await handleSave()
                                                if (ok) setEditingCurrentPlan(false)
                                            }}
                                            saving={saving}
                                            saveLabel="設定を保存"
                                            onCancel={() => setEditingCurrentPlan(false)}
                                        />
                                    ) : (
                                        <div className="space-y-5">
                                            {nutrientForm.dayTypeEnabled ? (
                                                <div className="space-y-3">
                                                    {[
                                                        {
                                                            label: '筋トレ日',
                                                            tone: 'training',
                                                            prefix: 'training',
                                                            calories: nutrientForm.trainingCalories || nutrientForm.targetCalories,
                                                            protein: nutrientForm.trainingProtein ?? nutrientForm.protein,
                                                            fat: nutrientForm.trainingFat ?? nutrientForm.fat,
                                                            carbs: nutrientForm.trainingCarbs ?? nutrientForm.carbs,
                                                        },
                                                        {
                                                            label: '休養日',
                                                            tone: 'rest',
                                                            prefix: 'rest',
                                                            calories: nutrientForm.restCalories || nutrientForm.targetCalories,
                                                            protein: nutrientForm.restProtein ?? nutrientForm.protein,
                                                            fat: nutrientForm.restFat ?? nutrientForm.fat,
                                                            carbs: nutrientForm.restCarbs ?? nutrientForm.carbs,
                                                        },
                                                    ].map(item => (
                                                        <div key={item.label} className={`rounded-2xl border px-4 py-4 ${item.tone === 'training' ? 'bg-brand-500/10 border-brand-500/25' : 'bg-surface-base border-border-subtle'}`}>
                                                            <p className={`text-xs ${item.tone === 'training' ? 'text-brand-300' : 'text-blue-300'}`}>{item.label}</p>
                                                            <p className="mt-1 text-3xl text-text-primary tabular-nums">{Math.round(Number(item.calories)).toLocaleString()}<span className="ml-1 text-sm text-text-muted">kcal</span></p>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {[
                                                                    ['P', item.protein, 'text-red-300'],
                                                                    ['F', item.fat, 'text-blue-300'],
                                                                    ['C', item.carbs, 'text-green-300'],
                                                                    ['水分', `${habitTargets.diet_day_type_targets?.[`${item.prefix}_water`] ?? habitTargets.water ?? 2}L`, 'text-text-secondary'],
                                                                    ['歩数', `${habitTargets.diet_day_type_targets?.[`${item.prefix}_steps`] ?? habitTargets.steps ?? 8000}`, 'text-text-secondary'],
                                                                    ['筋トレ', `${habitTargets.diet_day_type_targets?.[`${item.prefix}_workout`] ?? habitTargets.workout ?? 1}回`, 'text-text-secondary'],
                                                                    ['睡眠', `${habitTargets.diet_day_type_targets?.[`${item.prefix}_sleep`] ?? habitTargets.sleep ?? 7}h`, 'text-text-secondary'],
                                                                ].map(([label, value, color]) => (
                                                                    <span key={label} className="rounded-full bg-surface-base border border-border-subtle px-3 py-1.5 text-xs text-text-secondary tabular-nums">
                                                                        <span className={String(color)}>{label}</span> {value}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl bg-surface-base border border-border-subtle px-4 py-4">
                                                    <p className="text-4xl font-normal text-text-primary tabular-nums">
                                                        {Math.round(nutrientForm.targetCalories).toLocaleString()}<span className="ml-1 text-lg text-text-muted">kcal</span>
                                                    </p>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {[
                                                            ['P', `${nutrientForm.protein}g`, 'text-red-300'],
                                                            ['F', `${nutrientForm.fat}g`, 'text-blue-300'],
                                                            ['C', `${nutrientForm.carbs}g`, 'text-green-300'],
                                                            ['水分', `${habitTargets.water ?? 2}L`, 'text-text-secondary'],
                                                            ['歩数', `${habitTargets.steps ?? 8000}`, 'text-text-secondary'],
                                                            ['筋トレ', `${habitTargets.workout ?? 1}回`, 'text-text-secondary'],
                                                            ['睡眠', `${habitTargets.sleep ?? 7}h`, 'text-text-secondary'],
                                                        ].map(([label, value, color]) => (
                                                            <span key={label} className="rounded-full bg-surface-base border border-border-subtle px-3 py-1.5 text-xs text-text-secondary tabular-nums">
                                                                <span className={String(color)}>{label}</span> {value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* K-1/K-2/L-1: 統合グラフ（ホバー/タップでツールチップ→編集は2段階）。履歴表は廃止 */}
                                {goalChartData.length > 0 && (
                                    <GoalHistoryCharts
                                        data={goalChartData}
                                        habitTargets={habitTargets}
                                        onEditRequest={(date) => {
                                            const record = dietHistory.find(h => h.start_date === date)
                                            if (record) openEditGoalModal(record)
                                        }}
                                    />
                                )}

                                {/* L-4: 目標履歴の一番下に配置 */}
                                <Button type="button" fullWidth onClick={openNewGoalModal} className="w-full text-sm text-white bg-brand-700 hover:bg-brand-800 px-4 py-4 rounded-2xl shadow-sm transition-colors">新しい目標を追加</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {message && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-surface-overlay text-text-primary border border-border-strong px-8 py-4 rounded-2xl font-normal shadow-xl z-50 animate-slideUp">{message}</div>}

            {/* K-2: 履歴バーのタップ編集・新規プラン作成モーダル */}
            {goalModal && (
                <GoalEditModal
                    title={goalModal.mode === 'new' ? '新規プランの作成' : 'プランの編集'}
                    initialValues={goalModal.initialValues}
                    initialHabitTargets={goalModal.initialHabitTargets}
                    onClose={() => setGoalModal(null)}
                    onSave={handleModalSave}
                    onDelete={goalModal.mode === 'edit' ? handleModalDelete : undefined}
                />
            )}
        </div>
    );
}

function DietProfileStat({ label, value }: { label: string, value: string }) {
    return (
        <div className="rounded-2xl bg-surface-base border border-border-subtle p-4">
            <div className="text-xs text-text-muted uppercase tracking-widest">{label}</div>
            <div className="mt-1 text-lg text-text-primary">{value}</div>
        </div>
    )
}

function GoalHistoryCharts({ data, habitTargets, onEditRequest }: { data: any[], habitTargets: any, onEditRequest: (date: string) => void }) {
    const [selectedDate, setSelectedDate] = useState<string | null>(data[data.length - 1]?.date || null)
    const latest = data[data.length - 1]
    const selected = data.find(row => row.date === selectedDate) || latest
    const chartRows = data.slice(-6)
    const chart = { width: 320, height: 198, left: 38, right: 14, top: 20, bottom: 30 }
    const plotWidth = chart.width - chart.left - chart.right
    const plotHeight = chart.height - chart.top - chart.bottom
    const formatKcal = (value: number) => Math.round(value).toLocaleString()
    const displayCalories = (row: any) => row.dayTypeEnabled ? row.trainingCalories : row.calories
    const displayProtein = (row: any) => row.dayTypeEnabled ? row.trainingProtein : row.protein
    const displayFat = (row: any) => row.dayTypeEnabled ? row.trainingFat : row.fat
    const maxCalories = Math.max(...chartRows.map(displayCalories), 1)
    const domainMax = Math.max(500, Math.ceil(maxCalories / 500) * 500)
    const yTicks = Array.from({ length: Math.floor(domainMax / 500) }, (_, index) => (index + 1) * 500).reverse()
    const valueToY = (value: number) => chart.top + ((domainMax - value) / Math.max(1, domainMax)) * plotHeight
    const totalDays = chartRows.reduce((sum, row) => sum + row.periodDays, 0) || 1
    const minBarWidth = 10
    const rawWidths = chartRows.map(row => Math.max(minBarWidth, (row.periodDays / totalDays) * plotWidth))
    const widthScale = plotWidth / rawWidths.reduce((sum, width) => sum + width, 0)
    const barWidths = rawWidths.map(width => width * widthScale)
    const barXs = barWidths.reduce<number[]>((positions, width, index) => {
        positions.push(index === 0 ? chart.left : positions[index - 1] + barWidths[index - 1])
        return positions
    }, [])
    const getSegments = (row: any) => {
        const calories = displayCalories(row)
        const proteinCalories = Math.max(0, Math.round(displayProtein(row) * 4))
        const fatCalories = Math.max(0, Math.round(displayFat(row) * 9))
        const carbCalories = Math.max(0, calories - proteinCalories - fatCalories)
        return [
            { key: 'C', value: carbCalories, color: '#e5c07b' },
            { key: 'F', value: fatCalories, color: '#9a5b2e' },
            { key: 'P', value: proteinCalories, color: '#f97316' },
        ]
    }
    const getPfcValues = (row: any, prefix?: 'training' | 'rest') => {
        const p = prefix ? row[`${prefix}Protein`] : row.protein
        const f = prefix ? row[`${prefix}Fat`] : row.fat
        const c = prefix ? row[`${prefix}Carbs`] : row.carbs
        return [
            ['P', p],
            ['F', f],
            ['C', c],
        ]
    }
    const renderPfcChips = (row: any, prefix?: 'training' | 'rest') => {
        return (
            <>
                {getPfcValues(row, prefix).map(([label, value]) => (
                    <span key={label} className="rounded-full bg-surface-base border border-border-subtle px-3 py-1.5 text-xs text-text-secondary tabular-nums">
                        <span className={label === 'P' ? 'text-orange-300' : label === 'F' ? 'text-amber-700' : 'text-amber-200'}>{label}</span> {value}g
                    </span>
                ))}
            </>
        )
    }
    const renderLifeChips = (prefix?: 'training' | 'rest') => {
        const dayTypeTargets = habitTargets.diet_day_type_targets || {}
        const valueFor = (key: 'water' | 'steps' | 'workout' | 'sleep', fallback: number) => (
            prefix ? dayTypeTargets[`${prefix}_${key}`] : undefined
        ) ?? habitTargets[key] ?? fallback
        return (
        <>
            {[
                ['水分', `${valueFor('water', 2)}L`],
                ['歩数', `${valueFor('steps', 8000)}`],
                ['筋トレ', `${valueFor('workout', 1)}回`],
                ['睡眠', `${valueFor('sleep', 7)}h`],
            ].map(([label, value]) => (
                <span key={label} className="rounded-full bg-surface-base border border-border-subtle px-3 py-1.5 text-xs text-text-secondary tabular-nums">
                    <span className="text-text-muted">{label}</span> {value}
                </span>
            ))}
        </>
        )
    }
    const renderTargetSet = (row: any, type?: 'training' | 'rest') => {
        const isTraining = type === 'training'
        const label = type ? (isTraining ? '筋トレ日' : '休養日') : null
        const calories = type === 'training'
            ? row.trainingCalories
            : type === 'rest'
                ? row.restCalories
                : row.calories
        return (
            <div className={`rounded-2xl border px-4 py-4 ${isTraining ? 'bg-brand-500/10 border-brand-500/25' : 'bg-surface-base border-border-subtle'}`}>
                {label && <p className={`text-xs ${isTraining ? 'text-brand-300' : 'text-blue-300'}`}>{label}</p>}
                <p className={`${label ? 'mt-1' : ''} text-3xl text-text-primary tabular-nums`}>
                    {formatKcal(calories)}<span className="ml-1 text-sm text-text-muted">kcal</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {renderPfcChips(row, type)}
                    {renderLifeChips(type)}
                </div>
            </div>
        )
    }
    useEffect(() => {
        setSelectedDate(data[data.length - 1]?.date || null)
    }, [data])

    return (
        <div className="bg-surface-raised rounded-2xl p-5 sm:p-8 shadow-sm border border-border-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                    <div>
                        <h2 className="text-xl font-normal text-text-primary tracking-tight">目標設定の推移</h2>
                    </div>
                </div>
                <span className="rounded-full bg-surface-base border border-border-subtle px-3 py-1 text-xs text-text-secondary whitespace-nowrap">{data.length}件</span>
            </div>

            <div className="rounded-2xl bg-surface-base/80 border border-border-subtle p-4">
                <div className="mb-3">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-normal text-text-primary">カロリー推移</h3>
                        <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs text-brand-300">筋トレ日基準</span>
                    </div>
                </div>
                {chartRows.length === 1 ? (
                    <div className="h-44 rounded-2xl bg-surface-raised border border-border-subtle flex flex-col items-center justify-center text-center">
                        <p className="text-3xl text-text-primary tabular-nums">
                            {formatKcal(chartRows[0].dayTypeEnabled ? chartRows[0].trainingCalories : chartRows[0].calories)}<span className="ml-1 text-sm text-text-muted">kcal</span>
                        </p>
                        <p className="mt-2 text-xs text-text-muted">変更履歴はまだありません</p>
                    </div>
                ) : (
                    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="w-full h-auto overflow-visible">
                        {yTicks.map(tick => {
                            const y = valueToY(tick)
                            return (
                                <g key={tick}>
                                    <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
                                    <text x={chart.left - 6} y={y + 3} textAnchor="end" className="fill-text-muted text-xs">{tick}</text>
                                </g>
                            )
                        })}
                        <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.top + plotHeight} stroke="rgba(255,255,255,0.16)" />
                        <line x1={chart.left} x2={chart.width - chart.right} y1={chart.top + plotHeight} y2={chart.top + plotHeight} stroke="rgba(255,255,255,0.16)" />
                        {chartRows.map((row, index) => {
                            const x = barXs[index]
                            const barWidth = Math.max(4, barWidths[index] - 2)
                            const calories = displayCalories(row)
                            const isSelected = selected?.date === row.date
                            const showSegmentLabels = row.periodDays >= 7 && barWidth >= 34
                            let stackBase = 0
                            return (
                                <g
                                    key={row.date}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setSelectedDate(row.date)}
                                    onClick={() => setSelectedDate(row.date)}
                                >
                                    <line
                                        x1={x + 1}
                                        x2={x + 1}
                                        y1={chart.top + plotHeight}
                                        y2={chart.top + plotHeight + 5}
                                        stroke="rgba(255,255,255,0.34)"
                                    />
                                    {getSegments(row).map(segment => {
                                        const yTop = valueToY(stackBase + segment.value)
                                        const yBottom = valueToY(stackBase)
                                        const height = Math.max(0, yBottom - yTop)
                                        stackBase += segment.value
                                        return (
                                            <g key={segment.key}>
                                            <rect
                                                x={x + 1}
                                                y={yTop}
                                                width={barWidth}
                                                height={height}
                                                fill={segment.color}
                                                opacity={isSelected ? 1 : 0.82}
                                            />
                                                {showSegmentLabels && height >= 18 && (
                                                    <text
                                                        x={x + 1 + barWidth / 2}
                                                        y={yTop + height / 2 + 4}
                                                        textAnchor="middle"
                                                        className="fill-white text-xs font-semibold"
                                                    >
                                                        {segment.key}
                                                    </text>
                                                )}
                                            </g>
                                        )
                                    })}
                                    <rect
                                        x={x + 1}
                                        y={valueToY(calories)}
                                        width={barWidth}
                                        height={valueToY(0) - valueToY(calories)}
                                        fill="transparent"
                                        stroke={isSelected ? '#fb923c' : 'rgba(255,255,255,0.18)'}
                                        strokeWidth={isSelected ? 2 : 1}
                                        rx="2"
                                    />
                                    <text x={x + 1} y={chart.top + plotHeight + 17} textAnchor="middle" className="fill-text-muted text-xs">{row.displayDate}</text>
                                </g>
                            )
                        })}
                        <text x={chart.left - 24} y={chart.top - 6} textAnchor="start" className="fill-text-muted text-xs">kcal</text>
                    </svg>
                )}
                {selected && (
                    <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full bg-surface-base border border-border-subtle px-2.5 py-1 text-xs text-text-muted">{selected.periodLabel}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditRequest(selected.date)}
                                className="rounded-full bg-brand-500/15 px-3 py-1.5 text-xs text-brand-300 hover:bg-brand-500/25"
                            >
                                編集
                            </Button>
                        </div>
                        {selected.dayTypeEnabled ? (
                            <div className="space-y-3">
                                {renderTargetSet(selected, 'training')}
                                {renderTargetSet(selected, 'rest')}
                            </div>
                        ) : (
                            renderTargetSet(selected)
                        )}
                    </div>
                )}
            </div>

        </div>
    )
}

export default function DietPlanPage() {
    return (<Suspense fallback={<div className="min-h-screen bg-surface-base flex items-center justify-center">読み込み中...</div>}><DietPlanPageContent /></Suspense>)
}
