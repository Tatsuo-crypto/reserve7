import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Members API GET started ===')
    
    const user = await getAuthenticatedUser()
    console.log('User authenticated:', user ? 'Yes' : 'No', user?.email, user?.storeId)
    
    if (!user) {
      console.error('No user found')
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      console.error('User is not admin:', user.email)
      return createErrorResponse('管理者権限が必要です', 403)
    }

    // Check if requesting all stores (for sales page)
    const { searchParams } = new URL(request.url)
    const allStores = searchParams.get('all_stores') === 'true'
    console.log('All stores requested:', allStores)

    console.log('Building query...')
    console.log('User storeId for filtering:', user.storeId)
    console.log('All stores mode:', allStores)

    // Build base query
    const baseQuery = supabaseAdmin
      .from('users')
      .select(`
        id, 
        full_name, 
        email, 
        plan, 
        status, 
        store_id,
        monthly_fee,
        created_at, 
        memo, 
        access_token
      `)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')

    // Apply store filter if needed
    let query = allStores 
      ? baseQuery 
      : baseQuery.eq('store_id', user.storeId)

    console.log('Executing members query...')
    let { data: members, error } = await query.order('created_at', { ascending: false })
    
    // If no members found and not all stores mode, try with calendarId
    const calendarId = (user as any).calendarId
    if (!allStores && !error && (!members || members.length === 0) && calendarId && calendarId !== user.storeId) {
      console.log('No members with storeId, trying calendarId:', calendarId)
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

    console.log('Members fetched:', members?.length || 0)

    // Get stores separately with calendar_id
    console.log('Fetching stores...')
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, name, calendar_id')

    if (storesError) {
      console.error('Stores fetch error:', storesError)
      // Don't fail if stores can't be fetched, just log it
    }

    console.log('Stores data:', stores)
    console.log('Sample member store_id:', members?.[0]?.store_id)

    // Map stores to members using store UUID
    const membersWithStores = members?.map(member => ({
      ...member,
      stores: stores?.find(store => store.id === member.store_id) || null
    }))

    console.log('=== Members API GET completed successfully ===')
    return createSuccessResponse({ members: membersWithStores })
  } catch (error) {
    console.error('=== Members API CATCH ERROR ===')
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

    const { fullName, email, plan, status, memo, storeId, monthlyFee } = await request.json()

    // Validation
    if (!fullName || !email) {
      return createErrorResponse('名前とメールアドレスは必須です', 400)
    }

    if (!storeId) {
      return createErrorResponse('店舗の選択は必須です', 400)
    }

    // Validate status if provided
    if (status && !['active', 'suspended', 'withdrawn'].includes(status)) {
      return createErrorResponse('無効なステータスです', 400)
    }

    // Validate plan if provided
    const validPlans = ['月2回', '月4回', '月6回', '月8回', 'ダイエットコース', 'ダイエットコース【2ヶ月】', 'ダイエットコース【3ヶ月】', 'ダイエットコース【6ヶ月】', 'カウンセリング']
    if (plan && !validPlans.includes(plan)) {
      return createErrorResponse('無効なプランです', 400)
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return createErrorResponse('このメールアドレスは既に登録されています', 400)
    }

    const insertData = {
      full_name: fullName,
      email: email,
      password_hash: '', // トークンベース認証のためパスワードは不要
      plan: plan || '月4回',
      status: status || 'active',
      store_id: storeId,
      monthly_fee: monthlyFee ? parseInt(monthlyFee) : 0,
      memo: memo || null,
      role: 'CLIENT',
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
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? `会員の追加に失敗しました: ${error.message}`
        : '会員の追加に失敗しました'
      return createErrorResponse(errorMessage, 500)
    }

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

    const { memberId, fullName, email, storeId, status, plan, monthlyFee, memo } = await request.json()

    // Validate status if provided
    if (status && !['active', 'suspended', 'withdrawn'].includes(status)) {
      return createErrorResponse('Invalid status', 400)
    }

    // Validate plan if provided
    const validPlans = ['月2回', '月4回', '月6回', '月8回', 'ダイエットコース', 'ダイエットコース【2ヶ月】', 'ダイエットコース【3ヶ月】', 'ダイエットコース【6ヶ月】', 'カウンセリング']
    if (plan && !validPlans.includes(plan)) {
      return createErrorResponse('Invalid plan', 400)
    }

    // First check if the member exists
    const { data: member, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, store_id')
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
    if (storeId !== undefined) updateData.store_id = storeId
    if (status) updateData.status = status
    if (plan) updateData.plan = plan
    if (monthlyFee !== undefined) updateData.monthly_fee = monthlyFee ? parseInt(monthlyFee) : 0
    if (memo !== undefined) updateData.memo = memo

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
