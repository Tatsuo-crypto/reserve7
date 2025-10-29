'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewMemberPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stores, setStores] = useState<{id: string, name: string}[]>([])
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    email: '',
    googleCalendarEmail: '',
    storeId: '',
    plan: '月4回',
    monthlyFee: '',
    status: 'active',
    memo: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Combine lastName and firstName with a space
      const fullName = `${formData.lastName} ${formData.firstName}`.trim()
      
      const response = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          fullName,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        const errorMsg = result.error || '会員の追加に失敗しました'
        console.error('会員登録エラー:', errorMsg, result)
        setError(errorMsg)
        return
      }

      const result = await response.json()
      console.log('会員登録成功:', result)
      alert('会員を追加しました')
      router.push('/admin/members')
    } catch (error) {
      console.error('Error:', error)
      setError('会員の追加中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // Fetch stores
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch('/api/admin/stores')
        if (response.ok) {
          const result = await response.json()
          const data = result.data || result
          const storesList = data.stores || []
          setStores(storesList)
          // Set first store as default if available
          if (storesList.length > 0) {
            setFormData(prev => ({ ...prev, storeId: storesList[0].id }))
          } else {
            console.error('店舗情報が取得できませんでした')
            setError('店舗情報の読み込みに失敗しました。ページをリロードしてください。')
          }
        } else {
          console.error('Stores API error:', response.status)
          setError('店舗情報の取得に失敗しました')
        }
      } catch (error) {
        console.error('Failed to fetch stores:', error)
        setError('店舗情報の読み込み中にエラーが発生しました')
      }
    }
    fetchStores()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">新規会員追加</h1>
          <p className="mt-2 text-sm text-gray-600">会員情報を入力してください</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 氏名（苗字・名前） */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                苗字 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="山田"
              />
            </div>
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="太郎"
              />
            </div>
          </div>

          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="example@email.com"
            />
            <p className="mt-1 text-sm text-gray-500">会員専用URLの発行に使用されます</p>
          </div>

          {/* Googleカレンダー連携用メールアドレス */}
          <div>
            <label htmlFor="googleCalendarEmail" className="block text-sm font-medium text-gray-700 mb-2">
              Googleカレンダー連携用メールアドレス（任意）
            </label>
            <input
              type="email"
              id="googleCalendarEmail"
              name="googleCalendarEmail"
              value={formData.googleCalendarEmail}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="calendar@gmail.com"
            />
            <p className="mt-1 text-sm text-gray-500">
              設定すると、予約時に会員のGoogleカレンダーにもイベントが追加されます
            </p>
          </div>

          {/* 店舗 */}
          <div>
            <label htmlFor="storeId" className="block text-sm font-medium text-gray-700 mb-2">
              店舗 <span className="text-red-500">*</span>
            </label>
            <select
              id="storeId"
              name="storeId"
              value={formData.storeId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">店舗を選択してください</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* プラン */}
          <div>
            <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-2">
              プラン
            </label>
            <select
              id="plan"
              name="plan"
              value={formData.plan}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="月2回">月2回</option>
              <option value="月4回">月4回</option>
              <option value="月6回">月6回</option>
              <option value="月8回">月8回</option>
              <option value="ダイエットコース【2ヶ月】">ダイエットコース【2ヶ月】</option>
              <option value="ダイエットコース【3ヶ月】">ダイエットコース【3ヶ月】</option>
              <option value="ダイエットコース【6ヶ月】">ダイエットコース【6ヶ月】</option>
              <option value="カウンセリング">カウンセリング</option>
            </select>
          </div>

          {/* 月会費 */}
          <div>
            <label htmlFor="monthlyFee" className="block text-sm font-medium text-gray-700 mb-2">
              月会費（円）
            </label>
            <input
              type="number"
              id="monthlyFee"
              name="monthlyFee"
              value={formData.monthlyFee}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="13200"
            />
            <p className="mt-1 text-sm text-gray-500">空欄の場合は0円として登録されます</p>
          </div>

          {/* ステータス */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              ステータス
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="active">在籍</option>
              <option value="suspended">休会</option>
              <option value="withdrawn">退会</option>
            </select>
          </div>

          {/* メモ */}
          <div>
            <label htmlFor="memo" className="block text-sm font-medium text-gray-700 mb-2">
              メモ（任意）
            </label>
            <textarea
              id="memo"
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="特記事項があれば入力してください"
            />
          </div>

          {/* ボタン */}
          <div className="flex justify-center space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '追加中...' : '会員を追加'}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">会員追加について</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 会員追加後、会員管理ページから専用URLを発行できます</li>
            <li>• メールアドレスは専用URL発行時に必要です</li>
            <li>• プランとステータスは後から変更できます</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
