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
    <div className="mb-6">
      <div className="relative flex items-center justify-between min-h-[56px] px-1">
        {/* Left: Circular Back Button */}
        <div className="w-24 flex justify-start">
          {showBack && (
            <button
              onClick={handleBack}
              className="w-11 h-11 flex items-center justify-center text-blue-500 bg-white rounded-full shadow-sm border border-gray-100 transition-all active:scale-95"
              aria-label="戻る"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Center: Page Title */}
        <div className="flex-1 text-center">
          <h1 className="text-lg font-normal text-gray-800 tracking-tight">
            {title}
          </h1>
          {subTitle && (
            <p className="text-[10px] text-gray-400 mt-0.5">{subTitle}</p>
          )}
        </div>

        {/* Right: Pill-shaped Info/Action Button */}
        <div className="w-24 flex justify-end">
          {rightElement ? (
            <div className="flex items-center">
              {rightElement}
            </div>
          ) : (
            <button className="h-10 px-4 flex items-center gap-1 bg-white rounded-full shadow-sm border border-gray-100 text-blue-500 text-sm transition-all active:scale-95">
              <span>設定</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
