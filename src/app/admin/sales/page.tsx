'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPlanRank, getStatusRank, formatMonthlyFee } from '@/lib/utils/member'
import { fetchMembers } from '@/lib/api-client'
import type { Member } from '@/types'
import { useStoreChange } from '@/hooks/useStoreChange'

export default function SalesPage() {
  const { count: storeChangeCount } = useStoreChange()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return // まだ読み込み中
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/reservations')
      return
    }
  }, [status, session, router])

  // Fetch stores
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch('/api/admin/stores')
        if (response.ok) {
          const result = await response.json()
          const data = result.data || result
          setStores(data.stores || [])
        }
      } catch (error) {
        console.error('Failed to fetch stores:', error)
      }
    }
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchStores()
    }
  }, [status, session])

  // Fetch members
  useEffect(() => {
    const loadMembers = async () => {
      console.log('Sales: Starting to fetch members...')
      try {
        // Fetch all stores data for sales page
        const response = await fetchMembers(true)
        console.log('Sales: API response:', response)

        if (response.error) {
          console.error('Sales: API error:', response.error)
          setError(`会員データの取得に失敗しました: ${response.error}`)
        } else if (response.data) {
          console.log('Sales: Members received:', response.data.members?.length)
          setMembers(response.data.members || [])
        } else {
          console.log('Sales: No data in response')
        }
      } catch (error) {
        console.error('Fetch Error:', error)
        setError('会員データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    console.log('Sales: Effect running - status:', status, 'role:', session?.user?.role)
    // 認証済みかつ管理者の場合のみデータを取得
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      loadMembers()
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      console.log('Sales: Not admin, skipping data fetch')
      setLoading(false)
    }
  }, [session, status, storeChangeCount])

  // Sorting state
  const [sortKey, setSortKey] = useState<'plan' | 'status' | 'created' | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  // Show only active filter
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  // Store filter
  const [selectedStore, setSelectedStore] = useState<string>('all')
  const [stores, setStores] = useState<{ id: string, name: string }[]>([])

  // Utility functions imported from @/lib/utils/member

  const sortedMembers = (() => {
    // Filter by store first
    const filteredByStore = selectedStore === 'all'
      ? members
      : members.filter(m => m.store_id === selectedStore)

    const arr = [...filteredByStore]
    if (!sortKey) return arr
    return arr.sort((a, b) => {
      let av = 0, bv = 0
      if (sortKey === 'plan') {
        av = getPlanRank(a.plan)
        bv = getPlanRank(b.plan)
      } else if (sortKey === 'status') {
        av = getStatusRank(a.status)
        bv = getStatusRank(b.status)
      } else if (sortKey === 'created') {
        av = new Date(a.created_at).getTime()
        bv = new Date(b.created_at).getTime()
      }
      const comp = av === bv ? (a.full_name || '').localeCompare(b.full_name || '') : av - bv
      return sortAsc ? comp : -comp
    })
  })()

  // Small accent dot color next to the member name
  const getStatusDotColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'suspended': return 'bg-yellow-500'
      case 'withdrawn': return 'bg-red-500'
      default: return 'bg-green-500'
    }
  }

  // 認証状態をチェック中の場合
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">認証状態を確認中...</div>
      </div>
    )
  }

  // 未認証の場合はリダイレクト処理中
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">ログインページにリダイレクト中...</div>
      </div>
    )
  }

  // 管理者以外の場合はリダイレクト処理中
  if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">予約ページにリダイレクト中...</div>
      </div>
    )
  }

  // データ読み込み中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">会員データを読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-center relative">
              <button
                onClick={() => router.push('/dashboard')}
                className="absolute left-0 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">売上管理</h1>
                <p className="mt-2 text-gray-600">プラン別売上の確認</p>
              </div>
            </div>

            {/* Store Filter */}
            <div className="flex justify-center">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全店舗</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Plan Summary */}
        {members && members.length > 0 && (() => {
          // Filter by store
          const filteredByStore = selectedStore === 'all'
            ? members
            : members.filter(m => m.store_id === selectedStore)

          const activeMembersList = showOnlyActive
            ? filteredByStore.filter(m => (m.status || 'active') === 'active')
            : filteredByStore

          const planStats: { [key: string]: { count: number; total: number } } = {}

          activeMembersList.forEach(member => {
            const plan = member.plan || 'その他'
            if (!planStats[plan]) {
              planStats[plan] = { count: 0, total: 0 }
            }
            planStats[plan].count += 1
            planStats[plan].total += member.monthly_fee || 0
          })

          const totalCount = Object.values(planStats).reduce((sum, stat) => sum + stat.count, 0)
          const totalAmount = Object.values(planStats).reduce((sum, stat) => sum + stat.total, 0)

          return (
            <div className="mb-6 bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">プラン別サマリー</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Object.entries(planStats).sort(([a], [b]) => a.localeCompare(b)).map(([plan, stats]) => (
                  <div key={plan} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col h-full">
                    <div className="text-sm font-medium text-gray-700 mb-2 h-10 flex items-center">{plan}</div>
                    <div className="text-2xl font-bold text-indigo-600">{stats.count}名</div>
                    <div className="text-sm text-gray-600 mt-1">¥{stats.total.toLocaleString()}</div>
                  </div>
                ))}
                <div className="bg-indigo-50 rounded-lg p-4 border-2 border-indigo-300 flex flex-col h-full">
                  <div className="text-sm font-medium text-indigo-900 mb-2 h-10 flex items-center">合計</div>
                  <div className="text-2xl font-bold text-indigo-700">{totalCount}名</div>
                  <div className="text-sm text-indigo-700 mt-1 font-semibold">¥{totalAmount.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )
        })()}

        {error && (
          <div className={`mb-6 border rounded-md p-4 ${error.includes('更新完了')
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
            }`}>
            <p className={error.includes('更新完了') ? 'text-green-800' : 'text-red-800'}>
              {error}
            </p>
          </div>
        )}

        {/* Members Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {!members || members.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">会員データがありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-max divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        店舗
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        会員名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] cursor-pointer select-none"
                        onClick={() => { setSortKey(prev => prev === 'plan' ? 'plan' : 'plan'); setSortAsc(prev => sortKey === 'plan' ? !prev : true) }}>
                        プラン {sortKey === 'plan' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        月会費
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] cursor-pointer select-none"
                        onClick={() => { setSortKey(prev => prev === 'status' ? 'status' : 'status'); setSortAsc(prev => sortKey === 'status' ? !prev : true) }}>
                        ステータス {sortKey === 'status' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        メールアドレス
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                        メモ
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] cursor-pointer select-none"
                        onClick={() => { setSortKey('created'); setSortAsc(prev => sortKey === 'created' ? !prev : true) }}
                      >
                        登録日 {sortKey === 'created' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedMembers && (showOnlyActive ? sortedMembers.filter(m => (m.status || 'active') === 'active') : sortedMembers).map((member) => (
                      <tr key={member.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[120px]">
                          {member.stores?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[120px]">
                          <div className="flex items-center">
                            {member.access_token ? (
                              <Link
                                href={`/client/${member.access_token}`}
                                className="text-indigo-600 hover:text-indigo-800 hover:underline"
                                target="_blank"
                              >
                                {member.full_name}
                              </Link>
                            ) : (
                              <span className="text-gray-900">{member.full_name}</span>
                            )}
                            <span className={`ml-2 inline-block w-2 h-2 rounded-full ${getStatusDotColor(member.status)}`} aria-hidden="true"></span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[140px]">
                          {member.plan || '月4回'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[100px]">
                          {member.monthly_fee ? `¥${member.monthly_fee.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${member.status === 'active' ? 'bg-green-100 text-green-800' :
                              member.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                                member.status === 'withdrawn' ? 'bg-red-100 text-red-800' :
                                  'bg-green-100 text-green-800'
                            }`}>
                            {member.status === 'active' ? '在籍' :
                              member.status === 'suspended' ? '休会' :
                                member.status === 'withdrawn' ? '退会' : '在籍'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 min-w-[200px]">
                          {member.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[150px]">
                          {member.memo || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 min-w-[120px]">
                          {new Date(member.created_at).toLocaleDateString('ja-JP')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Bottom Active-only Toggle */}
            <div className="mt-6 flex items-center justify-center">
              <button
                onClick={() => setShowOnlyActive(prev => !prev)}
                className={`px-4 py-2 text-sm font-medium rounded-md border ${showOnlyActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {showOnlyActive ? 'すべて表示' : '在籍のみ表示'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 削除モーダルは使用しない（非表示運用に変更） */}
    </div>
  )
}
