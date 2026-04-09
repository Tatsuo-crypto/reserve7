import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Get diet logs for current user in a date range
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const date = searchParams.get('date');
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

        let query = client
            .from('diet_logs')
            .select('*')
            .eq('user_id', userId);

        if (date) {
            const { data, error } = await query.eq('date', date).maybeSingle();
            if (error) {
                if (error.code === 'PGRST116') return NextResponse.json({ data: null });
                throw error;
            }
            return NextResponse.json({ data });
        } else {
            if (startDate) query = query.gte('date', startDate);
            if (endDate) query = query.lte('date', endDate);
            const { data, error } = await query.order('date', { ascending: false });
            if (error) throw error;
            return NextResponse.json({ data });
        }
    } catch (error: any) {
        console.error('Diet log fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Create or update a diet log
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tokenFromQuery = searchParams.get('token');

        const body = await req.json();
        const { date, token: tokenFromBody, ...nutrients } = body;
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

        if (!date) {
            return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }

        const { data: existing } = await client
            .from('diet_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        let result;
        if (existing) {
            result = await client
                .from('diet_logs')
                .update({
                    ...nutrients,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await client
                .from('diet_logs')
                .insert({
                    user_id: userId,
                    date,
                    ...nutrients,
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        return NextResponse.json({ success: true, data: result.data });
    } catch (error: any) {
        console.error('Diet log save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
