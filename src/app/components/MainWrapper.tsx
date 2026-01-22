'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function MainWrapperContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const trainerToken = searchParams.get('trainerToken')
  
  const isStandalone = pathname?.startsWith('/trainer/') || pathname?.startsWith('/client/') || !!trainerToken

  return (
    <main className={isStandalone ? '' : 'py-[30px]'}>
      {children}
    </main>
  )
}

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="py-[30px]">{children}</main>}>
      <MainWrapperContent>{children}</MainWrapperContent>
    </Suspense>
  )
}
