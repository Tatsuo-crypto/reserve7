import { ReactNode } from 'react'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export interface BadgeProps {
    tone?: Tone
    children: ReactNode
    className?: string
}

// Q-6: neutralのみベーステーマ依存のためトークン参照化。brand/success/warning/dangerは
// アクセント・状態色そのもの(黒ベース化に伴うシェード調整はQ-4/PR-Q3で別途対応)。
const TONE_CLASSES: Record<Tone, string> = {
    neutral: 'bg-surface-base text-text-secondary',
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-600',
}

/**
 * N-2: バッジ・チップ用の共通コンポーネント。角丸はN-4のトークンどおり常に rounded-full。
 * success/dangerはO-1の「状態色」レイヤーそのもの(緑=達成/安全圏、赤=明確な超過・警告)。
 * O-2の原則により、分析・状態表示の文脈でのみ使う(ホーム等の励ましの文脈では使わない)。
 */
export default function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-normal whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}>
            {children}
        </span>
    )
}
