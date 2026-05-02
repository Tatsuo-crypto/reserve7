'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="mb-8 mt-2 sticky top-0 z-50 bg-gray-50/80 backdrop-blur-sm pt-2 pb-2">
      <div className="relative flex items-center justify-between min-h-[56px] px-1 max-w-5xl mx-auto">
        {/* Left: Circular Back Button */}
        <div className="z-10 min-w-[44px]">
          {showBack && (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center text-blue-500 bg-white rounded-full shadow-sm border border-gray-100 transition-all active:scale-90 hover:bg-gray-50"
              aria-label="戻る"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Center: Page Title (Absolutely Centered) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="text-[17px] font-normal text-gray-900 tracking-tight whitespace-nowrap">
            {title}
          </h1>
          {subTitle && (
            <p className="text-[9px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">{subTitle}</p>
          )}
        </div>

        {/* Right: Pill-shaped Info/Action Button */}
        <div className="z-10 flex justify-end min-w-[44px]">
          {rightElement}
        </div>
      </div>
    </div>
  )
}
