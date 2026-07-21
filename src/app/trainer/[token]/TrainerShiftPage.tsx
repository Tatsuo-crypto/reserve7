'use client'

import { useState, useEffect } from 'react'
import { startOfWeek, endOfWeek, addDays, subDays, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Shift, ShiftTemplate } from '@/types'
import ShiftCalendar from '@/components/shifts/ShiftCalendar'
import TrainerTemplateModal from '@/components/shifts/TrainerTemplateModal'
import Icon from '@/components/ui/icons'
import Button from '@/components/ui/Button'

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
      else alert('作成できませんでした。もう一度お試しください。')
    } catch (e) {
      console.error(e)
      alert('作成できませんでした。もう一度お試しください。')
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
      else alert('更新できませんでした。もう一度お試しください。')
    } catch (e) {
      console.error(e)
      alert('更新できませんでした。もう一度お試しください。')
    }
  }

  const handleShiftDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/trainer/shifts?token=${token}&id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) fetchData()
      else alert('削除できませんでした。もう一度お試しください。')
    } catch (e) {
      console.error(e)
      alert('削除できませんでした。もう一度お試しください。')
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
        alert(`${data.count}件のシフトをコピーしました。`)
        fetchData()
      } else {
        const err = await res.json()
        alert(`コピーできませんでした。${err.message || 'もう一度お試しください。'}`)
      }
    } catch (e) {
      console.error(e)
      alert('コピーできませんでした。もう一度お試しください。')
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
        alert(`${data.count}件のシフトを作成しました。`)
        fetchData()
      } else {
        const err = await res.json()
        alert(`反映できませんでした。${err.message || 'もう一度お試しください。'}`)
      }
    } catch (e) {
      console.error(e)
      alert('反映できませんでした。もう一度お試しください。')
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
        alert(`削除できませんでした。${err.message || 'もう一度お試しください。'}`)
      }
    } catch (e) {
      console.error(e)
      alert('削除できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-raised rounded-lg shadow-sm border border-border-strong">
      <div className="p-4 border-b border-border-strong space-y-4">
        {/* Header Row */}
        {/* <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-text-primary">シフト管理</h2>
        </div> */}

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Action Buttons */}
          <div className="flex-1 w-full md:w-auto flex flex-wrap items-center justify-center md:justify-start gap-2 order-2 md:order-1">
            {!selectionMode ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectionMode(true)}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-lg text-text-secondary bg-surface-raised hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="checkCircle" size={16} className="mr-2 text-text-secondary" />
                    複数選択
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyPrevWeek}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-lg text-text-secondary bg-surface-raised hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="copy" size={16} className="mr-2 text-text-secondary" />
                    先週コピー
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyTemplates}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-lg text-text-secondary bg-surface-raised hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="refresh" size={16} className="mr-2 text-text-secondary" />
                    固定シフト反映
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsTemplateModalOpen(true)}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-lg text-text-secondary bg-surface-raised hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="settings" size={16} className="mr-2 text-text-secondary" />
                    固定シフト設定
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm text-text-secondary font-normal mr-2">{selectedShiftIds.length}件選択中</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={selectedShiftIds.length === 0 || loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-normal rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="trash" size={16} className="mr-2" />
                    選択したシフトを削除
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectionMode(false)
                      setSelectedShiftIds([])
                    }}
                    className="inline-flex items-center px-4 py-2 border border-border-strong shadow-sm text-sm font-normal rounded-lg text-text-secondary bg-surface-raised hover:bg-surface-base transition-colors"
                  >
                    <Icon name="close" size={16} className="mr-2 text-text-secondary" />
                    キャンセル
                  </Button>
                </>
              )}
            </div>

          {/* Center: Date Navigation */}
          <div className="flex justify-center items-center space-x-4 w-full md:w-auto order-1 md:order-2">
            <Button type="button" variant="ghost" size="sm" onClick={handlePrevWeek} className="rounded-full p-2 text-text-secondary hover:bg-surface-overlay">
              <Icon name="chevronLeft" size={20} />
            </Button>
            <span className="text-xl font-semibold text-text-primary min-w-[140px] text-center">
              {format(currentDate, 'yyyy年M月', { locale: ja })}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={handleNextWeek} className="rounded-full p-2 text-text-secondary hover:bg-surface-overlay">
              <Icon name="chevronRight" size={20} />
            </Button>
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
