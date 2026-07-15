'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import Icon, { IconName } from '@/components/ui/icons'

interface MemberDetail {
  id: string
  fullName: string
  email: string
  plan?: string
  accessToken?: string
  memo?: string
  createdAt?: string
  googleCalendarEmail?: string
  status?: string
}

function MemberGridItem({
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
  const className = `group flex min-h-[106px] flex-col items-center justify-start rounded-2xl px-2 py-3 text-center transition-colors ${
    disabled
      ? 'cursor-not-allowed opacity-40'
      : 'active:scale-[0.98] hover:bg-surface-raised/50'
  }`
  const content = (
    <>
      <div className="flex h-12 items-center justify-center text-text-secondary transition-colors group-hover:text-text-primary">
        <Icon name={iconName} size={40} />
      </div>
      <div className="mt-2 text-[12px] font-normal leading-snug text-text-secondary transition-colors group-hover:text-text-primary">
        {label}
      </div>
    </>
  )

  if (disabled) {
    return <div className={className}>{content}</div>
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
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

export default function MemberDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPage = searchParams.get('from') // 'sales' or null
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
        if (!memberRes.ok) throw new Error('会員情報の取得に失敗しました')
        const memberJson = await memberRes.json()
        const m = memberJson.data
        if (!m) throw new Error('会員が見つかりません')
        setMember({ 
          id: m.id, 
          fullName: m.full_name, 
          email: m.email, 
          plan: m.plan,
          accessToken: m.access_token,
          memo: m.memo,
          createdAt: m.created_at,
          googleCalendarEmail: m.google_calendar_email,
          status: m.status
        })

      } catch (e: any) {
        setError(e.message || '読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, status, memberId, router])

  const pathname = usePathname()
  useEffect(() => {
    if (member && !searchParams.get('name')) {
      const lastName = member.fullName.split(/[\s　]+/)[0]
      const params = new URLSearchParams(searchParams.toString())
      params.set('name', lastName)
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [member, searchParams, router, pathname])

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4">
          {member.accessToken ? (
            <MemberGridItem
              label={copySuccess || 'URLコピー'}
              iconName="copy"
              onClick={() => {
                const url = `${window.location.origin}/client/${member.accessToken}`
                navigator.clipboard.writeText(url)
                setCopySuccess('コピー完了')
                setTimeout(() => setCopySuccess(''), 2000)
              }}
            />
          ) : (
            <MemberGridItem label="URL未設定" iconName="lock" disabled />
          )}

          <MemberGridItem
            href={`/admin/members/${memberId}/edit`}
            label="会員情報"
            iconName="pencil"
          />

          {member.accessToken ? (
            <MemberGridItem
              href={`/client/${member.accessToken}?from=admin`}
              label="会員画面"
              iconName="eye"
              external
            />
          ) : (
            <MemberGridItem label="会員画面なし" iconName="linkSlash" disabled />
          )}

          <MemberGridItem
            href={`/admin/members/${memberId}/history`}
            label="月額プラン"
            iconName="clipboardList"
          />
        </div>
      </div>
    </div>
  )
}
