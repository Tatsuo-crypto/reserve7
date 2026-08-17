'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  note: string
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

type PreviousSession = {
  id: string
  sessionDate: string | null
}

type PreviousSessionDetail = {
  id: string
  sessionDate: string | null
  approach: string | null
  overallNote: string | null
  exercises: {
    exerciseName: string
    sets: { weight: number | null; reps: number | null; setCount: string | null; note: string | null }[]
  }[]
}

type ReservationDateOption = {
  date: string
  reservationId: string
  title: string | null
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

function createEmptyExercise(): ExerciseRow {
  return {
    key: genKey(),
    exerciseName: '',
    sets: [{ key: genKey(), weight: '', reps: '', assisted: false, memo: '', note: '' }],
    lastRecord: null,
    lastRecordLoading: false,
  }
}

function createEmptySet(): SetRow {
  return { key: genKey(), weight: '', reps: '', assisted: false, memo: '', note: '' }
}

function parseSetMemo(value: unknown) {
  if (value == null) return { setCount: '', note: '' }
  const text = String(value)
  if (!text) return { setCount: '', note: '' }
  if (/^\d+$/.test(text)) return { setCount: text, note: '' }
  try {
    const parsed = JSON.parse(text)
    return {
      setCount: /^\d+$/.test(String(parsed?.setCount ?? '')) ? String(parsed.setCount) : '',
      note: typeof parsed?.note === 'string' ? parsed.note : '',
    }
  } catch {
    return { setCount: '', note: text }
  }
}

function normalizeSetCount(value: unknown) {
  return parseSetMemo(value).setCount
}

function parseSetNote(value: unknown) {
  return parseSetMemo(value).note
}

function serializeSetMemo(setCount: string, note: string) {
  const normalizedSetCount = normalizeSetCount(setCount)
  const normalizedNote = note.trim()
  if (!normalizedNote) return normalizedSetCount || null
  return JSON.stringify({ setCount: normalizedSetCount, note: normalizedNote })
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

function formatTime(value?: string | null) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tokyo',
    })
  } catch {
    return ''
  }
}

function formatTimeRange(start?: string | null, end?: string | null) {
  const startText = formatTime(start)
  const endText = formatTime(end)
  if (startText && endText) return `${startText}〜${endText}`
  return startText || endText || ''
}

function formatSetSummary(set: SetRow) {
  const parts = []
  if (set.weight) parts.push(`${set.weight}kg`)
  if (set.reps) parts.push(`${set.reps}回`)
  if (set.memo) parts.push(`${normalizeSetCount(set.memo)}set`)
  return parts.length > 0 ? parts.join(' / ') : '未入力'
}

