'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, addMonths, startOfMonth, parseISO } from 'date-fns'
import { PLAN_LIST, PLAN_FEES } from '@/lib/constants'

interface PaymentItem {
  month: string
  plan: string
  expectedAmount: number
  actualAmount: number | null
  status: 'paid' | 'unpaid' | 'future' | 'n/a'
  paymentDate: string | null
  targetDate: string | null
  membershipStatus: string
  memo?: string
}

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
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState('')

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null)
  const [editForm, setEditForm] = useState({
    plan: '',
    monthlyFee: '',
    status: 'active',
    paymentDate: '',
    memo: ''
  })
  const [saving, setSaving] = useState(false)

  const fetchPayments = async () => {
    try {
      const payRes = await fetch(`/api/admin/members/${memberId}/payments`)
      if (payRes.ok) {
        const payJson = await payRes.json()
        setPayments(payJson.data?.payments || [])
      }
    } catch (e) {
      console.error('Failed to fetch payments', e)
    }
  }

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

        // Fetch payment history
        await fetchPayments()

      } catch (e: any) {
        setError(e.message || '読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, status, memberId, router])

  const handleEditClick = (item: PaymentItem) => {
    setEditingItem(item)
    
    let initialPlan = item.plan || '月4回'
    // If membershipStatus is suspended, treat plan as "休会"
    if (item.membershipStatus === 'suspended') {
      initialPlan = '休会'
    } else if (item.membershipStatus === 'withdrawn') {
      initialPlan = '退会'
    }

    setEditForm({
      plan: initialPlan,
      monthlyFee: item.expectedAmount ? String(item.expectedAmount) : '',
      status: item.membershipStatus, // Use membershipStatus for form status
      paymentDate: item.paymentDate ? item.paymentDate.split('T')[0] : '',
      memo: item.memo || ''
    })
  }

  const handleSaveMonth = async () => {
    if (!editingItem) return
    setSaving(true)
    
    // Derive status from plan
    let newStatus = 'active'
    if (editForm.plan === '休会') {
      newStatus = 'suspended'
    } else if (editForm.plan === '退会') {
      newStatus = 'withdrawn'
    }

    try {
      const payload = {
        month: editingItem.month,
        plan: editForm.plan,
        monthlyFee: parseInt(editForm.monthlyFee) || 0,
        status: newStatus,
        paymentDate: editForm.paymentDate || null,
        memo: editForm.memo || null
      }
      console.log('Saving monthly plan with memo:', payload)
      
      const res = await fetch(`/api/admin/members/${memberId}/monthly-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json()
        alert(`保存に失敗しました: ${err.error}`)
        return
      }

      // Success
      setEditingItem(null)
      await fetchPayments() // Refresh list
    } catch (e) {
      console.error(e)
      alert('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMonth = () => {
    // Default to the month after the latest one in payments (highest month since it's reversed)
    let nextMonth: Date
    if (payments.length > 0) {
      // payment.month is 'yyyy-MM', so sort by string comparison or use index 0 as highest if sorted
      // In the table it's newest first, but the underlying data might be anything.
      // Filter out 'future' status if needed, but let's just take the max month.
      const months = payments.map(p => p.month).sort()
      const latestMonthStr = months[months.length - 1]
      nextMonth = addMonths(parseISO(`${latestMonthStr}-01`), 1)
    } else {
      nextMonth = startOfMonth(new Date())
    }

    const monthStr = format(nextMonth, 'yyyy-MM')
    
    // Create a new item object
    const newItem: PaymentItem = {
      month: monthStr,
      plan: member?.plan || '月4回',
      expectedAmount: member?.plan ? (PLAN_FEES[member.plan] || 0) : (PLAN_FEES['月4回'] || 13200),
      actualAmount: null,
      status: 'future',
      paymentDate: null,
      targetDate: null,
      membershipStatus: 'active'
    }

    setEditingItem(newItem)
    setEditForm({
      plan: newItem.plan,
      monthlyFee: String(newItem.expectedAmount),
      status: 'active',
      paymentDate: '',
      memo: ''
    })
  }

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
  
  const formatMonth = (ym: string) => {
    const [y, m] = ym.split('-')
    return `${y}年${parseInt(m)}月`
  }

  // Calculate totals
  const totalAmount = payments.reduce((sum, p) => sum + (p.expectedAmount || 0), 0)
  // Duration: Count months where expectedAmount > 0 (Active paying months)
  const duration = payments.filter(p => (p.expectedAmount || 0) > 0).length

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
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => router.push(fromPage === 'sales' ? '/admin/sales' : '/admin/members')}
              className="absolute left-0 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">{member.fullName}</h1>
              <div className="mt-1 flex items-center justify-center gap-2">
                {member.status === 'suspended' ? (
                  <span className="inline-flex items-center p-1 rounded-full bg-yellow-100 border border-yellow-200" title="休会">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  </span>
                ) : member.status === 'withdrawn' ? (
                  <span className="inline-flex items-center p-1 rounded-full bg-red-100 border border-red-200" title="退会">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  </span>
                ) : null}
                {member.plan && (
                  <span className="text-sm text-gray-500 ml-1">
                    {member.plan}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Copy URL Card */}
          {member.accessToken ? (
            <button
              onClick={() => {
                const url = `${window.location.origin}/client/${member.accessToken}`
                navigator.clipboard.writeText(url)
                setCopySuccess('URLをコピーしました')
                setTimeout(() => setCopySuccess(''), 2000)
              }}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex flex-col items-center justify-center group"
            >
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-base font-medium text-gray-900">専用URLをコピー</span>
              <span className="text-sm text-green-600 mt-2 h-5">{copySuccess}</span>
            </button>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center opacity-50 cursor-not-allowed">
               <div className="h-16 w-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-base font-medium text-gray-500">専用URLなし</span>
              <span className="text-sm text-gray-400 mt-2 h-5"></span>
            </div>
          )}

          {/* Edit Member Card */}
          <Link
            href={`/admin/members/${memberId}/edit`}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex flex-col items-center justify-center group"
          >
            <div className="h-16 w-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-100 transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="text-base font-medium text-gray-900">会員情報を編集</span>
            <span className="text-sm text-gray-500 mt-2 h-5">基本情報を変更</span>
          </Link>

          {/* Check Client View Card */}
          {member.accessToken ? (
            <a
              href={`/client/${member.accessToken}?from=admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex flex-col items-center justify-center group"
            >
              <div className="h-16 w-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="text-base font-medium text-gray-900">予約確認（会員画面）</span>
              <span className="text-sm text-gray-500 mt-2 h-5">会員視点で確認</span>
            </a>
          ) : (
             <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center opacity-50 cursor-not-allowed">
              <div className="h-16 w-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span className="text-base font-medium text-gray-500">会員画面なし</span>
              <span className="text-sm text-gray-400 mt-2 h-5"></span>
            </div>
          )}
        </div>
        
        {/* Member Details Section (Hidden as per request) */}
        <div className="hidden bg-white shadow overflow-hidden sm:rounded-md mb-8 border border-gray-200">
          <div className="px-4 py-3 sm:px-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              会員基本情報
            </h3>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-xs font-medium text-gray-500 mb-1">メールアドレス</dt>
                <dd className="text-sm text-gray-900 font-medium">{member.email || '-'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-xs font-medium text-gray-500 mb-1">現在のプラン</dt>
                <dd className="text-sm text-gray-900 font-medium">
                  {member.plan ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {member.plan}
                    </span>
                  ) : '-'}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-xs font-medium text-gray-500 mb-1">登録日</dt>
                <dd className="text-sm text-gray-900">
                  {member.createdAt ? new Date(member.createdAt).toLocaleDateString('ja-JP') : '-'}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-xs font-medium text-gray-500 mb-1">メモ</dt>
                <dd className="text-sm text-gray-900">{member.memo || '-'}</dd>
              </div>
            </dl>
          </div>
        </div>
        
        {/* Monthly Plan/Payment Settings */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">月額プラン設定</h3>
              <button
                onClick={handleAddMonth}
                title="プランを追加・復帰"
                className="inline-flex items-center justify-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {payments.length === 0 ? (
              <div className="text-center text-gray-500">データがありません</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">対象月</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">プラン</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">予定金額</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '100px'}}>メモ</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payments.map((p, idx) => {
                        const isFutureMonth = p.status === 'future'
                        const isCurrentMonth = p.month === new Date().toISOString().slice(0, 7)
                        return (
                          <tr
                            key={`${p.month}-${idx}`}
                            className={isFutureMonth ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}
                          >
                            <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                {formatMonth(p.month)}
                                {isFutureMonth && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">予定</span>
                                )}
                                {isCurrentMonth && (
                                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">今月</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {p.plan || <span className="text-gray-400 italic text-xs">未設定</span>}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {p.expectedAmount > 0 ? `¥${p.expectedAmount.toLocaleString()}` : (isFutureMonth ? <span className="text-gray-400 italic text-xs">未設定</span> : '-')}
                            </td>
                            <td className="px-3 py-4 text-sm text-gray-500" style={{minWidth: '100px'}}>
                              {p.memo || '-'}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                className={`${isFutureMonth ? 'text-blue-600 hover:text-blue-900' : 'text-indigo-600 hover:text-indigo-900'}`}
                                onClick={() => handleEditClick(p)}
                              >
                                {isFutureMonth ? '予定を設定' : '編集'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setEditingItem(null)} />
            <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-bold">{formatMonth(editingItem.month)} の設定</h3>
                {editingItem.status === 'future' && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">翌月以降の予定</span>
                )}
              </div>

              {editingItem.status === 'future' && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  📅 <strong>{formatMonth(editingItem.month)}</strong> からのプラン変更予定を設定します。<br />
                  <span className="text-xs text-blue-600 mt-1 block">現在のプランは今月末まで継続されます。</span>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">プラン</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={editForm.plan}
                    onChange={(e) => {
                      const newPlan = e.target.value
                      let newFee = editForm.monthlyFee
                      
                      if (newPlan === '休会' || newPlan === '退会') {
                        newFee = '0'
                      } else if (PLAN_FEES[newPlan] !== undefined) {
                        newFee = String(PLAN_FEES[newPlan])
                      }
                      
                      setEditForm({ ...editForm, plan: newPlan, monthlyFee: newFee })
                    }}
                  >
                    <option value="">プランなし</option>
                    <option value="休会">休会</option>
                    <option value="退会">退会</option>
                    {PLAN_LIST.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">月額費用</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={editForm.monthlyFee}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '')
                      setEditForm({ ...editForm, monthlyFee: v })
                    }}
                    placeholder="例: 13200"
                  />
                </div>

                {editingItem.status !== 'future' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">入金日（任意）</label>
                    <input
                      type="date"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={editForm.paymentDate}
                      onChange={(e) => setEditForm({ ...editForm, paymentDate: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={3}
                    value={editForm.memo}
                    onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                    placeholder="この月に関するメモを入力"
                  />
                </div>
                
                <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                  ※ この月の設定のみ変更されます。前後の月には影響しませんが、この変更により会員履歴データが分割される場合があります。
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50"
                  onClick={() => setEditingItem(null)}
                  disabled={saving}
                >
                  キャンセル
                </button>
                <button
                  className={`px-4 py-2 text-sm rounded-md text-white disabled:opacity-50 ${
                    editingItem.status === 'future'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                  onClick={handleSaveMonth}
                  disabled={saving}
                >
                  {saving ? '保存中...' : (editingItem.status === 'future' ? '予定を保存' : '保存')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
