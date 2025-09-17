/**
 * Authentication and authorization utility functions
 */

export function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  return adminEmails.includes(email)
}

export function getUserStoreId(email: string): string {
  if (email === 'tandjgym@gmail.com') {
    return 'tandjgym@gmail.com'
  } else if (email === 'tandjgym2goutenn@gmail.com') {
    return 'tandjgym2goutenn@gmail.com'
  }
  // For regular users, extract store ID from their registration
  // This is a fallback - in practice, store_id should be stored in the user record
  return 'tandjgym@gmail.com' // Default to store 1
}

export function getStoreDisplayName(email: string): string {
  if (email === 'tandjgym@gmail.com') {
    return 'T&J GYM1号店'
  } else if (email === 'tandjgym2goutenn@gmail.com') {
    return 'T&J GYM2号店'
  }
  return email
}

export function getCalendarId(storeId: string): string {
  return storeId === 'tandjgym@gmail.com' 
    ? process.env.GOOGLE_CALENDAR_ID_1 || 'tandjgym@gmail.com'
    : process.env.GOOGLE_CALENDAR_ID_2 || 'tandjgym2goutenn@gmail.com'
}
