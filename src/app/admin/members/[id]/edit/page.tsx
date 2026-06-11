'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PLAN_LIST } from '@/lib/constants'

export default function EditMemberPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string

  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [error, setError] = useState('')
  const [stores, setStores] = useState<{ id: string, name: string }[]>([])
  const [initialStatus, setInitialStatus] = useState('')
  const [initialPlan, setInitialPlan] = useState('')
  const [initialMonthlyFee, setInitialMonthlyFee] = useState('')

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    storeId: '',
    plan: '月4回',
    monthlyFee: '',
    startMonth: '',
    registrationDate: '',
    status: 'active',
    memo: '',
    changeDate: new Date().toISOString().split('T')[0],
    onlineReminderEnabled: false,
    pushNotificationEnabled: false,
    birthDate: '',
    gender: '',
    heightCm: '',
    activityLevel: '',
    targetWeightKg: '',
  })

  const [settings, setSettings] = useState({
    visible_items: { steps: false, sleep: false, water: false, alcohol: false, workout: false },
    visible_tabs: { input: false, analyze: false, progress: false }
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

  // Fetch member data
  useEffect(() => {
    const fetchMember = async () => {
      try {
        const [memberRes, settingsRes] = await Promise.all([
          fetch(`/api/admin/members/${memberId}`),
          fetch(`/api/lifestyle/settings?userId=${memberId}`)
        ])

        if (memberRes.ok) {
          const result = await memberRes.json()
          const member = result.data || result
          setInitialStatus(member.status || 'active')
          setInitialPlan(member.plan || '月4回')
          setInitialMonthlyFee(member.monthly_fee ? member.monthly_fee.toString() : '')

          const startMonth = member.billing_start_month ? member.billing_start_month.substring(0, 7) : ''

          setFormData({
            fullName: member.full_name || '',
            email: member.email || '',
            storeId: member.store_id || '',
            plan: member.plan || '月4回',
            monthlyFee: member.monthly_fee ? member.monthly_fee.toString() : '',
            startMonth: startMonth,
            registrationDate: member.created_at ? member.created_at.split('T')[0] : '',
            status: member.status || 'active',
            memo: member.memo || '',
            changeDate: new Date().toISOString().split('T')[0],
            onlineReminderEnabled: member.online_reminder_enabled || false,
            pushNotificationEnabled: member.push_notification_enabled || false,
            birthDate: member.birth_date || '',
            gender: member.gender || '',
            heightCm: member.height_cm ? member.height_cm.toString() : '',
            activityLevel: member.activity_level ? member.activity_level.toString() : '',
            targetWeightKg: member.target_weight_kg ? member.target_weight_kg.toString() : '',
          })
        }

        if (settingsRes.ok) {
          const { data } = await settingsRes.json()
          if (data) {
            setSettings({
              visible_items: data.visible_items || { steps: true, sleep: true, water: true, alcohol: true, workout: true },
              visible_tabs: data.visible_tabs || { input: true, analyze: true, progress: true }
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch:', error)
        setError('情報の取得中にエラーが発生しました')
      } finally {
        setFetchLoading(false)
      }
    }

    fetchMember()
  }, [memberId])

  // Fetch stores
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch('/api/admin/stores')
        if (response.ok) {
          const result = await response.json()
          const data = result.data || result
          setStores(data.stores || [])
        }
      } catch (error) {
        console.error('Failed to fetch stores:', error)
      }
    }
    fetchStores()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const [memberRes, settingsRes] = await Promise.all([
        fetch('/api/admin/members', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            memberId,
            fullName: formData.fullName,
            email: formData.email,
            storeId: formData.storeId,
            plan: formData.plan,
            monthlyFee: formData.monthlyFee,
            startMonth: formData.startMonth,
            registrationDate: formData.registrationDate,
            status: formData.status,
            memo: formData.memo,
            changeDate: formData.changeDate,
            onlineReminderEnabled: formData.onlineReminderEnabled,
            pushNotificationEnabled: formData.pushNotificationEnabled,
            birthDate: formData.birthDate,
            gender: formData.gender,
            heightCm: formData.heightCm,
            activityLevel: formData.activityLevel,
            targetWeightKg: formData.targetWeightKg,
          }),
        }),
        fetch('/api/lifestyle/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: memberId,
            visibleItems: settings.visible_items,
            visibleTabs: settings.visible_tabs
          })
        })
      ])

      const result = await memberRes.json()

      if (memberRes.ok && settingsRes.ok) {
        alert('会員情報を更新しました')
        router.push('/admin/members')
      } else {
        setError(result.error || '情報の更新に失敗しました')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('情報の更新中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

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

  // Check if any critical field has changed
  const isPlanChanged = formData.plan !== initialPlan
  const isFeeChanged = formData.monthlyFee !== initialMonthlyFee
  const isStatusChanged = formData.status !== initialStatus
  const isChanged = isPlanChanged || isFeeChanged || isStatusChanged

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">会員情報を読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-normal text-gray-900">会員情報編集</h1>
          <p className="mt-2 text-sm text-gray-600">会員情報を更新してください</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 名前 */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-normal text-gray-700 mb-2">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="山田 太郎"
            />
          </div>

          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="block text-sm font-normal text-gray-700 mb-2">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="active">有効</option>
              <option value="suspended">休会</option>
              <option value="withdrawn">退会</option>
            </select>
          </div>

          {/* 変更日 (プラン・会費変更時のみ表示) */}
          {isChanged && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <label htmlFor="changeDate" className="block text-sm font-normal text-yellow-800 mb-2">
                変更適用日
              </label>
              <input
                type="date"
                id="changeDate"
                name="changeDate"
                value={formData.changeDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
              <p className="mt-2 text-sm text-yellow-700">
                ※ 指定した日付から新しいプラン・会費が適用されます。<br />
                例: 1月末でプラン変更 → 「2月1日」を指定<br />
                売上見込みへの反映: 毎月1日時点での情報に基づいて算出されます。
              </p>
            </div>
          )}

          {/* 表示設定 */}
          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-lg font-normal text-gray-900 mb-4">機能表示設定</h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.visible_tabs.input && settings.visible_tabs.analyze && settings.visible_tabs.progress}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setSettings({
                      visible_tabs: { input: isChecked, analyze: isChecked, progress: isChecked },
                      visible_items: { steps: isChecked, sleep: isChecked, water: isChecked, alcohol: isChecked, workout: isChecked }
                    });
                  }}
                  className="w-6 h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-normal text-gray-900">食事管理機能を表示する <span className="text-blue-600 ml-1 text-xs">(ダイエットプラン限定)</span></div>
                  <div className="text-xs text-gray-500 mt-1">「入力・分析・進捗」の全タブと生活記録項目が有効になります</div>
                </div>
              </label>
            </div>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-normal text-gray-700 mb-2">性別</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="flex items-center gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                <input
                  type="checkbox"
                  id="onlineReminderEnabled"
                  name="onlineReminderEnabled"
                  checked={formData.onlineReminderEnabled}
                  onChange={handleChange}
                  className="w-6 h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="特記事項があれば入力してください"
            />
          </div>

          {/* ボタン */}
          <div className="flex justify-center space-x-4">
            <button
              type="button"
              onClick={() => router.push('/admin/members')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '更新中...' : '会員情報を更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
