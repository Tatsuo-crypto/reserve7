import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth-config'
import { getStoreDisplayName, getUserStoreId, isAdmin } from '@/lib/auth-utils'
import { PLAN_LIST } from '@/lib/constants'
import { applyCurrentMembership } from '@/lib/membership-utils'
import { japanDate } from '@/lib/membership-ledger'

type MembershipHistoryStatus = {
  user_id: string
  status: 'active' | 'suspended' | 'withdrawn'
  start_date: string
  end_date: string | null
  plan?: string | null
  monthly_fee?: number | null
}

async function runSupabaseQuery<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  attempts = 2,
  timeoutMs = 2500
): Promise<T> {
  let lastResult: any

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      lastResult = await operation(controller.signal)
    } catch (error) {
      lastResult = { error }
    } finally {
      clearTimeout(timeoutId)
    }

    const message = lastResult?.error?.message || ''

    const shouldRetry = message.includes('fetch failed') || message.includes('aborted')
    if (!shouldRetry || attempt === attempts) {
      return lastResult
    }

    await new Promise(resolve => setTimeout(resolve, 250 * attempt))
  }

  return lastResult
}

function isUuid(value: string | undefined | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function getFastAdminListUser() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()

  if (!email) {
    return null
  }

  if (!isAdmin(email)) {
    return null
  }

  const preferredStoreId = cookies().get('admin_store_preference')?.value
  const storeId = isUuid(preferredStoreId) ? preferredStoreId : getUserStoreId(email)

  return {
    id: email,
    email,
    name: session.user.name || '',
    isAdmin: true,
    storeId,
    calendarId: email === 'tandjgym@gmail.com' ? 'tandjgym@gmail.com' : 'tandjgym2goutenn@gmail.com',
  }
}

