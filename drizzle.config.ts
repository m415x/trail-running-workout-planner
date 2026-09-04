import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: ['./db/schema.ts', './db/load-strategy-schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'sqlite.db',
  },
})
