'use client'

import Link from 'next/link'

export default function TrainersPage() {
  return (
    <div className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-6">
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">トレーナー管理</h1>
            <p className="mt-1 text-sm text-gray-600">トレーナー情報の閲覧・管理</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              戻る
            </Link>
            <button
              className="inline-flex items-center px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => alert('トレーナー新規作成ダイアログ（今はプレースホルダー）')}
            >
              新規トレーナー
            </button>
          </div>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <div className="text-gray-700">
          <p className="mb-4">このページでは、以下の機能を追加予定です：</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>トレーナー一覧の表示（名前・メール・担当店舗・ステータス）</li>
            <li>新規作成 / 編集 / 無効化</li>
            <li>検索・フィルタ（店舗、在籍状況）</li>
          </ul>
        </div>
        <div className="mt-6 p-4 rounded-md border border-dashed border-emerald-300 bg-emerald-50 text-emerald-800 text-sm">
          現在はプレースホルダーです。要件に合わせてテーブルやフォームを実装します。
        </div>
      </div>
    </div>
  )
}
