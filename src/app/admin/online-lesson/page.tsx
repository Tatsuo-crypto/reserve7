'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const DAYS_EN = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜']

interface OnlineLesson {
    id: string
    title: string
    meet_url: string
    description: string
    is_active: boolean
    day_of_week: number[] | null
    start_time: string | null
    end_time: string | null
}

const emptyLesson = (): Omit<OnlineLesson, 'id'> => ({
    title: '',
    meet_url: '',
    description: '',
    is_active: true,
    day_of_week: [],
    start_time: '',
    end_time: '',
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

    useEffect(() => {
        if (status === 'loading') return
        if (status === 'unauthenticated') { router.push('/login'); return }
        fetchLessons()
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

    const startEdit = (lesson?: OnlineLesson) => {
        if (lesson) {
            setForm({
                title: lesson.title,
                meet_url: lesson.meet_url,
                description: lesson.description,
                is_active: lesson.is_active,
                day_of_week: lesson.day_of_week || [],
                start_time: lesson.start_time ? lesson.start_time.substring(0, 5) : '',
                end_time: lesson.end_time ? lesson.end_time.substring(0, 5) : '',
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
                isActive: form.is_active,
                dayOfWeek: form.day_of_week,
                startTime: form.start_time || null,
                endTime: form.end_time || null,
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
            if (!res.ok) throw new Error(data.error || '保存に失敗しました')
            setSuccess('保存しました！')
            setEditingId(null)
            await fetchLessons()
            setTimeout(() => setSuccess(null), 3000)
        } catch (e) {
            setError(e instanceof Error ? e.message : '保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        try {
            const res = await fetch(`/api/admin/online-lesson?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('削除に失敗しました')
            await fetchLessons()
        } catch (e) {
            alert(e instanceof Error ? e.message : '削除に失敗しました')
        } finally {
            setDeletingId(null)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <Link href="/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">オンラインレッスン設定</h1>
                            <p className="text-sm text-gray-500 mt-0.5">複数のレッスンを登録できます</p>
                        </div>
                    </div>
                    {editingId === null && (
                        <button
                            onClick={() => startEdit()}
                            className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>追加</span>
                        </button>
                    )}
                </div>

                {/* Global success */}
                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                        ✓ {success}
                    </div>
                )}

                {/* Edit / New Form */}
                {editingId !== null && (
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 mb-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-5">
                            {editingId === 'new' ? '新しいレッスンを追加' : 'レッスンを編集'}
                        </h2>

                        <div className="space-y-5">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">タイトル <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="例: 朝ヨガ、夜のHIIT、ストレッチ..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Meet URL */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Google Meet URL <span className="text-red-500">*</span></label>
                                <input
                                    type="url"
                                    value={form.meet_url}
                                    onChange={e => setForm(p => ({ ...p, meet_url: e.target.value }))}
                                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Day of Week */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">開催曜日</label>
                                <div className="flex space-x-2">
                                    {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                        const selected = (form.day_of_week || []).includes(d)
                                        const colors = [
                                            'bg-red-100 text-red-700 border-red-300',
                                            'bg-blue-100 text-blue-700 border-blue-300',
                                            'bg-blue-100 text-blue-700 border-blue-300',
                                            'bg-blue-100 text-blue-700 border-blue-300',
                                            'bg-blue-100 text-blue-700 border-blue-300',
                                            'bg-blue-100 text-blue-700 border-blue-300',
                                            'bg-orange-100 text-orange-700 border-orange-300',
                                        ]
                                        return (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => toggleDay(d)}
                                                className={`w-10 h-10 rounded-xl border-2 text-sm font-bold transition-all ${selected ? colors[d] + ' border-current' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                                            >
                                                {DAYS_JA[d]}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Start / End Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">開始時刻</label>
                                    <input
                                        type="time"
                                        value={form.start_time || ''}
                                        onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">終了時刻</label>
                                    <input
                                        type="time"
                                        value={form.end_time || ''}
                                        onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">説明・備考</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="参加方法、準備するもの、レッスン内容など..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">公開する</p>
                                    <p className="text-xs text-gray-400">OFFにすると会員に表示されません</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
                            )}

                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
                                >
                                    {saving ? '保存中...' : '保存する'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Lesson List */}
                {lessons.length === 0 && editingId === null ? (
                    <div className="text-center py-16 text-gray-400">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium">レッスンがありません</p>
                        <p className="text-xs mt-1">「追加」ボタンからレッスンを登録してください</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lessons.map(lesson => (
                            <div key={lesson.id} className={`bg-white rounded-2xl shadow-sm border p-5 ${lesson.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <h3 className="font-bold text-gray-900 text-lg">{lesson.title}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lesson.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {lesson.is_active ? '公開中' : '非公開'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-blue-600 mb-1">
                                            📅 {formatSchedule(lesson)}
                                        </p>
                                        <p className="text-xs text-gray-400 truncate">{lesson.meet_url}</p>
                                        {lesson.description && (
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{lesson.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2 ml-3 flex-shrink-0">
                                        <button
                                            onClick={() => startEdit(lesson)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="編集"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(lesson.id)}
                                            disabled={deletingId === lesson.id}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="削除"
                                        >
                                            {deletingId === lesson.id ? (
                                                <div className="animate-spin h-5 w-5 border-b-2 border-red-500 rounded-full" />
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
