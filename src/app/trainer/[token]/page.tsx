'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
    <div className="min-h-screen">
      {/* Top Navigation */}
      <header className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-100 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-semibold text-gray-900">
              T&J GYM
            </div>
            <div className="bg-white border border-gray-300 px-4 py-2 rounded-lg shadow-sm text-sm flex items-center space-x-3">
              <span className="text-gray-700 font-medium">
                {getStoreDisplayName(trainer.storeId)}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-700 border-blue-300">
                トレーナー
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-6">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  ダッシュボード
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  ようこそ、{trainer.name}さん
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* Dashboard Content */}
      <div className="space-y-6 pb-6">
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 予約管理 */}
            <a
              href={`/admin/calendar?trainerToken=${token}`}
              className="group bg-gradient-to-br from-white to-blue-50 hover:from-blue-50 hover:to-blue-100 border border-blue-200 p-8 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col min-h-[200px] transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center group-hover:from-blue-200 group-hover:to-blue-300 transition-all duration-300 shadow-sm">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-800 transition-colors duration-200">予約</h3>
                <p className="text-base text-gray-600 leading-relaxed">すべての予約を確認・管理</p>
              </div>
            </a>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
