import { NextRequest, NextResponse } from 'next/server'
import { subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, format } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const MIN_START_DATE = new Date('2023-11-01')

function resolvePeriodRange(period: string, today: Date): { start: Date; end: Date } {
  let start: Date
  let end: Date = startOfMonth(today)

  if (period === 'all') {
    start = MIN_START_DATE
  } else if (['2023', '2024', '2025', '2026'].includes(period)) {
    start = new Date(`${period}-01-01`)
    end = new Date(`${period}-12-01`)
  } else if (period === '3m') {
    start = subMonths(startOfMonth(today), 2)
  } else {
    // default '1y'
    start = subMonths(startOfMonth(today), 11)
  }

  if (start < MIN_START_DATE) start = MIN_START_DATE
  return { start, end }
}

// GET /api/admin/capacity?period=1y
// 稼働率ダッシュボード用のデータをまとめて返す:
// 1. 今月のセッション数 2. 所要時間の内訳 3. トレーナー別週間シフト時間
// 4. 曜日・時間帯別の予約集中度 5. 現スタッフの週間稼働可能時間(→月間最大セッション数・稼働率)
// 6. 月別セッション数の推移(過去分も含む)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.isAdmin) {
      return createErrorResponse('Unauthorized', 401)
    }

    const period = request.nextUrl.searchParams.get('period') || '1y'

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString()

    // 1. 今月のセッション数(実施予約のみ、client_idがnullのブロック・研修は除く)
    const { count: monthlySessions, error: monthlyError } = await supabaseAdmin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .not('client_id', 'is', null)
      .gte('start_time', monthStart)
      .lt('start_time', nextMonthStart)

    if (monthlyError) {
      console.error('Capacity: monthly sessions error', monthlyError)
    }

    // 2〜4. 所要時間・時間帯分布の元データ(直近3ヶ月の実施予約)
    const { data: recentReservations, error: recentError } = await supabaseAdmin
      .from('reservations')
      .select('start_time, end_time')
      .not('client_id', 'is', null)
      .gte('start_time', threeMonthsAgo)

    if (recentError) {
      console.error('Capacity: recent reservations error', recentError)
    }

    // 6. 月別セッション数の推移(periodで指定された範囲、過去分も遡って表示)
    const { start: rangeStart, end: rangeEnd } = resolvePeriodRange(period, now)
    const monthList = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })

    const { data: trendReservations, error: trendError } = await supabaseAdmin
      .from('reservations')
      .select('start_time')
      .not('client_id', 'is', null)
      .gte('start_time', rangeStart.toISOString())
      .lt('start_time', endOfMonth(rangeEnd).toISOString())

    if (trendError) {
      console.error('Capacity: trend reservations error', trendError)
    }

    const sessionCountByMonth = new Map<string, number>()
    for (const r of trendReservations || []) {
      const key = format(new Date(r.start_time), 'yyyy-MM')
      sessionCountByMonth.set(key, (sessionCountByMonth.get(key) || 0) + 1)
    }

    const durationCounts = new Map<number, number>()
    const slotCounts = new Map<string, { weekday: number; hour: number; count: number }>()
    const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

    for (const r of recentReservations || []) {
      const start = new Date(r.start_time)
      const end = new Date(r.end_time)
      const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
      durationCounts.set(durationMin, (durationCounts.get(durationMin) || 0) + 1)

      const weekday = start.getDay()
      const hour = start.getHours()
      const key = `${weekday}-${hour}`
      const existing = slotCounts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        slotCounts.set(key, { weekday, hour, count: 1 })
      }
    }

    const durationBreakdown = Array.from(durationCounts.entries())
      .map(([durationMinutes, count]) => ({ durationMinutes, count }))
      .sort((a, b) => b.count - a.count)

    const mostCommonDuration = durationBreakdown[0]?.durationMinutes || 60

    const popularSlots = Array.from(slotCounts.values())
      .map((s) => ({ weekday: s.weekday, weekdayLabel: WEEKDAY_LABELS[s.weekday], hour: s.hour, count: s.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 5. 現スタッフ(在籍中)の週間シフトテンプレート時間
    const { data: activeTrainers, error: trainersError } = await supabaseAdmin
      .from('trainers')
      .select('id, full_name')
      .eq('status', 'active')

    if (trainersError) {
      console.error('Capacity: trainers error', trainersError)
    }

    const activeTrainerIds = (activeTrainers || []).map((t) => t.id)

    let trainerWeeklyHours: { trainerId: string; fullName: string; weeklyHours: number }[] = []
    let totalWeeklyHours = 0

    if (activeTrainerIds.length > 0) {
      const { data: templates, error: templatesError } = await supabaseAdmin
        .from('trainer_shift_templates')
        .select('trainer_id, start_time, end_time')
        .in('trainer_id', activeTrainerIds)

      if (templatesError) {
        console.error('Capacity: shift templates error', templatesError)
      }

      const hoursByTrainer = new Map<string, number>()
      for (const t of templates || []) {
        const [sh, sm] = String(t.start_time).split(':').map(Number)
        const [eh, em] = String(t.end_time).split(':').map(Number)
        const hours = (eh * 60 + em - (sh * 60 + sm)) / 60
        hoursByTrainer.set(t.trainer_id, (hoursByTrainer.get(t.trainer_id) || 0) + hours)
      }

      trainerWeeklyHours = (activeTrainers || []).map((t) => ({
        trainerId: t.id,
        fullName: t.full_name,
        weeklyHours: Math.round((hoursByTrainer.get(t.id) || 0) * 10) / 10,
      }))

      totalWeeklyHours = trainerWeeklyHours.reduce((sum, t) => sum + t.weeklyHours, 0)
    }

    // 導出値: 月間最大セッション数(週4.33換算) と 稼働率
    const WEEKS_PER_MONTH = 4.345
    const maxMonthlySessions = mostCommonDuration > 0
      ? Math.round((totalWeeklyHours * WEEKS_PER_MONTH) / (mostCommonDuration / 60))
      : 0
    const utilizationRate = maxMonthlySessions > 0 && monthlySessions != null
      ? Math.round((monthlySessions / maxMonthlySessions) * 1000) / 10
      : null

    // 月別推移: 各月の実セッション数と、現在のスタッフ体制を基準にした稼働率(参考値)
    const monthlyTrend = monthList.map((date) => {
      const key = format(date, 'yyyy-MM')
      const sessions = sessionCountByMonth.get(key) || 0
      const rate = maxMonthlySessions > 0 ? Math.round((sessions / maxMonthlySessions) * 1000) / 10 : null
      return { month: key, sessions, utilizationRate: rate }
    })

    return NextResponse.json({
      monthlySessions: monthlySessions ?? 0,
      durationBreakdown,
      mostCommonDuration,
      popularSlots,
      activeTrainerCount: activeTrainerIds.length,
      trainerWeeklyHours,
      totalWeeklyHours: Math.round(totalWeeklyHours * 10) / 10,
      maxMonthlySessions,
      utilizationRate,
      monthlyTrend,
      calculatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Capacity API error:', error)
    return createErrorResponse('稼働率データの取得に失敗しました', 500)
  }
}
