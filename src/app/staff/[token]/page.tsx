'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'
import ConsentGate from '@/components/ConsentGate'

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
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || '無効なURLです')
          return
        }
        const data = await response.json()
        
        setStaff(data.trainer)
      } catch (err) {
        console.error('Error:', err)
        setError('認証できませんでした。URLを確認してください。')
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !staff) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <Icon name="warning" size={48} className="text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary mb-2">アクセスエラー</h1>
          <p className="text-text-secondary">{error || '無効なURLです'}</p>
        </div>
      </div>
    )
  }

  return (
    <ConsentGate subjectType="trainer_staff" subjectId={staff?.id}>
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-strong shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-text-primary">T&J GYM - スタッフページ</h1>
            <div className="text-sm text-text-secondary">{staff.name} さん</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/staff/${token}/shifts`)}
            className="w-full flex-col items-start justify-start gap-0 bg-surface-raised p-8 rounded-2xl shadow-md border border-border-strong hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-500/15 rounded-lg flex items-center justify-center mr-4">
                <Icon name="clock" size={24} className="text-brand-400" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">シフト</h2>
            </div>
            <p className="text-text-secondary">希望提出・確定シフトの確認</p>
          </Button>

          {/* 予約管理カード */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/staff/${token}/reservations`)}
            className="w-full flex-col items-start justify-start gap-0 bg-surface-raised p-8 rounded-2xl shadow-md border border-border-strong hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-500/15 rounded-lg flex items-center justify-center mr-4">
                <Icon name="calendar" size={24} className="text-brand-400" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">予約管理</h2>
            </div>
            <p className="text-text-secondary">予約の確認・作成・編集・削除</p>
          </Button>
        </div>
      </div>
    </div>
    </ConsentGate>
  )
}
