import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
  schema: './db/supabase/schema.ts',
  out: './drizzle/supabase',
  dialect: 'postgresql',
  dbCredentials: {
    // `generate` no se conecta. `migrate` debe recibir la URL directa real.
    url: process.env.SUPABASE_DIRECT_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres',
  },
  strict: true,
  verbose: true,
})
