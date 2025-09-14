'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function HomePage() {
  const { data: session } = useSession()

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Reserve7 - ジム予約システム
          </h2>
          <p className="text-gray-600 mb-8">
            段階的に機能を実装していきます
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stage 1 - Database */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-md mx-auto mb-4">
                <span className="text-green-600 font-bold">①</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                データベース機能
              </h3>
              <p className="text-sm text-gray-600">
                User・Reservation テーブル<br/>
                インデックス設定<br/>
                60分固定予約
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  完了
                </span>
              </div>
            </div>

            {/* Stage 2 - Authentication */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-md mx-auto mb-4">
                <span className="text-green-600 font-bold">②</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ログイン機能
              </h3>
              <p className="text-sm text-gray-600">
                新規登録・ログイン<br/>
                権限管理（CLIENT/ADMIN）<br/>
                bcryptハッシュ化
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  完了
                </span>
              </div>
            </div>

            {/* Stage 3 - Reservations */}
            <div className="bg-white p-6 rounded-lg shadow opacity-50">
              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-md mx-auto mb-4">
                <span className="text-gray-600 font-bold">③</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                予約機能
              </h3>
              <p className="text-sm text-gray-600">
                CLIENT：予約一覧のみ<br/>
                ADMIN：全予約＋作成<br/>
                重複防止
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  未実装
                </span>
              </div>
            </div>

            {/* Stage 4 - Google Calendar */}
            <div className="bg-white p-6 rounded-lg shadow opacity-50">
              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-md mx-auto mb-4">
                <span className="text-gray-600 font-bold">④</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                カレンダー連動
              </h3>
              <p className="text-sm text-gray-600">
                ADMIN作成予約のみ<br/>
                自動イベント作成<br/>
                Asia/Tokyo設定
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  未実装
                </span>
              </div>
            </div>
          </div>

          {/* Current Status */}
          {session ? (
            <div className="mt-8 p-4 bg-green-50 rounded-lg">
              <h4 className="text-sm font-medium text-green-900 mb-2">
                Stage ② - ログイン機能（完了）
              </h4>
              <p className="text-sm text-green-700">
                {session.user.name}さん（{session.user.role === 'ADMIN' ? '管理者' : '会員'}）としてログイン中です。<br/>
                <Link href="/dashboard" className="font-medium underline">
                  ダッシュボードへ移動
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Stage ② - ログイン機能（完了）
              </h4>
              <p className="text-sm text-blue-700 mb-4">
                認証システムが実装されました。会員登録またはログインしてください。
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
