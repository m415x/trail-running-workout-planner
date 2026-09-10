import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as coreSchema from '@/db/supabase/schema'
import * as competitionEntrySchema from '@/db/supabase/competition-entry-schema'

const connectionString = process.env.SUPABASE_DATABASE_URL

if (!connectionString) {
  throw new Error('SUPABASE_DATABASE_URL no está configurada')
}

// Supavisor transaction mode no admite prepared statements.
export const supabaseClient = postgres(connectionString, {
  prepare: false,
  max: 1,
})

export const supabaseDb = drizzle(supabaseClient, {
  schema: {
    ...coreSchema,
    ...competitionEntrySchema,
  },
})
