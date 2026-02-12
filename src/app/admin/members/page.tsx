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
  const [sortKey, setSortKey] = useState<'plan' | 'status' | 'created' | null>(null)
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
        <div className="mb-6">
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => router.push(trainerToken ? `/trainer/${trainerToken}` : '/dashboard')}
              className="absolute left-0 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">会員一覧</h1>
              <p className="mt-1 text-sm text-gray-500">会員のステータス管理</p>
            </div>
            {!trainerToken && (
              <Link
                href={`/admin/sales${(session as any)?.user?.storeId ? `?store=${(session as any).user.storeId}` : ''}`}
                className="absolute right-0 px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full hover:bg-orange-600 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                売上管理
              </Link>
            )}
          </div>
        </div>

        {/* Compact toolbar: Stats + Filter + New button */}
        <div className="bg-white shadow rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-blue-700 text-lg">{totalActive}<span className="text-xs font-normal text-gray-500 ml-0.5">名</span></span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOnlyActive(prev => !prev)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full border whitespace-nowrap transition-colors ${showOnlyActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
              >
                {showOnlyActive ? '在籍のみ' : '全員'}
              </button>
              <Link
                href="/admin/members/new"
                className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-medium rounded-full hover:bg-blue-700 transition-colors flex items-center gap-0.5 whitespace-nowrap"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新規
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sortedPlans.map(plan => (
              <div key={plan} className="bg-gray-50 rounded-md px-2 py-1.5 text-center">
                <div className="text-[10px] text-gray-500 leading-tight truncate">{plan}</div>
                <div className="text-sm font-bold text-gray-800">{planCounts[plan]}</div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className={`mb-4 border rounded-md p-3 text-sm ${error.includes('更新完了') || error.includes('コピー')
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
            }`}>
            {error}
          </div>
        )}

        {/* Members List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {!members || members.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">会員データがありません</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedMembers && (showOnlyActive ? sortedMembers.filter(m => (m.status || 'active') === 'active') : sortedMembers).map((member) => (
                <Link
                  key={member.id}
                  href={`/admin/members/${member.id}`}
                  className="flex items-center px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-2 truncate" style={{flex: '0 0 40%'}}>
                    <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${getStatusDotColor(member.status)}`} />
                    <span className="font-medium text-[13px] text-gray-900 truncate">{member.full_name}</span>
                  </span>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap text-left" style={{flex: '1 1 auto', textAlign: 'left'}}>{member.plan || '-'}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap flex-shrink-0 ${getStatusColor(member.status)}`}>
                    {getStatusText(member.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 削除モーダルは使用しない（非表示運用に変更） */}

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
