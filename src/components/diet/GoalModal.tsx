'use client'

import { useState, useEffect } from 'react'
import AppModal from '@/components/ui/AppModal'
import Button from '@/components/ui/Button'

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
        <AppModal
            title="目標設定"
            onClose={onClose}
            align="bottom"
            bodyClassName="space-y-8 p-5 sm:p-6"
            footer={(
                <>
                    <Button type="button" variant="ghost" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-text-secondary">キャンセル</Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-full bg-brand-700 px-5 py-2 text-sm text-white disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '保存'}
                    </Button>
                </>
            )}
        >
                    {/* New Goal Form */}
                    <section>
                        <h3 className="text-xs font-normal text-brand-600 uppercase tracking-widest mb-4">新しい目標を設定</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-normal text-text-muted mb-1">開始日</label>
                                <input
                                    type="date"
                                    value={form.startDate}
                                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                                    className="w-full bg-surface-base border-none rounded-2xl font-normal text-text-secondary px-4 py-3"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-normal text-text-muted mb-1">目標カロリー (kcal)</label>
                                    <input
                                        type="number"
                                        value={form.calories}
                                        onChange={e => setForm({ ...form, calories: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-surface-base border-none rounded-2xl font-bold tabular-nums text-text-secondary px-4 py-3 text-3xl"
                                    />
                                </div>
                                <InputItem label="P (g)" value={form.protein} onChange={v => setForm({ ...form, protein: v })} />
                                <InputItem label="F (g)" value={form.fat} onChange={v => setForm({ ...form, fat: v })} />
                                <InputItem label="C (g)" value={form.carbs} onChange={v => setForm({ ...form, carbs: v })} />
                                <InputItem label="糖質 (g)" value={form.sugar} onChange={v => setForm({ ...form, sugar: v })} />
                                <InputItem label="食物繊維 (g)" value={form.fiber} onChange={v => setForm({ ...form, fiber: v })} />
                                <InputItem label="塩分 (g)" value={form.salt} onChange={v => setForm({ ...form, salt: v })} />
                            </div>

                        </div>
                    </section>

                    {/* Goal History */}
                    <section>
                        <h3 className="text-xs font-normal text-text-muted uppercase tracking-widest mb-4">目標の履歴</h3>
                        {loading ? (
                            <div className="text-center py-4 text-text-muted">読み込み中...</div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((h, i) => (
                                    <div key={h.id} className="bg-surface-base rounded-2xl p-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-normal text-text-muted">{h.start_date.replace(/-/g, '/')} 〜</div>
                                            <div className="text-sm font-semibold text-text-secondary">{h.calories} <span className="text-xs">kcal</span></div>
                                        </div>
                                        <div className="text-xs font-normal text-text-muted bg-surface-raised px-3 py-1 rounded-full shadow-sm">
                                            P:{h.protein} F:{h.fat} C:{h.carbs} 糖:{h.sugar} 繊:{h.fiber} 塩:{h.salt}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
        </AppModal>
    )
}

function InputItem({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-xs font-normal text-text-muted mb-1">{label}</label>
            <input
                type="number"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-surface-base border-none rounded-2xl font-normal text-text-secondary px-4 py-3"
            />
        </div>
    )
}
