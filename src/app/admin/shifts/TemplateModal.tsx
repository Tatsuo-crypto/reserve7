'use client'

import { useState, useEffect } from 'react'
import { ShiftTemplate } from '@/types'

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
      const res = await fetch(`/api/admin/shifts/templates?trainerId=${trainerId}`)
      if (res.ok) {
        const data = await res.json()
        const fetchedTemplates: ShiftTemplate[] = data.templates || []
        
        // Map fetched templates to UI state
        const initializedTemplates = DAYS_OF_WEEK.map(day => {
          const found = fetchedTemplates.find(t => t.day_of_week === day.id)
          return {
            dayOfWeek: day.id,
            startTime: found ? found.start_time.slice(0, 5) : '10:00',
            endTime: found ? found.end_time.slice(0, 5) : '19:00',
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
      alert('テンプレートの保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">固定シフト設定</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading && templates.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                曜日ごとの基本勤務時間を設定します。「反映」を行うまで実際のスケジュールには適用されません。
              </p>
              
              {templates.map((template, index) => {
                const dayName = DAYS_OF_WEEK.find(d => d.id === template.dayOfWeek)?.name
                return (
                  <div key={template.dayOfWeek} className="flex items-center space-x-4 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <div className="flex items-center h-5">
                      <input
                        id={`day-${template.dayOfWeek}`}
                        type="checkbox"
                        checked={template.enabled}
                        onChange={() => handleToggleDay(index)}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </div>
                    <label htmlFor={`day-${template.dayOfWeek}`} className="min-w-[3rem] text-sm font-medium text-gray-700 select-none cursor-pointer">
                      {dayName}曜日
                    </label>
                    
                    <div className={`flex items-center space-x-2 ${!template.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input
                        type="time"
                        value={template.startTime}
                        onChange={(e) => handleChangeTime(index, 'startTime', e.target.value)}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <span className="text-gray-500">〜</span>
                      <input
                        type="time"
                        value={template.endTime}
                        onChange={(e) => handleChangeTime(index, 'endTime', e.target.value)}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
          >
            {loading ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
