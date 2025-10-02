'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ReservationItem {
  id: string
  title: string
  startTime: string
  endTime: string
  notes?: string
}

interface MemberDetail {
  id: string
  fullName: string
  email: string
  plan?: string
}

export default function MemberDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const memberId = params.id

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        // Fetch members list then filter one (reuse existing API)
        const memberRes = await fetch('/api/admin/members')
        if (!memberRes.ok) throw new Error('会員情報の取得に失敗しました')
        const memberJson = await memberRes.json()
        const m = (memberJson.data?.members || []).find((x: any) => x.id === memberId)
        if (!m) throw new Error('会員が見つかりません')
        setMember({ id: m.id, fullName: m.full_name, email: m.email, plan: m.plan })

        // Fetch reservations and filter by client
        const res = await fetch('/api/reservations')
        if (!res.ok) throw new Error('予約の取得に失敗しました')
        const resJson = await res.json()
        const all = resJson.data?.reservations || resJson.reservations || []
        const filtered = all.filter((r: any) => r.client?.id === memberId)
        setReservations(filtered.map((r: any) => ({
          id: r.id,
          title: r.title,
          startTime: r.startTime || r.start_time,
          endTime: r.endTime || r.end_time,
          notes: r.notes
        })))
      } catch (e: any) {
        setError(e.message || '読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, status, memberId, router])

  const formatDate = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  const formatTime = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">読み込み中...</div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>
    )
  }

  if (!member) return null

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <Link href="/admin/members" className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-bold text-gray-900">{member.fullName}</h1>
              <p className="mt-1 text-gray-600">{member.email}・{member.plan || 'プラン未設定'}</p>
            </div>
            <div className="w-6" />
          </div>
        </div>

        {/* Reservations list */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {reservations.length === 0 ? (
              <div className="text-center text-gray-500">予約がありません</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-max divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メモ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reservations.map((r) => (
                      <tr key={r.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(r.startTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatTime(r.startTime)} - {formatTime(r.endTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
