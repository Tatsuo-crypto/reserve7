'use client'

import { useEffect, useState } from 'react'
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

// AN-4: トレーナー向け会員一覧画面。会員をタップすると会員詳細(カルテ履歴)へ進む。
export default function TrainerMembersPage() {
  const params = useParams()
  const token = params?.token as string
  const [members, setMembers] = useState<MemberRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    const fetchMembers = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ token })
        if (query) params.set('query', query)
        const res = await fetch(`/api/training-records/members?${params.toString()}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setMembers(data.members || [])
        }
      } finally {
        setLoading(false)
      }
    }
    const timer = setTimeout(fetchMembers, 200)
    return () => clearTimeout(timer)
  }, [token, query])

  return (
    <div className="min-h-screen bg-surface-base pb-28">
      <header className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-border-subtle bg-surface-raised/95 backdrop-blur-md">
        <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center px-4">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">会員一覧</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-20">
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-2">
          <Icon name="search" size={18} className="text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="会員名で検索"
            className="w-full bg-transparent text-sm text-text-primary focus:outline-none"
          />
        </div>

        {loading && (
          <div className="rounded-2xl bg-surface-raised px-4 py-5 text-center text-sm text-text-secondary">
            読み込み中...
          </div>
        )}

        {!loading && members.length === 0 && (
          <div className="rounded-2xl bg-surface-raised px-4 py-5 text-center text-sm text-text-secondary">
            会員が見つかりません
          </div>
        )}

        <div className="space-y-2">
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/trainer/${token}/members/${member.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-3 active:scale-[0.99]"
            >
              <div className="min-w-0">
                <div className="ui-nowrap text-sm font-normal text-text-primary">{member.fullName}</div>
                <div className="mt-0.5 text-xs font-normal text-text-muted">
                  {member.plan || '未設定'}{member.storeName ? ` ・ ${member.storeName}` : ''}
                </div>
              </div>
              <Icon name="chevronRight" size={16} className="shrink-0 text-text-muted" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
