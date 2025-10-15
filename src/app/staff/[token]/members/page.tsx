'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function StaffMembersPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  useEffect(() => {
    // 既存の会員管理ページにリダイレクト（同じ機能を使用）
    router.push('/admin/members')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
      </div>
    </div>
  )
}
