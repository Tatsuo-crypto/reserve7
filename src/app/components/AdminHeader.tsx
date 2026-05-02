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
    <div className="mb-8">
      <div className="relative flex items-center justify-center min-h-[64px]">
        {/* Back Button */}
        {showBack && (
          <button
            onClick={handleBack}
            className="absolute left-0 p-2.5 text-gray-400 hover:text-gray-900 bg-white rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md active:scale-95 group"
            aria-label="戻る"
          >
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Title Group */}
        <div className="text-center px-12">
          <h1 className="text-xl sm:text-2xl font-normal text-gray-900 tracking-tight leading-none">
            {title}
          </h1>
          {subTitle && (
            <p className="mt-1.5 text-[10px] font-normal text-gray-400 uppercase tracking-widest italic">
              {subTitle}
            </p>
          )}
        </div>

        {/* Right Element (Action buttons etc) */}
        {rightElement && (
          <div className="absolute right-0">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  )
}
