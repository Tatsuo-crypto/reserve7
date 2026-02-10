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
    googleCalendarEmail: '',
    storeId: '',
    plan: '月4回',
    monthlyFee: '',
    billingStartMonth: '',
    status: 'active',
    memo: '',
    changeDate: new Date().toISOString().split('T')[0],
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
        const response = await fetch(`/api/admin/members/${memberId}`)
        if (response.ok) {
          const result = await response.json()
          const member = result.data || result
          setInitialStatus(member.status || 'active')
          setInitialPlan(member.plan || '月4回')
          setInitialMonthlyFee(member.monthly_fee ? member.monthly_fee.toString() : '')
          
          setFormData({
            fullName: member.full_name || '',
            email: member.email || '',
            googleCalendarEmail: member.google_calendar_email || '',
            storeId: member.store_id || '',
            plan: member.plan || '月4回',
            monthlyFee: member.monthly_fee ? member.monthly_fee.toString() : '',
            billingStartMonth: member.billing_start_month ? String(member.billing_start_month).slice(0, 7) : '',
            status: member.status || 'active',
            memo: member.memo || '',
            changeDate: new Date().toISOString().split('T')[0],
          })
        } else {
          setError('会員情報の取得に失敗しました')
        }
      } catch (error) {
        console.error('Failed to fetch member:', error)
        setError('会員情報の取得中にエラーが発生しました')
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
      const response = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          fullName: formData.fullName,
          email: formData.email,
          googleCalendarEmail: formData.googleCalendarEmail,
          storeId: formData.storeId,
          plan: formData.plan,
          monthlyFee: formData.monthlyFee,
          billingStartMonth: formData.billingStartMonth,
          status: formData.status,
          memo: formData.memo,
          changeDate: formData.changeDate,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert('会員情報を更新しました')
        router.push('/admin/members')
      } else {
        setError(result.error || '会員情報の更新に失敗しました')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('会員情報の更新中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Check if any critical field has changed
  const isStatusChanged = formData.status !== initialStatus
  const isPlanChanged = formData.plan !== initialPlan
  const isFeeChanged = formData.monthlyFee !== initialMonthlyFee
  const isChanged = isStatusChanged || isPlanChanged || isFeeChanged

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
          <h1 className="text-2xl font-bold text-gray-900">会員情報編集</h1>
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
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
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
              {// @ts-ignore
                PLAN_LIST.map(plan => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
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

          {/* 売上計上開始月 */}
          <div>
            <label htmlFor="billingStartMonth" className="block text-sm font-medium text-gray-700 mb-2">
              売上計上開始月（任意）
            </label>
            <input
              type="month"
              id="billingStartMonth"
              name="billingStartMonth"
              value={formData.billingStartMonth}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              指定した月より前の月次売上（見込み/未振込）には含めません。空欄の場合は従来通り在籍開始月ベースで計算します。
            </p>
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

          {/* 変更日 (ステータス・プラン・会費変更時のみ表示) */}
          {isChanged && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <label htmlFor="changeDate" className="block text-sm font-medium text-yellow-800 mb-2">
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
                ※ 指定した日付から新しいステータス・プラン・会費が適用されます。<br />
                例: 1月末でプラン変更・退会 → 「2月1日」を指定<br />
                売上見込みへの反映: 毎月1日時点での情報に基づいて算出されます。
              </p>
            </div>
          )}

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
