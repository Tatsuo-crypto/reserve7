'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import InputTab from '@/components/diet/InputTab'
import AnalyzeTab from '@/components/diet/AnalyzeTab'
import ProgressTab from '@/components/diet/ProgressTab'
import ReservationTab from '@/components/diet/ReservationTab'
import OnlineTab from '@/components/diet/OnlineTab'

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

type TabType = 'res' | 'online' | 'input' | 'analyze' | 'progress'

export default function ClientReservationsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params?.token as string
  const fromAdmin = searchParams?.get('from') === 'admin'

  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = sessionStatus === 'authenticated' && session?.user?.role === 'ADMIN'

  const [activeTab, setActiveTab] = useState<TabType>('input')
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [visibleTabs, setVisibleTabs] = useState({ input: false, analyze: false, progress: false })

  useEffect(() => {
    console.log('[Client Page] Mounted, token:', token)
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
            
            // If current tab is input but it's hidden, switch to res
            if (!data.visible_tabs.input && activeTab === 'input') {
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            {fromAdmin && isAdmin && (
              <a
                href="/admin/members"
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                title="会員管理に戻る"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </a>
            )}
            <h1 className="text-lg font-black text-gray-900">
              {activeTab === 'res' && '予約確認'}
              {activeTab === 'online' && 'オンライン'}
              {activeTab === 'input' && '記録入力'}
              {activeTab === 'analyze' && 'データ分析'}
              {activeTab === 'progress' && '今週の進捗'}
            </h1>
          </div>
          <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{userName} 様</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 overflow-x-hidden pb-24">
        {activeTab === 'res' && <ReservationTab token={token} />}
        {activeTab === 'online' && <OnlineTab token={token} />}
        {activeTab === 'input' && <InputTab userId={userId!} token={token} isAdmin={isAdmin} />}
        {activeTab === 'analyze' && <AnalyzeTab userId={userId!} token={token} isAdmin={isAdmin} />}
        {activeTab === 'progress' && <ProgressTab userId={userId!} token={token} />}

        {/* 管理者用編集ボタン (記録入力タブのみ表示) */}
        {fromAdmin && isAdmin && userId && activeTab === 'input' && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowTrackingModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              管理者としてデータを編集
            </button>
          </div>
        )}
      </main>

      {/* TrackingModal */}
      {fromAdmin && isAdmin && userId && showTrackingModal && (
        <TrackingModal
          isOpen={showTrackingModal}
          onClose={() => {
            setShowTrackingModal(false)
            // リロードなしで最新データを反映するために画面全体を再読み込みするか、
            // または各情報の再取得が必要ですが、ここではシンプルに閉じます
          }}
          memberId={userId}
          memberName={userName}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_15px_rgba(0,0,0,0.08)] z-40">
        <div className="flex justify-around items-center max-w-lg mx-auto h-16">
          <NavBtn
            active={activeTab === 'res'}
            onClick={() => setActiveTab('res')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
            label="予約"
          />
          <NavBtn
            active={activeTab === 'online'}
            onClick={() => setActiveTab('online')}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />}
            label="オンライン"
          />
          {visibleTabs.input && (
            <NavBtn
              active={activeTab === 'input'}
              onClick={() => setActiveTab('input')}
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />}
              label="入力"
            />
          )}
          {visibleTabs.analyze && (
            <NavBtn
              active={activeTab === 'analyze'}
              onClick={() => setActiveTab('analyze')}
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
              label="分析"
            />
          )}
          {visibleTabs.progress && (
            <NavBtn
              active={activeTab === 'progress'}
              onClick={() => setActiveTab('progress')}
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />}
              label="進捗"
            />
          )}
        </div>
      </nav>
    </div>
  )
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${active ? 'text-blue-600 scale-105' : 'text-gray-400'
        }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon}
      </svg>
      <span className={`text-[9px] font-black ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
  )
}
