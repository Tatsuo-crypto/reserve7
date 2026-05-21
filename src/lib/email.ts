import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

function getResend(): Resend | null {
  if (!RESEND_API_KEY) {
    console.warn('⚠️ Email not configured: RESEND_API_KEY missing')
    return null
  }
  return new Resend(RESEND_API_KEY)
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
  const resend = getResend()
  if (!resend) return false

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

  const subject = `【T&J GYM】予約通知: ${params.clientName}さん ${dateStr}`

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px;">
        T&J GYM 予約通知
      </h2>
      <p>${params.trainerName}さん、新しい予約が入りました。</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: normal; width: 100px;">店舗</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: normal;">会員</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.clientName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: normal;">日時</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dateStr} ${startTimeStr} - ${endTimeStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: normal;">タイトル</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.title}</td>
        </tr>
        ${params.notes ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: normal;">メモ</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.notes}</td>
        </tr>
        ` : ''}
      </table>
      <p style="color: #6b7280; font-size: 12px;">
        ※ このメールはT&J GYM予約システムから自動送信されています。
      </p>
    </div>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: 'T&J GYM <onboarding@resend.dev>',
      to: params.trainerEmail,
      subject,
      html,
    })
    if (error) {
      console.error(`❌ Resend error for ${params.trainerEmail}:`, error)
      throw new Error(error.message)
    }
    console.log(`✅ Notification email sent to ${params.trainerEmail}, id: ${data?.id}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send notification email to ${params.trainerEmail}:`, error)
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
  const resend = getResend()
  if (!resend) return false

  const subject = `【T&J GYM】オンラインレッスン リマインダー: ${params.title}`

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-2xl; background-color: #ffffff;">
      <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-top: 0;">
        T&J GYM オンラインレッスン
      </h2>
      <p style="font-size: 16px; color: #1f2937;">${params.clientName}様</p>
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
            <td style="padding: 6px 0; font-size: 14px; color: #1f2937; font-weight: bold;">本日 ${params.startTime} - ${params.endTime}</td>
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
    const { data, error } = await resend.emails.send({
      from: 'T&J GYM <onboarding@resend.dev>',
      to: params.email,
      subject,
      html,
    })
    if (error) {
      console.error(`❌ Resend error for ${params.email}:`, error)
      throw new Error(error.message)
    }
    console.log(`✅ Online lesson reminder email sent to ${params.email}, id: ${data?.id}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send online lesson reminder email to ${params.email}:`, error)
    throw error
  }
}

