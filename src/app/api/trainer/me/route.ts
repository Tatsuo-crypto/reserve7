import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer, error } = await supabaseAdmin
      .from('trainers')
      .select('access_token, full_name, store_id')
      .eq('email', session.user.email)
      .eq('status', 'active')
      .single()

    if (error || !trainer) {
      console.error('Trainer lookup error:', error)
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    return NextResponse.json({
      token: trainer.access_token,
      name: trainer.full_name,
      storeId: trainer.store_id
    })
  } catch (error) {
    console.error('Trainer/me error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
