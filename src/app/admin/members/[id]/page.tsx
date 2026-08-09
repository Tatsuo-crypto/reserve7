'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Icon, { IconName } from '@/components/ui/icons'
import { getPlanBillingLabel, isDietPlan, isPersonalPlan } from '@/lib/constants'

interface MemberDetail {
  id: string
  fullName: string
  email: string
  plan?: string
  monthlyFee?: number
  accessToken?: string
  memo?: string
  createdAt?: string
  googleCalendarEmail?: string
  status?: string
  onlineReminderEnabled?: boolean
  pushNotificationEnabled?: boolean
  pushSubscriptionCount?: number
  dietSupportEnabled?: boolean
  lifestyleSettings?: LifestyleSettings | null
  nextReservation?: ReservationSummary | null
  recentTrainingSessions?: TrainingSessionSummary[]
}

type LifestyleSettings = {
  visible_items?: Record<string, boolean>
  visible_tabs?: Record<string, boolean>
  quit_goals?: unknown[]
  habit_targets?: Record<string, unknown>
}

type ReservationSummary = {
  id: string
  title?: string | null
  start_time: string
  end_time?: string | null
  notes?: string | null
}

type TrainingSessionSummary = {
  id: string
  sessionDate: string
  sessionType?: string | null
  trainerName?: string | null
  exerciseCount?: number
}

const DEFAULT_LIFESTYLE_SETTINGS: LifestyleSettings = {
  visible_items: { steps: false, sleep: false, water: false, alcohol: false, workout: false },
  visible_tabs: { input: false, analyze: false, progress: false },
  quit_goals: [],
  habit_targets: {},
}

function MemberActionRow({
  label,
  iconName,
  href,
  onClick,
  disabled = false,
  external = false,
}: {
  label: string
  iconName: IconName
  href?: string
  onClick?: () => void
  disabled?: boolean
  external?: boolean
}) {
  const className = `group flex w-full items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-4 text-left transition-colors ${
    disabled
      ? 'cursor-not-allowed opacity-40'
      : 'active:scale-[0.99] hover:bg-surface-overlay/60'
  }`
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <Icon name={iconName} size={20} className="shrink-0 text-text-secondary transition-colors group-hover:text-brand-600" />
        <span className="ui-nowrap text-sm font-normal text-text-primary">{label}</span>
      </div>
      <Icon name="chevronRight" size={16} className="shrink-0 text-text-muted" />
    </>
  )

  if (disabled) {
    return <div className={className}>{content}</div>
  }

  if (onClick) {
    return (
      <Button type="button" variant="ghost" onClick={onClick} className={className}>
        {content}
      </Button>
    )
  }

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    )
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}

function InlineActionButton({
  label,
  onClick,
  href,
  disabled = false,
}: {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}) {
  const className = `rounded-full px-4 py-2 text-xs font-normal transition-colors ${
    disabled
      ? 'cursor-not-allowed bg-surface-overlay text-text-muted opacity-60'
      : 'bg-surface-overlay text-text-primary hover:bg-brand-500/15 hover:text-brand-600'
  }`

  if (href && !disabled) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    )
  }

  return (
    <Button type="button" variant="ghost" onClick={onClick} disabled={disabled} className={className}>
      {label}
    </Button>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="h-5 w-1 rounded-full bg-brand-500" />
      <h2 className="text-xl font-semibold text-text-primary">{children}</h2>
    </div>
  )
}

function StatusRow({
  label,
  value,
  subValue,
  iconName,
  onClick,
}: {
  label: string
  value: string
  subValue?: string
  iconName: IconName
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <Icon name={iconName} size={20} className="shrink-0 text-text-secondary" />
        <div className="min-w-0">
          <div className="text-xs font-normal text-text-muted">{label}</div>
          <div className="ui-nowrap mt-1 overflow-hidden text-ellipsis text-sm font-normal text-text-primary">{value}</div>
          {subValue && <div className="ui-nowrap mt-0.5 overflow-hidden text-ellipsis text-xs font-normal text-text-secondary">{subValue}</div>}
        </div>
      </div>
      {onClick && <Icon name="chevronRight" size={16} className="shrink-0 text-text-muted" />}
    </>
  )

  if (onClick) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-4 text-left active:scale-[0.99]"
      >
        {content}
      </Button>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-4">
      {content}
    </div>
  )
}

