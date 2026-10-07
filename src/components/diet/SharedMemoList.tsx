'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'

type SharedMemo = {
  id: string
  body: string
  created_at: string
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export default function SharedMemoList({ endpoint }: { endpoint: string }) {
  const [memos, setMemos] = useState<SharedMemo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchMemos = async () => {
      setLoading(true)
      try {
        const res = await fetch(endpoint, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setMemos(data.memos || [])
      } catch (error) {
        console.error('Failed to fetch shared memos:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMemos()
    return () => { cancelled = true }
  }, [endpoint])

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-left text-xl font-semibold text-text-primary">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        <span>共有メモ</span>
      </h2>

      <Card padding="sm" className="!p-3">
        {loading ? (
          <div className="py-6 text-center text-xs text-text-muted">読み込み中...</div>
        ) : memos.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted">共有メモはありません</div>
        ) : (
          <div className="space-y-2">
            {memos.map(memo => (
              <div key={memo.id} className="rounded-xl bg-surface-base px-3 py-3">
                <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed text-text-primary">{memo.body}</p>
                <p className="mt-2 text-xs font-normal text-text-muted">{formatDate(memo.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  )
}
