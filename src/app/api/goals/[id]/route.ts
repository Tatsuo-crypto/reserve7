import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

async function resolveUser(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    const session = await getServerSession(authOptions);
    if (token) {
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('access_token', token)
            .single();
        if (userError || !user) return null;
        return { userId: user.id as string, client: supabaseAdmin };
    } else if (session && session.user) {
        return { userId: (session.user as any).id as string, client: supabase };
    }
    return null;
}

// Update a goal (e.g. mark achieved/missed/archived, edit title/target/deadline)
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const auth = await resolveUser(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { userId, client } = auth;

        const body = await req.json();
        const update: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) update.title = body.title;
        if (body.targetValue !== undefined) update.target_value = body.targetValue;
        if (body.deadline !== undefined) update.deadline = body.deadline;
        if (body.note !== undefined) update.note = body.note;
        if (body.status !== undefined) {
            update.status = body.status;
            if (body.status === 'achieved' || body.status === 'missed') {
                update.achieved_at = new Date().toISOString();
            }
        }

        const query = client
            .from('goals')
            .update(update)
            .eq('id', id);

        if (client !== supabaseAdmin) {
            query.eq('user_id', userId);
        }

        const { data, error } = await query.select().single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Goal update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const auth = await resolveUser(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { userId, client } = auth;

        const query = client
            .from('goals')
            .delete()
            .eq('id', id);

        if (client !== supabaseAdmin) {
            query.eq('user_id', userId);
        }

        const { error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Goal delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
