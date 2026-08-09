/**
 * T&J GYM Reservation System - Constants
 * システム全体で使用する定数定義
 */

// ==============================
// Plan Constants
// ==============================

export const PLANS = {
  ONE_TIME: '都度',
  MONTHLY_2: '月2回',
  MONTHLY_4: '月4回',
  MONTHLY_6: '月6回',
  MONTHLY_8: '月8回',
  ONLINE_UNLIMITED: 'オンライン受け放題',
  DIET_SUPPORT_3M: 'ダイエットサポート（3ヶ月）',
  DIET_COURSE: 'ダイエットコース',
  DIET_COURSE_2M: 'ダイエットコース【2ヶ月】',
  DIET_COURSE_3M: 'ダイエットコース【3ヶ月】',
  DIET_COURSE_6M: 'ダイエットコース【6ヶ月】',
  COUNSELING: 'カウンセリング',
} as const;

export const PLAN_LIST = [
  PLANS.ONE_TIME,
  PLANS.MONTHLY_2,
  PLANS.MONTHLY_4,
  PLANS.MONTHLY_6,
  PLANS.MONTHLY_8,
  PLANS.ONLINE_UNLIMITED,
  PLANS.DIET_SUPPORT_3M,
  PLANS.DIET_COURSE,
  PLANS.DIET_COURSE_2M,
  PLANS.DIET_COURSE_3M,
  PLANS.DIET_COURSE_6M,
  PLANS.COUNSELING,
] as const;

export const NEW_MEMBER_PLAN_LIST = [
  PLANS.ONE_TIME,
  PLANS.MONTHLY_2,
  PLANS.MONTHLY_4,
  PLANS.MONTHLY_6,
  PLANS.MONTHLY_8,
  PLANS.ONLINE_UNLIMITED,
  PLANS.DIET_SUPPORT_3M,
  PLANS.COUNSELING,
] as const;

// Plan display order for sorting
export const PLAN_RANK: Record<string, number> = {
  [PLANS.COUNSELING]: 0,
  [PLANS.ONE_TIME]: 1,
  [PLANS.MONTHLY_2]: 2,
  [PLANS.MONTHLY_4]: 3,
  [PLANS.MONTHLY_6]: 4,
  [PLANS.MONTHLY_8]: 5,
  [PLANS.ONLINE_UNLIMITED]: 6,
  [PLANS.DIET_SUPPORT_3M]: 100,
  [PLANS.DIET_COURSE]: 101,
  [PLANS.DIET_COURSE_2M]: 102,
  [PLANS.DIET_COURSE_3M]: 103,
  [PLANS.DIET_COURSE_6M]: 104,
};

// Standard service fees (tax included)
export const PLAN_FEES: Record<string, number> = {
  [PLANS.ONE_TIME]: 0,
  [PLANS.MONTHLY_2]: 15400,
  [PLANS.MONTHLY_4]: 26400,
  [PLANS.MONTHLY_6]: 36300,
  [PLANS.MONTHLY_8]: 46200,
  [PLANS.ONLINE_UNLIMITED]: 5500,
  [PLANS.DIET_SUPPORT_3M]: 107800,
  [PLANS.DIET_COURSE]: 0,
  [PLANS.DIET_COURSE_2M]: 0,
  [PLANS.DIET_COURSE_3M]: 0,
  [PLANS.DIET_COURSE_6M]: 0,
  [PLANS.COUNSELING]: 0,
};

export const SUBSCRIPTION_PLANS = new Set<string>([
  PLANS.MONTHLY_2,
  PLANS.MONTHLY_4,
  PLANS.MONTHLY_6,
  PLANS.MONTHLY_8,
  PLANS.ONLINE_UNLIMITED,
  PLANS.COUNSELING,
])

export function isDietPlan(plan?: string | null): boolean {
  return !!plan && plan.includes('ダイエット')
}

export function isPersonalPlan(plan?: string | null): boolean {
  return !!plan && /月\d+回/.test(plan)
}

export function getPlanBillingLabel(plan?: string | null): string {
  if (isDietPlan(plan)) return '3ヶ月 / 払い切り'
  if (plan && SUBSCRIPTION_PLANS.has(plan)) return 'サブスク'
  return '契約なし'
}

// ==============================
// Status Constants
// ==============================

export const STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  WITHDRAWN: 'withdrawn',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  [STATUS.ACTIVE]: '在籍',
  [STATUS.SUSPENDED]: '休会',
  [STATUS.WITHDRAWN]: '退会',
};

// オーナー指示によりO-1/S章の「在籍=state.success(緑)」を上書き: 在籍はbrand(オレンジ)に統一。
// stores/page.tsxの「有効」ステータスも元々brandだったため、これで在籍系ステータス表示の配色が揃う。
// 休会=amber、退会=state.danger(赤)はそのまま(緑を抜くだけで、状態の意味自体は変えない)。
export const STATUS_COLORS: Record<string, string> = {
  // BE-1: AZ-2(白基調化)の一括置換は src/app と src/components しか見ていなかったため、
  // ここの 300 系(黒基調時代の淡い文字色)が残っていた。白地の淡い塗りの上では読めないので 700 系にする。
  [STATUS.ACTIVE]: 'bg-brand-500/15 text-brand-700',
  [STATUS.SUSPENDED]: 'bg-amber-500/15 text-amber-700',
  [STATUS.WITHDRAWN]: 'bg-state-danger-500/15 text-state-danger-700',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  [STATUS.ACTIVE]: 'bg-brand-500',
  [STATUS.SUSPENDED]: 'bg-amber-500',
  [STATUS.WITHDRAWN]: 'bg-state-danger-500',
};

// Status priority for sorting
export const STATUS_RANK: Record<string, number> = {
  [STATUS.ACTIVE]: 1,
  [STATUS.SUSPENDED]: 2,
  [STATUS.WITHDRAWN]: 3,
};

// ==============================
// Store Constants
// ==============================

export const STORES = {
  STORE_1: 'tandjgym@gmail.com',
  STORE_2: 'tandjgym2goutenn@gmail.com',
} as const;

export const STORE_NAMES: Record<string, string> = {
  [STORES.STORE_1]: 'T&J GYM【1号店】',
  [STORES.STORE_2]: 'T&J GYM【2号店】',
};

// ==============================
// Admin Emails
// ==============================

export const ADMIN_EMAILS = [
  STORES.STORE_1,
  STORES.STORE_2,
] as const;

// ==============================
// Time Constants
// ==============================

export const BUSINESS_HOURS = {
  START: '09:00',
  END: '21:00',
} as const;

export const DEFAULT_RESERVATION_DURATION = 60; // minutes

// ==============================
// UI Constants
// ==============================

export const ITEMS_PER_PAGE = 50;

export const TOAST_DURATION = 3000; // milliseconds
