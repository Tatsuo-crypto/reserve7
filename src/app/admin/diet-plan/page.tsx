'use client'

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Member } from '@/types'
import { 
    ComposedChart,
    Bar,
    LineChart,
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Legend,
    BarChart
} from 'recharts'

// Reusing some logic from members page
import { getStatusDotColor } from '@/lib/utils/member'
import AdminHeader from '@/app/components/AdminHeader'
import HomeTab from '@/components/diet/HomeTab'
import AnalyzeTab from '@/components/diet/AnalyzeTab'
import ProgressTab from '@/components/diet/ProgressTab'
import GoalModal from '@/components/diet/GoalModal'

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

type TabType = 'progress' | 'analyze' | 'plan' | 'history';
type PeriodType = '1w' | '1m' | '3m' | '6m' | '1y' | 'all';

const ACTIVITY_LABELS: Record<string, string> = {
    '1.2': '低い',
    '1.375': 'やや低い',
    '1.55': '普通',
    '1.725': '高い',
    '1.9': '非常に高い'
}

function calculateAge(birthDate?: string | null) {
    if (!birthDate) return null
    const birth = new Date(birthDate)
    if (Number.isNaN(birth.getTime())) return null
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
    return age
}

function roundToNearest(value: number, unit: number) {
    return Math.round(value / unit) * unit
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
    const [activeTab, setActiveTab] = useState<TabType>('progress')
    const [isSettingNewGoal, setIsSettingNewGoal] = useState(false)
    const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null)
    const [analysisPeriod, setAnalysisPeriod] = useState<PeriodType>('1m')
    const [selectedWeek, setSelectedWeek] = useState<string>('')
    const [showWeightAvg, setShowWeightAvg] = useState(false)
    const [sharedState, setSharedState] = useState<any>({
        selectedDate: new Date().toISOString().split('T')[0],
        habits: { workout: 0 }
    })

    const today = new Date().toISOString().split('T')[0];

    const [nutrientForm, setNutrientForm] = useState({
        protein: DEFAULT_PROTEIN,
        fat: DEFAULT_FAT,
        carbs: DEFAULT_CARBS,
        sugar: DEFAULT_SUGAR,
        fiber: DEFAULT_FIBER,
        salt: DEFAULT_SALT,
        targetCalories: 1600,
        startDate: today,
        title: ''
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

    const DEFAULT_HABIT_TARGETS = {
        steps: 8000,
        sleep: 7,
        water: 2,
        workout: 1
    }

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
            const [dietRes, lifestyleRes, trackingRes, logsRes] = await Promise.all([
                fetch(`/api/diet/goals?token=${token}`),
                fetch(`/api/lifestyle/settings?userId=${userId}`),
                fetch(`/api/admin/member-tracking/${userId}`),
                fetch(`/api/diet/logs?token=${token}`)
            ])

            if (dietRes.ok) {
                const text = await dietRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    setDietHistory(data || [])
                    if (data && data.length > 0) {
                        const latest = data[0]
                        setNutrientForm({
                            protein: latest.protein,
                            fat: latest.fat,
                            carbs: latest.carbs,
                            fiber: latest.fiber || 20,
                            sugar: latest.sugar || (latest.carbs - (latest.fiber || 20)),
                            targetCalories: latest.calories || 1600,
                            salt: latest.salt || 6,
                            startDate: latest.start_date,
                            title: latest.title || ''
                        })
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
                        if (userId) {
                            const member = fetchedMembers.find((m: Member) => m.id === userId)
                            if (member) setSelectedMember(member)
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

    const handleSave = async () => {
        if (!selectedMember) return
        setSaving(true)
        setMessage('')
        try {
            const dietSave = fetch(`/api/diet/goals?token=${selectedMember.access_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...nutrientForm,
                    calories: nutrientForm.targetCalories
                })
            })

            const lifestyleSave = fetch('/api/lifestyle/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedMember.id,
                    visibleItems: lifestyleSettings.visible_items,
                    visibleTabs: lifestyleSettings.visible_tabs,
                    quit_goals: quitGoals,
                    habit_targets: habitTargets
                })
            })

            const [dietRes, lifestyleRes] = await Promise.all([dietSave, lifestyleSave])

            if (dietRes.ok && lifestyleRes.ok) {
                setMessage('設定を保存しました')
                fetchMemberData(selectedMember.id, selectedMember.access_token || '')
                setTimeout(() => setMessage(''), 3000)
            } else {
                setMessage('保存に失敗しました')
            }
        } catch (error) {
            console.error('Save error:', error)
            setMessage('エラーが発生しました')
        } finally {
            setSaving(false)
        }
    }

    const handleEditHistory = (record: any) => {
        setNutrientForm({
            protein: record.protein,
            fat: record.fat,
            carbs: record.carbs,
            sugar: record.sugar || (record.carbs - (record.fiber || 20)),
            fiber: record.fiber || 20,
            salt: record.salt || 6,
            targetCalories: record.calories,
            startDate: record.start_date,
            title: record.title || ''
        })
        setEditingHistoryId(record.id)
        setActiveTab('plan')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('この設定履歴を削除してもよろしいですか？')) return
        try {
            const response = await fetch(`/api/diet/goals/${id}?token=${selectedMember?.access_token}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                setMessage('履歴を削除しました')
                fetchMemberData(selectedMember!.id, selectedMember!.access_token || '')
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (error) {
            console.error('Delete history error:', error)
        }
    }

    const handleGramChange = (key: string, delta: number) => {
        setNutrientForm(prev => {
            const next = { ...prev, [key as keyof typeof prev]: Math.max(0, (prev[key as keyof typeof prev] as number) + delta) };
            if (key === 'sugar' || key === 'fiber') {
                next.carbs = next.sugar + next.fiber;
            } else if (key === 'carbs') {
                next.sugar = Math.max(0, next.carbs - next.fiber);
            }
            next.targetCalories = (next.protein * 4) + (next.fat * 9) + (next.carbs * 4);
            return next;
        });
    }

    const handleNewPlan = () => {
        setNutrientForm({
            protein: DEFAULT_PROTEIN,
            fat: DEFAULT_FAT,
            carbs: DEFAULT_CARBS,
            sugar: DEFAULT_SUGAR,
            fiber: DEFAULT_FIBER,
            salt: DEFAULT_SALT,
            targetCalories: 1600,
            startDate: today,
            title: ''
        });
        setEditingHistoryId(null);
    }

    const latestWeight = useMemo(() => {
        const sorted = [...weightHistory]
            .filter(record => record.weight || record.weight_kg)
            .sort((a, b) => String(b.date || b.created_at || '').localeCompare(String(a.date || a.created_at || '')))
        const latest = sorted[0]
        const value = latest?.weight ?? latest?.weight_kg
        return value ? Number(value) : null
    }, [weightHistory])

    const calorieEstimate = useMemo(() => {
        if (!selectedMember) return null

        const age = calculateAge(selectedMember.birth_date)
        const height = selectedMember.height_cm ? Number(selectedMember.height_cm) : null
        const activity = selectedMember.activity_level ? Number(selectedMember.activity_level) : null
        const gender = selectedMember.gender

        if (!age || !height || !latestWeight || !activity || !gender) return null

        const genderOffset = gender === 'male' ? 5 : -161
        const bmr = (10 * latestWeight) + (6.25 * height) - (5 * age) + genderOffset
        const maintenance = bmr * activity
        const mildCut = Math.max(1200, maintenance - 300)
        const standardCut = Math.max(1200, maintenance - 500)

        return {
            age,
            height,
            weight: latestWeight,
            activity,
            activityLabel: ACTIVITY_LABELS[String(activity)] || '未設定',
            bmr: Math.round(bmr),
            maintenance: Math.round(maintenance),
            mildCut: roundToNearest(mildCut, 50),
            standardCut: roundToNearest(standardCut, 50),
        }
    }, [selectedMember, latestWeight])

    const applyCaloriesToPlan = (calories: number) => {
        const protein = latestWeight ? Math.round(latestWeight * 1.8) : nutrientForm.protein
        const fat = Math.round((calories * 0.25) / 9)
        const carbs = Math.max(0, Math.round((calories - (protein * 4) - (fat * 9)) / 4))
        const fiber = nutrientForm.fiber || DEFAULT_FIBER

        setNutrientForm(prev => ({
            ...prev,
            targetCalories: calories,
            protein,
            fat,
            carbs,
            fiber,
            sugar: Math.max(0, carbs - fiber),
            title: prev.title || 'カロリー計算から作成',
        }))
        setActiveTab('plan')
    }

    if (status === 'loading' || loadingMembers) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div></div>
    }

    const filteredMembers = members.filter(m => 
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 pt-4 pb-12 text-gray-900">
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
                {!selectedMember ? (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b border-gray-50">
                            <h2 className="text-xl font-normal mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
                                会員を選択
                            </h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="名前やメールアドレスで検索..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none transition-all font-normal"
                                />
                                <svg className="absolute left-4 top-4.5 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto px-4 pb-4">
                            {filteredMembers.map(member => (
                                <button key={member.id} onClick={() => setSelectedMember(member)} className="w-full flex items-center px-6 py-5 hover:bg-rose-50/50 transition-all rounded-[2rem] group mt-2">
                                    <div className="flex-1 flex items-center gap-4 text-left">
                                        <div className={`w-3 h-3 rounded-full ${getStatusDotColor(member.status)} shadow-sm`} />
                                        <div>
                                            <div className="font-normal text-gray-800 group-hover:text-rose-600 transition-colors">{member.full_name}</div>
                                            <div className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-normal text-gray-400 bg-gray-50 px-4 py-2 rounded-full group-hover:bg-rose-500 group-hover:text-white transition-all uppercase tracking-widest">選択</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-16 mt-10">
                        <div className="flex bg-white/80 backdrop-blur-md p-2 rounded-[2.5rem] border border-gray-100 shadow-sm sticky top-6 z-30 gap-1 overflow-x-auto no-scrollbar max-w-2xl mx-auto">
                            {[
                                { id: 'progress', label: '習慣達成' },
                                { id: 'history', label: '食事履歴' },
                                { id: 'analyze', label: '分析' },
                                { id: 'plan', label: '目標' }
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`flex-1 py-3 px-4 text-[11px] sm:text-sm font-normal transition-all duration-300 rounded-2xl ${activeTab === tab.id ? 'bg-gray-900 text-white shadow-xl scale-[1.02]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {!loadingData && activeTab === 'progress' && (
                            <ProgressTab userId={selectedMember.id} token={selectedMember.access_token!} />
                        )}

                        {!loadingData && activeTab === 'analyze' && (
                            <AnalyzeTab userId={selectedMember.id} token={selectedMember.access_token!} isAdmin={true} todayDraft={sharedState} />
                        )}

                        {!loadingData && activeTab === 'history' && (
                            <div className="space-y-8 animate-fadeIn">
                                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-8">
                                        <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
                                        <h2 className="text-xl font-normal text-gray-800">毎日の食事記録</h2>
                                    </div>
                                    <div className="overflow-x-auto -mx-8 px-8">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-gray-50">
                                                    <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest">日付</th>
                                                    <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-right">カロリー</th>
                                                    <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">P/F/C (g)</th>
                                                    <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">糖質/繊維/塩</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {intakeHistory.length > 0 ? intakeHistory.map((h, i) => (
                                                    <tr key={i} className="group hover:bg-gray-50 transition-colors">
                                                        <td className="py-5 text-sm font-normal text-gray-900">
                                                            {h.date.slice(5).replace(/-/g, '/')}
                                                            {h.image_url && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[8px] bg-blue-50 text-blue-500 uppercase tracking-tighter font-bold">Image</span>}
                                                        </td>
                                                        <td className="py-5 text-sm font-normal text-gray-900 text-right tabular-nums">{h.calories?.toLocaleString()} <span className="text-[10px] text-gray-300">kcal</span></td>
                                                        <td className="py-5 text-sm font-normal text-gray-600 text-center tabular-nums">
                                                            <span className="text-amber-600">{Math.round(h.protein)}</span>
                                                            <span className="mx-1 text-gray-200">/</span>
                                                            <span className="text-emerald-600">{Math.round(h.fat)}</span>
                                                            <span className="mx-1 text-gray-200">/</span>
                                                            <span className="text-blue-600">{Math.round(h.carbs)}</span>
                                                        </td>
                                                        <td className="py-5 text-sm font-normal text-gray-500 text-center tabular-nums">
                                                            <span className="text-gray-600">{Math.round(h.sugar)}</span>
                                                            <span className="mx-1 text-gray-200">/</span>
                                                            <span className="text-gray-600">{Math.round(h.fiber)}</span>
                                                            <span className="mx-1 text-gray-200">/</span>
                                                            <span className="text-gray-400">{h.salt ?? 0}</span>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={4} className="py-20 text-center text-sm font-normal text-gray-400 italic">記録がまだありません</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!loadingData && activeTab === 'plan' && (
                            <div className="space-y-12 pb-20 animate-fadeIn">
                                <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100 space-y-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                            <h2 className="text-xl font-normal text-gray-800 tracking-tight">基礎情報からカロリー計算</h2>
                                        </div>
                                        <Link
                                            href={`/admin/members/${selectedMember.id}/edit`}
                                            className="text-xs text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
                                        >
                                            会員情報を編集
                                        </Link>
                                    </div>

                                    {calorieEstimate ? (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <DietProfileStat label="年齢" value={`${calorieEstimate.age}歳`} />
                                                <DietProfileStat label="身長" value={`${calorieEstimate.height}cm`} />
                                                <DietProfileStat label="最新体重" value={`${calorieEstimate.weight}kg`} />
                                                <DietProfileStat label="活動量" value={calorieEstimate.activityLabel} />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <CalorieEstimateCard
                                                    label="基礎代謝"
                                                    value={calorieEstimate.bmr}
                                                    description="何もしなくても使う目安"
                                                />
                                                <CalorieEstimateCard
                                                    label="維持カロリー"
                                                    value={calorieEstimate.maintenance}
                                                    description="今の体重を維持する目安"
                                                    onApply={() => applyCaloriesToPlan(roundToNearest(calorieEstimate.maintenance, 50))}
                                                />
                                                <CalorieEstimateCard
                                                    label="減量スタート"
                                                    value={calorieEstimate.standardCut}
                                                    description="停滞時はここから調整"
                                                    onApply={() => applyCaloriesToPlan(calorieEstimate.standardCut)}
                                                    primary
                                                />
                                            </div>

                                            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800 leading-relaxed">
                                                まずは維持カロリーから300〜500kcal引いた数値を開始目安にします。1〜2週間の体重平均を見て、落ちない場合はさらに100〜200kcal下げる運用がしやすいです。
                                            </div>
                                        </>
                                    ) : (
                                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 text-sm text-gray-500 leading-relaxed">
                                            計算には、生年月日・性別・身長・活動量・最新体重が必要です。会員情報に基礎情報を入力し、体重記録が入ると自動で計算できます。
                                        </div>
                                    )}
                                </div>

                                {!isSettingNewGoal ? (
                                    <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100 space-y-10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                                                <h2 className="text-xl font-normal text-gray-800 tracking-tight">現在の目標設定</h2>
                                            </div>
                                            <div className="px-4 py-1.5 bg-orange-50 rounded-full"><span className="text-[10px] font-normal text-orange-600">管理モード</span></div>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="space-y-1"><h3 className="text-[10px] font-normal text-gray-400 uppercase tracking-widest pl-1">食事・栄養の目標</h3></div>
                                            <div className="bg-gray-50/80 rounded-[2rem] p-8 text-center border border-gray-100/50 relative">
                                                <p className="text-[10px] font-normal text-gray-400 mb-1 uppercase tracking-widest">目標摂取カロリー</p>
                                                <div className="flex items-baseline justify-center gap-1">
                                                    <span className="text-5xl font-normal text-gray-900 tabular-nums">{nutrientForm.targetCalories.toLocaleString()}</span>
                                                    <span className="text-sm font-normal text-gray-400">kcal / 日</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                <AdminStatCard label="タンパク質" value={nutrientForm.protein} unit="g" color="amber" onIncrement={() => handleGramChange('protein', 1)} onDecrement={() => handleGramChange('protein', -1)} isPlaceholder={!dietHistory.length && nutrientForm.protein === DEFAULT_PROTEIN} />
                                                <AdminStatCard label="脂質" value={nutrientForm.fat} unit="g" color="emerald" onIncrement={() => handleGramChange('fat', 1)} onDecrement={() => handleGramChange('fat', -1)} isPlaceholder={!dietHistory.length && nutrientForm.fat === DEFAULT_FAT} />
                                                <AdminStatCard label="炭水化物" value={nutrientForm.carbs} unit="g" color="blue" onIncrement={() => handleGramChange('carbs', 1)} onDecrement={() => handleGramChange('carbs', -1)} isPlaceholder={!dietHistory.length && nutrientForm.carbs === DEFAULT_CARBS} />
                                                <AdminStatCard label="糖質" value={nutrientForm.sugar} unit="g" color="purple" onIncrement={() => handleGramChange('sugar', 1)} onDecrement={() => handleGramChange('sugar', -1)} isPlaceholder={!dietHistory.length && nutrientForm.sugar === DEFAULT_SUGAR} />
                                                <AdminStatCard label="食物繊維" value={nutrientForm.fiber} unit="g" color="rose" onIncrement={() => handleGramChange('fiber', 1)} onDecrement={() => handleGramChange('fiber', -1)} isPlaceholder={!dietHistory.length && nutrientForm.fiber === DEFAULT_FIBER} />
                                                <AdminStatCard label="塩分" value={nutrientForm.salt} unit="g" color="gray" onIncrement={() => handleGramChange('salt', 0.5)} onDecrement={() => handleGramChange('salt', -0.5)} isPlaceholder={!dietHistory.length && nutrientForm.salt === DEFAULT_SALT} />
                                            </div>
                                        </div>

                                        <div className="space-y-8 pt-8 border-t border-gray-50">
                                            <div className="space-y-1"><h3 className="text-[10px] font-normal text-gray-400 uppercase tracking-widest pl-1">生活習慣の目標</h3></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <AdminStatCard label="糖質/繊維比率" value={intakeHistory.length ? Math.round((intakeHistory[0]?.sugar / (intakeHistory[0]?.fiber || 1)) * 10) / 10 : null} unit="ratio" color="sky" onIncrement={() => {}} onDecrement={() => {}} isPlaceholder={true} />
                                                <AdminStatCard label="水分摂取" value={habitTargets.water ?? DEFAULT_HABIT_TARGETS.water} isPlaceholder={habitTargets.water === null} unit="L" color="sky" onIncrement={() => setHabitTargets((prev: any) => ({ ...prev, water: (prev.water ?? DEFAULT_HABIT_TARGETS.water) + 0.5 }))} onDecrement={() => setHabitTargets((prev: any) => ({ ...prev, water: Math.max(0, (prev.water ?? DEFAULT_HABIT_TARGETS.water) - 0.5) }))} />
                                                <AdminStatCard label="目標歩数" value={habitTargets.steps ?? DEFAULT_HABIT_TARGETS.steps} isPlaceholder={habitTargets.steps === null} unit="歩" color="emerald" onIncrement={() => setHabitTargets((prev: any) => ({ ...prev, steps: (prev.steps ?? DEFAULT_HABIT_TARGETS.steps) + 500 }))} onDecrement={() => setHabitTargets((prev: any) => ({ ...prev, steps: Math.max(0, (prev.steps ?? DEFAULT_HABIT_TARGETS.steps) - 500) }))} />
                                                <AdminStatCard label="筋トレ回数" value={habitTargets.workout ?? DEFAULT_HABIT_TARGETS.workout} isPlaceholder={habitTargets.workout === null} unit="回/週" color="orange" onIncrement={() => setHabitTargets((prev: any) => ({ ...prev, workout: (prev.workout ?? DEFAULT_HABIT_TARGETS.workout) + 1 }))} onDecrement={() => setHabitTargets((prev: any) => ({ ...prev, workout: Math.max(0, (prev.workout ?? DEFAULT_HABIT_TARGETS.workout) - 1) }))} />
                                                <AdminStatCard label="睡眠時間" value={habitTargets.sleep ?? DEFAULT_HABIT_TARGETS.sleep} isPlaceholder={habitTargets.sleep === null} unit="時間" color="indigo" onIncrement={() => setHabitTargets((prev: any) => ({ ...prev, sleep: (prev.sleep ?? DEFAULT_HABIT_TARGETS.sleep) + 0.5 }))} onDecrement={() => setHabitTargets((prev: any) => ({ ...prev, sleep: Math.max(0, (prev.sleep ?? DEFAULT_HABIT_TARGETS.sleep) - 0.5) }))} />
                                            </div>
                                        </div>

                                        <div className="pt-4">
                                            <button onClick={handleSave} disabled={saving} className="w-full py-5 rounded-2xl bg-gray-900 text-white text-sm font-normal hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                                                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                設定を保存
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100 space-y-10">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-normal text-gray-800">新規プランの作成</h2>
                                            <button onClick={() => setIsSettingNewGoal(false)} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-normal text-gray-400 uppercase tracking-widest pl-1">開始日</label>
                                                <input type="date" value={nutrientForm.startDate} onChange={(e) => setNutrientForm({ ...nutrientForm, startDate: e.target.value })} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-normal focus:ring-2 focus:ring-rose-500" />
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                <AdminStatCard label="タンパク質" value={nutrientForm.protein} unit="g" color="amber" onIncrement={() => handleGramChange('protein', 1)} onDecrement={() => handleGramChange('protein', -1)} />
                                                <AdminStatCard label="脂質" value={nutrientForm.fat} unit="g" color="emerald" onIncrement={() => handleGramChange('fat', 1)} onDecrement={() => handleGramChange('fat', -1)} />
                                                <AdminStatCard label="炭水化物" value={nutrientForm.carbs} unit="g" color="blue" onIncrement={() => handleGramChange('carbs', 1)} onDecrement={() => handleGramChange('carbs', -1)} />
                                            </div>
                                            <button onClick={handleSave} disabled={saving} className="w-full py-5 rounded-2xl bg-rose-500 text-white text-sm font-normal hover:bg-rose-600 transition-all shadow-xl">新しいプランとして保存</button>
                                        </div>
                                    </div>
                                )}

                                {dietHistory.length > 0 && (
                                    <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-5 bg-gray-300 rounded-full"></div>
                                                <h3 className="text-xl font-normal text-gray-800">目標設定の履歴</h3>
                                            </div>
                                            {!isSettingNewGoal && <button onClick={() => { handleNewPlan(); setIsSettingNewGoal(true); }} className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-full">新しいプランを作成</button>}
                                        </div>
                                        <div className="overflow-x-auto -mx-8 px-8">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-gray-50">
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">開始日</th>
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">カロリー</th>
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">P/F/C</th>
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">操作</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {dietHistory.map((h, i) => (
                                                        <tr key={i} className="group hover:bg-gray-50/50 transition-colors text-center">
                                                            <td className="py-4 text-xs font-normal text-gray-700 whitespace-nowrap">{h.start_date.slice(2).replace(/-/g, '/')}</td>
                                                            <td className="py-4 text-xs font-normal text-gray-900">{h.calories?.toLocaleString()} kcal</td>
                                                            <td className="py-4 text-xs font-normal text-gray-600">{h.protein}/{h.fat}/{h.carbs}</td>
                                                            <td className="py-4"><div className="flex items-center justify-center gap-2"><button onClick={() => handleEditHistory(h)} className="p-2 text-gray-400 hover:text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button><button onClick={() => handleDeleteHistory(h.id)} className="p-2 text-gray-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {message && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-2xl font-normal shadow-2xl z-50 animate-slideUp">{message}</div>}
        </div>
    );
}

function AdminStatCard({ label, value, unit, color, onIncrement, onDecrement, isPlaceholder }: { 
    label: string, value: number | null, unit: string, color: string, onIncrement: () => void, onDecrement: () => void, isPlaceholder?: boolean
}) {
    const colorMap: any = {
        amber: 'text-amber-500 bg-amber-50 border-amber-100',
        emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100',
        blue: 'text-blue-500 bg-blue-50 border-blue-100',
        purple: 'text-purple-500 bg-purple-50 border-purple-100',
        rose: 'text-rose-500 bg-rose-50 border-rose-100',
        gray: 'text-gray-500 bg-gray-50 border-gray-100',
        sky: 'text-sky-500 bg-sky-50 border-sky-100',
        orange: 'text-orange-500 bg-orange-50 border-orange-100',
        indigo: 'text-indigo-500 bg-indigo-50 border-indigo-100'
    }
    const style = colorMap[color] || colorMap.gray;
    const [baseColor, bgColor, borderColor] = style.split(' ');

    return (
        <div className={`${bgColor} rounded-[2rem] p-5 border ${borderColor} transition-all hover:shadow-md group relative overflow-hidden`}>
            <p className="text-[9px] font-normal text-gray-400 mb-2 uppercase tracking-widest leading-none">{label}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-normal tabular-nums leading-none ${isPlaceholder ? 'text-gray-300' : baseColor}`}>
                        {value === null ? '-' : unit === 'L' ? value.toFixed(1) : value}
                    </span>
                    <span className="text-[9px] font-normal text-gray-300 uppercase tracking-tighter">{unit}</span>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button onClick={(e) => { e.preventDefault(); onIncrement(); }} className="p-1 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                    <button onClick={(e) => { e.preventDefault(); onDecrement(); }} className="p-1 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                </div>
            </div>
        </div>
    )
}

function DietProfileStat({ label, value }: { label: string, value: string }) {
    return (
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">{label}</div>
            <div className="mt-1 text-lg text-gray-900">{value}</div>
        </div>
    )
}

function CalorieEstimateCard({ label, value, description, onApply, primary }: {
    label: string
    value: number
    description: string
    onApply?: () => void
    primary?: boolean
}) {
    return (
        <div className={`rounded-[2rem] border p-5 ${primary ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className={`text-[10px] uppercase tracking-widest ${primary ? 'text-blue-500' : 'text-gray-400'}`}>{label}</div>
            <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-3xl tabular-nums ${primary ? 'text-blue-700' : 'text-gray-900'}`}>{value.toLocaleString()}</span>
                <span className="text-xs text-gray-400">kcal</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{description}</p>
            {onApply && (
                <button
                    type="button"
                    onClick={onApply}
                    className={`mt-4 w-full rounded-xl px-3 py-2 text-xs transition-colors ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                >
                    目標に反映
                </button>
            )}
        </div>
    )
}

export default function DietPlanPage() {
    return (<Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">読み込み中...</div>}><DietPlanPageContent /></Suspense>)
}
