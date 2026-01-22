// Test script to verify Google Calendar integration
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function testGoogleCalendarAccess() {
    console.log('=== Testing Google Calendar Access ===\n');

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not set');
        return;
    }

    try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        const auth = new google.auth.JWT(
            credentials.client_email,
            undefined,
            credentials.private_key,
            ['https://www.googleapis.com/auth/calendar']
        );

        const calendar = google.calendar({ version: 'v3', auth });

        // Test access to both calendars
        const calendarIds = [
            process.env.GOOGLE_CALENDAR_ID_1,
            process.env.GOOGLE_CALENDAR_ID_2
        ].filter(Boolean);

        for (const calendarId of calendarIds) {
            console.log(`\nTesting calendar: ${calendarId}`);

            try {
                // Try to list recent events
                const response = await calendar.events.list({
                    calendarId: calendarId,
                    timeMin: new Date().toISOString(),
                    maxResults: 1,
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                console.log(`✅ Access OK - Found ${response.data.items?.length || 0} upcoming events`);

                // Try to create a test event
                const testEvent = {
                    summary: '[TEST] Calendar Integration Test',
                    description: 'This is a test event created by the integration test script',
                    start: {
                        dateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
                        timeZone: 'Asia/Tokyo',
                    },
                    end: {
                        dateTime: new Date(Date.now() + 5400000).toISOString(), // 1.5 hours from now
                        timeZone: 'Asia/Tokyo',
                    },
                };

                const createResponse = await calendar.events.insert({
                    calendarId: calendarId,
                    requestBody: testEvent,
                });

                const eventId = createResponse.data.id;
                console.log(`✅ Test event created: ${eventId}`);

                // Delete the test event immediately
                await calendar.events.delete({
                    calendarId: calendarId,
                    eventId: eventId,
                });

                console.log(`✅ Test event deleted successfully`);

            } catch (error) {
                console.error(`❌ Error accessing calendar ${calendarId}:`, error.message);
                if (error.response) {
                    console.error('Response data:', error.response.data);
                }
            }
        }

        console.log('\n=== Test Complete ===');

    } catch (error) {
        console.error('❌ Fatal error:', error);
    }
}

testGoogleCalendarAccess();
