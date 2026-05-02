'use client'

import { useState, useEffect } from 'react'

interface OnlineLesson {
    id: string
    title: string
    meet_url: string
    description: string
    day_of_week: number[] | null
    start_time: string | null
    end_time: string | null
    difficulty: string
}

interface OnlineTabProps {
    token: string
}

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export default function OnlineTab({ token }: OnlineTabProps) {
    const [lessons, setLessons] = useState<OnlineLesson[]>([])
    const [loading, setLoading] = useState(true)
    const [isIOS, setIsIOS] = useState(false)

    useEffect(() => {
        setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent))
        const fetchLessons = async () => {
            try {
                const res = await fetch(`/api/client/online-lesson?token=${token}`)
                if (res.ok) {
                    const data = await res.json()
                    setLessons(data.lessons || [])
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchLessons()
    }, [token])

    const getJoinStatus = (lesson: OnlineLesson) => {
        const now = new Date()
        const jstNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 60 * 60 * 1000))
        const todayDow = jstNow.getDay()
        const currentMinutes = jstNow.getHours() * 60 + jstNow.getMinutes()

        if (!lesson.day_of_week || !lesson.start_time) return { canJoin: true, label: '開催中' }

        const startParts = lesson.start_time.split(':')
        const endParts = (lesson.end_time || '23:59').split(':')
        const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
        const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

        if (!lesson.day_of_week.includes(todayDow)) return { canJoin: false, label: '次回開催をお楽しみに' }

        // Allow joining from 5 minutes before
        if (currentMinutes >= startMin - 5 && currentMinutes < startMin) {
            return { canJoin: true, label: 'まもなく開始（入室可）' }
        }

        if (currentMinutes >= startMin && currentMinutes <= endMin) {
            return { canJoin: true, label: '開催中' }
        }

        if (currentMinutes < startMin - 5) return { canJoin: false, label: 'まもなく開始' }
        return { canJoin: false, label: '終了' }
    }

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    return (
        <div className="space-y-6 pb-24">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                <div className="relative z-10">
                    <h2 className="text-xl font-normal mb-2 italic">LIVE LESSON</h2>
                    <p className="text-blue-100 text-sm opacity-90">ご自宅からプロの指導を受けられます</p>
                </div>
                <div className="absolute right-0 bottom-0 -mr-4 -mb-4 opacity-20 transform rotate-12">
                    <svg className="w-32 h-32 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </div>
            </div>

            <div className="space-y-4">
                {lessons.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">現在レッスンはありません</div>
                ) : (
                    lessons.map(lesson => {
                        const status = getJoinStatus(lesson)
                        return (
                            <div key={lesson.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
                                <div className={`h-1.5 w-full ${status.canJoin ? 'bg-green-500 animate-pulse' : 'bg-gray-200'}`}></div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-full">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h3 className="font-normal text-gray-900">{lesson.title}</h3>
                                                <span className="text-[10px] font-normal px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{lesson.difficulty}</span>
                                            </div>
                                            <div className="text-sm font-normal text-blue-600 flex items-center mb-1">
                                                <span className="mr-1.5">📅</span>
                                                毎週{lesson.day_of_week?.map(d => DAYS_JA[d]).join('・')} {lesson.start_time?.substring(0, 5)}〜{lesson.end_time?.substring(0, 5)}
                                            </div>
                                            <p className="text-xs text-gray-400 font-normal truncate mb-2">{lesson.meet_url}</p>
                                            {lesson.description && (
                                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4 bg-gray-50 p-2 rounded-lg">
                                                    {lesson.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => window.open(lesson.meet_url, '_blank')}
                                        disabled={!status.canJoin}
                                        className={`w-full py-3 rounded-xl font-normal transition-all flex items-center justify-center space-x-2 ${status.canJoin
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 active:scale-95'
                                            : 'bg-gray-100 text-gray-400'
                                            }`}
                                    >
                                        <span>{status.canJoin ? (status.label === '開催中' ? '参加する' : status.label) : status.label}</span>
                                    </button>
                                    <p className="mt-3 text-[10px] text-gray-400 font-normal text-center">
                                        ※開始5分前から入室いただけます
                                    </p>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* iOS Help */}
            {isIOS && (
                <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex items-start space-x-3">
                    <div className="text-xl">💡</div>
                    <div className="text-xs text-orange-800 leading-relaxed font-normal">
                        iPhoneをご利用の場合は、事前に<span className="font-normal underline">Google Meetアプリ</span>のインストールが必要です。
                    </div>
                </div>
            )}
        </div>
    )
}
