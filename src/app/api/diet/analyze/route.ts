import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { visionService } from '@/lib/vision';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const image = formData.get('image') as File | null;

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
        return NextResponse.json({
            error: 'Failed to analyze image',
            message: error.message
        }, { status: 500 });
    }
}
