import nodemailer from 'nodemailer'
import { supabaseAdmin } from './supabase'

// 2026-07 決定: メール送信機能は廃止し、通知はアプリのプッシュ通知のみで行う（管理者側「配信設定」の再整理）。
// 実装・テンプレートは将来の参考用に残すが、実際の送信はすべてここで止める。
const EMAIL_NOTIFICATIONS_DISABLED = true

const GMAIL_USER = process.env.GMAIL_USER || ''
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD2 || ''

let transporter: nodemailer.Transporter | null = null

function getTransporter(): { sendMail: (options: nodemailer.SendMailOptions) => Promise<any> } | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('⚠️ Email not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing')
    return null
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })
  }
  return {
    sendMail: async (options: nodemailer.SendMailOptions) => {
      const sandboxEmail = process.env.EMAIL_SANDBOX_RECIPIENT
      if (sandboxEmail && sandboxEmail.trim() !== '') {
        const originalTo = options.to as string
        console.log(`[Email Sandbox] Intercepting email to ${originalTo}. Redirecting to sandbox: ${sandboxEmail}`)
        
        options.to = sandboxEmail.trim()
        
        if (options.bcc) {
          options.bcc = undefined
        }

        const bannerHtml = `
          <div style="background-color: #fff3cd; color: #856404; padding: 12px; border: 1px solid #ffeeba; border-radius: 8px; margin-bottom: 16px; font-size: 13px; font-family: sans-serif; line-height: 1.4; text-align: left;">
            <strong>【テスト配信】</strong> 本来の送信先: ${originalTo}
          </div>
        `
        
        if (typeof options.html === 'string') {
          const match = options.html.match(/<div[^>]*>/)
          if (match) {
            const insertIndex = match.index! + match[0].length
            options.html = options.html.slice(0, insertIndex) + bannerHtml + options.html.slice(insertIndex)
          } else {
            options.html = bannerHtml + options.html
          }
        }
      }
      return transporter!.sendMail(options)
    }
  }
}

export function isDummyEmail(email?: string | null): boolean {
  if (!email) return true
  const cleaned = email.trim().toLowerCase()
  return (
    cleaned === '-' ||
    cleaned.includes('@gym.internal') ||
    cleaned.includes('no-email-')
  )
}

export async function isEmailNotificationsEnabled(email: string): Promise<boolean> {
  if (isDummyEmail(email)) return false
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('online_reminder_enabled')
      .eq('email', email)
      .single()
    if (!error && data) {
      return data.online_reminder_enabled !== false
    }
  } catch (e) {
    console.error('Error checking user email notification preference:', e)
  }
  return true
}

export interface MailSettings {
  reminder_before_minutes: number;
  sender_display_name: string;
  additional_recipient_emails: string;
  client_create_notify: boolean;
  client_update_notify: boolean;
  client_cancel_notify: boolean;
  trainer_create_notify: boolean;
  trainer_update_notify: boolean;
  trainer_cancel_notify: boolean;
  personal_reminder_enabled: boolean;
  personal_reminder_days_before: number;
  personal_reminder_hour: number;
  personal_reminder_template: string;
  online_announcement_template: string;
  client_create_template: string;
  client_update_template: string;
  client_cancel_template: string;
}

export const DEFAULT_MAIL_SETTINGS: MailSettings = {
  reminder_before_minutes: 30,
  sender_display_name: 'T&J GYM',
  additional_recipient_emails: '',
  client_create_notify: true,
  client_update_notify: true,
  client_cancel_notify: true,
  trainer_create_notify: true,
  trainer_update_notify: true,
  trainer_cancel_notify: true,
  personal_reminder_enabled: true,
  personal_reminder_days_before: 1,
  personal_reminder_hour: 21,
  personal_reminder_template: 'ご予約のセッション日時が近づいてまいりましたので、お知らせいたします。\n内容をご確認いただき、お気をつけてお越しください。',
  online_announcement_template: 'オンラインレッスンが開催されますので、お知らせいたします。\nお時間になりましたら、以下のリンクよりご参加ください。\n\nレッスン：{title}\n開始時間：{time}\nURL：{url}',
  client_create_template: 'ご予約が確定しました。',
  client_update_template: 'ご予約内容が変更されましたのでご確認ください。',
  client_cancel_template: 'ご予約のキャンセルを承りました。',
};

