import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
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
