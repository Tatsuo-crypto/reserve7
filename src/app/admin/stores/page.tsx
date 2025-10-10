'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Store = {
  id: string
  name: string
  email?: string | null
  calendar_id: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  memberCount?: number
}

export default function StoresPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [stores, setStores] = useState<Store[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const SHOW_FILTERS = false

  const listUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (query.trim()) params.set('query', query.trim())
    const qs = params.toString()
    return `/api/admin/stores${qs ? `?${qs}` : ''}`
  }, [status, query])

  const fetchList = async () => {
    try {
      setLoading(true)
      const res = await fetch(listUrl, { credentials: 'include' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setStores(data.stores || [])
    } catch (e) {
      console.error('Failed to fetch stores:', e)
      setStores([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [listUrl])

  // modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Store | null>(null)
  const [form, setForm] = useState<{ name: string; email?: string; calendarId: string; status: 'active' | 'inactive' }>({
    name: '',
    email: '',
    calendarId: '',
    status: 'active',
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', email: '', calendarId: '', status: 'active' })
    setModalOpen(true)
  }

  const openEdit = (s: Store) => {
    setEditing(s)
    setForm({ name: s.name, email: s.email || '', calendarId: s.calendar_id, status: s.status })
    setModalOpen(true)
  }

  const saveStore = async () => {
    try {
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `/api/admin/stores/${editing.id}` : '/api/admin/stores'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          calendarId: form.calendarId,
          status: form.status,
        })
      })
      if (!res.ok) {
        const txt = await res.text()
        alert(`保存に失敗しました: ${txt}`)
        return
      }
      setModalOpen(false)
      setEditing(null)
      fetchList()
    } catch (e) {
      console.error(e)
      alert('保存に失敗しました: ネットワークまたはサーバーエラー')
    }
  }

  const toggleActive = async (s: Store) => {
    try {
      const res = await fetch(`/api/admin/stores/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: s.status === 'active' ? 'inactive' : 'active' })
      })
      if (!res.ok) throw new Error(await res.text())
      fetchList()
    } catch (e) {
      console.error(e)
      alert('切替に失敗しました')
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
              <h1 className="text-3xl font-bold text-gray-900">店舗管理</h1>
              <p className="mt-2 text-gray-600">店舗情報の閲覧・管理</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar (centered) */}
      <div className="flex justify-center mb-4">
        <button className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700" onClick={openCreate}>新規店舗</button>
      </div>

      {/* Filters (temporarily hidden) */}
      {SHOW_FILTERS && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-3">
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ステータス</label>
              <select className="w-full border rounded-md px-2 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="all">すべて</option>
                <option value="active">有効（active）</option>
                <option value="inactive">無効（inactive）</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">検索（店舗名・カレンダーID）</label>
              <div className="flex gap-2">
                <input className="flex-1 border rounded-md px-3 py-2 text-sm" placeholder="例: 一号店 or calendar-id@group.calendar.google.com" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button onClick={fetchList} className="px-3 py-2 text-sm rounded-md border bg-gray-50 hover:bg-gray-100">検索</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500 text-sm">読み込み中...</div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">該当の店舗がありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] sm:min-w-[1100px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-center px-3 py-2 border-b whitespace-nowrap min-w-[180px]">店舗名</th>
                    <th className="text-center px-3 py-2 border-b whitespace-nowrap min-w-[220px]">メール</th>
                    <th className="text-center px-3 py-2 border-b whitespace-nowrap min-w-[260px]">カレンダーID</th>
                    <th className="text-center px-3 py-2 border-b whitespace-nowrap min-w-[80px]">会員数</th>
                    <th className="text-center px-3 py-2 border-b whitespace-nowrap min-w-[120px]">ステータス</th>
                    <th className="text-center px-3 py-2 border-b whitespace-nowrap min-w-[160px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border-b whitespace-nowrap text-center">
                        <div className="font-medium text-gray-900 whitespace-nowrap">{s.name}</div>
                      </td>
                      <td className="px-3 py-2 border-b whitespace-nowrap text-center">
                        <div className="text-gray-800 truncate max-w-[240px] mx-auto" title={s.email || ''}>{s.email || '-'}</div>
                      </td>
                      <td className="px-3 py-2 border-b whitespace-nowrap text-center">
                        <div className="text-gray-800 truncate max-w-[300px] mx-auto" title={s.calendar_id}>{s.calendar_id}</div>
                      </td>
                      <td className="px-3 py-2 border-b text-center whitespace-nowrap">
                        <div className="text-gray-900">{s.memberCount ?? 0}</div>
                      </td>
                      <td className="px-3 py-2 border-b whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-200 text-gray-700'}`}>{s.status === 'active' ? '有効' : '無効'}</span>
                      </td>
                      <td className="px-3 py-2 border-b text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 whitespace-nowrap justify-center">
                          <button className="px-2 py-1 text-xs rounded-md border hover:bg-gray-50" onClick={() => openEdit(s)}>編集</button>
                          <button className={`px-2 py-1 text-xs rounded-md border ${s.status === 'active' ? 'hover:bg-red-50' : 'hover:bg-indigo-50'}`} onClick={() => toggleActive(s)}>{s.status === 'active' ? '無効化' : '有効化'}</button>
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
            <h3 className="text-lg font-semibold mb-4">{editing ? '店舗編集' : '新規店舗'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">店舗名</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">カレンダーID</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.calendarId} onChange={(e) => setForm(f => ({ ...f, calendarId: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">店舗メール</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ステータス</label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">有効（active）</option>
                  <option value="inactive">無効（inactive）</option>
                </select>
              </div>
              {/* 電話・住所は今は不要のため非表示 */}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="px-3 py-2 text-sm rounded-md border" onClick={() => setModalOpen(false)}>キャンセル</button>
              <button className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700" onClick={saveStore}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
