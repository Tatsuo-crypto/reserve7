'use client'

import { useCallback, useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'

export interface ClientNotification {
    id: string
    title: string
    body: string
    url: string | null
    category: string
    read_at: string | null
    created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
    broadcast: 'お知らせ',
    reservation: '予約',
    online_lesson: 'オンライン',
    other: 'お知らせ',
}

function formatDateTime(iso: string): string {
    const d = new Date(iso)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    const time = d.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
    if (isToday) return `今日 ${time}`
    return `${d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' })} ${time}`
}

function countsForUnreadBadge(notification: ClientNotification): boolean {
    if (notification.category === 'reservation') return false

    const text = `${notification.title || ''} ${notification.body || ''}`
    return !/(リマインダー|ご予約前日|セッション予定があります|オンラインセッションのお知らせ|ご予約が確定|予約が確定|予約を承りました|ご予約が変更|ご予約がキャンセル|予約変更|予約キャンセル)/.test(text)
}

/**
 * AX-3: 会員がアプリ内で通知を読み返す画面。
 * 通知は端末側で消えてしまうと二度と見られなかったため、送った通知をここに残す。
 */
export default function NotificationsTab({ token }: { token: string }) {
    const [notifications, setNotifications] = useState<ClientNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [markingAll, setMarkingAll] = useState(false)

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch(`/api/client/notifications?token=${encodeURIComponent(token)}`)
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.notifications || [])
            }
        } catch (e) {
            console.error('Fetch notifications error:', e)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        if (token) fetchNotifications()
    }, [token, fetchNotifications])

    const markAllAsRead = async () => {
        setMarkingAll(true)
        try {
            await fetch(`/api/client/notifications?token=${encodeURIComponent(token)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true }),
            })
            await fetchNotifications()
        } catch (e) {
            console.error('Mark all as read error:', e)
        } finally {
            setMarkingAll(false)
        }
    }

    const markOneAsRead = async (id: string) => {
        // 先に画面へ反映してから通信する(タップの手応えを優先)
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
        try {
            await fetch(`/api/client/notifications?token=${encodeURIComponent(token)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
        } catch (e) {
            console.error('Mark as read error:', e)
        }
    }

    if (loading) {
        return (
            <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        )
    }

    const unreadCount = notifications.filter(n => !n.read_at && countsForUnreadBadge(n)).length

    return (
        <div className="space-y-3 animate-fadeIn">
            {unreadCount > 0 && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-sm font-normal text-text-secondary">未読 {unreadCount}件</p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={markAllAsRead}
                        disabled={markingAll}
                        className="rounded-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-transparent"
                    >
                        {markingAll ? '処理中...' : 'すべて既読にする'}
                    </Button>
                </div>
            )}

            {notifications.length === 0 ? (
                <EmptyState
                    icon="bell"
                    title="お知らせはありません"
                    description="ジムからのお知らせやリマインダーがここに表示されます。"
                />
            ) : (
                notifications.map(n => {
                    const isUnread = !n.read_at
                    return (
                        <Button
                            key={n.id}
                            type="button"
                            variant="ghost"
                            block
                            onClick={() => isUnread && markOneAsRead(n.id)}
                            className="block w-full p-0 text-left active:scale-[0.99] transition-transform"
                        >
                            <Card padding="sm" className={isUnread ? 'border-brand-500/30' : ''}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="未読" />}
                                        <p className={`min-w-0 text-sm ${isUnread ? 'font-semibold text-text-primary' : 'font-normal text-text-secondary'}`}>
                                            {n.title}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-surface-overlay px-2 py-0.5 text-xs font-normal text-text-muted">
                                        {CATEGORY_LABELS[n.category] || CATEGORY_LABELS.other}
                                    </span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm font-normal text-text-secondary">{n.body}</p>
                                <p className="mt-2 text-xs font-normal text-text-muted tabular-nums">{formatDateTime(n.created_at)}</p>
                            </Card>
                        </Button>
                    )
                })
            )}
        </div>
    )
}
