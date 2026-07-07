'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, Trainer, ShiftTemplate } from '@/types'
import ShiftCalendar from '@/components/shifts/ShiftCalendar'
import TeamShiftCalendar from '@/components/shifts/TeamShiftCalendar'
import TemplateModal from '@/components/shifts/TemplateModal'
import Icon from '@/components/ui/icons'

export default function ShiftManagementPage() {
  // Force rebuild to fix ReferenceError
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // State
  const [viewMode, setViewMode] = useState<'individual' | 'team'>('individual')
  const [allTrainers, setAllTrainers] = useState<Trainer[]>([])
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [currentStoreId, setCurrentStoreId] = useState<string>('')
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([])

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/dashboard')
  }, [status, session, router])

  // Handle Store Switcher
  useEffect(() => {
    const updateStoreFromCookie = () => {
      const match = document.cookie.match(/(^|;)\s*admin_store_preference=([^;]+)/)
      const storeId = match ? match[2] : ''
      setCurrentStoreId(storeId)
      console.log('Store updated from cookie:', storeId)
    }

    updateStoreFromCookie()

    const handleStoreChange = () => {
      console.log('Store change event received')
      updateStoreFromCookie()
    }

    window.addEventListener('storeChange', handleStoreChange)
    return () => window.removeEventListener('storeChange', handleStoreChange)
  }, [])

  // Fetch all active trainers on mount
  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const timestamp = new Date().getTime()
        const res = await fetch(`/api/admin/trainers?status=active&_t=${timestamp}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setAllTrainers(data.trainers || [])
          console.log('Fetched all trainers:', data.trainers?.length)
        }
      } catch (e) {
        console.error('Failed to fetch trainers', e)
      }
    }
    if (status === 'authenticated') fetchTrainers()
  }, [status])

  // Filter trainers based on current store
  const filteredTrainers = allTrainers.filter(t => {
    // If currentStoreId is empty or 'all', show all trainers (or maybe just show none/default?)
    // Usually for admin, if no store selected, maybe show all.
    // But if we want strictly store-based, we should filter.
    if (!currentStoreId || currentStoreId === 'all') return true
    return t.store_id === currentStoreId
  })

  // Auto-select first trainer if selection becomes invalid or empty
  useEffect(() => {
    // Determine the effective storeId (cookie or fallback to first trainer's store if no cookie)
    // Actually, if we use filteredTrainers, we implicitly respect the store.
    
    if (filteredTrainers.length > 0) {
      const isSelectedValid = filteredTrainers.some(t => t.id === selectedTrainerId)
      if (!isSelectedValid) {
        setSelectedTrainerId(filteredTrainers[0].id)
      }
    } else {
      if (selectedTrainerId) {
        setSelectedTrainerId('')
      }
    }
  }, [filteredTrainers, selectedTrainerId])

  // Fetch templates and shifts
  // Combined effect to avoid race conditions or redundant fetches
  useEffect(() => {
    let isCancelled = false

    const fetchData = async () => {
      // Determine effective storeId
      const storeId = (currentStoreId && currentStoreId !== 'all') 
        ? currentStoreId 
        : ((session?.user as any)?.storeId || allTrainers[0]?.store_id)
      
      // If we are in individual mode but no trainer selected (and we have trainers), wait for auto-select
      if (viewMode === 'individual' && !selectedTrainerId && filteredTrainers.length > 0) {
        return
      }

      setLoading(true)
      // Clear data immediately to prevent displaying stale data from previous trainer/week
      setShifts([])
      setTemplates([])

      try {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 })
        const end = endOfWeek(currentDate, { weekStartsOn: 1 })
        const timestamp = new Date().getTime()
        
        // 1. Fetch Templates
        let templatesUrl = ''
        if (viewMode === 'individual' && selectedTrainerId) {
          templatesUrl = `/api/admin/shifts/templates?trainerId=${selectedTrainerId}&_t=${timestamp}`
        } else if (viewMode === 'team' && storeId) {
          templatesUrl = `/api/admin/shifts/templates?storeId=${storeId}&_t=${timestamp}`
        }
        
        if (templatesUrl) {
          const tRes = await fetch(templatesUrl, { cache: 'no-store' })
          if (tRes.ok && !isCancelled) {
            const tData = await tRes.json()
            setTemplates(tData.templates || [])
          }
        }

        // 2. Fetch Shifts
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
          _t: timestamp.toString()
        })

        let shouldFetchShifts = false
        if (viewMode === 'individual' && selectedTrainerId) {
          params.set('trainerId', selectedTrainerId)
          shouldFetchShifts = true
        } else if (storeId) {
          params.set('storeId', storeId)
          shouldFetchShifts = true
        }

        if (shouldFetchShifts) {
          const sRes = await fetch(`/api/admin/shifts?${params}`, { cache: 'no-store' })
          if (sRes.ok && !isCancelled) {
            const sData = await sRes.json()
            setShifts(sData.shifts || [])
          }
        }

      } catch (e) {
        console.error('Failed to fetch data', e)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    // Only run if we have basic data loaded
    if (status === 'authenticated' && (allTrainers.length > 0 || (currentStoreId && currentStoreId !== 'all'))) {
      fetchData()
    }

    return () => {
      isCancelled = true
    }
  }, [selectedTrainerId, currentDate, viewMode, allTrainers, session, currentStoreId, filteredTrainers.length])

  // Handlers
  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7))
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7))
  const handleToday = () => setCurrentDate(new Date())

  const refreshShifts = async () => {
    // Clear selection on refresh
    setSelectedShiftIds([])
    
    const storeId = (currentStoreId && currentStoreId !== 'all')
      ? currentStoreId
      : ((session?.user as any)?.storeId || allTrainers[0]?.store_id)
      
    setLoading(true)
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      const timestamp = new Date().getTime()
      
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        _t: timestamp.toString()
      })

      let shouldFetch = false
      if (viewMode === 'individual' && selectedTrainerId) {
        params.set('trainerId', selectedTrainerId)
        shouldFetch = true
      } else if (storeId) {
        params.set('storeId', storeId)
        shouldFetch = true
      }

      if (shouldFetch) {
        const res = await fetch(`/api/admin/shifts?${params}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setShifts(data.shifts || [])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPrevWeek = async () => {
    if (!selectedTrainerId) return

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

  const handleApplyTemplates = async () => {
    if (!selectedTrainerId) return
    if (!confirm('現在の週に固定シフトを反映しますか？\n※現在登録されているシフトは上書きされます。')) return

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
        alert(`${data.count}件のシフトを作成しました`)
        refreshShifts()
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

  // Selection Handlers
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
      const res = await fetch('/api/admin/shifts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_delete',
          trainerId: viewMode === 'individual' ? selectedTrainerId : undefined, // Only restrict to trainer in individual mode
          shiftIds: selectedShiftIds
        })
      })

      if (res.ok) {
        // const data = await res.json()
        // alert(`${data.count}件のシフトを削除しました`)
        setSelectedShiftIds([])
        setSelectionMode(false)
        refreshShifts()
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

  // CRUD Operations passed to Calendar
  const handleShiftCreate = async (trainerId: string, start: Date, end: Date) => {
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: trainerId,
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
    <div className="max-w-7xl mx-auto pt-4 pb-12 px-4 sm:px-6 lg:px-8">

      {/* View Mode and Trainer Selector */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* View Mode Switcher */}
        <div className="flex bg-surface-overlay p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`px-4 py-2 text-sm font-normal rounded-md transition-all ${
              viewMode === 'individual' 
                ? 'bg-surface-raised text-text-primary shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            個人
          </button>
          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={`px-4 py-2 text-sm font-normal rounded-md transition-all ${
              viewMode === 'team' 
                ? 'bg-surface-raised text-text-primary shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            店舗
          </button>
        </div>

        {/* Trainer Selector (Only for individual view) */}
        {viewMode === 'individual' && (
          <div className="w-full md:w-64">
            <label className="block text-xs text-text-secondary mb-1 text-center md:text-left">対象トレーナー</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
            >
              {filteredTrainers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-surface-raised p-4 rounded-lg shadow-sm border border-border-strong mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-center w-full sm:w-auto space-x-2">
          <button type="button" onClick={handlePrevWeek} className="p-2 hover:bg-surface-overlay rounded-full text-text-secondary">
            <Icon name="chevronLeft" size={20} />
          </button>
          <span className="text-lg font-normal text-text-primary min-w-[120px] text-center">
            {format(currentDate, 'yyyy年M月', { locale: ja })}
          </span>
          <button type="button" onClick={handleNextWeek} className="p-2 hover:bg-surface-overlay rounded-full text-text-secondary">
            <Icon name="chevronRight" size={20} />
          </button>
        </div>

        <div className="w-full sm:w-auto flex flex-wrap items-center justify-center sm:justify-end gap-2">
          {!selectionMode ? (
            <>
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="inline-flex items-center justify-center px-3 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-md text-text-secondary bg-surface-raised hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={viewMode === 'individual' && !selectedTrainerId}
              >
                <Icon name="checkCircle" size={16} className="mr-2 text-text-secondary" />
                複数選択
              </button>

              {viewMode === 'individual' && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyPrevWeek}
                    className="inline-flex items-center justify-center px-3 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-md text-text-secondary bg-surface-raised hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedTrainerId || loading}
                  >
                    <Icon name="copy" size={16} className="mr-2 text-text-secondary" />
                    先週コピー
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyTemplates}
                    className="inline-flex items-center justify-center px-3 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-md text-text-secondary bg-surface-raised hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedTrainerId || loading}
                  >
                    <Icon name="refresh" size={16} className="mr-2 text-text-secondary" />
                    固定シフト反映
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplateModalOpen(true)}
                    className="inline-flex items-center justify-center px-3 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-md text-text-secondary bg-surface-raised hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedTrainerId || loading}
                  >
                    <Icon name="settings" size={16} className="mr-2 text-text-secondary" />
                    固定シフト設定
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-sm text-text-secondary font-normal mr-2">{selectedShiftIds.length}件選択中</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedShiftIds.length === 0 || loading}
                className="inline-flex items-center justify-center px-3 py-2 border border-transparent shadow-sm text-sm font-normal rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="trash" size={16} className="mr-2" />
                選択したシフトを削除
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectionMode(false)
                  setSelectedShiftIds([])
                }}
                className="inline-flex items-center justify-center px-3 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-md text-text-secondary bg-surface-raised hover:bg-surface-base"
              >
                <Icon name="close" size={16} className="mr-2 text-text-secondary" />
                キャンセル
              </button>
            </>
          )}
        </div>
      </div>

      {/* Calendar Area */}
      <div className="bg-surface-raised shadow rounded-lg">
        {viewMode === 'individual' ? (
          selectedTrainerId ? (
            <ShiftCalendar
              currentDate={currentDate}
              shifts={shifts}
              templates={templates || []}
              trainerName={filteredTrainers.find(t => t.id === selectedTrainerId)?.full_name || ''}
              loading={loading}
              onShiftCreate={(start, end) => handleShiftCreate(selectedTrainerId, start, end)}
              onShiftUpdate={handleShiftUpdate}
              onShiftDelete={handleShiftDelete}
              selectionMode={selectionMode}
              selectedShiftIds={selectedShiftIds}
              onShiftSelect={handleShiftSelect}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-text-secondary">
              トレーナーを選択してください
            </div>
          )
        ) : (
          <TeamShiftCalendar
            currentDate={currentDate}
            trainers={filteredTrainers}
            shifts={shifts}
            templates={templates || []}
            loading={loading}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
            selectionMode={selectionMode}
            selectedShiftIds={selectedShiftIds}
            onShiftSelect={handleShiftSelect}
          />
        )}
      </div>

      {/* Template Modal */}
      {selectedTrainerId && templateModalOpen && (
        <TemplateModal
          isOpen={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          trainerId={selectedTrainerId}
          onSave={async () => {
            setTemplateModalOpen(false)
            // Refetch templates to update view
            if (selectedTrainerId) {
              const res = await fetch(`/api/admin/shifts/templates?trainerId=${selectedTrainerId}`)
              if (res.ok) {
                const data = await res.json()
                setTemplates(data.templates || [])
              }
            }
          }}
        />
      )}
    </div>
  )
}
