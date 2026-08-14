'use client'

import { useState, useEffect, useRef } from 'react'
import AppModal from '@/components/ui/AppModal'
import Button from '@/components/ui/Button'

interface GoalModalProps {
    userId: string;
    token: string;
    onClose: () => void;
    onSave: () => void;
}

function toDateInputValue(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function tomorrowDateInput() {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return toDateInputValue(date)
}

export default function GoalModal({ userId, token, onClose, onSave }: GoalModalProps) {
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({
        startDate: tomorrowDateInput(),
        endDate: '',
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
                            startDate: tomorrowDateInput(),
                            endDate: latest.end_date || '',
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
            const payload: any = { ...form, token }
            if (!payload.endDate) delete payload.endDate
            const res = await fetch(`/api/diet/goals?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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

    const macroEditOrderRef = useRef<('protein' | 'fat' | 'carbs')[]>([])

    const applyMacroAutoFill = (next: typeof form, order: ('protein' | 'fat' | 'carbs')[]) => {
        if (order.length < 2) return next
        const fillKey = (['protein', 'fat', 'carbs'] as const).find(key => !order.includes(key))
        if (!fillKey) return next
        const usedCalories = (['protein', 'fat', 'carbs'] as const)
            .filter(key => key !== fillKey)
            .reduce((sum, key) => sum + Number(next[key] || 0) * (key === 'fat' ? 9 : 4), 0)
        const remainingCalories = Math.max(0, Math.round(Number(next.calories || 0) - usedCalories))
        const grams = fillKey === 'fat' ? Math.round(remainingCalories / 9) : Math.round(remainingCalories / 4)
        const filled = { ...next, [fillKey]: grams }
        if (fillKey === 'carbs') {
            filled.sugar = Math.max(0, grams - Number(filled.fiber || 0))
        }
        return filled
    }

    const handleCaloriesChange = (value: number) => {
        setForm(prev => applyMacroAutoFill({ ...prev, calories: Math.max(0, Math.round(value || 0)) }, macroEditOrderRef.current))
    }

    const handleMacroChange = (key: 'protein' | 'fat' | 'carbs', value: number) => {
        const order = [...macroEditOrderRef.current.filter(item => item !== key), key].slice(-2)
        macroEditOrderRef.current = order
        setForm(prev => {
            const next = { ...prev, [key]: Math.max(0, Math.round(value || 0)) }
            if (key === 'carbs') next.sugar = Math.max(0, next.carbs - Number(next.fiber || 0))
            return applyMacroAutoFill(next, order)
        })
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
                        className="rounded-full bg-brand-500 px-5 py-2 text-sm text-white disabled:opacity-50"
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
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-normal text-text-muted mb-1">開始日</label>
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={e => setForm({ ...form, startDate: e.target.value })}
                                        className="w-full bg-surface-base border-none rounded-2xl font-normal text-text-secondary px-4 py-3"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-normal text-text-muted mb-1">終了日</label>
                                    <input
                                        type="date"
                                        value={form.endDate}
                                        min={form.startDate || undefined}
                                        onChange={e => setForm({ ...form, endDate: e.target.value })}
                                        className="w-full bg-surface-base border-none rounded-2xl font-normal text-text-secondary px-4 py-3"
                                    />
                                    <p className="mt-1 text-xs text-text-muted">空欄なら継続</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-normal text-text-muted mb-1">目標カロリー (kcal)</label>
                                    <NumericInput
                                        value={form.calories}
                                        onValueChange={handleCaloriesChange}
                                        className="w-full bg-surface-base border-none rounded-2xl font-bold tabular-nums text-text-secondary px-4 py-3 text-3xl"
                                    />
                                </div>
                                <InputItem label="P (g)" value={form.protein} onChange={v => handleMacroChange('protein', v)} />
                                <InputItem label="F (g)" value={form.fat} onChange={v => handleMacroChange('fat', v)} />
                                <InputItem label="C (g)" value={form.carbs} onChange={v => handleMacroChange('carbs', v)} />
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
            <NumericInput
                value={value}
                onValueChange={onChange}
                className="w-full bg-surface-base border-none rounded-2xl font-normal text-text-secondary px-4 py-3"
            />
        </div>
    )
}

function NumericInput({
    value,
    onValueChange,
    className,
}: {
    value: number
    onValueChange: (value: number) => void
    className?: string
}) {
    const [draft, setDraft] = useState(String(Math.round(Number(value || 0))))
    const [focused, setFocused] = useState(false)

    useEffect(() => {
        if (!focused) setDraft(String(Math.round(Number(value || 0))))
    }, [focused, value])

    return (
        <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft}
            onFocus={() => setFocused(true)}
            onBlur={() => {
                setFocused(false)
                if (draft === '') setDraft('0')
            }}
            onChange={(e) => {
                const raw = e.target.value
                setDraft(raw)
                if (raw === '') {
                    onValueChange(0)
                    return
                }
                const parsed = Number(raw)
                if (Number.isFinite(parsed)) onValueChange(Math.max(0, Math.round(parsed)))
            }}
            className={className}
        />
    )
}
