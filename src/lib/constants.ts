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
  PLANS.DIET_COURSE,
  PLANS.DIET_COURSE_2M,
  PLANS.DIET_COURSE_3M,
  PLANS.DIET_COURSE_6M,
  PLANS.COUNSELING,
] as const;

// Plan display order for sorting
export const PLAN_RANK: Record<string, number> = {
  [PLANS.ONE_TIME]: 0,
  [PLANS.COUNSELING]: 1,
  [PLANS.MONTHLY_2]: 2,
  [PLANS.MONTHLY_4]: 4,
  [PLANS.MONTHLY_6]: 6,
  [PLANS.MONTHLY_8]: 8,
  [PLANS.DIET_COURSE]: 100,
  [PLANS.DIET_COURSE_2M]: 101,
  [PLANS.DIET_COURSE_3M]: 102,
  [PLANS.DIET_COURSE_6M]: 103,
};

// Standard Plan Fees (Tax included)
// TODO: Update these values with the correct pricing
export const PLAN_FEES: Record<string, number> = {
  [PLANS.ONE_TIME]: 0,
  [PLANS.MONTHLY_2]: 0,
  [PLANS.MONTHLY_4]: 13200, // Based on placeholder
  [PLANS.MONTHLY_6]: 0,
  [PLANS.MONTHLY_8]: 0,
  [PLANS.DIET_COURSE]: 0,
  [PLANS.DIET_COURSE_2M]: 0,
  [PLANS.DIET_COURSE_3M]: 0,
  [PLANS.DIET_COURSE_6M]: 0,
  [PLANS.COUNSELING]: 0,
};

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

export const STATUS_COLORS: Record<string, string> = {
  [STATUS.ACTIVE]: 'bg-green-100 text-green-800',
  [STATUS.SUSPENDED]: 'bg-yellow-100 text-yellow-800',
  [STATUS.WITHDRAWN]: 'bg-red-100 text-red-800',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  [STATUS.ACTIVE]: 'bg-green-500',
  [STATUS.SUSPENDED]: 'bg-yellow-500',
  [STATUS.WITHDRAWN]: 'bg-red-500',
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
