import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'T&J GYM (New Home Icon)'
}

export default function HomeIconSetupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">ホーム画面アイコンの更新</h1>
      <ol className="list-decimal pl-5 space-y-2 max-w-md text-gray-700">
        <li>Safariでこのページを開いたまま、共有ボタンをタップ</li>
        <li>「ホーム画面に追加」を選択</li>
        <li>作成されたショートカットが新しいロゴになっていることを確認</li>
      </ol>
      <p className="text-sm text-gray-500">このページはiOSに新しいアイコンを確実に認識させるための専用ページです。</p>
    </main>
  )
}
