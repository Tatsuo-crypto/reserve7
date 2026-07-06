'use client'

import { useState, useEffect } from 'react'

export interface OnlineLesson {
    id: string
    title: string
    meet_url: string
    description: string
    day_of_week: number[] | null
    start_time: string | null
    end_time: string | null
    difficulty: string
}

export const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export function getJoinStatus(lesson: OnlineLesson) {
    const now = new Date()
    const jstNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 60 * 60 * 1000))
    const todayDow = jstNow.getDay()
    const currentMinutes = jstNow.getHours() * 60 + jstNow.getMinutes()

    if (!lesson.day_of_week || !lesson.start_time) return { canJoin: true, isToday: true, label: '開催中' }

    const startParts = lesson.start_time.split(':')
    const endParts = (lesson.end_time || '23:59').split(':')
    const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
    const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

    if (!lesson.day_of_week.includes(todayDow)) return { canJoin: false, isToday: false, label: '次回開催をお楽しみに' }

    // Allow joining from 5 minutes before
    if (currentMinutes >= startMin - 5 && currentMinutes < startMin) {
        return { canJoin: true, isToday: true, label: 'まもなく開始（入室可）' }
    }

    if (currentMinutes >= startMin && currentMinutes <= endMin) {
        return { canJoin: true, isToday: true, label: '開催中' }
    }

    if (currentMinutes < startMin - 5) return { canJoin: false, isToday: true, label: 'まもなく開始' }
    return { canJoin: false, isToday: true, label: '終了' }
}

/** Fetches the member's online lesson slots. Shared by the Home "today" card and the Reservation tab's full list. */
export function useOnlineLessons(token: string) {
    const [lessons, setLessons] = useState<OnlineLesson[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
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
        if (token) fetchLessons()
    }, [token])

    return { lessons, loading }
}
