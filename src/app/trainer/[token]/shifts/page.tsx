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
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between relative">
          {/* Left: Back Button */}
          <div className="z-10 min-w-[44px]">
            <Link
              href={`/trainer/${token}`}
              className="w-10 h-10 flex items-center justify-center text-blue-500 bg-white rounded-full shadow-sm border border-gray-100 transition-all active:scale-90 hover:bg-gray-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>

          {/* Center: Title */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 className="text-[17px] font-normal text-gray-900 tracking-tight whitespace-nowrap pointer-events-auto">
              シフト管理
            </h1>
          </div>

          {/* Right: Account Pill */}
          <div className="z-10 flex justify-end min-w-[44px]">
            {trainer && (
              <div className="h-10 px-4 flex items-center gap-1 bg-white rounded-full shadow-sm border border-gray-100 transition-all">
                <span className="text-gray-700 text-[13px] font-normal truncate max-w-[100px]">
                  {trainer.name}
                </span>
                <div className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-normal whitespace-nowrap bg-blue-500 text-white">
                  トレーナー
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">

        <TrainerShiftPage token={token} trainerName={trainer?.name} />
      </main>
    </div>
  )
}
