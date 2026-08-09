'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'
import AppModal from '@/components/ui/AppModal'

// メール送信機能は廃止（2026-07決定）。通知はアプリのプッシュ通知のみ。
// APIとの互換性のため、これらのフィールドはやり取りするが画面上には出さない。
interface MailSettings {
  reminder_before_minutes: number
  sender_display_name: string
  additional_recipient_emails: string
  client_create_notify: boolean
  client_update_notify: boolean
  client_cancel_notify: boolean
  trainer_create_notify: boolean
  trainer_update_notify: boolean
  trainer_cancel_notify: boolean
  personal_reminder_enabled: boolean
  personal_reminder_days_before: number
  personal_reminder_hour: number
  personal_reminder_template: string
  online_announcement_template: string
  client_create_template: string
  client_update_template: string
  client_cancel_template: string
}

interface MemberNotificationSetting {
  id: string
  fullName: string
  email: string
  status: string
  storeId: string | null
  storeName: string
  emailEnabled: boolean
  pushEnabled: boolean
  pushSubscriptionCount: number
}

// AO-2: 配信先を絞り込むためのオンラインレッスン一覧(既存の/api/admin/online-lessonを流用)
// AO-3: 参加者(userIds)も保持し、レッスン選択時にチェックボックス付きの氏名一覧を表示できるようにする
interface OnlineLessonOption {
  id: string
  title: string
  userIds: string[]
}

// AO-5: 「送信可能」= 通知ONかつスマホ側で購読登録済み(pushSubscriptionCount > 0)。
// 通知ONにしていても未許可(購読登録なし)の会員には実際には届かないため、配信先の選択肢にすら出さない
const isReceivable = (member: MemberNotificationSetting) => member.pushEnabled && member.pushSubscriptionCount > 0

