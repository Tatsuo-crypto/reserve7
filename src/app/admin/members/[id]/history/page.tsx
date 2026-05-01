'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  status?: string
}

export default function MemberHistoryPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const memberId = params.id

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          status: m.status
        })

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
    if (item.membershipStatus === 'suspended') {
      initialPlan = '休会'
    } else if (item.membershipStatus === 'withdrawn') {
      initialPlan = '退会'
    }

    setEditForm({
      plan: initialPlan,
      monthlyFee: item.expectedAmount ? String(item.expectedAmount) : '',
      status: item.membershipStatus,
      paymentDate: item.paymentDate ? item.paymentDate.split('T')[0] : '',
      memo: item.memo || ''
    })
  }

  const handleSaveMonth = async () => {
    if (!editingItem) return
    setSaving(true)
    
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

      setEditingItem(null)
      await fetchPayments()
    } catch (e) {
      console.error(e)
      alert('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMonth = () => {
    let nextMonth: Date
    if (payments.length > 0) {
      const months = payments.map(p => p.month).sort()
      const latestMonthStr = months[months.length - 1]
      nextMonth = addMonths(parseISO(`${latestMonthStr}-01`), 1)
    } else {
      nextMonth = startOfMonth(new Date())
    }

    const monthStr = format(nextMonth, 'yyyy-MM')
    
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

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split('-')
    return `${y}年${parseInt(m)}月`
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 font-black uppercase tracking-widest">読み込み中...</div>
    )
  }

  if (error || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-black uppercase tracking-widest">{error || '会員が見つかりません'}</div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="relative flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm border border-gray-100 transition-all hover:shadow-md"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">月額プラン履歴</h1>
              <p className="mt-1 text-sm font-bold text-gray-400 tracking-wider uppercase">{member.fullName} 様</p>
            </div>
            <div className="w-10"></div>
          </div>
        </div>

        {/* Monthly Plan/Payment Settings */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-10">
          <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">支払い・プラン変更履歴</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">月ごとのプランと支払金額の管理</p>
            </div>
            <button
              onClick={handleAddMonth}
              title="プランを追加・復帰"
              className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 text-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-105 active:scale-95 group"
            >
              <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="p-0">
            {payments.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-gray-400 font-bold">データがありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-3 sm:px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">対象月</th>
                      <th className="px-3 sm:px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">プラン</th>
                      <th className="px-3 sm:px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">予定金額</th>
                      <th className="hidden lg:table-cell px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">メモ</th>
                      <th className="px-3 sm:px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-50">
                    {payments.map((p, idx) => {
                      const isFutureMonth = p.status === 'future'
                      const isCurrentMonth = p.month === new Date().toISOString().slice(0, 7)
                      return (
                        <tr
                          key={`${p.month}-${idx}`}
                          className={`group transition-colors ${isFutureMonth ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-gray-50/50'}`}
                        >
                          <td className="px-3 sm:px-8 py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <span className="text-sm font-black text-gray-900 tabular-nums whitespace-nowrap">
                                {formatMonth(p.month)}
                              </span>
                              <div className="flex gap-1">
                                {isFutureMonth && (
                                  <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">予定</span>
                                )}
                                {isCurrentMonth && (
                                  <span className="text-[8px] font-black bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">今月</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-4">
                            <div className="text-sm font-bold text-gray-700 truncate max-w-[80px] sm:max-w-none" title={p.plan || ''}>
                              {p.plan || <span className="text-gray-300 font-medium italic">未設定</span>}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-4">
                            <span className="text-sm font-black text-gray-900 tabular-nums whitespace-nowrap">
                              {p.expectedAmount > 0 ? `¥${p.expectedAmount.toLocaleString()}` : (isFutureMonth ? '未設定' : '-')}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell px-8 py-4">
                            <span className="text-xs font-bold text-gray-400 line-clamp-1 max-w-[200px]">
                              {p.memo || '-'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-8 py-4 text-right">
                            <button
                              className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border transition-all ${
                                isFutureMonth 
                                  ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' 
                                  : 'bg-white text-indigo-600 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50'
                              }`}
                              onClick={() => handleEditClick(p)}
                            >
                              {isFutureMonth ? '設定' : '編集'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
