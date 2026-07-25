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

// AI-3: 「現会員」の判定は users.status を直接見るのではなく、/api/admin/members と同じ
// deriveCurrentStatus(membership_historyの最新レコードから真の在籍状態を導出する)ロジックに
// 合わせる。users.status は退会時に更新され忘れているケースがあり、直接見ると退会済み会員が
// 「在籍中」として混ざってしまう不具合があった(オーナー実機フィードバックで発覚)。
function deriveCurrentStatus(
  rawStatus: string | null | undefined,
  histories: { status: string; start_date: string; end_date: string | null }[],
  today: string
): string {
  const latest = histories
    .filter((h) => h.start_date <= today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]

  if (!latest) return rawStatus || 'active'
  if (latest.status === 'withdrawn') return 'withdrawn'
  if (latest.status === 'active' && latest.end_date && latest.end_date < today) return 'withdrawn'
  if (latest.status === 'suspended' && latest.end_date && latest.end_date < today) return 'withdrawn'

  return latest.status || rawStatus || 'active'
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

    // 3. 全会員(在籍中/休会/退会を問わず取得し、deriveCurrentStatusで真の在籍状態を判定する)。
    // 管理者ログイン用の2アカウント(店舗代表メール)は会員ではないので除外する。
    const { data: allUsers, error: allUsersError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, plan, monthly_fee, store_id, created_at, status')
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')

    if (allUsersError) {
      console.error('BusinessReport: users error', allUsersError)
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const historiesByUserId = new Map<string, HistoryRow[]>()
    for (const h of history) {
      const list = historiesByUserId.get(h.user_id) || []
      list.push(h)
      historiesByUserId.set(h.user_id, list)
    }

    const activeUsers = (allUsers || []).filter((u: any) => {
      const derived = deriveCurrentStatus(u.status, historiesByUserId.get(u.id) || [], todayStr)
      return derived === 'active'
    })

    // AK-2: membership_history.plan が空のレコードがある(履歴作成時にplanを保存していなかった/
    // 後からplanカラムを追加したが過去データが未補完、等が原因と判明)。アプリの会員詳細画面に
    // 表示される「月額プラン」はusers.plan なので、history側のplanが空の場合はusers.plan側の値に
    // フォールバックし、アプリで見える値と集計・表示を一致させる。
    const userPlanById = new Map<string, string | null>((allUsers || []).map((u: any) => [u.id, u.plan ?? null]))
    const effectivePlan = (h: HistoryRow): string | null => h.plan || userPlanById.get(h.user_id) || null

    // AK-1: 月末会員数を「いずれかのレコードが月末をカバーしているか」というOR判定ではなく、
    // 「その時点までの最新レコード1件」だけで判定するように変更。従来のOR判定だと、
    // 退会済み(end_dateで終了済み)の正しいレコードの他に古い/重複したactiveレコードが
    // 残っていた場合、そちらが独立してヒットしてしまい、とっくに退会している会員が
    // 後の月の会員数に数え続けられてしまう不具合があった(オーナー実機フィードバックで発覚)。
    const resolveMembershipAsOf = (userId: string, asOf: string): HistoryRow | null => {
      const rows = (historiesByUserId.get(userId) || []).filter((h) => h.start_date <= asOf)
      if (rows.length === 0) return null
      return rows.sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    }
    const isActiveAsOf = (userId: string, asOf: string): boolean => {
      const latest = resolveMembershipAsOf(userId, asOf)
      if (!latest) return false
      if (latest.status !== 'active') return false
      if (effectivePlan(latest) === '都度') return false
      if (latest.end_date && latest.end_date < asOf) return false
      return true
    }

    // --- 過去6ヶ月(直近の完了月まで)の月末会員数・入会・退会を集計 ---
    const today = new Date()
    const rangeEnd = startOfMonth(today) // 今月分は月末を迎えていないため、直近6"完了"月は前月まで
    const rangeStart = subMonths(rangeEnd, 6)
    const monthList = eachMonthOfInterval({ start: rangeStart, end: subMonths(rangeEnd, 1) })

    const monthly = monthList.map((date) => {
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

      // 月末時点で在籍中かどうかは、そのユーザーの最新レコード1件だけで判定する
      const activeEnd = Array.from(historiesByUserId.keys()).filter((userId) =>
        isActiveAsOf(userId, monthEndStr)
      ).length

      // その月に新規で始まった在籍(直前32日以内に別記録の終了がある場合はプラン変更/更新とみなし除外)
      const newRecordsRaw = history.filter((h) => {
        if (h.status !== 'active') return false
        if (effectivePlan(h) === '都度') return false
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
        if (effectivePlan(h) === '都度') return false
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

    // AJ-3: 「現会員」の人数・リスト・月額会費合計には都度(プラン)の人を含めない。
    // ただしプラン別内訳は都度も1つのプランとして表示したいので、そちらは全員(都度含む)を対象にする。
    const countedMembers = (activeUsers || []).filter((u: any) => u.plan !== '都度')

    const currentMembers = countedMembers
      .map((u: any) => ({
        id: u.id,
        name: u.full_name,
        plan: u.plan,
        monthlyFee: u.monthly_fee,
        storeName: storeNameById.get(u.store_id) || u.store_id,
        joinDate: firstStartByUser.get(u.id) || (u.created_at ? u.created_at.slice(0, 10) : null),
      }))
      .sort((a: any, b: any) => (a.joinDate || '').localeCompare(b.joinDate || ''))

    // --- プラン内訳(都度も1つのプランとして表示) ---
    const planCountMap = new Map<string, number>()
    for (const u of activeUsers || []) {
      const plan = (u as any).plan || '不明'
      planCountMap.set(plan, (planCountMap.get(plan) || 0) + 1)
    }
    const planBreakdown = Array.from(planCountMap.entries()).map(([plan, count]) => ({ plan, count }))

    // --- 現構成での月額会費合計(会費のみの理論値。旗艦・体験料等は含まれない。都度は除く) ---
    const activeMonthlyFeeSum = countedMembers.reduce((sum: number, u: any) => sum + (u.monthly_fee || 0), 0)

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
        activeMemberCount: countedMembers.length,
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
