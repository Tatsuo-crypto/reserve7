'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
    fullWidth?: boolean
    loading?: boolean
}

// Q-6: primary/destructiveはbrand/状態色そのもの(ベーステーマに依存しないため据え置き)。
// secondary/ghostは背景・文字がベーステーマ依存なのでセマンティックトークン参照に変更。
// hoverは「1段明るい面に持ち上がる」関係を保つため surface.base → surface.raised とした。
// destructiveはQ-4のダークバッジパターン(bg-*-500/15 + text-*-300)に合わせ、
// hover/disabledも同系の半透明レッドで揃える(黒地での淡色ボタンのコントラスト確保)。
const VARIANT_CLASSES: Record<Variant, string> = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300',
    secondary: 'bg-surface-base text-text-secondary border border-border-subtle hover:bg-surface-raised disabled:text-text-muted',
    destructive: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:text-red-500/40',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-base hover:text-text-primary disabled:text-text-muted',
}

const SIZE_CLASSES: Record<Size, string> = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-sm',
}

/**
 * N-2: 共通ボタンコンポーネント。
 * これまで211箇所で個別に手書きされていたボタンの角丸・余白・色の組み合わせをここに集約する。
 * バリアントは primary(主操作) / secondary(副操作) / destructive(削除等) / ghost(控えめな操作) の
 * 4つで打ち止め(N-2の決定どおり)。角丸はN-4のトークンに従い常に rounded-lg。
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', fullWidth = false, loading = false, disabled, className = '', children, ...rest },
    ref
) {
    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={`inline-flex items-center justify-center gap-2 rounded-lg font-normal transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...rest}
        >
            {loading && (
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            )}
            {children}
        </button>
    )
})

export default Button
