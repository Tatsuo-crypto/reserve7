import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Get lifestyle logs for current user
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
            .from('lifestyle_logs')
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
        console.error('Lifestyle log fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Create or update a lifestyle log
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tokenFromQuery = searchParams.get('token');

        const body = await req.json();
        const { date, token: tokenFromBody, ...metrics } = body;
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
            .from('lifestyle_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        const allowedKeys = ['weight', 'steps', 'notes', 'water_liters', 'sleep_hours', 'alcohol_units', 'workout', 'habits'];
        const filteredMetrics: any = {};
        allowedKeys.forEach(key => {
            if (metrics[key] !== undefined) {
                filteredMetrics[key] = metrics[key];
            } else if (key === 'water_liters' && metrics['water'] !== undefined) {
                filteredMetrics['water_liters'] = metrics['water'];
            } else if (key === 'sleep_hours' && metrics['sleep'] !== undefined) {
                filteredMetrics['sleep_hours'] = metrics['sleep'];
            } else if (key === 'alcohol_units' && metrics['alcohol'] !== undefined) {
                filteredMetrics['alcohol_units'] = metrics['alcohol'];
            }
        });

        let result;
        if (existing) {
            result = await client
                .from('lifestyle_logs')
                .update({
                    ...filteredMetrics,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await client
                .from('lifestyle_logs')
                .insert({
                    user_id: userId,
                    date,
                    ...filteredMetrics,
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        return NextResponse.json({ success: true, data: result.data });
    } catch (error: any) {
        console.error('Lifestyle log save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Delete a lifestyle log for a specific date
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');
        const token = searchParams.get('token');

        if (!date) {
            return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }

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

        const { error } = await client
            .from('lifestyle_logs')
            .delete()
            .eq('user_id', userId)
            .eq('date', date);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Deleted successfully' });
    } catch (error: any) {
        console.error('Lifestyle log delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
