'use client'

import { useState, useEffect } from 'react'

interface TrackingModalProps {
  isOpen: boolean
  onClose: () => void
  memberId: string
  memberName: string
}

interface YearlyGoal {
  id: string
  year: number
  goal_text: string
}

interface MonthlyGoal {
  id: string
  year: number
  month: number
  goal_text: string
}

interface WeightRecord {
  id: string
  recorded_date: string
  weight_kg: number
  notes?: string
}

interface SquatRecord {
  id: string
  recorded_date: string
  weight_kg: number
  sets?: number
  reps?: number
  notes?: string
}

export default function TrackingModal({ isOpen, onClose, memberId, memberName }: TrackingModalProps) {
  const [activeTab, setActiveTab] = useState<'yearly' | 'monthly' | 'weight' | 'squat'>('yearly')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [yearlyGoals, setYearlyGoals] = useState<YearlyGoal[]>([])
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([])
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([])
  const [squatRecords, setSquatRecords] = useState<SquatRecord[]>([])

  // フォーム入力
  const [yearlyForm, setYearlyForm] = useState({ year: new Date().getFullYear(), goal_text: '' })
  const [monthlyForm, setMonthlyForm] = useState({ 
    year: new Date().getFullYear(), 
    month: new Date().getMonth() + 1, 
    goal_text_1: '', 
    goal_text_2: '', 
    goal_text_3: '' 
  })
  const [weightForm, setWeightForm] = useState({ recorded_date: new Date().toISOString().split('T')[0], weight_kg: '', notes: '' })
  const [squatForm, setSquatForm] = useState({ recorded_date: new Date().toISOString().split('T')[0], weight_kg: '', sets: '', reps: '', notes: '' })

  // 編集状態管理
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  // データ取得
  useEffect(() => {
    if (isOpen && memberId) {
      fetchData()
    }
  }, [isOpen, memberId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tracking?userId=${memberId}`)
      if (response.ok) {
        const data = await response.json()
        setYearlyGoals(data.yearlyGoals || [])
        setMonthlyGoals(data.monthlyGoals || [])
        setWeightRecords(data.weightRecords || [])
        setSquatRecords(data.squatRecords || [])
      } else {
        setMessage('データの取得に失敗しました')
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setMessage('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (type: string, data: any) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, userId: memberId, data }),
      })

      if (response.ok) {
        setMessage('保存しました')
        fetchData()
        // フォームリセット
        resetForm(type)
      } else {
        setMessage('保存に失敗しました')
      }
    } catch (error) {
      console.error('Submit error:', error)
      setMessage('エラーが発生しました')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('本当に削除しますか？')) return

    setLoading(true)
    try {
      const response = await fetch('/api/admin/tracking', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      })

      if (response.ok) {
        setMessage('削除しました')
        fetchData()
      } else {
        setMessage('削除に失敗しました')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setMessage('エラーが発生しました')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleUpdate = async (type: string, id: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, data: editForm }),
      })

      if (response.ok) {
        setMessage('更新しました')
        setEditingId(null)
        setEditForm({})
        fetchData()
      } else {
        setMessage('更新に失敗しました')
      }
    } catch (error) {
      console.error('Update error:', error)
      setMessage('エラーが発生しました')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const resetForm = (type: string) => {
    switch (type) {
      case 'yearly_goal':
        setYearlyForm({ year: new Date().getFullYear(), goal_text: '' })
        break
      case 'monthly_goal':
        setMonthlyForm({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, goal_text_1: '', goal_text_2: '', goal_text_3: '' })
        break
      case 'weight_record':
        setWeightForm({ recorded_date: new Date().toISOString().split('T')[0], weight_kg: '', notes: '' })
        break
      case 'squat_record':
        setSquatForm({ recorded_date: new Date().toISOString().split('T')[0], weight_kg: '', sets: '', reps: '', notes: '' })
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900">目標・記録管理</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 会員名表示 */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">会員名: <span className="font-semibold text-gray-900">{memberName}</span></p>
        </div>

        {/* メッセージ */}
        {message && (
          <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            {message}
          </div>
        )}

        {/* タブ */}
        <div className="border-b border-gray-200 px-2 sm:px-6">
          <div className="flex space-x-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
            {[
              { 
                key: 'yearly', 
                label: '年次目標',
                icon: <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              },
              { 
                key: 'monthly', 
                label: '月次目標',
                icon: <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              },
              { 
                key: 'weight', 
                label: '体重記録',
                icon: <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              },
              { 
                key: 'squat', 
                label: 'SQ記録',
                icon: <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2.5 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex flex-row items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                style={{ writingMode: 'horizontal-tb' }}
              >
                {tab.icon}
                <span className="inline-block">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {/* 年次目標 */}
          {activeTab === 'yearly' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-bold text-gray-700 mb-3">新規登録</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">年</label>
                    <input
                      type="number"
                      value={yearlyForm.year}
                      onChange={(e) => setYearlyForm({ ...yearlyForm, year: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目標</label>
                    <textarea
                      value={yearlyForm.goal_text}
                      onChange={(e) => setYearlyForm({ ...yearlyForm, goal_text: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>
                  <button
                    onClick={() => handleSubmit('yearly_goal', yearlyForm)}
                    disabled={loading || !yearlyForm.goal_text}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">既存データ</h3>
                {yearlyGoals.length === 0 ? (
                  <p className="text-sm text-gray-500">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {yearlyGoals.map((goal) => (
                      <div key={goal.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        {editingId === goal.id ? (
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={editForm.year || goal.year}
                              onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <textarea
                              value={editForm.goal_text || goal.goal_text}
                              onChange={(e) => setEditForm({ ...editForm, goal_text: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate('yearly_goal', goal.id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-yellow-700">{goal.year}年</div>
                              <div className="text-sm text-gray-900">{goal.goal_text}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingId(goal.id)
                                  setEditForm({ year: goal.year, goal_text: goal.goal_text })
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete('yearly_goal', goal.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 月次目標 */}
          {activeTab === 'monthly' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-bold text-gray-700 mb-3">新規登録（最大3つまで）</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">年</label>
                      <input
                        type="number"
                        value={monthlyForm.year}
                        onChange={(e) => setMonthlyForm({ ...monthlyForm, year: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">月</label>
                      <select
                        value={monthlyForm.month}
                        onChange={(e) => setMonthlyForm({ ...monthlyForm, month: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{m}月</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目標1</label>
                    <input
                      type="text"
                      value={monthlyForm.goal_text_1}
                      onChange={(e) => setMonthlyForm({ ...monthlyForm, goal_text_1: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="例: 水2L飲む"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目標2</label>
                    <input
                      type="text"
                      value={monthlyForm.goal_text_2}
                      onChange={(e) => setMonthlyForm({ ...monthlyForm, goal_text_2: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="例: 毎日10000歩歩く"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目標3</label>
                    <input
                      type="text"
                      value={monthlyForm.goal_text_3}
                      onChange={(e) => setMonthlyForm({ ...monthlyForm, goal_text_3: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="例: カロリー2000kcal以内"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      const goals = [
                        monthlyForm.goal_text_1,
                        monthlyForm.goal_text_2,
                        monthlyForm.goal_text_3
                      ].filter(text => text.trim() !== '')
                      
                      if (goals.length === 0) {
                        setMessage('少なくとも1つの目標を入力してください')
                        setTimeout(() => setMessage(''), 3000)
                        return
                      }
                      
                      setLoading(true)
                      try {
                        for (const goal_text of goals) {
                          const response = await fetch('/api/admin/tracking', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              type: 'monthly_goal', 
                              userId: memberId, 
                              data: { year: monthlyForm.year, month: monthlyForm.month, goal_text } 
                            }),
                          })
                          if (!response.ok) throw new Error('保存に失敗しました')
                        }
                        setMessage(`${goals.length}件の目標を保存しました`)
                        fetchData()
                        resetForm('monthly_goal')
                      } catch (error) {
                        console.error('Submit error:', error)
                        setMessage('エラーが発生しました')
                      } finally {
                        setLoading(false)
                        setTimeout(() => setMessage(''), 3000)
                      }
                    }}
                    disabled={loading || (!monthlyForm.goal_text_1 && !monthlyForm.goal_text_2 && !monthlyForm.goal_text_3)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    まとめて保存
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">既存データ</h3>
                {monthlyGoals.length === 0 ? (
                  <p className="text-sm text-gray-500">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyGoals.map((goal) => (
                      <div key={goal.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        {editingId === goal.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editForm.year || goal.year}
                                onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) })}
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              />
                              <select
                                value={editForm.month || goal.month}
                                onChange={(e) => setEditForm({ ...editForm, month: parseInt(e.target.value) })}
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                  <option key={m} value={m}>{m}月</option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="text"
                              value={editForm.goal_text || goal.goal_text}
                              onChange={(e) => setEditForm({ ...editForm, goal_text: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate('monthly_goal', goal.id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-blue-700">{goal.year}年{goal.month}月</div>
                              <div className="text-sm text-gray-900">{goal.goal_text}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingId(goal.id)
                                  setEditForm({ year: goal.year, month: goal.month, goal_text: goal.goal_text })
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete('monthly_goal', goal.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 体重記録 */}
          {activeTab === 'weight' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-bold text-gray-700 mb-3">新規登録</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">記録日</label>
                    <input
                      type="date"
                      value={weightForm.recorded_date}
                      onChange={(e) => setWeightForm({ ...weightForm, recorded_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">体重 (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightForm.weight_kg}
                      onChange={(e) => setWeightForm({ ...weightForm, weight_kg: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                    <input
                      type="text"
                      value={weightForm.notes}
                      onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleSubmit('weight_record', { ...weightForm, weight_kg: parseFloat(weightForm.weight_kg) })}
                    disabled={loading || !weightForm.weight_kg}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">既存データ</h3>
                {weightRecords.length === 0 ? (
                  <p className="text-sm text-gray-500">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {weightRecords.map((record) => (
                      <div key={record.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        {editingId === record.id ? (
                          <div className="space-y-2">
                            <input
                              type="date"
                              value={editForm.recorded_date || record.recorded_date}
                              onChange={(e) => setEditForm({ ...editForm, recorded_date: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={editForm.weight_kg !== undefined ? editForm.weight_kg : record.weight_kg}
                              onChange={(e) => setEditForm({ ...editForm, weight_kg: parseFloat(e.target.value) })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <input
                              type="text"
                              value={editForm.notes !== undefined ? editForm.notes : record.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              placeholder="メモ"
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate('weight_record', record.id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-green-700">{new Date(record.recorded_date).toLocaleDateString('ja-JP')}</div>
                              <div className="text-sm text-gray-900">{record.weight_kg}kg {record.notes && `- ${record.notes}`}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingId(record.id)
                                  setEditForm({ recorded_date: record.recorded_date, weight_kg: record.weight_kg, notes: record.notes || '' })
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete('weight_record', record.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SQ記録 */}
          {activeTab === 'squat' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-bold text-gray-700 mb-3">新規登録</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">記録日</label>
                    <input
                      type="date"
                      value={squatForm.recorded_date}
                      onChange={(e) => setSquatForm({ ...squatForm, recorded_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">重量 (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={squatForm.weight_kg}
                      onChange={(e) => setSquatForm({ ...squatForm, weight_kg: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">セット数</label>
                      <input
                        type="number"
                        value={squatForm.sets}
                        onChange={(e) => setSquatForm({ ...squatForm, sets: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">回数</label>
                      <input
                        type="number"
                        value={squatForm.reps}
                        onChange={(e) => setSquatForm({ ...squatForm, reps: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                    <input
                      type="text"
                      value={squatForm.notes}
                      onChange={(e) => setSquatForm({ ...squatForm, notes: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleSubmit('squat_record', { 
                      ...squatForm, 
                      weight_kg: parseFloat(squatForm.weight_kg),
                      sets: squatForm.sets ? parseInt(squatForm.sets) : undefined,
                      reps: squatForm.reps ? parseInt(squatForm.reps) : undefined,
                    })}
                    disabled={loading || !squatForm.weight_kg}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">既存データ</h3>
                {squatRecords.length === 0 ? (
                  <p className="text-sm text-gray-500">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {squatRecords.map((record) => (
                      <div key={record.id} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        {editingId === record.id ? (
                          <div className="space-y-2">
                            <input
                              type="date"
                              value={editForm.recorded_date || record.recorded_date}
                              onChange={(e) => setEditForm({ ...editForm, recorded_date: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={editForm.weight_kg !== undefined ? editForm.weight_kg : record.weight_kg}
                              onChange={(e) => setEditForm({ ...editForm, weight_kg: parseFloat(e.target.value) })}
                              placeholder="重量 (kg)"
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editForm.sets !== undefined ? editForm.sets : record.sets || ''}
                                onChange={(e) => setEditForm({ ...editForm, sets: e.target.value ? parseInt(e.target.value) : null })}
                                placeholder="セット数"
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              />
                              <input
                                type="number"
                                value={editForm.reps !== undefined ? editForm.reps : record.reps || ''}
                                onChange={(e) => setEditForm({ ...editForm, reps: e.target.value ? parseInt(e.target.value) : null })}
                                placeholder="回数"
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              />
                            </div>
                            <input
                              type="text"
                              value={editForm.notes !== undefined ? editForm.notes : record.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              placeholder="メモ"
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate('squat_record', record.id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-purple-700">{new Date(record.recorded_date).toLocaleDateString('ja-JP')}</div>
                              <div className="text-sm text-gray-900">
                                {record.weight_kg}kg
                                {record.sets && ` | ${record.sets}セット`}
                                {record.reps && ` | ${record.reps}回`}
                                {record.notes && ` | ${record.notes}`}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingId(record.id)
                                  setEditForm({ 
                                    recorded_date: record.recorded_date, 
                                    weight_kg: record.weight_kg, 
                                    sets: record.sets || '', 
                                    reps: record.reps || '', 
                                    notes: record.notes || '' 
                                  })
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete('squat_record', record.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
