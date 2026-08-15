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
  /** AY-1: 左側(戻るボタンの隣)に置く要素。会員画面ではここにベルを置く。 */
  leftElement?: React.ReactNode
  showBack?: boolean
}

export default function AdminHeader({ title, subTitle, onBack, rightElement, leftElement, showBack = true }: AdminHeaderProps) {
  const router = useRouter()
  const handleBack = onBack || (() => router.back())

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-border-subtle bg-surface-base/95 backdrop-blur-md">
        <div className="grid min-h-16 grid-cols-[minmax(44px,auto)_minmax(0,1fr)_auto] items-center gap-2 px-4 max-w-5xl mx-auto">
          {/* Left: Circular Back Button (+ 任意の左側要素) */}
          <div className="flex min-w-0 items-center gap-1.5">
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
            {leftElement}
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
      <div className="h-16 mb-4" aria-hidden="true" />
    </>
  )
}
