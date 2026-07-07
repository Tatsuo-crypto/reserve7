'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Icon, { type IconName } from '@/components/ui/icons'

const BottomNavigationContent = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  
  // 管理者以外、または会員用画面（/client/...）、トレーナー画面（/trainer/...）では表示しない
  if (
    session?.user?.role !== 'ADMIN' || 
    pathname.startsWith('/client') || 
    pathname.startsWith('/trainer')
  ) return null;

  // 現在のタブを取得
  let activeTab = searchParams.get('tab') || (pathname === '/dashboard' ? 'home' : '');
  if (pathname.startsWith('/admin/members')) activeTab = 'members';
  if (pathname.startsWith('/admin/analytics')) activeTab = 'sales';

  const navItems: { id: string, label: string, iconName: IconName, isCenter?: boolean }[] = [
    { id: 'sales', label: '売上', iconName: 'chartBar' },
    { id: 'diet', label: 'ダイエット', iconName: 'heart' },
    { id: 'home', label: '予約', isCenter: true, iconName: 'calendar' },
    { id: 'members', label: '会員', iconName: 'userGroup' },
    { id: 'others', label: 'その他', iconName: 'listMenu' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-raised/95 backdrop-blur-md border-t border-border-subtle pb-8 shadow-[0_-1px_10px_rgba(0,0,0,0.02)]">
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
                    ? 'w-14 h-14 bg-brand-700 text-white rounded-full shadow-lg -translate-y-4 border-4 border-surface-raised mb-1'
                    : isActive
                    ? 'w-10 h-10 text-brand-600'
                    : 'w-10 h-10 text-text-muted'
                }`}
              >
                <Icon name={item.iconName} size={item.isCenter ? 32 : 24} />
              </div>
              
              <span className={`text-[10px] font-normal transition-colors ${
                item.isCenter ? 'absolute bottom-1' : '-mt-1'
              } ${
                isActive ? 'text-brand-600' : 'text-text-muted'
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
