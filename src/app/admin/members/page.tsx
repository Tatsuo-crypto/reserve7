'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Member {
  id: string
  full_name: string
  email: string
  plan?: string
  status?: 'active' | 'suspended' | 'withdrawn'
  store_id: string
  created_at: string
  memo?: string
  access_token?: string
}

export default function MembersPage() {
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
          console.error('API Error:', errorData)
          setError(`会員データの取得に失敗しました: ${errorData.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Fetch Error:', error)
        setError('会員データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    // 認証済みかつ管理者の場合のみデータを取得
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchMembers()
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      setLoading(false)
    }
  }, [session, status])

  const [selectedStatuses, setSelectedStatuses] = useState<{[key: string]: string}>({})
  const [selectedPlans, setSelectedPlans] = useState<{[key: string]: string}>({})
  const [memos, setMemos] = useState<{[key: string]: string}>({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<{id: string, name: string} | null>(null)

  // Sorting state
  const [sortKey, setSortKey] = useState<'plan' | 'status' | 'created' | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  // Show only active filter (UI button below table)
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  // Copy access URL to clipboard
  const handleCopyAccessUrl = async (accessToken: string, memberName: string) => {
    const baseUrl = window.location.origin
    const accessUrl = `${baseUrl}/client/${accessToken}`
    
    try {
      await navigator.clipboard.writeText(accessUrl)
      setError(`「${memberName}」様の専用URLをコピーしました`)
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
      setError('URLのコピーに失敗しました')
    }
  }


  const getPlanRank = (plan?: string) => {
    if (!plan) return 999
    if (plan.includes('2回')) return 2
    if (plan.includes('4回')) return 4
    if (plan.includes('6回')) return 6
    if (plan.includes('8回')) return 8
    if (plan.includes('ダイエット')) return 100
    return 999
  }

  const getStatusRank = (status?: string) => {
    switch (status) {
      case 'active': return 1 // 在籍
      case 'suspended': return 2 // 休会
      case 'withdrawn': return 3 // 退会
      default: return 9
    }
  }

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

  const handleStatusChange = async (memberId: string, newStatus?: string) => {
    const statusToUpdate = newStatus || selectedStatuses[memberId] || 'active'
    
    try {
      console.log('ステータス更新開始:', { memberId, statusToUpdate })
      
      const response = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          status: statusToUpdate,
        }),
      })

      const result = await response.json()
      console.log('ステータス更新レスポンス:', result)

      if (response.ok) {
        // Update local state
        setMembers(prev => prev.map(member => 
          member.id === memberId 
            ? { ...member, status: statusToUpdate as 'active' | 'suspended' | 'withdrawn' }
            : member
        ))
        
        // Clear selected status for this member
        setSelectedStatuses(prev => {
          const updated = { ...prev }
          delete updated[memberId]
          return updated
        })
        
        // Show success message if it was simulated
        if (result.message) {
          setError(`更新完了: ${result.message}`)
          setTimeout(() => setError(''), 3000) // Clear message after 3 seconds
        }
      } else {
        console.error('ステータス更新エラー:', result)
        setError(`ステータス更新に失敗しました: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('ステータス更新例外:', error)
      setError('ステータス更新中にエラーが発生しました')
    }
  }

  const handlePlanChange = async (memberId: string, newPlan?: string) => {
    const planToUpdate = newPlan || selectedPlans[memberId] || '月4回'
    
    try {
      console.log('プラン更新開始:', { memberId, planToUpdate })
      
      const response = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          plan: planToUpdate,
        }),
      })

      const result = await response.json()
      console.log('プラン更新レスポンス:', result)

      if (response.ok) {
        // Update local state
        setMembers(prev => prev.map(member => 
          member.id === memberId 
            ? { ...member, plan: planToUpdate }
            : member
        ))
        
        // Clear selection
        setSelectedPlans(prev => {
          const newState = { ...prev }
          delete newState[memberId]
          return newState
        })
        
        setError('プラン更新完了: ' + planToUpdate)
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setError('')
        }, 3000)
      } else {
        setError('プラン更新に失敗しました: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('プラン更新エラー:', error)
      setError('プラン更新中にエラーが発生しました')
    }
  }

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

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'active': return '在籍'
      case 'suspended': return '休会'
      case 'withdrawn': return '退会'
      default: return '在籍' // Default to active if status is undefined
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'suspended': return 'bg-yellow-100 text-yellow-800'
      case 'withdrawn': return 'bg-red-100 text-red-800'
      default: return 'bg-green-100 text-green-800' // Default to active styling
    }
  }

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
                <h1 className="text-3xl font-bold text-gray-900">会員管理</h1>
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

        {error && (
          <div className={`mb-6 border rounded-md p-4 ${
            error.includes('更新完了') 
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
                      会員名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                      メールアドレス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] cursor-pointer select-none"
                        onClick={() => { setSortKey(prev => prev === 'plan' ? 'plan' : 'plan'); setSortAsc(prev => sortKey === 'plan' ? !prev : true) }}>
                      プラン {sortKey === 'plan' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] cursor-pointer select-none"
                        onClick={() => { setSortKey(prev => prev === 'status' ? 'status' : 'status'); setSortAsc(prev => sortKey === 'status' ? !prev : true) }}>
                      ステータス {sortKey === 'status' ? (sortAsc ? '▲' : '▼') : ''}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedMembers && (showOnlyActive ? sortedMembers.filter(m => (m.status || 'active') === 'active') : sortedMembers).map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[120px]">
                        <div className="flex items-center">
                          <Link
                            href={`/admin/members/${member.id}`}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {member.full_name}
                          </Link>
                          <span className={`ml-2 inline-block w-2 h-2 rounded-full ${getStatusDotColor(member.status)}`} aria-hidden="true"></span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 min-w-[200px]">
                        {member.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[140px]">
                        <select
                          value={selectedPlans[member.id] || member.plan || '月4回'}
                          onChange={(e) => {
                            setSelectedPlans(prev => ({...prev, [member.id]: e.target.value}))
                            handlePlanChange(member.id, e.target.value)
                          }}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full min-w-[120px]"
                        >
                          <option value="月2回">月2回</option>
                          <option value="月4回">月4回</option>
                          <option value="月6回">月6回</option>
                          <option value="月8回">月8回</option>
                          <option value="ダイエットコース">ダイエットコース</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                        <select
                          value={selectedStatuses[member.id] || member.status || 'active'}
                          onChange={(e) => {
                            setSelectedStatuses(prev => ({...prev, [member.id]: e.target.value}))
                            handleStatusChange(member.id, e.target.value)
                          }}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full min-w-[100px]"
                        >
                          <option value="active">在籍</option>
                          <option value="suspended">休会</option>
                          <option value="withdrawn">退会</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[150px]">
                        <input
                          type="text"
                          value={memos[member.id] !== undefined ? memos[member.id] : (member.memo || '')}
                          onChange={(e) => {
                            setMemos(prev => ({...prev, [member.id]: e.target.value}))
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[100px]">
                        {member.access_token ? (
                          <button
                            onClick={() => handleCopyAccessUrl(member.access_token!, member.full_name)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            title="専用URLをコピー"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            URL
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
