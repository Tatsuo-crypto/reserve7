import { ReactNode } from 'react'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export interface BadgeProps {
    tone?: Tone
    children: ReactNode
    className?: string
}

// Q-6: neutralのみベーステーマ依存のためトークン参照化。brand/success/warning/dangerは
// アクセント・状態色そのもの。Q-4/PR-Q2: 淡色バッジパターン(bg-*-100 text-*-800系)を
// 「bg-*-500/15 text-*-300」の暗地パターンへ機械的に総置換(黒ベースでのコントラスト確保)。
const TONE_CLASSES: Record<Tone, string> = {
    neutral: 'bg-surface-base text-text-secondary',
    brand: 'bg-brand-500/15 text-brand-300',
    success: 'bg-emerald-500/15 text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-300',
    danger: 'bg-red-500/15 text-red-300',
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
