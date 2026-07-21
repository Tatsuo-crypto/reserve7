'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'

type SubjectType = 'member' | 'trainer_staff' | 'admin'

interface ConsentGateProps {
  subjectType: SubjectType
  subjectId: string | null | undefined
  children: React.ReactNode
}

/**
 * T-5 / AB-優先1: 初回アクセス時に利用規約・プライバシーポリシーへの同意を取得するゲート。
 * subjectId未確定(認証前)の間はchildrenをそのまま表示し、
 * subjectId確定後に同意状態を確認して未同意ならブロッキングモーダルを出す。
 */
export default function ConsentGate({ subjectType, subjectId, children }: ConsentGateProps) {
  const [status, setStatus] = useState<'checking' | 'needsConsent' | 'agreed' | 'skip'>('skip')
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!subjectId) {
      setStatus('skip')
      return
    }

    let cancelled = false
    setStatus('checking')

    fetch(`/api/consent?subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setStatus(data.agreed ? 'agreed' : 'needsConsent')
      })
      .catch(() => {
        if (cancelled) return
        // 確認に失敗した場合は利用をブロックしない(可用性を優先)
        setStatus('agreed')
      })

    return () => {
      cancelled = true
    }
  }, [subjectType, subjectId])

  const handleAgree = async () => {
    if (!subjectId || !checked) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectType, subjectId }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('agreed')
    } catch {
      setError('同意の記録に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (status !== 'needsConsent') {
    return <>{children}</>
  }

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
        <div className="w-full max-w-md rounded-t-2xl border border-border-subtle bg-surface-raised p-6 shadow-xl sm:rounded-2xl">
          <h2 className="text-xl font-semibold text-text-primary">利用規約・プライバシーポリシーへの同意</h2>
          <p className="mt-3 text-sm font-normal leading-relaxed text-text-secondary">
            本サービスのご利用にあたり、下記の利用規約およびプライバシーポリシーへの同意をお願いしています。内容をご確認のうえ、同意いただける場合はチェックを入れて「同意して利用を開始」を押してください。
          </p>

          <div className="mt-4 space-y-2 text-sm font-normal">
            <Link href="/terms" target="_blank" className="block text-brand-300 underline underline-offset-2">
              利用規約を読む
            </Link>
            <Link href="/privacy" target="_blank" className="block text-brand-300 underline underline-offset-2">
              プライバシーポリシーを読む
            </Link>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm font-normal text-text-primary">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong text-brand-600 focus:ring-brand-500"
            />
            利用規約とプライバシーポリシーの内容に同意します
          </label>

          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

          <Button
            type="button"
            variant="primary"
            fullWidth
            disabled={!checked}
            loading={submitting}
            onClick={handleAgree}
            className="mt-5"
          >
            同意して利用を開始
          </Button>
        </div>
      </div>
    </>
  )
}
