'use client'

import { useState, useEffect } from 'react'
import { ShiftTemplate } from '@/types'
import AppModal from '@/components/ui/AppModal'
import Button from '@/components/ui/Button'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  trainerId: string
  onSave: () => void
}

const DAYS_OF_WEEK = [
  { id: 1, name: '月' },
  { id: 2, name: '火' },
  { id: 3, name: '水' },
  { id: 4, name: '木' },
  { id: 5, name: '金' },
  { id: 6, name: '土' },
  { id: 0, name: '日' },
]

export default function TemplateModal({ isOpen, onClose, trainerId, onSave }: TemplateModalProps) {
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<{ dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }[]>([])

  // Initialize templates with empty values for all days
  useEffect(() => {
    if (isOpen && trainerId) {
      fetchTemplates()
    }
  }, [isOpen, trainerId])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const timestamp = new Date().getTime()
      const res = await fetch(`/api/admin/shifts/templates?trainerId=${trainerId}&_t=${timestamp}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const fetchedTemplates: ShiftTemplate[] = data.templates || []
        
        // Map fetched templates to UI state
        const initializedTemplates = DAYS_OF_WEEK.map(day => {
          const found = fetchedTemplates.find(t => t.day_of_week === day.id)
          return {
            dayOfWeek: day.id,
            startTime: found ? found.start_time.slice(0, 5) : '09:00',
            endTime: found ? found.end_time.slice(0, 5) : '21:00',
            enabled: !!found
          }
        })
        setTemplates(initializedTemplates)
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleDay = (dayIndex: number) => {
    const newTemplates = [...templates]
    newTemplates[dayIndex].enabled = !newTemplates[dayIndex].enabled
    setTemplates(newTemplates)
  }

  const handleChangeTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const newTemplates = [...templates]
    newTemplates[dayIndex][field] = value
    setTemplates(newTemplates)
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const activeTemplates = templates.filter(t => t.enabled)
      
      const res = await fetch('/api/admin/shifts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId,
          templates: activeTemplates
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save templates')
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Failed to save templates:', error)
      alert('テンプレートを保存できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AppModal
      title="固定シフト設定"
      onClose={onClose}
      size="lg"
      bodyClassName="p-4 sm:p-6"
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-text-secondary">キャンセル</Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={loading}
            className="rounded-full bg-brand-700 px-5 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </Button>
        </>
      )}
    >
          {loading && templates.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary mb-4">
                曜日ごとの基本勤務時間を設定します。設定した時間はカレンダーに固定シフトとして表示されます。
              </p>
              
              {templates.map((template, index) => {
                const dayName = DAYS_OF_WEEK.find(d => d.id === template.dayOfWeek)?.name
                return (
                  <div key={template.dayOfWeek} className="flex items-center space-x-4 p-3 rounded-lg border border-border-strong hover:bg-surface-base">
                    <div className="flex items-center h-5">
                      <input
                        id={`day-${template.dayOfWeek}`}
                        type="checkbox"
                        checked={template.enabled}
                        onChange={() => handleToggleDay(index)}
                        className="focus:ring-brand-500 h-4 w-4 text-brand-600 border-border-strong rounded-lg"
                      />
                    </div>
                    <label htmlFor={`day-${template.dayOfWeek}`} className="min-w-[3rem] text-sm font-normal text-text-secondary select-none cursor-pointer">
                      {dayName}曜日
                    </label>
                    
                    <div className={`flex items-center space-x-2 ${!template.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input
                        type="time"
                        value={template.startTime}
                        onChange={(e) => handleChangeTime(index, 'startTime', e.target.value)}
                        className="shadow-sm focus:ring-brand-500 focus:border-brand-500 block w-full sm:text-sm border-border-strong rounded-lg"
                      />
                      <span className="text-text-secondary">〜</span>
                      <input
                        type="time"
                        value={template.endTime}
                        onChange={(e) => handleChangeTime(index, 'endTime', e.target.value)}
                        className="shadow-sm focus:ring-brand-500 focus:border-brand-500 block w-full sm:text-sm border-border-strong rounded-lg"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
    </AppModal>
  )
}