export async function getMailSettings(): Promise<MailSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('mail_settings')
      .select('*')
      .eq('id', 'global')
      .maybeSingle()

    if (error) {
      console.warn('⚠️ Could not fetch mail_settings from database (table may not exist yet). Using defaults.', error.message)
      return DEFAULT_MAIL_SETTINGS
    }

    if (!data) {
      return DEFAULT_MAIL_SETTINGS
    }

    return {
      reminder_before_minutes: data.reminder_before_minutes ?? 30,
      sender_display_name: data.sender_display_name ?? 'T&J GYM',
      additional_recipient_emails: data.additional_recipient_emails ?? '',
      client_create_notify: data.client_create_notify ?? true,
      client_update_notify: data.client_update_notify ?? true,
      client_cancel_notify: data.client_cancel_notify ?? true,
      trainer_create_notify: data.trainer_create_notify ?? true,
      trainer_update_notify: data.trainer_update_notify ?? true,
      trainer_cancel_notify: data.trainer_cancel_notify ?? true,
      personal_reminder_enabled: data.personal_reminder_enabled ?? true,
      personal_reminder_days_before: data.personal_reminder_days_before ?? 1,
      personal_reminder_hour: data.personal_reminder_hour ?? 9,
      personal_reminder_template: data.personal_reminder_template ?? DEFAULT_MAIL_SETTINGS.personal_reminder_template,
      online_announcement_template: data.online_announcement_template ?? DEFAULT_MAIL_SETTINGS.online_announcement_template,
      client_create_template: data.client_create_template ?? DEFAULT_MAIL_SETTINGS.client_create_template,
      client_update_template: data.client_update_template ?? DEFAULT_MAIL_SETTINGS.client_update_template,
      client_cancel_template: data.client_cancel_template ?? DEFAULT_MAIL_SETTINGS.client_cancel_template,
    }
  } catch (err) {
    console.error('Failed to get mail settings, using defaults:', err)
    return DEFAULT_MAIL_SETTINGS
  }
}

function formatEmailTemplate(
  template: string,
  variables: {
    clientName?: string
    trainerName?: string
    storeName?: string
    dateStr?: string
    timeStr?: string
    title?: string
    url?: string
  }
): string {
  let result = template
  if (variables.clientName) result = result.replace(/{name}/g, variables.clientName)
  if (variables.trainerName) result = result.replace(/{trainer}/g, variables.trainerName)
  if (variables.storeName) result = result.replace(/{store}/g, variables.storeName)
  if (variables.dateStr) result = result.replace(/{date}/g, variables.dateStr)
  if (variables.timeStr) result = result.replace(/{time}/g, variables.timeStr)
  if (variables.title) result = result.replace(/{title}/g, variables.title)
  if (variables.url) result = result.replace(/{url}/g, variables.url)
  return result.replace(/\n/g, '<br>')
}

