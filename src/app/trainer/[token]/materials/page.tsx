'use client'

import { useParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'
import MaterialsList from '@/components/materials/MaterialsList'

export default function TrainerMaterialsPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  return (
    <div className="min-h-screen bg-surface-base pb-28">
      <header className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-border-subtle bg-surface-raised/95 backdrop-blur-md">
        <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center px-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/trainer/${token}`)}
            className="absolute left-4 h-10 w-10 p-0 text-text-secondary"
            aria-label="戻る"
          >
            <Icon name="chevronLeft" size={22} />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">資料</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-4 pt-20">
        <MaterialsList endpoint={`/api/trainer/materials?token=${encodeURIComponent(token)}`} />
      </main>
    </div>
  )
}
