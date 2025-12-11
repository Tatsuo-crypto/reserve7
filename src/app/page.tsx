'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // ログイン済みの場合はダッシュボードへ
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
    // 未ログインの場合はログインページへ
    else if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // ローディング中の表示（リダイレクト処理中）
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">読み込み中...</p>
      </div>
    </div>
  )
}
