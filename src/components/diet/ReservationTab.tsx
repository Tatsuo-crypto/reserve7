'use client'

import { useState, useEffect } from 'react'
import { useOnlineLessons, getJoinStatus, DAYS_JA } from '@/hooks/useOnlineLessons'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Icon from '@/components/ui/icons'

interface Reservation {
    id: string
    title: string
    start_time: string
    end_time: string
    notes: string | null
    created_at: string
}

interface ReservationTabProps {
    token: string
}

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

const formatTitle = (title: string) => {
    const matchWithSlash = title.match(/(\d+)\/(\d+)$/)
    const matchWithoutSlash = title.match(/(\d+)$/)
    if (matchWithSlash) return `パーソナル${matchWithSlash[1]}回目`
    if (matchWithoutSlash) return `パーソナル${matchWithoutSlash[1]}回目`
    return title
}

const getMonthKey = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

const groupByMonth = (reservations: Reservation[]) => {
    const grouped: { [key: string]: Reservation[] } = {}
    reservations.forEach(reservation => {
        const monthKey = getMonthKey(reservation.start_time)
        if (!grouped[monthKey]) {
            grouped[monthKey] = []
        }
        grouped[monthKey].push(reservation)
    })
    return grouped
}

export default function ReservationTab({ token }: ReservationTabProps) {
    const [futureReservations, setFutureReservations] = useState<Reservation[]>([])
    const [pastReservations, setPastReservations] = useState<Reservation[]>([])
    const [loading, setLoading] = useState(true)
    const [showPast, setShowPast] = useState(false)
    const { lessons } = useOnlineLessons(token)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/client/reservations?token=${token}`)
                if (res.ok) {
                    const result = await res.json()
                    setFutureReservations(result.data.futureReservations || [])
                    setPastReservations(result.data.pastReservations || [])
                }
            } catch (err) {
                console.error('Failed to fetch reservations:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [token])

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>

    const futureByMonth = groupByMonth(futureReservations)
    const pastByMonth = groupByMonth(pastReservations)

    const sortedFutureMonths = Object.entries(futureByMonth)
        .sort((a, b) => new Date(a[1][0].start_time).getTime() - new Date(b[1][0].start_time).getTime())

    const sortedPastMonths = Object.entries(pastByMonth)
        .sort((a, b) => new Date(b[1][0].start_time).getTime() - new Date(a[1][0].start_time).getTime())

    return (
        <div className="space-y-6 pb-24">
            {/* 0. Online Lesson Schedule (moved from the former オンライン tab) */}
            {lessons.length > 0 && (
                <section className="space-y-3">
                    <h3 className="text-sm font-normal text-text-secondary px-1">オンラインレッスンの開催枠</h3>
                    <div className="space-y-3">
                        {lessons.map(lesson => {
                            const status = getJoinStatus(lesson)
                            return (
                                <Card key={lesson.id} padding="sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-normal text-text-primary text-sm">{lesson.title}</h4>
                                        <span className="text-[10px] font-normal px-2 py-0.5 bg-brand-500/15 text-brand-300 rounded-full">{lesson.difficulty}</span>
                                    </div>
                                    <p className="text-xs font-normal text-brand-600 mb-2">
                                        毎週{lesson.day_of_week?.map(d => DAYS_JA[d]).join('・')} {lesson.start_time?.substring(0, 5)}〜{lesson.end_time?.substring(0, 5)}
                                    </p>
                                    {status.isToday && (
                                        <button
                                            onClick={() => window.open(lesson.meet_url, '_blank')}
                                            disabled={!status.canJoin}
                                            className={`w-full py-2.5 rounded-xl text-sm font-normal transition-all ${status.canJoin ? 'bg-brand-700 text-white active:scale-95' : 'bg-surface-overlay text-text-muted'}`}
                                        >
                                            {status.canJoin ? '参加する' : status.label}
                                        </button>
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* 1. Future Reservations */}
            <section>
                {futureReservations.length === 0 ? (
                    <Card padding="lg" className="text-center">
                        <p className="text-text-muted text-sm font-normal">今後の予約はありません</p>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {sortedFutureMonths.map(([monthKey, reservations]) => (
                            <div key={monthKey} className="space-y-3">
                                <div className="flex items-center space-x-2 py-2">
                                    <div className="h-px flex-1 bg-brand-50"></div>
                                    <div className="text-[10px] font-normal text-brand-500 bg-brand-50 px-4 py-1 rounded-full uppercase tracking-tighter">
                                        {monthKey}
                                    </div>
                                    <div className="h-px flex-1 bg-brand-50"></div>
                                </div>
                                <div className="space-y-3">
                                    {reservations
                                        .sort((a: Reservation, b: Reservation) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                        .map((res: Reservation) => (
                                            <Card key={res.id} padding="sm" className="border-l-4 border-l-brand-600 hover:scale-[1.01] transition-transform">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-normal text-text-primary">{formatTitle(res.title)}</h3>
                                                    <Badge tone="success">確定</Badge>
                                                </div>
                                                <div className="flex items-center text-brand-600 text-sm font-normal">
                                                    <Icon name="calendar" size={16} className="mr-2" />
                                                    {formatDate(res.start_time)}
                                                </div>
                                                {res.notes && (
                                                    <p className="text-[11px] font-normal text-text-muted mt-3 bg-surface-base p-3 rounded-2xl italic leading-relaxed">
                                                        「{res.notes}」
                                                    </p>
                                                )}
                                            </Card>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* 2. Past Reservations (All Collapsible) */}
            <section className="pt-4">
                {pastReservations.length > 0 && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setShowPast(!showPast)}
                            className="flex items-center justify-between w-full px-6 py-4 bg-surface-base rounded-2xl border border-transparent hover:border-border-strong transition-all group"
                        >
                            <div className="flex items-center gap-2">
                                <Icon name="chevronDown" size={20} className={`text-text-muted transition-transform duration-300 ${showPast ? 'rotate-180' : ''}`} />
                                <span className="text-sm font-normal text-text-secondary">過去の予約を表示 ({pastReservations.length}回)</span>
                            </div>
                        </button>

                        {showPast && (
                            <div className="space-y-6 animate-fadeIn px-2">
                                {sortedPastMonths.map(([monthKey, reservations]) => (
                                    <div key={monthKey} className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <div className="text-[10px] font-normal text-text-muted px-3 py-1 rounded-full bg-surface-overlay">
                                                {monthKey}
                                            </div>
                                            <div className="h-px flex-1 bg-surface-overlay"></div>
                                        </div>
                                        <div className="space-y-2">
                                            {reservations
                                                .sort((a: Reservation, b: Reservation) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                                                .map((res: Reservation) => (
                                                    <div key={res.id} className="flex items-center justify-between p-4 bg-surface-raised/50 rounded-2xl border border-border-subtle opacity-60">
                                                        <span className="text-xs font-normal text-text-secondary">{formatTitle(res.title)}</span>
                                                        <span className="text-[10px] font-normal text-text-muted">{formatDate(res.start_time).split(' ')[0]}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}
