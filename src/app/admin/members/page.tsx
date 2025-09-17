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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">会員管理</h1>
              <p className="mt-2 text-gray-600">会員のステータス管理</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              ダッシュボードに戻る
            </Link>
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
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      会員名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メールアドレス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      プラン
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      登録日
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members && members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {member.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <select
                          value={selectedPlans[member.id] || member.plan || '月4回'}
                          onChange={(e) => {
                            setSelectedPlans(prev => ({...prev, [member.id]: e.target.value}))
                            handlePlanChange(member.id, e.target.value)
                          }}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                        >
                          <option value="月2回">月2回</option>
                          <option value="月4回">月4回</option>
                          <option value="月6回">月6回</option>
                          <option value="月8回">月8回</option>
                          <option value="ダイエットコース">ダイエットコース</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={selectedStatuses[member.id] || member.status || 'active'}
                          onChange={(e) => {
                            setSelectedStatuses(prev => ({...prev, [member.id]: e.target.value}))
                            handleStatusChange(member.id, e.target.value)
                          }}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                        >
                          <option value="active">在籍</option>
                          <option value="suspended">休会</option>
                          <option value="withdrawn">退会</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(member.created_at).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  ))}
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
