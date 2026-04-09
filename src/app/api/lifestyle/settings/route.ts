import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

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
            const isAdmin = (session.user as any).role === 'ADMIN';
            const queryUserId = searchParams.get('userId');

            if (queryUserId && isAdmin) {
                userId = queryUserId;
                client = supabaseAdmin;
            } else {
                userId = (session.user as any).id;
            }
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: settings, error } = await client
            .from('lifestyle_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        // Return default settings if none found
        if (!settings) {
            return NextResponse.json({
                data: {
                    visible_items: { steps: false, sleep: false, water: false, alcohol: false },
                    visible_tabs: { input: false, analyze: false, progress: false }
                }
            });
        }

        // Merge defaults for missing fields
        const mergedSettings = {
            ...settings,
            visible_items: settings.visible_items || { steps: false, sleep: false, water: false, alcohol: false },
            visible_tabs: settings.visible_tabs || { input: false, analyze: false, progress: false }
        };

        return NextResponse.json({ data: mergedSettings });
    } catch (error: any) {
        console.error('Settings fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tokenFromQuery = searchParams.get('token');

        const body = await req.json();
        const { visibleItems, visibleTabs, userId: bodyUserId, token: tokenFromBody } = body;
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

        const { data, error } = await client
            .from('lifestyle_settings')
            .upsert({
                user_id: userId,
                visible_items: visibleItems,
                visible_tabs: visibleTabs,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Settings save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
