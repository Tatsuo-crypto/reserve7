const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function run() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.log('No credentials');
        return;
    }
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/calendar.readonly']
    );
    const calendar = google.calendar({ version: 'v3', auth });
    const calendars = [process.env.GOOGLE_CALENDAR_ID_1, process.env.GOOGLE_CALENDAR_ID_2].filter(Boolean);

    for (const calId of calendars) {
        console.log('--- Checking calendar:', calId, '---');
        try {
            const res = await calendar.events.list({
                calendarId: calId,
                timeMin: '2025-10-01T00:00:00Z',
                timeMax: '2026-01-31T23:59:59Z',
                singleEvents: true,
                orderBy: 'startTime'
            });
            console.log('Found', res.data.items.length, 'events');
            if (res.data.items.length > 0) {
                res.data.items.forEach(e => {
                    const start = e.start.dateTime || e.start.date;
                    console.log(`[${start}] ${e.summary}`);
                });
            }
        } catch (e) {
            console.error('Error for', calId, ':', e.message);
        }
    }
}
run();
