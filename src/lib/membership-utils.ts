import { supabaseAdmin } from '@/lib/supabase-admin'
import { format, subDays, parseISO } from 'date-fns'

export type MembershipStatus = 'active' | 'suspended' | 'withdrawn'

/**
 * Record membership status change in history.
 * Should be called whenever a user's status changes or a new user is created.
 */
export async function recordStatusChange(
    userId: string,
    newStatus: MembershipStatus,
    storeId?: string,
    startDate: string | Date = new Date(),
    plan?: string,
    monthlyFee?: number
) {
    try {
        // Normalize startDate to YYYY-MM-DD string
        let startStr: string
        let startObj: Date
        
        if (typeof startDate === 'string') {
            startStr = startDate
            startObj = new Date(startDate)
        } else {
            startStr = format(startDate, 'yyyy-MM-dd')
            startObj = startDate
        }

        // 1. Close current active history
        // Find the latest history record that is open (end_date is null)
        const { data: currentHistory, error: fetchError } = await supabaseAdmin
            .from('membership_history')
            .select('id, start_date')
            .eq('user_id', userId)
            .is('end_date', null)
            .order('start_date', { ascending: false })
            .limit(1)
            .single()

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is 'Row not found'
            console.error('Error fetching current membership history:', fetchError)
        }

        if (currentHistory) {
            // Close previous record with date - 1 day to avoid overlap
            // If new status starts 2026-01-01, old status ends 2025-12-31.
            const endDateObj = subDays(startObj, 1)
            const endDateStr = format(endDateObj, 'yyyy-MM-dd')
            
            const { error: updateError } = await supabaseAdmin
                .from('membership_history')
                .update({ end_date: endDateStr })
                .eq('id', currentHistory.id)

            if (updateError) {
                console.error('Error closing previous membership history:', updateError)
            }
        }

        // 2. Insert new history record
        const { error: insertError } = await supabaseAdmin
            .from('membership_history')
            .insert({
                user_id: userId,
                status: newStatus,
                store_id: storeId || null, // Optional store snapshot
                start_date: startStr,
                end_date: null, // Active indefinitely
                plan: plan || null,
                monthly_fee: monthlyFee !== undefined ? monthlyFee : null
            })

        if (insertError) {
            console.error('Error creating new membership history:', insertError)
        }

    } catch (error) {
        console.error('Unexpected error in recordStatusChange:', error)
    }
}
