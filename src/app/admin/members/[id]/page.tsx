'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'

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
      <div className="min-h-screen flex items-center justify-center text-gray-600 font-normal tracking-widest uppercase">読み込み中...</div>
    )
  }

  if (error || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-normal tracking-widest uppercase">{error || '会員が見つかりません'}</div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4 pb-12">
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
              className="group relative bg-gradient-to-br from-white to-blue-50/50 p-6 rounded-3xl shadow-sm border border-blue-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col items-center justify-center overflow-hidden"
            >
              <div className="h-14 w-14 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-normal text-gray-900 tracking-tight">{copySuccess || 'URLをコピー'}</span>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-blue-100/30 rounded-full blur-2xl group-hover:bg-blue-200/50 transition-colors"></div>
            </button>
          ) : (
            <div className="bg-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center opacity-50 cursor-not-allowed">
               <div className="h-14 w-14 bg-gray-100 text-gray-300 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-sm font-normal text-gray-400">URL未設定</span>
            </div>
          )}

          {/* Edit Member Card */}
          <Link
            href={`/admin/members/${memberId}/edit`}
            className="group relative bg-gradient-to-br from-white to-emerald-50/50 p-6 rounded-3xl shadow-sm border border-emerald-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="h-14 w-14 bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="text-sm font-normal text-gray-900 tracking-tight">会員情報</span>
            <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-emerald-100/30 rounded-full blur-2xl group-hover:bg-emerald-200/50 transition-colors"></div>
          </Link>

          {/* Check Client View Card */}
          {member.accessToken ? (
            <a
              href={`/client/${member.accessToken}?from=admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative bg-gradient-to-br from-white to-purple-50/50 p-6 rounded-3xl shadow-sm border border-purple-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col items-center justify-center overflow-hidden"
            >
              <div className="h-14 w-14 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="text-sm font-normal text-gray-900 tracking-tight">会員画面確認</span>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-100/30 rounded-full blur-2xl group-hover:bg-purple-200/50 transition-colors"></div>
            </a>
          ) : (
            <div className="bg-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center opacity-50 cursor-not-allowed">
              <div className="h-14 w-14 bg-gray-100 text-gray-300 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span className="text-sm font-normal text-gray-400">会員画面なし</span>
            </div>
          )}

          {/* Monthly Plan History Card */}
          <Link
            href={`/admin/members/${memberId}/history`}
            className="group relative bg-gradient-to-br from-white to-orange-50/50 p-6 rounded-3xl shadow-sm border border-orange-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="h-14 w-14 bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <span className="text-sm font-normal text-gray-900 tracking-tight">月額プラン</span>
            <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-orange-100/30 rounded-full blur-2xl group-hover:bg-orange-200/50 transition-colors"></div>
          </Link>
        </div>
      </div>
    </div>
  )
}
