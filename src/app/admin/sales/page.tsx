'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { useStoreChange } from '@/hooks/useStoreChange'

export default function SalesPage() {
    const { count: storeChangeCount } = useStoreChange()
    const { data: session, status } = useSession()
    const router = useRouter()
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
    const [selectedStore, setSelectedStore] = useState('all')

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
                            <p className="mt-1 text-sm text-gray-500">入金実績・月次売上明細</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white shadow rounded-lg mb-8 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">対象月</label>
                            <input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">店舗</label>
                            <select
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="all">全店舗</option>
                                <option value="77439c86-679a-409a-8000-2e5297e5c0e8">Store 1</option>
                                <option value="43296d78-13f3-4061-8d75-d38dfe907a5d">Store 2</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="mb-8">
                    <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-1">売上総額</h3>
                            <p className="text-3xl font-bold text-gray-900">
                                ¥{displaySummary.totalSales.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        {loading ? (
                            <p className="text-center py-8 text-gray-500">読み込み中...</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">会員名</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">プラン</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {(() => {
                                            if (combinedList.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                                                            該当するデータはありません
                                                        </td>
                                                    </tr>
                                                )
                                            }

                                            return combinedList.map((item, index) => (
                                                <tr key={`${item.status}-${item.id || item.user_id}-${index}`} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {item.userId ? (
                                                            <Link
                                                                href={`/admin/members/${item.userId}?from=sales`}
                                                                className="text-indigo-600 hover:text-indigo-800 hover:underline"
                                                            >
                                                                {item.displayName}
                                                            </Link>
                                                        ) : (
                                                            item.displayName
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {item.displayPlan}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                        ¥{item.displayAmount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
