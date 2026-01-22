import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .select('google_calendar_email')
      .limit(1)

    if (error) {
      return NextResponse.json({ 
        exists: false, 
        error: error.message 
      }, { status: 200 })
    }

    return NextResponse.json({ 
      exists: true, 
      message: 'google_calendar_email column exists' 
    }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ 
      exists: false, 
      error: String(err) 
    }, { status: 500 })
  }
}
