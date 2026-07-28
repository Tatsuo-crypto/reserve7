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
    /** AP-1/AP-3: 休講・振替の例外(今日以降のみ)。movedToDateが無ければ休講、あれば振替 */
    exceptions?: LessonException[]
}

export interface LessonException {
    /** 元の開催日(この日は開催されない) */
    date: string
    /** 振替先の日付。nullなら休講 */
    movedToDate: string | null
    movedToStartTime: string | null
    movedToEndTime: string | null
}

export const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export function getJoinStatus(lesson: OnlineLesson) {
    const now = new Date()
    const jstNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 60 * 60 * 1000))
    const todayDow = jstNow.getDay()
    const currentMinutes = jstNow.getHours() * 60 + jstNow.getMinutes()
    const todayStr = jstNow.toISOString().substring(0, 10)

    // AP-3: 今日が振替先なら、曜日が合っていなくても本日開催として扱う(時刻は振替先の指定を優先)
    const movedInToday = lesson.exceptions?.find(ex => ex.movedToDate === todayStr)
    // AP-1: 今日が休講・振替の「元の日」なら、曜日が合っていても開催なしとして扱う
    const canceledToday = !movedInToday && lesson.exceptions?.find(ex => ex.date === todayStr)

    if (canceledToday) {
        return canceledToday.movedToDate
            ? { canJoin: false, isToday: false, label: '本日は休講（別日に振替）' }
            : { canJoin: false, isToday: false, label: '本日は休講です' }
    }

    const effectiveStart = movedInToday ? (movedInToday.movedToStartTime || lesson.start_time) : lesson.start_time
    const effectiveEnd = movedInToday ? (movedInToday.movedToEndTime || lesson.end_time) : lesson.end_time

    if (!lesson.day_of_week || !effectiveStart) return { canJoin: true, isToday: true, label: '開催中' }

    const startParts = effectiveStart.split(':')
    const endParts = (effectiveEnd || '23:59').split(':')
    const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
    const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

    if (!movedInToday && !lesson.day_of_week.includes(todayDow)) return { canJoin: false, isToday: false, label: '次回開催をお楽しみに' }

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
