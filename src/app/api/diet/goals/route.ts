import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

function isMissingEndDateColumn(error: any) {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
    return message.includes('end_date') && (
        message.includes('column')
        || message.includes('schema cache')
        || message.includes('Could not find')
    );
}

// Get diet goals history for current user
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        const queryUserId = searchParams.get('userId');

        let userId: string;
        let client = supabase;

        const session = await getServerSession(authOptions);
        if (token) {
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('access_token', token)
                .single();
            if (userError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            userId = user.id;
            client = supabaseAdmin;
        } else if (session && session.user) {
            const isAdmin = (session.user as any).role === 'ADMIN';
            if (queryUserId && isAdmin) {
                userId = queryUserId;
                client = supabaseAdmin;
            } else {
                userId = (session.user as any).id;
            }
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: goals, error } = await client
            .from('diet_goals')
            .select('*')
            .eq('user_id', userId)
            .order('start_date', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: goals });
    } catch (error: any) {
        console.error('Diet goals fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Create new diet goal
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tokenFromQuery = searchParams.get('token');

        const body = await req.json();
        const { startDate, endDate, token: tokenFromBody, targetCalories, ...goals } = body;
        const token = tokenFromQuery || tokenFromBody;

        let userId: string;
        let client = supabase;

        const session = await getServerSession(authOptions);
        if (token) {
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('access_token', token)
                .single();
            if (userError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            userId = user.id;
            client = supabaseAdmin;
        } else if (session && session.user) {
            userId = (session.user as any).id;
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const allowedKeys = [
            'calories',
            'protein',
            'fat',
            'carbs',
            'sugar',
            'fiber',
            'salt',
            'title',
            'end_date',
        ];
        const filteredGoals: any = {};
        allowedKeys.forEach(key => {
            if (goals[key] !== undefined) filteredGoals[key] = goals[key];
        });
        if (Object.prototype.hasOwnProperty.call(body, 'endDate')) {
            filteredGoals.end_date = endDate || null;
        }

        // Check if goal for this date already exists
        const { data: existing } = await client
            .from('diet_goals')
            .select('id')
            .eq('user_id', userId)
            .eq('start_date', startDate)
            .maybeSingle();

        let result;
        if (existing) {
            result = await client
                .from('diet_goals')
                .update({
                    ...filteredGoals,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await client
                .from('diet_goals')
                .insert({
                    user_id: userId,
                    start_date: startDate || new Date().toISOString().split('T')[0],
                    ...filteredGoals,
                })
                .select()
                .single();
        }

        if (result.error && filteredGoals.end_date !== undefined && isMissingEndDateColumn(result.error)) {
            const { end_date: _endDate, ...goalsWithoutEndDate } = filteredGoals;
            if (existing) {
                result = await client
                    .from('diet_goals')
                    .update({
                        ...goalsWithoutEndDate,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
            } else {
                result = await client
                    .from('diet_goals')
                    .insert({
                        user_id: userId,
                        start_date: startDate || new Date().toISOString().split('T')[0],
                        ...goalsWithoutEndDate,
                    })
                    .select()
                    .single();
            }
        }

        if (result.error) throw result.error;

        return NextResponse.json({ success: true, data: result.data });
    } catch (error: any) {
        console.error('Diet goal save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
