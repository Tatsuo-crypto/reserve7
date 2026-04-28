import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
    try {
        console.log('[Diet Upload] Request started');
        const { searchParams } = new URL(req.url);
        const tokenFromQuery = searchParams.get('token');
        
        const formData = await req.formData();
        const file = formData.get('image') as File | null;
        const tokenFromForm = formData.get('token') as string | null;
        const token = tokenFromQuery || tokenFromForm;

        console.log('[Diet Upload] Token details:', { 
            hasToken: !!token, 
            hasFile: !!file,
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type
        });

        let userId: string | null = null;
        const session = await getServerSession(authOptions);
        
        if (session && session.user) {
            userId = (session.user as any).id;
            console.log('[Diet Upload] Using session user:', userId);
        } else if (token) {
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('access_token', token)
                .single();
            if (!userError && user) {
                userId = user.id;
                console.log('[Diet Upload] Using token user:', userId);
            } else {
                console.error('[Diet Upload] Token lookup failed:', userError);
            }
        }

        if (!userId) {
            console.error('[Diet Upload] Unauthorized - no userId found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!file) {
            console.error('[Diet Upload] No image provided');
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        // Ensure bucket exists (diet-images)
        try {
            const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
            if (listError) console.error('[Diet Upload] listBuckets error:', listError);
            
            const exists = buckets?.find(b => b.name === 'diet-images');
            if (!exists) {
                console.log('[Diet Upload] Creating diet-images bucket');
                const { error: createError } = await supabaseAdmin.storage.createBucket('diet-images', {
                    public: true,
                    // No strict allowedMimeTypes to allow more formats like HEIC
                    fileSizeLimit: 10485760 // 10MB
                });
                if (createError) console.error('[Diet Upload] createBucket error:', createError);
            } else {
                // If bucket exists, we might want to update it if it's too restrictive, 
                // but updateBucket doesn't exist in all SDK versions or needs different permissions.
                // For now, assume if it exists it's mostly okay.
            }
        } catch (bucketError) {
            console.error('[Diet Upload] Bucket check/create error (non-fatal):', bucketError);
        }

        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${userId}/${randomUUID()}.${fileExt}`;
        const arrayBuffer = await file.arrayBuffer();

        console.log('[Diet Upload] Uploading to Supabase:', fileName, 'Type:', file.type);
        const { data, error } = await supabaseAdmin.storage
            .from('diet-images')
            .upload(fileName, Buffer.from(arrayBuffer), {
                contentType: file.type || 'image/jpeg',
                upsert: true
            });

        if (error) {
            console.error('[Diet Upload] Supabase upload error:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('diet-images')
            .getPublicUrl(fileName);

        console.log('[Diet Upload] Upload success:', publicUrl);
        return NextResponse.json({
            success: true,
            url: publicUrl
        });
    } catch (error: any) {
        console.error('Diet upload error:', error);
        return NextResponse.json({
            error: 'Failed to upload image',
            message: error.message
        }, { status: 500 });
    }
}
