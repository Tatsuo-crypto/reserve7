'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useStoreChange } from '@/hooks/useStoreChange'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'
import AppModal from '@/components/ui/AppModal'

type Trainer = {
  id: string
  full_name: string
  email: string
  store_id: string
  status: 'active' | 'inactive'
  phone?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  access_token?: string
  google_calendar_id?: string | null
  payroll_enabled?: boolean
  daily_transportation_cost?: number
  trainer_pay_rates?: {
    id: string
    hourly_wage: number
    effective_from: string
    effective_to?: string | null
  }[]
}

type StoreOption = {
  id: string
  name: string
  calendar_id: string
}

export default function TrainersPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const { currentStoreId } = useStoreChange()
  const adminStoreId = currentStoreId || (session as any)?.user?.storeId || ''

  // Check admin access
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (sessionStatus === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (sessionStatus === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [sessionStatus, session, router])

  const [loading, setLoading] = useState(false)
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [storeScope, setStoreScope] = useState<'mine' | 'all'>(adminStoreId ? 'mine' : 'all')

  // store options for dropdown
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([])
  const storeNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of storeOptions) m[s.id] = s.name
    return m
  }, [storeOptions])

  // Sync storeScope when adminStoreId changes (e.g. store switching in header)
  // Use a ref to track the last TRUTHY store ID to avoid resetting on flickers (e.g. id -> null -> id)
  const lastTruthyStoreId = useRef(adminStoreId)

  useEffect(() => {
    if (adminStoreId) {
        // If we have a previous ID and the new one is the same, it might be a flicker recovery.
        // In that case, we do NOT want to reset storeScope (preserve 'all' if user set it).
        if (lastTruthyStoreId.current && adminStoreId === lastTruthyStoreId.current) {
            return
        }
        
        // Genuine store change (or initial load), reset scope to current store
        setStoreScope('mine')
        lastTruthyStoreId.current = adminStoreId
    }
  }, [adminStoreId])

  // modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Trainer | null>(null)
  const [form, setForm] = useState<{
    fullName: string
    email: string
    storeId: string
    status: 'active' | 'inactive'
    phone?: string
    notes?: string
    googleCalendarId?: string
    payrollEnabled: boolean
    hourlyWage: string
    hourlyWageEffectiveFrom: string
    dailyTransportationCost: string
  }>({
    fullName: '',
    email: '',
    storeId: adminStoreId || '',
    status: 'active',
    phone: '',
    notes: '',
    googleCalendarId: '',
    payrollEnabled: false,
    hourlyWage: '',
    hourlyWageEffectiveFrom: new Date().toISOString().slice(0, 10),
    dailyTransportationCost: '0'
  })

  const listUrl = useMemo(() => {
    const params = new URLSearchParams()
    
    if (storeScope === 'mine') {
      // If filtering by 'mine', we MUST have an adminStoreId. 
      // If it's missing (loading or not set), return null to skip fetch or handle empty.
      if (!adminStoreId) return null
      params.set('storeId', adminStoreId)
    }
    
    if (status !== 'all') params.set('status', status)
    if (query.trim()) params.set('query', query.trim())
    const qs = params.toString()
    return `/api/admin/trainers${qs ? `?${qs}` : ''}`
  }, [adminStoreId, storeScope, status, query])

  const fetchList = async () => {
    if (storeScope === 'mine' && !adminStoreId) {
      setTrainers([]) // Clear list if we want 'mine' but have no ID
      return
    }
    if (!listUrl) return

    try {
      setLoading(true)
      const res = await fetch(listUrl, { credentials: 'include' })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t)
      }
      const data = await res.json()
      setTrainers(data.trainers || [])
    } catch (e) {
      console.error('Failed to fetch trainers:', e)
      setTrainers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl])

  // fetch stores for dropdown (active only)
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch('/api/admin/stores?status=active', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const stores: StoreOption[] = (data.stores || []).map((s: any) => ({ id: s.id, name: s.name, calendar_id: s.calendar_id }))
        setStoreOptions(stores)
        // If creating and no store selected, pick first
        if (!form.storeId && stores[0]?.id) {
          setForm(f => ({ ...f, storeId: stores[0].id }))
        }
      } catch { }
    }
    fetchStores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    const initialStoreId = adminStoreId || storeOptions[0]?.id || ''
    setForm({
      fullName: '',
      email: '',
      storeId: initialStoreId,
      status: 'active',
      phone: '',
      notes: '',
      googleCalendarId: '',
      payrollEnabled: false,
      hourlyWage: '',
      hourlyWageEffectiveFrom: new Date().toISOString().slice(0, 10),
      dailyTransportationCost: '0'
    })
    setModalOpen(true)
  }

  const openEdit = (t: Trainer) => {
    setEditing(t)
    const latestRate = [...(t.trainer_pay_rates || [])]
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
    setForm({
      fullName: t.full_name,
      email: t.email || '',
      storeId: t.store_id,
      status: t.status,
      phone: t.phone || '',
      notes: t.notes || '',
      googleCalendarId: t.google_calendar_id || '',
      payrollEnabled: t.payroll_enabled === true,
      hourlyWage: latestRate?.hourly_wage ? String(latestRate.hourly_wage) : '',
      hourlyWageEffectiveFrom: latestRate?.effective_from || new Date().toISOString().slice(0, 10),
      dailyTransportationCost: String(t.daily_transportation_cost || 0)
    })
    setModalOpen(true)
  }

  const saveTrainer = async () => {
    try {
      const fullName = form.fullName.trim()
      const email = form.email.trim()
      const storeId = form.storeId.trim()
      if (!fullName || !storeId) {
        if (!fullName) alert('氏名は必須です')
        else alert('担当店舗は必須です')
        return
      }
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `/api/admin/trainers/${editing.id}` : '/api/admin/trainers'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName,
          email,
          storeId,
          status: form.status,
          phone: form.phone || null,
          notes: form.notes || null,
          googleCalendarId: form.googleCalendarId || null,
          payrollEnabled: form.payrollEnabled,
          hourlyWage: form.hourlyWage ? Number(form.hourlyWage) : undefined,
          hourlyWageEffectiveFrom: form.hourlyWageEffectiveFrom || undefined,
          dailyTransportationCost: Number(form.dailyTransportationCost || 0)
        })
      })
      if (!res.ok) {
        const t = await res.text()
        alert(`保存できませんでした。${t}`)
        return
      }
      setModalOpen(false)
      setEditing(null)
      fetchList()
    } catch (e) {
      console.error(e)
      alert('保存できませんでした。もう一度お試しください。')
    }
  }

  // delete current editing trainer
  const deleteTrainer = async () => {
    if (!editing) return
    if (!confirm('本当に削除しますか？この操作は元に戻せません。')) return
    try {
      const res = await fetch(`/api/admin/trainers/${editing.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const t = await res.text()
        alert(`削除できませんでした。${t}`)
        return
      }
      setModalOpen(false)
      setEditing(null)
      fetchList()
    } catch (e) {
      console.error(e)
      alert('削除できませんでした。もう一度お試しください。')
    }
  }

  const toggleActive = async (t: Trainer) => {
    try {
      const res = await fetch(`/api/admin/trainers/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: t.status === 'active' ? 'inactive' : 'active' })
      })
      if (!res.ok) {
        const txt = await res.text()
        alert(`切り替えできませんでした。${txt}`)
        return
      }
      fetchList()
    } catch (e) {
      console.error(e)
      alert('切り替えできませんでした。もう一度お試しください。')
    }
  }

  // Copy trainer access URL to clipboard
  const handleCopyAccessUrl = async (accessToken: string, trainerName: string) => {
    if (!accessToken) {
      alert('アクセストークンが設定されていません')
      return
    }
    const baseUrl = window.location.origin
    const accessUrl = `${baseUrl}/trainer/${accessToken}`

    try {
      await navigator.clipboard.writeText(accessUrl)
      alert(`「${trainerName}」様の専用URLをコピーしました`)
    } catch (err) {
      console.error('Failed to copy URL:', err)
      alert('URLをコピーできませんでした。もう一度お試しください。')
    }
  }

  const visibleTrainers = trainers
  const activeTrainers = visibleTrainers.filter(t => t.status === 'active')
  const storeCounts = activeTrainers.reduce((acc, trainer) => {
    const storeName = storeNameById[trainer.store_id] || '未設定'
    acc[storeName] = (acc[storeName] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const sortedStoreNames = Object.keys(storeCounts).sort()

  return (
    <div className="min-h-screen bg-surface-base pt-4 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-subtle">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-normal text-text-muted uppercase tracking-widest mb-1">現在の在籍トレーナー</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-text-primary tracking-tight tabular-nums">{activeTrainers.length}</span>
                  <span className="text-sm font-normal text-text-muted">名</span>
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={openCreate}
                aria-label="新規登録"
                className="h-12 w-12 shrink-0 rounded-full p-0 shadow-md active:scale-95"
              >
                <Icon name="plus" size={28} />
              </Button>
            </div>
          </div>
          <div className="md:col-span-3 bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-subtle">
            <div className="text-xs font-normal text-text-muted uppercase tracking-widest mb-4">店舗別内訳</div>
            <div className="flex flex-wrap gap-2">
              {sortedStoreNames.length > 0 ? sortedStoreNames.map(storeName => (
                <div key={storeName} className="bg-surface-base rounded-lg px-3 py-1.5 border border-border-subtle flex items-center gap-2">
                  <span className="text-xs font-normal text-text-secondary">{storeName}</span>
                  <span className="text-sm font-normal text-text-primary tabular-nums">{storeCounts[storeName]}</span>
                </div>
              )) : (
                <span className="text-xs text-text-muted">在籍トレーナーはいません</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-2xl p-4 shadow-sm border border-border-subtle mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="ui-control-nowrap h-11 rounded-2xl border border-border-subtle bg-surface-base px-4 pr-9 text-xs font-normal text-text-primary outline-none transition-colors focus:border-brand-500"
              value={storeScope}
              onChange={(e) => setStoreScope(e.target.value as 'mine' | 'all')}
            >
              <option value="mine" disabled={!adminStoreId}>自店舗</option>
              <option value="all">全店舗</option>
            </select>
            <div className="flex items-center gap-3 bg-surface-base p-1.5 rounded-2xl border border-border-subtle w-fit">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStatus('active')}
                className={`ui-control-nowrap min-w-[84px] px-5 py-3 rounded-2xl text-xs font-normal transition-all ${status === 'active' ? 'bg-surface-raised text-brand-600 shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                在籍のみ
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStatus('all')}
                className={`ui-control-nowrap min-w-[84px] px-5 py-3 rounded-2xl text-xs font-normal transition-all ${status === 'all' ? 'bg-surface-raised text-brand-600 shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                全員表示
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
          {loading ? (
            <div className="text-center py-8 text-text-secondary text-sm">読み込み中...</div>
          ) : trainers.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-text-muted font-normal italic">該当のトレーナーがいません</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {trainers.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-brand-500/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${t.status === 'active' ? 'bg-brand-500' : 'bg-surface-overlay'} shadow-sm`} />
                    <div className="min-w-0">
                      <div className="ui-nowrap text-sm font-normal text-text-primary">
                        {t.full_name}
                      </div>
                      <div className="ui-nowrap mt-1 text-xs font-normal text-text-muted">
                        {storeNameById[t.store_id] || '-'}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.access_token && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="ui-control-nowrap min-w-12 rounded-full bg-brand-500/15 px-3 py-1 text-center text-xs font-normal text-brand-300 transition-colors hover:bg-brand-500/25"
                        onClick={() => handleCopyAccessUrl(t.access_token!, t.full_name)}
                      >
                        URL
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ui-control-nowrap min-w-12 rounded-full bg-surface-overlay px-3 py-1 text-center text-xs font-normal text-text-secondary transition-colors hover:bg-surface-overlay"
                      onClick={() => openEdit(t)}
                    >
                      編集
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Modal */}
      {modalOpen && (
        <AppModal
          title={editing ? 'トレーナー編集' : '新規トレーナー'}
          onClose={() => setModalOpen(false)}
          bodyClassName="p-4 sm:p-5"
          footer={(
            <>
              {editing && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto rounded-full px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                  onClick={deleteTrainer}
                >
                  削除
                </Button>
              )}
              <Button type="button" variant="ghost" className="rounded-full px-4 py-2 text-sm text-text-secondary" onClick={() => setModalOpen(false)}>キャンセル</Button>
              <Button
                type="button"
                variant="primary"
                className="rounded-full bg-brand-700 px-5 py-2 text-sm text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveTrainer}
                disabled={!form.fullName.trim() || !form.storeId.trim()}
              >
                保存
              </Button>
            </>
          )}
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">氏名</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" required value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">メール</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">GoogleカレンダーID（任意）</label>
                <input 
                  className="w-full border rounded-lg px-3 py-2 text-sm" 
                  placeholder="example@group.calendar.google.com"
                  value={form.googleCalendarId} 
                  onChange={(e) => setForm(f => ({ ...f, googleCalendarId: e.target.value }))} 
                />
                <p className="text-xs text-text-muted mt-1">※設定すると、このトレーナーの予約が自動的にGoogleカレンダーに連携されます。</p>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">担当店舗</label>
                <select
                  className="w-full border rounded-lg px-2 py-2 text-sm"
                  required
                  value={form.storeId}
                  onChange={(e) => setForm(f => ({ ...f, storeId: e.target.value }))}
                >
                  {storeOptions.length === 0 ? (
                    <option value="">店舗を読み込み中...</option>
                  ) : (
                    <>
                      {(!form.storeId) && <option value="">店舗を選択してください</option>}
                      {storeOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">ステータス</label>
                <select className="w-full border rounded-lg px-2 py-2 text-sm" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">在籍（active）</option>
                  <option value="inactive">無効（inactive）</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">電話</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">メモ</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="md:col-span-2 border-t border-border-subtle pt-4">
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.payrollEnabled}
                    onChange={(e) => setForm(f => ({ ...f, payrollEnabled: e.target.checked }))}
                  />
                  給与計算対象にする
                </label>
              </div>
              {form.payrollEnabled && (
                <>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">時給</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      type="number"
                      min="0"
                      value={form.hourlyWage}
                      onChange={(e) => setForm(f => ({ ...f, hourlyWage: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">時給の適用開始日</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      type="date"
                      value={form.hourlyWageEffectiveFrom}
                      onChange={(e) => setForm(f => ({ ...f, hourlyWageEffectiveFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">交通費 / 出勤日</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      type="number"
                      min="0"
                      value={form.dailyTransportationCost}
                      onChange={(e) => setForm(f => ({ ...f, dailyTransportationCost: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>
        </AppModal>
      )}
      </div>
    </div>
  )
}
