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
    const [members, setMembers] = useState<any[]>([])
    const [totalAmount, setTotalAmount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
    const getStoreFromCookie = () => {
        if (typeof document === 'undefined') return 'all'
        const match = document.cookie.match(/(^|;)\s*admin_store_preference=([^;]+)/)
        return match ? match[2] : 'all'
    }
    const [selectedStore, setSelectedStore] = useState('all')
    const [storeReady, setStoreReady] = useState(false)

    // Initialize selectedStore from cookie on client mount
    useEffect(() => {
        const cookieStore = storeParam || getStoreFromCookie()
        setSelectedStore(cookieStore)
        setStoreReady(true)
    }, [])

    // Sync when store switcher changes
    useEffect(() => {
        if (storeReady && currentStoreId && !storeParam) {
            setSelectedStore(currentStoreId)
        }
    }, [currentStoreId, storeReady])

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
            if (!isClient || status !== 'authenticated' || !storeReady) return
            setLoading(true)
            try {
                const res = await fetch(`/api/admin/sales?month=${month}&storeId=${selectedStore}`)
                const result = await res.json()
                setMembers(result.data?.members || [])
                setTotalAmount(result.data?.totalAmount || 0)
            } catch (error) {
                console.error('Failed to fetch sales:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchSales()
    }, [isClient, status, month, selectedStore, storeChangeCount, storeReady])

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
                            <span className="ml-2 text-lg font-bold text-gray-900">¥{totalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    {loading ? (
                        <p className="text-center py-8 text-gray-500 text-sm">読み込み中...</p>
                    ) : members.length === 0 ? (
                        <p className="text-center py-8 text-gray-500 text-sm">該当するデータはありません</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {members.map((item, index) => (
                                <Link
                                    key={`${item.user_id}-${index}`}
                                    href={`/admin/members/${item.user_id}?from=sales`}
                                    className="flex items-center px-3 py-2.5 hover:bg-gray-50 transition-colors"
                                >
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mr-2 bg-gray-400" />
                                    <span className="font-medium text-[13px] text-gray-900 truncate" style={{flex: '1 1 35%'}}>{item.full_name}</span>
                                    <span className="text-[11px] text-gray-500 whitespace-nowrap text-left" style={{flex: '1 1 35%'}}>{item.plan}</span>
                                    <span className="text-[13px] font-bold text-gray-900 whitespace-nowrap text-right" style={{flex: '0 0 auto'}}>¥{item.amount.toLocaleString()}</span>
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
