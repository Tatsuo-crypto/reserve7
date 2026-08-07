'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
    fullWidth?: boolean
    loading?: boolean
    /**
     * AQ-2: カード型の「押せる領域」としてButtonを使う場合に指定する。
     * 既定の `inline-flex items-center justify-center` は、中に見出し+本文のような
     * 縦積みの中身を入れると全部が中央に寄って潰れてしまう。className側に `block` や
     * `text-left` を足しても、displayユーティリティはTailwindの出力順で inline-flex が
     * 後に来るため上書きできず、「カードの中身が見えない/はみ出す」不具合になっていた。
     * このpropを立てると display と配置指定をベースから外し、中身のレイアウトを
     * 呼び出し側に委ねる。
     */
    block?: boolean
    /**
     * AS-1: 見た目をすべて呼び出し側のclassNameで指定したい場合に使う。
     * variantの色クラス(例: primaryの `bg-brand-500 text-white`)は、className側に
     * `bg-white text-brand-600` のような別の色を書いても、CSSの出力順しだいで
     * どちらが勝つか決まってしまう。実際にこれが原因で「白いボタンに白い文字」になり
     * ラベルが消えていた箇所があった。このpropを立てるとvariant/sizeのクラスを一切付けず、
     * classNameの指定だけが効くようにする。
     */
    unstyled?: boolean
}

// Q-6: primary/destructiveはbrand/状態色そのもの(ベーステーマに依存しないため据え置き)。
// secondary/ghostは背景・文字がベーステーマ依存なのでセマンティックトークン参照に変更。
// hoverは「1段明るい面に持ち上がる」関係を保つため surface.base → surface.raised とした。
// destructiveはQ-4のダークバッジパターン(bg-*-500/15 + text-*-300)に合わせ、
// hover/disabledも同系の半透明レッドで揃える(黒地での淡色ボタンのコントラスト確保)。
const VARIANT_CLASSES: Record<Variant, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
    secondary: 'bg-surface-base text-text-secondary border border-border-subtle hover:bg-surface-raised disabled:text-text-muted',
    destructive: 'bg-red-500/15 text-red-700 hover:bg-red-500/25 disabled:text-red-500/40',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-base hover:text-text-primary disabled:text-text-muted',
}

const SIZE_CLASSES: Record<Size, string> = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-sm',
}

/*
  AS-1: 「classNameに書いたのに効かない」問題をコンポーネント側で吸収する。

  Tailwindのユーティリティは同じ詳細度なので、どちらが勝つかは記述順ではなく
  生成CSSの出力順で決まる。そのため呼び出し側が className に色や display を書いても、
  ベースの variant / inline-flex に負けることがあり、
    - 白背景に白文字でラベルが消える(bg-white text-brand-600 が primary の text-white に負ける)
    - カードが中央寄せで潰れる(block が inline-flex に負ける)
  といった崩れが実際に起きていた。
  そこで「呼び出し側が同じ種類の指定をしているなら、ベース側の該当クラスを外す」ようにして、
  className が常に勝つ状態にする。block / unstyled は明示的に外したいとき用に残す。
*/
const COLOR_NAMES = 'brand|state|surface|text|border|red|blue|amber|green|sky|zinc|gray|slate|neutral|stone|orange|emerald|purple|indigo|pink|rose|yellow|lime|teal|cyan|violet|fuchsia'
const CALLER_SETS_BG = new RegExp(`(^|\\s)bg-(white|black|transparent|current|inherit|gradient-to-|(?:${COLOR_NAMES})-)`)
const CALLER_SETS_TEXT_COLOR = new RegExp(`(^|\\s)text-(white|black|transparent|current|inherit|(?:${COLOR_NAMES})-)`)
const CALLER_SETS_DISPLAY = /(^|\s)(block|inline-block|inline|flow-root|contents|hidden|grid|inline-grid|flex|inline-flex|table)(\s|$)/

/**
 * N-2: 共通ボタンコンポーネント。
 * これまで211箇所で個別に手書きされていたボタンの角丸・余白・色の組み合わせをここに集約する。
 * バリアントは primary(主操作) / secondary(副操作) / destructive(削除等) / ghost(控えめな操作) の
 * 4つで打ち止め(N-2の決定どおり)。角丸はN-4のトークンに従い常に rounded-lg。
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', fullWidth = false, loading = false, block = false, unstyled = false, disabled, className = '', children, ...rest },
    ref
) {
    const callerSetsDisplay = CALLER_SETS_DISPLAY.test(className)
    const callerSetsBg = CALLER_SETS_BG.test(className)
    const callerSetsTextColor = CALLER_SETS_TEXT_COLOR.test(className)

    // 呼び出し側がdisplayを指定しているなら、ベースのinline-flex(と中央寄せ)は付けない
    const layoutClasses = block || callerSetsDisplay ? '' : 'inline-flex items-center justify-center gap-2'

    // 呼び出し側が背景色/文字色を指定しているなら、variant側の同種クラスを外して衝突させない
    const variantClasses = VARIANT_CLASSES[variant]
        .split(' ')
        .filter(cls => {
            if (callerSetsBg && /^(hover:|disabled:|active:|focus:)?bg-/.test(cls)) return false
            if (callerSetsTextColor && /^(hover:|disabled:|active:|focus:)?text-/.test(cls)) return false
            return true
        })
        .join(' ')

    const baseClasses = unstyled
        ? 'transition-colors disabled:cursor-not-allowed'
        : `rounded-lg font-normal transition-colors disabled:cursor-not-allowed ${variantClasses} ${SIZE_CLASSES[size]}`

    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={`${layoutClasses} ${baseClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
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
