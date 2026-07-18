'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import Icon from '@/components/ui/icons'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return 'サーバーの設定に問題があります。'
      case 'AccessDenied':
        return 'アクセスが拒否されました。'
      case 'Verification':
        return 'ログイン情報を確認できませんでした。'
      case 'Default':
      default:
        return 'ログインできませんでした。'
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-base pt-20 pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-4">
        <div>
          <h2 className="text-center text-3xl font-normal text-text-primary">
            T&J GYM
          </h2>
          <p className="mt-1 text-center text-lg text-text-secondary">
            ログインできませんでした
          </p>
        </div>

        <div className="rounded-lg bg-red-500/15 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="xCircle" size={20} className="text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-normal text-red-300">
                {getErrorMessage(error)}
              </h3>
              <div className="mt-2 text-sm text-red-300">
                <p>もう一度ログインをお試しください。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link 
            href="/login" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-normal rounded-lg text-white bg-brand-700 hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
          >
            ログインページに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
}
