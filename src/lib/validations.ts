import { z } from 'zod';

// User validation schemas
export const createUserSchema = z.object({
  fullName: z.string().min(1, '氏名は必須です').max(255, '氏名は255文字以内で入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください').or(z.literal('')),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
});

export const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

// Reservation validation schemas
/**
 * @deprecated 予約バリデーションの暫定スキーマです。フォーム/サーバの実装固有のスキーマに置き換える計画のため新規利用は避けてください。
 */
export const createReservationSchema = z.object({
  clientEmail: z.string().email('有効なメールアドレスを入力してください'),
  title: z.string().min(1, 'タイトルは必須です').max(255, 'タイトルは255文字以内で入力してください'),
  startTime: z.string().datetime('有効な日時を入力してください'),
  notes: z.string().max(1000, 'メモは1000文字以内で入力してください').optional(),
});

// Helper function to validate 60-minute duration
/**
 * @deprecated 固定60分の検証ヘルパー。可変長に対応する実装に置き換える計画のため新規利用は避けてください。
 */
export function validateReservationDuration(startTime: Date, endTime: Date): boolean {
  const durationMs = endTime.getTime() - startTime.getTime();
  const expectedDurationMs = 60 * 60 * 1000; // 60 minutes
  return durationMs === expectedDurationMs;
}

// Helper function to calculate end time (start + 60 minutes)
/**
 * @deprecated 固定60分の終了時刻計算。可変長に対応する実装に置き換える計画のため新規利用は避けてください。
 */
export function calculateEndTime(startTime: Date): Date {
  return new Date(startTime.getTime() + 60 * 60 * 1000);
}
