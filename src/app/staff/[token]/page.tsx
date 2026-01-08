'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function StaffPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [staff, setStaff] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyStaff = async () => {
      try {
        // トークンで認証
        const response = await fetch(`/api/auth/trainer-token?token=${token}`)
        if (!response.ok) {
          setError('無効なURLです')
          return
        }
        const data = await response.json()
        
        setStaff(data.trainer)
      } catch (err) {
        console.error('Error:', err)
        setError('認証に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      verifyStaff()
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

  if (error || !staff) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">T&J GYM - スタッフページ</h1>
            <div className="text-sm text-gray-600">{staff.name} さん</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 予約管理カード */}
          <button
            onClick={() => router.push(`/staff/${token}/reservations`)}
            className="bg-white p-8 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">予約管理</h2>
            </div>
            <p className="text-gray-600">予約の確認・作成・編集・削除</p>
          </button>
        </div>
      </div>
    </div>
  )
}
