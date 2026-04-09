import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Get diet goals history for current user
export async function GET(req: NextRequest) {
    try {
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
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            userId = user.id;
            client = supabaseAdmin;
        } else if (session && session.user) {
            userId = (session.user as any).id;
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
        const { startDate, token: tokenFromBody, ...goals } = body;
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
                    ...goals,
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
                    ...goals,
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        return NextResponse.json({ success: true, data: result.data });
    } catch (error: any) {
        console.error('Diet goal save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
