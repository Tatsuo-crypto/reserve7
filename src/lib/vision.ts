import { google } from 'googleapis';
import { env } from './env';

export interface DietSummary {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    sugar: number;
    fiber: number;
    salt: number;
}

export class VisionService {
    private vision: any;

    constructor() {
        try {
            if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                console.warn('⚠️ Google Service Account Key is not configured for Vision API');
                return;
            }
            const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
            const auth = new google.auth.JWT(
                credentials.client_email,
                undefined,
                credentials.private_key,
                ['https://www.googleapis.com/auth/cloud-platform']
            );
            this.vision = google.vision({ version: 'v1', auth });
            console.log('✅ Vision API initialized successfully');
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

            const [result] = await this.vision.images.annotate({
                requestBody: { requests: [request] },
            });

            const fullText = result.responses?.[0]?.fullTextAnnotation?.text || '';
            console.log('--- OCR Result Start ---');
            console.log(fullText);
            console.log('--- OCR Result End ---');

            return this.parseNutrients(fullText);
        } catch (error) {
            console.error('❌ Error in analyzeNutrients:', error);
            throw error;
        }
    }

    private parseNutrients(text: string): DietSummary {
        // Regular expressions based on the user's provided image format
        // Format: "1901/1900 kcal", "164.1/160.0g" etc.
        // The numerator is the intake, denominator is the target.

        // Normalize text (remove newlines and extra spaces)
        const normalizedText = text.replace(/\s+/g, ' ');

        return {
            calories: this.extractRatioValue(normalizedText, /カロリー\s*(\d+(?:\.\d+)?)\s*\/\s*\d+/),
            protein: this.extractRatioValue(normalizedText, /たんぱく質\s*(\d+(?:\.\d+)?)\s*\/\s*\d+/),
            fat: this.extractRatioValue(normalizedText, /脂質\s*(\d+(?:\.\d+)?)\s*\/\s*\d+/),
            carbs: this.extractRatioValue(normalizedText, /炭水化物\s*(\d+(?:\.\d+)?)\s*\/\s*\d+/),
            sugar: this.extractRatioValue(normalizedText, /糖質\s*(\d+(?:\.\d+)?)\s*\/\s*\d+/),
            fiber: this.extractRatioValue(normalizedText, /食物繊維\s*(\d+(?:\.\d+)?)\s*\/\s*\d+/),
            salt: this.extractRatioValue(normalizedText, /塩分\s*(\d+(?:\.\d+)?)\s*\/\s*\d+/),
        };
    }

    private extractRatioValue(text: string, regex: RegExp): number {
        const match = text.match(regex);
        if (match && match[1]) {
            return parseFloat(match[1]);
        }

        // Fallback: try to find just the number near the label if the ratio format isn't matched
        // Example: "カロリー 1901"
        const label = regex.source.split('\\s*')[0];
        const fallbackRegex = new RegExp(`${label}\\s*(\\d+(?:\\.\\d+)?)`);
        const fallbackMatch = text.match(fallbackRegex);

        return fallbackMatch ? parseFloat(fallbackMatch[1]) : 0;
    }
}

export const visionService = new VisionService();
