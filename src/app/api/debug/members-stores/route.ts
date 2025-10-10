import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get all members
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, full_name, email, store_id')
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')

    if (membersError) throw membersError

    // Get all stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name')

    if (storesError) throw storesError

    return NextResponse.json({
      members: members || [],
      stores: stores || [],
      summary: {
        totalMembers: members?.length || 0,
        totalStores: stores?.length || 0,
        membersGroupedByStore: members?.reduce((acc: any, m: any) => {
          const storeId = m.store_id || 'no_store'
          acc[storeId] = (acc[storeId] || 0) + 1
          return acc
        }, {})
      }
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
