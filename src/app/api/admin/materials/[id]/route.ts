import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (typeof body.isPublished === 'boolean') updates.is_published = body.isPublished
  if (typeof body.displayOrder === 'number') updates.display_order = body.displayOrder

  const { error } = await supabaseAdmin
    .from('shared_materials')
    .update(updates)
    .eq('id', params.id)

  if (error) {
    console.error('admin materials PATCH error:', error)
    return NextResponse.json({ error: '資料を更新できませんでした' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  const { data: material } = await supabaseAdmin
    .from('shared_materials')
    .select('storage_bucket, storage_path')
    .eq('id', params.id)
    .maybeSingle()

  const { error } = await supabaseAdmin
    .from('shared_materials')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('admin materials DELETE error:', error)
    return NextResponse.json({ error: '資料を削除できませんでした' }, { status: 500 })
  }

  if (material?.storage_path) {
    await supabaseAdmin.storage
      .from(material.storage_bucket || 'shared-materials')
      .remove([material.storage_path])
  }

  return NextResponse.json({ success: true })
}
