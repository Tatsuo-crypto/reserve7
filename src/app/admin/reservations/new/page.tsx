'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { getStoreDisplayName } from '@/lib/auth-utils'

interface Client {
  id: string
  name: string
  email: string
  displayName: string
}

// Helper function to get default datetime (today at 12:00)
function getDefaultDateTime() {
  const now = new Date()
  now.setHours(12, 0, 0, 0) // Set to 12:00 PM
  return now.toISOString().slice(0, 16) // Format for datetime-local input
}


export default function NewReservationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  
  const [formData, setFormData] = useState({
    clientId: '',
    startTime: '',
    duration: 60, // Default 60 minutes
    calendarId: '', // Will be set based on user's store
    notes: '',
    isBlocked: false, // New field for blocked time
    // For blocked time - separate date and time fields
    blockedDate: '',
    blockedStartTime: '09:00',
    blockedEndTime: '12:00',
  })

  // Fetch clients and set default start time after component mounts
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients')
        if (response.ok) {
          const result = await response.json()
          const data = result.data || result
          console.log('Frontend - Clients received:', data.clients)
          setClients(data.clients || [])
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
    
    // Set default values based on user's store
    if (session?.user?.email) {
      const userStoreId = session.user.email === 'tandjgym@gmail.com' ? 'tandjgym@gmail.com' : 'tandjgym2goutenn@gmail.com'
      setFormData(prev => ({
        ...prev,
        startTime: prev.startTime || getDefaultDateTime(),
        calendarId: userStoreId
      }))
    } else {
      // Set default time even if no session
      setFormData(prev => ({
        ...prev,
        startTime: prev.startTime || getDefaultDateTime()
      }))
    }
  }, [session])

  // Prefill startTime from query param if provided (e.g., from Timeline click)
  useEffect(() => {
    const qsStartTime = searchParams?.get('startTime')
    if (qsStartTime) {
      setFormData(prev => ({
        ...prev,
        startTime: qsStartTime,
      }))
    }
  }, [searchParams])

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

  const generateTitle = (client: Client) => {
    // Get the selected start time to calculate count based on chronological order
    const selectedStartTime = formData.startTime
    if (!selectedStartTime) {
      // If no start time selected yet, default to count 1
      return `${client.name}1`
    }

    // For now, just return client name + 1 as we'll calculate this on the server
    return `${client.name}1`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('Form data:', formData)
      console.log('clientId:', formData.clientId, 'length:', formData.clientId.length)
      console.log('startTime:', formData.startTime, 'length:', formData.startTime.length)

      // Validate required fields
      if (!formData.startTime.trim()) {
        throw new Error('開始時間は必須です')
      }

      // For blocked time, we don't need a client
      let selectedClient = null
      if (!formData.isBlocked) {
        if (!formData.clientId.trim()) {
          throw new Error('クライアントを選択してください')
        }
        selectedClient = clients.find(client => client.id === formData.clientId)
        if (!selectedClient) {
          throw new Error('有効なクライアントを選択してください')
        }
      }

      // Convert local datetime to ISO string
      const startDateTime = new Date(formData.startTime)
      if (isNaN(startDateTime.getTime())) {
        throw new Error('有効な日時を入力してください')
      }

      // Calculate end time based on duration
      const endDateTime = new Date(startDateTime.getTime() + formData.duration * 60 * 1000)

      // Prepare data for API
      let requestData
      if (formData.isBlocked) {
        // For blocked time, combine date and time fields
        if (!formData.blockedDate || !formData.blockedStartTime || !formData.blockedEndTime) {
          setError('予約不可時間の設定には日付、開始時刻、終了時刻が必要です')
          return
        }

        // Validate that end time is after start time
        if (formData.blockedEndTime <= formData.blockedStartTime) {
          setError('終了時刻は開始時刻より後に設定してください')
          return
        }

        // Combine date and time
        const startDateTime = `${formData.blockedDate}T${formData.blockedStartTime}`
        const endDateTime = `${formData.blockedDate}T${formData.blockedEndTime}`
        
        // Calculate duration in minutes
        const start = new Date(startDateTime)
        const end = new Date(endDateTime)
        const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60))

        requestData = {
          clientId: 'BLOCKED',
          startTime: startDateTime,
          duration: duration,
          calendarId: formData.calendarId,
          notes: formData.notes,
          title: formData.notes || '予約不可',
        }
      } else {
        // For regular reservation
        requestData = {
          clientId: formData.clientId,
          startTime: formData.startTime,
          duration: formData.duration,
          calendarId: formData.calendarId,
          notes: formData.notes,
        }
      }

      console.log('Sending request to API:', requestData)
      
      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      console.log('API Response status:', response.status)
      const data = await response.json()
      console.log('API Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || '予約の作成に失敗しました')
      }

      setSuccess('予約が正常に作成されました')
      
      // Reset form
      setFormData({
        clientId: '',
        startTime: getDefaultDateTime(),
        duration: 60,
        calendarId: 'tandjgym@gmail.com',
        notes: '',
        isBlocked: false,
        blockedDate: '',
        blockedStartTime: '09:00',
        blockedEndTime: '12:00',
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

  // Generate datetime-local input default (today at 12:00)
  const getDefaultDateTime = () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0) // Set to 12:00 PM
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
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-center">
              <button
                onClick={() => router.back()}
                className="absolute left-4 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">新規予約作成</h1>
                <p className="mt-2 text-gray-600">クライアントの予約を作成します</p>
              </div>
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
            {/* Reservation Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                予約タイプ *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="reservationType"
                    value="client"
                    checked={!formData.isBlocked}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, clientId: '' }))}
                    className="mr-2"
                  />
                  <span>クライアント予約</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="reservationType"
                    value="blocked"
                    checked={formData.isBlocked}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: true, clientId: '' }))}
                    className="mr-2"
                  />
                  <span>予約不可時間</span>
                </label>
              </div>
            </div>

            {/* Client Selection - Only show for client reservations */}
            {!formData.isBlocked && (
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
                    required={!formData.isBlocked}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">クライアントを選択してください</option>
                    {clients && clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  予約を作成するクライアントを選択してください
                </p>
              </div>
            )}


            {/* Date and Time Selection */}
            {formData.isBlocked ? (
              // Blocked time: separate date and time inputs
              <div className="space-y-4">
                <div>
                  <label htmlFor="blockedDate" className="block text-sm font-medium text-gray-700 mb-2">
                    日付 *
                  </label>
                  <input
                    type="date"
                    id="blockedDate"
                    value={formData.blockedDate}
                    onChange={(e) => setFormData({ ...formData, blockedDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="blockedStartTime" className="block text-sm font-medium text-gray-700 mb-2">
                      開始時刻 *
                    </label>
                    <input
                      type="time"
                      id="blockedStartTime"
                      value={formData.blockedStartTime}
                      onChange={(e) => setFormData({ ...formData, blockedStartTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="blockedEndTime" className="block text-sm font-medium text-gray-700 mb-2">
                      終了時刻 *
                    </label>
                    <input
                      type="time"
                      id="blockedEndTime"
                      value={formData.blockedEndTime}
                      onChange={(e) => setFormData({ ...formData, blockedEndTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Regular reservation: datetime-local only (no duration needed)
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                  開始日時 *
                </label>
                <input
                  type="datetime-local"
                  id="startTime"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            {/* Session Duration - Only show for regular reservations */}
            {!formData.isBlocked && (
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                  セッション時間 *
                </label>
                <select
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value={30}>30分</option>
                  <option value={60}>60分</option>
                  <option value={90}>90分</option>
                  <option value={120}>120分</option>
                </select>
              </div>
            )}

            {/* Store Display (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                店舗
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                {session?.user?.email ? getStoreDisplayName(session.user.email) : 'T&J GYM1号店'}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                ログインしている店舗での予約作成です
              </p>
            </div>


            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                {formData.isBlocked ? '理由（任意）' : 'メモ（任意）'}
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                maxLength={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={formData.isBlocked ? "予約不可の理由を入力してください（例：定期メンテナンス、休業日）" : "特記事項があれば入力してください"}
              />
              <p className="mt-1 text-sm text-gray-500">
                {formData.notes.length}/1000文字
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-8 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors w-32 flex items-center justify-center whitespace-nowrap"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-32 flex items-center justify-center whitespace-nowrap"
              >
                {loading ? '作成中...' : (formData.isBlocked ? '予約不可設定' : '予約作成')}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            {formData.isBlocked ? '予約不可時間について' : '予約作成について'}
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            {formData.isBlocked ? (
              <>
                <li>• 予約不可時間は他の予約と重複できません</li>
                <li>• 営業時間外、休業日、メンテナンス時間などに使用してください</li>
                <li>• 理由を入力すると管理しやすくなります</li>
                <li>• 予約一覧で「予約不可」として表示されます</li>
              </>
            ) : (
              <>
                <li>• セッション時間は30分、60分、90分、120分から選択できます</li>
                <li>• 同じ時間帯に重複する予約は作成できません</li>
                <li>• クライアントのメールアドレスは登録済みのものを使用してください</li>
                <li>• 作成された予約はクライアントの予約一覧に表示されます</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
