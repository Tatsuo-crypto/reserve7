'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Icon, { type IconName } from '@/components/ui/icons'

const ICON_NAMES: IconName[] = [
    'back', 'chevronDown', 'chevronUp', 'chevronLeft', 'chevronRight',
    'close', 'calendar', 'check', 'plus', 'settings', 'bell', 'warning', 'search',
]

/**
 * N-2: Storybook的な確認ページ。ui/配下の共通コンポーネント(Button/Card/Badge/Icon)の
 * 全バリアントを一覧できるようにし、実装時・レビュー時の見た目確認に使う。
 * 管理者専用(他の管理画面と同じセッション認証パターン)。
 */
export default function DesignSystemPage() {
    const router = useRouter()
    const { data: session, status } = useSession()

    useEffect(() => {
        if (status === 'loading') return
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }
        if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
            router.push('/dashboard')
        }
    }, [status, session, router])

    if (status !== 'authenticated' || session?.user?.role !== 'ADMIN') {
        return <div className="min-h-screen flex items-center justify-center bg-surface-base"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>
    }

    return (
        <div className="min-h-screen bg-surface-base pb-16 pt-8">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8">
                <div>
                    <h1 className="text-xl font-semibold text-text-primary">デザインシステム確認ページ</h1>
                    <p className="text-xs text-text-muted mt-1">N-2: ui/配下の共通コンポーネント一覧(管理者専用)</p>
                </div>

                <Card>
                    <h2 className="text-base font-semibold text-text-primary mb-4">Button</h2>
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <Button variant="primary">primary</Button>
                            <Button variant="secondary">secondary</Button>
                            <Button variant="destructive">destructive</Button>
                            <Button variant="ghost">ghost</Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="primary" size="sm">primary / sm</Button>
                            <Button variant="primary" loading>loading</Button>
                            <Button variant="primary" disabled>disabled</Button>
                        </div>
                        <Button variant="primary" fullWidth>fullWidth</Button>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-base font-semibold text-text-primary mb-4">Card(このカード自体もCardコンポーネント)</h2>
                    <p className="text-sm font-normal text-text-secondary">rounded-2xl / border-border-subtle / shadow-sm で統一。</p>
                </Card>

                <Card>
                    <h2 className="text-base font-semibold text-text-primary mb-4">Badge</h2>
                    <div className="flex flex-wrap gap-2">
                        <Badge tone="neutral">neutral</Badge>
                        <Badge tone="brand">brand</Badge>
                        <Badge tone="success">success</Badge>
                        <Badge tone="warning">warning</Badge>
                        <Badge tone="danger">danger</Badge>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-base font-semibold text-text-primary mb-4">Icon</h2>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                        {ICON_NAMES.map(name => (
                            <div key={name} className="flex flex-col items-center gap-1">
                                <div className="w-10 h-10 rounded-lg bg-surface-base flex items-center justify-center text-text-secondary">
                                    <Icon name={name} />
                                </div>
                                <span className="text-xs text-text-muted">{name}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <h2 className="text-base font-semibold text-text-primary mb-4">タイポグラフィ(N-4)</h2>
                    <div className="space-y-2">
                        <p className="text-xl font-semibold text-text-primary">見出し・主数値 = font-semibold</p>
                        <p className="text-sm font-normal text-text-secondary">本文 = font-normal</p>
                        <p className="text-xs text-text-muted">補足 = text-xs text-text-muted/500</p>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-base font-semibold text-text-primary mb-4">アクセントカラー(brand)</h2>
                    <div className="flex gap-2">
                        <div className="w-10 h-10 rounded-lg bg-brand-50" title="brand-50" />
                        <div className="w-10 h-10 rounded-lg bg-brand-100" title="brand-100" />
                        <div className="w-10 h-10 rounded-lg bg-brand-200" title="brand-200" />
                        <div className="w-10 h-10 rounded-lg bg-brand-300" title="brand-300" />
                        <div className="w-10 h-10 rounded-lg bg-brand-400" title="brand-400" />
                        <div className="w-10 h-10 rounded-lg bg-brand-500" title="brand-500" />
                        <div className="w-10 h-10 rounded-lg bg-brand-600" title="brand-600" />
                        <div className="w-10 h-10 rounded-lg bg-brand-700" title="brand-700" />
                        <div className="w-10 h-10 rounded-lg bg-brand-800" title="brand-800" />
                        <div className="w-10 h-10 rounded-lg bg-brand-900" title="brand-900" />
                    </div>
                    <p className="text-xs text-text-muted mt-2">indigo/roseの新規使用は今後禁止。既存箇所は画面を触るタイミングでbrandに置き換える。</p>
                </Card>
            </div>
        </div>
    )
}