export default function MemberDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const memberId = params.id

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState('')
  const [dietModalOpen, setDietModalOpen] = useState(false)
  const [dietSaving, setDietSaving] = useState(false)
  const [dietError, setDietError] = useState('')
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [notificationError, setNotificationError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }

    const fetchData = async () => {
      try {
        // Fetch member by ID directly
        const memberRes = await fetch(`/api/admin/members/${memberId}`)
        if (!memberRes.ok) throw new Error('会員情報を取得できませんでした。画面を再読み込みしてください。')
        const memberJson = await memberRes.json()
        const m = memberJson.data
        if (!m) throw new Error('会員が見つかりません')
        setMember({ 
          id: m.id, 
          fullName: m.full_name, 
          email: m.email, 
          plan: m.plan,
          monthlyFee: m.monthly_fee,
          accessToken: m.access_token,
          memo: m.memo,
          createdAt: m.created_at,
          googleCalendarEmail: m.google_calendar_email,
          status: m.status,
          onlineReminderEnabled: m.online_reminder_enabled,
          pushNotificationEnabled: m.push_notification_enabled,
          pushSubscriptionCount: m.push_subscription_count || 0,
          dietSupportEnabled: m.diet_support_enabled === true,
          lifestyleSettings: m.lifestyle_settings || null,
          nextReservation: m.next_reservation || null,
          recentTrainingSessions: m.recent_training_sessions || [],
        })

      } catch (e: any) {
        setError(e.message || '読み込めませんでした。画面を再読み込みしてください。')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, status, memberId, router])

  const formatYen = (value?: number) => {
    if (!value) return '未設定'
    return `${value.toLocaleString('ja-JP')}円`
  }

  const formatPlanFee = (member: MemberDetail) => {
    const fee = formatYen(member.monthlyFee)
    if (fee === '未設定') return fee
    return isDietPlan(member.plan) ? fee : `${fee} / 月`
  }

  const hasDietSupport = (member: MemberDetail) => member.dietSupportEnabled || isDietPlan(member.plan)

  const statusLabel = (status?: string) => {
    if (status === 'active') return '在籍'
    if (status === 'suspended') return '休会'
    if (status === 'withdrawn') return '退会'
    return '未設定'
  }

  const statusClassName = (status?: string) => {
    if (status === 'active') return 'bg-brand-500/15 text-brand-600'
    if (status === 'suspended') return 'bg-yellow-500/15 text-yellow-700'
    if (status === 'withdrawn') return 'bg-surface-overlay text-text-muted'
    return 'bg-surface-overlay text-text-secondary'
  }

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '未設定'
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
    const time = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${month}/${day}(${weekday}) ${time}`
  }

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return '未設定'
    const date = new Date(`${dateStr}T00:00:00`)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
    return `${month}/${day}(${weekday})`
  }

  const notificationLabel = (member?: MemberDetail | null) => {
    if (!member?.pushNotificationEnabled) return 'OFF'
    if ((member.pushSubscriptionCount || 0) > 0) return '受信可能'
    return '端末設定待ち'
  }

  const notificationSubValue = (member?: MemberDetail | null) => {
    if (!member?.pushNotificationEnabled) return '管理者側OFF'
    if ((member.pushSubscriptionCount || 0) > 0) return '端末登録済み'
    return 'スマホ側の許可が必要'
  }

  const saveNotificationSetting = async (enabled: boolean) => {
    if (!member) return
    setNotificationSaving(true)
    setNotificationError('')

    try {
      const res = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          pushNotificationEnabled: enabled,
        }),
      })

      if (!res.ok) throw new Error('アプリ通知を更新できませんでした')

      setMember(prev => prev ? {
        ...prev,
        pushNotificationEnabled: enabled,
      } : prev)
      setNotificationModalOpen(false)
    } catch (e: any) {
      setNotificationError(e.message || '更新に失敗しました')
    } finally {
      setNotificationSaving(false)
    }
  }

  const saveDietSupport = async (enabled: boolean) => {
    if (!member) return
    setDietSaving(true)
    setDietError('')

    const currentSettings = member.lifestyleSettings || DEFAULT_LIFESTYLE_SETTINGS
    const nextVisibleTabs = {
      ...(currentSettings.visible_tabs || DEFAULT_LIFESTYLE_SETTINGS.visible_tabs),
      input: enabled,
      analyze: enabled,
      progress: enabled,
    }
    const nextVisibleItems = {
      ...(currentSettings.visible_items || DEFAULT_LIFESTYLE_SETTINGS.visible_items),
      steps: enabled,
      sleep: enabled,
      water: enabled,
      alcohol: enabled,
      workout: enabled,
    }

    try {
      const res = await fetch('/api/lifestyle/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: memberId,
          visibleItems: nextVisibleItems,
          visibleTabs: nextVisibleTabs,
          quit_goals: currentSettings.quit_goals || [],
          habit_targets: currentSettings.habit_targets || {},
        }),
      })

      if (!res.ok) throw new Error('ダイエットサポートを更新できませんでした')

      setMember(prev => prev ? {
        ...prev,
        dietSupportEnabled: enabled,
        lifestyleSettings: {
          ...currentSettings,
          visible_items: nextVisibleItems,
          visible_tabs: nextVisibleTabs,
        },
      } : prev)
      setDietModalOpen(false)
    } catch (e: any) {
      setDietError(e.message || '更新に失敗しました')
    } finally {
      setDietSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-secondary font-normal tracking-widest uppercase">読み込み中...</div>
    )
  }

  if (error || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-normal tracking-widest uppercase">{error || '会員が見つかりません'}</div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base pt-4 pb-12">
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        <section className="mb-7">
          <div className="relative flex items-start justify-center">
            <h1 className="ui-nowrap max-w-[calc(100%-5rem)] overflow-hidden text-ellipsis text-center text-3xl font-normal tracking-tight text-text-primary">
              {member.fullName}
            </h1>
            <span className={`ui-nowrap absolute right-0 top-1 shrink-0 rounded-full px-3 py-1 text-xs font-normal ${statusClassName(member.status)}`}>
              {statusLabel(member.status)}
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-normal text-text-muted">契約</div>
                <div className="ui-nowrap mt-2 max-w-[13rem] overflow-hidden text-ellipsis text-xl font-semibold leading-tight text-text-primary">
                  {member.plan || '未設定'}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-normal text-text-muted">料金</div>
                <div className="mt-2 whitespace-nowrap text-sm font-semibold text-text-primary">
                  {formatPlanFee(member)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-7">
          <section>
            <SectionTitle>状態</SectionTitle>
            <div className="space-y-3">
              <StatusRow
                label="パーソナル"
                value={isPersonalPlan(member.plan) ? '利用中' : '利用なし'}
                subValue={isPersonalPlan(member.plan) ? `${member.plan} / ${getPlanBillingLabel(member.plan)}` : '未契約'}
                iconName="user"
              />
              <StatusRow
                label="ダイエットサポート"
                value={hasDietSupport(member) ? '利用中' : '利用なし'}
                subValue={hasDietSupport(member) ? '3ヶ月 / 払い切り' : '会員画面は予約中心'}
                iconName="heart"
                onClick={() => {
                  setDietError('')
                  setDietModalOpen(true)
                }}
              />
              <StatusRow
                label="アプリ通知"
                value={notificationLabel(member)}
                subValue={notificationSubValue(member)}
                iconName="bell"
                onClick={() => {
                  setNotificationError('')
                  setNotificationModalOpen(true)
                }}
              />
              <StatusRow
                label="次回予約"
                value={member.nextReservation ? (member.nextReservation.title || '予約') : '未定'}
                subValue={member.nextReservation ? formatDateTime(member.nextReservation.start_time) : undefined}
                iconName="calendar"
              />
            </div>
          </section>

          <section>
            <SectionTitle>カルテ</SectionTitle>
            <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
              <div className="space-y-3">
                {(member.recentTrainingSessions || []).length > 0 ? (
                  member.recentTrainingSessions!.map(session => (
                    <Link
                      key={session.id}
                      href={`/admin/karte/${session.id}?back=${encodeURIComponent(`/admin/members/${memberId}`)}`}
                      className="flex items-center justify-between gap-4 rounded-xl bg-surface-base px-4 py-3 active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-normal text-text-primary">{formatDateOnly(session.sessionDate)}</div>
                        <div className="mt-0.5 text-xs font-normal text-text-secondary">
                          {session.trainerName || '担当未設定'} ・ {session.exerciseCount || 0}種目
                        </div>
                      </div>
                      <Icon name="chevronRight" size={16} className="shrink-0 text-text-muted" />
                    </Link>
                  ))
                ) : (
                  <div className="rounded-xl bg-surface-base px-4 py-4 text-sm font-normal text-text-secondary">
                    まだカルテがありません
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href={`/admin/karte/new?userId=${memberId}&back=${encodeURIComponent(`/admin/members/${memberId}`)}`}
                  className="rounded-full bg-brand-500/15 px-4 py-3 text-center text-xs font-normal text-brand-600"
                >
                  カルテを書く
                </Link>
                <Link
                  href={`/admin/members/${memberId}/karte`}
                  className="rounded-full bg-surface-overlay px-4 py-3 text-center text-xs font-normal text-text-primary"
                >
                  すべて見る
                </Link>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle>管理</SectionTitle>
            <div className="space-y-3">
              <MemberActionRow
                href={`/admin/members/${memberId}/edit`}
                label="基本情報・契約"
                iconName="pencil"
              />
              <MemberActionRow
                href={`/admin/members/${memberId}/history`}
                label="月額プラン"
                iconName="clipboardList"
              />
            </div>
          </section>

          <section>
            <SectionTitle>招待URL</SectionTitle>
            <div className="space-y-3">
              {member.accessToken ? (
                <MemberActionRow
                  href={`/client/${member.accessToken}?from=admin`}
                  label="会員画面を確認"
                  iconName="eye"
                  external
                />
              ) : (
                <MemberActionRow label="会員画面なし" iconName="linkSlash" disabled />
              )}

              <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon name="copy" size={18} className="shrink-0 text-text-secondary" />
                    <span className="text-sm font-normal text-text-primary">会員ページURL</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <InlineActionButton
                      label={copySuccess || 'コピー'}
                      disabled={!member.accessToken}
                      onClick={() => {
                        const url = `${window.location.origin}/client/${member.accessToken}`
                        navigator.clipboard.writeText(url)
                        setCopySuccess('コピー完了')
                        setTimeout(() => setCopySuccess(''), 2000)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {dietModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-border-subtle bg-surface-raised p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">ダイエットサポート</h2>
                <p className="mt-1 text-sm font-normal text-text-secondary">会員画面の表示を変更します</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDietModalOpen(false)}
                className="h-10 w-10 shrink-0 rounded-full bg-surface-overlay p-0 text-text-secondary"
                aria-label="閉じる"
              >
                <Icon name="close" size={18} />
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              <Button
                type="button"
                variant="ghost"
                disabled={dietSaving}
                onClick={() => saveDietSupport(true)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${
                  member.dietSupportEnabled
                    ? 'border-brand-500/50 bg-brand-500/15 text-text-primary'
                    : 'border-border-subtle bg-surface-base text-text-primary'
                }`}
              >
                <span className="text-sm font-normal">利用する</span>
                {member.dietSupportEnabled && <Icon name="check" size={18} className="text-brand-600" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={dietSaving}
                onClick={() => saveDietSupport(false)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${
                  !member.dietSupportEnabled
                    ? 'border-brand-500/50 bg-brand-500/15 text-text-primary'
                    : 'border-border-subtle bg-surface-base text-text-primary'
                }`}
              >
                <span className="text-sm font-normal">利用しない</span>
                {!member.dietSupportEnabled && <Icon name="check" size={18} className="text-brand-600" />}
              </Button>
            </div>

            {dietError && <p className="mt-4 text-sm font-normal text-red-600">{dietError}</p>}
          </div>
        </div>
      )}

      {notificationModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-border-subtle bg-surface-raised p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">アプリ通知</h2>
                <p className="mt-1 text-sm font-normal text-text-secondary">{notificationLabel(member)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNotificationModalOpen(false)}
                className="h-10 w-10 shrink-0 rounded-full bg-surface-overlay p-0 text-text-secondary"
                aria-label="閉じる"
              >
                <Icon name="close" size={18} />
              </Button>
            </div>

            <div className="mt-5 rounded-2xl bg-surface-base p-4">
              <div className="flex flex-wrap gap-2">
                {['予約確定', '変更', 'キャンセル', 'リマインダー'].map(item => (
                  <span key={item} className="rounded-full bg-surface-overlay px-3 py-1 text-xs font-normal text-text-primary">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs font-normal text-text-secondary">
                {notificationSubValue(member)}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <Button
                type="button"
                variant="ghost"
                disabled={notificationSaving}
                onClick={() => saveNotificationSetting(true)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${
                  member.pushNotificationEnabled
                    ? 'border-brand-500/50 bg-brand-500/15 text-text-primary'
                    : 'border-border-subtle bg-surface-base text-text-primary'
                }`}
              >
                <span className="text-sm font-normal">ON</span>
                {member.pushNotificationEnabled && <Icon name="check" size={18} className="text-brand-600" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={notificationSaving}
                onClick={() => saveNotificationSetting(false)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${
                  !member.pushNotificationEnabled
                    ? 'border-brand-500/50 bg-brand-500/15 text-text-primary'
                    : 'border-border-subtle bg-surface-base text-text-primary'
                }`}
              >
                <span className="text-sm font-normal">OFF</span>
                {!member.pushNotificationEnabled && <Icon name="check" size={18} className="text-brand-600" />}
              </Button>
            </div>

            {notificationError && <p className="mt-4 text-sm font-normal text-red-600">{notificationError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
