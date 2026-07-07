import { HTMLAttributes } from 'react'

type Padding = 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    padding?: Padding
}

const PADDING_CLASSES: Record<Padding, string> = {
    sm: 'p-5',
    md: 'p-6 sm:p-8',
    lg: 'p-8 sm:p-10',
}

/**
 * N-2: カードの角丸・シャドウ・枠線を一元化する共通コンポーネント。
 * 角丸・シャドウはN-4のトークンどおり固定（rounded-2xl / shadow-sm）。
 * 既存の角丸(rounded-2xl〜rounded-[2.5rem]まで8種類混在)・シャドウ(8種類混在)の揺れを
 * ここに集約することで解消していく（適用は画面を触るタイミングで段階的に）。
 * Q-6: 背景・枠線はセマンティックトークン(surface.raised/border.subtle)参照に変更。
 * PR-Q2でトークンの値がzinc系に切り替わると、この行を触らずに黒ベース化される。
 */
export default function Card({ padding = 'md', className = '', children, ...rest }: CardProps) {
    return (
        <div className={`bg-surface-raised rounded-2xl border border-border-subtle shadow-sm ${PADDING_CLASSES[padding]} ${className}`} {...rest}>
            {children}
        </div>
    )
}
