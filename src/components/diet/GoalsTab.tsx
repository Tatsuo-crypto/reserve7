'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/icons'
import { SkeletonCard } from '@/components/ui/Skeleton'

interface GoalsTabProps {
    userId?: string
    token: string
    isAdmin?: boolean
}

type GoalType = 'weight' | 'habit'
type GoalStatus = 'active' | 'achieved' | 'missed' | 'archived'

interface Goal {
    id: string
    type: GoalType
    title: string
    target_value: number | null
    start_date: string
    deadline: string | null
    status: GoalStatus
    achieved_at: string | null
    note: string | null
}

function daysUntil(deadline: string | null): number | null {
    if (!deadline) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(deadline)
    d.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function daysSince(startDate: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(startDate)
    d.setHours(0, 0, 0, 0)
    return Math.max(0, Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)))
}

function todayInputValue() {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function initialGoalForm() {
    return {
        type: 'weight' as GoalType,
        title: '',
        targetValue: '60',
        deadline: todayInputValue(),
        note: '',
    }
}

function goalToForm(goal: Goal) {
    return {
        type: goal.type,
        title: goal.type === 'habit' ? goal.title : '',
        targetValue: goal.target_value != null ? String(goal.target_value) : '60',
        deadline: goal.deadline || todayInputValue(),
        note: goal.note || '',
    }
}

/**
 * M-2: 「目標」タブ（成果のゴール＝体重・習慣。期限と達成/未達成を持つ）。
 * 3機能に限定してクラターを避ける: 1.今の目標 2.新しい目標を追加 3.過去の目標（履歴、グラフなし）。
 * カロリー・PFC・生活習慣の「手段の設定」は引き続き別タブ（カロリー設定）が担当する。
 */
export default function GoalsTab({ userId, token, isAdmin }: GoalsTabProps) {
    const [goals, setGoals] = useState<Goal[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [newGoal, setNewGoal] = useState(initialGoalForm)

    const query = useMemo(() => (
        isAdmin && userId ? `userId=${encodeURIComponent(userId)}` : `token=${encodeURIComponent(token || '')}`
    ), [isAdmin, userId, token])

    const fetchGoals = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/goals?${query}`)
            const json = await res.json()
            setGoals(json.data || [])
        } catch (e) {
            console.error('Fetch goals error:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (token || (isAdmin && userId)) fetchGoals()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query])

    const activeGoals = goals.filter(g => g.status === 'active')
    const pastGoals = [...goals]
        .filter(g => g.status === 'achieved' || g.status === 'missed')
        .sort((a, b) => String(b.achieved_at || '').localeCompare(String(a.achieved_at || '')))

    // 習慣目標は quit_goals 配列（既存の日次○×トラッキング）とタイトルを同期させる。
    const syncQuitGoals = async (updater: (current: string[]) => string[]) => {
        try {
            const settingsRes = await fetch(`/api/lifestyle/settings?${isAdmin && userId ? `userId=${encodeURIComponent(userId)}` : `token=${encodeURIComponent(token || '')}`}`)
            const settingsJson = await settingsRes.json()
            const data = settingsJson.data || {}
            const currentQuitGoals: string[] = data.quit_goals || []
            const nextQuitGoals = updater(currentQuitGoals)
            await fetch('/api/lifestyle/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: isAdmin ? userId : undefined,
                    token: !isAdmin ? token : undefined,
                    visibleItems: data.visible_items,
                    visibleTabs: data.visible_tabs,
                    quit_goals: nextQuitGoals,
                    habit_targets: data.habit_targets,
                })
            })
        } catch (e) {
            console.error('Sync quit_goals error:', e)
        }
    }

    const handleSaveGoal = async () => {
        if (newGoal.type === 'habit' && !newGoal.title.trim()) return
        if (newGoal.type === 'weight' && !newGoal.targetValue) return
        const title = newGoal.type === 'weight' ? '目標体重' : newGoal.title.trim()
        setSaving(true)
        try {
            const isEditing = Boolean(editingGoalId)
            const res = await fetch(isEditing ? `/api/goals/${editingGoalId}?${query}` : `/api/goals?${query}`, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: isAdmin ? userId : undefined,
                    token: !isAdmin ? token : undefined,
                    type: newGoal.type,
                    title,
                    targetValue: newGoal.type === 'weight' ? parseFloat(newGoal.targetValue) : null,
                    deadline: newGoal.deadline || null,
                    note: newGoal.note.trim() || null,
                })
            })
            if (res.ok) {
                if (!isEditing && newGoal.type === 'habit') {
                    await syncQuitGoals(current => current.includes(title) ? current : [...current, title])
                }
                setNewGoal(initialGoalForm())
                setEditingGoalId(null)
                setCreating(false)
                setMessage(isEditing ? '目標を更新しました' : '目標を追加しました')
                await fetchGoals()
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (e) {
            console.error('Save goal error:', e)
        } finally {
            setSaving(false)
        }
    }

    const openEditGoal = (goal: Goal) => {
        setNewGoal(goalToForm(goal))
        setEditingGoalId(goal.id)
        setCreating(true)
    }

    const closeGoalForm = () => {
        setCreating(false)
        setEditingGoalId(null)
        setNewGoal(initialGoalForm())
    }

    const handleDeleteGoal = async () => {
        if (!editingGoalId) return
        const goal = goals.find(g => g.id === editingGoalId)
        setSaving(true)
        try {
            const res = await fetch(`/api/goals/${editingGoalId}?${query}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                if (goal?.type === 'habit') {
                    await syncQuitGoals(current => current.filter(g => g !== goal.title))
                }
                closeGoalForm()
                setMessage('目標を削除しました')
                await fetchGoals()
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (e) {
            console.error('Delete goal error:', e)
        } finally {
            setSaving(false)
        }
    }

    const updateStatus = async (goal: Goal, status: GoalStatus) => {
        try {
            const res = await fetch(`/api/goals/${goal.id}?${query}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })
            if (res.ok) {
                if (goal.type === 'habit' && (status === 'achieved' || status === 'missed' || status === 'archived')) {
                    await syncQuitGoals(current => current.filter(g => g !== goal.title))
                }
                await fetchGoals()
            }
        } catch (e) {
            console.error('Update goal status error:', e)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 pb-24">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 animate-fadeIn">
            {/* 1. 今の目標 */}
            <Card padding="lg">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                    <h2 className="text-xl font-semibold text-text-primary tracking-tight">今の目標</h2>
                </div>

                {activeGoals.length === 0 ? (
                    <EmptyState
                        icon="flag"
                        title="今の目標はありません"
                        description="体重や習慣の目標を作ると、進行中の目標として表示されます。"
                    />
                ) : (
                    <div className="space-y-3">
                        {activeGoals.map(goal => {
                            const remain = daysUntil(goal.deadline)
                            const streak = daysSince(goal.start_date)
                            return (
                                <div key={goal.id} className="rounded-2xl bg-surface-base border-2 border-border-strong p-5 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-normal text-text-muted uppercase tracking-widest mb-1">{goal.type === 'weight' ? '体重' : '習慣'}</p>
                                        <p className="text-base font-semibold text-text-primary">
                                            {goal.type === 'weight' && goal.target_value != null ? `目標 ${goal.target_value}kg` : goal.title}
                                        </p>
                                        <p className="text-xs text-text-muted mt-1">
                                            {goal.type === 'habit' && `${streak}日目`}
                                            {goal.deadline && remain !== null && (
                                                <span className={goal.type === 'habit' ? 'ml-2' : ''}>
                                                    期限まであと{remain}日
                                                </span>
                                            )}
                                        </p>
                                        {goal.note && <p className="text-xs text-text-secondary mt-2">{goal.note}</p>}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <label className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-raised border border-border-subtle cursor-pointer hover:bg-surface-overlay" aria-label="達成にする">
                                            <input
                                                type="checkbox"
                                                checked={false}
                                                onChange={() => updateStatus(goal, 'achieved')}
                                                className="h-4 w-4 rounded-lg border-border-strong bg-surface-base accent-brand-600"
                                            />
                                        </label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => openEditGoal(goal)}
                                            aria-label="目標を編集"
                                            className="h-9 w-9 rounded-full border border-brand-500/20 bg-brand-500/15 p-0 text-brand-300 hover:bg-brand-500/25 flex items-center justify-center"
                                        >
                                            <Icon name="pencil" size={16} />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Card>

            {/* 2. 新しい目標を追加 */}
            {!creating ? (
                <Button onClick={() => {
                    setNewGoal(initialGoalForm())
                    setEditingGoalId(null)
                    setCreating(true)
                }} fullWidth className="py-4">新しい目標を追加</Button>
            ) : (
                <Card padding="lg" className="space-y-5">
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setNewGoal(prev => ({ ...prev, type: 'weight' }))} className={`flex-1 py-3 rounded-2xl text-sm transition-colors ${newGoal.type === 'weight' ? 'bg-surface-overlay text-text-primary' : 'bg-surface-base text-text-secondary hover:bg-surface-overlay'}`}>体重の目標</Button>
                        <Button type="button" variant="ghost" onClick={() => setNewGoal(prev => ({ ...prev, type: 'habit' }))} className={`flex-1 py-3 rounded-2xl text-sm transition-colors ${newGoal.type === 'habit' ? 'bg-surface-overlay text-text-primary' : 'bg-surface-base text-text-secondary hover:bg-surface-overlay'}`}>習慣の目標</Button>
                    </div>

                    {newGoal.type === 'habit' && (
                        <div className="space-y-1">
                            <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">習慣の目標</label>
                            <input type="text" value={newGoal.title} onChange={e => setNewGoal(prev => ({ ...prev, title: e.target.value }))} placeholder="砂糖をやめる" className="w-full bg-surface-base border-none rounded-2xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                        </div>
                    )}

                    {newGoal.type === 'weight' && (
                        <div className="space-y-1">
                            <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">目標体重(kg)</label>
                            <input type="number" step="0.1" value={newGoal.targetValue} onChange={e => setNewGoal(prev => ({ ...prev, targetValue: e.target.value }))} className="w-full bg-surface-base border-none rounded-2xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">期限（任意）</label>
                        <input type="date" value={newGoal.deadline} onChange={e => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))} className="w-full bg-surface-base border-none rounded-2xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">メモ（任意）</label>
                        <textarea
                            value={newGoal.note}
                            onChange={e => setNewGoal(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="補足メモ"
                            rows={3}
                            className="w-full bg-surface-base border-none rounded-2xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500 resize-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={handleSaveGoal} loading={saving} className="flex-1">{saving ? '保存中...' : editingGoalId ? '更新する' : '目標を追加'}</Button>
                        <Button onClick={closeGoalForm} variant="ghost">キャンセル</Button>
                    </div>
                    {editingGoalId && (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteGoal}
                            disabled={saving}
                            className="w-full rounded-2xl border border-state-danger-500/25 bg-state-danger-500/10 px-4 py-3 text-sm text-state-danger-300 hover:bg-state-danger-500/15 disabled:opacity-60"
                        >
                            削除
                        </Button>
                    )}
                </Card>
            )}

            {/* 3. 過去の目標（達成/未達成の履歴。グラフなし） */}
            {pastGoals.length > 0 && (
                <Card padding="lg" className="bg-transparent border-0 shadow-none">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-brand-500/70 rounded-full"></div>
                        <h2 className="text-lg font-normal text-text-secondary tracking-tight">過去の目標</h2>
                    </div>
                    <div className="space-y-3">
                        {pastGoals.map(goal => {
                            const remain = daysUntil(goal.deadline)
                            const streak = daysSince(goal.start_date)
                            return (
                            <div key={goal.id} className="rounded-2xl bg-surface-base border-2 border-border-strong p-5 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-normal text-text-muted uppercase tracking-widest mb-1">{goal.type === 'weight' ? '体重' : '習慣'}</p>
                                    <p className="text-base font-normal text-text-secondary">
                                        {goal.type === 'weight' && goal.target_value != null ? `目標 ${goal.target_value}kg` : goal.title}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">
                                        {goal.type === 'habit' && `${streak}日目`}
                                        {goal.deadline && remain !== null && (
                                            <span className={goal.type === 'habit' ? 'ml-2' : ''}>
                                                期限まであと{remain}日
                                            </span>
                                        )}
                                    </p>
                                    {goal.note && <p className="text-xs text-text-muted mt-1">{goal.note}</p>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <label className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-raised border border-border-subtle cursor-pointer hover:bg-surface-overlay" aria-label={goal.status === 'achieved' ? '未達成にする' : '達成にする'}>
                                        <input
                                            type="checkbox"
                                            checked={goal.status === 'achieved'}
                                            onChange={(e) => updateStatus(goal, e.target.checked ? 'achieved' : 'missed')}
                                            className="h-4 w-4 rounded-lg border-border-strong bg-surface-base accent-brand-600"
                                        />
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => openEditGoal(goal)}
                                        aria-label="目標を編集"
                                        className="h-9 w-9 rounded-full border border-brand-500/20 bg-brand-500/15 p-0 text-brand-300 hover:bg-brand-500/25 flex items-center justify-center"
                                    >
                                        <Icon name="pencil" size={16} />
                                    </Button>
                                </div>
                            </div>
                            )
                        })}
                    </div>
                </Card>
            )}

            {message && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-surface-overlay text-text-primary border border-border-strong px-8 py-4 rounded-2xl font-normal shadow-xl z-50 animate-slideUp">{message}</div>}
        </div>
    )
}
