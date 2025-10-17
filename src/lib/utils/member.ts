/**
 * Member Utility Functions
 * 会員管理に関するユーティリティ関数
 */

import { PLAN_RANK, STATUS_RANK, STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS } from '../constants';

/**
 * プランの優先順位を取得
 */
export function getPlanRank(plan?: string): number {
  if (!plan) return 999;
  return PLAN_RANK[plan] ?? 999;
}

/**
 * ステータスの優先順位を取得
 */
export function getStatusRank(status?: string): number {
  if (!status) return 9;
  return STATUS_RANK[status] ?? 9;
}

/**
 * ステータスの日本語ラベルを取得
 */
export function getStatusText(status?: string): string {
  if (!status) return STATUS_LABELS.active;
  return STATUS_LABELS[status] ?? STATUS_LABELS.active;
}

/**
 * ステータスのカラークラスを取得
 */
export function getStatusColor(status?: string): string {
  if (!status) return STATUS_COLORS.active;
  return STATUS_COLORS[status] ?? STATUS_COLORS.active;
}

/**
 * ステータスのドットカラークラスを取得
 */
export function getStatusDotColor(status?: string): string {
  if (!status) return STATUS_DOT_COLORS.active;
  return STATUS_DOT_COLORS[status] ?? STATUS_DOT_COLORS.active;
}

/**
 * 会員の専用URLを生成
 */
export function generateMemberAccessUrl(accessToken: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  return `${base}/client/${accessToken}`;
}

/**
 * 会員名をフォーマット（姓名を分離して結合）
 */
export function formatMemberName(fullName: string): string {
  return fullName.trim();
}

/**
 * 月額料金をフォーマット（¥表示）
 */
export function formatMonthlyFee(fee?: number): string {
  if (fee === undefined || fee === null) return '¥0';
  return `¥${fee.toLocaleString()}`;
}
