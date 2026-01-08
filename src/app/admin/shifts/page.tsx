'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { addDays, subDays, startOfWeek, endOfWeek, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, Trainer } from '@/types'
import ShiftCalendar from './ShiftCalendar'
import TemplateModal from './TemplateModal'

export default function ShiftManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // State
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/dashboard')
  }, [status, session, router])

  // Fetch trainers on mount
  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const res = await fetch('/api/admin/trainers')
        if (res.ok) {
          const data = await res.json()
          setTrainers(data.trainers || [])
          // Select first trainer by default if available
          if (data.trainers && data.trainers.length > 0) {
            setSelectedTrainerId(data.trainers[0].id)
          }
        }
      } catch (e) {
        console.error('Failed to fetch trainers', e)
      }
    }
    if (status === 'authenticated') fetchTrainers()
  }, [status])

  // Fetch shifts when trainer or date changes
  useEffect(() => {
    if (!selectedTrainerId) return

    const fetchShifts = async () => {
      setLoading(true)
      try {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 })
        const end = endOfWeek(currentDate, { weekStartsOn: 1 })
        
        const params = new URLSearchParams({
          trainerId: selectedTrainerId,
          start: start.toISOString(),
          end: end.toISOString()
        })

        const res = await fetch(`/api/admin/shifts?${params}`)
        if (res.ok) {
          const data = await res.json()
          setShifts(data.shifts || [])
        }
      } catch (e) {
        console.error('Failed to fetch shifts', e)
      } finally {
        setLoading(false)
      }
    }

    fetchShifts()
  }, [selectedTrainerId, currentDate])

  // Handlers
  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7))
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7))
  const handleToday = () => setCurrentDate(new Date())

  const refreshShifts = async () => {
    // Re-trigger effect by shallow copy of date (or extract fetch logic)
    // Quick hack: toggle loading to force re-render won't work for fetch.
    // Better: extract fetch logic or toggle a refresh trigger.
    // For simplicity, we just duplicate the fetch call here or rely on state update.
    // Let's copy the fetch logic for now to ensure it runs immediately.
    if (!selectedTrainerId) return
    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      const params = new URLSearchParams({
        trainerId: selectedTrainerId,
        start: start.toISOString(),
        end: end.toISOString()
      })
      const res = await fetch(`/api/admin/shifts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setShifts(data.shifts || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFromTemplate = async () => {
    if (!selectedTrainerId) return
    if (!confirm('現在表示中の週にテンプレートからシフトを一括生成しますか？\n（既存のシフトに追加されます）')) return

    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })

      const res = await fetch('/api/admin/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_from_templates',
          trainerId: selectedTrainerId,
          startDate: start.toISOString(),
          endDate: end.toISOString()
        })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`${data.count}件のシフトを生成しました`)
        refreshShifts()
      } else {
        alert('生成に失敗しました')
      }
    } catch (e) {
      console.error(e)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPrevWeek = async () => {
    if (!selectedTrainerId) return
    if (!confirm('先週のシフトを今週にコピーしますか？')) return

    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      const prevStart = subDays(start, 7)

      const res = await fetch('/api/admin/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy_previous_week',
          trainerId: selectedTrainerId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          sourceStartDate: prevStart.toISOString()
        })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`${data.count}件のシフトをコピーしました`)
        refreshShifts()
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

  // CRUD Operations passed to Calendar
  const handleShiftCreate = async (start: Date, end: Date) => {
    if (!selectedTrainerId) return
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: selectedTrainerId,
          startTime: start.toISOString(),
          endTime: end.toISOString()
        })
      })
      if (res.ok) refreshShifts()
    } catch (e) {
      console.error(e)
      alert('作成に失敗しました')
    }
  }

  const handleShiftUpdate = async (id: string, start: Date, end: Date) => {
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: start.toISOString(),
          endTime: end.toISOString()
        })
      })
      if (res.ok) refreshShifts()
    } catch (e) {
      console.error(e)
      alert('更新に失敗しました')
    }
  }

  const handleShiftDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) refreshShifts()
    } catch (e) {
      console.error(e)
      alert('削除に失敗しました')
    }
  }

  if (status === 'loading') return <div className="p-8 text-center">読み込み中...</div>

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">シフト管理</h1>
          <p className="mt-1 text-sm text-gray-500">トレーナーの勤務時間を管理します</p>
        </div>
        
        {/* Trainer Selector */}
        <div className="w-full md:w-64">
          <label className="block text-xs text-gray-500 mb-1">対象トレーナー</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={selectedTrainerId}
            onChange={(e) => setSelectedTrainerId(e.target.value)}
          >
            {trainers.map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button onClick={handlePrevWeek} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-lg font-medium text-gray-900 min-w-[140px] text-center">
            {format(currentDate, 'yyyy年M月', { locale: ja })}
          </span>
          <button onClick={handleNextWeek} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={handleToday} className="text-sm text-indigo-600 hover:text-indigo-800 ml-2 font-medium">
            今週
          </button>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => setTemplateModalOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            disabled={!selectedTrainerId}
          >
            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            固定シフト設定
          </button>
          
          <button
            onClick={handleGenerateFromTemplate}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            disabled={!selectedTrainerId}
          >
            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            テンプレートから反映
          </button>
          
          <button
            onClick={handleCopyPrevWeek}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            disabled={!selectedTrainerId}
          >
            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
            先週をコピー
          </button>
        </div>
      </div>

      {/* Calendar Area */}
      <div className="bg-white shadow rounded-lg">
        {selectedTrainerId ? (
          <ShiftCalendar
            currentDate={currentDate}
            shifts={shifts}
            loading={loading}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            トレーナーを選択してください
          </div>
        )}
      </div>

      {/* Template Modal */}
      {selectedTrainerId && (
        <TemplateModal
          isOpen={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          trainerId={selectedTrainerId}
          onSave={() => {
            // Optionally auto-generate for current week if user wants?
            // For now just save.
          }}
        />
      )}
    </div>
  )
}
