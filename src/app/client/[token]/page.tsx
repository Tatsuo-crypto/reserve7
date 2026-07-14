'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import HomeTab from '@/components/diet/HomeTab'
import InputTab from '@/components/diet/InputTab'
import WeeklyTab from '@/components/diet/WeeklyTab'
import AnalyzeTab from '@/components/diet/AnalyzeTab'
import PlanTab from '@/components/diet/PlanTab'
import ReservationTab from '@/components/diet/ReservationTab'
import AdminHeader from '@/app/components/AdminHeader'
import PushNotificationPrompt from './PushNotificationPrompt'
import Icon, { type IconName } from '@/components/ui/icons'

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
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/auth/token?token=${token}`)
        if (res.ok) {
          const data = await res.json()
          setUserId(data.user.id)
          setUserName(data.user.name)
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      } finally {
        setLoading(false)
      }
    }
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/lifestyle/settings?token=${token}`)
        if (res.ok) {
          const { data } = await res.json()
          if (data && data.visible_tabs) {
            setVisibleTabs(data.visible_tabs)
            const isDiet = data.visible_tabs.input || data.visible_tabs.analyze || data.visible_tabs.progress
            if (!isDiet) {
              setActiveTab('home')
            }
          }
        }
      } catch (e) { console.error(e) }
      finally {
        setSettingsLoaded(true)
      }
    }
    if (token) {
      setSettingsLoaded(false)
      fetchUser()
      fetchSettings()
    }
  }, [token])

  useEffect(() => {
    if (!isDietPlan && activeTab !== 'home' && activeTab !== 'settings') {
      setActiveTab('home')
    }
  }, [isDietPlan, activeTab])

  if (loading || !settingsLoaded || !userId) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          {loading ? (
            <p className="mt-4 text-text-secondary">読み込み中...</p>
          ) : (
            <p className="mt-4 text-red-600">ユーザー情報の取得に失敗しました。再読み込みしてください。</p>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('settings')}
              aria-label="設定"
              className={`h-10 w-10 flex items-center justify-center rounded-full shadow-sm border border-border-subtle transition-all active:scale-95 ${activeTab === 'settings' ? 'bg-brand-500/15 text-brand-300' : 'bg-surface-raised text-text-secondary'}`}
            >
              <Icon name="settings" size={20} />
            </button>
            <div className="h-10 px-4 flex items-center gap-2 bg-surface-raised rounded-full shadow-sm border border-border-subtle transition-all active:scale-95">
              <span className="text-text-secondary text-[13px] font-normal truncate max-w-[100px]">
                {formatName(userName)}
              </span>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-normal bg-surface-overlay text-text-primary whitespace-nowrap">
                会員
              </div>
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
      <button
        onClick={onClick}
        aria-label="ホーム"
        className={`absolute top-[-8px] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm transition-all duration-200 active:scale-95 ${active ? 'bg-brand-600 scale-105' : 'bg-brand-500'}`}
      >
        <Icon name="home" size={28} />
      </button>
      <span className={`absolute bottom-2 text-[10px] font-normal transition-colors duration-300 ${active ? 'text-brand-300' : 'text-text-muted'}`}>ホーム</span>
    </div>
  )
}

function SettingsTab({ token }: { token: string }) {
  return (
    <div className="space-y-4 animate-fadeIn">
      <PushNotificationPrompt token={token} />

      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Icon name="informationCircle" size={20} />
          </div>
          <div>
            <div className="text-sm text-text-primary">通知の受け取り</div>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              予約のお知らせやオンラインレッスン開始前の通知を、この端末で受け取れます。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavBtn({ active, onClick, iconName, label }: { active: boolean, onClick: () => void, iconName: IconName, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-between w-full h-16 py-1 transition-all duration-300 ${active ? 'text-brand-600' : 'text-text-muted'}`}
    >
      <div className="flex flex-col items-center justify-center flex-1">
        <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-brand-500/20 scale-105' : 'bg-transparent'}`}>
          <Icon name={iconName} size={24} />
        </div>
        <span className="text-[10px] font-normal tracking-tighter mt-0.5">{label}</span>
      </div>
      {/* Reserve space for the dot to prevent layout shift */}
      <div className={`w-1 h-1 rounded-full transition-all duration-300 ${active ? 'bg-brand-600 opacity-100' : 'bg-transparent opacity-0'}`}></div>
    </button>
  )
}
