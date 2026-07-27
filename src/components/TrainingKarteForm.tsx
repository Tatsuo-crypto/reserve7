'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

type SetRow = {
  key: string
  id?: string
  weight: string
  reps: string
  assisted: boolean
  memo: string
}

type LastRecord = {
  found: boolean
  sessionDate?: string | null
  sets?: { set_number: number; weight: number | null; reps: number | null; assisted: boolean; memo: string | null }[]
}

type ExerciseRow = {
  key: string
  id?: string
  exerciseName: string
  sets: SetRow[]
  lastRecord: LastRecord | null
  lastRecordLoading: boolean
}

interface TrainingKarteFormProps {
  trainerToken?: string | null
  sessionKey: string // 'new' または既存セッションID
  reservationId?: string | null
  userId?: string | null
  backHref: string
}

function genKey() {
  return Math.random().toString(36).slice(2)
}

function withToken(url: string, trainerToken?: string | null) {
  if (!trainerToken) return url
  return url.includes('?') ? `${url}&token=${trainerToken}` : `${url}?token=${trainerToken}`
}

// AN-4: 推定1RM(Epleyの式)。あくまで目安表示で、保存はしない。
function estimate1RM(weight: string, reps: string): number | null {
  const w = Number(weight)
  const r = Number(reps)
  if (!w || !r || Number.isNaN(w) || Number.isNaN(r)) return null
  return Math.round(w * (1 + r / 30) * 10) / 10
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return ''
  try {
    return new Date(`${dateStr}T00:00:00+09:00`).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'Asia/Tokyo',
    })
  } catch {
    return dateStr
  }
}

