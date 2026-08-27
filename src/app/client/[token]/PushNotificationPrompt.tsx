'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

type PushNotificationPromptProps = {
  token: string
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export default function PushNotificationPrompt({ token }: PushNotificationPromptProps) {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [enabledByAdmin, setEnabledByAdmin] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [supportMessage, setSupportMessage] = useState('')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installMessage, setInstallMessage] = useState('')
  const [isInstalled, setIsInstalled] = useState(false)

  const notificationStatus = subscribed
    ? enabledByAdmin
      ? '受信可能'
      : '端末許可済み'
    : 'オフ'

  const notificationIconClass = subscribed
    ? enabledByAdmin
      ? 'bg-brand-500 text-white'
      : 'bg-amber-500/15 text-amber-700'
    : 'bg-surface-overlay text-text-secondary'

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    setIsInstalled(Boolean(standalone))

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setInstallMessage('')
    }

    const handleInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      setInstallMessage('ホーム画面に追加しました。')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    const available =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setSupported(available)
    if (!available) {
      setSupportMessage('このブラウザでは通知を利用できません。iPhoneの場合はホーム画面に追加したアプリから開いてください。')
      setLoading(false)
      return
    }

    setPermission(Notification.permission)

    const loadStatus = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const subscription = await registration.pushManager.getSubscription()
        const res = await fetch(`/api/push/subscriptions?token=${token}`)
        const data = res.ok ? await res.json() : {}

        if (subscription && data.subscribed !== true) {
          const saveRes = await fetch('/api/push/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, subscription }),
          })

          if (saveRes.ok) {
            const saveData = await saveRes.json()
            data.subscribed = true
            data.enabledByAdmin = saveData.enabledByAdmin
          }
        }

        setSubscribed(Boolean(subscription) && data.subscribed === true)
        setEnabledByAdmin(data.enabledByAdmin === true)
      } catch (error) {
        console.error('Failed to load push notification status:', error)
        setMessage('通知設定を確認できませんでした。')
      } finally {
        setLoading(false)
      }
    }

    loadStatus()
  }, [token])

  const enablePush = async (options: { reset?: boolean } = {}) => {
    setMessage('')
    setLoading(true)

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') {
        setMessage('スマホ側で通知が許可されていません。')
        return
      }

      const keyRes = await fetch('/api/push/public-key')
      const keyData = await keyRes.json()

      if (!keyRes.ok || !keyData.publicKey) {
        setMessage('通知機能の準備がまだ完了していません。')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const existingSubscription = await registration.pushManager.getSubscription()

      if (options.reset && existingSubscription) {
        await fetch('/api/push/subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, endpoint: existingSubscription.endpoint }),
        })
        await existingSubscription.unsubscribe()
      }

      const currentSubscription = options.reset ? null : existingSubscription
      const subscription = currentSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      })

      const saveRes = await fetch('/api/push/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, subscription }),
      })

      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        setMessage(saveData.error || '通知設定を保存できませんでした。')
        return
      }

      setSubscribed(true)
      setEnabledByAdmin(saveData.enabledByAdmin === true)
      setMessage(options.reset
        ? '通知を再設定しました。'
        : saveData.enabledByAdmin === true
          ? 'アプリ通知を許可しました。'
          : '端末の通知を許可しました。管理者側がONになると届きます。'
      )
    } catch (error) {
      console.error('Failed to enable push notifications:', error)
      setMessage('通知を設定できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const disablePush = async () => {
    setMessage('')
    setLoading(true)

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()

      if (subscription) {
        await fetch('/api/push/subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }

      setSubscribed(false)
      setEnabledByAdmin(false)
      setMessage('この端末への通知を解除しました。')
    } catch (error) {
      console.error('Failed to disable push notifications:', error)
      setMessage('通知を解除できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const installApp = async () => {
    setInstallMessage('')

    if (!installPrompt) {
      setInstallMessage('Chromeのメニューから「ホーム画面に追加」を選んでください。')
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    setInstallMessage(choice.outcome === 'accepted'
      ? 'ホーム画面に追加しました。'
      : '追加がキャンセルされました。'
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${notificationIconClass}`}>
              <Icon name="bell" size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-normal text-text-primary">アプリ通知</div>
              <div className="mt-0.5 text-xs text-text-secondary">
                {notificationStatus}
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            {permission === 'denied' && (
              <span className="inline-flex w-full items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 sm:w-auto">
                ブロック中
              </span>
            )}
            {permission !== 'denied' && (subscribed ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => enablePush({ reset: true })}
                  disabled={loading || !supported}
                  className="w-full rounded-full border border-border-strong px-4 py-2 text-xs text-text-secondary disabled:opacity-50 sm:w-auto"
                >
                  再設定
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={disablePush}
                  disabled={loading}
                  className="w-full rounded-full border border-border-strong px-4 py-2 text-xs text-text-secondary disabled:opacity-50 sm:w-auto"
                >
                  解除
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => enablePush()}
                disabled={loading || !supported}
                className="w-full rounded-full bg-brand-500 px-4 py-2 text-xs text-white disabled:opacity-50 sm:w-auto"
              >
                通知を許可する
              </Button>
            ))}
          </div>
        </div>

        {(supportMessage || message || permission === 'denied') && (
          <div className="mt-3 rounded-lg bg-surface-overlay px-3 py-2 text-xs leading-relaxed text-text-secondary">
            {permission === 'denied'
              ? 'ブラウザ設定で通知がブロックされています。設定から通知を許可してください。'
              : supportMessage || message}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isInstalled ? 'bg-brand-500 text-white' : 'bg-surface-overlay text-text-secondary'}`}>
              <Icon name="download" size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-normal text-text-primary">ホーム画面</div>
              <div className="mt-0.5 text-xs text-text-secondary">
                {isInstalled ? '追加済み' : '未追加'}
              </div>
            </div>
          </div>

          {!isInstalled && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={installApp}
              className="w-full rounded-full border border-border-strong px-4 py-2 text-xs text-text-secondary sm:w-auto"
            >
              ホームに追加
            </Button>
          )}
        </div>

        {installMessage && (
          <div className="mt-3 rounded-lg bg-surface-overlay px-3 py-2 text-xs leading-relaxed text-text-secondary">
            {installMessage}
          </div>
        )}
      </div>
    </div>
  )
}
