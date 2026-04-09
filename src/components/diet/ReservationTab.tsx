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
    const [showOlderMonths, setShowOlderMonths] = useState(false)

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

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentMonthKey = `${currentYear}年${currentMonth}月`

    const sortedFutureMonths = Object.entries(futureByMonth)
        .sort((a, b) => new Date(a[1][0].start_time).getTime() - new Date(b[1][0].start_time).getTime())

    const sortedPastMonths = Object.entries(pastByMonth)
        .sort((a, b) => new Date(b[1][0].start_time).getTime() - new Date(a[1][0].start_time).getTime())

    const currentMonthPastData = sortedPastMonths.filter(([monthKey]) => monthKey === currentMonthKey)
    const olderMonthsPastData = sortedPastMonths.filter(([monthKey]) => monthKey !== currentMonthKey)

    return (
        <div className="space-y-6 pb-24">
            {/* Future Reservations */}
            <section>
                <div className="flex items-center space-x-2 mb-4">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                    <h2 className="text-lg font-bold text-gray-900">今後の予約</h2>
                </div>

                {futureReservations.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                        <p className="text-gray-400 text-sm">今後の予約はありません</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedFutureMonths.map(([monthKey, reservations]) => (
                            <div key={monthKey} className="space-y-3">
                                <div className="flex items-center space-x-2 py-2">
                                    <div className="h-px flex-1 bg-blue-100"></div>
                                    <div className="text-sm font-black text-blue-600 bg-blue-50 px-5 py-2 rounded-full border border-blue-200 shadow-sm">
                                        {monthKey}
                                    </div>
                                    <div className="h-px flex-1 bg-blue-100"></div>
                                </div>
                                <div className="space-y-3">
                                    {reservations
                                        .sort((a: Reservation, b: Reservation) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                        .map((res: Reservation) => (
                                            <div key={res.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm border-l-4 border-l-blue-600">
                                                <h3 className="font-bold text-gray-900 mb-1">{formatTitle(res.title)}</h3>
                                                <div className="flex items-center text-blue-600 text-sm font-medium mb-1">
                                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {formatDate(res.start_time)}
                                                </div>
                                                {res.notes && (
                                                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg">{res.notes}</p>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Past Reservations */}
            <section>
                <div className="flex items-center space-x-2 mb-4">
                    <div className="w-1.5 h-4 bg-gray-400 rounded-full"></div>
                    <h2 className="text-lg font-bold text-gray-900">過去の履歴</h2>
                </div>

                {pastReservations.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                        <p className="text-gray-400 text-sm">過去の履歴はありません</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Current Month Past Reservations */}
                        {currentMonthPastData.map(([monthKey, reservations]) => (
                            <div key={monthKey} className="space-y-3">
                                <div className="flex items-center space-x-2 py-2">
                                    <div className="h-px flex-1 bg-gray-200"></div>
                                    <div className="text-sm font-black text-gray-500 bg-gray-100 px-5 py-2 rounded-full border border-gray-200 shadow-sm">
                                        {monthKey}
                                    </div>
                                    <div className="h-px flex-1 bg-gray-200"></div>
                                </div>
                                <div className="space-y-3">
                                    {reservations
                                        .sort((a: Reservation, b: Reservation) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                                        .map((res: Reservation) => (
                                            <div key={res.id} className="bg-gray-50 bg-opacity-50 rounded-2xl p-4 border border-gray-100">
                                                <h3 className="font-bold text-gray-500 mb-1">{formatTitle(res.title)}</h3>
                                                <div className="text-gray-400 text-sm font-medium">
                                                    {formatDate(res.start_time)}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}

                        {/* Older Months (Collapsible) */}
                        {olderMonthsPastData.length > 0 && (
                            <div>
                                <button
                                    onClick={() => setShowOlderMonths(!showOlderMonths)}
                                    className="flex items-center justify-between w-full p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    <span>それ以前の予約を表示 ({olderMonthsPastData.length}ヶ月分)</span>
                                    <svg className={`w-5 h-5 transition-transform ${showOlderMonths ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {showOlderMonths && (
                                    <div className="mt-6 space-y-6">
                                        {olderMonthsPastData.map(([monthKey, reservations]) => (
                                            <div key={monthKey} className="space-y-3">
                                                <div className="flex items-center space-x-2 py-2">
                                                    <div className="h-px flex-1 bg-gray-100"></div>
                                                    <div className="text-sm font-black text-gray-400 bg-gray-50 px-4 py-1.5 rounded-full border border-gray-100">
                                                        {monthKey}
                                                    </div>
                                                    <div className="h-px flex-1 bg-gray-100"></div>
                                                </div>
                                                <div className="space-y-3">
                                                    {reservations
                                                        .sort((a: Reservation, b: Reservation) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                                                        .map((res: Reservation) => (
                                                            <div key={res.id} className="bg-gray-50 bg-opacity-30 rounded-2xl p-4 border border-gray-50">
                                                                <h3 className="font-bold text-gray-400 mb-1">{formatTitle(res.title)}</h3>
                                                                <div className="text-gray-400 text-xs">
                                                                    {formatDate(res.start_time)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}
