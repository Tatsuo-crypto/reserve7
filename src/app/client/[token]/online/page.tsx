'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const DAYS_FULL = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']

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

function getJstNow() {
    const now = new Date()
    // Add 9 hours offset to get JST
    return new Date(now.getTime() + 9 * 60 * 60 * 1000)
}

function timeToMinutes(t: string): number {
    const parts = t.split(':')
    return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function formatSchedule(lesson: OnlineLesson): string {
    const days = lesson.day_of_week?.map(d => DAYS_JA[d]).join('・') ?? ''
    const start = lesson.start_time ? lesson.start_time.substring(0, 5) : ''
    const end = lesson.end_time ? lesson.end_time.substring(0, 5) : ''
    if (!days && !start) return ''
    return `毎週${days} ${start}${end ? `〜${end}` : ''}`
}

function getJoinStatus(lesson: OnlineLesson): {
    canJoin: boolean
    statusLabel: string
    isOngoing: boolean
} {
    const jstNow = getJstNow()
    const todayDow = jstNow.getUTCDay()
    const currentMinutes = jstNow.getUTCHours() * 60 + jstNow.getUTCMinutes()

    const days = lesson.day_of_week
    const startTime = lesson.start_time
    const endTime = lesson.end_time

    // If no schedule set, always allow
    if (!days || days.length === 0 || !startTime) {
        return { canJoin: true, statusLabel: '開催中', isOngoing: true }
    }

    const startMin = timeToMinutes(startTime)
    const endMin = endTime ? timeToMinutes(endTime) : startMin + 60

    if (!days.includes(todayDow)) {
        return { canJoin: false, statusLabel: '時間外', isOngoing: false }
    }

    // Today is correct day
    const isOngoing = currentMinutes >= startMin && currentMinutes <= endMin

    if (isOngoing) {
        return { canJoin: true, statusLabel: '開催中', isOngoing: true }
    }

    return {
        canJoin: false,
        statusLabel: '時間外',
        isOngoing: false,
    }
}

function LessonCard({ lesson, onJoin }: { lesson: OnlineLesson; onJoin: (url: string) => void }) {
    const [status, setStatus] = useState(() => getJoinStatus(lesson))

    useEffect(() => {
        const interval = setInterval(() => {
            setStatus(getJoinStatus(lesson))
        }, 10000) // update every 10 seconds
        return () => clearInterval(interval)
    }, [lesson])

    const schedule = formatSchedule(lesson)

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Card header */}
            <div className={`p-5 ${status.isOngoing ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gradient-to-r from-gray-100 to-gray-50'}`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className={`font-bold text-lg ${status.isOngoing ? 'text-white' : 'text-gray-800'}`}>
                            {lesson.title}
                        </h3>
                        {schedule && (
                            <p className={`text-sm mt-1 ${status.isOngoing ? 'text-blue-100' : 'text-gray-500'}`}>
                                📅 {schedule}
                            </p>
                        )}
                    </div>
                    {status.isOngoing && (
                        <span className="ml-3 flex-shrink-0 px-2 py-1 bg-white bg-opacity-20 text-white text-xs font-bold rounded-full animate-pulse">
                            LIVE
                        </span>
                    )}
                </div>
            </div>

            {/* Card body */}
            <div className="p-5">
                {lesson.description && (
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">{lesson.description}</p>
                )}

                {/* Status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.canJoin ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                        <span className={`text-sm font-medium ${status.canJoin ? 'text-green-700' : 'text-gray-500'}`}>
                            {status.statusLabel}
                        </span>
                    </div>

                    {/* Join Button */}
                    <button
                        onClick={() => onJoin(lesson.meet_url)}
                        disabled={!status.canJoin}
                        className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${status.canJoin
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>参加する</span>
                    </button>
                </div>

            </div>
        </div>
    )
}

export default function OnlineLessonPage() {
    const params = useParams()
    const token = params?.token as string
    const router = useRouter()

    const [lessons, setLessons] = useState<OnlineLesson[]>([])
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState<string | null>(null)

    useEffect(() => {
        if (!token) return
        fetchLessons()
    }, [token])

    const fetchLessons = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/client/online-lesson?token=${token}`)
            if (res.ok) {
                const data = await res.json()
                setLessons(data.lessons || [])
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const handleJoin = (url: string) => {
        setJoining(url)
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => setJoining(null), 2000)
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
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">オンラインレッスン</h1>
                        <p className="text-xs text-gray-400">開始時間から参加できます</p>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6">
                {lessons.length === 0 ? (
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
                    <div className="space-y-4">
                        {lessons.map(lesson => (
                            <LessonCard key={lesson.id} lesson={lesson} onJoin={handleJoin} />
                        ))}

                        {/* How to join */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mt-2">
                            <h3 className="font-semibold text-gray-800 mb-3">参加方法</h3>
                            <div className="space-y-3">
                                {[
                                    { step: '1', text: '開始時間になると「参加する」ボタンが青くなります' },
                                    { step: '2', text: 'ボタンをタップするとGoogle Meetが開きます' },
                                    { step: '3', text: 'カメラとマイクを確認して「参加」を押してください' },
                                ].map(item => (
                                    <div key={item.step} className="flex items-start space-x-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-600 font-bold text-xs">{item.step}</span>
                                        </div>
                                        <p className="text-gray-600 text-sm leading-relaxed pt-0.5">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
