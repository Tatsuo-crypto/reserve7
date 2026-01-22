/**
 * Authentication and authorization utility functions
 */

export function isAdmin(email: string): boolean {
  // For client-side usage, we need to handle the case where process.env is not available
  if (typeof window !== 'undefined') {
    // On client side, we'll assume admin status is handled by the server
    return true // This will be properly validated on the server side
  }
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  return adminEmails.includes(email)
}

export function getUserStoreId(email: string): string {
  if (email === 'tandjgym@gmail.com') {
    return '77439c86-679a-409a-8000-2e5297e5c0e8'
  } else if (email === 'tandjgym2goutenn@gmail.com') {
    return '43296d78-13f3-4061-8d75-d38dfe907a5d'
  }
  // For regular users, extract store ID from their registration
  // This is a fallback - in practice, store_id should be stored in the user record
  return '77439c86-679a-409a-8000-2e5297e5c0e8' // Default to store 1
}

export function getStoreDisplayName(identifier: string): string {
  // Handle emails
  if (identifier === 'tandjgym@gmail.com') {
    return 'T&J GYM1号店'
  } else if (identifier === 'tandjgym2goutenn@gmail.com') {
    return 'T&J GYM2号店'
  }
  
  // Handle store UUIDs
  if (identifier === '77439c86-679a-409a-8000-2e5297e5c0e8') {
    return 'T&J GYM1号店'
  } else if (identifier === '43296d78-13f3-4061-8d75-d38dfe907a5d') {
    return 'T&J GYM2号店'
  }

  return identifier
}

/**
 * @deprecated レガシーなカレンダーID判定ヘルパーです。
 * 環境変数や店舗/トレーナーレコード由来の calendar_id を直接使用してください。
 * 将来の削除候補のため新規利用は避けてください。
 */
export function getCalendarId(storeId: string): string {
  return storeId === 'tandjgym@gmail.com' 
    ? process.env.GOOGLE_CALENDAR_ID_1 || 'tandjgym@gmail.com'
    : process.env.GOOGLE_CALENDAR_ID_2 || 'tandjgym2goutenn@gmail.com'
}
