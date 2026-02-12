'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ComposedChart, Area
} from 'recharts'
import { useStoreChange } from '@/hooks/useStoreChange'
import MemberMovementModal from './MemberMovementModal'

export default function AnalyticsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { currentStoreId } = useStoreChange()
    const [period, setPeriod] = useState<string>('all')
    const [filterStoreId, setFilterStoreId] = useState<string>(currentStoreId || 'all')
    const [stores, setStores] = useState<{ id: string, name: string }[]>([])
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

                {/* Member Movement (Join/Withdraw) - Custom Block Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">入会・退会推移</h3>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-sm bg-red-400"></span>
                                新規入会
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-sm bg-blue-400"></span>
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
                                    <div key={item.month} className="flex flex-col items-center">
                                        {/* Year label at top when year changes */}
                                        {showYear && (
                                            <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full mb-1 whitespace-nowrap">
                                                {yearStr}
                                            </div>
                                        )}
                                        {!showYear && <div className="h-[22px]" />}
                                        <div
                                            className="flex flex-col items-center cursor-pointer hover:bg-gray-50 rounded-lg transition-colors px-1"
                                            style={{ minWidth: `${Math.max(40, 600 / memberHistory.length)}px` }}
                                            onClick={() => handleMonthClick(item)}
                                        >
                                            {/* New members blocks (above center line) */}
                                            <div className="flex flex-col-reverse items-center gap-[2px]" style={{ minHeight: `${maxBlocks * 20}px`, justifyContent: 'flex-start' }}>
                                                {Array.from({ length: newCount }).map((_, i) => (
                                                    <div
                                                        key={`n-${i}`}
                                                        className="w-5 h-4 rounded-sm bg-red-400"
                                                    />
                                                ))}
                                            </div>
                                            {/* Center line + month label */}
                                            <div className="w-full border-t border-gray-200 my-1" />
                                            <div className="text-[10px] text-gray-500 leading-none mb-1 font-medium">
                                                {monthLabel}
                                            </div>
                                            <div className="w-full border-t border-gray-200 mb-1" />
                                            {/* Withdrawn blocks (below center line) */}
                                            <div className="flex flex-col items-center gap-[2px]" style={{ minHeight: `${maxBlocks * 20}px`, justifyContent: 'flex-start' }}>
                                                {Array.from({ length: withdrawnCount }).map((_, i) => (
                                                    <div
                                                        key={`w-${i}`}
                                                        className="w-5 h-4 rounded-sm bg-blue-400"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2 text-center">※ 月をタップすると詳細を表示します</p>
                </div>
            </div>

            <MemberMovementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={selectedMonthData}
            />
        </div>
    )
}
