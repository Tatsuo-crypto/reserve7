'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/icons'

type MemberRow = {
  id: string
  fullName: string
  plan: string | null
  status: string | null
  storeName: string | null
}

function storeLabel(storeName: string | null) {
  if (!storeName) return '店舗未設定'
  if (storeName.includes('1号')) return '1号店'
  if (storeName.includes('2号')) return '2号店'
  return storeName
}

function statusLabel(status: string | null) {
  if (status === 'inactive') return '休会'
  if (status === 'withdrawn') return '退会'
  return '在籍'
}

function isActive(status: string | null) {
  return !status || status === 'active'
}

// トレーナー向け会員一覧。管理者側と同じ情報のまとまりで、カルテ入力へ進める。
export default function TrainerMembersPage() {
  const params = useParams()
  const token = params?.token as string
  const [members, setMembers] = useState<MemberRow[]>([])
  const [query, setQuery] = useState('')
  const [selectedStore, setSelectedStore] = useState<'1号店' | '2号店'>('1号店')
  const [showOnlyActive, setShowOnlyActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    const fetchMembers = async () => {
      setLoading(true)
      try {
        const searchParams = new URLSearchParams({ token })
        if (query.trim()) searchParams.set('query', query.trim())
        const res = await fetch(`/api/training-records/members?${searchParams.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('request failed')
        const data = await res.json()
        setMembers(data.members || [])
        setError('')
      } catch {
        setError('会員データを取得できませんでした。画面を再読み込みしてください。')
      } finally {
        setLoading(false)
      }
    }
    const timer = setTimeout(fetchMembers, 200)
    return () => clearTimeout(timer)
  }, [token, query])

  const activeMembers = useMemo(() => members.filter(member => isActive(member.status)), [members])
  const visibleMembers = showOnlyActive ? activeMembers : members
  const selectedMembers = useMemo(
    () => visibleMembers.filter(member => storeLabel(member.storeName) === selectedStore),
    [selectedStore, visibleMembers]
  )

  const storeCounts = useMemo(() => {
    const counts = new Map<string, number>([['1号店', 0], ['2号店', 0]])
    activeMembers.forEach(member => {
      const label = storeLabel(member.storeName)
      counts.set(label, (counts.get(label) || 0) + 1)
    })
    return Array.from(counts.entries())
  }, [activeMembers])

  const groupedMembers = useMemo(() => {
    const groups = new Map<string, MemberRow[]>()
    visibleMembers.forEach(member => {
      const label = storeLabel(member.storeName)
      groups.set(label, [...(groups.get(label) || []), member])
    })
    return ['1号店', '2号店', ...Array.from(groups.keys()).filter(label => label !== '1号店' && label !== '2号店')]
      .filter(label => groups.has(label))
      .map(label => ({ label, members: groups.get(label) || [] }))
  }, [visibleMembers])

  return (
    <div className="min-h-screen bg-surface-base pb-28">
      <header className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-border-subtle bg-surface-raised/95 backdrop-blur-md">
        <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center px-4">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">会員</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-6 pt-20">
        <section className="mb-4 rounded-2xl border border-border-subtle bg-surface-raised p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-normal tracking-widest text-text-muted">現在の在籍者</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-normal tabular-nums text-text-primary">{activeMembers.length}</span>
                <span className="text-sm text-text-muted">名</span>
              </div>
            </div>
            <Link
              href="/admin/members/new"
              aria-label="新規登録"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-md transition active:scale-95"
            >
              <Icon name="plus" size={28} />
            </Link>
          </div>
        </section>

        <section className="mb-4 rounded-2xl border border-border-subtle bg-surface-raised p-5">
          <div className="mb-3 text-xs font-normal tracking-widest text-text-muted">店舗別人数</div>
          <div className="grid grid-cols-2 gap-3">
            {storeCounts.length > 0 ? storeCounts.map(([label, count]) => (
              <button
                key={label}
                type="button"
                onClick={() => (label === '1号店' || label === '2号店') && setSelectedStore(label)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${selectedStore === label ? 'border-brand-500 bg-brand-500/10' : 'border-transparent bg-surface-base'}`}
              >
                <div className="text-sm text-text-secondary">{label}</div>
                <div className="mt-1 text-xl font-normal tabular-nums text-text-primary">{count}<span className="ml-1 text-xs text-text-muted">名</span></div>
              </button>
            )) : (
              <div className="col-span-2 rounded-xl bg-surface-base px-4 py-3 text-sm text-text-muted">店舗情報なし</div>
            )}
          </div>
        </section>

        <section className="mb-4 rounded-2xl border border-border-subtle bg-surface-raised p-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-base px-3 py-2">
            <Icon name="search" size={18} className="shrink-0 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="会員名で検索"
              className="min-w-0 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <div className="mx-auto flex w-fit items-center gap-1 rounded-xl border border-border-subtle bg-surface-base p-1">
            <button type="button" onClick={() => setShowOnlyActive(true)} className={`rounded-lg px-4 py-2 text-xs font-normal transition-colors ${showOnlyActive ? 'bg-surface-raised text-brand-500' : 'text-text-muted'}`}>在籍のみ</button>
            <button type="button" onClick={() => setShowOnlyActive(false)} className={`rounded-lg px-4 py-2 text-xs font-normal transition-colors ${!showOnlyActive ? 'bg-surface-raised text-brand-500' : 'text-text-muted'}`}>全員表示</button>
          </div>
        </section>

        {loading && <div className="rounded-2xl border border-border-subtle bg-surface-raised px-4 py-8 text-center text-sm text-text-secondary">読み込み中...</div>}
        {!loading && error && <div className="rounded-2xl border border-border-subtle bg-surface-raised px-4 py-8 text-center text-sm text-text-secondary">{error}</div>}
        {!loading && !error && selectedMembers.length === 0 && <div className="rounded-2xl border border-border-subtle bg-surface-raised px-4 py-8 text-center text-sm text-text-secondary">{selectedStore}の会員が見つかりません</div>}

        {!loading && !error && selectedMembers.length > 0 && (
          <div className="space-y-4">
            {groupedMembers.filter(group => group.label === selectedStore).map(group => (
              <section key={group.label} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
                <div className="flex items-center justify-between border-b border-border-subtle bg-surface-base/50 px-4 py-3">
                  <h2 className="text-base font-normal text-text-primary">{group.label}</h2>
                  <span className="text-sm tabular-nums text-text-muted">{group.members.length}名</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {group.members.map(member => (
                    <Link key={member.id} href={`/trainer/${token}/members/${member.id}`} className="flex min-w-0 items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-brand-500/10 active:bg-brand-500/15">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${isActive(member.status) ? 'bg-brand-500' : 'bg-text-muted'}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-text-primary">{member.fullName}</span>
                          <span className="mt-1 block truncate text-xs text-text-muted">{member.plan || 'プラン未設定'}</span>
                        </span>
                      </span>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs ${isActive(member.status) ? 'bg-brand-500/15 text-brand-500' : 'bg-surface-overlay text-text-muted'}`}>{statusLabel(member.status)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
