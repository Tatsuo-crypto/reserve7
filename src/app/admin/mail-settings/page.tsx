'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

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
interface OnlineLessonOption {
  id: string
  title: string
}

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

  const [activeTab, setActiveTab] = useState<'members' | 'reminder' | 'broadcast'>('members')

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

  // AO-2: 配信先の絞り込み(全員/オンラインレッスン参加者/個別選択)
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<'all' | 'lesson' | 'individual'>('all')
  const [onlineLessons, setOnlineLessons] = useState<OnlineLessonOption[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [individualSearchQuery, setIndividualSearchQuery] = useState('')

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
        setOnlineLessons((data.lessons || []).map((l: any) => ({ id: l.id, title: l.title })))
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
    if (broadcastTargetMode === 'individual' && selectedMemberIds.length === 0) {
      setBroadcastError('送信する会員を選択してください。')
      return
    }

    const confirmLabel =
      broadcastTargetMode === 'lesson'
        ? `「${onlineLessons.find(l => l.id === selectedLessonId)?.title || '選択したレッスン'}」の参加者`
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
          userIds: broadcastTargetMode === 'individual' ? selectedMemberIds : undefined,
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

  // AO-2: 個別選択候補は「通知ONの会員」のみ(そもそも通知が届かない相手を選べても意味が無いため)
  const individualCandidates = useMemo(() => {
    return members
      .filter(m => m.pushEnabled)
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
          <div className="mb-6 p-4 bg-state-success-500/15 border border-state-success-500/25 rounded-2xl text-sm text-state-success-300 flex items-center gap-2 animate-fadeIn">
            <Icon name="check" size={20} className="text-state-success-500 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-state-danger-500/15 border border-state-danger-500/25 rounded-2xl text-sm text-state-danger-300 flex items-center gap-2 animate-fadeIn">
            <Icon name="exclamationCircle" size={20} className="text-state-danger-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table Migration Warning */}
        {!tableExists && (
          <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-sm text-amber-300 animate-fadeIn">
            <div className="flex gap-2">
              <Icon name="warning" size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">データベースの準備ができていません</p>
                <p className="text-xs text-amber-300 leading-relaxed">
                  <code>mail_settings</code> テーブルがデータベースに存在しません。管理者ユーザーが Supabase の SQL Editor などで、以下のマイグレーションファイルの内容を実行するまで、この設定画面はデフォルト値の読み取り専用となります。
                </p>
                <p className="mt-2 text-xs font-mono bg-amber-500/10 p-2 rounded-lg border border-amber-500/15 select-all overflow-x-auto">
                  supabase/migrations/20260604_create_mail_settings.sql
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Tab Bar */}
        <div className="flex bg-surface-overlay/60 p-1.5 rounded-2xl mb-8 border border-border-strong/50 shadow-inner">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-sm font-medium rounded-2xl transition-all duration-200 ${
              activeTab === 'members'
                ? 'bg-surface-raised text-brand-600 shadow-sm border border-border-subtle'
                : 'text-text-secondary hover:text-text-secondary'
            }`}
          >
            会員別の通知
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('reminder')}
            className={`flex-1 py-3 text-sm font-medium rounded-2xl transition-all duration-200 ${
              activeTab === 'reminder'
                ? 'bg-surface-raised text-brand-600 shadow-sm border border-border-subtle'
                : 'text-text-secondary hover:text-text-secondary'
            }`}
          >
            リマインダーの時間
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-3 text-sm font-medium rounded-2xl transition-all duration-200 ${
              activeTab === 'broadcast'
                ? 'bg-surface-raised text-brand-600 shadow-sm border border-border-subtle'
                : 'text-text-secondary hover:text-text-secondary'
            }`}
          >
            お知らせを送る
          </Button>
        </div>

        {/* TAB: Members */}
        {activeTab === 'members' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">会員ごとのアプリ通知</h2>
                  <p className="mt-1 text-xs text-text-secondary">このスイッチ1つで、予約の確定・変更連絡と前日リマインダー、オンラインレッスン開始前の通知すべてを制御します。</p>
                  <p className="mt-0.5 text-xs text-text-muted">メール送信は行わず、アプリのプッシュ通知だけで届きます。</p>
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
                    うち{notificationStats.missingDeviceCount}名は通知ONですが、会員さん側でスマホの通知許可がまだのため届きません。
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setAllMembers(true)}
                  className="px-4 py-2 text-xs rounded-2xl bg-brand-500/15 text-brand-300 border border-brand-500/20 hover:bg-brand-500/25"
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
                                      ? 'bg-state-success-500/15 text-state-success-300'
                                      : member.pushEnabled
                                        ? 'bg-amber-500/15 text-amber-300'
                                        : 'bg-surface-overlay text-text-muted'
                                  }`}>
                                    {receivable ? '受信可能' : member.pushEnabled ? '未許可' : 'OFF'}
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
                className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-2xl text-sm font-medium disabled:opacity-50 disabled:hover:bg-brand-700 transition-colors flex w-full items-center justify-center gap-2 shadow-md shadow-brand-500/10"
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
        )}

        {/* TAB: Reminder timing */}
        {activeTab === 'reminder' && (
          <form onSubmit={handleSave} className="space-y-6 animate-fadeIn">
            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-6 space-y-6">
              <div className="space-y-4 border-b border-border-subtle pb-6">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  パーソナルセッション前日リマインダー
                </h3>

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
                  <p className="pl-7 text-xs text-text-muted">※ 通知ONかつスマホ側で許可済みの会員様にのみ届きます。</p>
                  <p className="pl-7 text-xs text-text-muted">毎晩21:00に、翌日ご予約のある会員様へまとめて送信します（サーバー側の制約で1日1回のみ）。</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  オンラインレッスン用自動リマインダー設定
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    リマインダー自動送信タイミング
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

            <div className="bg-surface-raised p-4 rounded-2xl shadow-sm border border-border-subtle flex justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/dashboard?tab=others')}
                className="px-5 py-2.5 border border-border-strong hover:bg-surface-base text-text-secondary rounded-2xl text-sm font-medium transition-colors flex-1 text-center"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !tableExists}
                className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-2xl text-sm font-medium disabled:opacity-50 disabled:hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 flex-[2] shadow-md shadow-brand-500/10"
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

        {/* TAB: Broadcast (お知らせを送る) */}
        {activeTab === 'broadcast' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">お知らせを送る</h2>
                <p className="mt-1 text-xs text-text-secondary">アプリ通知ONの会員全員に、その場で自由な内容を配信します(テンプレートはありません)。</p>
              </div>

              {broadcastError && (
                <div className="p-3 bg-state-danger-500/15 border border-state-danger-500/25 rounded-2xl text-sm text-state-danger-300">
                  {broadcastError}
                </div>
              )}
              {broadcastResult && (
                <div className="p-3 bg-state-success-500/15 border border-state-success-500/25 rounded-2xl text-sm text-state-success-300">
                  配信しました({broadcastResult.successCount} / {broadcastResult.targetCount}名に到達)
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">配信先</label>
                <div className="flex gap-2">
                  {([
                    { key: 'all', label: '全員' },
                    { key: 'lesson', label: 'オンラインレッスン' },
                    { key: 'individual', label: '個別選択' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setBroadcastTargetMode(opt.key)}
                      className={`flex-1 py-2 text-xs font-medium rounded-2xl border transition-colors ${
                        broadcastTargetMode === opt.key
                          ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                          : 'bg-surface-base text-text-secondary border-border-subtle hover:bg-surface-overlay'
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
                    <p className="text-xs text-text-muted">{selectedMemberIds.length}名選択中(通知ONの会員のみ表示)</p>
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

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">タイトル</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="例: オンラインセッション時間変更のお知らせ"
                  className="w-full min-w-0 max-w-full box-border px-4 py-2.5 border border-border-strong rounded-2xl text-sm bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">本文</label>
                <textarea
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  rows={4}
                  placeholder="例: 本日19時からのオンラインセッションを20時に変更します。"
                  className="w-full min-w-0 max-w-full box-border px-4 py-2.5 border border-border-strong rounded-2xl text-sm bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={broadcastImportant}
                  onChange={(e) => setBroadcastImportant(e.target.checked)}
                  className="w-4.5 h-4.5 text-brand-600 border-border-strong rounded-lg focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-sm font-normal text-text-secondary">重要なお知らせとして送る(タイトルに「【重要】」を付ける)</span>
              </label>

              <Button
                type="button"
                variant="primary"
                onClick={handleSendBroadcast}
                disabled={broadcastSending}
                className="w-full px-6 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-2xl text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md shadow-brand-500/10"
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

            <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-subtle p-6 space-y-3">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">配信履歴</h3>
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
          </div>
        )}
      </div>
    </div>
  )
}
