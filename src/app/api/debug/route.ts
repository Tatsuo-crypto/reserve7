import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Get authenticated user
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return NextResponse.json({
        error: 'Not authenticated',
        user: null
      }, { status: 401 })
    }

    // 2. Check stores table
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .limit(5)
    
    // 3. Check users table with storeId
    const { data: usersByStoreId, error: usersError1 } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, store_id, status')
      .eq('store_id', user.storeId)
      .eq('status', 'active')
      .limit(5)
    
    // 4. Check users table with calendarId (if different)
    const calendarId = (user as any).calendarId
    let usersByCalendarId = null
    let usersError2 = null
    
    if (calendarId && calendarId !== user.storeId) {
      const result = await supabaseAdmin
        .from('users')
        .select('id, full_name, email, store_id, status')
        .eq('store_id', calendarId)
        .eq('status', 'active')
        .limit(5)
      
      usersByCalendarId = result.data
      usersError2 = result.error
    }
    
    // 5. Get all active users (to see what store_id values exist)
    const { data: allUsers, error: allUsersError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, store_id, status')
      .eq('status', 'active')
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .limit(10)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL ? 'vercel' : 'local',
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        storeId: user.storeId,
        calendarId: (user as any).calendarId
      },
      storesTable: {
        exists: !storesError,
        error: storesError?.message || null,
        count: stores?.length || 0,
        sample: stores?.[0] || null
      },
      usersByStoreId: {
        error: usersError1?.message || null,
        count: usersByStoreId?.length || 0,
        users: usersByStoreId || []
      },
      usersByCalendarId: calendarId !== user.storeId ? {
        calendarId,
        error: usersError2?.message || null,
        count: usersByCalendarId?.length || 0,
        users: usersByCalendarId || []
      } : null,
      allActiveUsers: {
        error: allUsersError?.message || null,
        count: allUsers?.length || 0,
        users: allUsers?.map(u => ({
          id: u.id,
          name: u.full_name,
          email: u.email,
          store_id: u.store_id,
          store_id_type: typeof u.store_id
        })) || []
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Debug API error',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
