'use client'

import { useState, useEffect } from 'react'
import { startOfWeek, endOfWeek, addDays, subDays, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, ShiftTemplate } from '@/types'
import ShiftCalendar from '@/components/shifts/ShiftCalendar'
import TrainerTemplateModal from '@/components/shifts/TrainerTemplateModal'

interface TrainerShiftPageProps {
  token: string
  trainerName?: string
}

export default function TrainerShiftPage({ token, trainerName }: TrainerShiftPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([])

  // Fetch shifts and templates
  const fetchData = async () => {
    try {
      setLoading(true)
      // Clear selection on refresh
      setSelectedShiftIds([])
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      
      const shiftsParams = new URLSearchParams({
        token,
        start: start.toISOString(),
        end: end.toISOString()
      })

      const [shiftsRes, templatesRes] = await Promise.all([
        fetch(`/api/trainer/shifts?${shiftsParams}`),
        fetch(`/api/trainer/shifts/templates?token=${token}`)
      ])

      if (shiftsRes.ok) {
        const data = await shiftsRes.json()
        setShifts(data.shifts || [])
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates || [])
      }
    } catch (e) {
      console.error('Failed to fetch data', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentDate, token])

  // Handlers
  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7))
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7))
  
  const handleShiftCreate = async (start: Date, end: Date) => {
    try {
      const res = await fetch('/api/trainer/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          startTime: start.toISOString(),
          endTime: end.toISOString()
        })
      })
      if (res.ok) fetchData()
      else alert('作成に失敗しました')
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    }
  }

  const handleShiftUpdate = async (id: string, start: Date, end: Date) => {
    try {
      const res = await fetch('/api/trainer/shifts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          id,
          startTime: start.toISOString(),
          endTime: end.toISOString()
        })
      })
      if (res.ok) fetchData()
      else alert('更新に失敗しました')
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    }
  }

  const handleShiftDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/trainer/shifts?token=${token}&id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) fetchData()
      else alert('削除に失敗しました')
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    }
  }

  const handleCopyPrevWeek = async () => {
    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      const prevStart = subDays(start, 7)

      const res = await fetch('/api/trainer/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'copy_previous_week',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          sourceStartDate: prevStart.toISOString()
        })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`${data.count}件のシフトをコピーしました`)
        fetchData()
      } else {
        const err = await res.json()
        alert(`コピーに失敗しました: ${err.message || '不明なエラー'}`)
      }
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyTemplates = async () => {
    if (!confirm('現在の週に固定シフトを反映しますか？\n※現在登録されているシフトは上書きされます。')) return

    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })

      const res = await fetch('/api/trainer/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'generate_from_templates',
          startDate: start.toISOString(),
          endDate: end.toISOString()
        })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`${data.count}件のシフトを作成しました`)
        fetchData()
      } else {
        const err = await res.json()
        alert(`反映に失敗しました: ${err.message || '不明なエラー'}`)
      }
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleShiftSelect = (shiftId: string) => {
    setSelectedShiftIds(prev => {
      if (prev.includes(shiftId)) {
        return prev.filter(id => id !== shiftId)
      } else {
        return [...prev, shiftId]
      }
    })
  }

  const handleBulkDelete = async () => {
    if (selectedShiftIds.length === 0) return
    if (!confirm(`${selectedShiftIds.length}件のシフトを削除しますか？`)) return

    setLoading(true)
    try {
      const res = await fetch('/api/trainer/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'bulk_delete',
          shiftIds: selectedShiftIds
        })
      })

      if (res.ok) {
        const data = await res.json()
        // alert(`${data.count}件のシフトを削除しました`)
        setSelectedShiftIds([])
        setSelectionMode(false)
        fetchData()
      } else {
        const err = await res.json()
        alert(`削除に失敗しました: ${err.message || '不明なエラー'}`)
      }
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 space-y-4">
        {/* Header Row */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">シフト管理</h2>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Action Buttons */}
          <div className="flex-1 w-full md:w-auto flex flex-wrap items-center justify-center md:justify-start gap-2 order-2 md:order-1">
            {!selectionMode ? (
                <>
                  <button
                    onClick={() => setSelectionMode(true)}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    複数選択
                  </button>

                  <button
                    onClick={handleCopyPrevWeek}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    先週コピー
                  </button>

                  <button
                    onClick={handleApplyTemplates}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    固定シフト反映
                  </button>

                  <button
                    onClick={() => setIsTemplateModalOpen(true)}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    固定シフト設定
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-600 font-medium mr-2">{selectedShiftIds.length}件選択中</span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedShiftIds.length === 0 || loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    選択したシフトを削除
                  </button>
                  <button
                    onClick={() => {
                      setSelectionMode(false)
                      setSelectedShiftIds([])
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    キャンセル
                  </button>
                </>
              )}
            </div>

            {/* Center: Date Navigation */}
          <div className="flex justify-center items-center space-x-4 w-full md:w-auto order-1 md:order-2">
            <button onClick={handlePrevWeek} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-xl font-bold text-gray-900 min-w-[140px] text-center">
              {format(currentDate, 'yyyy年M月', { locale: ja })}
            </span>
            <button onClick={handleNextWeek} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Right: Spacer */}
          <div className="hidden md:block flex-1 order-3"></div>
        </div>

        <div className="p-4">
          <ShiftCalendar
            currentDate={currentDate}
            shifts={shifts}
            templates={templates}
            trainerName={trainerName}
            loading={loading}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
            selectionMode={selectionMode}
            selectedShiftIds={selectedShiftIds}
            onShiftSelect={handleShiftSelect}
          />
        </div>
      </div>

      <TrainerTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        token={token}
        onSave={() => fetchData()}
      />
    </div>
  )
}
