'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getStoreDisplayName } from '@/lib/auth-utils'
import { useState, Suspense, useEffect } from 'react'
import StoreSwitcher from './StoreSwitcher'

function NavigationContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Determine if we should show a back button instead of a menu button
  const isSubPage = pathname !== '/dashboard' && pathname !== '/admin/members' && pathname !== '/admin/analytics'

  // Determine page title based on pathname and tab
  const getPageTitle = () => {
    const tab = searchParams.get('tab')
    
    // Member detail pages (try to get name from somewhere or just generic)
    if (pathname?.startsWith('/admin/members/')) {
       return '会員詳細'
    }

    if (pathname === '/dashboard') {
      if (tab === 'diet') return 'ダイエット管理'
      if (tab === 'sales') return '売上集計'
      if (tab === 'members') return '会員管理'
      if (tab === 'others') return 'その他設定'
      return '予約状況'
    }
    
    if (pathname?.startsWith('/admin/analytics')) return '売上集計'
    if (pathname?.startsWith('/admin/diet-plan')) return 'ダイエット詳細'
    if (pathname?.startsWith('/admin/members')) return '会員管理'
    if (pathname?.startsWith('/admin/trainers')) return 'トレーナー管理'
    if (pathname?.startsWith('/admin/stores')) return '店舗管理'
    if (pathname?.startsWith('/admin/shifts')) return 'シフト管理'
    if (pathname?.startsWith('/admin/online-lesson')) return 'オンライン管理'
    return 'T&J GYM'
  }

  const handleBack = () => {
    router.back()
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  // Don't show global navigation on client pages (they have their own headers)
  if (pathname && (pathname.startsWith('/client/') || pathname.startsWith('/trainer/'))) {
    return null
  }

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between relative">
        {/* Left: Menu or Back Button */}
        <div className="z-10 min-w-[44px]">
          {isSubPage ? (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center text-blue-500 bg-white rounded-full shadow-sm border border-gray-100 transition-all active:scale-90 hover:bg-gray-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-10 h-10 flex items-center justify-center text-gray-400 bg-white rounded-full shadow-sm border border-gray-100 transition-all active:scale-90"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Center: Dynamic Page Title */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h1 className="text-[17px] font-normal text-gray-900 tracking-tight whitespace-nowrap pointer-events-auto">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right: Store Switcher / Account Pill */}
        <div className="z-10 flex justify-end min-w-[44px]">
          {session?.user?.role === 'ADMIN' ? (
            <StoreSwitcher defaultStoreName={getStoreDisplayName(session.user.email)} />
          ) : session?.user ? (
             <button 
               onClick={handleLogout}
               className="h-10 px-4 flex items-center gap-1 bg-white rounded-full shadow-sm border border-gray-100 text-rose-500 text-[13px] font-normal transition-all active:scale-95"
             >
               <span className="truncate max-w-[80px]">{session.user.name}</span>
               <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
               </svg>
             </button>
          ) : null}
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-4 right-4 bg-white rounded-3xl shadow-2xl border border-gray-100 p-2 z-50 animate-fadeIn overflow-hidden">
             <div className="flex flex-col">
              <Link 
                href="/dashboard" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 p-5 hover:bg-gray-50 rounded-2xl transition-colors text-gray-700"
              >
                <span className="text-base font-normal">ダッシュボード</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-5 hover:bg-rose-50 rounded-2xl transition-colors text-rose-600 border-t border-gray-50"
              >
                <span className="text-base font-normal">ログアウト</span>
              </button>
             </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default function Navigation() {
  return (
    <Suspense fallback={null}>
      <NavigationContent />
    </Suspense>
  )
}
