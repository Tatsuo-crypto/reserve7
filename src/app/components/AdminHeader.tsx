'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

interface AdminHeaderProps {
  title: string
  subTitle?: string
  onBack?: () => void
  rightElement?: React.ReactNode
  showBack?: boolean
}

export default function AdminHeader({ title, subTitle, onBack, rightElement, showBack = true }: AdminHeaderProps) {
  const router = useRouter()
  const handleBack = onBack || (() => router.back())

  return (
    <div className="mb-8 mt-2 sticky top-0 z-50 bg-surface-base/80 backdrop-blur-sm pt-2 pb-2">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 min-h-[56px] px-1 max-w-5xl mx-auto">
        {/* Left: Circular Back Button */}
        <div className="min-w-0">
          {showBack && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center p-0 text-brand-500 bg-surface-raised rounded-full shadow-sm border border-border-subtle transition-all active:scale-90 hover:bg-surface-base"
              aria-label="戻る"
            >
              <Icon name="chevronLeft" size={24} />
            </Button>
          )}
        </div>

        {/* Center: Page Title */}
        <div className="min-w-0 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="max-w-full truncate text-xl font-semibold text-text-primary tracking-tight whitespace-nowrap">
            {title}
          </h1>
          {subTitle && (
            <p className="text-xs text-text-muted font-normal uppercase tracking-widest mt-0.5">{subTitle}</p>
          )}
        </div>

        {/* Right: Pill-shaped Info/Action Button */}
        <div className="flex min-w-0 max-w-[46vw] justify-end overflow-hidden">
          {rightElement}
        </div>
      </div>
    </div>
  )
}
