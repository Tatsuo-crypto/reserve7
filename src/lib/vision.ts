import { google } from 'googleapis';
import { env } from './env';

export interface DietSummary {
    calories: number;
    calories_target: number;
    protein: number;
    protein_target: number;
    fat: number;
    fat_target: number;
    carbs: number;
    carbs_target: number;
    sugar: number;
    sugar_target: number;
    fiber: number;
    fiber_target: number;
    salt: number;
    salt_target: number;
}

export class VisionService {
    private vision: any;

    constructor() {
        this.initVision();
    }

    private initVision() {
        try {
            if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                console.warn('⚠️ Google Service Account Key is not configured for Vision API');
                return;
            }

            const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
            
            // Use GoogleAuth which is more robust and matches our successful test script
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });

            this.vision = google.vision({ version: 'v1', auth });
            console.log('✅ Vision API initialized successfully (using GoogleAuth)');
        } catch (error) {
            console.error('❌ Vision API initialization failed:', error);
        }
    }

    async analyzeNutrients(imageBuffer: Buffer): Promise<DietSummary> {
        if (!this.vision) {
            throw new Error('Vision API not initialized');
        }

        try {
            const request = {
                image: { content: imageBuffer.toString('base64') },
                features: [{ type: 'TEXT_DETECTION' }],
            };

            const response = await this.vision.images.annotate({
                requestBody: { requests: [request] },
            });

            const result = response.data;
            const fullText = result.responses?.[0]?.fullTextAnnotation?.text || '';
            console.log('--- OCR Result Start ---');
            console.log(fullText);
            console.log('--- OCR Result End ---');

            // Debug: Save OCR text to a file for investigation
            const fs = require('fs');
            fs.writeFileSync('./ocr_debug.txt', fullText);

            return this.parseNutrients(fullText);
        } catch (error) {
            console.error('❌ Error in analyzeNutrients:', error);
            throw error;
        }
    }

    private parseNutrients(text: string): DietSummary {
        const labels = [
            { key: 'calories', names: ['カロリー', '総エネルギー'] },
            { key: 'protein', names: ['たんぱく質', 'タンパク質'] },
            { key: 'fat', names: ['脂質'] },
            { key: 'carbs', names: ['炭水化物'] },
            { key: 'sugar', names: ['糖質'] },
            { key: 'fiber', names: ['食物繊維'] },
            { key: 'salt', names: ['塩分', '食塩相当量'] },
        ];

        // Match "value / target" pattern
        const ratioMatches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*(?:kcal|g|%|ｍｇ))/gi));
        
        const labelPositions = labels.map(l => {
            let earliestPos = -1;
            for (const name of l.names) {
                const pos = text.indexOf(name);
                if (pos !== -1 && (earliestPos === -1 || pos < earliestPos)) {
                    earliestPos = pos;
                }
            }
            return { key: l.key, pos: earliestPos };
        }).filter(l => l.pos !== -1);

        labelPositions.sort((a, b) => a.pos - b.pos);

        const result: DietSummary = {
            calories: 0, calories_target: 0,
            protein: 0, protein_target: 0,
            fat: 0, fat_target: 0,
            carbs: 0, carbs_target: 0,
            sugar: 0, sugar_target: 0,
            fiber: 0, fiber_target: 0,
            salt: 0, salt_target: 0
        };

        labelPositions.forEach((label, index) => {
            if (ratioMatches[index]) {
                const intake = parseFloat(ratioMatches[index][1]);
                const target = parseFloat(ratioMatches[index][2]);
                result[label.key as keyof DietSummary] = intake;
                result[`${label.key}_target` as keyof DietSummary] = target;
            }
        });

        console.log('Final Parsed Nutrients (Intake & Target):', result);
        return result;
    }
}

export const visionService = new VisionService();
