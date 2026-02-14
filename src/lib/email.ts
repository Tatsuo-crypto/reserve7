import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER || ''
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || ''

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('⚠️ Email not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing')
    return null
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })
  }
  return transporter
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
  const t = getTransporter()
  if (!t) return false

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
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 100px;">店舗</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">会員</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.clientName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">日時</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dateStr} ${startTimeStr} - ${endTimeStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">タイトル</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.title}</td>
        </tr>
        ${params.notes ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">メモ</td>
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
    await t.sendMail({
      from: `"T&J GYM" <${GMAIL_USER}>`,
      to: params.trainerEmail,
      subject,
      html,
    })
    console.log(`✅ Notification email sent to ${params.trainerEmail}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send notification email to ${params.trainerEmail}:`, error instanceof Error ? error.message : error)
    return false
  }
}
