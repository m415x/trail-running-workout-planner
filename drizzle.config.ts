import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: [
    './db/schema.ts',
    './db/load-strategy-schema.ts',
    './db/intensity-strategy-schema.ts',
    './db/session-generation-preferences-schema.ts',
    './db/competition-entry-schema.ts',
  ],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'sqlite.db',
  },
})
