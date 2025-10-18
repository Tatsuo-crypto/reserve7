import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// 診断用エンドポイント - 問題が起きたらここで確認
export async function GET() {
  try {
    // Test database connection
    const { data: testQuery, error: dbError } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1)
    
    return NextResponse.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      },
      database: dbError ? `ERROR: ${dbError.message}` : 'Connected',
    })
  } catch (error) {
    return NextResponse.json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function DELETE() {
  return NextResponse.json({
    message: 'DELETE method works!',
    timestamp: new Date().toISOString(),
  })
}
