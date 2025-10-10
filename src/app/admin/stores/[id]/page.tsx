'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Member = {
  id: string
  name: string
  email: string
  plan: string
  monthly_fee: number
  status: string
  created_at: string
}

type Store = {
  id: string
  name: string
  email?: string | null
  calendar_id: string
}

export default function StoreDetailPage() {
  const params = useParams()
  const router = useRouter()
  const storeId = params?.id as string

  const [store, setStore] = useState<Store | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        console.log('Fetching store data for storeId:', storeId)
        
        // Fetch store info
        const storeRes = await fetch(`/api/admin/stores/${storeId}`, {
          credentials: 'include'
        })
        if (!storeRes.ok) {
          throw new Error('店舗情報の取得に失敗しました')
        }
        const storeData = await storeRes.json()
        setStore(storeData.store)

        // Fetch members
        const membersUrl = `/api/admin/members?storeId=${storeId}`
        console.log('Fetching members from URL:', membersUrl)
        const membersRes = await fetch(membersUrl, {
          credentials: 'include'
        })
        if (!membersRes.ok) {
          throw new Error('会員情報の取得に失敗しました')
        }
        const membersData = await membersRes.json()
        console.log('Members API response:', membersData)
        console.log('membersData.data:', membersData.data)
        console.log('membersData.data.members:', membersData.data?.members)
        console.log('membersData.members:', membersData.members)
        // API response structure: { data: { members: [...] } } or { members: [...] }
        const membersList = membersData.data?.members || membersData.members || []
        console.log('Members list:', membersList)
        console.log('Members list length:', membersList.length)
        setMembers(membersList)

      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (storeId) {
      fetchData()
    }
  }, [storeId])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">エラー</h1>
          <p className="text-gray-600">{error || '店舗情報が見つかりません'}</p>
          <button
            onClick={() => router.push('/admin/stores')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            店舗一覧に戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-center relative">
            <button
              onClick={() => router.push('/admin/stores')}
              className="absolute left-0 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="戻る"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
              <p className="mt-2 text-gray-600">会員一覧</p>
            </div>
          </div>
        </div>
      </div>

      {/* Store Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">店舗情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">店舗名:</span>
            <p className="text-gray-900 font-medium">{store.name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">メールアドレス:</span>
            <p className="text-gray-900">{store.email || '-'}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-sm text-gray-500">カレンダーID:</span>
            <p className="text-gray-900 text-sm break-all">{store.calendar_id}</p>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            会員一覧 <span className="text-sm text-gray-500">({members.length}名)</span>
          </h2>
        </div>
        <div className="p-6">
          {members.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              この店舗に登録されている会員はいません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-700">名前</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">メールアドレス</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">プラン</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">月額</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{member.name}</td>
                      <td className="px-4 py-3 text-gray-700">{member.email}</td>
                      <td className="px-4 py-3 text-gray-700">{member.plan}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        ¥{member.monthly_fee?.toLocaleString() || '0'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {member.status === 'active' ? '有効' : '無効'}
                        </span>
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
  )
}
