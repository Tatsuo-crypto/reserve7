'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import HomeTab from '@/components/diet/HomeTab'
import DietTab from '@/components/diet/DietTab'
import PlanTab from '@/components/diet/PlanTab'
import OnlineTab from '@/components/diet/OnlineTab'
import ReservationTab from '@/components/diet/ReservationTab'

// TrackingModalをアドミン専用に遅延読み込み
const TrackingModal = dynamic(() => import('@/app/admin/members/TrackingModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">読み込み中...</p>
      </div>
    </div>
  )
})

type TabType = 'home' | 'res' | 'diet' | 'plan' | 'online'

export default function ClientReservationsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
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
  
  // State for real-time data synchronization between tabs
  const [todayData, setTodayData] = useState<any>({
    weight: '',
    water: '2.0',
    steps: '10000',
    sleep: '8.0',
    alcohol: '0',
    notes: '',
    habits: { workout: 0 },
    ocrResult: null,
    dietImageUrl: null,
    quitGoals: [],
    isSaved: false,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          {loading ? (
            <p className="mt-4 text-gray-600">読み込み中...</p>
          ) : (
            <p className="mt-4 text-red-600">ユーザー情報の取得に失敗しました。再読み込みしてください。</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            {fromAdmin && isAdmin && (
              <a
                href="/admin/members"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
                title="会員管理に戻る"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </a>
            )}
            <h1 className="text-xl font-normal text-gray-800 tracking-tight">
              {activeTab === 'home' && 'ホーム'}
              {activeTab === 'res' && '予約'}
              {activeTab === 'diet' && '食事管理'}
              {activeTab === 'plan' && 'プラン'}
              {activeTab === 'online' && 'オンライン'}
            </h1>
          </div>
          <div className="text-[10px] font-normal text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{userName}</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 overflow-x-hidden pb-24">
        {activeTab === 'home' && (
          <HomeTab 
            token={token} 
            userName={userName} 
            todayDraft={todayData}
          />
        )}
        {activeTab === 'res' && (
          <ReservationTab token={token} />
        )}
        {activeTab === 'diet' && (
          <DietTab 
            userId={userId!} 
            token={token} 
            isAdmin={isAdmin} 
            sharedState={todayData} 
            onStateChange={setTodayData} 
          />
        )}
        {activeTab === 'plan' && (
          <PlanTab token={token} />
        )}
        {activeTab === 'online' && (
          <OnlineTab token={token} />
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-5px_25px_rgba(0,0,0,0.05)] z-40 pb-safe">
        <div className="grid grid-cols-5 items-center max-w-lg mx-auto h-20">
          <NavBtn
            active={activeTab === 'res'}
            onClick={() => setActiveTab('res')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
            label="予約"
          />
          <NavBtn
            active={activeTab === 'diet'}
            onClick={() => setActiveTab('diet')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
            label="食事"
          />
          
          {/* Central Home Button */}
          <div className="relative flex flex-col items-center justify-center h-full">
            <button
              onClick={() => setActiveTab('home')}
              className={`absolute top-[-6px] w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform ${
                activeTab === 'home' 
                ? 'bg-blue-600 scale-105 shadow-blue-200' 
                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-100'
              }`}
            >
              <svg className="w-7 h-7 text-white stroke-[2.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <span className={`absolute bottom-2 text-[10px] font-normal transition-colors duration-300 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'}`}>ホーム</span>
          </div>

          <NavBtn
            active={activeTab === 'plan'}
            onClick={() => setActiveTab('plan')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
            label="プラン"
          />
          <NavBtn
            active={activeTab === 'online'}
            onClick={() => setActiveTab('online')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />}
            label="オンライン"
          />
        </div>
      </nav>


    </div>
  )
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-between w-full h-16 py-1 transition-all duration-300 ${active ? 'text-blue-600' : 'text-gray-300'}`}
    >
      <div className="flex flex-col items-center justify-center flex-1">
        <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-blue-50 scale-105' : 'bg-transparent'}`}>
          <svg className={`w-6 h-6 ${active ? 'stroke-[2.5px]' : 'stroke-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon}
          </svg>
        </div>
        <span className="text-[10px] font-normal tracking-tighter mt-0.5">{label}</span>
      </div>
      {/* Reserve space for the dot to prevent layout shift */}
      <div className={`w-1 h-1 rounded-full transition-all duration-300 ${active ? 'bg-blue-600 opacity-100' : 'bg-transparent opacity-0'}`}></div>
    </button>
  )
}
