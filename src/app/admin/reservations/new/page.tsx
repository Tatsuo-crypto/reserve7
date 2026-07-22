'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { getStoreDisplayName } from '@/lib/auth-utils'
import { getPlanRank } from '@/lib/utils/member'
import Icon from '@/components/ui/icons'
import Button from '@/components/ui/Button'

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
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null)

  const [showShiftConfirmModal, setShowShiftConfirmModal] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<{ url: string, requestData: any } | null>(null)

  // Training trainer shift confirm modal
  const [showTrainingShiftModal, setShowTrainingShiftModal] = useState(false)
  const [pendingTrainerId, setPendingTrainerId] = useState<string | null>(null)
  const [pendingTrainerName, setPendingTrainerName] = useState<string>('')

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
    setOptimisticMessage(null)
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
    // セッション認証のADMINはダッシュボードのカレンダー(正)へ、トークン認証のトレーナーは専用カレンダーへ戻す
    setTimeout(() => {
      const url = trainerToken
        ? `/admin/calendar?trainerToken=${trainerToken}`
        : '/dashboard?tab=home'
      router.push(url)
    }, 1500)
  }

  const handleConfirmShift = async () => {
    if (!pendingRequest) return
    setShowShiftConfirmModal(false)
    setLoading(true)
    setError(null)
    setSuccess(null)
    setOptimisticMessage('予約を保存しています')

    try {
      const { url, requestData } = pendingRequest
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestData, skipShiftCheck: true }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '予約を作成できませんでした。もう一度お試しください。')
      }
      processSuccess()
    } catch (error) {
      console.error('Create reservation retry error:', error)
      setOptimisticMessage(null)
      setError(error instanceof Error ? error.message : '予約を作成できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const cancelShiftConfirm = () => {
    setShowShiftConfirmModal(false)
    setPendingRequest(null)
    setLoading(false)
    setOptimisticMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    setOptimisticMessage(null)

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
      let requestData: any
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

      const optimisticTitle = formData.isTraining
        ? '研修'
        : formData.isBlocked
          ? (requestData.title || '予約不可')
          : formData.isTrial
            ? requestData.title
            : formData.isGuest
              ? requestData.title
              : selectedClient?.name || '予約'
      const optimisticStart = new Date(requestData.startTime)
      const optimisticTime = optimisticStart.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      setOptimisticMessage(`${optimisticTime} ${optimisticTitle} を保存しています`)

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
          setOptimisticMessage(null)
          setPendingRequest({ url, requestData })
          setShowShiftConfirmModal(true)
          // Do not setLoading(false) here yet, the modal will handle it if cancelled
          return
        } else {
          throw new Error(data.error || '予約を作成できませんでした。もう一度お試しください。')
        }
      }

      processSuccess()

    } catch (error) {
      console.error('Create reservation error:', error)
      setOptimisticMessage(null)
      setError(error instanceof Error ? error.message : '予約を作成できませんでした。もう一度お試しください。')
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
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
    <div className="min-h-screen bg-surface-base py-3">
      <div className="max-w-2xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-3 text-center">
          <h1 className="text-xl font-semibold text-text-primary">新規予約作成</h1>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-3 bg-state-success-500/15 border border-state-success-500/30 rounded-lg p-3">
            <div className="flex items-center">
              <Icon name="check" size={18} className="text-state-success-300 mr-2" />
              <p className="text-sm text-state-success-300">{success}</p>
            </div>
            <p className="text-state-success-300 text-xs mt-1">カレンダーに移動します...</p>
          </div>
        )}

        {optimisticMessage && (
          <div className="mb-3 bg-brand-500/15 border border-brand-500/30 rounded-lg p-3">
            <div className="flex items-center">
              <div className="mr-3 h-2.5 w-2.5 rounded-full bg-brand-500 animate-pulse" />
              <p className="text-sm text-brand-200">{optimisticMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-3 bg-red-500/15 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-surface-raised rounded-lg shadow p-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Reservation Type */}
            <div>
              <label className="block text-xs font-normal text-text-secondary mb-1.5">
                予約タイプ *
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                <label className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border py-2 cursor-pointer transition-all ${!formData.isBlocked && !formData.isTrial && !formData.isGuest && !formData.isTraining
                  ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                  : 'border-border-strong hover:bg-surface-base'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="client"
                    checked={!formData.isBlocked && !formData.isTrial && !formData.isGuest && !formData.isTraining}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: false, isGuest: false, isTraining: false, clientId: '' }))}
                    className="sr-only"
                  />
                  <Icon name="user" size={16} className="text-brand-300" />
                  <span className="text-xs font-normal leading-none text-text-primary">予約</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border py-2 cursor-pointer transition-all ${formData.isTrial
                  ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                  : 'border-border-strong hover:bg-surface-base'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="trial"
                    checked={formData.isTrial}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: true, isGuest: false, isTraining: false, clientId: '' }))}
                    className="sr-only"
                  />
                  <Icon name="star" size={16} className="text-blue-300" />
                  <span className="text-xs font-normal leading-none text-text-primary">体験</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border py-2 cursor-pointer transition-all ${formData.isGuest
                  ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500'
                  : 'border-border-strong hover:bg-surface-base'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="guest"
                    checked={formData.isGuest}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: false, isGuest: true, isTraining: false, clientId: '' }))}
                    className="sr-only"
                  />
                  <Icon name="userGroup" size={16} className="text-purple-300" />
                  <span className="text-xs font-normal leading-none text-text-primary">ゲスト</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border py-2 cursor-pointer transition-all ${formData.isBlocked
                  ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                  : 'border-border-strong hover:bg-surface-base'
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
                  <Icon name="noSymbol" size={16} className="text-text-secondary" />
                  <span className="text-xs font-normal leading-none text-text-primary">予約不可</span>
                </label>

                <label className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border py-2 cursor-pointer transition-all ${formData.isTraining
                  ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500'
                  : 'border-border-strong hover:bg-surface-base'
                  }`}>
                  <input
                    type="radio"
                    name="reservationType"
                    value="training"
                    checked={formData.isTraining}
                    onChange={() => setFormData(prev => ({ ...prev, isBlocked: false, isTrial: false, isGuest: false, isTraining: true, clientId: '' }))}
                    className="sr-only"
                  />
                  <Icon name="bookOpen" size={16} className="text-orange-300" />
                  <span className="text-xs font-normal leading-none text-text-primary">研修</span>
                </label>
              </div>
            </div>

            {/* Training Trainer Selection - Multi-select */}
            {formData.isTraining && (
              <div>
                <label className="block text-xs font-normal text-text-secondary mb-1">
                  参加トレーナー * (複数選択可)
                </label>
                {loadingTrainers ? (
                  <div className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-base text-text-secondary">
                    トレーナー情報を読み込み中...
                  </div>
                ) : trainers.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-yellow-500/30 rounded-lg bg-yellow-500/15 text-yellow-300">
                    ⚠️ アクティブなトレーナーが見つかりません
                  </div>
                ) : (
                  <div className="max-h-32 space-y-1.5 overflow-y-auto">
                    {trainers.map(trainer => (
                      <label key={trainer.id} className={`flex items-center p-2 border rounded-lg cursor-pointer transition-all ${formData.trainingTrainerIds.includes(trainer.id)
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-border-strong hover:border-border-strong'
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
                                // Show custom modal instead of window.confirm (fixes iOS PWA freeze)
                                setPendingTrainerId(trainer.id)
                                setPendingTrainerName(trainer.full_name)
                                setShowTrainingShiftModal(true)
                                return
                              }
                              setFormData(prev => ({ ...prev, trainingTrainerIds: [...prev.trainingTrainerIds, trainer.id] }))
                            } else {
                              setFormData(prev => ({ ...prev, trainingTrainerIds: prev.trainingTrainerIds.filter(id => id !== trainer.id) }))
                            }
                          }}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-border-strong rounded-lg"
                        />
                        <span className="ml-3 text-text-primary">{trainer.full_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Client Selection - Only show when not blocked */}
            {!formData.isBlocked && !formData.isTrial && !formData.isGuest && !formData.isTraining && (
              <div>
                <label htmlFor="clientId" className="block text-xs font-normal text-text-secondary mb-1">
                  会員選択 *
                </label>
                {loadingClients ? (
                  <div className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-base text-text-secondary">
                    会員情報を読み込み中...
                  </div>
                ) : clients.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-yellow-500/30 rounded-lg bg-yellow-500/15 text-yellow-300">
                    ⚠️ 登録されている会員が見つかりません
                  </div>
                ) : (
                  <select
                    id="clientId"
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">会員を選択してください</option>
                    {clients && clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.plan || 'プランなし'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Trial Client Name - Manual text input for trial */}
            {formData.isTrial && (
              <div>
                <label htmlFor="trialClientName" className="block text-xs font-normal text-text-secondary mb-1">
                  体験者名 *
                </label>
                <input
                  type="text"
                  id="trialClientName"
                  name="trialClientName"
                  value={formData.trialClientName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="体験者の名前を入力してください"
                />
              </div>
            )}

            {/* Guest Name - Manual text input for guest */}
            {formData.isGuest && (
              <div>
                <label htmlFor="guestName" className="block text-xs font-normal text-text-secondary mb-1">
                  ゲスト名 *
                </label>
                <input
                  type="text"
                  id="guestName"
                  name="guestName"
                  value={formData.guestName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="ゲストの名前を入力してください"
                />
              </div>
            )}

            {/* On-duty Trainer Display */}
            {!formData.isBlocked && !formData.isTraining && detectedTrainer && (
              <div className="flex items-center justify-between rounded-lg bg-brand-500/15 px-3 py-1.5 text-sm text-brand-300">
                <span className="text-xs text-text-secondary">担当トレーナー(シフトから自動判定)</span>
                <span className="font-normal">{detectedTrainer.name}</span>
              </div>
            )}

            {/* Date and Time Selection */}
            {formData.isTraining ? (
              // Training: separate date, start time, end time
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="trainingDate" className="block text-xs font-normal text-text-secondary mb-1">
                    日付 *
                  </label>
                  <input
                    type="date"
                    id="trainingDate"
                    value={formData.trainingDate}
                    onChange={(e) => setFormData({ ...formData, trainingDate: e.target.value })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="trainingStartTime" className="block text-xs font-normal text-text-secondary mb-1">
                    開始 *
                  </label>
                  <input
                    type="time"
                    id="trainingStartTime"
                    value={formData.trainingStartTime}
                    onChange={(e) => setFormData({ ...formData, trainingStartTime: e.target.value })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="trainingEndTime" className="block text-xs font-normal text-text-secondary mb-1">
                    終了 *
                  </label>
                  <input
                    type="time"
                    id="trainingEndTime"
                    value={formData.trainingEndTime}
                    onChange={(e) => setFormData({ ...formData, trainingEndTime: e.target.value })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            ) : formData.isBlocked ? (
              // Blocked time: separate date and time inputs
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="blockedDate" className="block text-xs font-normal text-text-secondary mb-1">
                    日付 *
                  </label>
                  <input
                    type="date"
                    id="blockedDate"
                    value={formData.blockedDate}
                    onChange={(e) => setFormData({ ...formData, blockedDate: e.target.value })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="blockedStartTime" className="block text-xs font-normal text-text-secondary mb-1">
                    開始 *
                  </label>
                  <input
                    type="time"
                    id="blockedStartTime"
                    value={formData.blockedStartTime}
                    onChange={(e) => setFormData({ ...formData, blockedStartTime: e.target.value })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="blockedEndTime" className="block text-xs font-normal text-text-secondary mb-1">
                    終了 *
                  </label>
                  <input
                    type="time"
                    id="blockedEndTime"
                    value={formData.blockedEndTime}
                    onChange={(e) => setFormData({ ...formData, blockedEndTime: e.target.value })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            ) : (
              // Regular reservation: datetime-local + duration side by side
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label htmlFor="startTime" className="block text-xs font-normal text-text-secondary mb-1">
                    開始日時 *
                  </label>
                  <input
                    type="datetime-local"
                    id="startTime"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="duration" className="block text-xs font-normal text-text-secondary mb-1">
                    時間 *
                  </label>
                  <select
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full px-2 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  >
                    <option value={30}>30分</option>
                    <option value={60}>60分</option>
                    <option value={90}>90分</option>
                    <option value={120}>120分</option>
                  </select>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-xs font-normal text-text-secondary mb-1">
                {formData.isBlocked ? '理由（任意）' : 'メモ（任意）'}
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={2}
                maxLength={1000}
                className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder={formData.isBlocked ? "予約不可の理由（例：定期メンテナンス、休業日）" : "特記事項があれば入力してください"}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-center gap-3 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
                className="flex-1 px-6 py-2.5 border border-border-strong rounded-lg text-text-secondary hover:bg-surface-base transition-colors"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-2.5 bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '保存中...' : '予約作成'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Custom Confirm Modal for Mobile PWA Support */}
      {showShiftConfirmModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative p-6 w-full max-w-sm shadow-xl rounded-2xl bg-surface-raised scale-100 transition-transform">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-yellow-500/15 mb-4">
                <Icon name="warning" size={28} className="text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                シフト外の予約
              </h3>
              <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                この時間帯に出勤しているトレーナーがいません（シフト外）。<br /><br />それでも予約を作成しますか？
              </p>
              <div className="flex justify-center space-x-3 w-full">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={cancelShiftConfirm}
                  className="flex-1 px-4 py-3 border border-border-strong text-text-secondary bg-surface-raised rounded-2xl hover:bg-surface-base transition-colors font-normal shadow-sm"
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  fullWidth
                  onClick={handleConfirmShift}
                  className="flex-1 px-4 py-3 bg-brand-700 text-white rounded-2xl hover:bg-brand-800 transition-colors font-normal shadow-sm"
                >
                  OK (作成)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal for Training Trainer Shift Warning */}
      {showTrainingShiftModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative p-6 w-full max-w-sm shadow-xl rounded-2xl bg-surface-raised">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-orange-500/15 mb-4">
                <Icon name="warning" size={28} className="text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                シフト外のトレーナー
              </h3>
              <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                <span className="font-normal">{pendingTrainerName}</span> はこの時間帯にシフトがありません。<br /><br />それでも研修に追加しますか？
              </p>
              <div className="flex justify-center space-x-3 w-full">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setShowTrainingShiftModal(false)
                    setPendingTrainerId(null)
                    setPendingTrainerName('')
                  }}
                  className="flex-1 px-4 py-3 border border-border-strong text-text-secondary bg-surface-raised rounded-2xl hover:bg-surface-base transition-colors font-normal shadow-sm"
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => {
                    if (pendingTrainerId) {
                      setFormData(prev => ({ ...prev, trainingTrainerIds: [...prev.trainingTrainerIds, pendingTrainerId] }))
                    }
                    setShowTrainingShiftModal(false)
                    setPendingTrainerId(null)
                    setPendingTrainerName('')
                  }}
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-colors font-normal shadow-sm"
                >
                  OK (追加)
                </Button>
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
        </div>
      </div>
    }>
      <NewReservationContent />
    </Suspense>
  )
}
