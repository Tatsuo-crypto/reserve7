'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

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

/**
 * M-2: 「目標」タブ（成果のゴール＝体重・習慣。期限と達成/未達成を持つ）。
 * 3機能に限定してクラターを避ける: 1.今の目標 2.新しい目標を追加 3.過去の目標（履歴、グラフなし）。
 * カロリー・PFC・生活習慣の「手段の設定」は引き続き別タブ（カロリー設定）が担当する。
 */
export default function GoalsTab({ userId, token, isAdmin }: GoalsTabProps) {
    const [goals, setGoals] = useState<Goal[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [newGoal, setNewGoal] = useState({
        type: 'weight' as GoalType,
        title: '',
        targetValue: '',
        deadline: '',
    })

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

    const handleCreate = async () => {
        if (!newGoal.title.trim()) return
        if (newGoal.type === 'weight' && !newGoal.targetValue) return
        setSaving(true)
        try {
            const res = await fetch(`/api/goals?${isAdmin && userId ? `userId=${encodeURIComponent(userId)}` : `token=${encodeURIComponent(token || '')}`}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: isAdmin ? userId : undefined,
                    token: !isAdmin ? token : undefined,
                    type: newGoal.type,
                    title: newGoal.title.trim(),
                    targetValue: newGoal.type === 'weight' ? parseFloat(newGoal.targetValue) : null,
                    deadline: newGoal.deadline || null,
                })
            })
            if (res.ok) {
                if (newGoal.type === 'habit') {
                    await syncQuitGoals(current => current.includes(newGoal.title.trim()) ? current : [...current, newGoal.title.trim()])
                }
                setNewGoal({ type: 'weight', title: '', targetValue: '', deadline: '' })
                setCreating(false)
                setMessage('目標を追加しました')
                await fetchGoals()
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (e) {
            console.error('Create goal error:', e)
        } finally {
            setSaving(false)
        }
    }

    const updateStatus = async (goal: Goal, status: GoalStatus) => {
        try {
            const res = await fetch(`/api/goals/${goal.id}?${isAdmin ? '' : `token=${encodeURIComponent(token || '')}`}`, {
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
        return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>
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
                    <p className="text-sm text-text-muted">まだ目標が設定されていません。</p>
                ) : (
                    <div className="space-y-3">
                        {activeGoals.map(goal => {
                            const remain = daysUntil(goal.deadline)
                            const streak = daysSince(goal.start_date)
                            return (
                                <div key={goal.id} className="rounded-2xl bg-surface-base border border-border-subtle p-5 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-normal text-text-muted uppercase tracking-widest mb-1">{goal.type === 'weight' ? '体重' : '習慣'}</p>
                                        <p className="text-base font-semibold text-text-primary">
                                            {goal.title}
                                            {goal.type === 'weight' && goal.target_value != null && (
                                                <span className="ml-2 text-sm text-text-secondary">目標 {goal.target_value}kg</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-text-muted mt-1">
                                            {goal.type === 'habit' && `${streak}日目`}
                                            {goal.deadline && remain !== null && (
                                                <span className={goal.type === 'habit' ? 'ml-2' : ''}>
                                                    期限まであと{remain}日
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => updateStatus(goal, 'achieved')} className="text-xs text-state-success-300 bg-state-success-500/15 px-3 py-2 rounded-full hover:bg-state-success-500/25">達成にする</button>
                                        <button onClick={() => updateStatus(goal, 'missed')} className="text-xs text-text-muted hover:text-text-secondary px-2 py-2">未達成</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Card>

            {/* 2. 新しい目標を追加 */}
            {!creating ? (
                <Button onClick={() => setCreating(true)} fullWidth className="py-4">新しい目標を追加</Button>
            ) : (
                <Card padding="lg" className="space-y-5">
                    <div className="flex gap-2">
                        <button onClick={() => setNewGoal(prev => ({ ...prev, type: 'weight' }))} className={`flex-1 py-3 rounded-xl text-sm transition-colors ${newGoal.type === 'weight' ? 'bg-surface-overlay text-text-primary' : 'bg-surface-base text-text-secondary hover:bg-surface-overlay'}`}>体重の目標</button>
                        <button onClick={() => setNewGoal(prev => ({ ...prev, type: 'habit' }))} className={`flex-1 py-3 rounded-xl text-sm transition-colors ${newGoal.type === 'habit' ? 'bg-surface-overlay text-text-primary' : 'bg-surface-base text-text-secondary hover:bg-surface-overlay'}`}>習慣の目標</button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-normal text-text-muted uppercase tracking-widest pl-1">{newGoal.type === 'weight' ? '目標のタイトル（任意）' : '目標（例: 砂糖をやめる）'}</label>
                        <input type="text" value={newGoal.title} onChange={e => setNewGoal(prev => ({ ...prev, title: e.target.value }))} placeholder={newGoal.type === 'weight' ? '目標体重' : '砂糖をやめる'} className="w-full bg-surface-base border-none rounded-xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                    </div>

                    {newGoal.type === 'weight' && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-normal text-text-muted uppercase tracking-widest pl-1">目標体重(kg)</label>
                            <input type="number" value={newGoal.targetValue} onChange={e => setNewGoal(prev => ({ ...prev, targetValue: e.target.value }))} placeholder="60" className="w-full bg-surface-base border-none rounded-xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] font-normal text-text-muted uppercase tracking-widest pl-1">期限（任意）</label>
                        <input type="date" value={newGoal.deadline} onChange={e => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))} className="w-full bg-surface-base border-none rounded-xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={handleCreate} loading={saving} className="flex-1">{saving ? '保存中...' : '目標を追加'}</Button>
                        <Button onClick={() => setCreating(false)} variant="ghost">キャンセル</Button>
                    </div>
                </Card>
            )}

            {/* 3. 過去の目標（達成/未達成の履歴。グラフなし） */}
            {pastGoals.length > 0 && (
                <Card padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                        <h2 className="text-xl font-semibold text-text-primary tracking-tight">過去の目標</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {pastGoals.map(goal => (
                            <div key={goal.id} className="py-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-normal text-text-muted uppercase tracking-widest">{goal.type === 'weight' ? '体重' : '習慣'}</p>
                                    <p className="text-sm font-normal text-text-primary">{goal.title}{goal.type === 'weight' && goal.target_value != null && <span className="ml-2 text-xs text-text-muted">{goal.target_value}kg</span>}</p>
                                </div>
                                <Badge tone={goal.status === 'achieved' ? 'success' : 'neutral'}>
                                    {goal.status === 'achieved' ? '達成 ✓' : '未達成 ×'}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {message && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-surface-overlay text-text-primary border border-border-strong px-8 py-4 rounded-2xl font-normal shadow-xl z-50 animate-slideUp">{message}</div>}
        </div>
    )
}
