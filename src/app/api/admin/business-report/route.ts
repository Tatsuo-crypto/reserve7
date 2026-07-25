import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse } from '@/lib/api-utils'
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, endOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

type HistoryRow = {
  user_id: string
  store_id: string | null
  status: string
  start_date: string
  end_date: string | null
  plan: string | null
  monthly_fee: number | null
}

// AI-1: オーナーからの経営相談リスト(最優先5項目+第2優先の一部)に、アプリのデータだけで
// 答えられる範囲で回答するための集計API。GBPインサイト・広告管理画面・現預金・固定費など
// アプリ外のデータが必要な項目はここには含まれない(チャット側で別途案内)。
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.isAdmin) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { data: stores } = await supabaseAdmin.from('stores').select('id, name')
    const storeNameById = new Map((stores || []).map((s: any) => [s.id, s.name]))

    // 1. 会員の在籍履歴(全期間、全店舗) — 月末会員数・入会・退会の判定に使う
    const { data: historyData, error: historyError } = await supabaseAdmin
      .from('membership_history')
      .select('user_id, store_id, status, start_date, end_date, plan, monthly_fee')
      .order('start_date', { ascending: true })
      .limit(100000)

    if (historyError) {
      console.error('BusinessReport: membership_history error', historyError)
      return createErrorResponse('在籍履歴の取得に失敗しました', 500)
    }
    const history = (historyData || []) as HistoryRow[]

    // 2. 会員の来店経路(カウンセリング情報) — 入会経路の内訳に使う
    const { data: settingsRows } = await supabaseAdmin
      .from('lifestyle_settings')
      .select('user_id, habit_targets')
    const routeByUserId = new Map<string, string>()
    for (const row of settingsRows || []) {
      const route = (row.habit_targets as any)?.counseling_profile?.route
      if (route) routeByUserId.set(row.user_id, route)
    }

    // 3. 現会員(在籍中)一覧
    const { data: activeUsers, error: activeUsersError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, plan, monthly_fee, store_id, created_at')
      .eq('status', 'active')

    if (activeUsersError) {
      console.error('BusinessReport: active users error', activeUsersError)
    }

    // --- 過去6ヶ月(直近の完了月まで)の月末会員数・入会・退会を集計 ---
    const today = new Date()
    const rangeEnd = startOfMonth(today) // 今月分は月末を迎えていないため、直近6"完了"月は前月まで
    const rangeStart = subMonths(rangeEnd, 6)
    const monthList = eachMonthOfInterval({ start: rangeStart, end: subMonths(rangeEnd, 1) })

    const monthly = monthList.map((date) => {
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)

      // 月末時点で在籍中(status=active, start<=monthEnd<=end_date or end_date null)
      const activeRecords = history.filter((h) => {
        if (h.status !== 'active') return false
        const start = new Date(h.start_date)
        const end = h.end_date ? endOfDay(new Date(h.end_date)) : null
        return start <= monthEnd && (!end || end >= monthEnd)
      })
      const activeEnd = new Set(activeRecords.map((h) => h.user_id)).size

      // その月に新規で始まった在籍(直前32日以内に別記録の終了がある場合はプラン変更/更新とみなし除外)
      const newRecordsRaw = history.filter((h) => {
        if (h.status !== 'active') return false
        const start = new Date(h.start_date)
        if (start < monthStart || start > monthEnd) return false

        const isContinuation = history.some((prev) => {
          if (prev.user_id !== h.user_id || prev === h) return false
          if (!prev.end_date) return false
          const diffDays = Math.abs((start.getTime() - new Date(prev.end_date).getTime()) / (1000 * 60 * 60 * 24))
          return diffDays <= 32
        })
        return !isContinuation
      })
      const newByUser = new Map(newRecordsRaw.map((h) => [h.user_id, h]))

      // その月に本当に辞めた(在籍記録が終了し、32日以内の再開がない)
      const withdrawnRaw = history.filter((h) => {
        if (h.status !== 'active' || !h.end_date) return false
        const end = endOfDay(new Date(h.end_date))
        if (end < monthStart || end > monthEnd) return false

        const isContinued = history.some((next) => {
          if (next.user_id !== h.user_id || next === h) return false
          if (next.status !== 'active' && next.status !== 'suspended') return false
          const diffDays = Math.abs((new Date(next.start_date).getTime() - end.getTime()) / (1000 * 60 * 60 * 24))
          return diffDays <= 32
        })
        return !isContinued
      })
      const withdrawnByUser = new Map(withdrawnRaw.map((h) => [h.user_id, h]))

      const newByRouteMap = new Map<string, number>()
      for (const userId of Array.from(newByUser.keys())) {
        const route = routeByUserId.get(userId) || '未入力'
        newByRouteMap.set(route, (newByRouteMap.get(route) || 0) + 1)
      }

      return {
        month: format(date, 'yyyy-MM'),
        activeEnd,
        newCount: newByUser.size,
        newByRoute: Array.from(newByRouteMap.entries()).map(([route, count]) => ({ route, count })),
        withdrawnCount: withdrawnByUser.size,
      }
    })

    // --- 現会員の入会日リスト(最初の在籍開始日) ---
    const firstStartByUser = new Map<string, string>()
    for (const h of history) {
      if (h.status !== 'active') continue
      const existing = firstStartByUser.get(h.user_id)
      if (!existing || new Date(h.start_date) < new Date(existing)) {
        firstStartByUser.set(h.user_id, h.start_date)
      }
    }

    const currentMembers = (activeUsers || [])
      .map((u: any) => ({
        id: u.id,
        name: u.full_name,
        plan: u.plan,
        monthlyFee: u.monthly_fee,
        storeName: storeNameById.get(u.store_id) || u.store_id,
        joinDate: firstStartByUser.get(u.id) || (u.created_at ? u.created_at.slice(0, 10) : null),
      }))
      .sort((a: any, b: any) => (a.joinDate || '').localeCompare(b.joinDate || ''))

    // --- プラン内訳 ---
    const planCountMap = new Map<string, number>()
    for (const u of activeUsers || []) {
      const plan = (u as any).plan || '不明'
      planCountMap.set(plan, (planCountMap.get(plan) || 0) + 1)
    }
    const planBreakdown = Array.from(planCountMap.entries()).map(([plan, count]) => ({ plan, count }))

    // --- 現構成での月額会費合計(会費のみの理論値。旗艦・体験料等は含まれない) ---
    const activeMonthlyFeeSum = (activeUsers || []).reduce((sum: number, u: any) => sum + (u.monthly_fee || 0), 0)

    // --- salesテーブル(type=monthly_fee)の当月実績合計。実際の入金記録があれば理論値との差分の目安になる ---
    const thisMonthStr = format(today, 'yyyy-MM')
    const { data: salesRows } = await supabaseAdmin
      .from('sales')
      .select('amount, target_date, type')
      .eq('type', 'monthly_fee')
      .gte('target_date', `${thisMonthStr}-01`)
      .lt('target_date', format(startOfMonth(subMonths(today, -1)), 'yyyy-MM-dd'))
    const salesTableThisMonth = (salesRows || []).reduce((sum: number, s: any) => sum + (s.amount || 0), 0)

    // --- 体験予約数(過去6ヶ月、タイトルに「体験」を含む予約) ---
    const sixMonthsAgoIso = subMonths(today, 6).toISOString()
    const { data: trialReservations } = await supabaseAdmin
      .from('reservations')
      .select('id, start_time, title')
      .ilike('title', '体験%')
      .gte('start_time', sixMonthsAgoIso)

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      stores: stores || [],
      monthly,
      currentMembers,
      planBreakdown,
      revenue: {
        activeMemberCount: (activeUsers || []).length,
        activeMonthlyFeeSum,
        salesTableThisMonth,
      },
      trial: {
        periodMonths: 6,
        count: (trialReservations || []).length,
      },
    })
  } catch (error) {
    console.error('BusinessReport API error:', error)
    return createErrorResponse('経営レポートの取得に失敗しました', 500)
  }
}
