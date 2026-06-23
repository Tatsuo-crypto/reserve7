'use client'

import { useEffect, useState } from 'react'

type PushNotificationPromptProps = {
  token: string
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

  useEffect(() => {
    const available =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setSupported(available)
    if (!available) {
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
      } finally {
        setLoading(false)
      }
    }

    loadStatus()
  }, [token])

  const enablePush = async () => {
    setMessage('')
    setLoading(true)

    try {
      const keyRes = await fetch('/api/push/public-key')
      const keyData = await keyRes.json()

      if (!keyRes.ok || !keyData.publicKey) {
        setMessage('通知機能の準備がまだ完了していません。')
        return
      }

      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') {
        setMessage('スマホ側で通知が許可されていません。')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription || await registration.pushManager.subscribe({
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
        setMessage(saveData.error || '通知設定の保存に失敗しました。')
        return
      }

      setSubscribed(true)
      setEnabledByAdmin(saveData.enabledByAdmin === true)
      setMessage(saveData.enabledByAdmin ? '通知を受け取れるようになりました。' : '端末登録は完了しました。店舗側で通知が有効になると受け取れます。')
    } catch (error) {
      console.error('Failed to enable push notifications:', error)
      setMessage('通知設定中にエラーが発生しました。')
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
      setMessage('この端末への通知を解除しました。')
    } catch (error) {
      console.error('Failed to disable push notifications:', error)
      setMessage('通知解除中にエラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return null
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-normal text-gray-900">アプリ通知</div>
          <div className="mt-1 text-xs text-gray-500">
            {subscribed
              ? enabledByAdmin
                ? '予約やオンライン開始前のお知らせをスマホで受け取れます。'
                : '端末登録済みです。店舗側の通知チェックがONになると通知されます。'
              : 'スマホで通知を受け取る場合は許可してください。'}
          </div>
          {permission === 'denied' && (
            <div className="mt-2 text-xs text-red-600">ブラウザ設定で通知がブロックされています。</div>
          )}
          {message && <div className="mt-2 text-xs text-gray-600">{message}</div>}
        </div>
        {subscribed ? (
          <button
            type="button"
            onClick={disablePush}
            disabled={loading}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 disabled:opacity-50"
          >
            解除
          </button>
        ) : (
          <button
            type="button"
            onClick={enablePush}
            disabled={loading || permission === 'denied'}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-50"
          >
            許可
          </button>
        )}
      </div>
    </div>
  )
}
