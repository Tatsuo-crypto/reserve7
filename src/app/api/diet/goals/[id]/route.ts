import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

async function resolveDietGoalUser(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

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
            return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
        }
        userId = user.id;
        client = supabaseAdmin;
    } else if (session && session.user) {
        userId = (session.user as any).id;
    } else {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    return { userId, client };
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const resolved = await resolveDietGoalUser(req);
        if (resolved.error) return resolved.error;
        const { userId, client } = resolved;
        const body = await req.json();
        const { startDate, token: _token, targetCalories: _targetCalories, ...goals } = body;

        const allowedKeys = [
            'calories',
            'protein',
            'fat',
            'carbs',
            'sugar',
            'fiber',
            'salt',
            'title',
        ];
        const filteredGoals: any = {};
        allowedKeys.forEach(key => {
            if (goals[key] !== undefined) filteredGoals[key] = goals[key];
        });

        if (startDate) filteredGoals.start_date = startDate;

        const query = client
            .from('diet_goals')
            .update({
                ...filteredGoals,
                updated_at: new Date().toISOString(),
            })
            .eq('id', params.id);

        if (client !== supabaseAdmin) {
            query.eq('user_id', userId);
        }

        const { data, error } = await query.select().single();
        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Diet goal update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const resolved = await resolveDietGoalUser(req);
        if (resolved.error) return resolved.error;
        const { userId, client } = resolved;

        // Delete the goal - ensure it belongs to the user (unless admin)
        const query = client
            .from('diet_goals')
            .delete()
            .eq('id', id);

        // If not using admin client, enforce user_id check
        if (client !== supabaseAdmin) {
            query.eq('user_id', userId);
        }

        const { error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Diet goal delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
