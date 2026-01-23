import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { format, startOfMonth, endOfMonth, addDays, subDays, parseISO, isValid } from 'date-fns'
import { recordStatusChange } from '@/lib/membership-utils'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const memberId = params.id
    const body = await request.json()
    const { month, plan, monthlyFee, status, paymentDate, memo } = body
    
    console.log('Monthly plan API received:', { month, plan, monthlyFee, status, paymentDate, memo })

    if (!month || !isValid(new Date(month))) {
      return createErrorResponse('有効な年月を指定してください (yyyy-MM)', 400)
    }

    const targetDate = new Date(`${month}-01`)
    const monthStart = startOfMonth(targetDate)
    const monthEnd = endOfMonth(targetDate)
    const monthStartStr = format(monthStart, 'yyyy-MM-dd')
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

    // Fetch overlapping history records
    // Overlap condition: start <= monthEnd AND (end IS NULL OR end >= monthStart)
    const { data: records, error: fetchError } = await supabaseAdmin
      .from('membership_history')
      .select('*')
      .eq('user_id', memberId)
      .lte('start_date', monthEndStr)
      .or(`end_date.is.null,end_date.gte.${monthStartStr}`)
      .order('start_date', { ascending: true })

    if (fetchError) throw fetchError

    // We want to "carve out" this month for the new settings.
    // Existing records that overlap with this month need to be modified.

    // 1. "Left" side trim: If a record starts before this month and ends inside or after,
    //    it should now end at monthStart - 1 day.
    // 2. "Right" side trim: If a record starts inside or before and ends after this month,
    //    we might need a "continuation" record starting at monthEnd + 1 day.
    
    // Note: There might be multiple records in this month (e.g. 1st-15th Plan A, 16th-31st Plan B).
    // The user's request "Set Jan plan to X" implies overwriting the whole month to be X.
    // So we should DELETE/SHORTEN any records fully inside, and TRIM any overlapping records.

    for (const record of (records || [])) {
      const rStart = new Date(record.start_date)
      const rEnd = record.end_date ? new Date(record.end_date) : null

      // Check overlap type
      const startsBefore = rStart < monthStart
      const endsAfter = !rEnd || rEnd > monthEnd
      
      // Case 1: Fully inside (or exact match) -> Delete
      // (Starts >= monthStart AND Ends <= monthEnd)
      // Note: rEnd=null is "forever", so it's not "inside" unless we treat it as infinite.
      if (!startsBefore && !endsAfter) {
          await supabaseAdmin.from('membership_history').delete().eq('id', record.id)
          continue
      }

      // Case 2: Straddles both sides (Starts before AND Ends after) -> Split into Left and Right
      if (startsBefore && endsAfter) {
          // Update Left (original) to end just before month
          const leftEnd = subDays(monthStart, 1)
          await supabaseAdmin
            .from('membership_history')
            .update({ end_date: format(leftEnd, 'yyyy-MM-dd') })
            .eq('id', record.id)
          
          // Create Right (continuation) from monthEnd + 1
          const rightStart = addDays(monthEnd, 1)
          await supabaseAdmin.from('membership_history').insert({
              user_id: memberId,
              store_id: record.store_id,
              status: record.status,
              plan: record.plan,
              monthly_fee: record.monthly_fee,
              start_date: format(rightStart, 'yyyy-MM-dd'),
              end_date: null // Original was null/indefinite, so new tail is too
          })
          continue
      }

      // Case 3: Left overlap only (Starts before AND Ends inside) -> Shorten end
      if (startsBefore && !endsAfter) {
           const leftEnd = subDays(monthStart, 1)
           await supabaseAdmin
            .from('membership_history')
            .update({ end_date: format(leftEnd, 'yyyy-MM-dd') })
            .eq('id', record.id)
           continue
      }

      // Case 4: Right overlap only (Starts inside AND Ends after) -> Shorten start
      // But we can't easily "shorten start" of an existing record without changing ID conceptually?
      // Actually we can update start_date.
      if (!startsBefore && endsAfter) {
           const rightStart = addDays(monthEnd, 1)
           await supabaseAdmin
            .from('membership_history')
            .update({ start_date: format(rightStart, 'yyyy-MM-dd') })
            .eq('id', record.id)
           continue
      }
    }

    // Now the month is "clean". Insert the new record for this month.
    // However, if the user requested "Set Jan to Plan A", and Jan is in the past, fine.
    // If "status" is not active, we might not need a plan? 
    // Usually "Recess" or "Withdrawn" might not have a plan. But let's follow the input.
    
    // Check user's current store_id to use as default if needed
    let storeId = null
    if (records && records.length > 0) {
        storeId = records[0].store_id // inherit from previous
    } else {
        const { data: u } = await supabaseAdmin.from('users').select('store_id').eq('id', memberId).single()
        storeId = u?.store_id
    }

    const { error: insertError } = await supabaseAdmin.from('membership_history').insert({
        user_id: memberId,
        store_id: storeId,
        status: status || 'active',
        plan: plan,
        monthly_fee: monthlyFee !== undefined ? monthlyFee : null,
        start_date: monthStartStr,
        end_date: monthEndStr
    })

    if (insertError) throw insertError

    // Optimization: Merge adjacent records if identical?
    // If the new record matches the Left or Right neighbor exactly in (status, plan, fee, store), 
    // we could merge them to keep the table clean. 
    // But for now, separate records are fine and safer.

    // Finally, if this change affects the "Current" status (i.e. we edited the current month or future),
    // we might need to update the `users` table cache if that's what we rely on.
    // But our system seems to rely on history now?
    // `users.plan` and `users.status` are often used as "Current".
    // Let's update `users` table if the edited month is the CURRENT month.
    const today = new Date()
    if (today >= monthStart && today <= monthEnd) {
        await supabaseAdmin.from('users').update({
            plan: plan,
            status: status || 'active',
            monthly_fee: monthlyFee
        }).eq('id', memberId)
    }

    // Handle Payment Date and Memo (Sales Record)
    const targetDateStr = format(monthStart, 'yyyy-MM-01')

    // Save if paymentDate or memo exists
    if (paymentDate || memo) {
        // Upsert sales record
        // First check if exists
        const { data: existingSale } = await supabaseAdmin
            .from('sales')
            .select('id')
            .eq('user_id', memberId)
            .eq('target_date', targetDateStr)
            .eq('type', 'monthly_fee')
            .single()

        if (existingSale) {
            console.log('Updating existing sale with memo:', memo)
            const { error: updateError } = await supabaseAdmin
                .from('sales')
                .update({
                    payment_date: paymentDate || null,
                    amount: monthlyFee ?? 0,
                    status: paymentDate ? 'paid' : 'unpaid',
                    memo: memo || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSale.id)
            
            if (updateError) {
                console.error('Failed to update sales record:', updateError)
                throw updateError
            }
            console.log('Sales record updated successfully')
        } else {
            console.log('Inserting new sale with memo:', memo)
            const { error: insertSaleError } = await supabaseAdmin
                .from('sales')
                .insert({
                    user_id: memberId,
                    store_id: storeId, // derived earlier
                    amount: monthlyFee ?? 0,
                    type: 'monthly_fee',
                    status: paymentDate ? 'paid' : 'unpaid',
                    payment_date: paymentDate || null,
                    target_date: targetDateStr,
                    memo: memo || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            
            if (insertSaleError) {
                console.error('Failed to insert sales record:', insertSaleError)
                throw insertSaleError
            }
            console.log('Sales record inserted successfully')
        }
    } else {
        // If both paymentDate and memo are null/empty, delete the record
        await supabaseAdmin
            .from('sales')
            .delete()
            .eq('user_id', memberId)
            .eq('target_date', targetDateStr)
            .eq('type', 'monthly_fee')
    }

    return createSuccessResponse({ success: true })

  } catch (error: any) {
    console.error('Monthly plan update error:', error)
    return createErrorResponse(error.message || 'Internal server error', 500)
  }
}
