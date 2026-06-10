import webpush from 'web-push'
import { supabaseAdmin } from './supabase'

type PushPayload = {
  title: string
  body: string
  url: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
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
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ''
}

export async function sendPushNotificationToUser(userId: string, payload: PushPayload): Promise<number> {
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
