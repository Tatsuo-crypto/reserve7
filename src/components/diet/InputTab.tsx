'use client'

import { useState, useEffect, useRef } from 'react'
import GoalModal from './GoalModal'

interface InputTabProps {
    userId: string;
    token: string;
    isAdmin: boolean;
}

interface NutrientData {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    sugar: number;
    fiber: number;
    salt: number;
}

export default function InputTab({ userId, token, isAdmin }: InputTabProps) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [weight, setWeight] = useState<string>('')
    const [water, setWater] = useState<string>('0.0')
    const [steps, setSteps] = useState<string>('0')
    const [sleep, setSleep] = useState<string>('0.0')
    const [alcohol, setAlcohol] = useState<string>('0')
    const [analyzing, setAnalyzing] = useState(false)
    const [ocrResult, setOcrResult] = useState<NutrientData | null>(null)
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

            try {
                const [logRes, settingRes] = await Promise.all([
                    fetch(`/api/lifestyle/logs?date=${selectedDate}&token=${token}`),
                    fetch(`/api/lifestyle/settings?token=${token}`)
                ])

                if (logRes.ok) {
                    const { data } = await logRes.json()
                    if (data) {
                        if (data.weight) setWeight(String(data.weight))
                        if (data.water !== undefined) setWater(String(data.water))
                        if (data.steps !== undefined) setSteps(String(data.steps))
                        if (data.sleep !== undefined) setSleep(String(data.sleep))
                        if (data.alcohol !== undefined) setAlcohol(String(data.alcohol))
                    }
                }

                if (settingRes.ok) {
                    const { data } = await settingRes.json()
                    if (data && data.visible_items) {
                        setVisibleItems(data.visible_items)
                    }
                }
            } catch (e) { console.error(e) }
        }
        fetchDateData()
    }, [userId, selectedDate, token])

    const handleMetricSave = async (metric: string, value: string) => {
        if (value === '') return
        setSaving(true)
        setMessage(null)
        try {
            const numValue = parseFloat(value)
            const res = await fetch('/api/lifestyle/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    [metric]: numValue,
                    token: token
                })
            })
            if (res.ok) {
                const metricLabels: { [key: string]: string } = {
                    weight: '体重',
                    water: '水分',
                    steps: '歩数',
                    sleep: '睡眠',
                    alcohol: 'お酒'
                }
                setMessage({ type: 'success', text: `${metricLabels[metric] || metric}を保存しました` })
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setAnalyzing(true)
        setMessage(null)
        const formData = new FormData()
        formData.append('image', file)

        try {
            const res = await fetch('/api/diet/analyze', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (res.ok) {
                setOcrResult(data.data)
            } else {
                throw new Error(data.error || '解析に失敗しました')
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || '解析に失敗しました' })
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
                    ...ocrResult
                })
            })
            if (res.ok) {
                setMessage({ type: 'success', text: '食事データを保存しました' })
                setOcrResult(null)
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

            {/* Goal Management Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowGoalModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                    <span className="text-sm font-bold">目標管理</span>
                </button>
            </div>

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

            {/* 2. Diet OCR Input Card */}
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
                        <h2 className="text-lg font-bold text-gray-900">読み取り結果の確認</h2>
                        <button onClick={() => setOcrResult(null)} className="text-gray-400 hover:text-gray-600">×</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="col-span-2 bg-blue-50 p-4 rounded-xl">
                            <div className="text-xs font-bold text-blue-600 uppercase mb-1">総エネルギー</div>
                            <div className="text-2xl font-black text-blue-900">{ocrResult.calories}<span className="text-sm ml-1">kcal</span></div>
                        </div>

                        <NutrientItem label="P: たんぱく質" value={ocrResult.protein} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, protein: v })} />
                        <NutrientItem label="F: 脂質" value={ocrResult.fat} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, fat: v })} />
                        <NutrientItem label="C: 炭水化物" value={ocrResult.carbs} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, carbs: v })} />
                        <NutrientItem label="糖質" value={ocrResult.sugar} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, sugar: v })} />
                        <NutrientItem label="食物繊維" value={ocrResult.fiber} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, fiber: v })} />
                        <NutrientItem label="塩分" value={ocrResult.salt} unit="g" onChange={(v) => setOcrResult({ ...ocrResult, salt: v })} />
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
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    placeholder="00.0"
                                    className="w-20 text-right text-2xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 placeholder-gray-200"
                                />
                                <span className="text-xs font-bold text-gray-400">kg</span>
                            </div>
                            <button
                                onClick={() => handleMetricSave('weight', weight)}
                                disabled={!weight || saving}
                                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${weight ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-300'}`}
                            >
                                保存
                            </button>
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
                            options={Array.from({ length: 51 }, (_, i) => (i * 0.1).toFixed(1))}
                            onChange={(v) => {
                                setWater(v)
                                handleMetricSave('water', v)
                            }}
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
                            options={Array.from({ length: 41 }, (_, i) => String(i * 500))}
                            onChange={(v) => {
                                setSteps(v)
                                handleMetricSave('steps', v)
                            }}
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
                            onChange={(v) => setSleep(v)}
                            onSave={() => handleMetricSave('sleep', sleep)}
                        />
                    )}
                    {visibleItems.alcohol && (
                        <EditableLogItem
                            icon={<path d="M18 2H6v7c0 3.31 2.69 6 6 6s6-2.69 6-6V2zM12 15v5M8 22h8" />}
                            label="お酒"
                            value={alcohol}
                            unit="杯"
                            iconBg="bg-orange-50"
                            iconColor="text-orange-500"
                            onChange={(v) => setAlcohol(v)}
                            onSave={() => handleMetricSave('alcohol', alcohol)}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

function NutrientItem({ label, value, unit, onChange }: { label: string, value: number, unit: string, onChange: (v: number) => void }) {
    return (
        <div className="border border-gray-100 p-3 rounded-xl">
            <div className="text-[10px] font-bold text-gray-400 mb-1">{label}</div>
            <div className="flex items-end">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="w-full text-lg font-bold text-gray-900 border-none p-0 focus:ring-0 leading-none"
                />
                <span className="text-xs font-bold text-gray-400 ml-1">{unit}</span>
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