export async function sendTrainerNotification(params: {
  trainerEmail: string
  trainerName: string
  clientName: string
  title: string
  startTime: string
  endTime: string
  storeName: string
  notes?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.trainerEmail)) {
    console.log(`ℹ️ Skipping trainer email notification: ${params.trainerEmail} is a dummy email address.`)
    return false
  }

  const settings = await getMailSettings()
  if (!settings.trainer_create_notify) {
    console.log('ℹ️ Trainer creation notification is disabled in settings.')
    return false
  }

  const t = getTransporter()
  if (!t) return false

  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const startDate = new Date(params.startTime)
  const endDate = new Date(params.endTime)

  const dateStr = startDate.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const startTimeStr = startDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `予約通知: ${params.clientName}さん ${dateStr}`

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">${params.trainerName}さん</p>
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 12px 0;">新しい予約が入りました。</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 100px; color: #475569; font-size: 14px;">店舗</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569; font-size: 14px;">会員</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.clientName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #475569; font-size: 14px;">日時</td>
          <td style="padding: 10px; color: #0f172a; font-size: 14px; font-weight: bold;">${dateStr} ${startTimeStr}</td>
        </tr>
        ${params.notes ? `
        <tr>
          <td style="padding: 10px; border-top: 1px solid #e2e8f0; font-weight: bold; color: #475569; font-size: 14px;">メモ</td>
          <td style="padding: 10px; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.notes}</td>
        </tr>
        ` : ''}
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 0;">
        ※ このメールはT&J GYM予約システムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.trainerEmail,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Notification email sent to ${params.trainerEmail}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send notification email to ${params.trainerEmail}:`, error)
    throw error
  }
}

export async function sendClientNotification(params: {
  clientEmail: string
  clientName: string
  trainerName: string
  title: string
  startTime: string
  endTime: string
  storeName: string
  notes?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.clientEmail)) {
    console.log(`ℹ️ Skipping client email notification: ${params.clientEmail} is a dummy email address.`)
    return false
  }

  if (!(await isEmailNotificationsEnabled(params.clientEmail))) {
    console.log(`ℹ️ Skipping client email notification: ${params.clientEmail} has email notifications disabled.`)
    return false
  }

  const settings = await getMailSettings()
  if (!settings.client_create_notify) {
    console.log('ℹ️ Client creation notification is disabled in settings.')
    return false
  }

  const t = getTransporter()
  if (!t) return false

  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const startDate = new Date(params.startTime)
  const endDate = new Date(params.endTime)

  const dateStr = startDate.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const startTimeStr = startDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `ご予約の確認`

  const bodyText = formatEmailTemplate(settings.client_create_template || 'ご予約が確定しました。', {
    clientName: params.clientName,
    trainerName: params.trainerName,
    storeName: params.storeName,
    dateStr,
    timeStr: `${startTimeStr} - ${endTimeStr}`
  })

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 0 0 16px 0;">
        ${bodyText}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 100px; color: #475569; font-size: 14px;">店舗</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569; font-size: 14px;">トレーナー</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.trainerName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #475569; font-size: 14px;">日時</td>
          <td style="padding: 10px; color: #0f172a; font-size: 14px; font-weight: bold;">${dateStr} ${startTimeStr}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 0;">
        ※ このメールはT&J GYM予約システムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.clientEmail,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Notification email sent to ${params.clientEmail}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send notification email to ${params.clientEmail}:`, error)
    throw error
  }
}

