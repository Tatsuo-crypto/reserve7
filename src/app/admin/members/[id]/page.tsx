'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

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

  // R-2: アイコン背景は装飾色ではなく常にニュートラル(surface.overlay相当)。
  // 項目同士の区別はラベルとアイコン形状のみに任せ、色・グラデーション・blurは使わない。
  // hoverもN-4/R-1の規律どおり「背景色が1段変わる」のみ(拡大・浮き上がりは廃止)。
  const actionCardClass = 'flex flex-col items-center justify-center hover:bg-surface-base transition-colors'
  const actionCardDisabledClass = 'flex flex-col items-center justify-center opacity-50 cursor-not-allowed'

  return (
    <div className="min-h-screen bg-surface-base pt-4 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Action Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {/* Copy URL Card */}
          {member.accessToken ? (
            <button
              onClick={() => {
                const url = `${window.location.origin}/client/${member.accessToken}`
                navigator.clipboard.writeText(url)
                setCopySuccess('コピー完了')
                setTimeout(() => setCopySuccess(''), 2000)
              }}
            >
              <Card padding="sm" className={actionCardClass}>
                <div className="h-14 w-14 bg-surface-overlay text-text-secondary rounded-2xl flex items-center justify-center mb-4">
                  <Icon name="copy" size={28} />
                </div>
                <span className="text-sm font-normal text-text-primary tracking-tight">{copySuccess || 'URLをコピー'}</span>
              </Card>
            </button>
          ) : (
            <Card padding="sm" className={actionCardDisabledClass}>
              <div className="h-14 w-14 bg-surface-overlay text-text-muted rounded-2xl flex items-center justify-center mb-4">
                <Icon name="lock" size={28} />
              </div>
              <span className="text-sm font-normal text-text-muted">URL未設定</span>
            </Card>
          )}

          {/* Edit Member Card */}
          <Link href={`/admin/members/${memberId}/edit`}>
            <Card padding="sm" className={actionCardClass}>
              <div className="h-14 w-14 bg-surface-overlay text-text-secondary rounded-2xl flex items-center justify-center mb-4">
                <Icon name="pencil" size={28} />
              </div>
              <span className="text-sm font-normal text-text-primary tracking-tight">会員情報</span>
            </Card>
          </Link>

          {/* Check Client View Card */}
          {member.accessToken ? (
            <a
              href={`/client/${member.accessToken}?from=admin`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card padding="sm" className={actionCardClass}>
                <div className="h-14 w-14 bg-surface-overlay text-text-secondary rounded-2xl flex items-center justify-center mb-4">
                  <Icon name="eye" size={28} />
                </div>
                <span className="text-sm font-normal text-text-primary tracking-tight">会員画面確認</span>
              </Card>
            </a>
          ) : (
            <Card padding="sm" className={actionCardDisabledClass}>
              <div className="h-14 w-14 bg-surface-overlay text-text-muted rounded-2xl flex items-center justify-center mb-4">
                <Icon name="linkSlash" size={28} />
              </div>
              <span className="text-sm font-normal text-text-muted">会員画面なし</span>
            </Card>
          )}

          {/* Monthly Plan History Card */}
          <Link href={`/admin/members/${memberId}/history`}>
            <Card padding="sm" className={actionCardClass}>
              <div className="h-14 w-14 bg-surface-overlay text-text-secondary rounded-2xl flex items-center justify-center mb-4">
                <Icon name="clipboardList" size={28} />
              </div>
              <span className="text-sm font-normal text-text-primary tracking-tight">月額プラン</span>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
