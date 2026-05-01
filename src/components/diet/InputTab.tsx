'use client'

import { useState, useEffect, useRef } from 'react'
import GoalModal from './GoalModal'

interface InputTabProps {
    userId: string;
    token: string;
    isAdmin: boolean;
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
    if (!sharedState) return null

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
        habits = { workout: 0 }, 
        quitGoals = [], 
        isSaved = false 
    } = sharedState

    const updateSharedState = (updates: any) => {
        onStateChange({ ...sharedState, ...updates, isSaved: false })
    }

    const setWeight = (v: string) => updateSharedState({ weight: v })
    const setWater = (v: string) => updateSharedState({ water: v })
    const setSteps = (v: string) => updateSharedState({ steps: v })
    const setSleep = (v: string) => updateSharedState({ sleep: v })
    const setAlcohol = (v: string) => updateSharedState({ alcohol: v })
    const setNotes = (v: string) => updateSharedState({ notes: v })
    const setHabits = (fn: any) => {
        const next = typeof fn === 'function' ? fn(habits) : fn
        updateSharedState({ habits: next })
    }
    const setOcrResult = (v: any) => updateSharedState({ ocrResult: v })
    const setDietImageUrl = (v: any) => updateSharedState({ dietImageUrl: v })
    const setIsSaved = (v: boolean) => onStateChange({ ...sharedState, isSaved: v })
    const setSelectedDate = (v: string) => onStateChange({ ...sharedState, selectedDate: v, isSaved: false })
    const setQuitGoals = (v: any) => onStateChange({ ...sharedState, quitGoals: v })

    const [target, setTarget] = useState<any>(null)
    const [saving, setSaving] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [visibleItems, setVisibleItems] = useState({ steps: true, sleep: true, water: true, alcohol: true, workout: true })
    const [showGoalModal, setShowGoalModal] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Fetch data for selected date
    useEffect(() => {
        const fetchDateData = async () => {
            try {
                const [logRes, settingRes, dietRes, goalRes] = await Promise.all([
                    fetch(`/api/lifestyle/logs?date=${selectedDate}&token=${token}`),
                    fetch(`/api/lifestyle/settings?token=${token}`),
                    fetch(`/api/diet/logs?date=${selectedDate}&token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`)
                ])

                let currentSettings: any = null
                if (settingRes.ok) {
                    const { data } = await settingRes.json()
                    currentSettings = data
                    if (data) {
                        const items = data.visible_items || {}
                        setVisibleItems({ ...items, workout: true })
                        if (data.quit_goals) setQuitGoals(data.quit_goals)
                    }
                }

                let currentPlan: any = null
                if (goalRes.ok) {
                    const { data } = await goalRes.json()
                    if (data && data.length > 0) {
                        currentPlan = [...data].reverse().find(g => g.start_date <= selectedDate) || data[data.length - 1]
                        setTarget(currentPlan)
                    }
                }

                // Initialize with settings or defaults
                setWeight('')
                setWater(currentSettings?.water_target != null ? String(currentSettings.water_target) : '2.0')
                setSteps(currentSettings?.step_target != null ? String(currentSettings.step_target) : '8000')
                setSleep(currentSettings?.sleep_target != null ? String(currentSettings.sleep_target) : '8.0')
                setAlcohol('0')
                setNotes('')
                setHabits({ workout: 0 })
                setOcrResult(null)
                setDietImageUrl(null)
                setIsSaved(false)

                let hasAnyData = false
                if (logRes.ok) {
                    const { data } = await logRes.json()
                    if (data) {
                        hasAnyData = true
                        if (data.weight) setWeight(String(data.weight))
                        if (data.water_liters != null) setWater(String(data.water_liters))
                        else if (data.water != null) setWater(String(data.water))
                        
                        if (data.steps != null) setSteps(String(data.steps))
                        
                        if (data.sleep_hours != null) setSleep(String(data.sleep_hours))
                        else if (data.sleep != null) setSleep(String(data.sleep))
                        
                        if (data.alcohol_units != null) setAlcohol(String(data.alcohol_units))
                        else if (data.alcohol != null) setAlcohol(String(data.alcohol))
                        
                        if (data.notes) setNotes(data.notes)
                        if (data.habits) setHabits(data.habits)
                    }
                }

                if (dietRes.ok) {
                    const { data } = await dietRes.json()
                    if (data) {
                        hasAnyData = true
                        setOcrResult({
                            ...data,
                            calories_target: currentPlan?.calories || data.calories_target,
                            protein_target: currentPlan?.protein || data.protein_target,
                            fat_target: currentPlan?.fat || data.fat_target,
                            carbs_target: currentPlan?.carbs || data.carbs_target,
                            sugar_target: currentPlan?.sugar || data.sugar_target,
                            fiber_target: currentPlan?.fiber || data.fiber_target,
                            salt_target: currentPlan?.salt || data.salt_target
                        })
                        if (data.image_url) setDietImageUrl(data.image_url)
                    }
                }

                // If data was loaded, it's "saved". If no data, it stays "unsaved" (default draft).
                if (hasAnyData) {
                    setIsSaved(true)
                } else if (lifeSettingRes.ok) {
                    // If no log but we have settings, initialize with settings
                    const { data: s } = await lifeSettingRes.json()
                    if (s && s.habit_targets) {
                        if (s.habit_targets.water != null) setWater(String(s.habit_targets.water))
                        if (s.habit_targets.steps != null) setSteps(String(s.habit_targets.steps))
                        if (s.habit_targets.sleep != null) setSleep(String(s.habit_targets.sleep))
                        if (s.habit_targets.workout != null) setHabits({ workout: 0 }) // Start at 0 progress
                    }
                }
            } catch (e) { console.error(e) }
        }
        fetchDateData()
    }, [userId, selectedDate, token])

    const handleAllSave = async () => {
        setSaving(true)
        setMessage(null)
        try {
            // 1. Save Lifestyle Logs
            const lifestyleBody: any = {
                date: selectedDate,
                token: token,
                notes: notes,
                habits: habits
            }

            if (weight) lifestyleBody.weight = parseFloat(weight)
            if (water) lifestyleBody.water_liters = parseFloat(water)
            if (steps) lifestyleBody.steps = parseInt(steps)
            if (sleep) lifestyleBody.sleep_hours = parseFloat(sleep)
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
                    calories: 0, calories_target: 0,
                    protein: 0, protein_target: 0,
                    fat: 0, fat_target: 0,
                    carbs: 0, carbs_target: 0,
                    sugar: 0, sugar_target: 0,
                    fiber: 0, fiber_target: 0,
                    salt: 0, salt_target: 0
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
                setOcrResult(data)
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
                <div className={`fixed top-16 left-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-sm font-bold flex items-center justify-between ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">記録する日を選択</h2>
                        {isAdmin && (
                            <button className="text-xs font-bold text-blue-600 px-3 py-1 bg-blue-50 rounded-full">項目編集</button>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="flex-1 bg-gray-50 border-none rounded-xl font-bold text-gray-700 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedDate === new Date().toISOString().split('T')[0] ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
                        >
                            今日
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Diet OCR Input Card (Admin Only) */}
            {isAdmin && (
                <>
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white overflow-hidden relative group">
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white bg-opacity-10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold mb-1">食事写真を解析</h2>
                            <p className="text-blue-100 text-xs mb-6 text-center opacity-80">スクリーンショットを読み取って栄養バランスを一律入力します</p>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={analyzing}
                                className={`w-full bg-white text-blue-600 py-3 rounded-xl font-black shadow-md hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center ${analyzing ? 'animate-pulse' : ''}`}
                            >
                                {analyzing ? '解析中...' : '写真をアップロード'}
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                    </div>

                    {/* OCR Result Preview */}
                    {ocrResult && (
                        <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-500 p-6 animate-slideUp">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">
                                    {saving ? '保存中...' : '解析結果'}
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <div className="col-span-2 bg-blue-50 p-4 rounded-xl">
                                    <div className="text-[10px] font-bold text-blue-600 uppercase mb-2 tracking-widest text-center">総エネルギー (摂取 / 目標)</div>
                                    <div className="flex items-center justify-center space-x-3">
                                        <div className="text-3xl font-black text-blue-900">{ocrResult.calories}</div>
                                        <div className="text-xl font-bold text-blue-300">/</div>
                                        <div className="text-2xl font-bold text-blue-600 opacity-60">{ocrResult.calories_target}</div>
                                        <div className="text-sm font-bold text-blue-400">kcal</div>
                                    </div>
                                </div>
                                <NutrientItem label="P: たんぱく質" value={ocrResult.protein} target={ocrResult.protein_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, protein: v })} />
                                <NutrientItem label="F: 脂質" value={ocrResult.fat} target={ocrResult.fat_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, fat: v })} />
                                <NutrientItem label="C: 炭水化物" value={ocrResult.carbs} target={ocrResult.carbs_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, carbs: v })} />
                                <NutrientItem label="糖質" value={ocrResult.sugar} target={ocrResult.sugar_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, sugar: v })} />
                                <NutrientItem label="食物繊維" value={ocrResult.fiber} target={ocrResult.fiber_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, fiber: v })} />
                                <NutrientItem label="塩分" value={ocrResult.salt} target={ocrResult.salt_target} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, salt: v })} />
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 3. Metrics Input Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="space-y-3">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">各項目の詳細入力</h2>
                    
                    {/* Weight Input Row */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl mb-4 group focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth={2} />
                                    <circle cx="12" cy="12" r="3" strokeWidth={2} />
                                    <path d="M12 12l1.5-1.5" strokeWidth={2} strokeLinecap="round" />
                                </svg>
                            </div>
                            <span className="text-sm font-bold text-gray-700">現在の体重</span>
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
                                    className="w-20 text-right text-2xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 placeholder-gray-200"
                                />
                                <span className="text-xs font-bold text-gray-400">kg</span>
                            </div>
                        </div>
                    </div>

                    {visibleItems.water && (
                        <EditableLogItem
                            icon={<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />}
                            label="水分"
                            value={water}
                            target={target?.water_target != null ? String(target.water_target) : undefined}
                            unit="L"
                            iconBg="bg-blue-50"
                            iconColor="text-blue-500"
                            step={0.5}
                            onChange={(v) => {
                                setWater(v)
                            }}
                        />
                    )}
                    {visibleItems.steps && (
                        <EditableLogItem
                            icon={<path d="M13 4v16M17 4v16M7 4v16M11 4v16" />}
                            label="歩数"
                            value={steps}
                            target={target?.step_target != null ? String(target.step_target) : undefined}
                            unit="歩"
                            iconBg="bg-emerald-50"
                            iconColor="text-emerald-500"
                            step={500}
                            onChange={(v) => {
                                setSteps(v)
                            }}
                        />
                    )}
                    {visibleItems.sleep && (
                        <EditableLogItem
                            icon={<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
                            label="睡眠"
                            value={sleep}
                            target={target?.sleep_target != null ? String(target.sleep_target) : undefined}
                            unit="h"
                            iconBg="bg-indigo-50"
                            iconColor="text-indigo-500"
                            step={0.5}
                            onChange={(v) => {
                                setSleep(v)
                            }}
                        />
                    )}
                    {(visibleItems.workout || true) && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 border border-gray-50 rounded-2xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center shadow-sm">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M7 6v12M17 6v12" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">筋トレ</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400">実施</span>
                                    <button
                                        onClick={() => {
                                            setHabits((prev: any) => ({ ...prev, workout: prev.workout === 1 ? 0 : 1 }))
                                        }}
                                        className={`w-12 h-6 rounded-full transition-all relative ${habits.workout === 1 ? 'bg-orange-500' : 'bg-gray-200'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${habits.workout === 1 ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                            {habits.workout === 1 && (
                                <textarea
                                    value={habits.workout_notes || ''}
                                    onChange={(e) => setHabits((prev: any) => ({ ...prev, workout_notes: e.target.value }))}
                                    placeholder="トレーニング内容（例：スクワット 10回×3セットなど）"
                                    className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-orange-200 text-sm font-bold text-gray-700 placeholder:text-gray-300 min-h-[80px] transition-all"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Notes Section */}
                <div className="mt-6">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">メモ（任意）</label>
                    <textarea
                        value={notes}
                        onChange={(e) => {
                            setNotes(e.target.value)
                        }}
                        placeholder="今日の体調や食事の感想など"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                </div>

                {/* Other Goals (Habits) Section */}
                {(quitGoals?.length || 0) > 0 && (
                    <div className="mt-8 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-rose-500 rounded-full"></div>
                            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">その他の目標</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {quitGoals.map(goal => (
                                <div key={goal} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-rose-100 transition-all">
                                    <span className="text-sm font-bold text-gray-700">{goal}</span>
                                    <button
                                        onClick={() => {
                                            setHabits(prev => ({ ...prev, [goal]: prev[goal] === 1 ? 0 : 1 }))
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${habits[goal] === 1 ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'}`}
                                    >
                                        {habits[goal] === 1 ? (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                                達成
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
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
                        className={`w-full py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-lg ${
                            isSaved && !saving ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
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
                    <p className="text-center text-[10px] text-gray-400">日付: {selectedDate} の記録として保存されます</p>

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
                                            isSaved: false
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
                            className="text-[10px] font-black text-gray-300 hover:text-gray-400 transition-colors flex items-center gap-1 uppercase tracking-widest"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            入力をリセット
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function NutrientItem({ label, value, target, unit, onChange }: { label: string, value: number, target?: number, unit: string, onChange: (v: number) => void }) {
    return (
        <div className="border border-gray-100 p-3 rounded-xl bg-white shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">{label}</div>
            <div className="flex items-center justify-between">
                <div className="flex items-baseline space-x-1">
                    <input
                        type="number"
                        step="0.1"
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                        className="w-16 text-lg font-black text-gray-900 border-none p-0 focus:ring-0 leading-none bg-transparent"
                    />
                    {target !== undefined && (
                        <>
                            <span className="text-gray-300 font-bold mx-1">/</span>
                            <span className="text-gray-400 font-bold">{target}</span>
                        </>
                    )}
                </div>
                <span className="text-[10px] font-bold text-gray-300">{unit}</span>
            </div>
        </div>
    )
}

function EditableLogItem({ icon, label, value, target, unit, iconBg, iconColor, step, onChange }: {
    icon: React.ReactNode,
    label: string,
    value: string,
    target?: string,
    unit: string,
    iconBg: string,
    iconColor: string,
    step: number,
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
        <div className="flex items-center justify-between p-3 border border-gray-50 rounded-2xl hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center shadow-sm`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {icon}
                    </svg>
                </div>
                <span className="text-sm font-bold text-gray-700">{label}</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                    <button 
                        onClick={() => handleAdjust('down')}
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-gray-400 hover:text-blue-500"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <div className="flex items-baseline px-2 min-w-[90px] justify-center">
                        <input
                            type="number"
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="w-24 text-center text-lg font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0"
                        />
                        {target && (
                            <div className="flex items-baseline ml-1 opacity-40">
                                <span className="text-[10px] font-bold mx-0.5">/</span>
                                <span className="text-xs font-bold">{target}</span>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => handleAdjust('up')}
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-gray-400 hover:text-blue-500"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                    </button>
                </div>
                <span className="text-[10px] font-bold text-gray-400 w-4">{unit}</span>
            </div>
        </div>
    )
}