export async function sendClientUpdateNotification(params: {
  clientEmail: string
  clientName: string
  trainerName: string
  title: string
  startTime: string
  endTime: string
  storeName: string
  notes?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.clientEmail)) {
    console.log(`ℹ️ Skipping client email notification: ${params.clientEmail} is a dummy email address.`)
    return false
  }

  if (!(await isEmailNotificationsEnabled(params.clientEmail))) {
    console.log(`ℹ️ Skipping client email notification: ${params.clientEmail} has email notifications disabled.`)
    return false
  }

  const settings = await getMailSettings()
  if (!settings.client_update_notify) {
    console.log('ℹ️ Client update notification is disabled in settings.')
    return false
  }

  const t = getTransporter()
  if (!t) return false

  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const startDate = new Date(params.startTime)
  const endDate = new Date(params.endTime)

  const dateStr = startDate.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const startTimeStr = startDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `ご予約変更の確認`

  const bodyText = formatEmailTemplate(settings.client_update_template || 'ご予約内容が変更されましたのでご確認ください。', {
    clientName: params.clientName,
    trainerName: params.trainerName,
    storeName: params.storeName,
    dateStr,
    timeStr: `${startTimeStr} - ${endTimeStr}`
  })

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 0 0 16px 0;">
        ${bodyText}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 100px; color: #475569; font-size: 14px;">店舗</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569; font-size: 14px;">トレーナー</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.trainerName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #475569; font-size: 14px;">日時</td>
          <td style="padding: 10px; color: #0f172a; font-size: 14px; font-weight: bold;">${dateStr} ${startTimeStr}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 0;">
        ※ このメールはT&J GYM予約システムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.clientEmail,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Update notification email sent to client ${params.clientEmail}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send update notification email to client ${params.clientEmail}:`, error)
    throw error
  }
}

export async function sendClientCancellationNotification(params: {
  clientEmail: string
  clientName: string
  trainerName: string
  title: string
  startTime: string
  endTime: string
  storeName: string
  notes?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.clientEmail)) {
    console.log(`ℹ️ Skipping client email notification: ${params.clientEmail} is a dummy email address.`)
    return false
  }

  if (!(await isEmailNotificationsEnabled(params.clientEmail))) {
    console.log(`ℹ️ Skipping client email notification: ${params.clientEmail} has email notifications disabled.`)
    return false
  }

  const settings = await getMailSettings()
  if (!settings.client_cancel_notify) {
    console.log('ℹ️ Client cancellation notification is disabled in settings.')
    return false
  }

  const t = getTransporter()
  if (!t) return false

  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const startDate = new Date(params.startTime)
  const endDate = new Date(params.endTime)

  const dateStr = startDate.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const startTimeStr = startDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `ご予約キャンセルの確認`

  const bodyText = formatEmailTemplate(settings.client_cancel_template || 'ご予約のキャンセルを承りました。', {
    clientName: params.clientName,
    trainerName: params.trainerName,
    storeName: params.storeName,
    dateStr,
    timeStr: `${startTimeStr} - ${endTimeStr}`
  })

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 0 0 16px 0;">
        ${bodyText}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; font-weight: bold; width: 100px; color: #991b1b; font-size: 14px;">店舗</td>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; color: #991b1b; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; font-weight: bold; color: #991b1b; font-size: 14px;">トレーナー</td>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; color: #991b1b; font-size: 14px;">${params.trainerName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #991b1b; font-size: 14px;">日時</td>
          <td style="padding: 10px; color: #991b1b; font-size: 14px; font-weight: bold;">${dateStr} ${startTimeStr}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 0;">
        ※ このメールはT&J GYM予約システムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.clientEmail,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Cancellation notification email sent to client ${params.clientEmail}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send cancellation notification email to client ${params.clientEmail}:`, error)
    throw error
  }
}


