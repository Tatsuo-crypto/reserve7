'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import Icon, { type IconName } from '@/components/ui/icons'

type TrainerNavItem = {
  id: 'shifts' | 'reservations' | 'attendance'
  label: string
  href: string
  iconName: IconName
  isCenter?: boolean
}

export default function TrainerBottomNavigation() {
  const params = useParams()
  const pathname = usePathname()
  const token = params?.token as string | undefined

  if (!token) return null

  const basePath = `/trainer/${token}`
  const items: TrainerNavItem[] = [
    { id: 'shifts', label: 'シフト管理', href: `${basePath}/shifts`, iconName: 'clock' },
    { id: 'reservations', label: '予約', href: basePath, iconName: 'calendar', isCenter: true },
    { id: 'attendance', label: '出勤', href: `${basePath}/attendance`, iconName: 'checkCircle' },
  ]

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-surface-raised/95 backdrop-blur-md shadow-[0_-1px_10px_rgba(0,0,0,0.02)]"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-md items-end px-6 py-1">
        {items.map(item => {
          const isActive = item.id === 'reservations'
            ? pathname === basePath
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.id}
              href={item.href}
              className="relative flex flex-1 flex-col items-center justify-center pb-1 transition-all duration-300"
            >
              <div
                className={`flex items-center justify-center transition-all duration-300 ${
                  item.isCenter
                    ? 'mb-1 h-14 w-14 -translate-y-4 rounded-full border-4 border-surface-raised bg-brand-700 text-white shadow-lg'
                    : isActive
                      ? 'h-10 w-10 text-brand-600'
                      : 'h-10 w-10 text-text-muted'
                }`}
              >
                <Icon name={item.iconName} size={item.isCenter ? 32 : 24} />
              </div>
              <span
                className={`text-xs font-normal transition-colors ${
                  item.isCenter ? 'absolute bottom-1' : '-mt-1'
                } ${isActive ? 'text-brand-600' : 'text-text-muted'}`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
