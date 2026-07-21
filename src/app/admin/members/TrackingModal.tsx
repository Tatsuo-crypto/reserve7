'use client'

import { useState, useEffect } from 'react'
import Icon, { type IconName } from '@/components/ui/icons'
import Button from '@/components/ui/Button'

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
  const [activeTab, setActiveTab] = useState<'yearly' | 'monthly' | 'weight' | 'squat' | 'settings'>('yearly')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [yearlyGoals, setYearlyGoals] = useState<YearlyGoal[]>([])
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([])
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([])
  const [squatRecords, setSquatRecords] = useState<SquatRecord[]>([])
  
  const [settings, setSettings] = useState({
    visible_items: { steps: false, sleep: false, water: false, alcohol: false, workout: false },
    visible_tabs: { input: false, analyze: false, progress: false }
  })

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
      const [trackingRes, settingsRes] = await Promise.all([
        fetch(`/api/admin/tracking?userId=${memberId}`),
        fetch(`/api/lifestyle/settings?userId=${memberId}`) // This API needs to handle userId from admin side
      ])

      if (trackingRes.ok) {
        const data = await trackingRes.json()
        setYearlyGoals(data.yearlyGoals || [])
        setMonthlyGoals(data.monthlyGoals || [])
        setWeightRecords(data.weightRecords || [])
        setSquatRecords(data.squatRecords || [])
      }

      if (settingsRes.ok) {
        const { data } = await settingsRes.json()
        if (data) {
          setSettings({
            visible_items: data.visible_items || { steps: true, sleep: true, water: true, alcohol: true, workout: true },
            visible_tabs: data.visible_tabs || { input: true, analyze: true, progress: true }
          })
        }
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setMessage('データを取得できませんでした。画面を再読み込みしてください。')
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
        setMessage('保存できませんでした。もう一度お試しください。')
      }
    } catch (error) {
      console.error('Submit error:', error)
      setMessage('保存できませんでした。もう一度お試しください。')
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
        setMessage('削除できませんでした。もう一度お試しください。')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setMessage('削除できませんでした。もう一度お試しください。')
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
        setMessage('更新できませんでした。もう一度お試しください。')
      }
    } catch (error) {
      console.error('Update error:', error)
      setMessage('更新できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleSettingsSave = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/lifestyle/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: memberId, // backend needs to handle userId for admin
          visibleItems: settings.visible_items,
          visibleTabs: settings.visible_tabs
        })
      })

      if (response.ok) {
        setMessage('設定を保存しました')
      } else {
        throw new Error('保存できませんでした。もう一度お試しください。')
      }
    } catch (error) {
      console.error('Settings save error:', error)
      setMessage('保存できませんでした。もう一度お試しください。')
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4">
      <div className="w-full max-w-4xl overflow-y-auto overscroll-contain rounded-2xl border border-border-subtle bg-surface-raised shadow-xl [-webkit-overflow-scrolling:touch]" style={{ maxHeight: 'calc(100dvh - max(1.5rem, env(safe-area-inset-top)) - max(1.5rem, env(safe-area-inset-bottom)))' }}>
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-strong bg-surface-raised px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <Icon name="clipboardList" size={24} className="text-text-secondary" />
            <h2 className="text-xl font-semibold text-text-primary">目標・記録管理</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 w-10 rounded-full p-0 text-text-muted hover:text-text-secondary"
          >
            <Icon name="close" size={24} />
          </Button>
        </div>

        {/* 会員名表示 */}
        <div className="px-6 py-3 bg-surface-base border-b border-border-strong">
          <p className="text-sm text-text-secondary">会員名: <span className="font-normal text-text-primary">{memberName}</span></p>
        </div>

        {/* メッセージ */}
        {message && (
          <div className="mx-6 mt-4 p-3 bg-brand-500/15 border border-brand-500/30 rounded-lg text-sm text-brand-300">
            {message}
          </div>
        )}

        {/* タブ */}
        <div className="border-b border-border-strong px-2 sm:px-6">
          <div className="flex space-x-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
            {([
              { key: 'yearly', label: '年次目標', iconName: 'star' },
              { key: 'monthly', label: '月次目標', iconName: 'calendar' },
              { key: 'weight', label: '体重記録', iconName: 'scale' },
              { key: 'squat', label: 'SQ記録', iconName: 'bolt' },
              { key: 'settings', label: '表示設定', iconName: 'settings' },
            ] as { key: string, label: string, iconName: IconName }[]).map((tab) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`rounded-none border-b-2 px-2 py-2.5 text-xs sm:px-3 sm:text-sm flex-row whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-text-secondary hover:text-text-secondary'
                }`}
                style={{ writingMode: 'horizontal-tb' }}
              >
                <Icon name={tab.iconName} size={16} className="flex-shrink-0" />
                <span className="inline-block">{tab.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {/* 年次目標 */}
          {activeTab === 'yearly' && (
            <div className="space-y-6">
              <div className="bg-surface-base p-4 rounded-lg">
                <h3 className="text-sm font-normal text-text-secondary mb-3">新規登録</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">年</label>
                    <input
                      type="number"
                      value={yearlyForm.year}
                      onChange={(e) => setYearlyForm({ ...yearlyForm, year: parseInt(e.target.value) })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">目標</label>
                    <textarea
                      value={yearlyForm.goal_text}
                      onChange={(e) => setYearlyForm({ ...yearlyForm, goal_text: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>
                  <Button
                    type="button"
                    fullWidth
                    onClick={() => handleSubmit('yearly_goal', yearlyForm)}
                    disabled={loading || !yearlyForm.goal_text}
                    className="w-full bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-normal hover:bg-brand-800 disabled:opacity-50"
                  >
                    保存
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-normal text-text-secondary mb-3">既存データ</h3>
                {yearlyGoals.length === 0 ? (
                  <p className="text-sm text-text-secondary">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {yearlyGoals.map((goal) => (
                      <div key={goal.id} className="p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-lg">
                        {editingId === goal.id ? (
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={editForm.year || goal.year}
                              onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) })}
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <textarea
                              value={editForm.goal_text || goal.goal_text}
                              onChange={(e) => setEditForm({ ...editForm, goal_text: e.target.value })}
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleUpdate('yearly_goal', goal.id)}
                                className="px-3 py-1 bg-brand-700 text-white rounded-lg text-sm hover:bg-brand-800"
                              >
                                保存
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-surface-overlay text-text-secondary rounded-lg text-sm hover:bg-surface-overlay"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-normal text-yellow-700">{goal.year}年</div>
                              <div className="text-sm text-text-primary">{goal.goal_text}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(goal.id)
                                  setEditForm({ year: goal.year, goal_text: goal.goal_text })
                                }}
                                className="h-auto rounded-lg px-1 py-0 text-brand-600 hover:text-brand-800 text-sm"
                              >
                                編集
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete('yearly_goal', goal.id)}
                                className="h-auto rounded-lg px-1 py-0 text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </Button>
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
              <div className="bg-surface-base p-4 rounded-lg">
                <h3 className="text-sm font-normal text-text-secondary mb-3">新規登録（最大3つまで）</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-normal text-text-secondary mb-1">年</label>
                      <input
                        type="number"
                        value={monthlyForm.year}
                        onChange={(e) => setMonthlyForm({ ...monthlyForm, year: parseInt(e.target.value) })}
                        className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-normal text-text-secondary mb-1">月</label>
                      <select
                        value={monthlyForm.month}
                        onChange={(e) => setMonthlyForm({ ...monthlyForm, month: parseInt(e.target.value) })}
                        className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{m}月</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">目標1</label>
                    <input
                      type="text"
                      value={monthlyForm.goal_text_1}
                      onChange={(e) => setMonthlyForm({ ...monthlyForm, goal_text_1: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      placeholder="例: 水2L飲む"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">目標2</label>
                    <input
                      type="text"
                      value={monthlyForm.goal_text_2}
                      onChange={(e) => setMonthlyForm({ ...monthlyForm, goal_text_2: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      placeholder="例: 毎日10000歩歩く"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">目標3</label>
                    <input
                      type="text"
                      value={monthlyForm.goal_text_3}
                      onChange={(e) => setMonthlyForm({ ...monthlyForm, goal_text_3: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      placeholder="例: カロリー2000kcal以内"
                    />
                  </div>
                  <Button
                    type="button"
                    fullWidth
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
                          if (!response.ok) throw new Error('保存できませんでした。もう一度お試しください。')
                        }
                        setMessage(`${goals.length}件の目標を保存しました`)
                        fetchData()
                        resetForm('monthly_goal')
                      } catch (error) {
                        console.error('Submit error:', error)
                        setMessage('保存できませんでした。もう一度お試しください。')
                      } finally {
                        setLoading(false)
                        setTimeout(() => setMessage(''), 3000)
                      }
                    }}
                    disabled={loading || (!monthlyForm.goal_text_1 && !monthlyForm.goal_text_2 && !monthlyForm.goal_text_3)}
                    className="w-full bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-normal hover:bg-brand-800 disabled:opacity-50"
                  >
                    まとめて保存
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-normal text-text-secondary mb-3">既存データ</h3>
                {monthlyGoals.length === 0 ? (
                  <p className="text-sm text-text-secondary">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyGoals.map((goal) => (
                      <div key={goal.id} className="p-3 bg-brand-500/15 border border-brand-500/30 rounded-lg">
                        {editingId === goal.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editForm.year || goal.year}
                                onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) })}
                                className="border border-border-strong rounded-lg px-2 py-1 text-sm"
                              />
                              <select
                                value={editForm.month || goal.month}
                                onChange={(e) => setEditForm({ ...editForm, month: parseInt(e.target.value) })}
                                className="border border-border-strong rounded-lg px-2 py-1 text-sm"
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
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleUpdate('monthly_goal', goal.id)}
                                className="px-3 py-1 bg-brand-700 text-white rounded-lg text-sm hover:bg-brand-800"
                              >
                                保存
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-surface-overlay text-text-secondary rounded-lg text-sm hover:bg-surface-overlay"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-normal text-brand-700">{goal.year}年{goal.month}月</div>
                              <div className="text-sm text-text-primary">{goal.goal_text}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(goal.id)
                                  setEditForm({ year: goal.year, month: goal.month, goal_text: goal.goal_text })
                                }}
                                className="h-auto rounded-lg px-1 py-0 text-brand-600 hover:text-brand-800 text-sm"
                              >
                                編集
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete('monthly_goal', goal.id)}
                                className="h-auto rounded-lg px-1 py-0 text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </Button>
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
              <div className="bg-surface-base p-4 rounded-lg">
                <h3 className="text-sm font-normal text-text-secondary mb-3">新規登録</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">記録日</label>
                    <input
                      type="date"
                      value={weightForm.recorded_date}
                      onChange={(e) => setWeightForm({ ...weightForm, recorded_date: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">体重 (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightForm.weight_kg}
                      onChange={(e) => setWeightForm({ ...weightForm, weight_kg: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">メモ</label>
                    <input
                      type="text"
                      value={weightForm.notes}
                      onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    fullWidth
                    onClick={() => handleSubmit('weight_record', { ...weightForm, weight_kg: parseFloat(weightForm.weight_kg) })}
                    disabled={loading || !weightForm.weight_kg}
                    className="w-full bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-normal hover:bg-brand-800 disabled:opacity-50"
                  >
                    保存
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-normal text-text-secondary mb-3">既存データ</h3>
                {weightRecords.length === 0 ? (
                  <p className="text-sm text-text-secondary">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {weightRecords.map((record) => (
                      <div key={record.id} className="p-3 bg-surface-overlay border border-border-subtle rounded-lg">
                        {editingId === record.id ? (
                          <div className="space-y-2">
                            <input
                              type="date"
                              value={editForm.recorded_date || record.recorded_date}
                              onChange={(e) => setEditForm({ ...editForm, recorded_date: e.target.value })}
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={editForm.weight_kg !== undefined ? editForm.weight_kg : record.weight_kg}
                              onChange={(e) => setEditForm({ ...editForm, weight_kg: parseFloat(e.target.value) })}
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <input
                              type="text"
                              value={editForm.notes !== undefined ? editForm.notes : record.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              placeholder="メモ"
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleUpdate('weight_record', record.id)}
                                className="px-3 py-1 bg-brand-700 text-white rounded-lg text-sm hover:bg-brand-800"
                              >
                                保存
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-surface-overlay text-text-secondary rounded-lg text-sm hover:bg-surface-overlay"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-normal text-text-secondary">{new Date(record.recorded_date).toLocaleDateString('ja-JP')}</div>
                              <div className="text-sm text-text-primary">{record.weight_kg}kg {record.notes && `- ${record.notes}`}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(record.id)
                                  setEditForm({ recorded_date: record.recorded_date, weight_kg: record.weight_kg, notes: record.notes || '' })
                                }}
                                className="h-auto rounded-lg px-1 py-0 text-brand-600 hover:text-brand-800 text-sm"
                              >
                                編集
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete('weight_record', record.id)}
                                className="h-auto rounded-lg px-1 py-0 text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </Button>
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
              <div className="bg-surface-base p-4 rounded-lg">
                <h3 className="text-sm font-normal text-text-secondary mb-3">新規登録</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">記録日</label>
                    <input
                      type="date"
                      value={squatForm.recorded_date}
                      onChange={(e) => setSquatForm({ ...squatForm, recorded_date: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">重量 (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={squatForm.weight_kg}
                      onChange={(e) => setSquatForm({ ...squatForm, weight_kg: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-normal text-text-secondary mb-1">セット数</label>
                      <input
                        type="number"
                        value={squatForm.sets}
                        onChange={(e) => setSquatForm({ ...squatForm, sets: e.target.value })}
                        className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-normal text-text-secondary mb-1">回数</label>
                      <input
                        type="number"
                        value={squatForm.reps}
                        onChange={(e) => setSquatForm({ ...squatForm, reps: e.target.value })}
                        className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-text-secondary mb-1">メモ</label>
                    <input
                      type="text"
                      value={squatForm.notes}
                      onChange={(e) => setSquatForm({ ...squatForm, notes: e.target.value })}
                      className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    fullWidth
                    onClick={() => handleSubmit('squat_record', { 
                      ...squatForm, 
                      weight_kg: parseFloat(squatForm.weight_kg),
                      sets: squatForm.sets ? parseInt(squatForm.sets) : undefined,
                      reps: squatForm.reps ? parseInt(squatForm.reps) : undefined,
                    })}
                    disabled={loading || !squatForm.weight_kg}
                    className="w-full bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-normal hover:bg-brand-800 disabled:opacity-50"
                  >
                    保存
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-normal text-text-secondary mb-3">既存データ</h3>
                {squatRecords.length === 0 ? (
                  <p className="text-sm text-text-secondary">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {squatRecords.map((record) => (
                      <div key={record.id} className="p-3 bg-purple-500/15 border border-purple-500/30 rounded-lg">
                        {editingId === record.id ? (
                          <div className="space-y-2">
                            <input
                              type="date"
                              value={editForm.recorded_date || record.recorded_date}
                              onChange={(e) => setEditForm({ ...editForm, recorded_date: e.target.value })}
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={editForm.weight_kg !== undefined ? editForm.weight_kg : record.weight_kg}
                              onChange={(e) => setEditForm({ ...editForm, weight_kg: parseFloat(e.target.value) })}
                              placeholder="重量 (kg)"
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editForm.sets !== undefined ? editForm.sets : record.sets || ''}
                                onChange={(e) => setEditForm({ ...editForm, sets: e.target.value ? parseInt(e.target.value) : null })}
                                placeholder="セット数"
                                className="border border-border-strong rounded-lg px-2 py-1 text-sm"
                              />
                              <input
                                type="number"
                                value={editForm.reps !== undefined ? editForm.reps : record.reps || ''}
                                onChange={(e) => setEditForm({ ...editForm, reps: e.target.value ? parseInt(e.target.value) : null })}
                                placeholder="回数"
                                className="border border-border-strong rounded-lg px-2 py-1 text-sm"
                              />
                            </div>
                            <input
                              type="text"
                              value={editForm.notes !== undefined ? editForm.notes : record.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              placeholder="メモ"
                              className="w-full border border-border-strong rounded-lg px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleUpdate('squat_record', record.id)}
                                className="px-3 py-1 bg-brand-700 text-white rounded-lg text-sm hover:bg-brand-800"
                              >
                                保存
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-surface-overlay text-text-secondary rounded-lg text-sm hover:bg-surface-overlay"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-normal text-purple-700">{new Date(record.recorded_date).toLocaleDateString('ja-JP')}</div>
                              <div className="text-sm text-text-primary">
                                {record.weight_kg}kg
                                {record.sets && ` | ${record.sets}セット`}
                                {record.reps && ` | ${record.reps}回`}
                                {record.notes && ` | ${record.notes}`}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
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
                                className="h-auto rounded-lg px-1 py-0 text-brand-600 hover:text-brand-800 text-sm"
                              >
                                編集
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete('squat_record', record.id)}
                                className="h-auto rounded-lg px-1 py-0 text-red-600 hover:text-red-800 text-sm"
                              >
                                削除
                              </Button>
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
          {/* 表示設定 */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-normal text-text-primary mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-brand-600 rounded-full"></span>
                  食事管理機能の設定
                </h3>
                <p className="text-xs text-text-secondary mb-4">会員用アプリに食事管理に関連する全機能（入力・分析・進捗・各項目）を表示します</p>
                
                <label className="flex items-center gap-4 p-6 bg-brand-500/10 border border-brand-500/25 rounded-2xl cursor-pointer hover:bg-brand-500/15 transition-all active:scale-[0.98]">
                  <input
                    type="checkbox"
                    checked={settings.visible_tabs.input && settings.visible_tabs.analyze && settings.visible_tabs.progress}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSettings({
                        visible_tabs: { input: isChecked, analyze: isChecked, progress: isChecked },
                        visible_items: { steps: isChecked, sleep: isChecked, water: isChecked, alcohol: isChecked, workout: isChecked }
                      });
                    }}
                    className="w-8 h-8 text-brand-600 border-border-strong rounded-lg focus:ring-brand-500 transition-all"
                  />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">食事管理機能を表示する <span className="text-brand-600 ml-1">(ダイエットプラン限定)</span></div>
                    <div className="text-sm text-text-secondary mt-1 italic">チェックを入れると全ての管理機能（入力・分析・進捗）が会員アプリに表示されます</div>
                  </div>
                </label>
              </div>

              <div className="pt-4">
                <Button
                  type="button"
                  fullWidth
                  onClick={handleSettingsSave}
                  disabled={loading}
                  className="w-full bg-brand-700 text-white py-4 rounded-2xl font-semibold shadow-lg hover:bg-brand-800 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? '保存中...' : '設定を保存する'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-surface-base border-t border-border-strong px-6 py-4 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="px-6 py-2 bg-surface-overlay text-text-primary rounded-lg text-sm font-normal hover:bg-border-strong"
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>
  )
}
