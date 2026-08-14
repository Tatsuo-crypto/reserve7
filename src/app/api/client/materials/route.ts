import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { canViewMaterial, isMaterialPublicNow, resolveMemberViewer, toMaterialListItem, type SharedMaterialRow } from '@/lib/materials'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
  const viewer = await resolveMemberViewer(token)

  if (!viewer) {
    return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('shared_materials')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('client materials GET error:', error)
    return NextResponse.json({ materials: [] })
  }

  const materials = ((data || []) as SharedMaterialRow[])
    .filter(material => isMaterialPublicNow(material) && canViewMaterial(material, viewer))
    .slice(0, limit)
    .map(material => toMaterialListItem(material, `/api/materials/${material.id}/open?audience=member&token=${encodeURIComponent(token || '')}`))

  return NextResponse.json({ materials })
}
