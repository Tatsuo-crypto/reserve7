import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/api-utils'
import { updateAllTitles } from '@/lib/title-utils'

export const dynamic = 'force-dynamic'

/**
 * Refresh all reservation titles for a specific client
 * Useful after changing title generation logic
 */
export async function POST(request: Request) {
  try {
    // Check admin authentication
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { clientId } = body

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    // Get client name for response
    const { data: client } = await supabaseAdmin
      .from('users')
      .select('full_name, plan')
      .eq('id', clientId)
      .single()

    // Update all titles for this client
    const success = await updateAllTitles(clientId)

    if (success) {
      return NextResponse.json({
        message: `${client?.full_name || 'Client'}の予約タイトルを更新しました`,
        plan: client?.plan,
      })
    } else {
      return NextResponse.json(
        { error: 'タイトルの更新に失敗しました' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Refresh titles error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
