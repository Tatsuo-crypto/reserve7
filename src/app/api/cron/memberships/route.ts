import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data, error } = await supabaseAdmin.rpc('sync_all_member_contract_snapshots')
  if (error) return NextResponse.json({ error: '契約の同期に失敗しました' }, { status: 500 })
  return NextResponse.json({ synced: data })
}
