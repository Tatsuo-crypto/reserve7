import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'T&J GYM (New Home Icon)'
}

export default function HomeIconSetupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">ホーム画面アイコンの更新</h1>
        
        {/* 重要な注意事項 */}
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">まず古いアイコンを削除してください</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>ホーム画面の古い「T&J GYM」アイコンを長押しして削除してください。</p>
              </div>
            </div>
          </div>
        </div>

        {/* 手順 */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">手順</h2>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">1</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">古いアイコンを削除</p>
                  <p className="text-sm text-gray-600 mt-1">ホーム画面の古い「T&J GYM」を長押し → 「Appを削除」</p>
                </div>
              </li>
              
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">2</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Safariのキャッシュをクリア（推奨）</p>
                  <p className="text-sm text-gray-600 mt-1">設定 → Safari → 履歴とWebサイトデータを消去</p>
                </div>
              </li>
              
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">3</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Safariで再度開く</p>
                  <p className="text-sm text-gray-600 mt-1">このページをSafariで開き直す</p>
                </div>
              </li>
              
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">4</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">共有ボタンをタップ</p>
                  <p className="text-sm text-gray-600 mt-1">画面下部の共有アイコン（□↑）をタップ</p>
                </div>
              </li>
              
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">5</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">ホーム画面に追加</p>
                  <p className="text-sm text-gray-600 mt-1">「ホーム画面に追加」を選択して「追加」をタップ</p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* 補足情報 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">💡 ポイント</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 必ずSafariブラウザで開いてください（Chrome等では動作しません）</li>
            <li>• 古いアイコンの削除とキャッシュクリアが重要です</li>
            <li>• 新しいアイコンは白い「T&J」の文字が表示されます</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
