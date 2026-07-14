'use client'

import { useState, useEffect, useRef } from 'react'
import GoalModal from './GoalModal'
import Card from '@/components/ui/Card'
import Icon, { type IconName } from '@/components/ui/icons'
import { getDietDayTypeLabel, getEffectiveDietGoal, isDayTypeTargetEnabled, normalizeDietDayType, type DietDayType } from '@/lib/utils/dietDayType'

interface InputTabProps {
    userId: string;
    token: string;
    isAdmin: boolean;
    sharedState: any;
    onStateChange: (state: any) => void;
}

interface NutrientData {
    id?: string;
    calories: number;
    calories_target?: number;
    protein: number;
    protein_target?: number;
    fat: number;
    fat_target?: number;
    carbs: number;
    carbs_target?: number;
    sugar: number;
    sugar_target?: number;
    fiber: number;
    fiber_target?: number;
    salt: number;
    salt_target?: number;
}

export default function InputTab({ userId, token, isAdmin, sharedState, onStateChange }: InputTabProps) {
    const [target, setTarget] = useState<any>(null)
    const [saving, setSaving] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [visibleItems, setVisibleItems] = useState({ steps: true, sleep: true, water: true, alcohol: true, workout: true })
    const [showGoalModal, setShowGoalModal] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const { 
        selectedDate = new Date().toISOString().split('T')[0], 
        weight = '', 
        water = '2.0', 
        steps = '10000', 
        sleep = '8.0', 
        alcohol = '0', 
        notes = '', 
        dietImageUrl = null, 
        ocrResult = null,
        dayType = null,
        habits = { workout: 0 }, 
        quitGoals = [], 
        isSaved = false,
        touchedFields = []
    } = sharedState || {}

    // Fetch data for selected date
    useEffect(() => {
        if (!token || !selectedDate) return;

        const fetchDateData = async () => {
            try {
                const [logRes, settingRes, dietRes, goalRes] = await Promise.all([
                    fetch(`/api/lifestyle/logs?date=${selectedDate}&token=${token}`),
                    fetch(`/api/lifestyle/settings?token=${token}`),
                    fetch(`/api/diet/logs?date=${selectedDate}&token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`)
                ])

                const updates: any = {
                    weight: '',
                    water: '0',
                    steps: '0',
                    sleep: '0',
                    alcohol: '0',
                    notes: '',
                    habits: { workout: 0 },
                    ocrResult: null,
                    dietImageUrl: null,
                    dayType: null,
                    isSaved: false,
                    touchedFields: []
                }
                let dayTypeTargetSettings: any = null

                if (settingRes && settingRes.ok) {
                    const { data } = await settingRes.json()
                    if (data) {
                        const items = data.visible_items || {}
                        setVisibleItems({ ...items, workout: true })
                        if (data.quit_goals) updates.quitGoals = data.quit_goals
                        dayTypeTargetSettings = data.habit_targets?.diet_day_type_targets || null
                        
                        // Default habit targets
                        if (data.habit_targets) {
                            if (data.habit_targets.water != null) updates.water = String(data.habit_targets.water)
                            if (data.habit_targets.steps != null) updates.steps = String(data.habit_targets.steps)
                            if (data.habit_targets.sleep != null) updates.sleep = String(data.habit_targets.sleep)
                        }
                    }
                }

                let currentPlan: any = null
                if (goalRes.ok) {
                    const { data } = await goalRes.json()
                    if (data && data.length > 0) {
                        currentPlan = data.find((g: any) => g.start_date <= selectedDate) || data[data.length - 1]
                        if (dayTypeTargetSettings) {
                            currentPlan = { ...currentPlan, ...dayTypeTargetSettings }
                        }
                        setTarget(currentPlan)
                    }
                }

                let hasAnyData = false
                if (logRes.ok) {
                    const { data } = await logRes.json()
                    if (data) {
                        hasAnyData = true
                        if (data.weight) updates.weight = String(data.weight)
                        if (data.water_liters != null) updates.water = String(data.water_liters)
                        else if (data.water != null) updates.water = String(data.water)
                        if (data.steps != null) updates.steps = String(data.steps)
                        if (data.sleep_hours != null) updates.sleep = String(data.sleep_hours)
                        else if (data.sleep != null) updates.sleep = String(data.sleep)
                        if (data.alcohol_units != null) updates.alcohol = String(data.alcohol_units)
                        else if (data.alcohol != null) updates.alcohol = String(data.alcohol)
                        if (data.notes) updates.notes = data.notes
                        if (data.habits) updates.habits = data.habits
                        if (data.habits?.diet_day_type) updates.dayType = normalizeDietDayType(data.habits.diet_day_type)

                        // Mark fields as touched if they exist in DB
                        const touched = []
                        if (data.weight) touched.push('weight')
                        if (data.water_liters != null || data.water != null) touched.push('water')
                        if (data.steps != null) touched.push('steps')
                        if (data.sleep_hours != null || data.sleep != null) touched.push('sleep')
                        updates.touchedFields = touched
                    }
                }

                if (dietRes.ok) {
                    const { data } = await dietRes.json()
                    if (data) {
                        const hasDietValues = Boolean(
                            Number(data.calories || 0) > 0
                            || Number(data.protein || 0) > 0
                            || data.image_url
                            || data.notes
                        )
                        if (hasDietValues) hasAnyData = true
                        updates.dayType = updates.dayType || normalizeDietDayType(data.day_type)
                        if (hasDietValues) {
                            const effectivePlan = getEffectiveDietGoal(currentPlan, updates.dayType || 'rest')
                            updates.ocrResult = {
                                ...data,
                                calories_target: effectivePlan.calories || data.calories_target || 1600,
                                protein_target: effectivePlan.protein || data.protein_target || 100,
                                fat_target: effectivePlan.fat || data.fat_target || 40,
                                carbs_target: effectivePlan.carbs || data.carbs_target || 200,
                                sugar_target: effectivePlan.sugar || data.sugar_target || 180,
                                fiber_target: effectivePlan.fiber || data.fiber_target || 20,
                                salt_target: effectivePlan.salt || data.salt_target || 6
                            }
                        }
                        if (data.image_url) updates.dietImageUrl = data.image_url
                    }
                }

                if (hasAnyData) {
                    updates.isSaved = true
                }

                // Single update to parent state
                onStateChange({ ...sharedState, ...updates })
            } catch (e) { console.error('Fetch error:', e) }
        }
        fetchDateData()
    }, [token, selectedDate])

    if (!sharedState) return null

    const updateSharedState = (updates: any) => {
        onStateChange({ ...sharedState, ...updates, isSaved: false })
    }

    const setWeight = (v: string) => updateSharedState({ weight: v, touchedFields: [...touchedFields.filter((f: string) => f !== 'weight'), 'weight'] })
    const setWater = (v: string) => updateSharedState({ water: v, touchedFields: [...touchedFields.filter((f: string) => f !== 'water'), 'water'] })
    const setSteps = (v: string) => updateSharedState({ steps: v, touchedFields: [...touchedFields.filter((f: string) => f !== 'steps'), 'steps'] })
    const setSleep = (v: string) => updateSharedState({ sleep: v, touchedFields: [...touchedFields.filter((f: string) => f !== 'sleep'), 'sleep'] })
    const setAlcohol = (v: string) => updateSharedState({ alcohol: v })
    const setNotes = (v: string) => updateSharedState({ notes: v })
    const setHabits = (fn: any) => {
        const next = typeof fn === 'function' ? fn(habits) : fn
        updateSharedState({ habits: next })
    }
    const setOcrResult = (v: any) => updateSharedState({ ocrResult: v })
    const setDietImageUrl = (v: any) => updateSharedState({ dietImageUrl: v })
    const setIsSaved = (v: boolean) => onStateChange({ ...sharedState, isSaved: v })
    const setSelectedDate = (v: string) => onStateChange({ ...sharedState, selectedDate: v, dayType: null, isSaved: false, touchedFields: [] })
    const setQuitGoals = (v: any) => onStateChange({ ...sharedState, quitGoals: v })
    const selectedDayType = normalizeDietDayType(dayType)
    const dayTypeEnabled = isDayTypeTargetEnabled(target)
    const effectiveTarget = getEffectiveDietGoal(target, selectedDayType || 'rest')

    const withCurrentTargets = (data: any, nextDayType: DietDayType | null = selectedDayType) => {
        const effectivePlan = getEffectiveDietGoal(target, nextDayType || 'rest')
        return {
            ...data,
            calories_target: effectivePlan.calories || data?.calories_target || 1600,
            protein_target: effectivePlan.protein || data?.protein_target || 100,
            fat_target: effectivePlan.fat || data?.fat_target || 40,
            carbs_target: effectivePlan.carbs || data?.carbs_target || 200,
            sugar_target: effectivePlan.sugar || data?.sugar_target || 180,
            fiber_target: effectivePlan.fiber || data?.fiber_target || 20,
            salt_target: effectivePlan.salt || data?.salt_target || 6,
        }
    }

    const handleDayTypeSelect = async (nextDayType: DietDayType) => {
        const nextHabits = { ...(habits || {}), diet_day_type: nextDayType }
        const nextState = {
            ...sharedState,
            dayType: nextDayType,
            habits: nextHabits,
            ocrResult: ocrResult ? withCurrentTargets(ocrResult, nextDayType) : ocrResult,
            isSaved: false,
        }
        onStateChange(nextState)

        try {
            await fetch('/api/lifestyle/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    token,
                    habits: nextHabits,
                })
            })
        } catch (e) {
            console.error('Day type save error:', e)
        }
    }

    const handleAllSave = async () => {
        setSaving(true)
        setMessage(null)
        try {
            const habitsForSave = dayTypeEnabled && selectedDayType
                ? { ...(habits || {}), diet_day_type: selectedDayType }
                : habits

            // 1. Save Lifestyle Logs
            const lifestyleBody: any = {
                date: selectedDate,
                token: token,
                notes: notes,
                habits: habitsForSave
            }

            if (weight && touchedFields.includes('weight')) lifestyleBody.weight = parseFloat(weight)
            if (water && touchedFields.includes('water')) lifestyleBody.water_liters = parseFloat(water)
            if (steps && touchedFields.includes('steps')) lifestyleBody.steps = parseInt(steps)
            if (sleep && touchedFields.includes('sleep')) lifestyleBody.sleep_hours = parseFloat(sleep)
            if (alcohol) lifestyleBody.alcohol_units = parseFloat(alcohol)

            const lifestyleRes = await fetch('/api/lifestyle/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lifestyleBody)
            })

            // 2. Save Diet Logs (OCR Results)
            let dietResOk = true
            if (ocrResult) {
                const dietRes = await fetch('/api/diet/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: selectedDate,
                        token: token,
                        ...ocrResult,
                        image_url: dietImageUrl
                    })
                })
                dietResOk = dietRes.ok
            }

            if (lifestyleRes.ok && dietResOk) {
                setMessage({ type: 'success', text: 'すべての記録を保存しました' })
                setIsSaved(true)
                setTimeout(() => setMessage(null), 3000)
            } else {
                throw new Error('保存に失敗しました')
            }
        } catch (e) {
            setMessage({ type: 'error', text: '保存中にエラーが発生しました' })
        } finally {
            setSaving(false)
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setAnalyzing(true)
        setMessage(null)
        setOcrResult(null) // Reset OCR result for new upload
        setIsSaved(false)
        
        const formData = new FormData()
        formData.append('image', file)
        if (token) formData.append('token', token)

        try {
            // 1. Upload the image first
            const uploadRes = await fetch('/api/diet/upload', {
                method: 'POST',
                body: formData
            })
            const uploadData = await uploadRes.json()
            if (uploadRes.ok) {
                setDietImageUrl(uploadData.url)
                // Also create a dummy ocrResult to show the preview area
                setOcrResult({
                    calories: 0, calories_target: effectiveTarget.calories,
                    protein: 0, protein_target: effectiveTarget.protein,
                    fat: 0, fat_target: effectiveTarget.fat,
                    carbs: 0, carbs_target: effectiveTarget.carbs,
                    sugar: 0, sugar_target: effectiveTarget.sugar,
                    fiber: 0, fiber_target: effectiveTarget.fiber,
                    salt: 0, salt_target: effectiveTarget.salt
                })
            } else {
                throw new Error(uploadData.error || 'アップロードに失敗しました')
            }

            // 2. Analyze the image
            const analyzeRes = await fetch(`/api/diet/analyze${token ? `?token=${token}` : ''}`, {
                method: 'POST',
                body: formData
            })
            const analyzeData = await analyzeRes.json()
            if (analyzeRes.ok) {
                const data = analyzeData.data
                setOcrResult(withCurrentTargets(data))
                // Automatic save removed - wait for user to click the main save button
            } else {
                console.error('Analysis failed:', analyzeData.error, analyzeData.message)
                setMessage({ type: 'error', text: analyzeData.message || '写真の解析に失敗しました。手動で入力してください。' })
            }
        } catch (e: any) {
            console.error('Upload process error:', e)
            setMessage({ type: 'error', text: e.message || 'エラーが発生しました' })
        } finally {
            setAnalyzing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-6">
            {/* Toast Message */}
            {message && (
                <div className={`fixed top-16 left-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-sm font-normal flex items-center justify-between ${message.type === 'success' ? 'bg-state-success-500/15 border-state-success-500/30 text-state-success-300' : 'bg-state-danger-500/15 border-state-danger-500/30 text-state-danger-300'
                    }`}>
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}


            {/* Goal Modal */}
            {showGoalModal && (
                <GoalModal
                    userId={userId}
                    token={token}
                    onClose={() => setShowGoalModal(false)}
                    onSave={() => {
                        setMessage({ type: 'success', text: '目標を更新しました' })
                        setTimeout(() => setMessage(null), 3000)
                    }}
                />
            )}

            {/* 1. Date Selection Section */}
            <Card padding="md">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-normal text-text-muted uppercase tracking-widest">記録する日を選択</h2>
                        {isAdmin && (
                            <button className="text-xs font-normal text-brand-300 px-3 py-1 bg-brand-500/15 rounded-full">項目編集</button>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="flex-1 bg-surface-base border-none rounded-xl font-normal text-text-secondary px-4 py-2 focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                            className={`px-4 py-2 rounded-xl text-xs font-normal transition-all ${selectedDate === new Date().toISOString().split('T')[0] ? 'bg-brand-700 text-white shadow-md' : 'bg-surface-overlay text-text-secondary'}`}
                        >
                            今日
                        </button>
                    </div>
                </div>
            </Card>

            {/* 2. Diet Record Section */}
            {dayTypeEnabled && (
                <Card padding="md">
                    {!selectedDayType ? (
                        <div className="space-y-4 text-center">
                            <h2 className="text-base font-normal text-text-primary">今日はどちらですか？</h2>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleDayTypeSelect('training')}
                                    className="rounded-2xl bg-brand-700 px-4 py-4 text-sm font-normal text-white active:scale-95 transition-transform"
                                >
                                    筋トレ日
                                </button>
                                <button
                                    onClick={() => handleDayTypeSelect('rest')}
                                    className="rounded-2xl bg-surface-overlay px-4 py-4 text-sm font-normal text-text-primary active:scale-95 transition-transform"
                                >
                                    休養日
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] text-text-muted uppercase tracking-widest">今日の種別</p>
                                <p className="mt-1 text-sm font-normal text-text-primary">{getDietDayTypeLabel(selectedDayType)}</p>
                            </div>
                            <div className="flex gap-2">
                                {(['training', 'rest'] as DietDayType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleDayTypeSelect(type)}
                                        className={`rounded-full px-3 py-2 text-xs transition-colors ${selectedDayType === type ? 'bg-brand-700 text-white' : 'bg-surface-overlay text-text-secondary'}`}
                                    >
                                        {getDietDayTypeLabel(type)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}

            <div className="space-y-4">
                {/* Meal Result Section - Show prominently if data exists */}
                {(!dayTypeEnabled || selectedDayType) && ocrResult && (
                    <div className={`bg-surface-raised rounded-2xl shadow-lg p-6 animate-slideUp border-2 ${isSaved ? 'border-border-subtle' : 'border-brand-500'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-normal text-text-primary">
                                {analyzing ? '解析中...' : isSaved ? '食事の記録' : '解析結果'}
                            </h2>
                            {!analyzing && (
                                <div className="flex items-center gap-2">
                                    {isSaved ? (
                                        <Icon name="check" size={12} className="text-text-secondary" />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
                                    )}
                                    <span className={`text-[10px] font-normal uppercase tracking-widest ${isSaved ? 'text-text-secondary' : 'text-brand-600'}`}>
                                        {isSaved ? 'Saved' : 'Draft'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {dietImageUrl && (
                            <div className="mb-4 rounded-xl overflow-hidden border border-border-subtle shadow-inner bg-surface-base aspect-video relative">
                                <img 
                                    src={dietImageUrl} 
                                    alt="Uploaded meal" 
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className={`col-span-2 p-4 rounded-xl transition-colors ${isSaved ? 'bg-surface-overlay' : 'bg-brand-500/10'}`}>
                                <div className={`text-[10px] font-normal uppercase mb-2 tracking-widest text-center ${isSaved ? 'text-text-secondary' : 'text-brand-300'}`}>総エネルギー</div>
                                <div className="flex items-center justify-center space-x-3">
                                    <div className="text-3xl font-normal text-text-primary">{ocrResult.calories}</div>
                                    <div className="text-xl font-normal text-text-muted">/</div>
                                    <div className="text-2xl font-normal text-text-muted opacity-60">{ocrResult.calories_target}</div>
                                    <div className="text-sm font-normal text-text-muted">kcal</div>
                                </div>
                            </div>
                            <NutrientItem label="たんぱく質 (P)" value={ocrResult.protein} target={ocrResult.protein_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, protein: v })} />
                            <NutrientItem label="脂質 (F)" value={ocrResult.fat} target={ocrResult.fat_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, fat: v })} />
                            <NutrientItem label="炭水化物 (C)" value={ocrResult.carbs} target={ocrResult.carbs_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, carbs: v })} />
                            <NutrientItem label="糖質" value={ocrResult.sugar} target={ocrResult.sugar_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, sugar: v })} />
                            <NutrientItem label="食物繊維" value={ocrResult.fiber} target={ocrResult.fiber_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, fiber: v })} />
                            <NutrientItem label="塩分" value={ocrResult.salt} target={ocrResult.salt_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, salt: v })} />
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs font-normal text-brand-300 px-3 py-1.5 bg-brand-500/15 rounded-full hover:bg-brand-500/25 transition-colors flex items-center gap-2"
                                >
                                    <Icon name="upload" size={12} />
                                    写真を再アップロード
                                </button>
                            </div>
                            <button 
                                onClick={() => {
                                    if (confirm('入力をリセットしてよろしいですか？')) {
                                        setOcrResult(null);
                                        setDietImageUrl(null);
                                    }
                                }}
                                className="text-[10px] font-normal text-text-muted hover:text-text-muted transition-colors flex items-center gap-1 uppercase tracking-widest"
                            >
                                削除
                            </button>
                        </div>
                    </div>
                )}

                {/* Large Upload Button - Only show if no data */}
                {(!dayTypeEnabled || selectedDayType) && !ocrResult && (
                    <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl shadow-lg p-6 text-white overflow-hidden relative group">
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white bg-opacity-10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-4">
                                <Icon name="camera" size={32} className="text-white" />
                            </div>
                            <h2 className="text-lg font-normal mb-1">食事写真を解析</h2>
                            <p className="text-brand-100 text-xs mb-6 text-center opacity-80">スクリーンショットを読み取って栄養バランスを一律入力します</p>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={analyzing}
                                className={`w-full bg-white text-brand-600 py-3 rounded-xl font-normal shadow-md hover:bg-brand-50 transition-colors disabled:opacity-50 flex items-center justify-center ${analyzing ? 'animate-pulse' : ''}`}
                            >
                                {analyzing ? '解析中...' : '写真をアップロード'}
                            </button>
                        </div>
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                />
            </div>

            {/* 3. Metrics Input Section */}
            <Card padding="md">
                <div className="space-y-3">
                    <h2 className="text-sm font-normal text-text-muted uppercase tracking-widest mb-4">各項目の詳細入力</h2>
                    
                    {/* Weight Input Row */}
                    <div className="flex items-center justify-between p-4 bg-surface-base rounded-2xl mb-4 group focus-within:ring-2 focus-within:ring-brand-100 transition-all">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-surface-raised rounded-xl flex items-center justify-center shadow-sm text-brand-500">
                                <Icon name="scale" size={24} />
                            </div>
                            <span className="text-sm font-normal text-text-secondary">現在の体重</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="flex items-baseline space-x-1">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.1"
                                    value={weight}
                                    onChange={(e) => {
                                        setWeight(e.target.value)
                                    }}
                                    placeholder="00.0"
                                    className="w-20 text-right text-2xl font-normal text-text-primary bg-transparent border-none p-0 focus:ring-0 placeholder-gray-200"
                                />
                                <span className="text-xs font-normal text-text-muted">kg</span>
                            </div>
                        </div>
                    </div>

                    {visibleItems.water && (
                        <EditableLogItem
                            iconName="water"
                            label="水分"
                            value={water}
                            target={target?.water_target != null ? String(target.water_target) : undefined}
                            unit="L"
                            iconBg="bg-brand-500/15"
                            iconColor="text-brand-500"
                            step={0.5}
                            isDefault={!touchedFields.includes('water')}
                            onChange={(v) => {
                                setWater(v)
                            }}
                        />
                    )}
                    {visibleItems.steps && (
                        <EditableLogItem
                            iconName="chartBar"
                            label="歩数"
                            value={steps ?? '0'}
                            target={target?.step_target != null ? String(target.step_target) : undefined}
                            unit="歩"
                            iconBg="bg-cyan-500/15"
                            iconColor="text-cyan-500"
                            step={500}
                            isDefault={!touchedFields.includes('steps')}
                            onChange={(v) => {
                                setSteps(v)
                            }}
                        />
                    )}
                    {visibleItems.sleep && (
                        <EditableLogItem
                            iconName="moon"
                            label="睡眠"
                            value={sleep ?? '0'}
                            target={target?.sleep_target != null ? String(target.sleep_target) : undefined}
                            unit="h"
                            iconBg="bg-violet-500/15"
                            iconColor="text-violet-500"
                            step={0.5}
                            isDefault={!touchedFields.includes('sleep')}
                            onChange={(v) => {
                                setSleep(v)
                            }}
                        />
                    )}
                    {(visibleItems.workout || true) && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 border border-border-subtle rounded-2xl hover:bg-surface-base transition-colors">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-orange-500/15 text-orange-400 rounded-xl flex items-center justify-center shadow-sm">
                                        <Icon name="tableCells" size={20} />
                                    </div>
                                    <span className="text-sm font-normal text-text-secondary">筋トレ</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-normal text-text-muted">実施</span>
                                    <button
                                        onClick={() => {
                                            setHabits((prev: any) => ({ ...prev, workout: prev.workout === 1 ? 0 : 1 }))
                                        }}
                                        className={`w-12 h-6 rounded-full transition-all relative ${habits.workout === 1 ? 'bg-orange-500' : 'bg-surface-overlay'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-surface-raised rounded-full transition-all ${habits.workout === 1 ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                            {habits.workout === 1 && (
                                <textarea
                                    value={habits.workout_notes || ''}
                                    onChange={(e) => setHabits((prev: any) => ({ ...prev, workout_notes: e.target.value }))}
                                    placeholder="トレーニング内容（例：スクワット 10回×3セットなど）"
                                    className="w-full p-4 rounded-2xl bg-surface-base border-none focus:ring-2 focus:ring-orange-200 text-sm font-normal text-text-secondary placeholder:text-text-muted min-h-[80px] transition-all"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Notes Section */}
                <div className="mt-6">
                    <label className="text-xs font-normal text-text-muted uppercase tracking-widest mb-2 block">メモ（任意）</label>
                    <textarea
                        value={notes}
                        onChange={(e) => {
                            setNotes(e.target.value)
                        }}
                        placeholder="今日の体調や食事の感想など"
                        className="w-full bg-surface-base border-none rounded-2xl p-4 text-sm font-normal text-text-secondary focus:ring-2 focus:ring-brand-500 min-h-[100px]"
                    />
                </div>

                {/* Other Goals (Habits) Section */}
                {(quitGoals?.length || 0) > 0 && (
                    <div className="mt-8 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                            <h2 className="text-sm font-normal text-text-muted uppercase tracking-widest">その他の目標</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {quitGoals.map((goal: string) => (
                                <div key={goal} className="flex items-center justify-between p-4 bg-surface-base rounded-2xl border border-transparent hover:border-purple-500/25 transition-all">
                                    <span className="text-sm font-normal text-text-secondary">{goal}</span>
                                    <button
                                        onClick={() => {
                                            setHabits((prev: any) => ({ ...prev, [goal]: prev[goal] === 1 ? 0 : 1 }))
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-normal transition-all ${habits[goal] === 1 ? 'bg-state-success-500 text-white shadow-md' : 'bg-surface-raised text-text-muted border border-border-subtle'}`}
                                    >
                                        {habits[goal] === 1 ? (
                                            <>
                                                <Icon name="check" size={12} />
                                                達成
                                            </>
                                        ) : (
                                            <>
                                                <Icon name="close" size={12} />
                                                未達成
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="mt-8 space-y-4">
                    <button
                        onClick={handleAllSave}
                        disabled={saving}
                        className="w-full py-4 rounded-2xl font-normal shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-lg bg-brand-700 text-white hover:bg-brand-800"
                    >
                        {saving ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                保存中...
                            </>
                        ) : isSaved ? '編集内容を更新する' : '入力内容を保存する'}
                    </button>
                    <p className="text-center text-[10px] text-text-muted">日付: {selectedDate} の記録として保存されます</p>

                    <div className="flex justify-center pt-2">
                        <button
                            onClick={async () => {
                                if (window.confirm('この日の入力内容を完全に削除し、初期値に戻しますか？（保存済みのデータも削除されます）')) {
                                    setSaving(true)
                                    try {
                                        await Promise.all([
                                            fetch(`/api/lifestyle/logs?date=${selectedDate}&token=${token}`, { method: 'DELETE' }),
                                            fetch(`/api/diet/logs?date=${selectedDate}&token=${token}`, { method: 'DELETE' })
                                        ])
                                        onStateChange({
                                            ...sharedState,
                                            weight: '',
                                            water: target?.water_target != null ? String(target.water_target) : '2.0',
                                            steps: target?.step_target != null ? String(target.step_target) : '8000',
                                            sleep: target?.sleep_target != null ? String(target.sleep_target) : '8.0',
                                            alcohol: '0',
                                            notes: '',
                                            habits: { workout: 0 },
                                            ocrResult: null,
                                            dietImageUrl: null,
                                            dayType: null,
                                            isSaved: false,
                                            touchedFields: []
                                        })
                                        setMessage({ type: 'success', text: '記録を削除しました' })
                                        setTimeout(() => setMessage(null), 3000)
                                    } catch (e) {
                                        console.error('Delete error:', e)
                                        setMessage({ type: 'error', text: '削除中にエラーが発生しました' })
                                    } finally {
                                        setSaving(false)
                                    }
                                }
                            }}
                            className="text-[10px] font-normal text-text-muted hover:text-text-muted transition-colors flex items-center gap-1 uppercase tracking-widest"
                        >
                            <Icon name="trash" size={12} />
                            入力をリセット
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    )
}

function NutrientItem({ label, value, target, unit, onChange }: { label: string, value: number, target?: number, unit: string, onChange: (v: number) => void }) {
    return (
        <div className="border border-border-subtle p-3 rounded-xl bg-surface-raised shadow-sm">
            <div className="text-[10px] font-normal text-text-muted mb-1 uppercase tracking-wider">{label}</div>
            <div className="flex items-center justify-between">
                <div className="flex items-baseline space-x-1">
                    <input
                        type="number"
                        step="0.1"
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                        className="w-16 text-lg font-normal text-text-primary border-none p-0 focus:ring-0 leading-none bg-transparent"
                    />
                    {target !== undefined && (
                        <>
                            <span className="text-text-muted font-normal mx-1">/</span>
                            <span className="text-text-muted font-normal">{target}</span>
                        </>
                    )}
                </div>
                <span className="text-[10px] font-normal text-text-muted">{unit}</span>
            </div>
        </div>
    )
}

function EditableLogItem({ iconName, label, value, target, unit, iconBg, iconColor, step, isDefault, onChange }: {
    iconName: IconName,
    label: string,
    value: string,
    target?: string,
    unit: string,
    iconBg: string,
    iconColor: string,
    step: number,
    isDefault?: boolean,
    onChange: (v: string) => void
}) {
    const handleAdjust = (direction: 'up' | 'down') => {
        const current = parseFloat(value) || 0
        const newValue = direction === 'up' ? current + step : Math.max(0, current - step)
        // Format to 1 decimal place for water/sleep, 0 for steps
        const formatted = step < 1 ? newValue.toFixed(1) : Math.round(newValue).toString()
        onChange(formatted)
    }

    return (
        <div className="flex items-center justify-between p-3 border border-border-subtle rounded-2xl hover:bg-surface-base transition-colors">
            <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center shadow-sm`}>
                    <Icon name={iconName} size={20} />
                </div>
                <span className="text-sm font-normal text-text-secondary">{label}</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-surface-overlay rounded-xl p-1">
                    <button 
                        onClick={() => handleAdjust('down')}
                        className="p-1.5 hover:bg-surface-raised rounded-lg transition-all text-text-muted hover:text-brand-500"
                    >
                        <Icon name="chevronDown" size={16} />
                    </button>
                    <div className="flex items-baseline px-2 min-w-[90px] justify-center">
                        <input
                            type="number"
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className={`w-24 text-center text-lg font-normal bg-transparent border-none p-0 focus:ring-0 transition-colors ${isDefault ? 'text-text-muted' : 'text-text-primary'}`}
                        />
                        {target && (
                            <div className="flex items-baseline ml-1 opacity-40">
                                <span className="text-[10px] font-normal mx-0.5">/</span>
                                <span className="text-xs font-normal">{target}</span>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => handleAdjust('up')}
                        className="p-1.5 hover:bg-surface-raised rounded-lg transition-all text-text-muted hover:text-brand-500"
                    >
                        <Icon name="chevronUp" size={16} />
                    </button>
                </div>
                <span className="text-[10px] font-normal text-text-muted w-4">{unit}</span>
            </div>
        </div>
    )
}
