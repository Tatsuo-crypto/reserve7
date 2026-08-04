import webpush from 'web-push'
import { supabaseAdmin } from './supabase'

type PushPayload = {
  title: string
  body: string
  url: string
  /**
   * AX-1: アプリ内のお知らせ一覧での分類。
   * broadcast(配信のお知らせ) / reservation(予約リマインダー) / online_lesson(レッスン通知)。
   * 省略時は 'other'。
   */
  category?: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const VAPID_PUBLIC_KEY_FALLBACK =
  'BF3y2wkY1j3CjeP3X0EYgjVq0aJyk1MHwqDj_yjHH4wbN5mMJGc6gaGTuRoucCNEbaFCyFo9GfhIPFLarU_9JPk'

function configureWebPush(): boolean {
  const publicKey = getVapidPublicKey()
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:tandjgym@gmail.com'

  if (!publicKey || !privateKey) {
    console.warn('Web Push is not configured: VAPID keys are missing.')
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export function getVapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY_FALLBACK
}

export function isPushConfigured(): boolean {
  return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY)
}

/**
 * AX-1: 送った通知をアプリ内のお知らせ一覧に残す。
 * ここは全通知が必ず通る一点なので、ここで記録しておけば
 * 今後通知の種類が増えても自動的に履歴に載る。
 * 端末側の購読が無く実際には届かなかった場合でも記録は残す
 * (アプリを開けば読み返せるようにするため)。
 * 記録に失敗しても通知の送信自体は止めない。
 */
async function recordNotification(userId: string, payload: PushPayload): Promise<void> {
  try {
    await supabaseAdmin.from('user_notifications').insert({
      user_id: userId,
      title: payload.title,
      body: payload.body,
      url: payload.url || null,
      category: payload.category || 'other',
    })
  } catch (error) {
    console.error('Failed to record notification history:', error)
  }
}

export async function sendPushNotificationToUser(userId: string, payload: PushPayload): Promise<number> {
  // 送信可否(VAPID設定・購読の有無)に関わらず、まずアプリ内のお知らせとして残す
  await recordNotification(userId, payload)

  if (!configureWebPush()) return 0

  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to fetch push subscriptions:', error)
    return 0
  }

  let successCount = 0

  for (const subscription of (subscriptions || []) as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(payload)
      )
      successCount++
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('id', subscription.id)
      } else {
        console.error('Failed to send push notification:', error)
      }
    }
  }

  return successCount
}