export async function sendTrainerUpdateNotification(params: {
  trainerEmail: string
  trainerName: string
  clientName: string
  title: string
  startTime: string
  endTime: string
  storeName: string
  notes?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.trainerEmail)) {
    console.log(`ℹ️ Skipping trainer email notification: ${params.trainerEmail} is a dummy email address.`)
    return false
  }

  const settings = await getMailSettings()
  if (!settings.trainer_update_notify) {
    console.log('ℹ️ Trainer update notification is disabled in settings.')
    return false
  }

  const t = getTransporter()
  if (!t) return false

  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const startDate = new Date(params.startTime)
  const endDate = new Date(params.endTime)

  const dateStr = startDate.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const startTimeStr = startDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `予約変更通知: ${params.clientName}さん ${dateStr}`

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">${params.trainerName}さん</p>
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 12px 0;">担当している予約が変更されました。</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 100px; color: #475569; font-size: 14px;">店舗</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569; font-size: 14px;">会員</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.clientName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #475569; font-size: 14px;">日時</td>
          <td style="padding: 10px; color: #0f172a; font-size: 14px; font-weight: bold;">${dateStr} ${startTimeStr}</td>
        </tr>
        ${params.notes ? `
        <tr>
          <td style="padding: 10px; border-top: 1px solid #e2e8f0; font-weight: bold; color: #475569; font-size: 14px;">メモ</td>
          <td style="padding: 10px; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.notes}</td>
        </tr>
        ` : ''}
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 0;">
        ※ このメールはT&J GYM予約システムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.trainerEmail,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Update notification email sent to trainer ${params.trainerEmail}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send update notification email to trainer ${params.trainerEmail}:`, error)
    throw error
  }
}

export async function sendTrainerCancellationNotification(params: {
  trainerEmail: string
  trainerName: string
  clientName: string
  title: string
  startTime: string
  endTime: string
  storeName: string
  notes?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.trainerEmail)) {
    console.log(`ℹ️ Skipping trainer email notification: ${params.trainerEmail} is a dummy email address.`)
    return false
  }

  const settings = await getMailSettings()
  if (!settings.trainer_cancel_notify) {
    console.log('ℹ️ Trainer cancellation notification is disabled in settings.')
    return false
  }

  const t = getTransporter()
  if (!t) return false

  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const startDate = new Date(params.startTime)
  const endDate = new Date(params.endTime)

  const dateStr = startDate.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const startTimeStr = startDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `予約キャンセル通知: ${params.clientName}さん ${dateStr}`

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">${params.trainerName}さん</p>
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 12px 0;">担当している予約がキャンセルされました。</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; font-weight: bold; width: 100px; color: #991b1b; font-size: 14px;">店舗</td>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; color: #991b1b; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; font-weight: bold; color: #991b1b; font-size: 14px;">会員</td>
          <td style="padding: 10px; border-bottom: 1px solid #fee2e2; color: #991b1b; font-size: 14px;">${params.clientName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #991b1b; font-size: 14px;">日時</td>
          <td style="padding: 10px; color: #991b1b; font-size: 14px; font-weight: bold;">${dateStr} ${startTimeStr}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 0;">
        ※ このメールはT&J GYM予約システムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.trainerEmail,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Cancellation notification email sent to trainer ${params.trainerEmail}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send cancellation notification email to trainer ${params.trainerEmail}:`, error)
    throw error
  }
}

