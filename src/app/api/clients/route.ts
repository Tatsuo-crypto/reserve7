import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabase } from '@/lib/supabase'
import { getUserStoreId } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    console.log('Clients API - Session:', session)
    
    if (!session?.user?.email) {
      console.log('No session or email found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    if (session.user.role !== 'ADMIN') {
      console.log('User is not admin:', session.user.role)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const userStoreId = getUserStoreId(session.user.email!)
    console.log('Clients API - UserEmail:', session.user.email, 'UserStoreId:', userStoreId)

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
        .eq('calendar_id', userStoreId)
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())

      if (reservationError) {
        console.error('Database error:', reservationError)
        return NextResponse.json({ error: 'Failed to fetch reservation count' }, { status: 500 })
      }

      const reservationCount = reservations.length + 1 // +1 for the new reservation being created

      return NextResponse.json({ reservationCount })
    }

    // Get clients for the user's store
    const { data: clients, error } = await supabase
      .from('users')
      .select('id, full_name, email, store_id')
      .eq('store_id', userStoreId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }


    // Format clients for dropdown display
    const formattedClients = clients.map(client => ({
      id: client.id,
      name: client.full_name,
      email: client.email,
      displayName: `${client.full_name} (${client.email})`
    }))

    return NextResponse.json({ clients: formattedClients })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
