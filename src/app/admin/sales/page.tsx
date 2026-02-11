'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { useStoreChange } from '@/hooks/useStoreChange'

function SalesPageContent() {
    const { count: storeChangeCount, currentStoreId } = useStoreChange()
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const storeParam = searchParams.get('store')
    const [isClient, setIsClient] = useState(false)
    const [sales, setSales] = useState<any[]>([])
    const [unpaidList, setUnpaidList] = useState<any[]>([])
    const [summary, setSummary] = useState({
        totalPaid: 0,
        totalUnpaid: 0,
        projectedSales: 0,
        unpaidCount: 0
    })
    const [loading, setLoading] = useState(true)
    const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
    const [selectedStore, setSelectedStore] = useState(storeParam || currentStoreId || 'all')
    const [storeInitialized, setStoreInitialized] = useState(false)

    // Sync selectedStore when currentStoreId becomes available from cookie
    useEffect(() => {
        if (!storeInitialized && currentStoreId && !storeParam) {
            setSelectedStore(currentStoreId)
            setStoreInitialized(true)
        }
    }, [currentStoreId, storeParam, storeInitialized])

    // Client-side calculation for summary and status
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    
    // Calculate derived summary and combined list
    const { combinedList, displaySummary } = (() => {
        // Process unpaid list (monthly membership fees)
        const safeUnpaidList = Array.isArray(unpaidList) ? unpaidList : []
        const processedUnpaidList = safeUnpaidList.map(item => ({
            ...item,
            status: 'unpaid',
            displayName: item.full_name || '-',
            displayPlan: String(item.plan || '-'),
            displayAmount: item.estimated_amount,
            type: '月額',
            userId: item.user_id
        }))

        // Process actual sales list
        const safeSales = Array.isArray(sales) ? sales : []
        const processedSalesList = safeSales.map(item => ({
            ...item,
            status: 'paid',
            displayName: item.users?.full_name || '-',
            displayPlan: String(item.users?.plan || '-'),
            displayAmount: item.amount,
            type: (() => {
                const plan = item.users?.plan || ''
                if (plan.includes('都度') || plan.includes('ダイエット')) return '単発'
                return '月額'
            })(),
            userId: item.user_id || item.users?.id
        }))

        // Combine and sort by plan
        const list = [...processedSalesList, ...processedUnpaidList].sort((a, b) => 
            a.displayPlan.localeCompare(b.displayPlan, 'ja')
        )

        // Calculate totals
        const totalPaid = safeSales.reduce((sum, item) => sum + (item.amount || 0), 0)
        const totalUnpaid = safeUnpaidList.reduce((sum, item) => sum + (item.estimated_amount || 0), 0)
        const totalSales = totalPaid + totalUnpaid
        const paidCount = safeSales.length
        const unpaidCount = safeUnpaidList.length

        return {
            combinedList: list,
            displaySummary: {
                totalSales,
                totalPaid,
                totalUnpaid,
                paidCount,
                unpaidCount
            }
        }
    })()

    useEffect(() => {
        setIsClient(true)
    }, [])

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

    useEffect(() => {
        const fetchSales = async () => {
            if (!isClient || status !== 'authenticated') return
            setLoading(true)
            try {
                const res = await fetch(`/api/admin/sales?month=${month}&storeId=${selectedStore}`)
                const result = await res.json()
                setSales(result.data?.sales || [])
                setUnpaidList(result.data?.unpaidDetails || [])
                if (result.data?.summary) {
                    setSummary(result.data.summary)
                }
            } catch (error) {
                console.error('Failed to fetch sales:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchSales()
    }, [isClient, status, month, selectedStore, storeChangeCount])

    if (!isClient || status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">読み込み中...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                            <h1 className="text-2xl font-bold text-gray-900">売上管理</h1>
                            <p className="mt-1 text-sm text-gray-500">月会費の管理・確認</p>
                        </div>
                    </div>
                </div>

                {/* Compact filters + summary in one bar */}
                <div className="bg-white shadow rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <select
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="all">全店舗</option>
                                <option value="77439c86-679a-409a-8000-2e5297e5c0e8">1号店</option>
                                <option value="43296d78-13f3-4061-8d75-d38dfe907a5d">2号店</option>
                            </select>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-gray-500">売上総額</span>
                            <span className="ml-2 text-lg font-bold text-gray-900">¥{displaySummary.totalSales.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    {loading ? (
                        <p className="text-center py-8 text-gray-500 text-sm">読み込み中...</p>
                    ) : combinedList.length === 0 ? (
                        <p className="text-center py-8 text-gray-500 text-sm">該当するデータはありません</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {combinedList.map((item, index) => (
                                <Link
                                    key={`${item.status}-${item.id || item.user_id}-${index}`}
                                    href={item.userId ? `/admin/members/${item.userId}?from=sales` : '#'}
                                    className="flex items-center px-3 py-2.5 hover:bg-gray-50 transition-colors"
                                >
                                    <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mr-2 ${item.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                    <span className="font-medium text-[13px] text-gray-900 truncate" style={{flex: '1 1 35%'}}>{item.displayName}</span>
                                    <span className="text-[11px] text-gray-500 whitespace-nowrap text-left" style={{flex: '1 1 35%'}}>{item.displayPlan}</span>
                                    <span className="text-[13px] font-bold text-gray-900 whitespace-nowrap text-right" style={{flex: '0 0 auto'}}>¥{item.displayAmount.toLocaleString()}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function SalesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">読み込み中...</div>
            </div>
        }>
            <SalesPageContent />
        </Suspense>
    )
}
