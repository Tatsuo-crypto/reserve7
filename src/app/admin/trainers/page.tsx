'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
}

type StoreOption = {
  id: string
  name: string
  calendar_id: string
}

export default function TrainersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { currentStoreId } = useStoreChange()
  const adminStoreId = currentStoreId || (session as any)?.user?.storeId || ''

  const [loading, setLoading] = useState(false)
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [storeScope, setStoreScope] = useState<'mine' | 'all'>(adminStoreId ? 'mine' : 'all')

  // store options for dropdown
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([])
  const storeNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of storeOptions) m[s.calendar_id] = s.name
    return m
  }, [storeOptions])

  // modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Trainer | null>(null)
  const [form, setForm] = useState<{ fullName: string; email: string; storeId: string; status: 'active' | 'inactive'; phone?: string; notes?: string }>({
    fullName: '',
    email: '',
    storeId: adminStoreId || '',
    status: 'active',
    phone: '',
    notes: ''
  })

  const listUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (storeScope === 'mine' && adminStoreId) params.set('storeId', adminStoreId)
    if (status !== 'all') params.set('status', status)
    if (query.trim()) params.set('query', query.trim())
    const qs = params.toString()
    return `/api/admin/trainers${qs ? `?${qs}` : ''}`
  }, [adminStoreId, storeScope, status, query])

  const fetchList = async () => {
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
        if (!form.storeId && stores[0]?.calendar_id) {
          setForm(f => ({ ...f, storeId: stores[0].calendar_id }))
        }
      } catch { }
    }
    fetchStores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    const initialStoreId = adminStoreId || storeOptions[0]?.calendar_id || ''
    setForm({ fullName: '', email: '', storeId: initialStoreId, status: 'active', phone: '', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (t: Trainer) => {
    setEditing(t)
    setForm({
      fullName: t.full_name,
      email: t.email,
      storeId: t.store_id,
      status: t.status,
      phone: t.phone || '',
      notes: t.notes || ''
    })
    setModalOpen(true)
  }

  const saveTrainer = async () => {
    try {
      const fullName = form.fullName.trim()
      const email = form.email.trim()
      const storeId = form.storeId.trim()
      if (!fullName || !email || !storeId) {
        if (!fullName) alert('氏名は必須です')
        else if (!email) alert('メールは必須です')
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
          notes: form.notes || null
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
      {/* Header - centered with back chevron */}
      <div className="mb-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-center relative">
            <button
              onClick={() => router.push('/dashboard')}
              className="absolute left-0 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="戻る"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">トレーナー管理</h1>
              <p className="mt-2 text-gray-600">トレーナー情報の閲覧・管理</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar (centered) */}
      <div className="flex justify-center mb-4">
        <button
          className="inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={openCreate}
        >
          新規トレーナー
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-3">
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">店舗</label>
            <select
              className="w-full border rounded-md px-2 py-2 text-sm"
              value={storeScope}
              onChange={(e) => setStoreScope(e.target.value as 'mine' | 'all')}
            >
              <option value="mine" disabled={!adminStoreId}>自店舗のみ{!adminStoreId ? '（未設定）' : ''}</option>
              <option value="all">全店舗</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">在籍状況</label>
            <select
              className="w-full border rounded-md px-2 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="all">すべて</option>
              <option value="active">在籍（active）</option>
              <option value="inactive">無効（inactive）</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">検索（名前・メール）</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="例: 田中 or tanaka@example.com"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={fetchList} className="px-3 py-2 text-sm rounded-md border bg-gray-50 hover:bg-gray-100">検索</button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500 text-sm">読み込み中...</div>
          ) : trainers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">該当のトレーナーがいません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[960px] sm:min-w-[1100px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left px-3 py-2 border-b whitespace-nowrap min-w-[160px]">名前</th>
                    <th className="text-left px-3 py-2 border-b whitespace-nowrap min-w-[240px]">メール</th>
                    <th className="text-left px-3 py-2 border-b whitespace-nowrap min-w-[240px]">担当店舗</th>
                    <th className="text-left px-3 py-2 border-b whitespace-nowrap min-w-[100px]">ステータス</th>
                    <th className="text-right px-3 py-2 border-b whitespace-nowrap min-w-[120px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border-b whitespace-nowrap">
                        <div className="font-medium text-gray-900">{t.full_name}</div>
                        {t.phone ? <div className="text-gray-500 text-xs">{t.phone}</div> : null}
                      </td>
                      <td className="px-3 py-2 border-b whitespace-nowrap">
                        <div className="text-gray-800 truncate max-w-[260px]" title={t.email}>{t.email}</div>
                      </td>
                      <td className="px-3 py-2 border-b whitespace-nowrap">
                        <div className="text-gray-800 truncate max-w-[260px]" title={storeNameById[t.store_id] || t.store_id}>
                          {storeNameById[t.store_id] || t.store_id}
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>{t.status === 'active' ? '在籍' : '無効'}</span>
                      </td>
                      <td className="px-3 py-2 border-b text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {t.access_token && (
                            <button
                              className="px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                              onClick={() => handleCopyAccessUrl(t.access_token!, t.full_name)}
                              title="専用URLをコピー"
                            >
                              URL
                            </button>
                          )}
                          <button className="px-2 py-1 text-xs rounded-md border hover:bg-gray-50" onClick={() => openEdit(t)}>編集</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                <input className="w-full border rounded-md px-3 py-2 text-sm" type="email" required value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
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
                        <option key={s.id} value={s.calendar_id}>{s.name}</option>
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
                disabled={!form.fullName.trim() || !form.email.trim() || !form.storeId.trim()}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
