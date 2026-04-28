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

export default function InputTab({ userId, token, isAdmin }: InputTabProps) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [weight, setWeight] = useState<string>('')
    const [water, setWater] = useState<string>('0.0')
    const [steps, setSteps] = useState<string>('0')
    const [sleep, setSleep] = useState<string>('0.0')
    const [alcohol, setAlcohol] = useState<string>('0')
    const [notes, setNotes] = useState<string>('')
    const [dietImageUrl, setDietImageUrl] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [ocrResult, setOcrResult] = useState<NutrientData | null>(null)
    const [habits, setHabits] = useState<Record<string, number>>({})
    const [quitGoals, setQuitGoals] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [showGoalModal, setShowGoalModal] = useState(false)
    const [visibleItems, setVisibleItems] = useState({ steps: true, sleep: true, water: true, alcohol: true })
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Fetch data for selected date
    useEffect(() => {
        const fetchDateData = async () => {
            // Reset states before fetch
            setWeight('')
            setWater('0.0')
            setSteps('0')
            setSleep('0.0')
            setAlcohol('0')
            setNotes('')
            setHabits({})
            setOcrResult(null)
            setDietImageUrl(null)

            try {
                const [logRes, settingRes, dietRes] = await Promise.all([
                    fetch(`/api/lifestyle/logs?date=${selectedDate}&token=${token}`),
                    fetch(`/api/lifestyle/settings?token=${token}`),
                    fetch(`/api/diet/logs?date=${selectedDate}&token=${token}`)
                ])

                if (logRes.ok) {
                    const { data } = await logRes.json()
                    if (data) {
                        if (data.weight) setWeight(String(data.weight))
                        if (data.water !== undefined) setWater(String(data.water))
                        if (data.steps !== undefined) setSteps(String(data.steps))
                        if (data.sleep !== undefined) setSleep(String(data.sleep))
                        if (data.alcohol !== undefined) setAlcohol(String(data.alcohol))
                        if (data.notes) setNotes(data.notes)
                        if (data.habits) setHabits(data.habits)
                    }
                }

                if (settingRes.ok) {
                    const { data } = await settingRes.json()
                    if (data) {
                        if (data.visible_items) setVisibleItems(data.visible_items)
                        if (data.quit_goals) setQuitGoals(data.quit_goals)
                    }
                }

                if (dietRes.ok) {
                    const { data } = await dietRes.json()
                    if (data) {
                        setOcrResult(data)
                        if (data.image_url) setDietImageUrl(data.image_url)
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
            const body: any = {
                date: selectedDate,
                token: token,
                notes: notes,
                habits: habits
            }

            if (weight) body.weight = parseFloat(weight)
            if (water) body.water = parseFloat(water)
            if (steps) body.steps = parseInt(steps)
            if (sleep) body.sleep = parseFloat(sleep)
            if (alcohol) body.alcohol = parseFloat(alcohol)

            const res = await fetch('/api/lifestyle/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setMessage({ type: 'success', text: '記録を保存しました' })
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
                setOcrResult(analyzeData.data)
            } else {
                console.error('Analysis failed:', analyzeData.error)
                setMessage({ type: 'error', text: '写真の解析に失敗しました。手動で入力してください。' })
            }
        } catch (e: any) {
            console.error('Upload process error:', e)
            setMessage({ type: 'error', text: e.message || 'エラーが発生しました' })
        } finally {
            setAnalyzing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleOcrSave = async () => {
        if (!ocrResult) return
        setSaving(true)
        try {
            const res = await fetch('/api/diet/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    token: token,
                    ...ocrResult,
                    image_url: dietImageUrl
                })
            })
            if (res.ok) {
                setMessage({ type: 'success', text: '食事データを保存しました' })
                setTimeout(() => setMessage(null), 3000)
            } else {
                throw new Error('保存に失敗しました')
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'エラーが発生しました' })
        } finally {
            setSaving(false)
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
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
                                    {saving ? '保存中...' : (ocrResult.id ? '保存済み' : '解析結果のプレビュー')}
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6">
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

                            <button
                                onClick={handleOcrSave}
                                disabled={saving}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors"
                            >
                                {saving ? '保存中...' : 'この内容で確定する'}
                            </button>
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
                                    onChange={(e) => setWeight(e.target.value)}
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
                            unit="L"
                            iconBg="bg-blue-50"
                            iconColor="text-blue-500"
                            type="select"
                            options={Array.from({ length: 11 }, (_, i) => (i * 0.5).toFixed(1))}
                            onChange={(v) => setWater(v)}
                        />
                    )}
                    {visibleItems.steps && (
                        <EditableLogItem
                            icon={<path d="M13 4v16M17 4v16M7 4v16M11 4v16" />}
                            label="歩数"
                            value={steps}
                            unit="歩"
                            iconBg="bg-emerald-50"
                            iconColor="text-emerald-500"
                            type="select"
                            options={Array.from({ length: 61 }, (_, i) => String(i * 500))}
                            onChange={(v) => setSteps(v)}
                        />
                    )}
                    {visibleItems.sleep && (
                        <EditableLogItem
                            icon={<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
                            label="睡眠"
                            value={sleep}
                            unit="h"
                            iconBg="bg-indigo-50"
                            iconColor="text-indigo-500"
                            type="select"
                            options={Array.from({ length: 27 }, (_, i) => (1.0 + i * 0.5).toFixed(1))}
                            onChange={(v) => setSleep(v)}
                        />
                    )}
                </div>

                {/* Notes Section */}
                <div className="mt-6">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">メモ（任意）</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="今日の体調や食事の感想など"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                </div>

                {/* Other Goals (Habits) Section */}
                {quitGoals.length > 0 && (
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
                                        onClick={() => setHabits(prev => ({ ...prev, [goal]: prev[goal] === 1 ? 0 : 1 }))}
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
                <div className="mt-8">
                    <button
                        onClick={handleAllSave}
                        disabled={saving}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 text-lg"
                    >
                        {saving ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                保存中...
                            </>
                        ) : '入力内容を保存する'}
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-3">日付: {selectedDate} の記録として保存されます</p>
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

function EditableLogItem({ icon, label, value, unit, iconBg, iconColor, type = 'number', options, onChange, onSave }: {
    icon: React.ReactNode,
    label: string,
    value: string,
    unit: string,
    iconBg: string,
    iconColor: string,
    type?: 'number' | 'select',
    options?: string[],
    onChange: (v: string) => void,
    onSave?: () => void
}) {
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
            <div className="flex items-center space-x-2">
                {type === 'select' ? (
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="text-xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 appearance-none cursor-pointer text-right min-w-[60px]"
                    >
                        {options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-16 text-right text-xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0"
                    />
                )}
                <span className="text-[10px] font-bold text-gray-400 mt-1">{unit}</span>
                {type !== 'select' && onSave && (
                    <button
                        onClick={onSave}
                        className="ml-2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}
