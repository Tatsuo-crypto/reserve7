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
    if (status === 'authenticated') {
      fetchMembers()
    }
  }, [status, storeChangeCount])

  const [memos, setMemos] = useState<{ [key: string]: string }>({})
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

  const handleMemoChange = async (memberId: string, memo: string) => {
    try {
      const response = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          memo,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Update local state
        setMembers(prev => prev.map(member =>
          member.id === memberId
            ? { ...member, memo }
            : member
        ))

        setError('メモ更新完了')
        setTimeout(() => setError(''), 2000)
      } else {
        setError('メモ更新に失敗しました: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('メモ更新エラー:', error)
      setError('メモ更新中にエラーが発生しました')
    }
  }

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
        <div className="mb-8">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-center relative">
              <button
                onClick={() => router.push(trainerToken ? `/trainer/${trainerToken}` : '/dashboard')}
                className="absolute left-0 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">会員一覧</h1>
                <p className="mt-2 text-gray-600">会員のステータス管理</p>
              </div>
            </div>
            <div className="flex justify-center">
              <Link
                href="/admin/members/new"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>新規会員</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">在籍会員数集計</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Active */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-600 font-medium">在籍合計</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{totalActive}名</p>
            </div>
            
            {/* Breakdown by Plan */}
            {sortedPlans.map(plan => (
              <div key={plan} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">{plan}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{planCounts[plan]}名</p>
              </div>
            ))}
          </div>
        </div>

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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[200px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <span className={`mr-2 inline-block w-2 h-2 rounded-full ${getStatusDotColor(member.status)}`} aria-hidden="true"></span>
                              {member.access_token ? (
                                <Link
                                  href={`/client/${member.access_token}?from=admin`}
                                  className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold"
                                >
                                  {member.full_name}
                                </Link>
                              ) : (
                                <span className="text-gray-900">{member.full_name}</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 ml-2">
                              <Link
                                href={`/admin/members/${member.id}/edit`}
                                className="inline-flex items-center p-1 border border-gray-300 text-xs rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                title="編集"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </Link>
                              {member.access_token && (
                                <button
                                  onClick={() => {
                                    const url = `${window.location.origin}/client/${member.access_token}`
                                    navigator.clipboard.writeText(url)
                                    setError('専用URLをコピーしました')
                                    setTimeout(() => setError(''), 2000)
                                  }}
                                  className="inline-flex items-center p-1 border border-blue-300 text-xs rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                                  title="専用URLをコピー"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[140px]">
                          {member.plan || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(member.status)}`}>
                            {getStatusText(member.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 min-w-[200px]">
                          {(member.email || '').trim().endsWith('-') ? '-' : member.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[150px]">
                          <input
                            type="text"
                            value={memos[member.id] !== undefined ? memos[member.id] : (member.memo || '')}
                            onChange={(e) => {
                              setMemos(prev => ({ ...prev, [member.id]: e.target.value }))
                            }}
                            onBlur={(e) => {
                              if (e.target.value !== (member.memo || '')) {
                                handleMemoChange(member.id, e.target.value)
                              }
                            }}
                            placeholder="メモを入力..."
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full min-w-[130px]"
                          />
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
