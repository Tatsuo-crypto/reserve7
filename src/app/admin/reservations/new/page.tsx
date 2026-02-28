'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { getStoreDisplayName } from '@/lib/auth-utils'
import { getPlanRank } from '@/lib/utils/member'

interface Client {
  id: string
  name: string
  email: string
  displayName: string
  plan?: string
}

type Trainer = {
  id: string
  full_name: string
  store_id: string
  status: 'active' | 'inactive'
}

// Helper function to get default datetime (today at 12:00)
function getDefaultDateTime() {
  const now = new Date()
  now.setHours(12, 0, 0, 0) // Set to 12:00 PM
  return now.toISOString().slice(0, 16) // Format for datetime-local input
}


function NewReservationContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const trainerToken = searchParams?.get('trainerToken')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [showShiftConfirmModal, setShowShiftConfirmModal] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<{ url: string, requestData: any } | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loadingTrainers, setLoadingTrainers] = useState(true)
  const [trainerInfo, setTrainerInfo] = useState<{ id: string, name: string, storeId: string } | null>(null)
  const [detectedTrainer, setDetectedTrainer] = useState<{ id: string, name: string } | null>(null)

  const [formData, setFormData] = useState({
    clientId: '',
    startTime: '',
    duration: 60, // Default 60 minutes
    calendarId: '', // Will be set based on user's store
    notes: '',
    isBlocked: false, // New field for blocked time
    isTrial: false,   // New field for trial reservation
    isGuest: false,   // New field for guest reservation
    isTraining: false, // New field for training reservation
    trialClientName: '', // For trial: manual client name input
    guestName: '',       // For guest: manual client name input
    // For blocked time - separate date and time fields
    blockedDate: '',
    blockedStartTime: '09:00',
    blockedEndTime: '12:00',
    trainerId: '',
    trainingTrainerIds: [] as string[],
    trainingDate: '',
    trainingStartTime: '15:00',
    trainingEndTime: '16:00',
  })

  // Fetch trainer info if token is present
  useEffect(() => {
    const fetchTrainerInfo = async () => {
      if (!trainerToken) return
      try {
        const res = await fetch(`/api/auth/trainer-token?token=${trainerToken}`)
        if (res.ok) {
          const data = await res.json()
          setTrainerInfo(data.trainer)
          // Set calendarId from trainer info - use storeId (UUID) for fetching trainers
          setFormData(prev => ({
            ...prev,
            calendarId: data.trainer.storeId
          }))
        } else {
          router.push('/login')
        }
      } catch (e) {
        console.error('Failed to fetch trainer info', e)
        router.push('/login')
      }
    }
    fetchTrainerInfo()
  }, [trainerToken, router])

  // Fetch clients and set default start time after component mounts
  useEffect(() => {
    const fetchClients = async () => {
      try {
        // Use API endpoint to fetch clients (works with RLS)
        // Add token if available
        const url = trainerToken
          ? `/api/admin/members?token=${trainerToken}`
          : '/api/admin/members'

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Failed to fetch clients')
        }

        const result = await response.json()
        const membersData = result.data?.members || result.members || []

        // Filter active clients only and transform to match expected Client interface
        const formattedClients = membersData
          .filter((member: any) => member.status === 'active')
          .map((member: any) => ({
            id: member.id,
            name: member.full_name,
            email: member.email,
            displayName: member.full_name,
            plan: member.plan
          }))
          .sort((a: Client, b: Client) => {
            const rankA = getPlanRank(a.plan)
            const rankB = getPlanRank(b.plan)
            if (rankA !== rankB) return rankA - rankB
            return (a.name || '').localeCompare(b.name || '', 'ja')
          })

        setClients(formattedClients)
      } catch (error) {
        console.error('Error fetching clients:', error)
      } finally {
        setLoadingClients(false)
      }
    }

    if (session || trainerToken) {
      fetchClients()
    }
  }, [session, trainerToken])

  // Set default values based on user's store
  useEffect(() => {
    if (session?.user?.email) {
      const userStoreId = session.user.email === 'tandjgym@gmail.com' ? 'tandjgym@gmail.com' : 'tandjgym2goutenn@gmail.com'
      setFormData(prev => ({
        ...prev,
        startTime: prev.startTime || getDefaultDateTime(),
        calendarId: userStoreId
      }))
    } else if (trainerInfo) {
      setFormData(prev => ({
        ...prev,
        startTime: prev.startTime || getDefaultDateTime(),
        calendarId: trainerInfo.storeId
      }))
    } else {
      // Set default time even if no session
      setFormData(prev => ({
        ...prev,
        startTime: prev.startTime || getDefaultDateTime()
      }))
    }
  }, [session, trainerInfo])

  // Load active trainers - for training type load all stores, otherwise current store only
  useEffect(() => {
    const loadTrainers = async () => {
      // For training type, load all trainers regardless of store
      // For other types, require calendarId
      if (!formData.isTraining && !formData.calendarId) return
      try {
        setLoadingTrainers(true)
        const storeParam = formData.isTraining ? '' : `&storeId=${encodeURIComponent(formData.calendarId)}`
        const url = trainerToken
          ? `/api/admin/trainers?status=active${storeParam}&token=${trainerToken}`
          : `/api/admin/trainers?status=active${storeParam}`

        const res = await fetch(url, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setTrainers(data.trainers || [])
        } else {
          setTrainers([])
        }
      } catch {
        setTrainers([])
      } finally {
        setLoadingTrainers(false)
      }
    }
    loadTrainers()
  }, [formData.calendarId, formData.isTraining, trainerToken])

  // Auto-detect on-duty trainer from shifts when startTime/duration changes
  useEffect(() => {
    const detectTrainer = async () => {
      if (!formData.startTime || !formData.calendarId || formData.isBlocked || formData.isTraining) {
        setDetectedTrainer(null)
        return
      }
      try {
        const start = new Date(formData.startTime + ':00+09:00')
        const end = new Date(start.getTime() + formData.duration * 60 * 1000)
        if (isNaN(start.getTime())) return

        const url = trainerToken
          ? `/api/shifts?start=${start.toISOString()}&end=${end.toISOString()}&token=${trainerToken}`
          : `/api/shifts?start=${start.toISOString()}&end=${end.toISOString()}`

        const res = await fetch(url, { credentials: 'include' })
        if (res.ok) {
          const result = await res.json()
          const shifts = result.data?.shifts || result.shifts || []
          // Find a shift that covers the entire reservation time
          const covering = shifts.find((s: any) => {
            const shiftStart = new Date(s.startTime || s.start_time)
            const shiftEnd = new Date(s.endTime || s.end_time)
            return shiftStart <= start && shiftEnd >= end
          })
          if (covering) {
            const name = covering.trainerName || covering.trainer?.full_name
            const id = covering.trainerId || covering.trainer_id || covering.trainer?.id
            if (name && id) {
              setDetectedTrainer({ id, name })
            } else {
              setDetectedTrainer(null)
            }
          } else {
            setDetectedTrainer(null)
          }
        } else {
          setDetectedTrainer(null)
        }
      } catch {
        setDetectedTrainer(null)
      }
    }
    detectTrainer()
  }, [formData.startTime, formData.duration, formData.calendarId, formData.isBlocked, trainerToken])

  // Prefill startTime from query param if provided (e.g., from Timeline click)
  useEffect(() => {
    const qsStartTime = searchParams?.get('startTime')
    const qsTrainerId = searchParams?.get('trainerId') // Get trainerId from query params

    if (qsStartTime) {
      // Extract date and time from startTime (YYYY-MM-DDTHH:mm format)
      const [date, time] = qsStartTime.split('T') // Split to get YYYY-MM-DD and HH:mm

      // Calculate end time as 1 hour after start time
      let blockedEndTime = '12:00' // default
      if (time) {
        const [hours, minutes] = time.split(':').map(Number)
        const endHours = (hours + 1) % 24 // Add 1 hour, wrap at 24
        blockedEndTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      }

      // Calculate end time as 1 hour after start time for training too
      let trainingEndTime = '16:00'
      if (time) {
        const [hours, minutes] = time.split(':').map(Number)
        const endHours = (hours + 1) % 24
        trainingEndTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      }

      setFormData(prev => ({
        ...prev,
        startTime: qsStartTime,
        blockedDate: date, // Set blockedDate for when switching to blocked type
        blockedStartTime: time || prev.blockedStartTime, // Set blockedStartTime from clicked time
        blockedEndTime: blockedEndTime, // Set blockedEndTime as 1 hour after start
        trainerId: qsTrainerId || prev.trainerId, // Set trainerId from query param
        trainingDate: date, // Set trainingDate from clicked date
        trainingStartTime: time || prev.trainingStartTime, // Set trainingStartTime from clicked time
        trainingEndTime: trainingEndTime, // Default 1 hour after start
      }))
    } else if (qsTrainerId) {
      // If only trainerId is provided
      setFormData(prev => ({
        ...prev,
        trainerId: qsTrainerId
      }))
    }
  }, [searchParams])

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return

    // Allow if session is admin OR valid trainer token exists
    const isSessionAdmin = status === 'authenticated' && session?.user?.role === 'ADMIN'
    const isTrainerAuth = !!trainerToken

    if (!isSessionAdmin && !isTrainerAuth) {
      router.push('/login')
    } else if (status === 'authenticated' && !isSessionAdmin && !isTrainerAuth) {
      // Logged in but not admin and no token
      router.push('/reservations')
    }
  }, [status, session, router, trainerToken])

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

  const processSuccess = () => {
    setSuccess(formData.isTrial ? '体験予約が正常に作成されました' : formData.isTraining ? '研修予約が正常に作成されました' : '予約が正常に作成されました')

    // Reset form
    setFormData({
      clientId: '',
      startTime: getDefaultDateTime(),
      duration: 60,
      calendarId: 'tandjgym@gmail.com',
      notes: '',
      isBlocked: false,
      isTrial: false,
      isGuest: false,
      isTraining: false,
      trialClientName: '',
      guestName: '',
      blockedDate: '',
      blockedStartTime: '09:00',
      blockedEndTime: '12:00',
      trainerId: '',
      trainingTrainerIds: [],
      trainingDate: '',
      trainingStartTime: '15:00',
      trainingEndTime: '16:00',
    })

    // Redirect to calendar after 1.5 seconds
    setTimeout(() => {
      const url = trainerToken
        ? `/admin/calendar?trainerToken=${trainerToken}`
        : '/admin/calendar'
      router.push(url)
    }, 1500)
  }

  const handleConfirmShift = async () => {
    if (!pendingRequest) return
    setShowShiftConfirmModal(false)
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { url, requestData } = pendingRequest
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestData, skipShiftCheck: true }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '予約の作成に失敗しました')
      }
      processSuccess()
    } catch (error) {
      console.error('Create reservation retry error:', error)
      setError(error instanceof Error ? error.message : '予約の作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const cancelShiftConfirm = () => {
    setShowShiftConfirmModal(false)
    setPendingRequest(null)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate required fields
      if (!formData.startTime.trim()) {
        throw new Error('開始時間は必須です')
      }

      // For blocked time, we don't need a client
      let selectedClient = null
      if (!formData.isBlocked && !formData.isTrial && !formData.isGuest && !formData.isTraining) {
        if (!formData.clientId.trim()) {
          throw new Error('会員を選択してください')
        }
        selectedClient = clients.find(client => client.id === formData.clientId)
        if (!selectedClient) {
          throw new Error('有効な会員を選択してください')
        }
      }

      // For trial, validate trial client name
      if (formData.isTrial && !formData.trialClientName.trim()) {
        throw new Error('体験者名を入力してください')
      }

      // For guest, validate guest name
      if (formData.isGuest && !formData.guestName.trim()) {
        throw new Error('ゲスト名を入力してください')
      }

      // Convert local datetime to JST ISO string
      // datetime-local gives us "2025-10-18T14:00" without timezone
      // We need to treat this as JST and convert to UTC for storage
      const startDateTime = new Date(formData.startTime + ':00+09:00') // Add JST timezone
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

        // Combine date and time with JST timezone
        const startDateTimeStr = `${formData.blockedDate}T${formData.blockedStartTime}:00+09:00`
        const endDateTimeStr = `${formData.blockedDate}T${formData.blockedEndTime}:00+09:00`

        // Calculate duration in minutes
        const start = new Date(startDateTimeStr)
        const end = new Date(endDateTimeStr)
        const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60))

        requestData = {
          clientId: 'BLOCKED',
          startTime: start.toISOString(),
          duration: duration,
          calendarId: formData.calendarId,
          notes: formData.notes,
          title: formData.notes || '予約不可',
          ...(formData.trainerId ? { trainerId: formData.trainerId } : {}),
        }
      } else if (formData.isTrial) {
        // For trial reservation - use special clientId and include name in notes
        const trialNotes = `[体験] ${formData.trialClientName}${formData.notes ? ` - ${formData.notes}` : ''}`

        requestData = {
          clientId: 'TRIAL',
          startTime: startDateTime.toISOString(),
          duration: formData.duration,
          calendarId: formData.calendarId,
          notes: trialNotes,
          title: `体験 - ${formData.trialClientName}`,
          ...(formData.trainerId ? { trainerId: formData.trainerId } : {}),
        }
      } else if (formData.isGuest) {
        // For guest reservation - use special clientId and include name in notes
        const guestNotes = `[ゲスト] ${formData.guestName}${formData.notes ? ` - ${formData.notes}` : ''}`

        requestData = {
          clientId: 'GUEST',
          startTime: startDateTime.toISOString(),
          duration: formData.duration,
          calendarId: formData.calendarId,
          notes: guestNotes,
          title: `ゲスト - ${formData.guestName}`,
          ...(formData.trainerId ? { trainerId: formData.trainerId } : {}),
        }
      } else if (formData.isTraining) {
        // For training reservation
        if (formData.trainingTrainerIds.length === 0) {
          throw new Error('参加トレーナーを選択してください')
        }
        if (!formData.trainingDate || !formData.trainingStartTime || !formData.trainingEndTime) {
          throw new Error('研修の日付・開始時刻・終了時刻を設定してください')
        }
        if (formData.trainingEndTime <= formData.trainingStartTime) {
          throw new Error('終了時刻は開始時刻より後に設定してください')
        }
        const trainingStart = new Date(`${formData.trainingDate}T${formData.trainingStartTime}:00+09:00`)
        const trainingEnd = new Date(`${formData.trainingDate}T${formData.trainingEndTime}:00+09:00`)
        const trainingDuration = Math.round((trainingEnd.getTime() - trainingStart.getTime()) / (1000 * 60))
        requestData = {
          clientId: 'TRAINING',
          startTime: trainingStart.toISOString(),
          duration: trainingDuration,
          calendarId: formData.calendarId,
          notes: formData.notes || '',
          title: '研修',
          trainingTrainerIds: formData.trainingTrainerIds,
        }
      } else {
        // For regular client reservation
        requestData = {
          clientId: formData.clientId,
          startTime: startDateTime.toISOString(),
          duration: formData.duration,
          calendarId: formData.calendarId,
          notes: formData.notes,
          ...(formData.trainerId ? { trainerId: formData.trainerId } : {}),
        }
      }

      const url = trainerToken
        ? `/api/admin/reservations?token=${trainerToken}`
        : '/api/admin/reservations'

      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      let data = await response.json()

      if (!response.ok) {
        // If shift warning, show confirm dialog and retry with skipShiftCheck
        if (data.code === 'NO_SHIFT') {
          setPendingRequest({ url, requestData })
          setShowShiftConfirmModal(true)
          // Do not setLoading(false) here yet, the modal will handle it if cancelled
          return
        } else {
          throw new Error(data.error || '予約の作成に失敗しました')
        }
      }

      processSuccess()

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

  const isSessionAdmin = status === 'authenticated' && session?.user?.role === 'ADMIN'
  const isTrainerAuth = !!trainerToken

  if (!isSessionAdmin && !isTrainerAuth) {
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
                <p className="mt-2 text-gray-600">会員の予約を作成します</p>
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
            <p className="text-green-700 text-sm mt-1">カレンダーに移動します...</p>
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
              <div className="grid grid-cols-2 gap-4">
                <label className={`relative flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all ${!formData.isBlocked && !formData.isTrial && !formData.isGuest && !formData.isTraining
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="client"
                    checked={!formData.isBlocked && !formData.isTrial && !formData.isGuest && !formData.isTraining}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: false, isGuest: false, isTraining: false, clientId: '' }))}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 mb-2 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900">予約</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all ${formData.isTrial
                  ? 'border-green-500 bg-green-50 ring-2 ring-green-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="trial"
                    checked={formData.isTrial}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: true, isGuest: false, isTraining: false, clientId: '' }))}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 mb-2 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900">体験</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all ${formData.isGuest
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="guest"
                    checked={formData.isGuest}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: false, isGuest: true, isTraining: false, clientId: '' }))}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 mb-2 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900">ゲスト</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all ${formData.isBlocked
                  ? 'border-red-500 bg-red-50 ring-2 ring-red-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="blocked"
                    checked={formData.isBlocked}
                    onChange={() => {
                      // When switching to blocked, extract date and time from startTime
                      const [date, time] = formData.startTime ? formData.startTime.split('T') : ['', '']

                      // Calculate end time as 1 hour after start time
                      let blockedEndTime = formData.blockedEndTime
                      if (time) {
                        const [hours, minutes] = time.split(':').map(Number)
                        const endHours = (hours + 1) % 24 // Add 1 hour, wrap at 24
                        blockedEndTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
                      }

                      setFormData(prev => ({
                        ...prev,
                        isBlocked: true,
                        isTrial: false,
                        isGuest: false,
                        clientId: '',
                        blockedDate: date || prev.blockedDate, // Use extracted date or keep existing
                        blockedStartTime: time || prev.blockedStartTime, // Use extracted time or keep existing
                        blockedEndTime: blockedEndTime, // Set as 1 hour after start
                      }))
                    }}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 mb-2 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900">予約不可</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all ${formData.isTraining
                  ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="training"
                    checked={formData.isTraining}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: false, isGuest: false, isTraining: true, clientId: '' }))}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 mb-2 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900">研修</span>
                </label>
              </div>
            </div>

            {/* Training Trainer Selection - Multi-select */}
            {formData.isTraining && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  参加トレーナー *
                </label>
                {loadingTrainers ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    トレーナー情報を読み込み中...
                  </div>
                ) : trainers.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-800">
                    ⚠️ アクティブなトレーナーが見つかりません
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trainers.map(trainer => (
                      <label key={trainer.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.trainingTrainerIds.includes(trainer.id)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <input
                          type="checkbox"
                          checked={formData.trainingTrainerIds.includes(trainer.id)}
                          onChange={async (e) => {
                            if (e.target.checked) {
                              // Check if this specific trainer has a shift or template covering the selected time
                              let hasShift = true
                              const trainingTimeAvailable = formData.trainingDate && formData.trainingStartTime && formData.trainingEndTime
                              if (trainingTimeAvailable) {
                                try {
                                  const start = new Date(`${formData.trainingDate}T${formData.trainingStartTime}:00+09:00`)
                                  const end = new Date(`${formData.trainingDate}T${formData.trainingEndTime}:00+09:00`)
                                  if (!isNaN(start.getTime())) {
                                    const shiftUrl = trainerToken
                                      ? `/api/shifts?trainerId=${trainer.id}&start=${start.toISOString()}&end=${end.toISOString()}&token=${trainerToken}`
                                      : `/api/shifts?trainerId=${trainer.id}&start=${start.toISOString()}&end=${end.toISOString()}`
                                    const res = await fetch(shiftUrl, { credentials: 'include' })
                                    if (res.ok) {
                                      const result = await res.json()
                                      const shifts = result.data?.shifts || result.shifts || []
                                      const templates = result.data?.templates || result.templates || []
                                      // Check actual shifts first
                                      const coveringShift = shifts.find((s: any) => {
                                        const shiftStart = new Date(s.startTime || s.start_time)
                                        const shiftEnd = new Date(s.endTime || s.end_time)
                                        return shiftStart <= start && shiftEnd >= end
                                      })
                                      // If no actual shift, check templates by day of week
                                      let coveringTemplate = false
                                      if (!coveringShift && templates.length > 0) {
                                        const dayOfWeek = start.getDay() // 0=Sun, 1=Mon, ...
                                        const startHHMM = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
                                        const endHHMM = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
                                        coveringTemplate = templates.some((t: any) => {
                                          const tDay = t.dayOfWeek ?? t.day_of_week
                                          const tStart = (t.startTime || t.start_time || '').substring(0, 5)
                                          const tEnd = (t.endTime || t.end_time || '').substring(0, 5)
                                          return tDay === dayOfWeek && tStart <= startHHMM && tEnd >= endHHMM
                                        })
                                      }
                                      hasShift = !!(coveringShift || coveringTemplate)
                                    }
                                  }
                                } catch { /* ignore shift check errors */ }
                              }
                              if (!hasShift) {
                                const ok = window.confirm(`${trainer.full_name}はこの時間帯にシフトがありません。\n研修に追加しますか？`)
                                if (!ok) return
                              }
                              setFormData(prev => ({ ...prev, trainingTrainerIds: [...prev.trainingTrainerIds, trainer.id] }))
                            } else {
                              setFormData(prev => ({ ...prev, trainingTrainerIds: prev.trainingTrainerIds.filter(id => id !== trainer.id) }))
                            }
                          }}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-gray-900">{trainer.full_name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  研修に参加するトレーナーを選択してください（複数選択可）
                </p>
              </div>
            )}

            {/* Client Selection - Only show when not blocked */}
            {!formData.isBlocked && !formData.isTrial && !formData.isGuest && !formData.isTraining && (
              <div>
                <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
                  会員選択 *
                </label>
                {loadingClients ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    会員情報を読み込み中...
                  </div>
                ) : clients.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-800">
                    ⚠️ 登録されている会員が見つかりません
                  </div>
                ) : (
                  <>
                    <select
                      id="clientId"
                      name="clientId"
                      value={formData.clientId}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">会員を選択してください</option>
                      {clients && clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.plan || 'プランなし'})
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  予約を作成する会員を選択してください
                </p>
              </div>
            )}

            {/* Trial Client Name - Manual text input for trial */}
            {formData.isTrial && (
              <div>
                <label htmlFor="trialClientName" className="block text-sm font-medium text-gray-700 mb-2">
                  体験者名 *
                </label>
                <input
                  type="text"
                  id="trialClientName"
                  name="trialClientName"
                  value={formData.trialClientName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="体験者の名前を入力してください"
                />
                <p className="mt-1 text-sm text-gray-500">
                  体験予約を作成する方の名前を入力してください
                </p>
              </div>
            )}

            {/* Guest Name - Manual text input for guest */}
            {formData.isGuest && (
              <div>
                <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-2">
                  ゲスト名 *
                </label>
                <input
                  type="text"
                  id="guestName"
                  name="guestName"
                  value={formData.guestName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ゲストの名前を入力してください"
                />
                <p className="mt-1 text-sm text-gray-500">
                  ゲスト予約を作成する方の名前を入力してください
                </p>
              </div>
            )}


            {/* On-duty Trainer Display */}
            {!formData.isBlocked && !formData.isTraining && detectedTrainer && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  担当トレーナー
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-blue-50 text-blue-800 font-medium">
                  {detectedTrainer.name}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  シフトから自動判定されます
                </p>
              </div>
            )}

            {/* Date and Time Selection */}
            {formData.isTraining ? (
              // Training: separate date, start time, end time
              <div className="space-y-4">
                <div>
                  <label htmlFor="trainingDate" className="block text-sm font-medium text-gray-700 mb-2">
                    日付 *
                  </label>
                  <input
                    type="date"
                    id="trainingDate"
                    value={formData.trainingDate}
                    onChange={(e) => setFormData({ ...formData, trainingDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="trainingStartTime" className="block text-sm font-medium text-gray-700 mb-2">
                      開始時刻 *
                    </label>
                    <input
                      type="time"
                      id="trainingStartTime"
                      value={formData.trainingStartTime}
                      onChange={(e) => setFormData({ ...formData, trainingStartTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="trainingEndTime" className="block text-sm font-medium text-gray-700 mb-2">
                      終了時刻 *
                    </label>
                    <input
                      type="time"
                      id="trainingEndTime"
                      value={formData.trainingEndTime}
                      onChange={(e) => setFormData({ ...formData, trainingEndTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : formData.isBlocked ? (
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

            {/* Session Duration - Only show for regular reservations (client/trial/guest) */}
            {!formData.isBlocked && !formData.isTraining && (
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
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '作成中...' : '予約作成'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Custom Confirm Modal for Mobile PWA Support */}
      {showShiftConfirmModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative p-6 w-full max-w-sm shadow-2xl rounded-2xl bg-white scale-100 transition-transform">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-yellow-100 mb-4">
                <svg className="h-7 w-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                シフト外の予約
              </h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                この時間帯に出勤しているトレーナーがいません（シフト外）。<br /><br />それでも予約を作成しますか？
              </p>
              <div className="flex justify-center space-x-3 w-full">
                <button
                  type="button"
                  onClick={cancelShiftConfirm}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmShift}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                  OK (作成)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewReservationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <NewReservationContent />
    </Suspense>
  )
}