export default function AdminMailSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [settings, setSettings] = useState<MailSettings>({
    reminder_before_minutes: 30,
    sender_display_name: 'T&J GYM',
    additional_recipient_emails: '',
    client_create_notify: true,
    client_update_notify: true,
    client_cancel_notify: true,
    trainer_create_notify: true,
    trainer_update_notify: true,
    trainer_cancel_notify: true,
    personal_reminder_enabled: true,
    personal_reminder_days_before: 1,
    personal_reminder_hour: 21,
    personal_reminder_template: '',
    online_announcement_template: '',
    client_create_template: '',
    client_update_template: '',
    client_cancel_template: '',
  })

  const [tableExists, setTableExists] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberNotificationSetting[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersSaving, setMembersSaving] = useState(false)

  // AO-7: 画面を開いたらまず配信の種類を3つから選ぶ。
  // broadcast=予定変更などの連絡(自由記述の送信フォーム)、
  // reminder=セッションのリマインダー(自動送信の設定)、lesson=オンラインレッスンの通知(自動送信の設定)
  const [section, setSection] = useState<'broadcast' | 'reminder' | 'lesson' | null>(null)
  // 会員別の通知ON/OFF一覧は画面下部のテキストリンクから開くモーダルに残す
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // AO-1: 「配信」タブ(お知らせを送る)。テンプレートは無し、自由記述のみ。
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastImportant, setBroadcastImportant] = useState(false)
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ targetCount: number; successCount: number } | null>(null)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)
  const [broadcastHistory, setBroadcastHistory] = useState<Array<{
    id: string
    title: string
    body: string
    important: boolean
    target_count: number
    success_count: number
    target_label: string | null
    created_at: string
  }>>([])
  const [broadcastHistoryLoading, setBroadcastHistoryLoading] = useState(true)
  // AO-6: 配信履歴は既定で非表示(「配信履歴を見る」ボタンで開く)
  const [showBroadcastHistory, setShowBroadcastHistory] = useState(false)

  // AO-2: 配信先の絞り込み(全員/オンラインレッスン参加者/個別選択)
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<'all' | 'lesson' | 'individual'>('all')
  const [onlineLessons, setOnlineLessons] = useState<OnlineLessonOption[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [individualSearchQuery, setIndividualSearchQuery] = useState('')
  // AO-3: 選択中のレッスン参加者のうち、実際に送る相手として☑が付いている人
  const [selectedLessonMemberIds, setSelectedLessonMemberIds] = useState<string[]>([])

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    fetchSettings()
    fetchMembers()
    fetchBroadcastHistory()
    fetchOnlineLessons()
  }, [status])

  const fetchOnlineLessons = async () => {
    try {
      const res = await fetch('/api/admin/online-lesson')
      if (res.ok) {
        const data = await res.json()
        setOnlineLessons((data.lessons || []).map((l: any) => ({ id: l.id, title: l.title, userIds: l.userIds || [] })))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const toggleSelectedMember = (memberId: string) => {
    setSelectedMemberIds(prev => (
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    ))
  }

  const toggleLessonMember = (memberId: string) => {
    setSelectedLessonMemberIds(prev => (
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    ))
  }

  // AO-3: レッスン参加者の氏名・通知状態一覧(membersと突き合わせ)。参加者名簿に無い(退会等)場合や
  // 送信不可能な会員(AO-5)は除く
  const lessonParticipants = useMemo(() => {
    const lesson = onlineLessons.find(l => l.id === selectedLessonId)
    if (!lesson) return []
    const memberMap = new Map(members.map(m => [m.id, m]))
    return lesson.userIds
      .map(id => memberMap.get(id))
      .filter((m): m is MemberNotificationSetting => Boolean(m))
      .filter(isReceivable)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ja'))
  }, [onlineLessons, selectedLessonId, members])

  // レッスンを切り替えたら、送信可能な参加者を初期状態で全員☑にする
  useEffect(() => {
    if (broadcastTargetMode !== 'lesson') return
    setSelectedLessonMemberIds(lessonParticipants.map(m => m.id))
  }, [selectedLessonId, broadcastTargetMode, lessonParticipants])

  const fetchBroadcastHistory = async () => {
    setBroadcastHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/broadcast')
      if (res.ok) {
        const data = await res.json()
        setBroadcastHistory(data.messages || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setBroadcastHistoryLoading(false)
    }
  }

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      setBroadcastError('タイトルと本文を入力してください。')
      return
    }
    if (broadcastTargetMode === 'lesson' && !selectedLessonId) {
      setBroadcastError('オンラインレッスンを選択してください。')
      return
    }
    if (broadcastTargetMode === 'lesson' && selectedLessonMemberIds.length === 0) {
      setBroadcastError('送信する参加者を選択してください。')
      return
    }
    if (broadcastTargetMode === 'individual' && selectedMemberIds.length === 0) {
      setBroadcastError('送信する会員を選択してください。')
      return
    }

    const confirmLabel =
      broadcastTargetMode === 'lesson'
        ? `「${onlineLessons.find(l => l.id === selectedLessonId)?.title || '選択したレッスン'}」の参加者のうち選択した${selectedLessonMemberIds.length}名`
        : broadcastTargetMode === 'individual'
          ? `選択した${selectedMemberIds.length}名`
          : '通知ONの会員全員'
    if (!window.confirm(`${confirmLabel}にこの内容を配信します。よろしいですか？`)) return

    setBroadcastSending(true)
    setBroadcastError(null)
    setBroadcastResult(null)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          important: broadcastImportant,
          targetMode: broadcastTargetMode,
          lessonId: broadcastTargetMode === 'lesson' ? selectedLessonId : undefined,
          userIds:
            broadcastTargetMode === 'individual'
              ? selectedMemberIds
              : broadcastTargetMode === 'lesson'
                ? selectedLessonMemberIds
                : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '配信に失敗しました。')
      }
      setBroadcastResult({ targetCount: data.targetCount, successCount: data.successCount })
      setBroadcastTitle('')
      setBroadcastBody('')
      setBroadcastImportant(false)
      setSelectedMemberIds([])
      setSelectedLessonMemberIds([])
      fetchBroadcastHistory()
    } catch (err: any) {
      console.error(err)
      setBroadcastError(err instanceof Error ? err.message : '配信に失敗しました。')
    } finally {
      setBroadcastSending(false)
    }
  }

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/mail-settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }
        setTableExists(data.tableExists ?? true)
      } else {
        throw new Error('設定を取得できませんでした。画面を再読み込みしてください。')
      }
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '設定を読み込めませんでした。画面を再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    setMembersLoading(true)
    try {
      const res = await fetch('/api/admin/member-notification-settings')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '会員ごとの通知設定を取得できませんでした。画面を再読み込みしてください。')
      }

      setMembers(data.members || [])
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '会員ごとの通知設定を読み込めませんでした。画面を再読み込みしてください。')
    } finally {
      setMembersLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/mail-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '設定を保存できませんでした。もう一度お試しください。')
      }

      setSuccess('通知設定を保存しました。')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '設定を保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const handleMemberToggle = (memberId: string) => {
    setMembers(prev => prev.map(member => (
      member.id === memberId ? { ...member, pushEnabled: !member.pushEnabled } : member
    )))
  }

  const setAllMembers = (value: boolean) => {
    setMembers(prev => prev.map(member => ({
      ...member,
      pushEnabled: value
    })))
  }

  const memberStoreGroups = useMemo(() => {
    const statusOrder: Record<string, number> = {
      active: 0,
      suspended: 1,
      withdrawn: 2,
    }

    const sortedMembers = [...members].sort((a, b) => {
      const storeCompare = (a.storeName || '店舗未設定').localeCompare(b.storeName || '店舗未設定', 'ja')
      if (storeCompare !== 0) return storeCompare

      const statusCompare = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
      if (statusCompare !== 0) return statusCompare

      return a.fullName.localeCompare(b.fullName, 'ja')
    })

    const groups = new Map<string, MemberNotificationSetting[]>()

    for (const member of sortedMembers) {
      const storeName = member.storeName || '店舗未設定'
      groups.set(storeName, [...(groups.get(storeName) || []), member])
    }

    return Array.from(groups.entries()).map(([storeName, storeMembers]) => ({
      storeName,
      members: storeMembers,
    }))
  }, [members])

  // AO-2/AO-5: 個別選択候補は「送信可能な会員」のみ(通知ONかつ購読登録済み。それ以外は選べても届かないため)
  const individualCandidates = useMemo(() => {
    return members
      .filter(isReceivable)
      .filter(m => !individualSearchQuery || m.fullName.includes(individualSearchQuery))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ja'))
  }, [members, individualSearchQuery])

  const notificationStats = useMemo(() => {
    const readyCount = members.filter(member => member.pushEnabled && member.pushSubscriptionCount > 0).length
    const missingDeviceCount = members.filter(member => member.pushEnabled && member.pushSubscriptionCount === 0).length

    return {
      total: members.length,
      readyCount,
      missingDeviceCount,
    }
  }, [members])

  const handleSaveMembers = async () => {
    setMembersSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/member-notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: members.map(member => ({
            id: member.id,
            emailEnabled: member.emailEnabled,
            pushEnabled: member.pushEnabled,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '会員ごとの通知設定を保存できませんでした。もう一度お試しください。')
      }

      setSuccess('会員ごとの通知設定を保存しました。')
      setTimeout(() => setSuccess(null), 3000)
      fetchMembers()
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '会員ごとの通知設定を保存できませんでした。もう一度お試しください。')
    } finally {
      setMembersSaving(false)
    }
  }

  const handleToggle = (key: keyof MailSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key] as any,
    }))
  }

  const handleInputChange = (key: keyof MailSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base pb-12">
      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 bg-state-success-500/15 border border-state-success-500/25 rounded-2xl text-sm text-state-success-700 flex items-center gap-2 animate-fadeIn">
            <Icon name="check" size={20} className="text-state-success-500 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-state-danger-500/15 border border-state-danger-500/25 rounded-2xl text-sm text-state-danger-700 flex items-center gap-2 animate-fadeIn">
            <Icon name="exclamationCircle" size={20} className="text-state-danger-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table Migration Warning */}
        {!tableExists && (
          <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-sm text-amber-700 animate-fadeIn">
            <div className="flex gap-2">
              <Icon name="warning" size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">データベースの準備ができていません</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  <code>mail_settings</code> テーブルがデータベースに存在しません。管理者ユーザーが Supabase の SQL Editor などで、以下のマイグレーションファイルの内容を実行するまで、この設定画面はデフォルト値の読み取り専用となります。
                </p>
                <p className="mt-2 text-xs font-mono bg-amber-500/10 p-2 rounded-lg border border-amber-500/15 select-all overflow-x-auto">
                  supabase/migrations/20260604_create_mail_settings.sql
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AO-7: まず配信の種類を選ぶ */}
        {section === null && (
          <div className="space-y-3 animate-fadeIn">
            {([
              { key: 'broadcast', label: '配信', description: '予定変更などの連絡をその場で送る', iconName: 'envelope' },
              { key: 'reminder', label: 'セッションのリマインダー', description: '前日リマインダーの自動送信設定', iconName: 'clock' },
              { key: 'lesson', label: 'オンラインレッスンの通知', description: 'レッスン開始前の自動通知設定', iconName: 'video' },
            ] as const).map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                className="w-full flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface-raised p-5 text-left shadow-sm transition-colors hover:bg-surface-overlay"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600">
                  <Icon name={item.iconName} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">{item.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-text-muted">{item.description}</span>
                </span>
                <Icon name="chevronRight" size={18} className="shrink-0 text-text-muted" />
              </button>
            ))}

            <div className="pt-2 text-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowSettingsModal(true)}
                className="py-3 text-sm font-normal text-text-secondary hover:text-text-primary bg-transparent border-0"
              >
                会員別の通知設定
              </Button>
            </div>
          </div>
        )}

        {section !== null && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSection(null)}
            className="mb-3 px-0 py-2 text-sm font-normal text-text-secondary hover:text-text-primary bg-transparent border-0"
          >
            <Icon name="chevronLeft" size={16} />
            配信の種類を選び直す
          </Button>
        )}

        {showSettingsModal && (
          <AppModal
            title="会員別の通知"
            onClose={() => setShowSettingsModal(false)}
            size="lg"
          >
            <div className="p-4 sm:p-5">
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">会員ごとのアプリ通知</h2>
                  <p className="mt-1 text-xs text-text-secondary">予約確定・変更・キャンセル・リマインダー、オンラインセッションの通知をまとめて管理します。</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={fetchMembers}
                  disabled={membersLoading}
                  className="px-4 py-2 text-xs border border-border-strong rounded-2xl text-text-secondary hover:bg-surface-base disabled:opacity-50 shrink-0"
                >
                  再読み込み
                </Button>
              </div>

              <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
                <p className="text-sm text-text-secondary">
                  通知を受け取れる会員: <span className="font-semibold text-text-primary tabular-nums">{notificationStats.readyCount}</span> / {notificationStats.total}名
                </p>
                {notificationStats.missingDeviceCount > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    うち{notificationStats.missingDeviceCount}名は端末設定待ちです。
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setAllMembers(true)}
                  className="px-4 py-2 text-xs rounded-2xl bg-brand-500/15 text-brand-600 border border-brand-500/20 hover:bg-brand-500/25"
                >
                  全員ON
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAllMembers(false)}
                  className="px-4 py-2 text-xs rounded-2xl bg-surface-base text-text-secondary border border-border-subtle hover:bg-surface-overlay"
                >
                  全員OFF
                </Button>
              </div>

              <div className="overflow-x-auto border border-border-subtle rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-base border-b border-border-subtle">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-widest">会員</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-widest">通知</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-widest">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {membersLoading ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-text-muted">読み込み中...</td>
                      </tr>
                    ) : members.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-text-muted">会員が見つかりません</td>
                      </tr>
                    ) : (
                      memberStoreGroups.map(group => (
                        <Fragment key={group.storeName}>
                          <tr className="bg-surface-base/80">
                            <td colSpan={3} className="px-4 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-text-secondary">{group.storeName}</span>
                                <span className="text-xs text-text-muted">{group.members.length}名</span>
                              </div>
                            </td>
                          </tr>
                          {group.members.map(member => {
                            const receivable = member.pushEnabled && member.pushSubscriptionCount > 0
                            return (
                              <tr key={member.id} className="hover:bg-surface-base/70">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm text-text-primary">{member.fullName}</div>
                                    {member.status !== 'active' && (
                                      <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary">
                                        {member.status === 'suspended' ? '休会' : '退会'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={member.pushEnabled}
                                    onChange={() => handleMemberToggle(member.id)}
                                    className="w-5 h-5 text-brand-600 border-border-strong rounded-lg focus:ring-brand-500"
                                    aria-label={`${member.fullName}のアプリ通知`}
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
                                    receivable
                                      ? 'bg-state-success-500/15 text-state-success-700'
                                      : member.pushEnabled
                                        ? 'bg-amber-500/15 text-amber-700'
                                        : 'bg-surface-overlay text-text-muted'
                                  }`}>
                                    {receivable ? '受信可能' : member.pushEnabled ? '端末設定待ち' : 'OFF'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-surface-raised p-4 rounded-2xl shadow-sm border border-border-subtle flex justify-between gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveMembers}
                disabled={membersSaving || membersLoading}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-medium disabled:opacity-50 disabled:hover:bg-brand-500 transition-colors flex w-full items-center justify-center gap-2 shadow-md shadow-brand-500/10"
              >
                {membersSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    保存中...
                  </>
                ) : (
                  '保存する'
                )}
              </Button>
            </div>
          </div>
            </div>
          </AppModal>
        )}

        {/* AO-7: セッションのリマインダー(前日リマインダーの自動送信設定) */}
        {section === 'reminder' && (
          <form onSubmit={handleSave} className="space-y-6 animate-fadeIn">
            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-5 space-y-4">
              <div className="p-4 bg-surface-base/50 rounded-2xl border border-border-subtle space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={!tableExists}
                    checked={settings.personal_reminder_enabled}
                    onChange={() => handleToggle('personal_reminder_enabled')}
                    className="w-4.5 h-4.5 text-brand-600 border-border-strong rounded-lg focus:ring-brand-500 cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-text-secondary">自動リマインダー通知を有効にする</span>
                </label>
                <p className="pl-7 text-xs text-text-muted">毎晩21:00に、翌日ご予約のある会員様へまとめて送信します（サーバー側の制約で1日1回のみ）。</p>
                <p className="pl-7 text-xs text-text-muted">※ 通知ONかつスマホ側で許可済みの会員様にのみ届きます。</p>
              </div>
            </div>

            <div className="bg-surface-raised p-4 rounded-2xl shadow-sm border border-border-subtle">
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !tableExists}
                className="w-full px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-medium disabled:opacity-50 disabled:hover:bg-brand-500 transition-colors flex items-center justify-center gap-2 shadow-md shadow-brand-500/10"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    保存中...
                  </>
                ) : (
                  '保存する'
                )}
              </Button>
            </div>
          </form>
        )}

        {/* AO-7: オンラインレッスンの通知(開始前の自動通知設定) */}
        {section === 'lesson' && (
          <form onSubmit={handleSave} className="space-y-6 animate-fadeIn">
            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-5 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    自動送信タイミング
                  </label>
                  <select
                    disabled={!tableExists}
                    value={settings.reminder_before_minutes}
                    onChange={(e) => handleInputChange('reminder_before_minutes', Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-border-strong rounded-2xl text-sm bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-base disabled:text-text-muted"
                  >
                    <option value={15}>レッスン開始 15分前</option>
                    <option value={30}>レッスン開始 30分前</option>
                    <option value={60}>レッスン開始 60分前</option>
                    <option value={120}>レッスン開始 120分前</option>
                  </select>
                  <p className="mt-1 text-xs text-text-muted leading-normal">
                    毎晩21:00のチェックから「◯分後」に開催されるレッスンの参加者へ通知します（例: 30分前を選ぶと、21:30開始のレッスンに通知）。
                  </p>
                  <p className="mt-1 text-xs text-text-muted leading-normal">
                    ※ サーバー側の制約でチェックは1日1回(21:00)のみのため、21:00からこの時間だけ後の枠しか通知できません。それより前や翌日以降の時間帯のレッスンには対応できません。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface-raised p-4 rounded-2xl shadow-sm border border-border-subtle">
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !tableExists}
                className="w-full px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-medium disabled:opacity-50 disabled:hover:bg-brand-500 transition-colors flex items-center justify-center gap-2 shadow-md shadow-brand-500/10"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    保存中...
                  </>
                ) : (
                  '保存する'
                )}
              </Button>
            </div>
          </form>
        )}

        {/* AO-7: 配信(予定変更などの連絡を自由記述で送る) */}
        {section === 'broadcast' && (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-5 space-y-4">
              {broadcastError && (
                <div className="p-3 bg-state-danger-500/15 border border-state-danger-500/25 rounded-2xl text-sm text-state-danger-700">
                  {broadcastError}
                </div>
              )}
              {broadcastResult && (
                <div className="p-3 bg-state-success-500/15 border border-state-success-500/25 rounded-2xl text-sm text-state-success-700">
                  配信しました({broadcastResult.successCount} / {broadcastResult.targetCount}名に到達)
                </div>
              )}

              <div>
                {/* AO-6: 配信先はタブ形式(セグメンテッドコントロール)。ラベルは枠内に収まる短さにする */}
                <div className="flex bg-surface-overlay/60 p-1 rounded-2xl border border-border-strong/50">
                  {([
                    { key: 'all', label: '全員' },
                    { key: 'lesson', label: 'レッスン' },
                    { key: 'individual', label: '個別' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setBroadcastTargetMode(opt.key)}
                      className={`flex-1 min-w-0 py-2.5 text-sm font-medium rounded-2xl transition-all duration-200 ${
                        broadcastTargetMode === opt.key
                          ? 'bg-surface-raised text-brand-600 shadow-sm border border-border-subtle'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {broadcastTargetMode === 'lesson' && (
                  <div className="mt-3">
                    {onlineLessons.length === 0 ? (
                      <p className="text-xs text-text-muted">登録されているオンラインレッスンがありません。</p>
                    ) : (
                      <select
                        value={selectedLessonId}
                        onChange={(e) => setSelectedLessonId(e.target.value)}
                        className="w-full min-w-0 max-w-full box-border px-4 py-2.5 border border-border-strong rounded-2xl text-sm bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">レッスンを選択してください</option>
                        {onlineLessons.map(lesson => (
                          <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                        ))}
                      </select>
                    )}

                    {selectedLessonId && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-text-muted">{selectedLessonMemberIds.length}名選択中(送信可能な参加者のみ表示)</p>
                        <div className="max-h-56 overflow-y-auto border border-border-subtle rounded-2xl divide-y divide-border-subtle">
                          {lessonParticipants.length === 0 ? (
                            <p className="p-4 text-center text-xs text-text-muted">このレッスンに送信可能な参加者がいません</p>
                          ) : (
                            lessonParticipants.map(member => (
                              <label
                                key={member.id}
                                className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-surface-base/70"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedLessonMemberIds.includes(member.id)}
                                  onChange={() => toggleLessonMember(member.id)}
                                  className="w-4.5 h-4.5 text-brand-600 border-border-strong rounded-lg focus:ring-brand-500 cursor-pointer"
                                />
                                <span className="text-sm text-text-primary">{member.fullName}</span>
                                <span className="text-xs text-text-muted">{member.storeName}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {broadcastTargetMode === 'individual' && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={individualSearchQuery}
                      onChange={(e) => setIndividualSearchQuery(e.target.value)}
                      placeholder="名前で検索"
                      className="w-full min-w-0 max-w-full box-border px-4 py-2 border border-border-strong rounded-2xl text-sm bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="text-xs text-text-muted">{selectedMemberIds.length}名選択中(送信可能な会員のみ表示)</p>
                    <div className="max-h-56 overflow-y-auto border border-border-subtle rounded-2xl divide-y divide-border-subtle">
                      {individualCandidates.length === 0 ? (
                        <p className="p-4 text-center text-xs text-text-muted">該当する会員がいません</p>
                      ) : (
                        individualCandidates.map(member => (
                          <label key={member.id} className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-surface-base/70">
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.includes(member.id)}
                              onChange={() => toggleSelectedMember(member.id)}
                              className="w-4.5 h-4.5 text-brand-600 border-border-strong rounded-lg focus:ring-brand-500 cursor-pointer"
                            />
                            <span className="text-sm text-text-primary">{member.fullName}</span>
                            <span className="text-xs text-text-muted">{member.storeName}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* AO-6: ラベルは省き、プレースホルダーは入力済みと誤認しないよう薄く表示する */}
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="タイトル"
                className="w-full min-w-0 max-w-full box-border px-4 py-3 border border-border-strong rounded-2xl text-sm bg-surface-raised placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                rows={5}
                placeholder="本文"
                className="w-full min-w-0 max-w-full box-border px-4 py-3 border border-border-strong rounded-2xl text-sm bg-surface-raised placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={broadcastImportant}
                  onChange={(e) => setBroadcastImportant(e.target.checked)}
                  className="w-4.5 h-4.5 text-brand-600 border-border-strong rounded-lg focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-sm font-normal text-text-secondary">タイトルに【重要】を付ける</span>
              </label>

              <Button
                type="button"
                variant="primary"
                onClick={handleSendBroadcast}
                disabled={broadcastSending}
                className="w-full px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md shadow-brand-500/10"
              >
                {broadcastSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    送信中...
                  </>
                ) : (
                  '配信する'
                )}
              </Button>
            </div>

            {/* AO-6: 配信履歴は既定で隠し、ボタンを押したときだけ開く */}
            {!showBroadcastHistory ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowBroadcastHistory(true)}
                className="w-full py-3 text-sm font-normal text-text-secondary hover:text-text-primary bg-transparent border-0"
              >
                配信履歴を見る
              </Button>
            ) : (
              <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">配信履歴</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBroadcastHistory(false)}
                    className="px-2 py-1 text-xs font-normal text-text-secondary hover:text-text-primary bg-transparent border-0"
                  >
                    閉じる
                  </Button>
                </div>
                {broadcastHistoryLoading ? (
                  <div className="py-6 text-center text-sm text-text-muted">読み込み中...</div>
                ) : broadcastHistory.length === 0 ? (
                  <div className="py-6 text-center text-sm text-text-muted">まだ配信履歴がありません</div>
                ) : (
                  <div className="space-y-2">
                    {broadcastHistory.map((message) => (
                      <div key={message.id} className="rounded-2xl border border-border-subtle bg-surface-base p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-normal text-text-primary">{message.title}</div>
                          <div className="shrink-0 text-xs font-normal text-text-muted">
                            {new Date(message.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                          </div>
                        </div>
                        <p className="mt-1 text-xs font-normal text-text-secondary whitespace-pre-wrap">{message.body}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs font-normal text-text-muted">
                          <span className="rounded-full bg-surface-overlay px-2 py-0.5">{message.target_label || '全員'}</span>
                          <span>到達 {message.success_count} / {message.target_count}名</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>
        )}
      </div>
    </div>
  )
}
