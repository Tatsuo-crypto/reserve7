'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts'
import StatCard from '@/components/ui/StatCard'
import BreakdownList from '@/components/ui/BreakdownList'

type CapacityData = {
    monthlySessions: number
    durationBreakdown: { durationMinutes: number; count: number }[]
    mostCommonDuration: number
    popularSlots: { weekday: number; weekdayLabel: string; hour: number; count: number }[]
    activeTrainerCount: number
    trainerWeeklyHours: {
        trainerId: string
        fullName: string
        weeklyHours: number
        monthlySessions: number
        maxMonthlySessions: number
        utilizationRate: number | null
    }[]
    totalWeeklyHours: number
    maxMonthlySessions: number
    utilizationRate: number | null
    monthlyTrend: { month: string; sessions: number; utilizationRate: number | null }[]
    trainerMonthlyTrend: Record<string, string | number>[]
    trainerNames: string[]
    trainerMonthlyBreakdown: {
        month: string
        trainers: { trainerId: string; fullName: string; sessions: number; maxMonthlySessions: number; utilizationRate: number | null }[]
    }[]
}

export default function CapacityPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [period, setPeriod] = useState<string>('all')
    const [capacity, setCapacity] = useState<CapacityData | null>(null)
    const [capacityLoading, setCapacityLoading] = useState(true)
    const [capacityMonth, setCapacityMonth] = useState<string>('')

    useEffect(() => {
        if (status === 'loading') return
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }
        if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
            router.push('/dashboard')
            return
        }
    }, [status, session, router])

    // 稼働率(店舗をまたいだ全体値。トレーナーのシフトが店舗別に厳密紐付いていないため店舗フィルタ非対応)
    useEffect(() => {
        let ignore = false
        setCapacityLoading(true)
        fetch(`/api/admin/capacity?period=${period}`)
            .then((res) => {
                if (!res.ok) throw new Error('failed')
                return res.json()
            })
            .then((json) => {
                if (!ignore) setCapacity(json)
            })
            .catch((e) => {
                if (!ignore) console.error('Failed to fetch capacity', e)
            })
            .finally(() => {
                if (!ignore) setCapacityLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [period])

    // トレーナー別稼働率の月選択: データ取得時、選択中の月が範囲外なら最新月を初期選択
    useEffect(() => {
        if (!capacity || capacity.trainerMonthlyBreakdown.length === 0) return
        const months = capacity.trainerMonthlyBreakdown.map((m) => m.month)
        if (!capacityMonth || !months.includes(capacityMonth)) {
            setCapacityMonth(months[months.length - 1])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [capacity])

    if (status === 'loading') return null

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
            <div className="mb-6 flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-text-primary">稼働率</h1>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="text-sm border-border-strong rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500 py-1 pl-2 pr-8"
                >
                    <option value="all">全期間 (2023/11~)</option>
                    <option value="2023">2023年</option>
                    <option value="2024">2024年</option>
                    <option value="2025">2025年</option>
                    <option value="2026">2026年</option>
                    <option value="1y">直近1年</option>
                    <option value="3m">直近3ヶ月</option>
                </select>
            </div>
            <p className="mb-4 text-xs font-normal text-text-secondary">全店舗合算(トレーナーのシフトが店舗別に厳密紐付いていないため店舗フィルタ非対応)</p>

            {capacityLoading ? (
                <p className="text-sm font-normal text-text-secondary">読み込み中...</p>
            ) : capacity ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard label="今月のセッション数" value={capacity.monthlySessions} unit="件" />
                        <StatCard label="稼働率" value={capacity.utilizationRate ?? '-'} unit={capacity.utilizationRate != null ? '%' : ''} />
                        <StatCard label="月間最大セッション数" value={capacity.maxMonthlySessions} unit="件" />
                        <StatCard label="在籍トレーナー数" value={capacity.activeTrainerCount} unit="名" />
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-text-primary mb-2">月別セッション数の推移</h4>
                        <p className="text-xs font-normal text-text-secondary mb-2">
                            上部の期間セレクタに連動します。稼働率(参考値)は現在のスタッフ体制を基準に計算しており、過去の実際のシフト体制とは異なる場合があります。
                        </p>
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={capacity.monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={{ stroke: '#3f3f46' }} tickLine={{ stroke: '#3f3f46' }} />
                                    <YAxis tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={{ stroke: '#3f3f46' }} tickLine={{ stroke: '#3f3f46' }} />
                                    <Tooltip formatter={(value: any, name: any) => [name === 'sessions' ? `${value}件` : `${value}%`, name === 'sessions' ? 'セッション数' : '稼働率(参考)']} />
                                    <Legend formatter={(value) => (value === 'sessions' ? 'セッション数' : '稼働率(参考)')} />
                                    <Bar dataKey="sessions" name="sessions" fill="#f97316" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-text-primary">トレーナー別 実際の稼働率</h4>
                            {capacity.trainerMonthlyBreakdown.length > 0 && (
                                <select
                                    value={capacityMonth}
                                    onChange={(e) => setCapacityMonth(e.target.value)}
                                    className="text-xs border-border-strong rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500 py-1 pl-2 pr-6"
                                >
                                    {capacity.trainerMonthlyBreakdown.map((m) => (
                                        <option key={m.month} value={m.month}>{m.month}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <BreakdownList
                            title={capacityMonth || '-'}
                            items={(capacity.trainerMonthlyBreakdown.find((m) => m.month === capacityMonth)?.trainers || []).map((t) => ({
                                label: `${t.fullName}（${t.sessions}件）`,
                                count: t.utilizationRate ?? 0,
                                unit: '%',
                            }))}
                            note="シフト未登録・退職済みなど上限セッション数が算出できないトレーナーは稼働率0%と表示されます。稼働率は各トレーナー自身の週間シフト時間(現在の設定を基準)を用いた参考値です。"
                        />
                    </div>
                </div>
            ) : (
                <p className="text-sm font-normal text-text-secondary">データを取得できませんでした</p>
            )}
        </div>
    )
}