export default function TrainingKarteForm({ trainerToken, sessionKey, reservationId, userId, backHref }: TrainingKarteFormProps) {
  const router = useRouter()
  const [resolvedId, setResolvedId] = useState<string | null>(sessionKey !== 'new' ? sessionKey : null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [memberName, setMemberName] = useState<string | null>(null)
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userId || null)
  const [trainerName, setTrainerName] = useState<string | null>(null)
  const [sessionDate, setSessionDate] = useState<string | null>(null)
  const [sessionType, setSessionType] = useState('')
  const [approach, setApproach] = useState('')
  const [overallNote, setOverallNote] = useState('')
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [exerciseMasterNames, setExerciseMasterNames] = useState<string[]>([])

  const didInit = useRef(false)

  const loadSessionDetail = useCallback(async (id: string) => {
    const res = await fetch(withToken(`/api/training-records/${id}`, trainerToken), { cache: 'no-store' })
    if (!res.ok) {
      setError('カルテを読み込めませんでした。')
      return
    }
    const data = await res.json()
    setMemberName(data.memberName)
    setResolvedUserId(data.userId || null)
    setTrainerName(data.trainerName)
    setSessionDate(data.sessionDate)
    setSessionType(data.sessionType || '')
    setApproach(data.approach || '')
    setOverallNote(data.overallNote || '')
    setExercises(
      (data.exercises || []).map((ex: any) => ({
        key: genKey(),
        id: ex.id,
        exerciseName: ex.exerciseName,
        sets: (ex.sets || []).map((s: any) => ({
          key: genKey(),
          id: s.id,
          weight: s.weight !== null && s.weight !== undefined ? String(s.weight) : '',
          reps: s.reps !== null && s.reps !== undefined ? String(s.reps) : '',
          assisted: !!s.assisted,
          memo: s.memo || '',
        })),
        lastRecord: null,
        lastRecordLoading: false,
      }))
    )
  }, [trainerToken])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const init = async () => {
      setLoading(true)
      setError(null)
      try {
        if (sessionKey === 'new') {
          const res = await fetch(withToken('/api/training-records', trainerToken), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservationId: reservationId || undefined, userId: userId || undefined }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            setError(data.error || 'カルテを作成できませんでした。')
            return
          }
          const { id } = await res.json()
          setResolvedId(id)
          await loadSessionDetail(id)
        } else {
          setResolvedId(sessionKey)
          await loadSessionDetail(sessionKey)
        }

        const masterRes = await fetch(withToken('/api/training-records/exercise-master', trainerToken), { cache: 'no-store' })
        if (masterRes.ok) {
          const masterData = await masterRes.json()
          setExerciseMasterNames((masterData.exercises || []).map((e: any) => e.name))
        }
      } catch (err) {
        console.error(err)
        setError('カルテを読み込めませんでした。')
      } finally {
        setLoading(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      { key: genKey(), exerciseName: '', sets: [], lastRecord: null, lastRecordLoading: false },
    ])
  }

  const removeExercise = (exKey: string) => {
    setExercises((prev) => prev.filter((e) => e.key !== exKey))
  }

  const updateExerciseName = (exKey: string, name: string) => {
    setExercises((prev) => prev.map((e) => (e.key === exKey ? { ...e, exerciseName: name, lastRecord: null } : e)))
  }

  const fetchLastRecord = async (exKey: string) => {
    const exercise = exercises.find((e) => e.key === exKey)
    if (!exercise || !exercise.exerciseName.trim() || !resolvedUserId) return

    setExercises((prev) => prev.map((e) => (e.key === exKey ? { ...e, lastRecordLoading: true } : e)))

    try {
      const params = new URLSearchParams()
      params.set('userId', resolvedUserId)
      params.set('exerciseName', exercise.exerciseName.trim())
      if (resolvedId) params.set('excludeSessionId', resolvedId)

      const res = await fetch(withToken(`/api/training-records/last-exercise?${params.toString()}`, trainerToken), { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setExercises((prev) => prev.map((e) => (e.key === exKey ? { ...e, lastRecord: data, lastRecordLoading: false } : e)))
    } catch (err) {
      console.error(err)
      setExercises((prev) => prev.map((e) => (e.key === exKey ? { ...e, lastRecordLoading: false } : e)))
    }
  }

  const addSet = (exKey: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exKey
          ? { ...e, sets: [...e.sets, { key: genKey(), weight: '', reps: '', assisted: false, memo: '' }] }
          : e
      )
    )
  }

  const removeSet = (exKey: string, setKey: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.key === exKey ? { ...e, sets: e.sets.filter((s) => s.key !== setKey) } : e))
    )
  }

  const updateSet = (exKey: string, setKey: string, field: keyof SetRow, value: string | boolean) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exKey
          ? { ...e, sets: e.sets.map((s) => (s.key === setKey ? { ...s, [field]: value } : s)) }
          : e
      )
    )
  }

  const handleSave = async () => {
    if (!resolvedId) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        sessionType,
        approach,
        overallNote,
        exercises: exercises
          .filter((e) => e.exerciseName.trim())
          .map((e, index) => ({
            id: e.id,
            exerciseName: e.exerciseName.trim(),
            sortOrder: index,
            sets: e.sets.map((s, setIndex) => ({
              id: s.id,
              setNumber: setIndex + 1,
              weight: s.weight ? Number(s.weight) : null,
              reps: s.reps ? Number(s.reps) : null,
              assisted: s.assisted,
              memo: s.memo || null,
            })),
          })),
      }

      const res = await fetch(withToken(`/api/training-records/${resolvedId}`, trainerToken), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || '保存できませんでした。')
        return
      }

      router.push(backHref)
    } catch (err) {
      console.error(err)
      setError('保存できませんでした。')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!resolvedId) return
    if (!window.confirm('このカルテを削除しますか？この操作は取り消せません。')) return
    setDeleting(true)
    try {
      const res = await fetch(withToken(`/api/training-records/${resolvedId}`, trainerToken), { method: 'DELETE' })
      if (!res.ok) {
        alert('削除できませんでした。')
        return
      }
      router.push(backHref)
    } catch (err) {
      console.error(err)
      alert('削除できませんでした。')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base pb-28 pt-20 text-center text-sm text-text-secondary">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base pb-28">
      <header className="sticky top-0 z-50 h-16 border-b border-border-subtle bg-surface-raised/80 backdrop-blur-md">
        <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center px-4">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="absolute left-4 flex h-10 w-10 items-center justify-center text-text-secondary"
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">トレーニングカルテ</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-5">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <Card padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-normal text-text-muted">会員</div>
              <div className="mt-1 text-xl font-semibold text-text-primary">{memberName || '-'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-normal text-text-muted">日付</div>
              <div className="mt-1 text-sm font-normal text-text-secondary">{formatDate(sessionDate)}</div>
            </div>
          </div>
          <div className="mt-2 text-xs font-normal text-text-muted">担当: {trainerName || '-'}</div>
        </Card>

        <Card padding="sm">
          <label className="block text-sm font-normal text-text-secondary mb-1">セッション種別</label>
          <input
            type="text"
            list="session-type-options"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            placeholder="通常 / 体験 / カウンセリング"
            className="w-full min-w-0 max-w-full box-border rounded-lg border border-border-strong px-3 py-2 text-sm text-text-primary bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <datalist id="session-type-options">
            <option value="通常" />
            <option value="体験" />
            <option value="カウンセリング" />
          </datalist>

          <label className="block text-sm font-normal text-text-secondary mb-1 mt-3">アプローチ</label>
          <textarea
            value={approach}
            onChange={(e) => setApproach(e.target.value)}
            rows={2}
            className="w-full min-w-0 max-w-full box-border rounded-lg border border-border-strong px-3 py-2 text-sm text-text-primary bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        {exercises.map((exercise) => (
          <Card key={exercise.key} padding="sm">
            <div className="flex items-center gap-2">
              <input
                type="text"
                list="exercise-master-options"
                value={exercise.exerciseName}
                onChange={(e) => updateExerciseName(exercise.key, e.target.value)}
                onBlur={() => fetchLastRecord(exercise.key)}
                placeholder="種目名"
                className="flex-1 min-w-0 rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeExercise(exercise.key)}>
                <Icon name="trash" size={16} />
              </Button>
            </div>

            {exercise.lastRecordLoading && (
              <div className="mt-2 text-xs font-normal text-text-muted">前回記録を確認中...</div>
            )}
            {exercise.lastRecord && exercise.lastRecord.found && (
              <div className="mt-2 rounded-lg bg-surface-overlay px-3 py-2 text-xs font-normal text-text-secondary">
                前回({formatDate(exercise.lastRecord.sessionDate)}): {' '}
                {(exercise.lastRecord.sets || [])
                  .map((s) => `${s.weight ?? '-'}kg×${s.reps ?? '-'}回${s.assisted ? '(補助)' : ''}`)
                  .join(' / ')}
              </div>
            )}
            {exercise.lastRecord && !exercise.lastRecord.found && (
              <div className="mt-2 text-xs font-normal text-text-muted">前回記録なし</div>
            )}

            <div className="mt-3 space-y-2">
              {exercise.sets.map((set, setIndex) => {
                const rm = estimate1RM(set.weight, set.reps)
                return (
                  <div key={set.key} className="rounded-lg border border-border-subtle bg-surface-base p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-normal text-text-muted">{setIndex + 1}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={set.weight}
                        onChange={(e) => updateSet(exercise.key, set.key, 'weight', e.target.value)}
                        placeholder="重さ"
                        className="w-16 min-w-0 rounded-lg border border-border-strong px-2 py-1.5 text-sm text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-xs text-text-muted">kg ×</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.reps}
                        onChange={(e) => updateSet(exercise.key, set.key, 'reps', e.target.value)}
                        placeholder="回数"
                        className="w-14 min-w-0 rounded-lg border border-border-strong px-2 py-1.5 text-sm text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-xs text-text-muted">回</span>
                      <span className="ml-auto shrink-0 whitespace-nowrap text-xs font-normal text-text-muted">
                        {rm ? `推定1RM ${rm}kg` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSet(exercise.key, set.key)}
                        className="shrink-0 text-text-muted"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <label className="flex shrink-0 items-center gap-1 text-xs font-normal text-text-secondary">
                        <input
                          type="checkbox"
                          checked={set.assisted}
                          onChange={(e) => updateSet(exercise.key, set.key, 'assisted', e.target.checked)}
                        />
                        補助
                      </label>
                      <input
                        type="text"
                        value={set.memo}
                        onChange={(e) => updateSet(exercise.key, set.key, 'memo', e.target.value)}
                        placeholder="メモ(例: 肩に違和感なし)"
                        className="flex-1 min-w-0 rounded-lg border border-border-strong px-2 py-1.5 text-xs text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <Button type="button" variant="secondary" size="sm" fullWidth className="mt-2" onClick={() => addSet(exercise.key)}>
              + セット追加
            </Button>
          </Card>
        ))}

        <datalist id="exercise-master-options">
          {exerciseMasterNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <Button type="button" variant="secondary" fullWidth onClick={addExercise}>
          + 種目を追加
        </Button>

        <Card padding="sm">
          <label className="block text-sm font-normal text-text-secondary mb-1">感想・申し送り</label>
          <textarea
            value={overallNote}
            onChange={(e) => setOverallNote(e.target.value)}
            rows={3}
            placeholder="次回トレーナーへの申し送り等"
            className="w-full min-w-0 max-w-full box-border rounded-lg border border-border-strong px-3 py-2 text-sm text-text-primary bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            削除
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => router.push(backHref)}>
              キャンセル
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} loading={saving}>
              保存
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
