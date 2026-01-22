'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TrainerShiftPage from '../TrainerShiftPage'
import { getStoreDisplayName } from '@/lib/auth-utils'

interface Trainer {
  id: string
  name: string
  email: string
  storeId: string
}

export default function ShiftsPage() {
  const params = useParams()
  const token = params?.token as string
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrainer = async () => {
      try {
        const response = await fetch(`/api/auth/trainer-token?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          setTrainer(data.trainer)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchTrainer()
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-100 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-semibold text-gray-900">
              T&J GYM
            </div>
            {trainer && (
              <div className="bg-white border border-gray-300 px-4 py-2 rounded-lg shadow-sm text-sm flex items-center space-x-3">
                <span className="text-gray-700 font-medium">
                  {getStoreDisplayName(trainer.storeId)}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-700 border-blue-300">
                  トレーナー
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative flex items-center justify-center mb-6">
          <Link
            href={`/trainer/${token}`}
            className="absolute left-0 inline-flex items-center text-gray-600 hover:text-gray-900 font-medium text-xl px-2 py-1"
            aria-label="ホームへ戻る"
          >
            ＜
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">シフト管理</h1>
        </div>

        <TrainerShiftPage token={token} trainerName={trainer?.name} />
      </main>
    </div>
  )
}
