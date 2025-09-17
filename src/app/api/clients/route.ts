import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    console.log('Clients API - UserEmail:', user.email, 'UserStoreId:', user.storeId)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (clientId) {
      // Get current month's reservation count for specific client in user's store
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

      const { data: reservations, error: reservationError } = await supabase
        .from('reservations')
        .select('id')
        .eq('client_id', clientId)
        .eq('calendar_id', user.storeId)
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())

      if (reservationError) {
        console.error('Database error:', reservationError)
        return NextResponse.json({ error: 'Failed to fetch reservation count' }, { status: 500 })
      }

      const reservationCount = reservations.length + 1 // +1 for the new reservation being created

      return NextResponse.json({ reservationCount })
    }

    // Get clients for the user's store (only active members)
    const { data: clients, error } = await supabase
      .from('users')
      .select('id, full_name, email, store_id, status')
      .eq('store_id', user.storeId)
      .eq('status', 'active')
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }


    // Format clients for dropdown
    const formattedClients = clients.map(client => ({
      id: client.id,
      name: client.full_name,
      email: client.email
    }))

    return createSuccessResponse({ clients: formattedClients })
  } catch (error) {
    console.error('Clients API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
