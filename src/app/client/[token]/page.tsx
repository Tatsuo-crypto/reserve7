'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import HomeTab from '@/components/diet/HomeTab'
import AdminHeader from '@/app/components/AdminHeader'
import PushNotificationPrompt from './PushNotificationPrompt'
import Icon, { type IconName } from '@/components/ui/icons'
import { fetchJsonCached } from '@/lib/client-fetch-cache'
import Button from '@/components/ui/Button'

const TabLoading = () => (
  <div className="h-56 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
  </div>
)

const InputTab = dynamic(() => import('@/components/diet/InputTab'), {
  ssr: false,
  loading: TabLoading,
})

const WeeklyTab = dynamic(() => import('@/components/diet/WeeklyTab'), {
  ssr: false,
  loading: TabLoading,
})

const AnalyzeTab = dynamic(() => import('@/components/diet/AnalyzeTab'), {
  ssr: false,
  loading: TabLoading,
})

const PlanTab = dynamic(() => import('@/components/diet/PlanTab'), {
  ssr: false,
  loading: TabLoading,
})

const ReservationTab = dynamic(() => import('@/components/diet/ReservationTab'), {
  ssr: false,
  loading: TabLoading,
})

// TrackingModalをアドミン専用に遅延読み込み
const TrackingModal = dynamic(() => import('@/app/admin/members/TrackingModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
        <p className="mt-2 text-sm text-text-secondary">読み込み中...</p>
      </div>
    </div>
  )
})

type TabType = 'home' | 'res' | 'record' | 'weekly' | 'analyze' | 'plan' | 'settings'

type ClientBootstrap = {
  goals: any[]
  todayDietLog: any | null
  nextReservation: any | null
  todayLesson: any | null
}

