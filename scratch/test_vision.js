
const { google } = require('googleapis');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

async function testVision() {
    try {
        const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!key) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not found');
            return;
        }

        const credentials = JSON.parse(key);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const vision = google.vision({ version: 'v1', auth });
        
        console.log('Testing Vision API with a simple request...');
        
        // Use a tiny transparent pixel as a test image
        const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        
        const request = {
            image: { content: testImage.toString('base64') },
            features: [{ type: 'TEXT_DETECTION' }],
        };

        const response = await vision.images.annotate({
            requestBody: { requests: [request] },
        });

        console.log('✅ API call successful!');
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ API call failed!');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.errors) {
            console.error('Detailed errors:', JSON.stringify(error.errors, null, 2));
        }
    }
}

testVision();
