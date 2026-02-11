'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
          googleCalendarEmail: m.google_calendar_email
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
              <p className="mt-1 text-sm text-gray-500">会員詳細情報</p>
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
        
        {/* Member Details Section */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              会員詳細情報
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
                <dd className="mt-1 text-sm text-gray-900">{member.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">登録日</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {member.createdAt ? new Date(member.createdAt).toLocaleDateString('ja-JP') : '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">メモ</dt>
                <dd className="mt-1 text-sm text-gray-900">{member.memo || '-'}</dd>
              </div>
            </dl>
          </div>
        </div>
        
        {/* Monthly Plan/Payment Settings */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              月額プラン設定
            </h3>
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
                      {payments.map((p, idx) => (
                        <tr key={`${p.month}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatMonth(p.month)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {p.plan || '-'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {p.expectedAmount > 0 ? `¥${p.expectedAmount.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-500" style={{minWidth: '100px'}}>
                            {p.memo || '-'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button 
                              className="text-indigo-600 hover:text-indigo-900"
                              onClick={() => handleEditClick(p)}
                            >
                              編集
                            </button>
                          </td>
                        </tr>
                      ))}
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
              <h3 className="text-lg font-bold mb-4">{formatMonth(editingItem.month)} の設定変更</h3>
              
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入金日（任意）</label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={editForm.paymentDate}
                    onChange={(e) => setEditForm({ ...editForm, paymentDate: e.target.value })}
                  />
                </div>

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
                  className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  onClick={handleSaveMonth}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
