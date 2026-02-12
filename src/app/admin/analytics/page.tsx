'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ComposedChart, Area, ReferenceLine, Cell
} from 'recharts'
import { useStoreChange } from '@/hooks/useStoreChange'


export default function AnalyticsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { currentStoreId } = useStoreChange()
    const [period, setPeriod] = useState<string>('all')
    const [filterStoreId, setFilterStoreId] = useState<string>(currentStoreId || 'all')
    const [stores, setStores] = useState<{ id: string, name: string }[]>([])


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

    const [data, setData] = useState<{
        memberHistory: any[],
        salesHistory: any[],
        projectedSales: number
    }>({
        memberHistory: [],
        salesHistory: [],
        projectedSales: 0
    })
    const [loading, setLoading] = useState(true)

    // Fetch stores list
    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await fetch('/api/admin/stores')
                if (res.ok) {
                    const json = await res.json()
                    const list = json.data?.stores || json.stores || []
                    setStores(list)
                }
            } catch (e) {
                console.error('Failed to fetch stores', e)
            }
        }
        fetchStores()
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
                const params = new URLSearchParams()
                // Explicitly send storeId (even if 'all')
                // If we don't send it, backend defaults to user.storeId which filters to single store
                params.append('storeId', filterStoreId || 'all')
                params.append('period', period)
                // Add timestamp to prevent caching
                params.append('_t', Date.now().toString())

                const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                })
                if (ignore) return // Check if effect was cleaned up

                if (!res.ok) throw new Error('Failed to fetch data')
                const json = await res.json()
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

    if (loading && data.memberHistory.length === 0) {
        return <div className="p-8 text-center text-gray-500">データを読み込み中...</div>
    }

    const { memberHistory, salesHistory, projectedSales } = data

    // Calculate summaries from latest data
    const currentMonth = memberHistory.length > 0 ? memberHistory[memberHistory.length - 1] : {}
    const prevMonth = memberHistory.length > 1 ? memberHistory[memberHistory.length - 2] : {}
    const activeCount = currentMonth.active || 0
    const prevActive = prevMonth.active || 0

    // Avoid division by zero
    const growth = prevActive > 0 ? ((activeCount - prevActive) / prevActive * 100).toFixed(1) : 0

    // Transform data for Join/Withdraw chart
    const movementData = memberHistory.map(item => ({
        month: item.month,
        new: item.new || 0,
        withdrawn: -(item.withdrawn || 0),
    }))

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-6">
                <div className="relative flex items-center justify-center">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="absolute left-0 text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900">分析・レポート</h1>
                        <p className="mt-1 text-sm text-gray-500">会員数、売上の推移を確認できます</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-8 flex justify-center gap-2">
                <select
                    value={filterStoreId}
                    onChange={(e) => setFilterStoreId(e.target.value)}
                    className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1 pl-2 pr-8"
                >
                    <option value="all">全店舗</option>
                    {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                </select>
                
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1 pl-2 pr-8"
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
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">現在の会員数</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">{activeCount}</span>
                        <span className="ml-1 text-sm text-gray-500">名</span>
                        <span className={`ml-2 text-sm font-medium ${Number(growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Number(growth) >= 0 ? '+' : ''}{growth}%
                        </span>
                        <span className="ml-2 text-xs text-gray-400">前月比</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">今月の売上見込み (概算)</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">¥{projectedSales.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" key={`${filterStoreId}-${period}`}>

                {/* Member Growth Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">会員数推移</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart 
                                data={memberHistory} 
                                className="outline-none focus:outline-none"
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                                <YAxis style={{ fontSize: '12px' }} />
                                <Tooltip formatter={(value: any, name: any) => [`${value}名`, name]} />
                                <Legend />
                                <Area type="monotone" dataKey="active" name="在籍会員" fill="#818cf8" stroke="#4f46e5" fillOpacity={0.1} />
                                <Line type="monotone" dataKey="suspended" name="休会" stroke="#94a3b8" strokeDasharray="5 5" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sales Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">売上推移</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesHistory}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                                <YAxis
                                    style={{ fontSize: '12px' }}
                                    tickFormatter={(value) => `¥${value / 10000}万`}
                                />
                                <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
                                <Legend />
                                <Bar dataKey="amount" name="月会費売上" fill="#34d399" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Member Movement (Join/Withdraw) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">入会・退会推移</h3>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={movementData}
                                stackOffset="sign"
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" style={{ fontSize: '11px' }} />
                                <YAxis
                                    style={{ fontSize: '12px' }}
                                    tickFormatter={(val) => `${Math.abs(val)}人`}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    formatter={(value: any, name: any) => [
                                        `${Math.abs(Number(value))}人`,
                                        name
                                    ]}
                                />
                                <Legend />
                                <ReferenceLine y={0} stroke="#d1d5db" />
                                <Bar
                                    dataKey="new"
                                    name="新規入会"
                                    fill="#ef4444"
                                    stackId="a"
                                    radius={[2, 2, 0, 0]}
                                    maxBarSize={40}
                                />
                                <Bar
                                    dataKey="withdrawn"
                                    name="退会"
                                    fill="#3b82f6"
                                    stackId="a"
                                    radius={[0, 0, 2, 2]}
                                    maxBarSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}
