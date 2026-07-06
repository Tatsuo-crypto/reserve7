import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Get goals (weight/habit) for a user. Optional ?status=active filter.
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        const queryUserId = searchParams.get('userId');
        const status = searchParams.get('status');

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

        let query = client
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: goals, error } = await query;

        if (error) throw error;

        return NextResponse.json({ data: goals });
    } catch (error: any) {
        console.error('Goals fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Create a new goal (weight or habit)
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tokenFromQuery = searchParams.get('token');

        const body = await req.json();
        const { token: tokenFromBody, userId: bodyUserId, ...goal } = body;
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
            const isAdmin = (session.user as any).role === 'ADMIN';
            if (bodyUserId && isAdmin) {
                userId = bodyUserId;
                client = supabaseAdmin;
            } else {
                userId = (session.user as any).id;
            }
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await client
            .from('goals')
            .insert({
                user_id: userId,
                start_date: goal.startDate || new Date().toISOString().split('T')[0],
                type: goal.type,
                title: goal.title,
                target_value: goal.targetValue ?? null,
                deadline: goal.deadline ?? null,
                status: goal.status || 'active',
                note: goal.note ?? null,
            })
            .select()
            .single();

        if (result.error) throw result.error;

        return NextResponse.json({ success: true, data: result.data });
    } catch (error: any) {
        console.error('Goal create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
