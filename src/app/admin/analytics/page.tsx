'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ComposedChart, Area, LineChart, Line
} from 'recharts'
import { useStoreChange } from '@/hooks/useStoreChange'
import MemberMovementModal from './MemberMovementModal'
import { AdminStoreOption, fetchAdminStoresOnce } from '@/lib/admin-stores-client'

type AnalyticsData = {
    memberHistory: any[],
    salesHistory: any[],
    projectedSales: number
}

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
}

const TRAINER_TREND_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#facc15', '#fb923c', '#60a5fa']

type DemographicsData = {
    totalMembers: number
    ageGroups: { label: string; count: number }[]
    genderBreakdown: { label: string; count: number }[]
    jobBreakdown: { label: string; count: number }[]
    mainPurposeBreakdown: { label: string; count: number }[]
    routeBreakdown: { label: string; count: number }[]
}

const ANALYTICS_CACHE_MS = 30 * 1000
const analyticsCache = new Map<string, { timestamp: number, data: AnalyticsData }>()
const analyticsPromises = new Map<string, Promise<AnalyticsData>>()

async function fetchAnalyticsOnce(storeId: string, period: string): Promise<AnalyticsData> {
    const params = new URLSearchParams()
    params.append('storeId', storeId || 'all')
    params.append('period', period)

    const cacheKey = params.toString()
    const cached = analyticsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < ANALYTICS_CACHE_MS) {
        return cached.data
    }

    const inflight = analyticsPromises.get(cacheKey)
    if (inflight) return inflight

    const promise = fetch(`/api/admin/analytics?${cacheKey}`)
        .then(async (res) => {
            if (!res.ok) throw new Error('Failed to fetch data')
            return res.json()
        })
        .then((json) => {
            analyticsCache.set(cacheKey, {
                timestamp: Date.now(),
                data: json,
            })
            return json
        })
        .finally(() => {
            analyticsPromises.delete(cacheKey)
        })

    analyticsPromises.set(cacheKey, promise)
    return promise
}

