'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Icon from '@/components/ui/icons'

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
    difficulty: string
}

function getJstNow() {
    const now = new Date()
    // Get UTC time and add 9 hours for JST
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    return new Date(utc + (9 * 60 * 60 * 1000))
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
    const todayDow = jstNow.getDay() // Use getDay() on JST instance
    const currentMinutes = jstNow.getHours() * 60 + jstNow.getMinutes()

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
        return { canJoin: false, statusLabel: '準備中', isOngoing: false }
    }

    // Today is correct day
    // Allow join from 5 mins before start until end
    const canJoinNow = currentMinutes >= (startMin - 5) && currentMinutes <= endMin
    const isOngoing = currentMinutes >= startMin && currentMinutes <= endMin

    if (canJoinNow) {
        return {
            canJoin: true,
            statusLabel: isOngoing ? '開催中' : 'まもなく開始',
            isOngoing: true // treat as active UI-wise
        }
    }

    // Correct day but more than 5 mins before
    if (currentMinutes < startMin) {
        return { canJoin: false, statusLabel: 'まもなく開始', isOngoing: false }
    }

    return {
        canJoin: false,
        statusLabel: '終了',
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
        <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
            {/* Card header */}
            <div className={`p-5 ${status.isOngoing ? 'bg-gradient-to-r from-brand-500 to-brand-600' : 'bg-gradient-to-r from-gray-100 to-gray-50'}`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <h3 className={`font-normal text-lg ${status.isOngoing ? 'text-white' : 'text-text-primary'}`}>
                                {lesson.title}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-normal bg-brand-500/15 text-brand-300">
                                {lesson.difficulty || '初心者'}
                            </span>
                        </div>
                        {schedule && (
                            <p className={`text-sm mt-1 ${status.isOngoing ? 'text-brand-100' : 'text-text-secondary'}`}>
                                📅 {schedule}
                            </p>
                        )}
                    </div>
                    {status.isOngoing && (
                        <span className="ml-3 flex-shrink-0 px-2 py-1 bg-white bg-opacity-20 text-white text-xs font-normal rounded-full animate-pulse">
                            LIVE
                        </span>
                    )}
                </div>
            </div>

            {/* Card body */}
            <div className="p-5">
                {lesson.description && (
                    <p className="text-sm text-text-secondary mb-4 leading-relaxed">{lesson.description}</p>
                )}

                {/* Status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.canJoin ? 'bg-state-success-500 animate-pulse' : 'bg-surface-overlay'}`} />
                        <span className={`text-sm font-normal ${status.canJoin ? 'text-state-success-300' : 'text-text-secondary'}`}>
                            {status.statusLabel}
                        </span>
                    </div>

                    {/* Join Button */}
                    <button
                        onClick={() => onJoin(lesson.meet_url)}
                        disabled={!status.canJoin}
                        className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-normal text-sm transition-all ${status.canJoin
                            ? 'bg-brand-700 text-white hover:bg-brand-800 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95'
                            : 'bg-surface-overlay text-text-muted cursor-not-allowed'
                            }`}
                    >
                        <Icon name="video" size={16} />
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
    const [error, setError] = useState<string | null>(null)
    const [joining, setJoining] = useState<string | null>(null)
    const [isIOS, setIsIOS] = useState(false)
    const [showIOSBanner, setShowIOSBanner] = useState(true)

    useEffect(() => {
        const ua = navigator.userAgent
        const ios = /iPhone|iPad|iPod/.test(ua)
        setIsIOS(ios)
    }, [])

    useEffect(() => {
        if (!token) return
        fetchLessons()
    }, [token])

    const fetchLessons = async () => {
        setLoading(true)
        setError(null)
        try {
            const url = `/api/client/online-lesson?token=${token}`
            console.log('Fetching lessons from:', url)
            const res = await fetch(url)
            console.log('Response status:', res.status)
            if (res.ok) {
                const data = await res.json()
                console.log('Lessons data:', data)
                setLessons(data.lessons || [])
            } else {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'レッスンの取得に失敗しました')
            }
        } catch (e) {
            console.error('Fetch error:', e)
            setError('通信エラーが発生しました')
        }
        finally { setLoading(false) }
    }

    const handleJoin = (url: string) => {
        setJoining(url)
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => setJoining(null), 2000)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto" />
                    <p className="mt-4 text-brand-700 text-sm">読み込み中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-surface-base">
            {/* Header */}
            <div className="bg-surface-raised bg-opacity-80 backdrop-blur-sm border-b border-border-subtle sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center">
                    <button
                        onClick={() => router.push(`/client/${token}`)}
                        className="mr-3 text-text-muted hover:text-text-secondary transition-colors"
                    >
                        <Icon name="back" size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-normal text-text-primary">オンラインレッスン</h1>
                        <p className="text-xs text-brand-600 font-normal">開始5分前から参加できます</p>
                    </div>
                </div>
            </div>

            {/* iOS App Banner */}
            {isIOS && showIOSBanner && (
                <div className="bg-brand-700 text-white">
                    <div className="max-w-lg mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-surface-raised rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Icon name="video" size={24} className="text-brand-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-normal">アプリのダウンロードが必要です</p>
                                    <p className="text-xs text-brand-100">iPhoneではGoogle Meetアプリから参加します</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <a
                                    href="https://apps.apple.com/jp/app/google-meet/id1270665395"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-surface-raised text-brand-600 text-xs font-normal px-3 py-1.5 rounded-lg whitespace-nowrap"
                                >
                                    App Store
                                </a>
                                <button
                                    onClick={() => setShowIOSBanner(false)}
                                    className="text-brand-200 hover:text-white ml-1"
                                    aria-label="閉じる"
                                >
                                    <Icon name="close" size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-lg mx-auto px-4 py-6">
                {error ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="exclamationCircle" size={32} className="text-red-400" />
                        </div>
                        <p className="text-text-secondary font-normal">{error}</p>
                        <button
                            onClick={fetchLessons}
                            className="mt-4 px-4 py-2 bg-brand-700 text-white rounded-lg text-sm"
                        >
                            再試行
                        </button>
                    </div>
                ) : lessons.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-24 h-24 bg-brand-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Icon name="video" size={48} className="text-brand-400" />
                        </div>
                        <h2 className="text-xl font-normal text-text-secondary mb-2">現在準備中です</h2>
                        <p className="text-text-secondary text-sm">オンラインレッスンの詳細は<br />もうしばらくお待ちください</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lessons.map(lesson => (
                            <LessonCard key={lesson.id} lesson={lesson} onJoin={handleJoin} />
                        ))}

                        {/* How to join */}
                        <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-5 mt-2">
                            <h3 className="font-normal text-text-primary mb-3">参加方法</h3>
                            <div className="space-y-3">
                                {(isIOS ? [
                                    { step: '1', text: 'App StoreからGoogle Meetアプリをダウンロードしておいてください' },
                                    { step: '2', text: '開始時間になると「参加する」ボタンの色が変わります' },
                                    { step: '3', text: 'ボタンをタップするとGoogle Meetアプリが開きます' },
                                    { step: '4', text: 'カメラとマイクを確認して「参加」を押してください' },
                                ] : [
                                    { step: '1', text: '開始時間になると「参加する」ボタンの色が変わります' },
                                    { step: '2', text: 'ボタンをタップするとGoogle Meetが開きます' },
                                    { step: '3', text: 'カメラとマイクを確認して「参加」を押してください' },
                                ]).map(item => (
                                    <div key={item.step} className="flex items-start space-x-3">
                                        <div className="w-6 h-6 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                                            <span className="text-brand-300 font-normal text-xs">{item.step}</span>
                                        </div>
                                        <p className="text-text-secondary text-sm leading-relaxed pt-0.5">{item.text}</p>
                                    </div>
                                ))}
                                {isIOS && (
                                    <a
                                        href="https://apps.apple.com/jp/app/google-meet/id1270665395"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 flex items-center justify-center w-full py-3 bg-brand-700 text-white rounded-xl font-normal text-sm space-x-2 hover:bg-brand-800 transition-colors"
                                    >
                                        <Icon name="download" size={20} />
                                        <span>App StoreでGoogle Meetをダウンロード</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