export default function ClientReservationsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = params?.token as string
  const fromAdmin = searchParams?.get('from') === 'admin'

  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = sessionStatus === 'authenticated' && session?.user?.role === 'ADMIN'

  const [activeTab, setActiveTab] = useState<TabType>('home')
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [visibleTabs, setVisibleTabs] = useState({ input: false, analyze: false, progress: false })
  const [homeBootstrap, setHomeBootstrap] = useState<ClientBootstrap | null>(null)
  const isDietFeatureEnabled = visibleTabs.input || visibleTabs.analyze || visibleTabs.progress
  const isDietPlan = isDietFeatureEnabled
  
  // State for real-time data synchronization between tabs
  const [todayData, setTodayData] = useState<any>({
    weight: '',
    water: '0',
    steps: '0',
    sleep: '0',
    alcohol: '0',
    notes: '',
    habits: { workout: 0 },
    ocrResult: null,
    dayType: null,
    dietImageUrl: null,
    quitGoals: [],
    isSaved: false,
    touchedFields: [],
    selectedDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    const fetchBootstrap = async () => {
      setLoading(true)
      setSettingsLoaded(false)
      try {
        const data = await fetchJsonCached<any>(`/api/client/bootstrap?token=${token}`, undefined, 30_000)
        if (data?.user) {
          setUserId(data.user.id)
          setUserName(data.user.name)
          setHomeBootstrap({
            goals: data.goals || [],
            todayDietLog: data.todayDietLog || null,
            nextReservation: data.nextReservation || null,
            todayLesson: data.todayLesson || null,
          })
          if (data.settings?.visible_tabs) {
            setVisibleTabs(data.settings.visible_tabs)
            const isDiet = data.settings.visible_tabs.input || data.settings.visible_tabs.analyze || data.settings.visible_tabs.progress
            if (!isDiet) {
              setActiveTab('home')
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch bootstrap:', error)
      } finally {
        setLoading(false)
        setSettingsLoaded(true)
      }
    }
    if (token) {
      fetchBootstrap()
    }
  }, [token])

  useEffect(() => {
    if (!isDietPlan && activeTab !== 'home' && activeTab !== 'settings') {
      setActiveTab('home')
    }
  }, [isDietPlan, activeTab])

  useEffect(() => {
    if (!token || !userId || !isDietPlan) return

    const prefetch = () => {
      const now = new Date()
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(now.setDate(diff))
      monday.setHours(0, 0, 0, 0)
      const prevMonday = new Date(monday)
      prevMonday.setDate(monday.getDate() - 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      const params = `token=${encodeURIComponent(token)}`
      const logParams = new URLSearchParams(params)
      logParams.set('startDate', prevMonday.toLocaleDateString('sv-SE'))
      logParams.set('endDate', sunday.toLocaleDateString('sv-SE'))

      void Promise.allSettled([
        import('@/components/diet/InputTab'),
        import('@/components/diet/WeeklyTab'),
        import('@/components/diet/AnalyzeTab'),
        import('@/components/diet/PlanTab'),
        import('@/components/diet/ReservationTab'),
        fetchJsonCached<any>(`/api/diet/logs?${logParams.toString()}`),
        fetchJsonCached<any>(`/api/lifestyle/logs?${logParams.toString()}`),
        fetchJsonCached<any>(`/api/diet/goals?${params}`),
        fetchJsonCached<any>(`/api/lifestyle/settings?${params}`),
        fetchJsonCached<any>(`/api/client/reservations?token=${token}`, undefined, 30_000),
      ])
    }

    const requestIdle = (window as any).requestIdleCallback as undefined | ((cb: () => void) => number)
    const cancelIdle = (window as any).cancelIdleCallback as undefined | ((id: number) => void)
    if (requestIdle) {
      const idleId = requestIdle(prefetch)
      return () => cancelIdle?.(idleId)
    }

    const timeoutId = window.setTimeout(prefetch, 300)
    return () => window.clearTimeout(timeoutId)
  }, [token, userId, isDietPlan])

  if (loading || !settingsLoaded || !userId) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          {loading ? (
            <p className="mt-4 text-text-secondary">読み込み中...</p>
          ) : (
            <p className="mt-4 text-red-600">ユーザー情報を取得できませんでした。画面を再読み込みしてください。</p>
          )}
        </div>
      </div>
    )
  }

  // Define tab titles
  const tabTitles: Record<TabType, string> = {
    home: 'マイページ',
    res: '予約確認',
    record: '記録',
    weekly: '習慣',
    analyze: '分析',
    plan: '推移',
    settings: '設定'
  };

  const formatName = (fullName: string | null | undefined) => {
    if (!fullName) return ''
    const lastName = fullName.split(/[\s　]+/)[0]
    return `${lastName}様`
  }

  return (
    <div className="min-h-screen bg-surface-base pb-20">
      {/* Universal AirPAY Header */}
      <AdminHeader 
        title={tabTitles[activeTab]} 
        showBack={fromAdmin && isAdmin}
        onBack={() => router.push('/admin/members')}
        rightElement={
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('settings')}
              aria-label="設定"
              className={`h-10 w-10 shrink-0 p-0 rounded-full shadow-sm border border-border-subtle transition-all active:scale-95 ${activeTab === 'settings' ? 'bg-brand-500/15 text-brand-300' : 'bg-surface-raised text-text-secondary'}`}
            >
              <Icon name="settings" size={20} />
            </Button>
            <div className="flex h-10 min-w-0 max-w-[72px] items-center rounded-full border border-border-subtle bg-surface-raised px-2.5 shadow-sm transition-all active:scale-95 sm:max-w-[108px] sm:px-3">
              <span className="min-w-0 truncate whitespace-nowrap text-sm font-normal text-text-secondary">
                {formatName(userName)}
              </span>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 overflow-x-hidden pb-24">
        {(activeTab === 'home' || (!isDietPlan && activeTab !== 'settings')) && (
          <HomeTab
            token={token}
            userName={userName}
            isDietPlan={isDietPlan}
            todayDraft={todayData}
            bootstrapData={homeBootstrap}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}
        {activeTab === 'res' && isDietPlan && (
          <ReservationTab token={token} userName={userName} />
        )}
        {activeTab === 'record' && isDietPlan && (
          <InputTab
            userId={userId!}
            token={token}
            isAdmin={isAdmin}
            sharedState={todayData}
            onStateChange={setTodayData}
          />
        )}
        {activeTab === 'weekly' && isDietPlan && (
          <WeeklyTab userId={userId!} token={token} isAdmin={isAdmin} />
        )}
        {activeTab === 'analyze' && isDietPlan && (
          <AnalyzeTab
            userId={userId!}
            token={token}
            isAdmin={isAdmin}
            todayDraft={todayData}
            showWeeklyGoals={false}
          />
        )}
        {activeTab === 'plan' && isDietPlan && (
          <PlanTab
            token={token}
            onEditPlan={
              fromAdmin && isAdmin && userId
                ? () => router.push(`/admin/diet-plan?userId=${userId}&tab=plan&name=${encodeURIComponent(userName || '')}`)
                : undefined
            }
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab token={token} />
        )}
      </main>

      {/* TrackingModal */}
      {fromAdmin && isAdmin && userId && showTrackingModal && (
        <TrackingModal
          isOpen={showTrackingModal}
          onClose={() => setShowTrackingModal(false)}
          memberId={userId}
          memberName={userName}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-raised/95 backdrop-blur-xl border-t border-border-subtle shadow-[0_-5px_25px_rgba(0,0,0,0.05)] z-40 pb-safe">
        <div className={`grid ${isDietPlan ? 'grid-cols-5' : 'grid-cols-1'} items-center max-w-lg mx-auto h-20`}>
          {isDietPlan && (
            <NavBtn
              active={activeTab === 'record'}
              onClick={() => setActiveTab('record')}
              iconName="camera"
              label="記録"
            />
          )}

          {isDietPlan && (
            <NavBtn
              active={activeTab === 'weekly'}
              onClick={() => setActiveTab('weekly')}
              iconName="clipboardList"
              label="習慣"
            />
          )}

          <CenterHomeBtn
            active={activeTab === 'home' || activeTab === 'res'}
            onClick={() => setActiveTab('home')}
          />

          {isDietPlan && (
            <NavBtn
              active={activeTab === 'analyze'}
              onClick={() => setActiveTab('analyze')}
              iconName="chartBar"
              label="分析"
            />
          )}

          {isDietPlan && (
            <NavBtn
              active={activeTab === 'plan'}
              onClick={() => setActiveTab('plan')}
              iconName="chartBar"
              label="推移"
            />
          )}
        </div>
      </nav>

    </div>
  )
}

function CenterHomeBtn({ active, onClick }: { active: boolean, onClick: () => void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={onClick}
        aria-label="ホーム"
        className={`absolute top-[-8px] h-14 w-14 p-0 rounded-full text-white shadow-sm transition-all duration-200 active:scale-95 ${active ? 'bg-brand-600 scale-105' : 'bg-brand-500'}`}
      >
        <Icon name="home" size={28} />
      </Button>
      <span className={`absolute bottom-2 text-xs font-normal transition-colors duration-300 ${active ? 'text-brand-300' : 'text-text-muted'}`}>ホーム</span>
    </div>
  )
}

function SettingsTab({ token }: { token: string }) {
  return (
    <div className="space-y-4 animate-fadeIn">
      <PushNotificationPrompt token={token} />
    </div>
  )
}

function NavBtn({ active, onClick, iconName, label }: { active: boolean, onClick: () => void, iconName: IconName, label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`[display:flex] flex-col items-center justify-between w-full h-16 px-0 py-1 bg-transparent hover:bg-transparent transition-all duration-300 ${active ? 'text-brand-600' : 'text-text-muted'}`}
    >
      <div className="flex flex-col items-center justify-center flex-1">
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${active ? 'bg-brand-500/20 scale-105' : 'bg-transparent'}`}>
          <Icon name={iconName} size={24} />
        </div>
        <span className="text-xs font-normal tracking-tighter mt-0.5">{label}</span>
      </div>
      {/* Reserve space for the dot to prevent layout shift */}
      <div className={`w-1 h-1 rounded-full transition-all duration-300 ${active ? 'bg-brand-600 opacity-100' : 'bg-transparent opacity-0'}`}></div>
    </Button>
  )
}