export async function GET(request: NextRequest) {
  try {
    let user = null
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token) {
      // Trainer token authentication
      const { data: trainer, error } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (error || !trainer) {
        return createErrorResponse('無効なトークンです', 401)
      }

      user = {
        id: trainer.id,
        email: trainer.email,
        name: trainer.full_name,
        isAdmin: false,
        isTrainer: true,
        storeId: trainer.store_id
      }
    } else {
      // Session authentication
      const compact = searchParams.get('compact') === 'true'
      const allStores = searchParams.get('all_stores') === 'true'
      user = compact && !allStores ? await getFastAdminListUser() : null
      if (!user) {
        user = await getAuthenticatedUser()
      }

      if (!user) {
        console.error('No user found')
        return createErrorResponse('認証が必要です', 401)
      }

      if (!user.isAdmin) {
        console.error('User is not admin:', user.email)
        return createErrorResponse('管理者権限が必要です', 403)
      }
    }

    // Check if requesting all stores (for sales page)
    const allStores = searchParams.get('all_stores') === 'true'
    const dietOnly = searchParams.get('diet_only') === 'true'
    const compact = searchParams.get('compact') === 'true'

    // Build base query
    const listCompactMemberSelect = 'id, full_name, plan, status, store_id, created_at, billing_start_month'
    const dietCompactMemberSelect = 'id, full_name, plan, status, store_id, created_at, lifestyle_settings!left(visible_tabs)'
    const fullMemberSelect = 'id, full_name, email, plan, status, store_id, shared_calendar_store_ids, monthly_fee, transfer_day, billing_start_month, created_at, memo, access_token, online_reminder_enabled, push_notification_enabled, birth_date, age, gender, height_cm, activity_level, target_weight_kg, lifestyle_settings!left(visible_tabs)'
    const memberSelect = compact ? (dietOnly ? dietCompactMemberSelect : listCompactMemberSelect) : fullMemberSelect

    const buildMembersQuery = (storeId?: string) => {
      let query = supabaseAdmin
        .from('users')
        .select(memberSelect)
        .neq('email', 'tandjgym@gmail.com')
        .neq('email', 'tandjgym2goutenn@gmail.com')

      if (dietOnly) {
        query = query.not('lifestyle_settings', 'is', null)
      }

      if (storeId) {
        query = query.eq('store_id', storeId)
      }

      return query.order('created_at', { ascending: false })
    }

    // 通常の店舗画面では所属会員に加えて、会員ごとに共有設定された会員だけを表示する。
    let { data: members, error } = await runSupabaseQuery((signal) =>
      (allStores ? buildMembersQuery() : buildMembersQuery(user.storeId)).abortSignal(signal)
    )

    if (!allStores && !error && user.storeId) {
      const sharedResult = await runSupabaseQuery((signal) =>
        supabaseAdmin
          .from('users')
          .select(memberSelect)
          .neq('email', 'tandjgym@gmail.com')
          .neq('email', 'tandjgym2goutenn@gmail.com')
          .contains('shared_calendar_store_ids', [user.storeId])
          .order('created_at', { ascending: false })
          .abortSignal(signal)
      )
      if (!sharedResult.error) {
        const byId = new Map<string, any>()
        for (const member of [...((members as any[]) || []), ...((sharedResult.data as any[]) || [])]) byId.set(member.id, member)
        members = Array.from(byId.values())
      }
    }

    // If dietOnly, further filter in JS to be safe with JSON nested fields
    if (dietOnly && members) {
      members = (members as any[]).filter((m: any) =>
        m.lifestyle_settings && 
        m.lifestyle_settings.visible_tabs && 
        m.lifestyle_settings.visible_tabs.input === true
      )
    }

    // If no members found and not all stores mode, try with calendarId
    const calendarId = (user as any).calendarId
    if (!allStores && !error && (!members || members.length === 0) && calendarId && calendarId !== user.storeId) {
      const result = await runSupabaseQuery((signal) => buildMembersQuery(calendarId).abortSignal(signal))

      if (!result.error && result.data && result.data.length > 0) {
        members = result.data
        error = result.error
      }
    }

    if (error) {
      console.error('=== DATABASE ERROR ===')
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Full error:', JSON.stringify(error, null, 2))
      return createErrorResponse(`Failed to fetch members: ${error.message}`, 500)
    }

    let stores: any[] = []
    if (compact && !allStores) {
      stores = [{
        id: user.storeId,
        name: getStoreDisplayName(user.storeId),
        calendar_id: (user as any).calendarId,
      }]
    } else {
      const { data: storesData, error: storesError } = await supabaseAdmin
        .from('stores')
        .select('id, name, calendar_id')

      if (storesError) {
        console.error('Stores fetch error:', storesError)
        // Don't fail if stores can't be fetched, just log it
      }
      stores = storesData || []
    }

    const memberRows = (members || []) as any[]
    const memberIds = memberRows.map(member => member.id)
    let membershipHistories: MembershipHistoryStatus[] = []
    const today = japanDate()

    if (memberIds.length > 0) {
      const { data: historyData, error: historyError } = await runSupabaseQuery((signal) =>
        supabaseAdmin
          .from('membership_history')
          .select('user_id, status, start_date, end_date, plan, monthly_fee')
          .in('user_id', memberIds)
          .lte('start_date', today)
          .order('start_date', { ascending: false })
          .abortSignal(signal)
      )

      if (historyError) {
        console.error('Membership history fetch error:', historyError)
      } else {
        membershipHistories = (historyData || []) as unknown as MembershipHistoryStatus[]
      }
    }

    const storesById = new Map((stores || []).map(store => [store.id, store]))
    const historiesByUserId = new Map<string, MembershipHistoryStatus[]>()
    for (const history of membershipHistories) {
      const current = historiesByUserId.get(history.user_id) || []
      current.push(history)
      historiesByUserId.set(history.user_id, current)
    }
    Array.from(historiesByUserId.values()).forEach((userHistories: MembershipHistoryStatus[]) => {
      userHistories.sort((a: MembershipHistoryStatus, b: MembershipHistoryStatus) => b.start_date.localeCompare(a.start_date))
    })

    // Map stores to members using store UUID and derive current status from history.
    const membersWithStores = memberRows.map(member => ({
      ...applyCurrentMembership(member, historiesByUserId.get(member.id) || [], today),
      stores: storesById.get(member.store_id) || null
    }))

    return createSuccessResponse({ members: membersWithStores, stores })
  } catch (error) {
    console.error('Error:', error)
    console.error('Error message:', (error as Error)?.message)
    console.error('Error stack:', (error as Error)?.stack)
    console.error('Error name:', (error as Error)?.name)

    // Return detailed error in development
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        message: (error as Error)?.message,
        stack: (error as Error)?.stack
      } : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { fullName, email, googleCalendarEmail, plan, status, memo, storeId, monthlyFee, startMonth, registrationDate, onlineReminderEnabled, pushNotificationEnabled, birthDate, gender, heightCm, activityLevel, targetWeightKg, allowDuplicateName } = await request.json()

    // Validation
    // 名前とメールアドレスは任意（空欄の場合はダミー値を設定）

    if (!storeId) {
      return createErrorResponse('店舗の選択は必須です', 400)
    }

    const fee = monthlyFee === undefined || monthlyFee === null || monthlyFee === '' ? (plan ? null : 0) : Number(monthlyFee)
    if (fee === null || !Number.isInteger(fee) || fee < 0 || fee > 2147483647) {
      return createErrorResponse('月額費用を0以上の整数で入力してください', 400)
    }
    if (fullName && !allowDuplicateName) {
      const { data: candidates, error: candidateError } = await supabaseAdmin.from('users')
        .select('id, full_name, status').eq('store_id', storeId).neq('role', 'ADMIN')
      if (candidateError) throw candidateError
      const name = fullName.normalize('NFKC').replace(/\s/g, '')
      const duplicates = (candidates || []).filter(candidate => candidate.full_name?.normalize('NFKC').replace(/\s/g, '') === name)
      if (duplicates.length) return NextResponse.json({ error: '同じ氏名の会員が登録されています。復帰の場合は既存の会員から設定してください。', duplicates }, { status: 409 })
    }


    // Validate status if provided
    if (status && !['active', 'suspended', 'withdrawn'].includes(status)) {
      return createErrorResponse('無効なステータスです', 400)
    }

    // Validate plan if provided
    // @ts-ignore
    const validPlans = [...PLAN_LIST]
    if (plan && !validPlans.includes(plan)) {
      return createErrorResponse('Invalid plan', 400)
    }

    // Check if email already exists (only if email is provided)
    if (email) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (existingUser) {
        return createErrorResponse('このメールアドレスは既に登録されています', 400)
      }
    }

    // Generate dummy email if not provided
    const finalEmail = email || `no-email-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
    // Set default name if not provided
    const finalFullName = fullName || '氏名未設定'
    const finalStatus = status || 'active'

    const insertData = {
      full_name: finalFullName,
      email: finalEmail,
      google_calendar_email: googleCalendarEmail || null,
      password_hash: '', // トークンベース認証のためパスワードは不要
      plan: plan || null,
      status: finalStatus,
      store_id: storeId,
      monthly_fee: fee,
      billing_start_month: startMonth ? `${startMonth}-01` : null,
      created_at: registrationDate || new Date().toISOString(),
      memo: memo || null,
      role: 'CLIENT',
      online_reminder_enabled: onlineReminderEnabled === true,
      push_notification_enabled: pushNotificationEnabled === true,
      birth_date: birthDate || null,
      gender: gender || null,
      height_cm: heightCm ? Number(heightCm) : null,
      activity_level: activityLevel ? Number(activityLevel) : null,
      target_weight_kg: targetWeightKg ? Number(targetWeightKg) : null,
      // access_tokenはSupabaseがUUIDで自動生成
    }

    console.log('Inserting member with data:', {
      ...insertData,
      access_token: '█████' // トークンはマスク
    })

    // Create new member
    const { data: newMember, error } = await supabaseAdmin
      .from('users')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      // 開発環境では詳細なエラーを返す
      const errorMessage = `会員の追加に失敗しました: ${error.message}`
      return createErrorResponse(errorMessage, 500)
    }

    // The database inserts the initial contract in the same transaction.
    return createSuccessResponse({ member: newMember })
  } catch (error) {
    console.error('Members API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error message:', errorMessage)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Internal server error: ${errorMessage}`
        : 'Internal server error',
      500
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { memberId, fullName, email, googleCalendarEmail, storeId, sharedCalendarStoreIds, status, plan, monthlyFee, memo, statusChangeDate, changeDate, startMonth, registrationDate, onlineReminderEnabled, pushNotificationEnabled, birthDate, age, gender, heightCm, activityLevel, targetWeightKg } = await request.json()

    // Validate status if provided
    if (status && !['active', 'suspended', 'withdrawn'].includes(status)) {
      return createErrorResponse('Invalid status', 400)
    }


    // Validate plan if provided
    // @ts-ignore
    const validPlans = [...PLAN_LIST]
    if (plan && !validPlans.includes(plan)) {
      return createErrorResponse('Invalid plan', 400)
    }

    // First check if the member exists
    const { data: member, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, store_id, status, plan, monthly_fee, transfer_day, billing_start_month, online_reminder_enabled, push_notification_enabled')
      .eq('id', memberId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .single()

    if (fetchError || !member) {
      return createErrorResponse('Member not found or access denied', 404)
    }

    const contractChanged =
      (plan !== undefined && plan !== member.plan) ||
      (monthlyFee !== undefined && Number(monthlyFee) !== member.monthly_fee) ||
      (status !== undefined && status !== member.status)
    if (contractChanged) {
      return createErrorResponse('プラン・料金・休会・復帰は月額プラン履歴から変更してください', 400)
    }
    if (startMonth !== undefined && (startMonth ? `${startMonth}-01` : null) !== member.billing_start_month) {
      return createErrorResponse('開始月は過去の契約に影響するため、この画面では変更できません。月額プラン履歴から対象月を設定してください', 400)
    }

    // Prepare update object
    const updateData: any = {}
    if (fullName !== undefined) updateData.full_name = fullName
    if (email !== undefined) updateData.email = email
    if (googleCalendarEmail !== undefined) updateData.google_calendar_email = googleCalendarEmail
    if (storeId !== undefined) updateData.store_id = storeId
    if (sharedCalendarStoreIds !== undefined) {
      updateData.shared_calendar_store_ids = Array.isArray(sharedCalendarStoreIds)
        ? sharedCalendarStoreIds.filter((value: unknown): value is string => typeof value === 'string')
        : []
    }
    if (startMonth !== undefined) updateData.billing_start_month = startMonth ? `${startMonth}-01` : null
    if (registrationDate !== undefined) updateData.created_at = registrationDate
    if (memo !== undefined) updateData.memo = memo
    if (onlineReminderEnabled !== undefined) updateData.online_reminder_enabled = onlineReminderEnabled
    if (pushNotificationEnabled !== undefined) updateData.push_notification_enabled = pushNotificationEnabled
    if (birthDate !== undefined) updateData.birth_date = birthDate || null
    if (age !== undefined) updateData.age = age === '' || age === null ? null : Number(age)
    if (gender !== undefined) updateData.gender = gender || null
    if (heightCm !== undefined) updateData.height_cm = heightCm ? Number(heightCm) : null
    if (activityLevel !== undefined) updateData.activity_level = activityLevel ? Number(activityLevel) : null
    if (targetWeightKg !== undefined) updateData.target_weight_kg = targetWeightKg ? Number(targetWeightKg) : null

    // Update member
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', memberId)
      .select()

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to update member', 500)
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    console.error('Members API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { memberId } = await request.json()

    // First check if the member exists and belongs to the same store
    const { data: member, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, store_id')
      .eq('id', memberId)
      .eq('store_id', user.storeId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .single()

    if (fetchError || !member) {
      return createErrorResponse('Member not found or access denied', 404)
    }

    // Delete member's reservations first
    const { error: reservationsError } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('user_id', memberId)

    if (reservationsError) {
      console.error('Failed to delete member reservations:', reservationsError)
      return createErrorResponse('Failed to delete member reservations', 500)
    }

    // Delete member
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('Database error:', deleteError)
      return createErrorResponse('Failed to delete member', 500)
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    console.error('Members API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
