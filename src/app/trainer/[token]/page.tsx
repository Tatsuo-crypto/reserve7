'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Trainer {
  id: string
  name: string
  email: string
  storeId: string
}

export default function TrainerDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrainer = async () => {
      try {
        setLoading(true)

        // Verify token and get trainer info
        const response = await fetch(`/api/auth/trainer-token?token=${token}`)
        if (!response.ok) {
          setError('無効なURLです')
          return
        }
        const data = await response.json()
        setTrainer(data.trainer)

      } catch (err) {
        console.error('Error fetching trainer:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchTrainer()
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !trainer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">アクセスエラー</h1>
          <p className="text-gray-600">{error || '無効なURLです'}</p>
        </div>
      </div>
    )
  }

  const getStoreDisplayName = (storeId: string) => {
    return storeId === 'tandjgym@gmail.com' ? 'T&J GYM1号店' : 'T&J GYM2号店'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">T&J GYM</h1>
              <p className="text-sm text-gray-600 mt-1">トレーナー: {trainer.name} 様</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">{getStoreDisplayName(trainer.storeId)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 予約管理 */}
          <Link
            href={`/admin/calendar?trainerToken=${token}`}
            className="group bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <div className="ml-6 flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">予約</h3>
                <p className="text-gray-600">すべての予約を確認・管理</p>
              </div>
            </div>
          </Link>

          {/* 会員管理 */}
          <Link
            href={`/admin/members?trainerToken=${token}`}
            className="group bg-white hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-6 flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">会員管理</h3>
                <p className="text-gray-600">会員情報の管理</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-900">トレーナー権限</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>予約管理と会員管理機能をご利用いただけます。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
