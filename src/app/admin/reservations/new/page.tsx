'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface Client {
  id: string
  name: string
  email: string
  displayName: string
}

// Helper function to get default datetime (current time + 1 hour)
function getDefaultDateTime() {
  const now = new Date()
  now.setHours(now.getHours() + 1)
  now.setMinutes(0, 0, 0) // Round to the hour
  return now.toISOString().slice(0, 16) // Format for datetime-local input
}

export default function NewReservationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  
  const [formData, setFormData] = useState({
    clientId: '',
    title: '',
    startTime: '',
    notes: '',
  })

  // Fetch clients and set default start time after component mounts
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients')
        if (response.ok) {
          const data = await response.json()
          setClients(data.clients)
        } else {
          console.error('Failed to fetch clients')
        }
      } catch (error) {
        console.error('Error fetching clients:', error)
      } finally {
        setLoadingClients(false)
      }
    }

    fetchClients()
    setFormData(prev => ({
      ...prev,
      startTime: getDefaultDateTime()
    }))
  }, [])

  // Check admin access
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/reservations')
    }
  }, [status, session, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Auto-generate title when client is selected
    if (name === 'clientId' && value) {
      const selectedClient = clients.find(client => client.id === value)
      if (selectedClient) {
        // Use setTimeout to ensure state is updated before generating title
        setTimeout(() => {
          generateTitle(selectedClient)
        }, 0)
      }
    } else if (name === 'startTime' && formData.clientId) {
      const selectedClient = clients.find(client => client.id === formData.clientId)
      if (selectedClient) {
        // Use setTimeout to ensure state is updated before generating title
        setTimeout(() => {
          generateTitle(selectedClient)
        }, 0)
      }
    }
  }

  const generateTitle = async (client: Client) => {
    try {
      // Get the selected start time to calculate count based on chronological order
      const selectedStartTime = formData.startTime
      if (!selectedStartTime) {
        // If no start time selected yet, default to count 1
        setFormData(prev => ({
          ...prev,
          title: `${client.name}1`
        }))
        return
      }

      // Get all reservations for this client to calculate chronological count
      const response = await fetch('/api/reservations')
      if (response.ok) {
        const data = await response.json()
        const selectedDate = new Date(selectedStartTime)
        const selectedMonth = selectedDate.getMonth()
        const selectedYear = selectedDate.getFullYear()

        // Filter reservations for same client, same month, and before selected date
        const clientReservationsInMonth = data.reservations
          .filter((r: any) => {
            const rDate = new Date(r.startTime)
            return r.client.id === client.id &&
                   rDate.getMonth() === selectedMonth &&
                   rDate.getFullYear() === selectedYear &&
                   rDate < selectedDate
          })
          .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

        const count = clientReservationsInMonth.length + 1 // +1 for the new reservation
        const title = `${client.name}${count}`
        setFormData(prev => ({
          ...prev,
          title: title
        }))
      }
    } catch (error) {
      console.error('Error generating title:', error)
      // Fallback to simple name if API fails
      setFormData(prev => ({
        ...prev,
        title: `${client.name}1`
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Debug: Log form data
      console.log('Form data:', formData)
      console.log('clientId:', formData.clientId, 'length:', formData.clientId.length)
      console.log('title:', formData.title, 'length:', formData.title.length)
      console.log('startTime:', formData.startTime, 'length:', formData.startTime.length)

      // Validate required fields
      if (!formData.clientId.trim() || !formData.title.trim() || !formData.startTime.trim()) {
        throw new Error('必須項目を入力してください')
      }

      // Find selected client
      const selectedClient = clients.find(client => client.id === formData.clientId)
      if (!selectedClient) {
        throw new Error('有効なクライアントを選択してください')
      }

      // Convert local datetime to ISO string
      const startDateTime = new Date(formData.startTime)
      if (isNaN(startDateTime.getTime())) {
        throw new Error('有効な日時を入力してください')
      }

      const requestData = {
        clientEmail: selectedClient.email,
        title: formData.title,
        startTime: startDateTime.toISOString(),
        notes: formData.notes || undefined,
      }

      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '予約の作成に失敗しました')
      }

      setSuccess('予約が正常に作成されました')
      
      // Reset form
      setFormData({
        clientEmail: '',
        title: '',
        startTime: '',
        notes: '',
      })

      // Redirect to reservations list after 2 seconds
      setTimeout(() => {
        router.push('/reservations')
      }, 2000)

    } catch (error) {
      console.error('Create reservation error:', error)
      setError(error instanceof Error ? error.message : '予約の作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // Generate datetime-local input default (current time + 1 hour)
  const getDefaultDateTime = () => {
    const now = new Date()
    now.setHours(now.getHours() + 1)
    now.setMinutes(0, 0, 0) // Round to nearest hour
    return now.toISOString().slice(0, 16) // Format for datetime-local input
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || session?.user?.role !== 'ADMIN') {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">新規予約作成</h1>
              <p className="mt-2 text-gray-600">クライアントの予約を作成します</p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-800">{success}</p>
            </div>
            <p className="text-green-700 text-sm mt-1">予約一覧ページに移動します...</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection */}
            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
                クライアント選択 *
              </label>
              {loadingClients ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                  クライアント情報を読み込み中...
                </div>
              ) : (
                <select
                  id="clientId"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">クライアントを選択してください</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.displayName}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-sm text-gray-500">
                予約を作成するクライアントを選択してください
              </p>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                予約タイトル *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                maxLength={255}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="パーソナルトレーニング"
              />
            </div>

            {/* Start Time */}
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                開始日時 *
              </label>
              <input
                type="datetime-local"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                予約は60分間の固定時間です
              </p>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                メモ（任意）
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                maxLength={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="特記事項があれば入力してください"
              />
              <p className="mt-1 text-sm text-gray-500">
                {formData.notes.length}/1000文字
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '作成中...' : '予約を作成'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">予約作成について</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 予約時間は60分固定です</li>
            <li>• 同じ時間帯に重複する予約は作成できません</li>
            <li>• クライアントのメールアドレスは登録済みのものを使用してください</li>
            <li>• 作成された予約はクライアントの予約一覧に表示されます</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
