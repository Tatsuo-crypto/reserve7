import { contractAtDate, japanDate, latestContract } from './membership-ledger'

export type MembershipStatus = 'active' | 'suspended' | 'withdrawn'

export type MembershipSnapshot = {
    status: MembershipStatus
    start_date: string
    end_date: string | null
    plan?: string | null
    monthly_fee?: number | null
}

export function resolveCurrentMembership<T extends MembershipSnapshot>(
    histories: T[],
    today = japanDate()
): T | null {
    return latestContract(histories, today)
}

export function applyCurrentMembership<T extends {
    status?: string | null
    plan?: string | null
    monthly_fee?: number | null
}>(member: T, histories: MembershipSnapshot[], today = japanDate()): T {
    const { contract, ...current } = contractAtDate(member, histories, today)
    return current as T
}
