'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

type MaterialGroup = 'all_members' | 'normal_members' | 'diet_members' | 'admins' | 'trainers'

const MATERIAL_GROUP_LABELS: Record<MaterialGroup, string> = {
  all_members: '全会員',
  normal_members: '通常会員',
  diet_members: 'ダイエット会員',
  admins: '管理者',
  trainers: 'トレーナー',
}

type Material = {
  id: string
  title: string
  description: string | null
  materialType: 'pdf' | 'image' | 'video' | 'link'
  isPublished: boolean
  targetGroups: MaterialGroup[]
  targetUserIds: string[]
  targetTrainerIds: string[]
  openUrl: string
}

type MemberOption = { id: string; full_name: string; plan?: string; status?: string }
type TrainerOption = { id: string; full_name: string; status?: string }

const GROUPS = Object.keys(MATERIAL_GROUP_LABELS) as MaterialGroup[]

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value]
}

function inferMaterialType(file: File | null, externalUrl: string): Material['materialType'] {
  if (file) return file.type.startsWith('image/') ? 'image' : 'pdf'
  const normalizedUrl = externalUrl.toLowerCase()
  if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be') || normalizedUrl.includes('vimeo.com')) {
    return 'video'
  }
  return 'link'
}

function fileTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, '')
}

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [trainers, setTrainers] = useState<TrainerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sourceMode, setSourceMode] = useState<'file' | 'url'>('file')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [targetGroups, setTargetGroups] = useState<string[]>(['all_members'])
  const [targetUserIds, setTargetUserIds] = useState<string[]>([])
  const [targetTrainerIds, setTargetTrainerIds] = useState<string[]>([])

  const targetSummary = useMemo(() => {
    const labels = targetGroups.map(group => MATERIAL_GROUP_LABELS[group as MaterialGroup]).filter(Boolean)
    if (targetUserIds.length) labels.push(`会員${targetUserIds.length}名`)
    if (targetTrainerIds.length) labels.push(`トレーナー${targetTrainerIds.length}名`)
    return labels.join('、') || '未設定'
  }, [targetGroups, targetUserIds, targetTrainerIds])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [materialsRes, membersRes, trainersRes] = await Promise.all([
        fetch('/api/admin/materials', { cache: 'no-store' }),
        fetch('/api/admin/members?compact=true&all_stores=true', { cache: 'no-store' }),
        fetch('/api/admin/trainers?status=active', { cache: 'no-store' }),
      ])
      if (materialsRes.ok) {
        const data = await materialsRes.json()
        setMaterials(data.materials || [])
      }
      if (membersRes.ok) {
        const data = await membersRes.json()
        setMembers(data.members || data.data?.members || [])
      }
      if (trainersRes.ok) {
        const data = await trainersRes.json()
        setTrainers(data.trainers || [])
      }
    } catch (err) {
      console.error(err)
      setError('資料を読み込めませんでした。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setSourceMode('file')
    setExternalUrl('')
    setFile(null)
    setTargetGroups(['all_members'])
    setTargetUserIds([])
    setTargetTrainerIds([])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      const inferredType = inferMaterialType(sourceMode === 'file' ? file : null, sourceMode === 'url' ? externalUrl : '')
      formData.set('title', title)
      formData.set('description', description)
      formData.set('materialType', inferredType)
      formData.set('externalUrl', sourceMode === 'url' ? externalUrl : '')
      formData.set('isPublished', 'true')
      formData.set('targetGroups', JSON.stringify(targetGroups))
      formData.set('targetUserIds', JSON.stringify(targetUserIds))
      formData.set('targetTrainerIds', JSON.stringify(targetTrainerIds))
      if (sourceMode === 'file' && file) formData.set('file', file)

      const res = await fetch('/api/admin/materials', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '資料を保存できませんでした。')
        return
      }
      resetForm()
      await fetchData()
    } catch (err) {
      console.error(err)
      setError('資料を保存できませんでした。')
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (material: Material) => {
    const res = await fetch(`/api/admin/materials/${material.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !material.isPublished }),
    })
    if (res.ok) await fetchData()
  }

  const deleteMaterial = async (material: Material) => {
    if (!window.confirm(`「${material.title}」を削除しますか？`)) return
    const res = await fetch(`/api/admin/materials/${material.id}`, { method: 'DELETE' })
    if (res.ok) await fetchData()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-4 pb-28">
      <Card padding="sm">
        <h1 className="text-xl font-semibold text-text-primary">資料管理</h1>
        <p className="mt-1 text-xs text-text-secondary">ファイルかURLを選んで、必要な情報だけ登録します。</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-base p-1">
            <Button
              type="button"
              variant={sourceMode === 'file' ? 'primary' : 'ghost'}
              onClick={() => {
                setSourceMode('file')
                setExternalUrl('')
              }}
              className="rounded-xl"
            >
              ファイル
            </Button>
            <Button
              type="button"
              variant={sourceMode === 'url' ? 'primary' : 'ghost'}
              onClick={() => {
                setSourceMode('url')
                setFile(null)
              }}
              className="rounded-xl"
            >
              URL
            </Button>
          </div>

          {sourceMode === 'file' ? (
            <div>
              <label className="mb-1 block text-xs text-text-secondary">ファイル</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={e => {
                  const nextFile = e.target.files?.[0] || null
                  setFile(nextFile)
                  if (nextFile && !title) setTitle(fileTitle(nextFile))
                }}
                className="w-full rounded-lg border border-border-strong bg-surface-base px-3 py-2 text-sm text-text-primary"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-text-secondary">URL</label>
              <input
                value={externalUrl}
                onChange={e => setExternalUrl(e.target.value)}
                placeholder="YouTube・外部ページなど"
                className="w-full rounded-lg border border-border-strong bg-surface-base px-3 py-2 text-base text-text-primary"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-text-secondary">タイトル</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-border-strong bg-surface-base px-3 py-2 text-base text-text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">メモ</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-border-strong bg-surface-base px-3 py-2 text-base text-text-primary" />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-text-secondary">対象</div>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map(group => (
                <Button
                  key={group}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTargetGroups(prev => toggle(prev, group))}
                  className={`rounded-full border px-3 ${targetGroups.includes(group) ? 'border-brand-500/60 bg-brand-500/15 text-brand-600' : 'border-border-subtle bg-surface-base text-text-secondary'}`}
                >
                  {MATERIAL_GROUP_LABELS[group]}
                </Button>
              ))}
            </div>
            <div className="text-xs text-text-muted">選択中: {targetSummary}</div>
          </div>

          <details className="rounded-xl border border-border-subtle bg-surface-base p-3">
            <summary className="cursor-pointer text-sm text-text-primary">個別会員に追加</summary>
            <div className="mt-3 grid max-h-44 grid-cols-1 gap-2 overflow-y-auto">
              {members.map(member => (
                <label key={member.id} className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={targetUserIds.includes(member.id)} onChange={() => setTargetUserIds(prev => toggle(prev, member.id))} />
                  <span>{member.full_name}</span>
                </label>
              ))}
            </div>
          </details>

          <details className="rounded-xl border border-border-subtle bg-surface-base p-3">
            <summary className="cursor-pointer text-sm text-text-primary">個別トレーナーに追加</summary>
            <div className="mt-3 grid max-h-44 grid-cols-1 gap-2 overflow-y-auto">
              {trainers.map(trainer => (
                <label key={trainer.id} className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={targetTrainerIds.includes(trainer.id)} onChange={() => setTargetTrainerIds(prev => toggle(prev, trainer.id))} />
                  <span>{trainer.full_name}</span>
                </label>
              ))}
            </div>
          </details>

          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</div>}

          <Button type="submit" variant="primary" fullWidth loading={saving}>
            資料を追加
          </Button>
        </form>
      </Card>

      <Card padding="sm">
        <h2 className="text-base font-semibold text-text-primary">登録済み</h2>
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-text-muted">読み込み中...</div>
          ) : materials.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">資料はありません</div>
          ) : materials.map(material => (
            <div key={material.id} className="rounded-xl bg-surface-base px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">{material.title}</div>
                  <div className="mt-0.5 text-xs text-text-muted">{material.isPublished ? '公開中' : '下書き'}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a href={material.openUrl} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-2 text-text-secondary">
                    <Icon name="eye" size={16} />
                  </a>
                  <Button type="button" variant="ghost" size="sm" onClick={() => togglePublished(material)}>
                    {material.isPublished ? '非公開' : '公開'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => deleteMaterial(material)} className="text-red-700">
                    <Icon name="trash" size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
