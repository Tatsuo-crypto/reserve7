'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getStoreDisplayName } from '@/lib/auth-utils'
import { useState, Suspense, useEffect } from 'react'
import StoreSwitcher from './StoreSwitcher'
import Icon from '@/components/ui/icons'

function NavigationContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Determine if we should show a back button instead of a menu button
  const isSubPage = pathname !== '/dashboard' && pathname !== '/admin/members' && pathname !== '/admin/analytics'

  // Helper to get only last name
  const formatName = (fullName: string | null | undefined, role: string | undefined) => {
    if (!fullName) return ''
    // Split by space (both half-width and full-width) and take the first part
    const lastName = fullName.split(/[\s　]+/)[0]
    if (role === 'ADMIN') return lastName
    if (role === 'TRAINER') return lastName
    if (role === 'MEMBER') return `${lastName}様`
    return lastName
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  // Determine page title based on pathname and tab
  const getPageTitle = () => {
    const tab = searchParams.get('tab')
    
    // Member detail pages (try to get name from somewhere or just generic)
    if (pathname?.startsWith('/admin/members/')) {
       const name = searchParams.get('name')
       return name ? `${name}様` : '会員詳細'
    }

    if (pathname === '/dashboard') {
      if (tab === 'diet') return 'ダイエット管理'
      if (tab === 'sales') return '売上集計'
      if (tab === 'members') return '会員管理'
      if (tab === 'others') return 'その他設定'
      return '予約状況'
    }
    
    if (pathname?.startsWith('/admin/analytics')) return '売上集計'
    if (pathname?.startsWith('/admin/sales')) return '売上管理'
    if (pathname?.startsWith('/admin/payroll')) return '給与計算'
    if (pathname?.startsWith('/admin/mail-settings')) return '配信設定'
    if (pathname?.startsWith('/admin/calendar')) return '予約'
    if (pathname?.startsWith('/admin/reservations')) return '予約'
    if (pathname?.startsWith('/admin/diet-plan')) {
      // 会員選択中は「ダイエット詳細」という汎用ラベルではなく本人の名前を出す
      const name = searchParams.get('name')
      return name || 'ダイエット詳細'
    }
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

  // Don't show global navigation on client pages (they have their own headers)
  if (pathname && (pathname.startsWith('/client/') || pathname.startsWith('/trainer/'))) {
    return null
  }

  return (
    <header className="bg-surface-raised/80 backdrop-blur-md border-b border-border-subtle sticky top-0 z-50 h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between relative">
        {/* Left: Menu or Back Button */}
        <div className="z-10 min-w-[44px]">
          {isSubPage ? (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center text-brand-500 bg-surface-raised rounded-full shadow-sm border border-border-subtle transition-all active:scale-90 hover:bg-surface-base"
            >
              <Icon name="chevronLeft" size={24} />
            </button>
          ) : (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-10 h-10 flex items-center justify-center text-text-muted bg-surface-raised rounded-full shadow-sm border border-border-subtle transition-all active:scale-90"
            >
              <Icon name="menu" size={24} />
            </button>
          )}
        </div>

        {/* Center: Dynamic Page Title */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h1 className="text-[17px] font-normal text-text-primary tracking-tight whitespace-nowrap pointer-events-auto">
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
               className="h-10 px-4 flex items-center gap-1 bg-surface-raised rounded-full shadow-sm border border-border-subtle transition-all active:scale-95"
             >
               <span className="text-text-secondary text-[13px] font-normal truncate max-w-[100px]">
                 {formatName(session.user.name, session.user.role)}
               </span>
               <div className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-normal whitespace-nowrap ${
                 session.user.role === 'TRAINER' ? 'bg-brand-500 text-white' : 'bg-surface-overlay text-text-primary'
               }`}>
                 {session.user.role === 'TRAINER' ? 'トレーナー' : '会員'}
               </div>
             </button>
          ) : null}
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-4 right-4 bg-surface-raised rounded-3xl shadow-xl border border-border-subtle p-2 z-50 animate-fadeIn overflow-hidden">
             <div className="flex flex-col">
              <Link 
                href="/dashboard" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 p-5 hover:bg-surface-base rounded-2xl transition-colors text-text-secondary"
              >
                <span className="text-base font-normal">ダッシュボード</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-5 hover:bg-state-danger-500/25 rounded-2xl transition-colors text-state-danger-400 border-t border-border-subtle"
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
