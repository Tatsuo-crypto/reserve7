import { ReactNode } from 'react'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export interface BadgeProps {
    tone?: Tone
    children: ReactNode
    className?: string
}

const TONE_CLASSES: Record<Tone, string> = {
    neutral: 'bg-gray-50 text-gray-500',
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-600',
}

/**
 * N-2: バッジ・チップ用の共通コンポーネント。角丸はN-4のトークンどおり常に rounded-full。
 * warning/dangerはA-4の原則(未達に警告色を使わない)に沿って、状態表示が明確に必要な場面のみで使う。
 */
export default function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-normal whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}>
            {children}
        </span>
    )
}
