'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface OnlineLesson {
    id?: string
    meet_url: string
    schedule_text: string
    description: string
    is_active: boolean
}

export default function AdminOnlineLessonPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [lesson, setLesson] = useState<OnlineLesson>({
        meet_url: '',
        schedule_text: '',
        description: '',
        is_active: true,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'loading') return
        if (status === 'unauthenticated') { router.push('/login'); return }
        fetchLesson()
    }, [status])

    const fetchLesson = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/online-lesson')
            if (res.ok) {
                const data = await res.json()
                if (data.lesson) {
                    setLesson({
                        meet_url: data.lesson.meet_url || '',
                        schedule_text: data.lesson.schedule_text || '',
                        description: data.lesson.description || '',
                        is_active: data.lesson.is_active !== false,
                    })
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(null)
        try {
            const res = await fetch('/api/admin/online-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetUrl: lesson.meet_url,
                    scheduleText: lesson.schedule_text,
                    description: lesson.description,
                    isActive: lesson.is_active,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '保存に失敗しました')
            setSuccess('保存しました！')
            setTimeout(() => setSuccess(null), 3000)
        } catch (e) {
            setError(e instanceof Error ? e.message : '保存に失敗しました')
        } finally {
            setSaving(false)
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
                <div className="flex items-center mb-8">
                    <Link href="/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">オンラインレッスン設定</h1>
                        <p className="text-sm text-gray-500 mt-1">Google MeetのURLとスケジュールを設定します</p>
                    </div>
                </div>

                {/* Preview Card */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 mb-8 text-white shadow-lg">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-bold text-lg">オンラインレッスン</p>
                            <p className="text-blue-100 text-sm">会員に表示されるプレビュー</p>
                        </div>
                    </div>
                    <p className="text-blue-100 text-sm mb-1">📅 {lesson.schedule_text || 'スケジュール未設定'}</p>
                    {lesson.description && (
                        <p className="text-blue-100 text-sm mt-2">{lesson.description}</p>
                    )}
                    <div className="mt-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${lesson.is_active ? 'bg-green-400 bg-opacity-30 text-green-100' : 'bg-red-400 bg-opacity-30 text-red-100'}`}>
                            {lesson.is_active ? '● 公開中' : '● 非公開'}
                        </span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                    {/* Meet URL */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Google Meet URL <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                            <input
                                type="url"
                                value={lesson.meet_url}
                                onChange={e => setLesson(prev => ({ ...prev, meet_url: e.target.value }))}
                                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Google Meetの招待リンクをここに入力してください</p>
                    </div>

                    {/* Schedule */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            開催スケジュール
                        </label>
                        <input
                            type="text"
                            value={lesson.schedule_text}
                            onChange={e => setLesson(prev => ({ ...prev, schedule_text: e.target.value }))}
                            placeholder="例: 毎週月・水・金 20:00〜21:00"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-400 mt-1">会員に表示されるスケジュールを自由に入力してください</p>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            説明・備考
                        </label>
                        <textarea
                            value={lesson.description}
                            onChange={e => setLesson(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="例: 参加方法、準備するものなど..."
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">公開する</p>
                            <p className="text-xs text-gray-400">OFFにすると会員ページに表示されません</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setLesson(prev => ({ ...prev, is_active: !prev.is_active }))}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${lesson.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${lesson.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Error / Success */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                            ✓ {success}
                        </div>
                    )}

                    {/* Save Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? '保存中...' : '保存する'}
                    </button>
                </form>
            </div>
        </div>
    )
}
