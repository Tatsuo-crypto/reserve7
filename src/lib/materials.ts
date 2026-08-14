import { supabaseAdmin } from '@/lib/supabase'

export type MaterialAudience = 'member' | 'trainer' | 'admin'

export type MaterialGroup = 'all_members' | 'normal_members' | 'diet_members' | 'admins' | 'trainers'

export type SharedMaterialRow = {
  id: string
  title: string
  description: string | null
  material_type: 'pdf' | 'image' | 'video' | 'link'
  external_url: string | null
  storage_bucket: string | null
  storage_path: string | null
  is_published: boolean
  publish_start_at: string | null
  publish_end_at: string | null
  display_order: number
  target_groups: MaterialGroup[] | null
  target_user_ids: string[] | null
  target_trainer_ids: string[] | null
  created_at: string
  updated_at: string | null
}

export type MaterialViewer = {
  audience: MaterialAudience
  id?: string | null
  isDiet?: boolean
}

export const MATERIAL_GROUP_LABELS: Record<MaterialGroup, string> = {
  all_members: '全会員',
  normal_members: '通常会員',
  diet_members: 'ダイエット会員',
  admins: '管理者',
  trainers: 'トレーナー',
}

export function normalizeStringArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }
  return []
}

export function isMaterialPublicNow(material: SharedMaterialRow, now = new Date()) {
  if (!material.is_published) return false
  if (material.publish_start_at && new Date(material.publish_start_at) > now) return false
  if (material.publish_end_at && new Date(material.publish_end_at) < now) return false
  return true
}

export function canViewMaterial(material: SharedMaterialRow, viewer: MaterialViewer) {
  const groups = material.target_groups || []
  if (viewer.audience === 'admin') return groups.includes('admins')
  if (viewer.audience === 'trainer') {
    return groups.includes('trainers') || Boolean(viewer.id && (material.target_trainer_ids || []).includes(viewer.id))
  }

  if (viewer.id && (material.target_user_ids || []).includes(viewer.id)) return true
  if (groups.includes('all_members')) return true
  if (viewer.isDiet && groups.includes('diet_members')) return true
  if (!viewer.isDiet && groups.includes('normal_members')) return true
  return false
}

export function toMaterialListItem(material: SharedMaterialRow, openUrl: string) {
  return {
    id: material.id,
    title: material.title,
    description: material.description,
    materialType: material.material_type,
    isPublished: material.is_published,
    displayOrder: material.display_order,
    targetGroups: material.target_groups || [],
    targetUserIds: material.target_user_ids || [],
    targetTrainerIds: material.target_trainer_ids || [],
    createdAt: material.created_at,
    openUrl,
  }
}

export async function createStorageSignedUrl(material: SharedMaterialRow, expiresInSeconds = 600) {
  if (!material.storage_path) return null
  const bucket = material.storage_bucket || 'shared-materials'
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(material.storage_path, expiresInSeconds)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function resolveMemberViewer(token: string | null) {
  if (!token) return null
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, status, lifestyle_settings!left(visible_tabs)')
    .eq('access_token', token)
    .maybeSingle()

  if (error || !user || user.status !== 'active') return null
  const settings = Array.isArray((user as any).lifestyle_settings)
    ? (user as any).lifestyle_settings[0]
    : (user as any).lifestyle_settings
  const tabs = settings?.visible_tabs || {}
  const isDiet = tabs.input === true || tabs.analyze === true || tabs.progress === true
  return { audience: 'member' as const, id: user.id, isDiet }
}

export async function resolveTrainerViewer(token: string | null) {
  if (!token) return null
  const { data: trainer, error } = await supabaseAdmin
    .from('trainers')
    .select('id')
    .eq('access_token', token)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !trainer) return null
  return { audience: 'trainer' as const, id: trainer.id }
}
