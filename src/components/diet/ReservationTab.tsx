'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'
import { fetchJsonCached } from '@/lib/client-fetch-cache'

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
    userName?: string
}

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${month}月${day}日(${weekday}) ${hours}:${minutes}`
}

const formatTitle = (title: string, userName?: string) => {
    if (userName?.includes('内山')) return 'カウンセリング'
    if (title.includes('カウンセリング')) return 'カウンセリング'
    const matchWithSlash = title.match(/(\d+)\/(\d+)$/)
    const matchWithoutSlash = title.match(/(\d+)$/)
    if (matchWithSlash) return `パーソナル${matchWithSlash[1]}回目`
    if (matchWithoutSlash) return `パーソナル${matchWithoutSlash[1]}回目`
    return title
}

export default function ReservationTab({ token, userName }: ReservationTabProps) {
    const [futureReservations, setFutureReservations] = useState<Reservation[]>([])
    const [pastReservations, setPastReservations] = useState<Reservation[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await fetchJsonCached<any>(`/api/client/reservations?token=${token}`, undefined, 30_000)
                setFutureReservations(result.data.futureReservations || [])
                setPastReservations(result.data.pastReservations || [])
            } catch (err) {
                console.error('Failed to fetch reservations:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [token])

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>

    const nextReservation = [...futureReservations].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
    const otherFutureReservations = [...futureReservations]
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(1)
    const sortedPastReservations = [...pastReservations].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

    return (
        <div className="space-y-6 pb-24 animate-fadeIn">
            <section className="space-y-2">
                <SectionTitle>次回</SectionTitle>
                {nextReservation ? (
                    <Card padding="sm" className="!p-4 border-brand-500/70">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-base font-semibold text-text-primary">{formatTitle(nextReservation.title, userName)}</p>
                                <p className="mt-1 text-sm font-normal tabular-nums text-text-secondary">{formatDate(nextReservation.start_time)}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-normal text-brand-300">
                                予約済み
                            </span>
                        </div>
                        {nextReservation.notes && (
                            <p className="mt-3 rounded-xl bg-surface-base px-3 py-2 text-xs text-text-secondary">
                                {nextReservation.notes}
                            </p>
                        )}
                    </Card>
                ) : (
                    <Card padding="sm" className="!p-4">
                        <p className="text-sm text-text-muted">次回の予約はありません</p>
                    </Card>
                )}

                {otherFutureReservations.length > 0 && (
                    <div className="space-y-2 pt-1">
                        {otherFutureReservations.map(res => (
                            <ReservationRow key={res.id} reservation={res} userName={userName} />
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-2">
                <SectionTitle>過去</SectionTitle>
                {sortedPastReservations.length > 0 ? (
                    <div className="space-y-2">
                        {sortedPastReservations.map(res => (
                            <ReservationRow key={res.id} reservation={res} userName={userName} muted />
                        ))}
                    </div>
                ) : (
                    <Card padding="sm" className="!p-4">
                        <p className="text-sm text-text-muted">過去の予約はありません</p>
                    </Card>
                )}
            </section>
        </div>
    )
}

function ReservationRow({ reservation, userName, muted = false }: { reservation: Reservation; userName?: string; muted?: boolean }) {
    return (
        <Card padding="sm" className={`!p-4 ${muted ? 'opacity-65' : ''}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{formatTitle(reservation.title, userName)}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-text-muted">{formatDate(reservation.start_time)}</p>
                </div>
                <Icon name="calendar" size={18} className="shrink-0 text-text-muted" />
            </div>
        </Card>
    )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="flex items-center gap-2 text-left text-base font-semibold text-text-primary">
            <span className="h-5 w-1 rounded-full bg-brand-500" />
            <span>{children}</span>
        </h2>
    )
}
