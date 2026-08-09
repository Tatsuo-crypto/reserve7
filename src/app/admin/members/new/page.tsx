'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Button from '@/components/ui/Button'
import { NEW_MEMBER_PLAN_LIST, PLAN_FEES } from '@/lib/constants'

type StoreOption = {
  id: string
  name: string
}

const currentMonth = new Date().toISOString().slice(0, 7)

export default function NewMemberPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stores, setStores] = useState<StoreOption[]>([])
  const [formData, setFormData] = useState({
    fullName: '',
    storeId: '',
    plan: '月4回',
    monthlyFee: '',
    startMonth: currentMonth,
  })

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch('/api/admin/stores')
        if (!response.ok) throw new Error()

        const result = await response.json()
        const data = result.data || result
        const storesList = data.stores || []
        setStores(storesList)

        if (storesList.length > 0) {
          setFormData(prev => ({ ...prev, storeId: storesList[0].id }))
        } else {
          setError('店舗情報を読み込めませんでした。')
        }
      } catch {
        setError('店舗情報を読み込めませんでした。')
      }
    }

    fetchStores()
  }, [])

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'plan' && PLAN_FEES[value] !== undefined ? { monthlyFee: String(PLAN_FEES[value]) } : {}),
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    const fullName = formData.fullName.trim()
    if (!fullName) {
      setError('氏名を入力してください。')
      return
    }
    if (!formData.storeId) {
      setError('店舗を選択してください。')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          storeId: formData.storeId,
          plan: formData.plan,
          monthlyFee: formData.monthlyFee,
          startMonth: formData.startMonth,
          registrationDate: new Date().toISOString().split('T')[0],
          status: 'active',
          onlineReminderEnabled: true,
          pushNotificationEnabled: false,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(result.error || '会員を登録できませんでした。')
        return
      }

      const member = result.data?.member || result.member
      if (!member?.id) {
        setError('登録後の会員情報を取得できませんでした。')
        return
      }

      router.push(`/admin/members/${member.id}`)
    } catch {
      setError('会員を登録できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-text-secondary">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base px-4 pb-28 pt-6">
      <main className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-normal text-text-primary">会員を登録</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-border-subtle bg-surface-raised p-5">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Field label="氏名">
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                autoComplete="name"
                className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-4 text-base text-text-primary outline-none focus:border-brand-500"
                placeholder="山田 太郎"
                required
              />
            </Field>

            <Field label="店舗">
              <select
                name="storeId"
                value={formData.storeId}
                onChange={handleChange}
                className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-4 text-base text-text-primary outline-none focus:border-brand-500"
                required
              >
                <option value="">選択してください</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="プラン">
                <select
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-4 text-base text-text-primary outline-none focus:border-brand-500"
                >
                  {NEW_MEMBER_PLAN_LIST.map(plan => (
                    <option key={plan} value={plan}>{plan}</option>
                  ))}
                </select>
              </Field>

              <Field label="開始月">
                <input
                  type="month"
                  name="startMonth"
                  value={formData.startMonth}
                  onChange={handleChange}
                  className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-4 text-base text-text-primary outline-none focus:border-brand-500"
                />
              </Field>
            </div>

            <Field label="月会費">
              <div className="relative">
                <input
                  type="number"
                  name="monthlyFee"
                  value={formData.monthlyFee}
                  onChange={handleChange}
                  inputMode="numeric"
                  className="h-12 w-full rounded-2xl border border-border-subtle bg-surface-base px-4 pr-12 text-base text-text-primary outline-none focus:border-brand-500"
                  placeholder="13200"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-secondary">円</span>
              </div>
            </Field>
          </div>

          <div className="mt-6 rounded-2xl bg-surface-base px-4 py-3">
            <div className="text-sm text-text-primary">登録後、初期設定へ進みます</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {['招待URL', 'ダイエット', '通知', 'プロフィール'].map(item => (
                <span key={item} className="rounded-full bg-surface-overlay px-3 py-1 text-xs text-text-secondary">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              className="h-12 flex-1 rounded-2xl"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="h-12 flex-1 rounded-2xl"
            >
              {loading ? '登録中...' : '登録'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-normal text-text-secondary">{label}</span>
      {children}
    </label>
  )
}
