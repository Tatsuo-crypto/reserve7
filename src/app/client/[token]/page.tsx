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
  const [visibleTabs, setVisibleTabs] = useState({ input: true, analyze: true, progress: true })
  const isDietPlan = visibleTabs.input || visibleTabs.analyze || visibleTabs.progress
  
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
              setActiveTab('res')
            }
          }
        }
      } catch (e) { console.error(e) }
    }
    if (token) {
      fetchUser()
      fetchSettings()
    }
  }, [token])

  if (loading || !userId) {
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
    weekly: '週間',
    analyze: '分析',
    plan: '契約プラン',
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
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
        {activeTab === 'home' && (
          <HomeTab
            token={token}
            userName={userName}
            todayDraft={todayData}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}
        {activeTab === 'res' && (
          <ReservationTab token={token} />
        )}
        {activeTab === 'record' && (
          <InputTab
            userId={userId!}
            token={token}
            isAdmin={isAdmin}
            sharedState={todayData}
            onStateChange={setTodayData}
          />
        )}
        {activeTab === 'weekly' && (
          <WeeklyTab userId={userId!} token={token} isAdmin={isAdmin} />
        )}
        {activeTab === 'analyze' && (
          <AnalyzeTab
            userId={userId!}
            token={token}
            isAdmin={isAdmin}
            todayDraft={todayData}
          />
        )}
        {activeTab === 'plan' && (
          <PlanTab token={token} />
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
        <div className={`grid ${isDietPlan ? 'grid-cols-5' : 'grid-cols-3'} items-center max-w-lg mx-auto h-20`}>
          <NavBtn
            active={activeTab === 'res'}
            onClick={() => setActiveTab('res')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
            label="予約"
          />

          {isDietPlan && (
            <NavBtn
              active={activeTab === 'weekly' || activeTab === 'record'}
              onClick={() => setActiveTab('weekly')}
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
              label="週間"
            />
          )}

          {/* Central Home Button */}
          <div className="relative flex flex-col items-center justify-center h-full">
            <button
              onClick={() => setActiveTab('home')}
              className={`absolute top-[-6px] w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform ${
                activeTab === 'home'
                ? 'bg-brand-600 scale-105 shadow-brand-200'
                : 'bg-brand-500 hover:bg-brand-600 shadow-brand-100'
              }`}
            >
              <svg className="w-7 h-7 text-white stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <span className={`absolute bottom-2 text-[10px] font-normal transition-colors duration-300 ${activeTab === 'home' ? 'text-brand-600' : 'text-text-muted'}`}>ホーム</span>
          </div>

          {isDietPlan && (
            <NavBtn
              active={activeTab === 'analyze'}
              onClick={() => setActiveTab('analyze')}
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
              label="分析"
            />
          )}

          <NavBtn
            active={activeTab === 'plan'}
            onClick={() => setActiveTab('plan')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />}
            label="プラン"
          />
        </div>
      </nav>

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
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-between w-full h-16 py-1 transition-all duration-300 ${active ? 'text-brand-600' : 'text-text-muted'}`}
    >
      <div className="flex flex-col items-center justify-center flex-1">
        <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-brand-50 scale-105' : 'bg-transparent'}`}>
          <svg className={`w-6 h-6 stroke-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon}
          </svg>
        </div>
        <span className="text-[10px] font-normal tracking-tighter mt-0.5">{label}</span>
      </div>
      {/* Reserve space for the dot to prevent layout shift */}
      <div className={`w-1 h-1 rounded-full transition-all duration-300 ${active ? 'bg-brand-600 opacity-100' : 'bg-transparent opacity-0'}`}></div>
    </button>
  )
}
