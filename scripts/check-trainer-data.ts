
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkData() {
  console.log('--- Stores ---')
  const { data: stores, error: storesError } = await supabase.from('stores').select('id, name, email')
  if (storesError) console.error(storesError)
  else console.table(stores)

  console.log('\n--- Trainers ---')
  const { data: trainers, error: trainersError } = await supabase.from('trainers').select('id, full_name, email, store_id, google_calendar_id')
  if (trainersError) console.error(trainersError)
  else console.table(trainers)
}

checkData()
