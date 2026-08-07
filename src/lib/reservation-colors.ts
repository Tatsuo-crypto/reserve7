/**
 * BD-1: カレンダー/タイムラインの予約種別の配色を1箇所に集約する。
 *
 * これまで CalendarView と TimelineView で同じ判定と色指定を別々に書いていたため、
 *   - 「研修」が薄いオレンジ地に薄いオレンジ文字(orange-500/15 + orange-300)になっていて
 *     白基調ではほぼ読めない
 *   - 「研修」のオレンジが主役である「予約」のオレンジと同系統で紛らわしい
 * という状態になっていた。判定と色をここにまとめ、両画面と凡例が必ず一致するようにする。
 *
 * BD-3: 当初は予約以外を「淡い塗り(500/15〜20)」で統一したが、
 * カレンダーのチップは高さ13pxと小さく、淡い塗りでは色の違いが判別できず
 * 「予約以外が全部同じに見える」状態だった。予定を表す4種はいずれも
 * はっきり色が出る塗りつぶしにして、色相で見分けられるようにする。
 *
 * 配色の考え方:
 *   予約     = 一番数が多く主役。アプリのオレンジ。
 *   体験     = 見込みのお客様。青。
 *   ゲスト   = 他店・外部の枠。紫。
 *   研修     = 社内の活動。緑(予約のオレンジと最も遠い色相)。
 *   予約不可 = 予定ではなく「使えない時間」なので、唯一彩度を持たせずグレーで後ろに引く。
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
  trial: 'bg-blue-600 text-white border border-blue-700',
  guest: 'bg-purple-600 text-white border border-purple-700',
  training: 'bg-green-600 text-white border border-green-700',
  blocked: 'bg-zinc-200 text-zinc-700 border border-zinc-300',
}

/** 凡例のドットに当てるクラス(チップと同じ色合いで揃える)。 */
export const RESERVATION_LEGEND_CLASSES: Record<ReservationVisualType, string> = {
  reservation: 'border border-brand-600 bg-brand-500',
  trial: 'border border-blue-700 bg-blue-600',
  guest: 'border border-purple-700 bg-purple-600',
  training: 'border border-green-700 bg-green-600',
  blocked: 'border border-zinc-300 bg-zinc-200',
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