export async function sendOnlineLessonReminder(params: {
  email: string
  clientName: string
  title: string
  startTime: string
  endTime: string
  meetUrl: string
  description?: string
  difficulty?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.email)) return false
  if (!(await isEmailNotificationsEnabled(params.email))) return false

  const t = getTransporter()
  if (!t) return false

  const settings = await getMailSettings()
  const senderDisplayName = settings.sender_display_name || 'T&J GYM'

  const subject = `オンラインレッスン リマインダー: ${params.title}`

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">${params.clientName}様</p>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
        本日開催されるオンラインレッスンのリマインダーです。<br>
        お時間になりましたら、以下のリンクよりご参加ください。
      </p>
      
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4b5563; font-weight: bold; width: 80px;">レッスン</td>
            <td style="padding: 6px 0; font-size: 14px; color: #1f2937;">${params.title}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4b5563; font-weight: bold;">時間</td>
            <td style="padding: 6px 0; font-size: 14px; color: #1f2937; font-weight: bold;">本日 ${params.startTime}</td>
          </tr>
          ${params.difficulty ? `
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4b5563; font-weight: bold;">難易度</td>
            <td style="padding: 6px 0; font-size: 14px; color: #1f2937;">${params.difficulty}</td>
          </tr>
          ` : ''}
          ${params.description ? `
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4b5563; font-weight: bold; vertical-align: top;">内容</td>
            <td style="padding: 6px 0; font-size: 14px; color: #4b5563; line-height: 1.4;">${params.description}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.meetUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          レッスンに参加する (Google Meet)
        </a>
      </div>

      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        ※ 開始5分前から入室いただけます。<br>
        ※ スマートフォンから参加する場合は、事前にGoogle Meetアプリのインストールが必要です。<br>
        ※ このメールはT&J GYMシステムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.email,
      subject,
      html,
    })
    console.log(`✅ Online lesson reminder email sent to ${params.email}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send online lesson reminder email to ${params.email}:`, error)
    throw error
  }
}

export async function sendPersonalSessionReminder(params: {
  email: string
  clientName: string
  title: string
  startTime: string
  endTime: string
  storeName: string
  trainerName?: string
  notes?: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.email)) return false
  if (!(await isEmailNotificationsEnabled(params.email))) return false

  const t = getTransporter()
  if (!t) return false

  const settings = await getMailSettings()
  if (!settings.personal_reminder_enabled) {
    console.log('ℹ️ Personal session reminder is disabled in settings.')
    return false
  }

  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const startDate = new Date(params.startTime)
  const endDate = new Date(params.endTime)

  const dateStr = startDate.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const startTimeStr = startDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const daysBefore = settings.personal_reminder_days_before ?? 1
  const subject = daysBefore === 1 ? 'ご予約前日のお知らせ' : `ご予約${daysBefore}日前のお知らせ`

  const bodyText = formatEmailTemplate(settings.personal_reminder_template || '', {
    clientName: params.clientName,
    trainerName: '',
    storeName: params.storeName,
    dateStr,
    timeStr: `${startTimeStr} - ${endTimeStr}`
  })

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">${params.clientName}様</p>
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 12px 0;">
        ${bodyText}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 100px; color: #475569; font-size: 14px;">店舗</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #475569; font-size: 14px;">日時</td>
          <td style="padding: 10px; color: #0f172a; font-size: 14px; font-weight: bold;">${dateStr} ${startTimeStr}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 0;">
        ※ 変更やキャンセルの場合は公式LINEまでご連絡お願いします。<br>
        ※ このメールはT&J GYMシステムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.email,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Personal session reminder email sent to client ${params.email}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send personal session reminder email to client ${params.email}:`, error)
    throw error
  }
}

export async function sendOnlineLessonAnnouncement(params: {
  email: string
  clientName: string
  title: string
  startTime: string
  endTime: string
  meetUrl: string
  description?: string
  difficulty?: string
  scheduleStr: string
}): Promise<boolean> {
  if (EMAIL_NOTIFICATIONS_DISABLED) return false
  if (isDummyEmail(params.email)) return false
  if (!(await isEmailNotificationsEnabled(params.email))) return false

  const t = getTransporter()
  if (!t) return false

  const settings = await getMailSettings()
  const senderDisplayName = settings.sender_display_name || 'T&J GYM'
  const additionalEmails = settings.additional_recipient_emails
    ? settings.additional_recipient_emails.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const subject = `オンラインレッスン開催のお知らせ: ${params.title}`

  const bodyText = formatEmailTemplate(settings.online_announcement_template || '', {
    clientName: params.clientName,
    title: params.title,
    timeStr: params.scheduleStr,
    url: params.meetUrl,
  })

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <p style="font-size: 16px; color: #1f2937; margin-bottom: 12px;">${params.clientName}様</p>
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6; margin: 12px 0;">
        ${bodyText}
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.meetUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          レッスンに参加する (Google Meet)
        </a>
      </div>

      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        ※ 開始5分前から入室いただけます。<br>
        ※ スマートフォンから参加する場合は、事前にGoogle Meetアプリのインストールが必要です。<br>
        ※ このメールはT&J GYMシステムから自動送信されています。
      </p>
    </div>
  `

  try {
    const info = await t.sendMail({
      from: {
        name: senderDisplayName,
        address: GMAIL_USER
      },
      to: params.email,
      bcc: additionalEmails.length > 0 ? additionalEmails : undefined,
      subject,
      html,
    })
    console.log(`✅ Online lesson announcement email sent to ${params.email}, messageId: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send online lesson announcement email to ${params.email}:`, error)
    throw error
  }
}
