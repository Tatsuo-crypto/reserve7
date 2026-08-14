import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/api-utils'
import {
  canViewMaterial,
  createStorageSignedUrl,
  isMaterialPublicNow,
  resolveMemberViewer,
  resolveTrainerViewer,
  type MaterialViewer,
  type SharedMaterialRow,
} from '@/lib/materials'

export const dynamic = 'force-dynamic'

async function resolveViewer(request: NextRequest): Promise<MaterialViewer | null> {
  const { searchParams } = new URL(request.url)
  const audience = searchParams.get('audience')
  const token = searchParams.get('token')

  if (audience === 'member') return resolveMemberViewer(token)
  if (audience === 'trainer') return resolveTrainerViewer(token)

  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return null
  return { audience: 'admin' }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const viewer = await resolveViewer(request)
  if (!viewer) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('shared_materials')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: '資料が見つかりません' }, { status: 404 })
  }

  const material = data as SharedMaterialRow
  const canAdminPreview = viewer.audience === 'admin'
  if (!canAdminPreview && (!isMaterialPublicNow(material) || !canViewMaterial(material, viewer))) {
    return NextResponse.json({ error: '資料を開く権限がありません' }, { status: 403 })
  }

  if (material.external_url) {
    return NextResponse.redirect(material.external_url)
  }

  const signedUrl = await createStorageSignedUrl(material)
  if (!signedUrl) {
    return NextResponse.json({ error: '資料を開けませんでした' }, { status: 500 })
  }

  return NextResponse.redirect(signedUrl)
}
