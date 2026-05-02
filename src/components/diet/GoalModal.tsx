'use client'

import { useState, useEffect } from 'react'

interface GoalModalProps {
    userId: string;
    token: string;
    onClose: () => void;
    onSave: () => void;
}

export default function GoalModal({ userId, token, onClose, onSave }: GoalModalProps) {
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({
        startDate: new Date().toISOString().split('T')[0],
        calories: 2000,
        protein: 150,
        fat: 60,
        carbs: 250,
        sugar: 150,
        fiber: 20,
        salt: 7
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const fetchGoals = async () => {
            try {
                const res = await fetch(`/api/diet/goals?token=${token}`)
                if (res.ok) {
                    const { data } = await res.json()
                    setHistory(data || [])
                    if (data && data.length > 0) {
                        const latest = data[0]
                        setForm({
                            startDate: new Date().toISOString().split('T')[0],
                            calories: latest.calories,
                            protein: latest.protein,
                            fat: latest.fat,
                            carbs: latest.carbs,
                            sugar: latest.sugar,
                            fiber: latest.fiber,
                            salt: latest.salt,
                        })
                    }
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchGoals()
    }, [token])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/diet/goals?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, token })
            })
            if (res.ok) {
                onSave()
                onClose()
            }
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black bg-opacity-50">
            <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-xl font-normal text-gray-900">目標設定</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* New Goal Form */}
                    <section>
                        <h3 className="text-xs font-normal text-blue-600 uppercase tracking-widest mb-4">新しい目標を設定</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-normal text-gray-400 mb-1">開始日</label>
                                <input
                                    type="date"
                                    value={form.startDate}
                                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                                    className="w-full bg-gray-50 border-none rounded-xl font-normal text-gray-700 px-4 py-3"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-normal text-gray-400 mb-1">目標カロリー (kcal)</label>
                                    <input
                                        type="number"
                                        value={form.calories}
                                        onChange={e => setForm({ ...form, calories: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-gray-50 border-none rounded-xl font-normal text-gray-700 px-4 py-3 text-xl"
                                    />
                                </div>
                                <InputItem label="P (g)" value={form.protein} onChange={v => setForm({ ...form, protein: v })} />
                                <InputItem label="F (g)" value={form.fat} onChange={v => setForm({ ...form, fat: v })} />
                                <InputItem label="C (g)" value={form.carbs} onChange={v => setForm({ ...form, carbs: v })} />
                                <InputItem label="食物繊維 (g)" value={form.fiber} onChange={v => setForm({ ...form, fiber: v })} />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full bg-blue-600 text-white py-4 rounded-xl font-normal shadow-lg shadow-blue-200 active:scale-95 transition-all mt-4"
                            >
                                {saving ? '保存中...' : '目標を更新する'}
                            </button>
                        </div>
                    </section>

                    {/* Goal History */}
                    <section>
                        <h3 className="text-xs font-normal text-gray-400 uppercase tracking-widest mb-4">目標の履歴</h3>
                        {loading ? (
                            <div className="text-center py-4 text-gray-300">読み込み中...</div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((h, i) => (
                                    <div key={h.id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-normal text-gray-400">{h.start_date.replace(/-/g, '/')} 〜</div>
                                            <div className="text-lg font-normal text-gray-700">{h.calories} <span className="text-xs">kcal</span></div>
                                        </div>
                                        <div className="text-[10px] font-normal text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm">
                                            P:{h.protein} F:{h.fat} C:{h.carbs}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}

function InputItem({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-[10px] font-normal text-gray-400 mb-1">{label}</label>
            <input
                type="number"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-50 border-none rounded-xl font-normal text-gray-700 px-4 py-3"
            />
        </div>
    )
}
