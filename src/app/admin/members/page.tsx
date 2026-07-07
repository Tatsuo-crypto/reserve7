'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import TrackingModal from './TrackingModal'
import type { Member } from '@/types'
import Icon from '@/components/ui/icons'
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
    <div className="min-h-screen bg-surface-base pt-4 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-subtle">
            <div className="text-[10px] font-normal text-text-muted uppercase tracking-widest mb-1">現在の在籍者</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-normal text-brand-600 tracking-tight">{totalActive}</span>
              <span className="text-sm font-normal text-text-muted">名</span>
            </div>
          </div>
          <div className="md:col-span-3 bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-subtle">
            <div className="text-[10px] font-normal text-text-muted uppercase tracking-widest mb-4">プラン別内訳</div>
            <div className="flex flex-wrap gap-2">
              {sortedPlans.map(plan => (
                <div key={plan} className="bg-surface-base rounded-lg px-3 py-1.5 border border-border-subtle flex items-center gap-2">
                  <span className="text-[10px] font-normal text-text-secondary">{plan}</span>
                  <span className="text-sm font-normal text-text-primary tabular-nums">{planCounts[plan]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-surface-raised rounded-2xl p-4 shadow-sm border border-border-subtle mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-base p-1 rounded-xl border border-border-subtle">
              <button
                onClick={() => setShowOnlyActive(true)}
                className={`px-4 py-2 rounded-lg text-xs font-normal transition-all ${showOnlyActive ? 'bg-surface-raised text-brand-600 shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                在籍のみ
              </button>
              <button
                onClick={() => setShowOnlyActive(false)}
                className={`px-4 py-2 rounded-lg text-xs font-normal transition-all ${!showOnlyActive ? 'bg-surface-raised text-brand-600 shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                全員表示
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortKey || ''}
                onChange={(e) => setSortKey(e.target.value as any || null)}
                className="bg-surface-base border border-border-subtle rounded-xl px-4 py-2 text-xs font-normal text-text-secondary focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">標準並び替え</option>
                <option value="plan">プラン順</option>
                <option value="status">ステータス順</option>
                <option value="created">登録日順</option>
              </select>
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="p-2 bg-surface-base text-text-muted hover:text-brand-600 rounded-xl border border-border-subtle transition-all"
              >
                <Icon name="chevronDown" size={16} className={`transition-transform ${sortAsc ? '' : 'rotate-180'}`} />
              </button>
            </div>
          </div>

          <Link
            href="/admin/members/new"
            className="px-5 py-2.5 bg-brand-700 text-white text-[10px] font-normal rounded-2xl hover:bg-brand-800 transition-all shadow-md flex items-center gap-2 uppercase tracking-widest"
          >
            <Icon name="plus" size={16} />
            新規登録
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-surface-overlay text-text-primary border border-border-strong font-normal text-sm shadow-xl flex items-center gap-3 animate-fadeIn">
            <div className="w-1.5 h-4 bg-brand-500 rounded-full"></div>
            {error}
          </div>
        )}

        {/* Member List (Simple Table Format) */}
        <div className="bg-surface-raised rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
          {!members || members.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-text-muted font-normal italic">会員データが見つかりません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-base/50 border-b border-border-subtle">
                    <th className="px-4 py-4 text-[10px] font-normal text-text-muted uppercase tracking-widest">氏名</th>
                    <th className="px-4 py-4 text-[10px] font-normal text-text-muted uppercase tracking-widest">プラン</th>
                    <th className="px-4 py-4 text-[10px] font-normal text-text-muted uppercase tracking-widest text-center">ステータス</th>
                    <th className="px-4 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(showOnlyActive ? sortedMembers.filter(m => (m.status || 'active') === 'active') : sortedMembers).map((member) => (
                    <tr 
                      key={member.id}
                      onClick={() => {
                        const lastName = (member.full_name || '').split(/[\s　]+/)[0]
                        router.push(`/admin/members/${member.id}?name=${encodeURIComponent(lastName)}`)
                      }}
                      className="hover:bg-brand-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${getStatusDotColor(member.status)} shadow-sm`}></div>
                          <div className="text-sm font-normal text-text-primary group-hover:text-brand-600 transition-colors truncate max-w-[120px] sm:max-w-none">
                            {member.full_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[10px] font-normal text-text-secondary bg-surface-overlay px-2 py-0.5 rounded-md whitespace-nowrap">
                          {member.plan || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-normal rounded-full shadow-sm whitespace-nowrap ${getStatusColor(member.status)}`}>
                          {getStatusText(member.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center text-text-muted group-hover:text-brand-500 transition-colors">
                          <Icon name="chevronRight" size={16} />
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
        </div>
      </div>
    }>
      <MembersPageContent />
    </Suspense>
  )
}
