import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/supabase';
import { visionService } from '@/lib/vision';

export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tokenFromQuery = searchParams.get('token');
        
        const formData = await req.formData();
        const image = formData.get('image') as File | null;
        const tokenFromForm = formData.get('token') as string | null;
        const token = tokenFromQuery || tokenFromForm;

        let authorized = false;
        const session = await getServerSession(authOptions);
        
        if (session && session.user) {
            authorized = true;
        } else if (token) {
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('access_token', token)
                .single();
            if (!userError && user) {
                authorized = true;
            }
        }

        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!image) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Analyze the image using Vision API
        const nutrients = await visionService.analyzeNutrients(buffer);

        return NextResponse.json({
            success: true,
            data: nutrients
        });
    } catch (error: any) {
        console.error('Diet analysis error:', error);
        
        // Extract specific error message if available from Google API
        let errorMessage = error.message || 'Failed to analyze image';
        if (error.errors && error.errors[0] && error.errors[0].message) {
            errorMessage = error.errors[0].message;
            if (errorMessage.includes('billing to be enabled')) {
                errorMessage = 'Google Cloud Vision APIの利用には支払い情報の登録（Billing）が必要です。Google Cloud Consoleで有効にしてください。';
            }
        }

        return NextResponse.json({
            error: 'Failed to analyze image',
            message: errorMessage
        }, { status: 500 });
    }
}
