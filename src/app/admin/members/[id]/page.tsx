'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Icon, { IconName } from '@/components/ui/icons'

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
        <Icon name={iconName} size={20} className="shrink-0 text-text-secondary transition-colors group-hover:text-brand-300" />
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
      : 'bg-surface-overlay text-text-primary hover:bg-brand-500/15 hover:text-brand-300'
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

export default function MemberDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const memberId = params.id

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState('')

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
          status: m.status
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

  const statusLabel = (status?: string) => {
    if (status === 'active') return '在籍'
    if (status === 'suspended') return '休会'
    if (status === 'withdrawn') return '退会'
    return '未設定'
  }

  const statusClassName = (status?: string) => {
    if (status === 'active') return 'bg-brand-500/15 text-brand-300'
    if (status === 'suspended') return 'bg-yellow-500/15 text-yellow-300'
    if (status === 'withdrawn') return 'bg-surface-overlay text-text-muted'
    return 'bg-surface-overlay text-text-secondary'
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
        <section className="mb-8">
          <div className="relative flex items-start justify-center">
            <h1 className="ui-nowrap max-w-[calc(100%-5rem)] overflow-x-auto text-center text-3xl font-normal tracking-tight text-text-primary">
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
                <div className="ui-nowrap mt-2 overflow-x-auto text-2xl font-normal leading-tight text-text-primary">
                  {member.plan || '未設定'}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-normal text-text-muted">料金</div>
                <div className="mt-2 whitespace-nowrap text-lg font-normal text-text-primary">
                  {formatYen(member.monthlyFee)} / 月
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-brand-500" />
              <h2 className="text-base font-normal text-text-primary">管理</h2>
            </div>
            <div className="space-y-3">
              <MemberActionRow
                href={`/admin/members/${memberId}/edit`}
                label="会員情報"
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
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-brand-500" />
              <h2 className="text-base font-normal text-text-primary">招待URL</h2>
            </div>
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
    </div>
  )
}
