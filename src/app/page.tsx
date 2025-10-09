'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const { data: session } = useSession()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(userAgent))
    }
    checkMobile()
  }, [])

  // If mobile device, show simple message
  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">T&J GYM</h1>
          <p className="text-gray-600 mb-6">
            専用URLからアクセスしてください
          </p>
          <p className="text-sm text-gray-500">
            管理者の方は、PCからログインしてください
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            T&J GYM - ジム予約システム
          </h2>
          <p className="text-gray-600 mb-8">
            複数店舗対応の予約管理システム
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 - Database */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-md mx-auto mb-4">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                データベース機能
              </h3>
              <p className="text-sm text-gray-600">
                店舗別データ分離<br/>
                User・Reservation テーブル<br/>
                calendar_id・store_id対応
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  実装済み
                </span>
              </div>
            </div>

            {/* Feature 2 - Authentication */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-md mx-auto mb-4">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                店舗別認証
              </h3>
              <p className="text-sm text-gray-600">
                メール自動判定<br/>
                1号店・2号店分離<br/>
                管理者権限制御
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  実装済み
                </span>
              </div>
            </div>

            {/* Feature 3 - Reservations */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-md mx-auto mb-4">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                予約管理
              </h3>
              <p className="text-sm text-gray-600">
                店舗別予約管理<br/>
                柔軟なセッション時間<br/>
                自動タイトル生成
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  実装済み
                </span>
              </div>
            </div>

            {/* Feature 4 - Google Calendar */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-md mx-auto mb-4">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                複数カレンダー連動
              </h3>
              <p className="text-sm text-gray-600">
                1号店・2号店カレンダー<br/>
                自動イベント同期<br/>
                Asia/Tokyo設定
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  実装済み
                </span>
              </div>
            </div>
          </div>

          {/* Current Status */}
          {session ? (
            <div className="mt-8 p-4 bg-green-50 rounded-lg">
              <h4 className="text-sm font-medium text-green-900 mb-2">
                システム稼働中 - 全機能実装完了
              </h4>
              <p className="text-sm text-green-700">
                {session.user.name}さん（{session.user.role === 'ADMIN' ? '管理者' : '会員'}）としてログイン中です。<br/>
                <Link href="/reservations" className="font-medium underline">
                  予約管理へ移動
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                システム稼働中 - 全機能実装完了
              </h4>
              <p className="text-sm text-blue-700 mb-4">
                T&J GYM複数店舗対応システムが完成しました。会員登録またはログインしてください。
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  href="/register"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  会員登録
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  ログイン
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
