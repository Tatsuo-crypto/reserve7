import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { DEFAULT_MAIL_SETTINGS } from '@/lib/email'

// GET /api/admin/mail-settings
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    let tableExists = true
    let settings = { ...DEFAULT_MAIL_SETTINGS }

    try {
      const { data, error } = await supabaseAdmin
        .from('mail_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          tableExists = false
        } else {
          throw error
        }
      } else if (data) {
        settings = {
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
      }
    } catch (err: any) {
      console.error('Database fetch error in mail-settings GET:', err)
      tableExists = false
    }

    return NextResponse.json({ settings, tableExists })
  } catch (error) {
    return handleApiError(error, 'Admin mail-settings GET')
  }
}

// POST /api/admin/mail-settings
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const {
      reminder_before_minutes,
      sender_display_name,
      additional_recipient_emails,
      client_create_notify,
      client_update_notify,
      client_cancel_notify,
      trainer_create_notify,
      trainer_update_notify,
      trainer_cancel_notify,
      personal_reminder_enabled,
      personal_reminder_days_before,
      personal_reminder_hour,
      personal_reminder_template,
      online_announcement_template,
      client_create_template,
      client_update_template,
      client_cancel_template,
    } = body

    const { data, error } = await supabaseAdmin
      .from('mail_settings')
      .upsert({
        id: 'global',
        reminder_before_minutes: Number(reminder_before_minutes),
        sender_display_name: sender_display_name || 'T&J GYM',
        additional_recipient_emails: additional_recipient_emails || '',
        client_create_notify: client_create_notify ?? true,
        client_update_notify: client_update_notify ?? true,
        client_cancel_notify: client_cancel_notify ?? true,
        trainer_create_notify: trainer_create_notify ?? true,
        trainer_update_notify: trainer_update_notify ?? true,
        trainer_cancel_notify: trainer_cancel_notify ?? true,
        personal_reminder_enabled: personal_reminder_enabled ?? true,
        personal_reminder_days_before: Number(personal_reminder_days_before),
        personal_reminder_hour: Number(personal_reminder_hour),
        personal_reminder_template: personal_reminder_template || DEFAULT_MAIL_SETTINGS.personal_reminder_template,
        online_announcement_template: online_announcement_template || DEFAULT_MAIL_SETTINGS.online_announcement_template,
        client_create_template: client_create_template || DEFAULT_MAIL_SETTINGS.client_create_template,
        client_update_template: client_update_template || DEFAULT_MAIL_SETTINGS.client_update_template,
        client_cancel_template: client_cancel_template || DEFAULT_MAIL_SETTINGS.client_cancel_template,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'mail_settings テーブルが存在しません。先にデータベースでマイグレーションSQLを実行してください。' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, settings: data })
  } catch (error) {
    return handleApiError(error, 'Admin mail-settings POST')
  }
}
