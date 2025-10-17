/**
 * API Client
 * 統一されたAPI呼び出しクライアント
 */

import type { ApiResponse, Member, MemberFormData, MembersResponse } from '@/types';

/**
 * 基本的なfetchラッパー
 */
async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.error || `HTTPエラー: ${response.status}`,
      };
    }

    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return {
      error: error instanceof Error ? error.message : '不明なエラーが発生しました',
    };
  }
}

// ==============================
// Member API
// ==============================

/**
 * 会員一覧を取得
 */
export async function fetchMembers(
  allStores: boolean = false
): Promise<ApiResponse<MembersResponse>> {
  const url = allStores
    ? '/api/admin/members?all_stores=true'
    : '/api/admin/members';
  
  return fetchApi<MembersResponse>(url);
}

/**
 * 会員を作成
 */
export async function createMember(
  data: MemberFormData
): Promise<ApiResponse<Member>> {
  return fetchApi<Member>('/api/admin/members', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 会員情報を更新
 */
export async function updateMember(
  memberId: string,
  updates: Partial<MemberFormData>
): Promise<ApiResponse<Member>> {
  return fetchApi<Member>('/api/admin/members', {
    method: 'PATCH',
    body: JSON.stringify({ memberId, ...updates }),
  });
}

/**
 * 会員を削除
 */
export async function deleteMember(
  memberId: string
): Promise<ApiResponse<void>> {
  return fetchApi<void>('/api/admin/members', {
    method: 'DELETE',
    body: JSON.stringify({ memberId }),
  });
}

/**
 * 会員のステータスを更新
 */
export async function updateMemberStatus(
  memberId: string,
  status: string
): Promise<ApiResponse<Member>> {
  return updateMember(memberId, { status: status as any });
}

/**
 * 会員のプランを更新
 */
export async function updateMemberPlan(
  memberId: string,
  plan: string
): Promise<ApiResponse<Member>> {
  return updateMember(memberId, { plan });
}

/**
 * 会員のメモを更新
 */
export async function updateMemberMemo(
  memberId: string,
  memo: string
): Promise<ApiResponse<Member>> {
  return updateMember(memberId, { memo });
}

// ==============================
// Reservation API
// ==============================

/**
 * 予約一覧を取得
 */
export async function fetchReservations(): Promise<ApiResponse<any>> {
  return fetchApi<any>('/api/reservations');
}

// ==============================
// Trainer API
// ==============================

/**
 * トレーナーToken認証
 */
export async function verifyTrainerToken(
  token: string
): Promise<ApiResponse<any>> {
  return fetchApi<any>(`/api/auth/trainer-token?token=${token}`);
}
