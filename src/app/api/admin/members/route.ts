import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { PLAN_LIST } from '@/lib/constants'
import { recordStatusChange } from '@/lib/membership-utils'
import { format } from 'date-fns'

type MembershipHistoryStatus = {
  user_id: string
  status: 'active' | 'suspended' | 'withdrawn'
  start_date: string
  end_date: string | null
  plan?: string | null
  monthly_fee?: number | null
}

function deriveCurrentStatus(member: any, histories: MembershipHistoryStatus[], today = format(new Date(), 'yyyy-MM-dd')) {
  const userHistories = histories.filter(history => history.start_date <= today)

  const latest = userHistories[0]
  if (!latest) return member.status || 'active'

  if (latest.status === 'withdrawn') return 'withdrawn'
  if (latest.status === 'active' && latest.end_date && latest.end_date < today) return 'withdrawn'
  if (latest.status === 'suspended' && latest.end_date && latest.end_date < today) return 'withdrawn'

  return latest.status || member.status || 'active'
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
      user = await getAuthenticatedUser()

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
    const compactMemberSelect = 'id, full_name, plan, status, store_id, created_at, lifestyle_settings!left(visible_tabs)'
    const fullMemberSelect = 'id, full_name, email, plan, status, store_id, monthly_fee, transfer_day, billing_start_month, created_at, memo, access_token, online_reminder_enabled, push_notification_enabled, birth_date, gender, height_cm, activity_level, target_weight_kg, lifestyle_settings!left(visible_tabs)'
    const memberSelect = compact ? compactMemberSelect : fullMemberSelect

    let baseQuery = supabaseAdmin
      .from('users')
      .select(memberSelect)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')

    // Filter by diet management if requested
    if (dietOnly) {
      // Members where visible_tabs->input is true
      // Note: We use !inner or filter manually after fetch if RLS/joins are complex
      // For now, let's fetch and filter in code or use a sub-query if possible
      // Actually, Supabase can filter on joined tables:
      baseQuery = baseQuery.not('lifestyle_settings', 'is', null)
    }

    // Apply store filter if needed
    let query = allStores
      ? baseQuery
      : baseQuery.eq('store_id', user.storeId)

    let { data: members, error } = await query.order('created_at', { ascending: false })

    // If dietOnly, further filter in JS to be safe with JSON nested fields
    if (dietOnly && members) {
      members = members.filter((m: any) => 
        m.lifestyle_settings && 
        m.lifestyle_settings.visible_tabs && 
        m.lifestyle_settings.visible_tabs.input === true
      )
    }

    // If no members found and not all stores mode, try with calendarId
    const calendarId = (user as any).calendarId
    if (!allStores && !error && (!members || members.length === 0) && calendarId && calendarId !== user.storeId) {
      const result = await baseQuery.eq('store_id', calendarId).order('created_at', { ascending: false })

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

    // Get stores separately with calendar_id
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, name, calendar_id')

    if (storesError) {
      console.error('Stores fetch error:', storesError)
      // Don't fail if stores can't be fetched, just log it
    }

    const memberRows = (members || []) as any[]
    const memberIds = memberRows.map(member => member.id)
    let membershipHistories: MembershipHistoryStatus[] = []

    if (memberIds.length > 0) {
      const { data: historyData, error: historyError } = await supabaseAdmin
        .from('membership_history')
        .select(compact ? 'user_id, status, start_date, end_date' : 'user_id, status, start_date, end_date, plan, monthly_fee')
        .in('user_id', memberIds)
        .order('start_date', { ascending: true })

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
      ...member,
      status: deriveCurrentStatus(member, historiesByUserId.get(member.id) || []),
      stores: storesById.get(member.store_id) || null
    }))

    return createSuccessResponse({ members: membersWithStores })
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

    const { fullName, email, googleCalendarEmail, plan, status, memo, storeId, monthlyFee, startMonth, registrationDate, onlineReminderEnabled, pushNotificationEnabled, birthDate, gender, heightCm, activityLevel, targetWeightKg } = await request.json()

    // Validation
    // 名前とメールアドレスは任意（空欄の場合はダミー値を設定）

    if (!storeId) {
      return createErrorResponse('店舗の選択は必須です', 400)
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
      plan: plan || '月4回',
      status: finalStatus,
      store_id: storeId,
      monthly_fee: monthlyFee ? parseInt(monthlyFee) : 0,
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

    // Record initial status in history
    await recordStatusChange(
      newMember.id,
      insertData.status as any,
      insertData.store_id,
      insertData.created_at,
      insertData.plan,
      insertData.monthly_fee
    ).catch(e => console.error('Failed to record initial status:', e))

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

    const { memberId, fullName, email, googleCalendarEmail, storeId, status, plan, monthlyFee, memo, statusChangeDate, changeDate, startMonth, registrationDate, onlineReminderEnabled, pushNotificationEnabled, birthDate, gender, heightCm, activityLevel, targetWeightKg } = await request.json()

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

    // Prepare update object
    const updateData: any = {}
    if (fullName !== undefined) updateData.full_name = fullName
    if (email !== undefined) updateData.email = email
    if (googleCalendarEmail !== undefined) updateData.google_calendar_email = googleCalendarEmail
    if (storeId !== undefined) updateData.store_id = storeId
    if (status) updateData.status = status
    if (plan) updateData.plan = plan
    if (monthlyFee !== undefined) updateData.monthly_fee = monthlyFee ? parseInt(monthlyFee) : 0
    if (startMonth !== undefined) updateData.billing_start_month = startMonth ? `${startMonth}-01` : null
    if (registrationDate !== undefined) updateData.created_at = registrationDate
    if (memo !== undefined) updateData.memo = memo
    if (onlineReminderEnabled !== undefined) updateData.online_reminder_enabled = onlineReminderEnabled
    if (pushNotificationEnabled !== undefined) updateData.push_notification_enabled = pushNotificationEnabled
    if (birthDate !== undefined) updateData.birth_date = birthDate || null
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

    // Record history if status, plan, or fee was updated
    const isStatusChanged = updateData.status && updateData.status !== member.status
    const isPlanChanged = updateData.plan && updateData.plan !== member.plan
    const isFeeChanged = updateData.monthly_fee !== undefined && updateData.monthly_fee !== member.monthly_fee

    if (isStatusChanged || isPlanChanged || isFeeChanged) {
      // Use provided changeDate/statusChangeDate or default to today
      const effectiveDateStr = changeDate || statusChangeDate
      const effectiveDate = effectiveDateStr ? new Date(effectiveDateStr) : new Date()

      // Determine values to record (new value or existing value)
      const statusToRecord = updateData.status || member.status
      const planToRecord = updateData.plan || member.plan
      const feeToRecord = updateData.monthly_fee !== undefined ? updateData.monthly_fee : member.monthly_fee
      const storeToRecord = updateData.store_id || member.store_id

      await recordStatusChange(
        memberId,
        statusToRecord,
        storeToRecord,
        effectiveDate,
        planToRecord,
        feeToRecord
      ).catch(e => console.error('Failed to record history change:', e))
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
