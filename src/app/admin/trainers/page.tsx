'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useStoreChange } from '@/hooks/useStoreChange'

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
  }>({
    fullName: '',
    email: '',
    storeId: adminStoreId || '',
    status: 'active',
    phone: '',
    notes: '',
    googleCalendarId: ''
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
    setForm({ fullName: '', email: '', storeId: initialStoreId, status: 'active', phone: '', notes: '', googleCalendarId: '' })
    setModalOpen(true)
  }

  const openEdit = (t: Trainer) => {
    setEditing(t)
    setForm({
      fullName: t.full_name,
      email: t.email || '',
      storeId: t.store_id,
      status: t.status,
      phone: t.phone || '',
      notes: t.notes || '',
      googleCalendarId: t.google_calendar_id || ''
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
          googleCalendarId: form.googleCalendarId || null
        })
      })
      if (!res.ok) {
        const t = await res.text()
        alert(`保存に失敗しました: ${t}`)
        return
      }
      setModalOpen(false)
      setEditing(null)
      fetchList()
    } catch (e) {
      console.error(e)
      alert('保存に失敗しました')
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
        alert(`削除に失敗しました: ${t}`)
        return
      }
      setModalOpen(false)
      setEditing(null)
      fetchList()
    } catch (e) {
      console.error(e)
      alert('削除に失敗しました')
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
        alert(`切替に失敗しました: ${txt}`)
        return
      }
      fetchList()
    } catch (e) {
      console.error(e)
      alert('切替に失敗しました')
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
      alert('URLのコピーに失敗しました')
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="absolute left-0 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">トレーナー管理</h1>
            <p className="mt-1 text-sm text-gray-500">トレーナー情報の閲覧・管理</p>
          </div>
          <Link
            href="/admin/stores"
            className="absolute right-0 flex items-center text-sm text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-7 9 7v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 22V12h6v10" />
            </svg>
            店舗
          </Link>
        </div>
      </div>

      {/* Compact toolbar: Filters + New button */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <select
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              value={storeScope}
              onChange={(e) => setStoreScope(e.target.value as 'mine' | 'all')}
            >
              <option value="mine" disabled={!adminStoreId}>自店舗</option>
              <option value="all">全店舗</option>
            </select>
            <select
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="all">全ステータス</option>
              <option value="active">在籍</option>
              <option value="inactive">無効</option>
            </select>
          </div>
          <button
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1"
            onClick={openCreate}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規
          </button>
        </div>
      </div>

      {/* Trainer List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">読み込み中...</div>
        ) : trainers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">該当のトレーナーがいません</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {trainers.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${t.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  <span className="font-medium text-sm text-gray-900 truncate">{t.full_name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{storeNameById[t.store_id] || ''}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {t.access_token && (
                    <button
                      className="px-2 py-1 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      onClick={() => handleCopyAccessUrl(t.access_token!, t.full_name)}
                    >
                      URL
                    </button>
                  )}
                  <button
                    className="px-2 py-1 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    onClick={() => openEdit(t)}
                  >
                    編集
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? 'トレーナー編集' : '新規トレーナー'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">氏名</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" required value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">メール</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">GoogleカレンダーID（任意）</label>
                <input 
                  className="w-full border rounded-md px-3 py-2 text-sm" 
                  placeholder="example@group.calendar.google.com"
                  value={form.googleCalendarId} 
                  onChange={(e) => setForm(f => ({ ...f, googleCalendarId: e.target.value }))} 
                />
                <p className="text-[10px] text-gray-400 mt-1">※設定すると、このトレーナーの予約が自動的にGoogleカレンダーに連携されます。</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">担当店舗</label>
                <select
                  className="w-full border rounded-md px-2 py-2 text-sm"
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
                <label className="block text-xs text-gray-500 mb-1">ステータス</label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">在籍（active）</option>
                  <option value="inactive">無効（inactive）</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">電話</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">メモ</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={3} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="px-3 py-2 text-sm rounded-md border" onClick={() => setModalOpen(false)}>キャンセル</button>
              <button
                className="px-3 py-2 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={deleteTrainer}
                disabled={!editing}
              >削除</button>
              <button
                className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={saveTrainer}
                disabled={!form.fullName.trim() || !form.storeId.trim()}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
