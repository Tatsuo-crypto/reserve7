const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeName(s) {
    if (!s) return '';
    return s.replace(/[\s\u3000]/g, '').replace(/[﨑]/g, '崎').replace(/[髙]/g, '高').replace(/様$/, '');
}

function extractLastName(fullName) {
    if (!fullName) return '';
    const nameParts = fullName.split(/\s|　/);
    return nameParts[0] || fullName;
}

function getPlanMaxCount(plan) {
    if (!plan) return 4;
    if (plan === 'ダイエットコース') return 8;
    const m = plan.match(/(\d+)\s*回/);
    if (m && m[1]) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    if (plan.includes('8回')) return 8;
    if (plan.includes('6回')) return 6;
    if (plan.includes('2回')) return 2;
    return 4;
}

function usesCumulativeCount(plan) {
    if (!plan) return false;
    const normalized = plan.trim().toLowerCase();
    return plan.includes('ダイエット') || normalized.includes('diet') ||
        plan.includes('カウンセリング') || normalized.includes('counseling');
}

async function run() {
    console.log('--- Enhanced Sync: Google Calendar to Supabase ---');

    // 1. Fetch Users
    const { data: users, error: userError } = await supabase.from('users').select('id, full_name, email, plan');
    if (userError) throw userError;
    console.log(`Loaded ${users.length} users.`);

    // 2. Setup Google Calendar
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) throw new Error('No Google credentials');
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/calendar.readonly']
    );
    const calendar = google.calendar({ version: 'v3', auth });

    const calendars = [
        { id: process.env.GOOGLE_CALENDAR_ID_1, storeId: '77439c86-679a-409a-8000-2e5297e5c0e8' },
        { id: process.env.GOOGLE_CALENDAR_ID_2, storeId: '43296d78-13f3-4061-8d75-d38dfe907a5d' }
    ].filter(c => c.id);

    // 3. Clear existing reservations in the period
    console.log('Clearing existing reservations (2025-10 to 2026-01)...');
    await supabase.from('reservations')
        .delete()
        .gte('start_time', '2025-10-01T00:00:00Z')
        .lte('start_time', '2026-01-31T23:59:59Z');

    let stats = { total: 0, mappedByTitle: 0, mappedByDescEmail: 0, mappedByDescName: 0, blocked: 0, trial: 0, guest: 0, unknown: 0 };
    const affectedUserIds = new Set();

    for (const cal of calendars) {
        console.log(`Processing ${cal.id}...`);
        try {
            const res = await calendar.events.list({
                calendarId: cal.id,
                timeMin: '2025-10-01T00:00:00Z',
                timeMax: '2026-01-31T23:59:59Z',
                singleEvents: true,
                orderBy: 'startTime'
            });

            const events = res.data.items || [];
            for (const event of events) {
                if (event.status === 'cancelled') continue;
                if (!event.start.dateTime) continue;

                stats.total++;
                const summary = event.summary || '';
                const description = event.description || '';
                const startTime = event.start.dateTime;
                const endTime = event.end.dateTime;

                let clientId = null;
                let clientMatchFound = false;

                // Priority 1: Check Description for Email
                const emailMatch = description.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) {
                    const email = emailMatch[0].toLowerCase();
                    const user = users.find(u => u.email.toLowerCase() === email);
                    if (user) {
                        clientId = user.id;
                        clientMatchFound = true;
                        stats.mappedByDescEmail++;
                    }
                }

                // Priority 2: Check Summary (Title) for User Name
                if (!clientMatchFound) {
                    const nSummary = normalizeName(summary);
                    const namePart = nSummary.match(/^[a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/)?.[0];
                    if (namePart && namePart.length >= 2) {
                        const user = users.find(u => {
                            const nFullName = normalizeName(u.full_name);
                            return nFullName.includes(namePart) || namePart.includes(nFullName);
                        });
                        if (user) {
                            clientId = user.id;
                            clientMatchFound = true;
                            stats.mappedByTitle++;
                        }
                    }
                }

                // Priority 3: Check Description for Name
                if (!clientMatchFound) {
                    const descNameMatch = description.match(/クライアント:\s*([^\s(]+)/);
                    if (descNameMatch) {
                        const namePart = normalizeName(descNameMatch[1]);
                        const user = users.find(u => {
                            const nFullName = normalizeName(u.full_name);
                            return nFullName.includes(namePart) || namePart.includes(nFullName);
                        });
                        if (user) {
                            clientId = user.id;
                            clientMatchFound = true;
                            stats.mappedByDescName++;
                        }
                    }
                }

                // Categorization for non-matches
                if (!clientMatchFound) {
                    if (summary.includes('予約不可') || summary.includes('研修') || summary.includes('休み') || summary.includes('学校') || summary.includes('病院') || summary.includes('歯医者')) {
                        stats.blocked++;
                    } else if (summary.includes('体験') || summary.includes('カウンセリング')) {
                        stats.trial++;
                    } else if (summary.includes('ゲスト')) {
                        stats.guest++;
                    } else {
                        stats.unknown++;
                    }
                }

                if (clientId) affectedUserIds.add(clientId);

                // Clean description: remove "クライアント: Name (email)" pattern
                let cleanNotes = description;
                if (cleanNotes) {
                    // Remove "クライアント: xxxx (xxxx@xxx.xxx)" pattern
                    cleanNotes = cleanNotes.replace(/クライアント:\s*[^\(]+\s*\([^\)]+\)\s*/g, '').trim();
                    // Also remove standalone "クライアント: xxxx" pattern
                    cleanNotes = cleanNotes.replace(/クライアント:\s*[^\n]+/g, '').trim();
                    if (cleanNotes === '') cleanNotes = null;
                }

                // Insert
                await supabase.from('reservations').insert({
                    client_id: clientId,
                    title: summary,
                    start_time: startTime,
                    end_time: endTime,
                    notes: cleanNotes,
                    calendar_id: cal.id,
                    external_event_id: event.id
                });
            }
        } catch (e) {
            console.error(`Error ${cal.id}:`, e.message);
        }
    }

    console.log('Results:', JSON.stringify(stats, null, 2));
    console.log(`Initial sync complete. Found ${affectedUserIds.size} unique users.`);

    // 4. Recalculate and update titles/counts
    console.log('--- Recalculating Titles/Counts ---');
    for (const clientId of affectedUserIds) {
        const user = users.find(u => u.id === clientId);
        if (!user) continue;

        const { data: reservations } = await supabase
            .from('reservations')
            .select('id, start_time, title')
            .eq('client_id', clientId)
            .order('start_time', { ascending: true });

        if (!reservations || reservations.length === 0) continue;

        const lastName = extractLastName(user.full_name);
        const plan = user.plan || '';
        const maxCount = getPlanMaxCount(plan);
        const isCumulative = usesCumulativeCount(plan);

        // Group by month for non-cumulative plans
        const reservationsByMonth = {};
        if (!isCumulative) {
            reservations.forEach(r => {
                const date = new Date(r.start_time);
                const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                if (!reservationsByMonth[monthKey]) reservationsByMonth[monthKey] = [];
                reservationsByMonth[monthKey].push(r);
            });
        }

        if (isCumulative) {
            for (let i = 0; i < reservations.length; i++) {
                const newTitle = `${lastName}${i + 1}`;
                await supabase.from('reservations').update({ title: newTitle }).eq('id', reservations[i].id);
            }
        } else {
            for (const monthKey in reservationsByMonth) {
                const monthReservations = reservationsByMonth[monthKey];
                for (let i = 0; i < monthReservations.length; i++) {
                    const newTitle = `${lastName}${i + 1}/${maxCount}`;
                    await supabase.from('reservations').update({ title: newTitle }).eq('id', monthReservations[i].id);
                }
            }
        }
    }

    console.log('--- All Titles Recalculated ---');
}

run().catch(console.error);
