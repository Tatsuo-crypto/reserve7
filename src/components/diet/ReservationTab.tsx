'use client'

import { useState, useEffect } from 'react'

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

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    const futureByMonth = groupByMonth(futureReservations)
    const pastByMonth = groupByMonth(pastReservations)

    const sortedFutureMonths = Object.entries(futureByMonth)
        .sort((a, b) => new Date(a[1][0].start_time).getTime() - new Date(b[1][0].start_time).getTime())

    const sortedPastMonths = Object.entries(pastByMonth)
        .sort((a, b) => new Date(b[1][0].start_time).getTime() - new Date(a[1][0].start_time).getTime())

    return (
        <div className="space-y-6 pb-24">
            {/* 1. Future Reservations */}
            <section>
                {futureReservations.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
                        <p className="text-gray-400 text-sm font-normal">今後の予約はありません</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedFutureMonths.map(([monthKey, reservations]) => (
                            <div key={monthKey} className="space-y-3">
                                <div className="flex items-center space-x-2 py-2">
                                    <div className="h-px flex-1 bg-blue-50"></div>
                                    <div className="text-[10px] font-normal text-blue-500 bg-blue-50 px-4 py-1 rounded-full uppercase tracking-tighter">
                                        {monthKey}
                                    </div>
                                    <div className="h-px flex-1 bg-blue-50"></div>
                                </div>
                                <div className="space-y-3">
                                    {reservations
                                        .sort((a: Reservation, b: Reservation) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                        .map((res: Reservation) => (
                                            <div key={res.id} className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm border-l-4 border-l-blue-600 hover:scale-[1.01] transition-transform">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-normal text-gray-800">{formatTitle(res.title)}</h3>
                                                    <span className="text-[10px] font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">確定</span>
                                                </div>
                                                <div className="flex items-center text-blue-600 text-sm font-normal">
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {formatDate(res.start_time)}
                                                </div>
                                                {res.notes && (
                                                    <p className="text-[11px] font-normal text-gray-400 mt-3 bg-gray-50 p-3 rounded-2xl italic leading-relaxed">
                                                        「{res.notes}」
                                                    </p>
                                                )}
                                            </div>
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
                            className="flex items-center justify-between w-full px-6 py-4 bg-gray-50 rounded-2xl border border-transparent hover:border-gray-200 transition-all group"
                        >
                            <div className="flex items-center gap-2">
                                <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${showPast ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                                <span className="text-sm font-normal text-gray-500">過去の予約を表示 ({pastReservations.length}回)</span>
                            </div>
                        </button>

                        {showPast && (
                            <div className="space-y-6 animate-fadeIn px-2">
                                {sortedPastMonths.map(([monthKey, reservations]) => (
                                    <div key={monthKey} className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <div className="text-[10px] font-normal text-gray-400 px-3 py-1 rounded-full bg-gray-100">
                                                {monthKey}
                                            </div>
                                            <div className="h-px flex-1 bg-gray-100"></div>
                                        </div>
                                        <div className="space-y-2">
                                            {reservations
                                                .sort((a: Reservation, b: Reservation) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                                                .map((res: Reservation) => (
                                                    <div key={res.id} className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-gray-50 opacity-60">
                                                        <span className="text-xs font-normal text-gray-600">{formatTitle(res.title)}</span>
                                                        <span className="text-[10px] font-normal text-gray-400">{formatDate(res.start_time).split(' ')[0]}</span>
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