function formatSetNote(set: SetRow) {
  return set.note.trim()
}

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export default function TrainingKarteForm({ trainerToken, sessionKey, reservationId, userId, backHref }: TrainingKarteFormProps) {
  const router = useRouter()
  const [resolvedId, setResolvedId] = useState<string | null>(sessionKey !== 'new' ? sessionKey : null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [memberName, setMemberName] = useState<string | null>(null)
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userId || null)
  const [trainerName, setTrainerName] = useState<string | null>(null)
  const [sessionDate, setSessionDate] = useState<string | null>(null)
  const [reservationStartTime, setReservationStartTime] = useState<string | null>(null)
  const [reservationEndTime, setReservationEndTime] = useState<string | null>(null)
  const [reservationDateOptions, setReservationDateOptions] = useState<ReservationDateOption[]>([])
  const [sessionType, setSessionType] = useState('')
  const [karteMemo, setKarteMemo] = useState('')
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [exerciseMasterNames, setExerciseMasterNames] = useState<string[]>([])
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null)
  const [previousSessionDetail, setPreviousSessionDetail] = useState<PreviousSessionDetail | null>(null)
  const [createdOnInit, setCreatedOnInit] = useState(false)
  const [isEditing, setIsEditing] = useState(sessionKey === 'new')

  const didInit = useRef(false)
  const didSkipFirstAutoSave = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memoTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const resizeMemoTextarea = useCallback((textarea?: HTMLTextAreaElement | null) => {
    if (!textarea) return
    textarea.style.height = '1px'
    textarea.style.height = `${Math.max(112, textarea.scrollHeight + 2)}px`
    textarea.style.overflowY = 'hidden'
  }, [])

  const loadSessionDetail = useCallback(async (id: string) => {
    const res = await fetch(withToken(`/api/training-records/${id}`, trainerToken), { cache: 'no-store' })
    if (!res.ok) {
      setError('カルテを読み込めませんでした。')
      return null
    }
    const data = await res.json()
    setMemberName(data.memberName)
    setResolvedUserId(data.userId || null)
    setTrainerName(data.trainerName)
    setSessionDate(data.sessionDate)
    setReservationStartTime(data.reservationStartTime || null)
    setReservationEndTime(data.reservationEndTime || null)
    setReservationDateOptions(data.reservationDateOptions || [])
    setSessionType(data.sessionType || '')
    setKarteMemo(data.approach || data.overallNote || '')
    const loadedExercises = (data.exercises || []).map((ex: any) => ({
        key: genKey(),
        id: ex.id,
        exerciseName: ex.exerciseName,
        sets: (ex.sets || []).map((s: any) => ({
          key: genKey(),
          id: s.id,
          weight: s.weight !== null && s.weight !== undefined ? String(s.weight) : '',
          reps: s.reps !== null && s.reps !== undefined ? String(s.reps) : '',
          assisted: !!s.assisted,
          memo: normalizeSetCount(s.memo),
          note: parseSetNote(s.memo),
        })),
        lastRecord: null,
        lastRecordLoading: false,
      }))
    setExercises(loadedExercises.length > 0 ? loadedExercises : [createEmptyExercise()])
    return data
  }, [trainerToken])

  const loadPreviousSession = useCallback(async (currentUserId: string | null, currentSessionId: string, currentDate?: string | null) => {
    if (!currentUserId) {
      setPreviousSession(null)
      return
    }

    const res = await fetch(withToken(`/api/training-records/members/${currentUserId}`, trainerToken), { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    const history = (data.history || []) as PreviousSession[]
    const previous = history.find((item) => {
      if (item.id === currentSessionId) return false
      if (!currentDate || !item.sessionDate) return true
      return item.sessionDate < currentDate
    })
    setPreviousSession(previous || null)
    if (!previous) {
      setPreviousSessionDetail(null)
      return
    }

    const detailRes = await fetch(withToken(`/api/training-records/${previous.id}`, trainerToken), { cache: 'no-store' })
    if (!detailRes.ok) return
    const detail = await detailRes.json()
    setPreviousSessionDetail({
      id: detail.id,
      sessionDate: detail.sessionDate,
      approach: detail.approach || null,
      overallNote: detail.overallNote || null,
      exercises: (detail.exercises || []).map((exercise: any) => ({
        exerciseName: exercise.exerciseName,
        sets: (exercise.sets || []).map((set: any) => ({
          weight: set.weight,
          reps: set.reps,
          setCount: normalizeSetCount(set.memo),
          note: parseSetNote(set.memo),
        })),
      })),
    })
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
          const { id, created } = await res.json()
          setResolvedId(id)
          setCreatedOnInit(created === true)
          const detail = await loadSessionDetail(id)
          await loadPreviousSession(detail?.userId || null, id, detail?.sessionDate)
        } else {
          setResolvedId(sessionKey)
          const detail = await loadSessionDetail(sessionKey)
          await loadPreviousSession(detail?.userId || null, sessionKey, detail?.sessionDate)
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
    setExercises((prev) => [...prev, createEmptyExercise()])
  }

  const removeExercise = (exKey: string) => {
    setExercises((prev) => prev.filter((e) => e.key !== exKey))
  }

  const updateExerciseName = (exKey: string, name: string) => {
    setExercises((prev) => prev.map((e) => {
      if (e.key !== exKey) return e
      const shouldCreateFirstSet = name.trim() && e.sets.length === 0
      return {
        ...e,
        exerciseName: name,
        lastRecord: null,
        sets: shouldCreateFirstSet ? [createEmptySet()] : e.sets,
      }
    }))
  }

  const addSetRow = (exKey: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exKey
          ? { ...e, sets: [...e.sets, createEmptySet()] }
          : e
      )
    )
  }

  const removeSetRow = (exKey: string, setKey: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exKey
          ? {
              ...e,
              sets: e.sets.length > 1 ? e.sets.filter((s) => s.key !== setKey) : e.sets,
            }
          : e
      )
    )
  }

  const updateSetRow = (exKey: string, setKey: string, field: 'weight' | 'reps' | 'setCount' | 'note', value: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exKey
          ? {
              ...e,
              sets: e.sets.map((s) =>
                s.key === setKey
                  ? {
                      ...s,
                      [field === 'setCount' ? 'memo' : field]: value,
                    }
                  : s
              ),
            }
          : e
      )
    )
  }

  const saveKarte = useCallback(async (nextSessionDate?: string | null) => {
    if (!resolvedId) return
    setSaving(true)
    setSaveStatus('saving')
    setError(null)
    try {
      const payload = {
        sessionDate: nextSessionDate === undefined ? sessionDate : nextSessionDate,
        sessionType,
        approach: karteMemo,
        overallNote: null,
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
              assisted: false,
              memo: serializeSetMemo(s.memo, s.note),
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
        setSaveStatus('error')
        return false
      }

      setSaveStatus('saved')
      return true
    } catch (err) {
      console.error(err)
      setError('保存できませんでした。')
      setSaveStatus('error')
      return false
    } finally {
      setSaving(false)
    }
  }, [exercises, karteMemo, resolvedId, sessionDate, sessionType, trainerToken])

  const handleSessionDateChange = (value: string) => {
    const nextDate = value || null
    setSessionDate(nextDate)
    if (!isEditing) {
      void saveKarte(nextDate)
    }
  }

  const hasInput = () => {
    if (karteMemo.trim()) return true
    return exercises.some((exercise) => (
      exercise.exerciseName.trim() ||
      exercise.sets.some((set) => set.weight || set.reps)
    ))
  }

  useEffect(() => {
    if (loading || !resolvedId || !isEditing) return
    if (!didSkipFirstAutoSave.current) {
      didSkipFirstAutoSave.current = true
      return
    }
    if (createdOnInit && !hasInput()) return

    setSaveStatus('idle')
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      void saveKarte()
    }, 700)

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karteMemo, exercises, loading, resolvedId, isEditing, sessionDate])

  useEffect(() => {
    if (trainerToken || !memberName) return
    window.dispatchEvent(new CustomEvent('reserve7:page-title', { detail: { title: memberName } }))
    return () => {
      window.dispatchEvent(new CustomEvent('reserve7:page-title', { detail: { title: null } }))
    }
  }, [memberName, trainerToken])

  useLayoutEffect(() => {
    resizeMemoTextarea(memoTextareaRef.current)
  }, [karteMemo, isEditing, resizeMemoTextarea])

  const cleanupCreatedEmptySession = async () => {
    if (!createdOnInit || !resolvedId || hasInput()) return
    try {
      await fetch(withToken(`/api/training-records/${resolvedId}`, trainerToken), { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to cleanup empty karte:', err)
    }
  }

  const handleBack = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (isEditing && hasInput()) {
      const saved = await saveKarte()
      if (saved === false) return
    }
    await cleanupCreatedEmptySession()
    router.push(backHref)
  }

  const handleManualSave = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    const saved = await saveKarte()
    if (saved !== false) {
      setIsEditing(false)
    }
    if (saved !== false) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      if (sessionKey === 'new' && resolvedId) {
        const nextPath = trainerToken
          ? `/trainer/${trainerToken}/karte/${resolvedId}?back=${encodeURIComponent(backHref)}`
          : `/admin/karte/${resolvedId}?back=${encodeURIComponent(backHref)}`
        router.replace(nextPath)
      }
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

  const handleOpenPrevious = async () => {
    if (!previousSession) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (isEditing && hasInput()) {
      const saved = await saveKarte()
      if (saved === false) return
    }
    await cleanupCreatedEmptySession()
    const currentPath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : backHref
    const nextPath = trainerToken
      ? `/trainer/${trainerToken}/karte/${previousSession.id}?back=${encodeURIComponent(currentPath)}`
      : `/admin/karte/${previousSession.id}?back=${encodeURIComponent(currentPath)}`
    router.push(nextPath)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base pb-28 pt-20 text-center text-sm text-text-secondary">
        読み込み中...
      </div>
    )
  }

  const visibleExercises = exercises.filter((exercise) => (
    exercise.exerciseName.trim() ||
    exercise.sets.some((set) => set.weight || set.reps || set.memo)
  ))
  const groupedVisibleExercises = visibleExercises.reduce<ExerciseRow[]>((list, exercise) => {
    const normalizedName = normalizeExerciseName(exercise.exerciseName)
    const existing = list.find((item) => normalizeExerciseName(item.exerciseName) === normalizedName)
    if (existing) {
      existing.sets.push(...exercise.sets)
      return list
    }
    list.push({
      ...exercise,
      exerciseName: normalizedName || exercise.exerciseName,
      sets: [...exercise.sets],
    })
    return list
  }, [])
  const hasVisibleContent = karteMemo.trim() || visibleExercises.length > 0
  const dateOptions = sessionDate && !reservationDateOptions.some((option) => option.date === sessionDate)
    ? [{ date: sessionDate, reservationId: 'current', title: null }, ...reservationDateOptions]
    : reservationDateOptions
  const memoRows = Math.max(
    6,
    karteMemo.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 24)), 0) + 1
  )

  return (
    <div className="min-h-screen bg-surface-base pb-28">
      {trainerToken && (
        <header className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-border-subtle bg-surface-raised/95 backdrop-blur-md">
          <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center px-4">
            <button
              type="button"
              onClick={handleBack}
              className="absolute left-4 flex h-10 w-10 items-center justify-center text-text-secondary"
            >
              <Icon name="chevronLeft" size={22} />
            </button>
            <h1 className="max-w-[70%] truncate text-xl font-semibold tracking-tight text-text-primary">
              {memberName || 'カルテ'}
            </h1>
          </div>
        </header>
      )}

      <main className={`mx-auto max-w-md space-y-3 px-3 ${trainerToken ? 'pt-20' : 'pt-3'}`}>
        <div className="flex items-center justify-center px-1 text-center text-sm font-normal text-text-primary">
          <div className="shrink-0">
            {dateOptions.length > 0 ? (
              <select
                id="karte-session-date"
                value={sessionDate || ''}
                onChange={(e) => handleSessionDateChange(e.target.value)}
                aria-label="日付"
                className="max-w-[11rem] border-0 bg-transparent px-0 py-0 text-center text-sm font-normal tabular-nums text-text-primary focus:outline-none focus:ring-0"
              >
                {dateOptions.map((option) => (
                  <option key={`${option.reservationId}-${option.date}`} value={option.date}>
                    {formatDate(option.date)}
                  </option>
                ))}
              </select>
            ) : isEditing ? (
              <input
                id="karte-session-date"
                type="date"
                value={sessionDate || ''}
                onChange={(e) => handleSessionDateChange(e.target.value)}
                aria-label="日付"
                className="max-w-[11rem] border-0 bg-transparent px-0 py-0 text-center text-sm font-normal tabular-nums text-text-primary focus:outline-none focus:ring-0"
              />
            ) : (
              <span className="text-sm font-normal tabular-nums text-text-primary">
                {formatDate(sessionDate)}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isEditing ? (
          <>
            <Card padding="xs">
              <div className="mb-2 flex items-center justify-end gap-1">
                  {previousSession && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleOpenPrevious} className="px-2 text-text-secondary">
                      前回
                      <Icon name="chevronRight" size={16} />
                    </Button>
                  )}
              </div>

              {!hasVisibleContent ? (
                <div className="rounded-lg bg-surface-base px-3 py-3 text-sm text-text-muted">
                  記録はまだありません
                </div>
              ) : (
                <div className="space-y-3">
                  {karteMemo.trim() && (
                    <div className="rounded-lg bg-surface-base px-3 py-2 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
                      {karteMemo.trim()}
                    </div>
                  )}

                  {groupedVisibleExercises.map((exercise) => (
                    <div key={exercise.key} className="border-t border-border-subtle pt-2 first:border-t-0 first:pt-0">
                      <div className="mb-1.5 text-sm font-normal text-text-primary">{exercise.exerciseName || '種目未設定'}</div>
                      <div className="space-y-1.5">
                        {exercise.sets.map((set) => (
                          <div key={set.key} className="rounded-lg bg-surface-base px-2 py-1.5 text-xs text-text-secondary">
                            <div>{formatSetSummary(set)}</div>
                            {formatSetNote(set) && (
                              <div className="mt-0.5 text-[11px] leading-4 text-text-muted">{formatSetNote(set)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : (
          <>
            <Card padding="xs">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-text-primary">メモ</h2>
                <span className="text-xs font-normal text-text-muted">
                  {saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '保存済み' : saveStatus === 'error' ? '保存失敗' : ''}
                </span>
              </div>
              <textarea
                ref={memoTextareaRef}
                value={karteMemo}
                onChange={(e) => setKarteMemo(e.target.value)}
                onInput={(e) => resizeMemoTextarea(e.currentTarget)}
                rows={memoRows}
                placeholder="体調・痛み・今日の内容"
                className="w-full min-w-0 max-w-full box-border resize-none overflow-hidden rounded-lg border border-border-strong bg-surface-base px-3 py-2 !text-sm leading-6 text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Card>

            {previousSessionDetail && (
              <Card padding="xs" className="bg-surface-base">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">前回記録</h2>
                    <div className="text-xs text-text-muted">{formatDate(previousSessionDetail.sessionDate)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenPrevious}
                    className="shrink-0 px-2 text-text-secondary"
                  >
                    開く
                    <Icon name="chevronRight" size={16} />
                  </Button>
                </div>
                {(previousSessionDetail.approach || previousSessionDetail.overallNote) && (
                  <div className="mb-2 rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-secondary">
                    {previousSessionDetail.approach || previousSessionDetail.overallNote}
                  </div>
                )}
                <div className="space-y-1.5">
                  {previousSessionDetail.exercises.slice(0, 4).map((exercise, index) => {
                    return (
                      <div key={`${exercise.exerciseName}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs">
                        <span className="min-w-0 truncate font-normal text-text-primary">{exercise.exerciseName}</span>
                        <span className="shrink-0 text-text-secondary">{exercise.sets.length}行</span>
                        <div className="col-span-2 space-y-1">
                          {exercise.sets.slice(0, 4).map((set, setIndex) => (
                            <div key={setIndex} className="rounded-lg bg-surface-raised px-2 py-1 text-text-secondary">
                              <div>{set.weight ?? '-'}kg {set.reps ?? '-'}回 {set.setCount || '-'}set</div>
                              {set.note && <div className="mt-0.5 text-[11px] text-text-muted">{set.note}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            <Card padding="xs">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-text-primary">カルテ</h2>
                {previousSession && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenPrevious}
                    className="shrink-0 px-2 text-text-secondary"
                  >
                    前回
                    <Icon name="chevronRight" size={16} />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {exercises.map((exercise) => {
                  return (
                    <div key={exercise.key} className="rounded-lg border border-border-subtle bg-surface-base p-2">
                      <div className="mb-1.5 flex items-center gap-2">
                        <input
                          type="text"
                          list="exercise-master-options"
                          value={exercise.exerciseName}
                          onChange={(e) => updateExerciseName(exercise.key, e.target.value)}
                          autoComplete="off"
                          placeholder="種目"
                          className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-raised px-2.5 py-1.5 !text-sm font-normal text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeExercise(exercise.key)}>
                          <Icon name="trash" size={16} />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {exercise.sets.map((set) => (
                          <div key={set.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-1.5">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={set.weight}
                              onChange={(e) => updateSetRow(exercise.key, set.key, 'weight', e.target.value)}
                              placeholder="kg"
                              className="min-w-0 rounded-lg border border-border-strong bg-surface-raised px-2 py-1.5 !text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <input
                              type="number"
                              inputMode="numeric"
                              value={set.reps}
                              onChange={(e) => updateSetRow(exercise.key, set.key, 'reps', e.target.value)}
                              placeholder="回"
                              className="min-w-0 rounded-lg border border-border-strong bg-surface-raised px-2 py-1.5 !text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <input
                              type="number"
                              inputMode="numeric"
                              value={set.memo || ''}
                              onChange={(e) => updateSetRow(exercise.key, set.key, 'setCount', e.target.value)}
                              placeholder="set"
                              className="min-w-0 rounded-lg border border-border-strong bg-surface-raised px-2 py-1.5 !text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={exercise.sets.length <= 1}
                              onClick={() => removeSetRow(exercise.key, set.key)}
                              className="h-9 w-8 p-0 text-text-muted disabled:opacity-20"
                            >
                              <Icon name="close" size={14} />
                            </Button>
                            <input
                              type="text"
                              value={set.note}
                              onChange={(e) => updateSetRow(exercise.key, set.key, 'note', e.target.value)}
                              placeholder="メモ"
                              className="col-span-3 min-w-0 rounded-lg border border-border-strong bg-surface-raised px-2 py-1.5 !text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                        ))}
                      </div>
                      <Button type="button" variant="ghost" size="sm" fullWidth className="mt-1.5 py-1.5 text-text-secondary" onClick={() => addSetRow(exercise.key)}>
                        + 重量行
                      </Button>
                    </div>
                  )
                })}
              </div>

              <datalist id="exercise-master-options">
                {exerciseMasterNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <Button type="button" variant="secondary" fullWidth className="mt-2 py-2" onClick={addExercise}>
                + 種目を追加
              </Button>
            </Card>
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            削除
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleBack}>
              戻る
            </Button>
            {isEditing && (
              <Button type="button" variant="primary" onClick={handleManualSave} loading={saving}>
                保存
              </Button>
            )}
            {!isEditing && (
              <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>
                編集
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
