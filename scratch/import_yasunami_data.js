const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const rawData = `
2026/03/13 6:04:03	69.7	⚪︎	12,363
2026/03/14 21:48:50	69.5	×	8,871
2026/03/14 21:50:36	68.2	⚪︎	3,042
2026/03/15 20:26:16	69.9	⚪︎	1,502
2026/03/16 21:18:01	69.9	⚪︎	8,512
2026/03/17 21:15:41	69.6	⚪︎	7,585
2026/03/18 20:39:41	68.8	×	10,692
2026/03/19 20:48:12	68.9	⚪︎	10,998
2026/03/20 18:22:22	69.4	⚪︎	8,143
2026/03/21 23:23:22	69.1	⚪︎	1,521
2026/03/22 19:44:29	69.2	⚪︎	1,505
2026/03/23 21:24:20	69.3	⚪︎	11,090
2026/03/24 22:29:29	68.8	⚪︎	7,145
2026/03/25 23:19:42	68.4	⚪︎	9,342
2026/03/26 21:28:37	68.2	⚪︎	7,815
2026/03/28 1:58:25	68.2	⚪︎	7,303
2026/03/29 6:15:30	68.2	⚪︎	13,931
2026/03/29 23:23:42	68.2	⚪︎	6,841
2026/03/30 22:16:52	68.1	⚪︎	8,403
2026/03/31 23:31:29	68.6	⚪︎	10,109
2026/04/01 20:53:30	68.3	⚪︎	12,743
2026/04/02 22:35:21	68	⚪︎	8,104
2026/04/04 0:19:05	68.8	⚪︎	8,978
2026/04/04 20:11:15	67.7	×	1,822
2026/04/05 21:04:22		⚪︎	7,410
2026/04/06 20:45:33	68.5	⚪︎	8,101
2026/04/07 21:26:44	68.6	×	7,694
2026/04/08 19:48:37	68	⚪︎	7,775
2026/04/11 7:49:46	68	⚪︎	8,876
2026/04/11 7:54:24	68	⚪︎	5,986
2026/04/11 22:47:45	68.2	⚪︎	3,989
2026/04/12 22:02:28	67.7	⚪︎	1,328
2026/04/13 21:47:55	68.2	⚪︎	8,254
2026/04/14 22:39:31	67.9	⚪︎	8,911
2026/04/15 22:21:20	68.1	⚪︎	7,508
2026/04/16 21:39:00	68.1	×	5,339
2026/04/17 23:29:37	68.1	⚪︎	8,124
2026/04/18 23:19:59	68.3	⚪︎	4,943
2026/04/19 21:28:50	67.8	⚪︎	2,184
2026/04/20 23:22:13	68.1	×	7,820
2026/04/21 21:44:49	68.1	⚪︎	8,941
2026/04/22 22:27:00	68.4	⚪︎	8,549
2026/04/23 23:11:31	68.4	⚪︎	5,689
`

const userId = '039c12e6-6a44-4d36-b614-74c357a184e9'

async function importData() {
  const lines = rawData.trim().split('\n')
  const dataByDate = {}

  for (const line of lines) {
    // Regex to handle tabs/spaces and the specific format
    // Date Time Weight Mark Steps
    const parts = line.split(/\t|\s+/)
    if (parts.length < 3) continue

    const dateStr = parts[0].replace(/\//g, '-') // yyyy-mm-dd
    const weightStr = parts[2]
    const stepsStr = parts[parts.length - 1].replace(/,/g, '')

    const weight = weightStr === '⚪︎' || weightStr === '×' ? null : parseFloat(weightStr)
    const steps = parseInt(stepsStr)

    // For same date, later entry in the list wins
    dataByDate[dateStr] = {
      user_id: userId,
      date: dateStr,
      weight: isNaN(weight) ? null : weight,
      steps: isNaN(steps) ? 0 : steps,
      updated_at: new Date().toISOString()
    }
  }

  const entries = Object.values(dataByDate)
  console.log(`Prepared ${entries.length} records for import.`)

  for (const entry of entries) {
    const { data: existing, error: fetchError } = await supabase
      .from('lifestyle_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('date', entry.date)
      .maybeSingle()

    if (fetchError) {
      console.error(`Error checking date ${entry.date}:`, fetchError)
      continue
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('lifestyle_logs')
        .update(entry)
        .eq('id', existing.id)
      
      if (updateError) console.error(`Error updating ${entry.date}:`, updateError)
      else console.log(`Updated ${entry.date}`)
    } else {
      const { error: insertError } = await supabase
        .from('lifestyle_logs')
        .insert(entry)
      
      if (insertError) console.error(`Error inserting ${entry.date}:`, insertError)
      else console.log(`Inserted ${entry.date}`)
    }
  }

  console.log('Import completed.')
}

importData()
