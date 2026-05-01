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
            const annotations = result.responses?.[0]?.textAnnotations || [];
            
            if (annotations.length === 0) {
                return this.getEmptySummary();
            }

            // The first annotation is the full text
            const fullText = annotations[0].description || '';
            console.log('--- OCR Full Text ---');
            console.log(fullText);

            return this.parseNutrientsWithCoordinates(annotations);
        } catch (error) {
            console.error('❌ Error in analyzeNutrients:', error);
            throw error;
        }
    }

    private getEmptySummary(): DietSummary {
        return {
            calories: 0, calories_target: 0,
            protein: 0, protein_target: 0,
            fat: 0, fat_target: 0,
            carbs: 0, carbs_target: 0,
            sugar: 0, sugar_target: 0,
            fiber: 0, fiber_target: 0,
            salt: 0, salt_target: 0
        };
    }

    private parseNutrientsWithCoordinates(annotations: any[]): DietSummary {
        // 1. Extract all text blocks (skip the first full-text annotation)
        const blocks = annotations.slice(1).map(ann => {
            const verts = ann.boundingPoly?.vertices || [];
            if (verts.length < 4) return null;
            const centerX = verts.reduce((s: number, v: any) => s + (v.x || 0), 0) / verts.length;
            const centerY = verts.reduce((s: number, v: any) => s + (v.y || 0), 0) / verts.length;
            return { text: ann.description || '', x: centerX, y: centerY };
        }).filter(b => b !== null) as { text: string; x: number; y: number }[];

        if (blocks.length === 0) return this.getEmptySummary();

        // 2. Sort blocks into lines (y-coordinate based)
        // Group blocks that are within ~20 pixels vertically
        const sortedBlocks = [...blocks].sort((a, b) => {
            if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
            return a.x - b.x;
        });

        // 3. Reconstruct the text stream from sorted blocks
        const reconstructedText = sortedBlocks.map(b => b.text).join(' ');
        console.log('--- Reconstructed Text (Line-aware) ---');
        console.log(reconstructedText);

        // 4. Use the sequential "consume" logic on this reconstructed text
        const labels = [
            { key: 'calories', names: ['カロリー', '総エネルギー', 'エネルギー'] },
            { key: 'protein', names: ['たんぱく質', 'タンパク質', 'プロテイン'] },
            { key: 'fat', names: ['脂質', '脂肪'] },
            { key: 'carbs', names: ['炭水化物', '炭水'] },
            { key: 'sugar', names: ['糖質'] },
            { key: 'fiber', names: ['食物繊維', '繊維'] },
            { key: 'salt', names: ['塩分', '食塩相当量', '食塩', 'ナトリウム'] },
        ];

        // Find all "value / target" matches with their positions in the reconstructed text
        const matches = Array.from(reconstructedText.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g)).map(m => ({
            intake: parseFloat(m[1]),
            target: parseFloat(m[2]),
            index: m.index || 0
        }));

        // Find all label positions in the reconstructed text
        // Use regex to allow optional spaces between characters (common in OCR)
        const foundLabels = labels.map(l => {
            let earliestPos = -1;
            for (const name of l.names) {
                // Create a regex like "炭\s*水\s*化\s*物"
                const regexStr = name.split('').map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
                const regex = new RegExp(regexStr, 'i');
                const match = reconstructedText.match(regex);
                
                if (match && match.index !== undefined) {
                    if (earliestPos === -1 || match.index < earliestPos) {
                        earliestPos = match.index;
                    }
                }
            }
            return { key: l.key, pos: earliestPos };
        }).filter(l => l.pos !== -1);

        const result = this.getEmptySummary();
        const usedMatchIndices = new Set<number>();
        
        // Sort labels by their position in the reconstructed text
        foundLabels.sort((a, b) => a.pos - b.pos);

        foundLabels.forEach(label => {
            // Find the closest UNUSED match that appears AFTER the label
            const availableMatches = matches
                .map((m, idx) => ({ ...m, originalIndex: idx }))
                .filter(m => m.index > label.pos && !usedMatchIndices.has(m.originalIndex));

            if (availableMatches.length > 0) {
                // Pick the closest one
                const closestMatch = availableMatches.reduce((prev, curr) => 
                    (curr.index - label.pos < prev.index - label.pos) ? curr : prev
                );
                
                usedMatchIndices.add(closestMatch.originalIndex);
                result[label.key as keyof DietSummary] = closestMatch.intake;
                result[`${label.key}_target` as keyof DietSummary] = closestMatch.target;
            }
        });

        console.log('Final Parsed Nutrients:', result);
        return result;
    }
}

export const visionService = new VisionService();