export default function AnalyticsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { currentStoreId } = useStoreChange()
    const [period, setPeriod] = useState<string>('all')
    const [filterStoreId, setFilterStoreId] = useState<string>(currentStoreId || 'all')
    const [stores, setStores] = useState<AdminStoreOption[]>([])
    const [selectedMonthData, setSelectedMonthData] = useState<any>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const movementScrollRef = useRef<HTMLDivElement>(null)


    // Check admin access
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

    const [data, setData] = useState<AnalyticsData>({
        memberHistory: [],
        salesHistory: [],
        projectedSales: 0
    })
    const [loading, setLoading] = useState(true)
    const [capacity, setCapacity] = useState<CapacityData | null>(null)
    const [capacityLoading, setCapacityLoading] = useState(true)
    const [demographics, setDemographics] = useState<DemographicsData | null>(null)
    const [demographicsLoading, setDemographicsLoading] = useState(true)

    // Fetch stores list
    useEffect(() => {
        let ignore = false
        const fetchStores = async () => {
            try {
                const list = await fetchAdminStoresOnce()
                if (!ignore) setStores(list)
            } catch (e) {
                if (!ignore) console.error('Failed to fetch stores', e)
            }
        }
        fetchStores()

        return () => {
            ignore = true
        }
    }, [])

    // Sync filterStoreId with currentStoreId when it changes (header selection)
    useEffect(() => {
        if (currentStoreId) {
            setFilterStoreId(currentStoreId)
        }
    }, [currentStoreId])

    useEffect(() => {
        let ignore = false
        const fetchData = async () => {
            setLoading(true)
            try {
                const json = await fetchAnalyticsOnce(filterStoreId || 'all', period)
                if (ignore) return // Check if effect was cleaned up

                setData(json)
            } catch (error) {
                if (!ignore) {
                    console.error(error)
                }
            } finally {
                if (!ignore) {
                    setLoading(false)
                }
            }
        }
        fetchData()

        return () => {
            ignore = true
        }
    }, [filterStoreId, period])

    // 稼働率(店舗をまたいだ全体値。トレーナーのシフトが店舗別に厳密紐付いていないため店舗フィルタ非対応)
    // 月別推移は既存の期間セレクタ(period)に連動させる
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

    // 会員統計(年齢層・男女比・職業・入会目的・入会経路)
    useEffect(() => {
        let ignore = false
        setDemographicsLoading(true)
        fetch(`/api/admin/demographics?storeId=${filterStoreId || 'all'}`)
            .then((res) => {
                if (!res.ok) throw new Error('failed')
                return res.json()
            })
            .then((json) => {
                if (!ignore) setDemographics(json)
            })
            .catch((e) => {
                if (!ignore) console.error('Failed to fetch demographics', e)
            })
            .finally(() => {
                if (!ignore) setDemographicsLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [filterStoreId])

    // Auto-scroll movement chart to the right (show latest month)
    useEffect(() => {
        if (movementScrollRef.current && data.memberHistory.length > 0) {
            setTimeout(() => {
                if (movementScrollRef.current) {
                    movementScrollRef.current.scrollLeft = movementScrollRef.current.scrollWidth
                }
            }, 100)
        }
    }, [data.memberHistory])

    if (loading && data.memberHistory.length === 0) {
        return <div className="p-8 text-center text-text-secondary">データを読み込み中...</div>
    }

    const { memberHistory, salesHistory, projectedSales } = data

    // Calculate summaries from latest data
    const currentMonth = memberHistory.length > 0 ? memberHistory[memberHistory.length - 1] : {}
    const prevMonth = memberHistory.length > 1 ? memberHistory[memberHistory.length - 2] : {}
    const activeCount = currentMonth.active || 0
    const prevActive = prevMonth.active || 0

    // Avoid division by zero
    const growth = prevActive > 0 ? ((activeCount - prevActive) / prevActive * 100).toFixed(1) : 0

    // Calculate max for Y-axis scaling of block chart
    const maxNew = Math.max(...memberHistory.map(m => (m.new || 0)), 1)
    const maxWithdrawn = Math.max(...memberHistory.map(m => (m.withdrawn || 0)), 1)
    const maxBlocks = Math.max(maxNew, maxWithdrawn)

    const handleMonthClick = (item: any) => {
        setSelectedMonthData({
            month: item.month,
            newMembers: item.newMembers || [],
            withdrawnMembers: item.withdrawnMembers || [],
        })
        setIsModalOpen(true)
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">

            {/* Filters */}
            <div className="mb-8 flex justify-center gap-2">
                <select
                    value={filterStoreId}
                    onChange={(e) => setFilterStoreId(e.target.value)}
                    className="text-sm border-border-strong rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500 py-1 pl-2 pr-8"
                >
                    <option value="all">全店舗</option>
                    {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                </select>
                
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-surface-raised p-6 rounded-2xl shadow-sm border border-border-subtle">
                    <h3 className="text-sm font-normal text-text-secondary">現在の月額会員数</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-3xl font-bold text-text-primary tabular-nums">{activeCount}</span>
                        <span className="ml-1 text-sm text-text-secondary">名</span>
                        <span className={`ml-2 text-sm font-normal ${Number(growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Number(growth) >= 0 ? '+' : ''}{growth}%
                        </span>
                        <span className="ml-2 text-xs text-text-muted">前月比</span>
                    </div>
                </div>
                <div className="bg-surface-raised p-6 rounded-2xl shadow-sm border border-border-subtle">
                    <h3 className="text-sm font-normal text-text-secondary">今月の月会費見込み</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-3xl font-bold text-text-primary tabular-nums">¥{projectedSales.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" key={`${filterStoreId}-${period}`}>

                {/* Sales Chart */}
                <div className="bg-surface-raised p-6 rounded-2xl shadow-sm border border-border-subtle">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-text-primary">売上推移</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesHistory}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={{ stroke: '#3f3f46' }} tickLine={{ stroke: '#3f3f46' }} />
                                <YAxis
                                    tick={{ fontSize: 12, fill: '#a1a1aa' }}
                                    axisLine={{ stroke: '#3f3f46' }}
                                    tickLine={{ stroke: '#3f3f46' }}
                                    tickFormatter={(value) => `¥${value / 10000}万`}
                                />
                                <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
                                <Legend />
                                <Bar dataKey="amount" name="月会費見込み" fill="#f97316" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Member Growth Chart */}
                <div className="bg-surface-raised p-6 rounded-2xl shadow-sm border border-border-subtle">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-text-primary">会員数推移</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart 
                                data={memberHistory} 
                                className="outline-none focus:outline-none"
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={{ stroke: '#3f3f46' }} tickLine={{ stroke: '#3f3f46' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={{ stroke: '#3f3f46' }} tickLine={{ stroke: '#3f3f46' }} />
                                <Tooltip formatter={(value: any, name: any) => [`${value}名`, name]} />
                                <Area type="monotone" dataKey="active" name="在籍会員" fill="#818cf8" stroke="#4f46e5" fillOpacity={0.1} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Member Movement (Join/Withdraw) - Custom Block Chart */}
                <div className="bg-surface-raised p-6 rounded-2xl shadow-sm border border-border-subtle lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-text-primary">入会・退会推移</h3>
                        <div className="flex items-center gap-4 text-xs text-text-secondary">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-lg bg-state-success-500"></span>
                                新規入会
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-lg bg-state-danger-500"></span>
                                退会
                            </span>
                        </div>
                    </div>
                    <div className="overflow-x-auto" ref={movementScrollRef}>
                        <div className="flex items-end min-w-max" style={{ minHeight: `${(maxBlocks * 20) + 60 + (maxBlocks * 20)}px` }}>
                            {memberHistory.map((item, idx) => {
                                const newCount = item.new || 0
                                const withdrawnCount = item.withdrawn || 0
                                const [yearStr, monthNum] = (item.month || '').split('-')
                                const monthLabel = `${parseInt(monthNum || '0')}月`
                                const prevItem = idx > 0 ? memberHistory[idx - 1] : null
                                const prevYear = prevItem ? prevItem.month?.split('-')[0] : null
                                const showYear = !prevYear || prevYear !== yearStr
                                return (
                                    <div key={item.month} className="flex">
                                        {/* Vertical year divider */}
                                        {showYear && idx > 0 && (
                                            <div className="flex flex-col items-center mr-1">
                                                <div className="text-xs font-normal text-text-muted whitespace-nowrap mb-1">{yearStr}</div>
                                                <div className="w-px bg-surface-overlay flex-1" />
                                            </div>
                                        )}
                                        <div className="flex flex-col items-center">
                                        {/* Year label at top for first item */}
                                        {showYear && idx === 0 && (
                                            <div className="text-xs font-normal text-brand-300 bg-brand-500/15 px-2 py-0.5 rounded-full mb-1 whitespace-nowrap">
                                                {yearStr}
                                            </div>
                                        )}
                                        {(!showYear || idx === 0) && !showYear && <div className="h-[22px]" />}
                                        {showYear && idx > 0 && <div className="h-[22px]" />}
                                        <div
                                            className="flex flex-col items-center cursor-pointer hover:bg-surface-base rounded-lg transition-colors px-1"
                                            style={{ minWidth: `${Math.max(40, 600 / memberHistory.length)}px` }}
                                            onClick={() => handleMonthClick(item)}
                                        >
                                            {/* New members blocks (above center line) */}
                                            <div className="flex flex-col-reverse items-center gap-[2px]" style={{ minHeight: `${maxBlocks * 20}px`, justifyContent: 'flex-start' }}>
                                                {Array.from({ length: newCount }).map((_, i) => (
                                                    <div
                                                        key={`n-${i}`}
                                                        className="w-5 h-4 rounded-lg bg-state-success-500"
                                                    />
                                                ))}
                                            </div>
                                            {/* Center line + month label */}
                                            <div className="w-full border-t border-border-strong my-1" />
                                            <div className="text-xs text-text-secondary leading-none mb-1 font-normal">
                                                {monthLabel}
                                            </div>
                                            <div className="w-full border-t border-border-strong mb-1" />
                                            {/* Withdrawn blocks (below center line) */}
                                            <div className="flex flex-col items-center gap-[2px]" style={{ minHeight: `${maxBlocks * 20}px`, justifyContent: 'flex-start' }}>
                                                {Array.from({ length: withdrawnCount }).map((_, i) => (
                                                    <div
                                                        key={`w-${i}`}
                                                        className="w-5 h-4 rounded-lg bg-state-danger-500"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <p className="text-xs text-text-muted mt-2 text-center">※ 月をタップすると詳細を表示します</p>
                </div>
            </div>

            {/* 稼働率 */}
            <div className="mt-8 bg-surface-raised p-6 rounded-2xl shadow-sm border border-border-subtle">
                <h3 className="text-xl font-semibold text-text-primary mb-1">稼働率</h3>
                <p className="text-xs font-normal text-text-secondary mb-4">全店舗合算(トレーナーのシフトが店舗別に厳密紐付いていないため店舗フィルタ非対応)</p>
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
                            <h4 className="text-sm font-semibold text-text-primary mb-2">トレーナー別 セッション数の推移</h4>
                            <p className="text-xs font-normal text-text-secondary mb-2">
                                上部の期間セレクタに連動します。過去に在籍していたトレーナーも、期間内に実施履歴があれば表示されます。
                            </p>
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={capacity.trainerMonthlyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={{ stroke: '#3f3f46' }} tickLine={{ stroke: '#3f3f46' }} />
                                        <YAxis tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={{ stroke: '#3f3f46' }} tickLine={{ stroke: '#3f3f46' }} />
                                        <Tooltip formatter={(value: any) => [`${value}件`, 'セッション数']} />
                                        <Legend />
                                        {capacity.trainerNames.length === 0 ? null : capacity.trainerNames.map((name, i) => (
                                            <Line
                                                key={name}
                                                type="monotone"
                                                dataKey={name}
                                                name={name}
                                                stroke={TRAINER_TREND_COLORS[i % TRAINER_TREND_COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 2 }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            {capacity.trainerNames.length === 0 && (
                                <p className="text-sm font-normal text-text-secondary">データがありません</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <BreakdownList
                                title="所要時間の内訳"
                                items={capacity.durationBreakdown.map((d) => ({ label: `${d.durationMinutes}分`, count: d.count }))}
                            />
                            <BreakdownList
                                title="人気の時間帯(直近3ヶ月・上位10)"
                                items={capacity.popularSlots.map((s) => ({ label: `${s.weekdayLabel}曜 ${s.hour}:00〜`, count: s.count }))}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <BreakdownList
                                title="トレーナー別 週間シフト時間"
                                items={capacity.trainerWeeklyHours.map((t) => ({ label: t.fullName, count: t.weeklyHours, unit: '時間/週' }))}
                            />
                            <BreakdownList
                                title="トレーナー別 実際の稼働率"
                                items={capacity.trainerWeeklyHours.map((t) => ({
                                    label: `${t.fullName}（今月${t.monthlySessions}件）`,
                                    count: t.utilizationRate ?? 0,
                                    unit: '%',
                                }))}
                                note="シフト未登録のトレーナーは稼働率0%と表示されます(上限セッション数が算出できないため)。"
                            />
                        </div>
                        <p className="text-xs font-normal text-text-secondary">
                            ※月間最大セッション数は「週間シフト時間合計 × 4.345週 ÷ 所要時間」の理論値です。休憩・移動時間は考慮していません。トレーナー別の稼働率も同じ考え方で、各トレーナー自身の週間シフト時間を基準に算出しています。
                        </p>
                    </div>
                ) : (
                    <p className="text-sm font-normal text-text-secondary">データを取得できませんでした</p>
                )}
            </div>

            {/* 会員統計 */}
            <div className="mt-8 bg-surface-raised p-6 rounded-2xl shadow-sm border border-border-subtle">
                <h3 className="text-xl font-semibold text-text-primary mb-1">会員統計</h3>
                <p className="text-xs font-normal text-text-secondary mb-4">
                    {demographics ? `対象: 登録会員 ${demographics.totalMembers}名(在籍・休会・退会を含む)` : ''}
                </p>
                {demographicsLoading ? (
                    <p className="text-sm font-normal text-text-secondary">読み込み中...</p>
                ) : demographics ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <BreakdownList title="年齢層" items={demographics.ageGroups.map((a) => ({ label: a.label, count: a.count }))} />
                        <BreakdownList title="男女比" items={demographics.genderBreakdown.map((g) => ({ label: g.label, count: g.count }))} />
                        <BreakdownList title="職業傾向" items={demographics.jobBreakdown.map((j) => ({ label: j.label, count: j.count }))} note="自由入力(カウンセリング「職業」欄)の集計のため表記ゆれあり" />
                        <BreakdownList title="主な入会目的" items={demographics.mainPurposeBreakdown.map((p) => ({ label: p.label, count: p.count }))} />
                        <BreakdownList title="入会経路" items={demographics.routeBreakdown.map((r) => ({ label: r.label, count: r.count }))} />
                    </div>
                ) : (
                    <p className="text-sm font-normal text-text-secondary">データを取得できませんでした</p>
                )}
                <p className="mt-4 text-xs font-normal text-text-secondary">
                    ※職業・入会目的・入会経路は会員詳細の「カウンセリング」情報が入力されている会員のみ集計対象です(未入力分は「未入力」に集計)。
                </p>
            </div>

            <MemberMovementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={selectedMonthData}
            />
        </div>
    )
}

function StatCard({ label, value, unit }: { label: string; value: number | string; unit: string }) {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
            <div className="text-xs font-normal text-text-secondary">{label}</div>
            <div className="mt-1 flex items-baseline gap-1">
                <span className="stat-value">{value}</span>
                {unit && <span className="text-xs font-normal text-text-secondary">{unit}</span>}
            </div>
        </div>
    )
}

function BreakdownList({
    title,
    items,
    note,
}: {
    title: string
    items: { label: string; count: number; unit?: string }[]
    note?: string
}) {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
            <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
            <div className="mt-2 space-y-1.5">
                {items.length === 0 ? (
                    <p className="text-sm font-normal text-text-secondary">データがありません</p>
                ) : (
                    items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-sm font-normal text-text-secondary">
                            <span className="truncate text-text-primary">{item.label}</span>
                            <span className="shrink-0 tabular-nums">{item.count}{item.unit || '件'}</span>
                        </div>
                    ))
                )}
            </div>
            {note && <p className="mt-2 text-xs font-normal text-text-secondary">{note}</p>}
        </div>
    )
}
