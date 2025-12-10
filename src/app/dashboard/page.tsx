'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (!session) {
      router.push('/login')
    }
  }, [session, status, router])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-space-black">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-nebula-blue/30 border-t-nebula-blue rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const isAdmin = session.user.role === 'ADMIN'
  const isTrainer = session.user.role === 'TRAINER'

  return (
    <div className="min-h-screen bg-space-black text-white pb-20">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              T&J GYM
            </Link>
            <span className="ml-4 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-gray-300 border border-white/10">
              {isAdmin ? '管理者' : isTrainer ? 'トレーナー' : '会員'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Role-specific content */}
        {isAdmin ? (
          <AdminDashboard />
        ) : isTrainer ? (
          <TrainerDashboard />
        ) : (
          <ClientDashboard />
        )}
      </main>
    </div>
  )
}

function DashboardCard({ href, title, description, icon }: { href: string, title: string, description: string, icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden glass-panel p-8 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:border-white/30"
    >
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-glow transition-all duration-300">{title}</h3>
          <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">{description}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 backdrop-blur-md group-hover:bg-white/10 transition-all duration-300 text-gray-300 group-hover:text-white">
          {icon}
        </div>
      </div>
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
    </Link>
  )
}

function TrainerDashboard() {
  return (
    <div className="space-y-8 animate-slideUp">
      <h2 className="text-3xl font-bold text-white">トレーナーダッシュボード</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardCard
          href="/admin/calendar"
          title="予約管理"
          description="スケジュールと予約状況を確認・管理します。"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <DashboardCard
          href="/admin/members"
          title="会員管理"
          description="会員のプロフィールと進捗を確認します。"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
      </div>
    </div>
  )
}

function AdminDashboard() {
  const [showIconBanner, setShowIconBanner] = useState(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const dismissed = localStorage.getItem('icon-update-dismissed')
    if (isIOS && !dismissed) {
      setShowIconBanner(true)
    }
  }, [])

  const dismissBanner = () => {
    localStorage.setItem('icon-update-dismissed', 'true')
    setShowIconBanner(false)
  }

  return (
    <div className="space-y-8 animate-slideUp">
      {showIconBanner && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-white">アプリアイコンの更新</h3>
              <div className="mt-2 text-sm text-gray-300">
                <p>ホーム画面のアイコンを更新するには、<Link href="/home-icon" className="text-white underline hover:text-gray-200">こちら</Link>から再度ホーム画面に追加してください。</p>
              </div>
            </div>
            <button onClick={dismissBanner} className="flex-shrink-0 ml-3 text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <h2 className="text-3xl font-bold text-white">管理画面</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardCard
          href="/admin/calendar"
          title="予約管理"
          description="すべての予約とスケジュールを管理します。"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <DashboardCard
          href="/admin/members"
          title="会員管理"
          description="会員アカウントとプランを管理します。"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <DashboardCard
          href="/admin/sales"
          title="売上管理"
          description="売上と財務パフォーマンスを確認します。"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <DashboardCard
          href="/admin/trainers"
          title="トレーナー管理"
          description="トレーナーのプロフィールと割り当てを管理します。"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <DashboardCard
          href="/admin/stores"
          title="店舗管理"
          description="ジムの場所と設備を管理します。"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      </div>
    </div>
  )
}

function ClientDashboard() {
  const { data: session } = useSession()
  const [userInfo, setUserInfo] = useState<{ plan?: string, status?: string, monthlyUsage?: { currentCount: number, maxCount: number, planName: string } }>({})
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reservationsLoading, setReservationsLoading] = useState(true)

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const result = await response.json()
          setUserInfo(result.data || result)
        } else {
          setUserInfo({ plan: 'Monthly 4', status: 'active' })
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error)
        setUserInfo({ plan: 'Monthly 4', status: 'active' })
      } finally {
        setLoading(false)
      }
    }

    const fetchReservations = async () => {
      try {
        const response = await fetch('/api/user/reservations')
        if (response.ok) {
          const result = await response.json()
          setReservations(result.data?.reservations || [])
        }
      } catch (error) {
        console.error('Failed to fetch reservations:', error)
      } finally {
        setReservationsLoading(false)
      }
    }

    if (session?.user) {
      fetchUserInfo()
      fetchReservations()
    } else {
      setLoading(false)
      setReservationsLoading(false)
    }
  }, [session])

  return (
    <div className="space-y-8 animate-slideUp">
      <h2 className="text-3xl font-bold text-white">マイページ</h2>

      {/* User Info Card */}
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-xl font-semibold text-white mb-6">会員ステータス</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center">
            <div className="bg-white/10 p-3 rounded-lg mr-4 text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">現在のプラン</p>
              <p className="text-lg font-bold text-white">
                {loading ? '読み込み中...' : (
                  userInfo.monthlyUsage
                    ? `${userInfo.monthlyUsage.planName}`
                    : (userInfo.plan || 'Monthly 4')
                )}
              </p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center">
            <div className="bg-white/10 p-3 rounded-lg mr-4 text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">ステータス</p>
              <p className="text-lg font-bold text-white">
                {loading ? '読み込み中...' : (
                  userInfo.status === 'active' ? '有効' :
                    userInfo.status === 'suspended' ? '休会中' :
                      userInfo.status === 'withdrawn' ? '退会済み' : '有効'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reservations */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">予約一覧</h3>
        </div>

        {reservationsLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-400">予約を読み込み中...</p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0a2 2 0 00-2-2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-4" />
            </svg>
            <p className="text-gray-400">予約はありません。</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Reservation List Logic */}
            {(() => {
              const upcoming = [...reservations]
                .filter(r => !r.isPast)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              const completed = [...reservations]
                .filter(r => r.isPast)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

              const Section = ({ title, items, isUpcoming }: { title: string, items: any[], isUpcoming: boolean }) => (
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{title}</h4>
                  {items.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">{title}の予約はありません。</p>
                  ) : (
                    <div className="space-y-4">
                      {items.map(item => {
                        const date = new Date(item.date)
                        const month = date.getMonth() + 1
                        const day = date.getDate()

                        return (
                          <div key={item.id} className="flex items-stretch gap-4 group">
                            <div className="w-20 flex-shrink-0 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center p-2 group-hover:bg-white/10 transition-colors duration-300">
                              <span className="text-xs text-gray-400">{date.getFullYear()}</span>
                              <span className="text-xl font-bold text-white">{month}/{day}</span>
                            </div>
                            <div className={`flex-1 border rounded-xl p-4 flex items-center justify-between transition-all duration-300 ${isUpcoming ? 'bg-white/10 border-white/30 hover:bg-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                              <div>
                                <div className="text-lg font-bold text-white">{item.time}</div>
                                <div className="text-sm text-gray-400">予約番号 #{item.id.slice(0, 4)}</div>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-xs font-bold ${isUpcoming ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'bg-white/10 text-gray-400'}`}>
                                {isUpcoming ? '予約中' : '完了'}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )

              return (
                <>
                  <Section title="今後の予約" items={upcoming} isUpcoming={true} />
                  <Section title="過去の履歴" items={completed} isUpcoming={false} />
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
