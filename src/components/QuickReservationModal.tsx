'use client'

import { useState, useEffect } from 'react'

interface Client {
  id: string
  full_name: string
  email: string
  plan?: string
}

interface QuickReservationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedDate: string
  selectedTime: string
  onSuccess: () => void
}

export default function QuickReservationModal({
  isOpen,
  onClose,
  selectedDate,
  selectedTime,
  onSuccess
}: QuickReservationModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [existingReservations, setExistingReservations] = useState<any[]>([])

  // Fetch clients and reservations when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchClients()
      fetchExistingReservations()
    }
  }, [isOpen])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/members')
      console.log('Members API response status:', response.status)
      if (response.ok) {
        const result = await response.json()
        console.log('Members API result:', result)
        const data = result.data || result
        console.log('Members data:', data)
        setClients(data.members || [])
      } else {
        const errorText = await response.text()
        console.error('Members API error:', response.status, errorText)
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingReservations = async () => {
    try {
      console.log('Fetching existing reservations...')
      const response = await fetch('/api/reservations')
      console.log('Reservations API response status:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('Reservations API result:', result)
        const data = result.data || result
        console.log('Reservations data:', data)
        const reservations = data.reservations || []
        console.log('Setting existing reservations:', reservations)
        setExistingReservations(reservations)
      } else {
        const errorText = await response.text()
        console.error('Reservations API error:', response.status, errorText)
      }
    } catch (error) {
      console.error('Failed to fetch existing reservations:', error)
    }
  }

  // Generate automatic title based on client and reservation count
  const generateTitle = () => {
    if (selectedClient === 'blocked') {
      return '予約不可'
    }

    const client = clients.find(c => c.id === selectedClient)
    if (!client) return '予約'

    // Get selected date's month and year (YYYY-MM format for comparison)
    const selectedYearMonth = selectedDate.substring(0, 7) // "2025-10"
    console.log('Selected year-month:', selectedYearMonth)
    console.log('Selected client ID:', selectedClient)
    console.log('Total existing reservations:', existingReservations.length)

    // Get existing reservations for this client in the same month
    const clientReservationsInMonth = existingReservations.filter(reservation => {
      // Skip blocked reservations
      if (!reservation.client || reservation.client.id === 'blocked') {
        return false
      }

      // Check if client matches
      if (reservation.client.id !== selectedClient) {
        return false
      }

      // Get reservation's year-month (YYYY-MM format)
      const reservationYearMonth = reservation.startTime.substring(0, 7)
      return reservationYearMonth === selectedYearMonth
    })

    // Sort existing reservations by date (ascending)
    const sortedReservations = clientReservationsInMonth.sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })

    // Create array including the new reservation
    const newReservationDate = new Date(`${selectedDate}T${selectedTime.split(' - ')[0]}:00`)
    const allReservationsWithNew = [...sortedReservations, {
      startTime: newReservationDate.toISOString(),
      isNew: true
    }]

    // Sort all reservations (including new one) by date
    const allSorted = allReservationsWithNew.sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })

    // Find the position of the new reservation (1-based index)
    const newReservationIndex = allSorted.findIndex(reservation => reservation.isNew)
    const currentCount = newReservationIndex + 1

    console.log('Sorted existing reservations:', sortedReservations.map(r => r.startTime))
    console.log('New reservation date:', newReservationDate.toISOString())
    console.log('All sorted reservations:', allSorted.map(r => r.startTime))
    console.log('New reservation will be #', currentCount)

    // Get plan max count
    const getPlanMaxCount = (plan: string | undefined) => {
      if (!plan) return 4
      if (plan === 'ダイエットコース') return 8
      if (plan.includes('6回')) return 6
      if (plan.includes('8回')) return 8
      if (plan.includes('2回')) return 2
      return 4
    }

    const maxCount = getPlanMaxCount(client.plan)
    return `${client.full_name}${currentCount}/${maxCount}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return

    try {
      setSubmitting(true)
      
      // Parse time range and calculate duration
      const [startTime, endTime] = selectedTime.split(' - ')
      
      // Create datetime strings in JST (no timezone conversion)
      const startDateTimeStr = `${selectedDate}T${startTime}:00`
      
      // Calculate duration in minutes
      const startHour = parseInt(startTime.split(':')[0])
      const startMinute = parseInt(startTime.split(':')[1])
      const endHour = parseInt(endTime.split(':')[0])
      const endMinute = parseInt(endTime.split(':')[1])
      
      const startTotalMinutes = startHour * 60 + startMinute
      const endTotalMinutes = endHour * 60 + endMinute
      const durationMinutes = endTotalMinutes - startTotalMinutes
      
      console.log('Time parsing:', {
        selectedDate,
        selectedTime,
        startTime,
        endTime,
        startDateTimeStr,
        durationMinutes
      })

      const generatedTitle = generateTitle()

      const requestBody = {
        title: generatedTitle,
        startTime: startDateTimeStr,
        duration: durationMinutes,
        clientId: selectedClient === 'blocked' ? 'BLOCKED' : selectedClient,
        notes
      }

      console.log('Sending reservation request:', requestBody)

      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        onSuccess()
        onClose()
        // Reset form
        setSelectedClient('')
        setNotes('')
      } else {
        const error = await response.json()
        alert(error.error || '予約の作成に失敗しました')
      }
    } catch (error) {
      console.error('Failed to create reservation:', error)
      alert('予約の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const formatSelectedDateTime = () => {
    const date = new Date(selectedDate + 'T00:00:00')
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    const dayOfWeek = dayNames[date.getDay()]
    return `${year}年${month}月${day}日（${dayOfWeek}） ${selectedTime}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              クイック予約作成
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>


          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Auto-generated Title Display */}
            {selectedClient && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル（自動生成）
                </label>
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                  {generateTitle()}
                </div>
              </div>
            )}

            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                クライアント選択
              </label>
              {loading ? (
                <div className="text-sm text-gray-500">読み込み中...</div>
              ) : (
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">クライアントを選択してください</option>
                  <option value="blocked" className="text-red-600">
                    予約不可時間
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name} ({client.plan || '未設定'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Time Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                予約時間
              </label>
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                {formatSelectedDateTime()}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メモ（任意）
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="メモを入力してください"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!selectedClient || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {submitting ? '作成中...' : '予約作成'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
