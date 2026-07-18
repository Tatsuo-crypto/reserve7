'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/icons'
import Button from '@/components/ui/Button'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const DAYS_EN = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜']

interface OnlineLesson {
    id: string
    title: string
    meet_url: string
    description: string
    day_of_week: number[] | null
    start_time: string | null
    end_time: string | null
    difficulty: string
    url_expires_at: string | null
    userIds?: string[]
}

const emptyLesson = (): Omit<OnlineLesson, 'id'> => ({
    title: '',
    meet_url: '',
    description: '',
    day_of_week: [],
    start_time: '',
    end_time: '',
    difficulty: '初心者',
    url_expires_at: '',
    userIds: [],
})

function formatSchedule(lesson: OnlineLesson | Omit<OnlineLesson, 'id'>): string {
    const days = lesson.day_of_week?.map(d => DAYS_JA[d]).join('・') ?? ''
    const start = lesson.start_time ? lesson.start_time.substring(0, 5) : ''
    const end = lesson.end_time ? lesson.end_time.substring(0, 5) : ''
    if (!days && !start) return '未設定'
    return `毎週${days} ${start}${end ? `〜${end}` : ''}`
}

export default function AdminOnlineLessonPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [lessons, setLessons] = useState<OnlineLesson[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | 'new' | null>(null)
    const [form, setForm] = useState<Omit<OnlineLesson, 'id'>>(emptyLesson())
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [members, setMembers] = useState<{ id: string; full_name: string; email: string }[]>([])
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [sendingAnnouncement, setSendingAnnouncement] = useState(false)

    useEffect(() => {
        if (status === 'loading') return
        if (status === 'unauthenticated') { router.push('/login'); return }
        fetchLessons()
        fetchMembers()
    }, [status])

    const fetchLessons = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/online-lesson')
            if (res.ok) {
                const data = await res.json()
                setLessons(data.lessons || [])
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const fetchMembers = async () => {
        try {
            const res = await fetch('/api/admin/members')
            if (res.ok) {
                const resData = await res.json()
                const membersList = resData.data?.members || []
                const activeMembers = membersList.filter((m: any) => 
                    m.status === 'active' && 
                    m.email && 
                    m.email.trim() !== ''
                )
                setMembers(activeMembers)
            }
        } catch (e) {
            console.error('Failed to fetch members:', e)
        }
    }

    const startEdit = (lesson?: OnlineLesson) => {
        setDropdownOpen(false)
        if (lesson) {
            setForm({
                title: lesson.title,
                meet_url: lesson.meet_url,
                description: lesson.description,
                day_of_week: lesson.day_of_week || [],
                start_time: lesson.start_time ? lesson.start_time.substring(0, 5) : '',
                end_time: lesson.end_time ? lesson.end_time.substring(0, 5) : '',
                difficulty: lesson.difficulty || '初心者',
                url_expires_at: lesson.url_expires_at ? lesson.url_expires_at.substring(0, 10) : '',
                userIds: lesson.userIds || [],
            })
            setEditingId(lesson.id)
        } else {
            setForm(emptyLesson())
            setEditingId('new')
        }
        setError(null)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setError(null)
    }

    const toggleDay = (day: number) => {
        setForm(prev => {
            const days = prev.day_of_week || []
            return {
                ...prev,
                day_of_week: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort()
            }
        })
    }

    const handleSave = async () => {
        if (!form.meet_url) { setError('Google MeetリンクURLは必須です'); return }
        if (!form.title) { setError('タイトルは必須です'); return }
        setSaving(true)
        setError(null)
        try {
            const body = {
                title: form.title,
                meetUrl: form.meet_url,
                description: form.description,
                dayOfWeek: form.day_of_week,
                startTime: form.start_time || null,
                endTime: form.end_time || null,
                difficulty: form.difficulty,
                urlExpiresAt: form.url_expires_at || null,
                userIds: form.userIds || [],
            }

            let res: Response
            if (editingId === 'new') {
                res = await fetch('/api/admin/online-lesson', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
            } else {
                res = await fetch(`/api/admin/online-lesson?id=${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
            }

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '保存できませんでした。もう一度お試しください。')
            setSuccess('保存しました！')
            setEditingId(null)
            await fetchLessons()
            setTimeout(() => setSuccess(null), 3000)
        } catch (e) {
            setError(e instanceof Error ? e.message : '保存できませんでした。もう一度お試しください。')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('本当に削除しますか？')) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/admin/online-lesson?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('削除できませんでした。もう一度お試しください。')
            await fetchLessons()
            if (editingId === id) {
                setEditingId(null)
            }
        } catch (e) {
            alert(e instanceof Error ? e.message : '削除できませんでした。もう一度お試しください。')
        } finally {
            setDeletingId(null)
        }
    }

    const handleSendAnnouncement = async () => {
        if (!editingId || editingId === 'new') return
        if (!window.confirm('現在画面で選択されている送信対象会員にオンラインレッスンの告知メールを一斉送信しますか？')) return
        setSendingAnnouncement(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/online-lesson/announcement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    lessonId: editingId,
                    userIds: form.userIds
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '告知メールを送信できませんでした。もう一度お試しください。')
            alert(`告知メールを送信しました。（送信数: ${data.sentCount}/${data.totalCount}）`)
        } catch (e) {
            setError(e instanceof Error ? e.message : '告知メールを送信できませんでした。もう一度お試しください。')
        } finally {
            setSendingAnnouncement(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-surface-base">
            <div className="max-w-2xl mx-auto px-4 pt-4 pb-12">

                {/* Global success */}
                {success && (
                    <div className="mb-4 p-3 bg-state-success-500/15 border border-state-success-500/30 rounded-2xl text-sm text-state-success-300">
                        ✓ {success}
                    </div>
                )}

                {/* Edit / New Form */}
                {editingId !== null && (
                    <div className="bg-surface-raised rounded-2xl shadow-sm border border-brand-500/25 p-6 mb-6">
                        <h2 className="text-lg font-normal text-text-primary mb-5">
                            {editingId === 'new' ? '新しいレッスンを追加' : 'レッスンを編集'}
                        </h2>

                        <div className="space-y-5">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-normal text-text-secondary mb-1.5">タイトル <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="例: 朝ヨガ、夜のHIIT、ストレッチ..."
                                    className="w-full px-4 py-3 border border-border-strong rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            {/* Meet URL */}
                            <div>
                                <label className="block text-sm font-normal text-text-secondary mb-1.5">Google Meet URL <span className="text-red-500">*</span></label>
                                <input
                                    type="url"
                                    value={form.meet_url}
                                    onChange={e => setForm(p => ({ ...p, meet_url: e.target.value }))}
                                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                    className="w-full px-4 py-3 border border-border-strong rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            {/* Day of Week */}
                            <div>
                                <label className="block text-sm font-normal text-text-secondary mb-2">開催曜日</label>
                                <div className="flex space-x-2">
                                    {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                        const selected = (form.day_of_week || []).includes(d)
                                        const colors = [
                                            'bg-red-500/15 text-red-300 border-red-500/30',
                                            'bg-brand-500/15 text-brand-300 border-brand-500/30',
                                            'bg-brand-500/15 text-brand-300 border-brand-500/30',
                                            'bg-brand-500/15 text-brand-300 border-brand-500/30',
                                            'bg-brand-500/15 text-brand-300 border-brand-500/30',
                                            'bg-brand-500/15 text-brand-300 border-brand-500/30',
                                            'bg-orange-500/15 text-orange-300 border-orange-500/30',
                                        ]
                                        return (
                                            <Button
                                                key={d}
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => toggleDay(d)}
                                                className={`w-10 h-10 p-0 rounded-2xl border-2 text-sm transition-all ${selected ? colors[d] + ' border-current' : 'bg-surface-overlay text-text-muted border-border-strong'}`}
                                            >
                                                {DAYS_JA[d]}
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Start / End Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-normal text-text-secondary mb-1.5">開始時刻</label>
                                    <input
                                        type="time"
                                        value={form.start_time || ''}
                                        onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                                        className="w-full px-4 py-3 border border-border-strong rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-normal text-text-secondary mb-1.5">終了時刻</label>
                                    <input
                                        type="time"
                                        value={form.end_time || ''}
                                        onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                                        className="w-full px-4 py-3 border border-border-strong rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-normal text-text-secondary mb-1.5">説明・備考</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="参加方法、準備するもの、レッスン内容など..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-border-strong rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                                />
                            </div>

                            {/* Difficulty */}
                            <div>
                                <label className="block text-sm font-normal text-text-secondary mb-2">難易度</label>
                                <div className="flex space-x-4">
                                    {['初心者', '中級', '上級'].map(diff => (
                                        <label key={diff} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="difficulty"
                                                value={diff}
                                                checked={form.difficulty === diff}
                                                onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))}
                                                className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-border-strong"
                                            />
                                            <span className="text-sm text-text-secondary">{diff}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* URL Expiration */}
                            <div>
                                <label className="block text-sm font-normal text-text-secondary mb-1.5">URL有効期限</label>
                                <input
                                    type="date"
                                    value={form.url_expires_at || ''}
                                    onChange={e => setForm(p => ({ ...p, url_expires_at: e.target.value }))}
                                    className="w-full px-4 py-3 border border-border-strong rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                                <p className="text-xs text-text-secondary mt-1">※設定した期限の1週間前からアラートが表示されます</p>
                            </div>

                            {/* Target Members for Reminders */}
                            <div className="relative">
                                <label className="block text-sm font-normal text-text-secondary mb-2">送信対象会員（オンラインレッスン通知先）</label>
                                {members.length === 0 ? (
                                    <p className="text-sm text-text-muted">登録されている有効な会員がいません</p>
                                ) : (
                                    <>
                                        {/* Trigger Area / Selected List */}
                                        <div 
                                            onClick={() => setDropdownOpen(!dropdownOpen)}
                                            className="min-h-[46px] w-full px-3 py-2 border border-border-strong rounded-2xl text-sm focus-within:ring-2 focus-within:ring-brand-500 bg-surface-raised flex flex-wrap gap-1.5 items-center justify-between cursor-pointer"
                                        >
                                            <div className="flex flex-wrap gap-1.5 items-center flex-1">
                                                {(form.userIds || []).length === 0 ? (
                                                    <span className="text-text-muted">会員を選択してください（複数選択可）</span>
                                                ) : (
                                                    members.filter(m => (form.userIds || []).includes(m.id)).map(member => (
                                                        <span 
                                                            key={member.id} 
                                                            className="inline-flex items-center gap-1 bg-brand-500/15 border border-brand-500/25 text-brand-300 px-2 py-0.5 rounded-lg text-xs font-normal"
                                                        >
                                                            {member.full_name}
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setForm(prev => ({
                                                                        ...prev,
                                                                        userIds: (prev.userIds || []).filter(id => id !== member.id)
                                                                    }))
                                                                }}
                                                                className="hover:bg-brand-500/25 p-0.5 rounded-lg transition-colors text-brand-500 hover:text-brand-300"
                                                            >
                                                                <Icon name="close" size={12} />
                                                            </Button>
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                            <div className="text-text-muted ml-2 flex-shrink-0">
                                                <Icon name="chevronDown" size={16} className={`transform transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {/* Dropdown Options List */}
                                        {dropdownOpen && (
                                            <>
                                                {/* Backdrop to close dropdown */}
                                                <div 
                                                    className="fixed inset-0 z-40" 
                                                    onClick={() => setDropdownOpen(false)}
                                                />
                                                <div className="absolute left-0 right-0 mt-1 bg-surface-raised border border-border-strong rounded-2xl shadow-xl max-h-56 overflow-y-auto p-2 space-y-0.5 z-50">
                                                    {members.map(member => {
                                                        const isChecked = (form.userIds || []).includes(member.id)
                                                        return (
                                                            <label 
                                                                key={member.id} 
                                                                className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-surface-base rounded-lg transition-colors select-none"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {
                                                                        setForm(prev => {
                                                                            const current = prev.userIds || []
                                                                            const next = current.includes(member.id)
                                                                                ? current.filter(id => id !== member.id)
                                                                                : [...current, member.id]
                                                                            return { ...prev, userIds: next }
                                                                        })
                                                                    }}
                                                                    className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-border-strong rounded-lg cursor-pointer"
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm text-text-secondary font-normal">{member.full_name}</span>
                                                                    <span className="text-xs text-text-muted">{member.email}</span>
                                                                </div>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                                <p className="text-xs text-text-secondary mt-1">※チェックを入れた会員に対し、レッスン開始30分前にリマインダーが自動送信されます</p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-2xl text-sm text-red-300">{error}</div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {editingId !== 'new' && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="md"
                                        onClick={() => handleDelete(editingId!)}
                                        disabled={deletingId === editingId}
                                        className="py-3 px-4 sm:flex-none border border-red-500/30 text-red-400 rounded-2xl hover:bg-red-500/25 transition-colors font-normal text-sm flex items-center justify-center space-x-2"
                                    >
                                        {deletingId === editingId ? (
                                            <div className="animate-spin h-5 w-5 border-b-2 border-red-600 rounded-full" />
                                        ) : (
                                            <Icon name="trash" size={20} />
                                        )}
                                        <span>削除</span>
                                    </Button>
                                )}
                                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="md"
                                        onClick={cancelEdit}
                                        className="flex-1 py-3 border border-border-strong text-text-secondary rounded-2xl hover:bg-surface-base transition-colors font-normal text-sm"
                                    >
                                        キャンセル
                                    </Button>
                                    {editingId !== 'new' && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="md"
                                            onClick={handleSendAnnouncement}
                                            disabled={saving || sendingAnnouncement}
                                            className="flex-1 py-3 border border-brand-500/30 text-brand-400 rounded-2xl hover:bg-brand-500/25 transition-colors font-normal text-sm disabled:opacity-50"
                                        >
                                            {sendingAnnouncement ? '送信中...' : '告知メールを送る'}
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="md"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-1 py-3 bg-brand-700 text-white rounded-2xl hover:bg-brand-800 transition-colors font-normal text-sm disabled:opacity-50"
                                    >
                                        {saving ? '保存中...' : '保存する'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Lesson List */}
                {lessons.length === 0 && editingId === null ? (
                    <div className="text-center py-16 text-text-muted">
                        <Icon name="video" size={64} className="mx-auto mb-4 text-text-muted" />
                        <p className="text-sm font-normal">レッスンがありません</p>
                        <p className="text-xs mt-1">「追加」ボタンからレッスンを登録してください</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lessons.map(lesson => (
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                key={lesson.id}
                                onClick={() => startEdit(lesson)}
                                className="w-full text-left bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-5 hover:border-brand-500/40 hover:shadow-md transition-all group focus:outline-none focus:ring-2 focus:ring-brand-500 block"
                            >
                                <div className="flex flex-col space-y-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <h3 className="font-normal text-text-primary text-lg group-hover:text-brand-600 transition-colors">{lesson.title}</h3>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-normal bg-brand-500/15 text-brand-300">
                                                {lesson.difficulty || '初心者'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-brand-600 mb-1">
                                            📅 {formatSchedule(lesson)}
                                        </p>
                                        <p className="text-xs text-text-muted truncate">{lesson.meet_url}</p>
                                        {lesson.description && (
                                            <p className="text-xs text-text-secondary mt-1 line-clamp-2">{lesson.description}</p>
                                        )}
                                        {lesson.url_expires_at && new Date(lesson.url_expires_at).getTime() - new Date().getTime() <= 7 * 24 * 60 * 60 * 1000 && (
                                            <div className="mt-3 p-2 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center">
                                                <Icon name="warning" size={16} className="mr-1.5 flex-shrink-0" />
                                                URLの有効期限が近づいています（{lesson.url_expires_at.substring(0, 10)}）
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Button>
                        ))}

                        {/* Plus Add Button */}
                        {editingId === null && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                onClick={() => startEdit()}
                                className="w-full h-[72px] bg-surface-raised border-2 border-dashed border-border-strong rounded-2xl flex items-center justify-center text-text-muted hover:text-brand-600 hover:border-brand-500/40 hover:bg-brand-500/25 transition-all group"
                            >
                                <Icon name="plus" size={32} className="group-hover:scale-110 transition-transform duration-200" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
