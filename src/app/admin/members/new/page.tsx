'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PLAN_LIST } from '@/lib/constants'

export default function NewMemberPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stores, setStores] = useState<{ id: string, name: string }[]>([])
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    email: '',
    storeId: '',
    plan: '月4回',
    monthlyFee: '',
    startMonth: '',
    registrationDate: new Date().toISOString().split('T')[0],
    status: 'active',
    memo: '',
    onlineReminderEnabled: true,
    pushNotificationEnabled: false,
    birthDate: '',
    gender: '',
    heightCm: '',
    activityLevel: '',
    targetWeightKg: '',
  })

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [status, session, router])

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
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormData(prev => {
      const newData = { ...prev, [name]: val }
      // If status changed to suspended or withdrawn, set fee to 0
      if (name === 'status' && (value === 'suspended' || value === 'withdrawn')) {
        newData.monthlyFee = '0'
        newData.onlineReminderEnabled = false
        newData.pushNotificationEnabled = false
      }
      return newData
    })
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 relative flex items-center justify-center">
        <button
          onClick={() => router.back()}
          className="absolute left-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="戻る"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-normal text-gray-900">新規会員追加</h1>
          <p className="mt-1 text-sm text-gray-600">会員情報を入力してください</p>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 氏名（苗字・名前） */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lastName" className="block text-sm font-normal text-gray-700 mb-2">
                苗字（任意）
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="山田"
              />
            </div>
            <div>
              <label htmlFor="firstName" className="block text-sm font-normal text-gray-700 mb-2">
                名前（任意）
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="太郎"
              />
            </div>
          </div>

          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="block text-sm font-normal text-gray-700 mb-2">
              メールアドレス（任意）
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="example@email.com"
            />
            <p className="mt-1 text-sm text-gray-500">会員専用URLの発行にはメールアドレスが必要ですが、空欄でも登録可能です（システムがダミーアドレスを生成します）</p>
          </div>

          {/* 店舗 */}
          <div>
            <label htmlFor="storeId" className="block text-sm font-normal text-gray-700 mb-2">
              店舗 <span className="text-red-500">*</span>
            </label>
            <select
              id="storeId"
              name="storeId"
              value={formData.storeId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">店舗を選択してください</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* 入会時プラン */}
          <div>
            <label htmlFor="plan" className="block text-sm font-normal text-gray-700 mb-2">
              入会時プラン
            </label>
            <select
              id="plan"
              name="plan"
              value={formData.plan}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {// @ts-ignore
                PLAN_LIST.map(plan => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
            </select>
          </div>

          {/* 入会時月会費 */}
          <div>
            <label htmlFor="monthlyFee" className="block text-sm font-normal text-gray-700 mb-2">
              入会時月会費（円）
            </label>
            <input
              type="number"
              id="monthlyFee"
              name="monthlyFee"
              value={formData.monthlyFee}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="13200"
            />
            <p className="mt-1 text-sm text-gray-500">空欄の場合は0円として登録されます</p>
          </div>

          {/* 開始月 */}
          <div>
            <label htmlFor="startMonth" className="block text-sm font-normal text-gray-700 mb-2">
              開始月
            </label>
            <input
              type="month"
              id="startMonth"
              name="startMonth"
              value={formData.startMonth}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              指定した月から売上に計上されます。
            </p>
          </div>

          {/* 登録日 */}
          <div>
            <label htmlFor="registrationDate" className="block text-sm font-normal text-gray-700 mb-2">
              登録日
            </label>
            <input
              type="date"
              id="registrationDate"
              name="registrationDate"
              value={formData.registrationDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* ステータス */}
          <div>
            <label htmlFor="status" className="block text-sm font-normal text-gray-700 mb-2">
              ステータス
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="active">有効</option>
              <option value="suspended">休会</option>
              <option value="withdrawn">退会</option>
            </select>
          </div>

          {/* ダイエット基礎情報 */}
          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-lg font-normal text-gray-900 mb-2">ダイエット基礎情報</h3>
            <p className="text-xs text-gray-500 mb-4">カロリー計算に使う情報です。ダイエット対象者だけ入力すれば大丈夫です。</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birthDate" className="block text-sm font-normal text-gray-700 mb-2">生年月日</label>
                <input
                  type="date"
                  id="birthDate"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-normal text-gray-700 mb-2">性別</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">未設定</option>
                  <option value="female">女性</option>
                  <option value="male">男性</option>
                </select>
              </div>
              <div>
                <label htmlFor="heightCm" className="block text-sm font-normal text-gray-700 mb-2">身長(cm)</label>
                <input
                  type="number"
                  id="heightCm"
                  name="heightCm"
                  value={formData.heightCm}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="160"
                />
              </div>
              <div>
                <label htmlFor="targetWeightKg" className="block text-sm font-normal text-gray-700 mb-2">目標体重(kg)</label>
                <input
                  type="number"
                  id="targetWeightKg"
                  name="targetWeightKg"
                  value={formData.targetWeightKg}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="55"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="activityLevel" className="block text-sm font-normal text-gray-700 mb-2">活動量</label>
                <select
                  id="activityLevel"
                  name="activityLevel"
                  value={formData.activityLevel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">未設定</option>
                  <option value="1.2">低い: デスクワーク中心</option>
                  <option value="1.375">やや低い: 週1〜3回運動</option>
                  <option value="1.55">普通: 週3〜5回運動</option>
                  <option value="1.725">高い: 週6回以上運動</option>
                  <option value="1.9">非常に高い: 肉体労働・アスリート</option>
                </select>
              </div>
            </div>
          </div>

          {/* 通知設定 */}
          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-lg font-normal text-gray-900 mb-4">通知設定</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-4 p-4 bg-brand-50/50 border border-brand-100 rounded-xl cursor-pointer hover:bg-brand-50 transition-colors">
                <input
                  type="checkbox"
                  id="onlineReminderEnabled"
                  name="onlineReminderEnabled"
                  checked={formData.onlineReminderEnabled}
                  onChange={handleChange}
                  className="w-6 h-6 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                />
                <div>
                  <div className="font-normal text-gray-900">メール通知（予約確定・変更・リマインダー）を送信する</div>
                  <div className="text-xs text-gray-500 mt-1">チェックを外すと、この会員様宛のすべての自動通知メールが停止されます。</div>
                </div>
              </label>
              <label className="flex items-center gap-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                <input
                  type="checkbox"
                  id="pushNotificationEnabled"
                  name="pushNotificationEnabled"
                  checked={formData.pushNotificationEnabled}
                  onChange={handleChange}
                  className="w-6 h-6 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <div>
                  <div className="font-normal text-gray-900">プッシュ通知（アプリ通知）を送信する</div>
                  <div className="text-xs text-gray-500 mt-1">お客様がアプリ通知を許可している場合に、スマホへ通知します。</div>
                </div>
              </label>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label htmlFor="memo" className="block text-sm font-normal text-gray-700 mb-2">
              メモ（任意）
            </label>
            <textarea
              id="memo"
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '追加中...' : '会員を追加'}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-brand-50 border border-brand-200 rounded-lg p-4">
          <h3 className="text-sm font-normal text-brand-900 mb-2">会員追加について</h3>
          <ul className="text-sm text-brand-800 space-y-1">
            <li>• 会員追加後、会員管理ページから専用URLを発行できます</li>
            <li>• メールアドレスは専用URL発行時に必要です</li>
            <li>• プランとステータスは後から変更できます</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
