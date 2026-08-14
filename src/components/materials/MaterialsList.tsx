'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

type MaterialItem = {
  id: string
  title: string
  description: string | null
  materialType: 'pdf' | 'image' | 'video' | 'link'
  openUrl: string
}

const TYPE_LABELS: Record<MaterialItem['materialType'], string> = {
  pdf: 'PDF',
  image: '画像',
  video: '動画',
  link: 'リンク',
}

function typeIcon(type: MaterialItem['materialType']) {
  if (type === 'video') return 'video'
  if (type === 'image') return 'photo'
  if (type === 'pdf') return 'documentText'
  return 'share'
}

export function MaterialRow({ item }: { item: MaterialItem }) {
  return (
    <a
      href={item.openUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl bg-surface-base px-3 py-3 active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-overlay text-text-secondary">
          <Icon name={typeIcon(item.materialType) as any} size={18} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary">{item.title}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="shrink-0 rounded-full bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary">
              {TYPE_LABELS[item.materialType]}
            </span>
            {item.description && (
              <span className="truncate text-xs text-text-muted">{item.description}</span>
            )}
          </div>
        </div>
      </div>
      <Icon name="chevronRight" size={16} className="shrink-0 text-text-muted" />
    </a>
  )
}

export default function MaterialsList({
  endpoint,
  limit,
  title = '資料',
  preview = false,
  onOpenAll,
}: {
  endpoint: string
  limit?: number
  title?: string
  preview?: boolean
  onOpenAll?: () => void
}) {
  const [items, setItems] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchMaterials = async () => {
      setLoading(true)
      try {
        const url = limit ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}` : endpoint
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setItems(data.materials || [])
      } catch (error) {
        console.error('Failed to fetch materials:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMaterials()
    return () => { cancelled = true }
  }, [endpoint, limit])

  if (!loading && preview && items.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-left text-xl font-semibold text-text-primary">
          <span className="h-5 w-1 rounded-full bg-brand-500" />
          <span>{title}</span>
        </h2>
        {preview && items.length > 0 && onOpenAll && (
          <Button type="button" variant="ghost" size="sm" onClick={onOpenAll} className="px-2 text-text-secondary">
            すべて
            <Icon name="chevronRight" size={14} />
          </Button>
        )}
      </div>

      <Card padding="sm" className="!p-3">
        {loading ? (
          <div className="py-6 text-center text-xs text-text-muted">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted">資料はありません</div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <MaterialRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </Card>
    </section>
  )
}
