'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'

function MainWrapperContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const trainerToken = searchParams.get('trainerToken')
  const isStandalone = pathname?.startsWith('/trainer/') || pathname?.startsWith('/client/') || !!trainerToken

  // マウント前はハイドレーションエラーを避けるため標準のスタイルを適用
  if (!mounted) {
    return <main className="pt-[30px] pb-32">{children}</main>
  }

  return (
    <main className={isStandalone ? '' : 'pt-[30px] pb-32'}>
      {children}
    </main>
  )
}

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="pt-[30px] pb-32">{children}</main>}>
      <MainWrapperContent>{children}</MainWrapperContent>
    </Suspense>
  )
}
