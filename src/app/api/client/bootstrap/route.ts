import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const DEFAULT_SETTINGS = {
  visible_items: { steps: false, sleep: false, water: false, workout: false },
  visible_tabs: { input: false, analyze: false, progress: false },
  quit_goals: [],
  habit_targets: { steps: 8000, sleep: 7, water: 2, workout: 30 },
}

function todayInJapan() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function todayDowInJapan() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  }).formatToParts(new Date())
  const weekday = parts.find(part => part.type === 'weekday')?.value || 'Sun'
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
}

function mergeSettings(settings: any) {
  if (!settings) return DEFAULT_SETTINGS
  return {
    ...settings,
    visible_items: settings.visible_items || DEFAULT_SETTINGS.visible_items,
    visible_tabs: settings.visible_tabs || DEFAULT_SETTINGS.visible_tabs,
    quit_goals: settings.quit_goals || DEFAULT_SETTINGS.quit_goals,
    habit_targets: settings.habit_targets || DEFAULT_SETTINGS.habit_targets,
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim()

    if (!token) {
      return NextResponse.json({ error: 'トークンが指定されていません' }, { status: 400 })
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, store_id, plan, status')
      .eq('access_token', token)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'このアカウントは現在利用できません' }, { status: 403 })
    }

    const today = todayInJapan()
    const nowISO = new Date().toISOString()
    const todayDow = todayDowInJapan()

    const [settingsResult, goalsResult, dietLogResult, reservationResult, lessonsResult] = await Promise.all([
      supabaseAdmin
        .from('lifestyle_settings')
        .select('visible_items, visible_tabs, quit_goals, habit_targets')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('goals')
        .select('id, type, title, target_value, start_date, deadline, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('diet_logs')
        .select('id, date, calories, protein, fat, carbs, sugar, fiber, salt, image_url, notes')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
      supabaseAdmin
        .from('reservations')
        .select('id, title, start_time, end_time, notes, created_at')
        .eq('client_id', user.id)
        .gte('start_time', nowISO)
        .order('start_time', { ascending: true })
        .limit(1),
      supabaseAdmin
        .from('online_lessons')
        .select('id, title, meet_url, description, day_of_week, start_time, end_time, difficulty')
        .eq('store_id', user.store_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
    ])

    if (settingsResult.error) throw settingsResult.error
    if (goalsResult.error) throw goalsResult.error
    if (dietLogResult.error && dietLogResult.error.code !== 'PGRST116') throw dietLogResult.error
    if (reservationResult.error) throw reservationResult.error
    if (lessonsResult.error) throw lessonsResult.error

    const todayLesson = (lessonsResult.data || []).find((lesson: any) => {
      if (!lesson.day_of_week || !Array.isArray(lesson.day_of_week)) return true
      return lesson.day_of_week.includes(todayDow)
    }) || null

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        storeId: user.store_id,
        plan: user.plan || '月4回',
      },
      settings: mergeSettings(settingsResult.data),
      goals: goalsResult.data || [],
      todayDietLog: dietLogResult.data || null,
      nextReservation: reservationResult.data?.[0] || null,
      todayLesson,
    })
  } catch (error: any) {
    console.error('Client bootstrap API error:', error)
    return NextResponse.json({ error: error.message || '初期表示データの取得に失敗しました' }, { status: 500 })
  }
}
