'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OnlineLesson {
    meet_url: string
    schedule_text: string
    description: string
    is_active: boolean
}

export default function OnlineLessonPage() {
    const params = useParams()
    const token = params?.token as string
    const router = useRouter()

    const [lesson, setLesson] = useState<OnlineLesson | null>(null)
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState(false)

    useEffect(() => {
        if (!token) return
        fetchLesson()
    }, [token])

    const fetchLesson = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/client/online-lesson?token=${token}`)
            if (res.ok) {
                const data = await res.json()
                setLesson(data.lesson)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleJoin = () => {
        if (!lesson?.meet_url) return
        setJoining(true)
        window.open(lesson.meet_url, '_blank', 'noopener,noreferrer')
        setTimeout(() => setJoining(false), 2000)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
                    <p className="mt-4 text-blue-700 text-sm">読み込み中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Header */}
            <div className="bg-white bg-opacity-80 backdrop-blur-sm border-b border-white border-opacity-50 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center">
                    <button
                        onClick={() => router.push(`/client/${token}`)}
                        className="mr-3 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-bold text-gray-900">オンラインレッスン</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-8">
                {!lesson ? (
                    /* No lesson configured */
                    <div className="text-center py-16">
                        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-700 mb-2">現在準備中です</h2>
                        <p className="text-gray-500 text-sm">オンラインレッスンの詳細は<br />もうしばらくお待ちください</p>
                    </div>
                ) : (
                    <>
                        {/* Hero Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-3xl p-8 mb-6 shadow-2xl">
                            {/* Decorative circles */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white bg-opacity-10 rounded-full" />
                            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white bg-opacity-5 rounded-full" />

                            <div className="relative">
                                <div className="flex items-center space-x-3 mb-6">
                                    <div className="w-14 h-14 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-white font-bold text-xl">グループレッスン</h2>
                                        <p className="text-blue-100 text-sm">Google Meet でみんなと一緒に！</p>
                                    </div>
                                </div>

                                {/* Schedule */}
                                {lesson.schedule_text && (
                                    <div className="bg-white bg-opacity-15 rounded-2xl p-4 mb-4 backdrop-blur-sm">
                                        <div className="flex items-start space-x-3">
                                            <div className="mt-0.5">
                                                <svg className="w-5 h-5 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-blue-100 text-xs font-medium mb-1">開催スケジュール</p>
                                                <p className="text-white font-semibold">{lesson.schedule_text}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Join Button */}
                                <button
                                    onClick={handleJoin}
                                    disabled={joining}
                                    className="w-full py-4 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
                                >
                                    <span className="flex items-center justify-center space-x-2">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14v-4z M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                        </svg>
                                        <span>{joining ? '起動中...' : 'Google Meet で参加する'}</span>
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        {lesson.description && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                                <h3 className="font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>ご参加について</span>
                                </h3>
                                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{lesson.description}</p>
                            </div>
                        )}

                        {/* How to Join */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="font-semibold text-gray-800 mb-4">参加方法</h3>
                            <div className="space-y-4">
                                {[
                                    { step: '1', text: 'スケジュールの時間になったら「Google Meet で参加する」をタップ' },
                                    { step: '2', text: 'Google Meetが開きます。カメラとマイクの設定を確認して参加してください' },
                                    { step: '3', text: 'みんなと一緒に楽しくレッスンを受けましょう！' },
                                ].map(item => (
                                    <div key={item.step} className="flex items-start space-x-4">
                                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-600 font-bold text-sm">{item.step}</span>
                                        </div>
                                        <p className="text-gray-600 text-sm leading-relaxed pt-0.5">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
