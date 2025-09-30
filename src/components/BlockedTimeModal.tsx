'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface BlockedTime {
  id: string
  start_time: string
  end_time: string
  reason: string
  recurrence_type: 'none' | 'daily' | 'weekly'
  recurrence_end?: string
  calendar_id: string
}

interface BlockedTimeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

export default function BlockedTimeModal({ isOpen, onClose, onSave }: BlockedTimeModalProps) {
  const { data: session } = useSession()
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Helper function to get default datetime (today at 12:00)
  const getDefaultDateTime = () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0) // Set to 12:00 PM
    return now.toISOString().slice(0, 16) // Format for datetime-local input
  }

  const [formData, setFormData] = useState({
    start_time: getDefaultDateTime(),
    end_time: (() => {
      const endTime = new Date()
      endTime.setHours(13, 0, 0, 0) // Set to 13:00 PM (1 hour after start)
      return endTime.toISOString().slice(0, 16)
    })(),
    reason: '',
    recurrence_type: 'none' as 'none' | 'daily' | 'weekly',
    recurrence_end: ''
  })

  // フォームリセット
  const resetForm = () => {
    setFormData({
      start_time: getDefaultDateTime(),
      end_time: (() => {
        const endTime = new Date()
        endTime.setHours(13, 0, 0, 0) // Set to 13:00 PM (1 hour after start)
        return endTime.toISOString().slice(0, 16)
      })(),
      reason: '',
      recurrence_type: 'none',
      recurrence_end: ''
    })
    setEditingId(null)
  }

  // ブロック時間一覧取得
  const fetchBlockedTimes = async () => {
    try {
      const response = await fetch('/api/blocked-times')
      if (response.ok) {
        const data = await response.json()
        setBlockedTimes(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch blocked times:', error)
    }
  }

  // ブロック時間保存
  const handleSave = async () => {
    // バリデーション
    if (!formData.start_time || !formData.end_time || !formData.reason) {
      alert('開始時間、終了時間、理由は必須です')
      return
    }

    if (new Date(formData.start_time) >= new Date(formData.end_time)) {
      alert('終了時間は開始時間より後に設定してください')
      return
    }

    setLoading(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/blocked-times/${editingId}` : '/api/blocked-times'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          calendar_id: session?.user?.email || 'tandjgym@gmail.com'
        })
      })

      if (response.ok) {
        await fetchBlockedTimes()
        resetForm()
        onSave?.()
        alert('予約不可時間を追加しました')
      } else {
        const errorData = await response.json()
        alert(`エラー: ${errorData.error || '保存に失敗しました'}`)
      }
    } catch (error) {
      console.error('Failed to save blocked time:', error)
      alert('保存中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // ブロック時間削除
  const handleDelete = async (id: string) => {
    if (!confirm('この予約不可時間を削除しますか？')) return
    
    try {
      const response = await fetch(`/api/blocked-times/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchBlockedTimes()
      }
    } catch (error) {
      console.error('Failed to delete blocked time:', error)
    }
  }

  // 編集開始
  const handleEdit = (blockedTime: BlockedTime) => {
    setFormData({
      start_time: new Date(blockedTime.start_time).toISOString().slice(0, 16),
      end_time: new Date(blockedTime.end_time).toISOString().slice(0, 16),
      reason: blockedTime.reason,
      recurrence_type: blockedTime.recurrence_type,
      recurrence_end: blockedTime.recurrence_end || ''
    })
    setEditingId(blockedTime.id)
  }

  useEffect(() => {
    if (isOpen) {
      fetchBlockedTimes()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">予約不可時間設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 新規作成・編集フォーム */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              {editingId ? '予約不可時間を編集' : '新しい予約不可時間を追加'}
            </h3>
            
            {/* 開始時間 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                開始時間 *
              </label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>

            {/* 終了時間 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                終了時間 *
              </label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>

            {/* 理由 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                理由（任意）
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="例: 定期メンテナンス、研修"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* 繰り返し設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                繰り返し設定
              </label>
              <select
                value={formData.recurrence_type}
                onChange={(e) => setFormData(prev => ({ ...prev, recurrence_type: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="none">繰り返しなし</option>
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
              </select>
            </div>

            {/* 繰り返し終了日 */}
            {formData.recurrence_type !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  繰り返し終了日（任意）
                </label>
                <input
                  type="date"
                  value={formData.recurrence_end}
                  onChange={(e) => setFormData(prev => ({ ...prev, recurrence_end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            )}

            {/* ボタン */}
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                disabled={loading || !formData.start_time || !formData.end_time}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '保存中...' : editingId ? '更新' : '追加'}
              </button>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
              )}
            </div>
          </div>

          {/* 既存のブロック時間一覧 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">設定済み予約不可時間</h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {blockedTimes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  予約不可時間が設定されていません
                </p>
              ) : (
                blockedTimes.map((blockedTime) => (
                  <div
                    key={blockedTime.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(blockedTime.start_time).toLocaleString('ja-JP')} 〜 
                          {new Date(blockedTime.end_time).toLocaleString('ja-JP')}
                        </div>
                        {blockedTime.reason && (
                          <div className="text-sm text-gray-600 mt-1">
                            理由: {blockedTime.reason}
                          </div>
                        )}
                        {blockedTime.recurrence_type !== 'none' && (
                          <div className="text-xs text-blue-600 mt-1">
                            繰り返し: {blockedTime.recurrence_type === 'daily' ? '毎日' : '毎週'}
                            {blockedTime.recurrence_end && ` (${blockedTime.recurrence_end}まで)`}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(blockedTime)}
                          className="text-blue-600 hover:text-blue-800 text-sm transition-colors"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(blockedTime.id)}
                          className="text-red-600 hover:text-red-800 text-sm transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
