'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import TrackingModal from './TrackingModal'
import type { Member } from '@/types'
import {
  getPlanRank,
  getStatusRank,
  getStatusText,
  getStatusColor,
  getStatusDotColor,
  generateMemberAccessUrl
} from '@/lib/utils/member'
import { useStoreChange } from '@/hooks/useStoreChange'
import AdminHeader from '@/app/components/AdminHeader'

function MembersPageContent() {
  const { count: storeChangeCount } = useStoreChange()
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const trainerToken = searchParams.get('trainerToken')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  // Fetch members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch('/api/admin/members')

        if (response.ok) {
          const result = await response.json()
          const data = result.data || result
          setMembers(data.members || [])
        } else {
          const errorData = await response.json()
          console.error('API Error Response:', errorData)
          setError(`会員データの取得に失敗しました: ${errorData.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Fetch Error:', error)
        setError('会員データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    // 認証済みの場合データを取得
    if (status === 'authenticated') {
      fetchMembers()
    }
  }, [status, storeChangeCount])

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<{ id: string, name: string } | null>(null)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<{ id: string, name: string } | null>(null)

  // Sorting state
  const [sortKey, setSortKey] = useState<'plan' | 'status' | 'created' | null>('plan')
  const [sortAsc, setSortAsc] = useState(true)

  // Show only active filter (UI button below table)
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  // Copy access URL to clipboard
  const handleCopyAccessUrl = async (accessToken: string, memberName: string) => {
    try {
      const accessUrl = generateMemberAccessUrl(accessToken)
      await navigator.clipboard.writeText(accessUrl)
      setError(`「${memberName}」様の専用URLをコピーしました`)
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
      setError('URLのコピーに失敗しました')
    }
  }


  // Utility functions imported from @/lib/utils/member

  const sortedMembers = (() => {
    const arr = [...members]
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

  const handleDeleteMember = (memberId: string, memberName: string) => {
    setMemberToDelete({ id: memberId, name: memberName })
    setShowDeleteModal(true)
  }

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return

    try {
      const response = await fetch('/api/admin/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: memberToDelete.id,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Remove member from local state
        setMembers(prev => prev.filter(member => member.id !== memberToDelete.id))
        setError(`会員「${memberToDelete.name}」を削除しました`)
        setTimeout(() => setError(''), 3000)
      } else {
        setError(`会員削除に失敗しました: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('会員削除エラー:', error)
      setError('会員削除中にエラーが発生しました')
    } finally {
      setShowDeleteModal(false)
      setMemberToDelete(null)
    }
  }

  // Status utility functions imported from @/lib/utils/member

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

  // データ読み込み中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">会員データを読み込み中...</div>
      </div>
    )
  }

  // Calculate stats
  const activeMembers = members.filter(m => m.status === 'active')
  const totalActive = activeMembers.length
  
  const planCounts = activeMembers.reduce((acc, member) => {
    const plan = member.plan || '未設定'
    acc[plan] = (acc[plan] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Sort plans for consistent display (optional: predefined order or alphabetical)
  const sortedPlans = Object.keys(planCounts).sort()

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <AdminHeader 
          title="会員管理" 
          subTitle="会員ステータスと情報の管理"
          showBack={false}
          rightElement={
            <Link
              href="/admin/members/new"
              className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-2xl hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 uppercase tracking-widest"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              新規登録
            </Link>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">現在の在籍者</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-blue-600 tracking-tight">{totalActive}</span>
              <span className="text-sm font-bold text-gray-400">名</span>
            </div>
          </div>
          <div className="md:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">プラン別内訳</div>
            <div className="flex flex-wrap gap-2">
              {sortedPlans.map(plan => (
                <div key={plan} className="bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100 flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-500">{plan}</span>
                  <span className="text-sm font-black text-gray-800 tabular-nums">{planCounts[plan]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button
              onClick={() => setShowOnlyActive(true)}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${showOnlyActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              在籍のみ
            </button>
            <button
              onClick={() => setShowOnlyActive(false)}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!showOnlyActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              全員表示
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortKey || ''}
              onChange={(e) => setSortKey(e.target.value as any || null)}
              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">標準並び替え</option>
              <option value="plan">プラン順</option>
              <option value="status">ステータス順</option>
              <option value="created">登録日順</option>
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl border border-gray-100 transition-all"
            >
              <svg className={`w-4 h-4 transition-transform ${sortAsc ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-gray-900 text-white font-black text-sm shadow-xl flex items-center gap-3 animate-fadeIn">
            <div className="w-1.5 h-4 bg-rose-500 rounded-full"></div>
            {error}
          </div>
        )}

        {/* Member List (Simple Table Format) */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {!members || members.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-gray-400 font-bold italic">会員データが見つかりません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">氏名</th>
                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">プラン</th>
                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">ステータス</th>
                    <th className="px-4 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(showOnlyActive ? sortedMembers.filter(m => (m.status || 'active') === 'active') : sortedMembers).map((member) => (
                    <tr 
                      key={member.id}
                      onClick={() => router.push(`/admin/members/${member.id}`)}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${getStatusDotColor(member.status)} shadow-sm`}></div>
                          <div className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors truncate max-w-[120px] sm:max-w-none">
                            {member.full_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[10px] font-black text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {member.plan || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shadow-sm whitespace-nowrap ${getStatusColor(member.status)}`}>
                          {getStatusText(member.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center text-gray-200 group-hover:text-blue-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* トラッキングモーダル */}
        {selectedMember && (
          <TrackingModal
            isOpen={showTrackingModal}
            onClose={() => {
              setShowTrackingModal(false)
              setSelectedMember(null)
            }}
            memberId={selectedMember.id}
            memberName={selectedMember.name}
          />
        )}
      </div>
    </div>
  )
}

export default function MembersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <MembersPageContent />
    </Suspense>
  )
}
