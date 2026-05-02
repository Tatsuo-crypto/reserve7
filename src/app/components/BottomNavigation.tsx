'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

const BottomNavigationContent = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  
  // 管理者以外、または会員用画面（/client/...）では表示しない
  if (session?.user?.role !== 'ADMIN' || pathname.startsWith('/client')) return null;

  // 現在のタブを取得
  let activeTab = searchParams.get('tab') || (pathname === '/dashboard' ? 'home' : '');
  if (pathname.startsWith('/admin/members')) activeTab = 'members';
  if (pathname.startsWith('/admin/analytics')) activeTab = 'sales';

  const navItems = [
    { id: 'sales', label: '売上', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: 'diet', label: 'ダイエット', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    )},
    { id: 'home', label: '予約', isCenter: true, icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'members', label: '会員', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )},
    { id: 'others', label: 'その他', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
      </svg>
    )},
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-safe">
      <div className="max-w-md mx-auto flex items-end px-2 py-1 relative">
        {navItems.map((item) => {
          // 遷移先URLの決定
          let href = `/dashboard?tab=${item.id}${item.id === 'home' ? `&_t=${Date.now()}` : ''}`;
          if (item.id === 'members') href = '/admin/members';
          if (item.id === 'sales') href = '/admin/analytics';

          const isActive = activeTab === item.id;

          return (
            <Link
              key={item.id}
              href={href}
              className="flex flex-col items-center justify-center transition-all duration-300 relative flex-1 pb-1"
            >
              <div
                className={`flex items-center justify-center transition-all duration-300 ${
                  item.isCenter
                    ? 'w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg -translate-y-4 border-4 border-white mb-1'
                    : isActive
                    ? 'w-10 h-10 text-blue-600'
                    : 'w-10 h-10 text-gray-400'
                }`}
              >
                {item.icon}
              </div>
              
              <span className={`text-[10px] font-normal transition-colors ${
                item.isCenter ? 'absolute bottom-1' : '-mt-1'
              } ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const BottomNavigation = () => {
  return (
    <React.Suspense fallback={null}>
      <BottomNavigationContent />
    </React.Suspense>
  );
}

export default BottomNavigation;
