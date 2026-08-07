/**
 * BD-1: カレンダー/タイムラインの予約種別の配色を1箇所に集約する。
 *
 * これまで CalendarView と TimelineView で同じ判定と色指定を別々に書いていたため、
 *   - 「研修」が薄いオレンジ地に薄いオレンジ文字(orange-500/15 + orange-300)になっていて
 *     白基調ではほぼ読めない
 *   - 「研修」のオレンジが主役である「予約」のオレンジと同系統で紛らわしい
 * という状態になっていた。判定と色をここにまとめ、両画面と凡例が必ず一致するようにする。
 *
 * 配色の考え方:
 *   予約     = 一番数が多く主役なので唯一の「塗りつぶし」。アプリのオレンジ。
 *   体験     = 見込みのお客様。目を引く青。
 *   ゲスト   = 他店・外部の枠。紫。
 *   研修     = 社内の活動。予約のオレンジと混同しないようティール。
 *   予約不可 = 埋まっていない/使えない時間。彩度を持たせずグレー。
 * 予約以外はすべて「淡い塗り + 同系の濃い文字 + 同系の枠線」で統一し、
 * 塗りつぶしの予約だけが視覚的に前に出るようにしている。
 */

export type ReservationVisualType = 'reservation' | 'trial' | 'guest' | 'training' | 'blocked'

export interface ReservationEventLike {
  type?: string
  title?: string
}

/** 予約種別の判定。体験はタイトル依存のため最優先で見る(既存の挙動を踏襲)。 */
export function resolveReservationType(event: ReservationEventLike): ReservationVisualType {
  if (event.title?.includes('体験')) return 'trial'
  if (event.type === 'guest' || event.title?.includes('ゲスト')) return 'guest'
  if (event.type === 'training') return 'training'
  if (event.type === 'blocked') return 'blocked'
  if (event.type === 'reservation') return 'reservation'
  return 'blocked'
}

/** チップ(予定ブロック)に当てるクラス。 */
export const RESERVATION_CHIP_CLASSES: Record<ReservationVisualType, string> = {
  reservation: 'bg-brand-500 text-white border border-brand-600',
  trial: 'bg-blue-500/15 text-blue-700 border border-blue-500/30',
  guest: 'bg-purple-500/20 text-purple-700 border border-purple-500/35',
  training: 'bg-teal-500/15 text-teal-700 border border-teal-500/30',
  blocked: 'bg-surface-overlay text-text-muted border border-border-strong',
}

/** 凡例のドットに当てるクラス(チップと同じ色合いで揃える)。 */
export const RESERVATION_LEGEND_CLASSES: Record<ReservationVisualType, string> = {
  reservation: 'border border-brand-600 bg-brand-500',
  trial: 'border border-blue-500/30 bg-blue-500/15',
  guest: 'border border-purple-500/35 bg-purple-500/20',
  training: 'border border-teal-500/30 bg-teal-500/15',
  blocked: 'border border-border-strong bg-surface-overlay',
}

export const RESERVATION_LEGEND_LABELS: Record<ReservationVisualType, string> = {
  reservation: '予約',
  trial: '体験',
  guest: 'ゲスト',
  training: '研修',
  blocked: '予約不可',
}

/** 凡例に出す順番(左から: 主役 → 種別 → 使えない時間)。 */
export const RESERVATION_LEGEND_ORDER: ReservationVisualType[] = [
  'reservation',
  'trial',
  'guest',
  'training',
  'blocked',
]

export function reservationChipClass(event: ReservationEventLike): string {
  return RESERVATION_CHIP_CLASSES[resolveReservationType(event)]
}
