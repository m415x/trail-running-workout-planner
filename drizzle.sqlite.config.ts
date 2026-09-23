import { resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'
import config from './drizzle.config'

// Schema and migration paths belong to the repository; sqlite.db belongs to
// the caller's working directory so isolated verification never targets dev data.
export default defineConfig({
  ...config,
  schema: (Array.isArray(config.schema) ? config.schema : [config.schema])
    .filter((schemaPath): schemaPath is string => typeof schemaPath === 'string')
    .map(schemaPath => resolve(import.meta.dirname, schemaPath)),
  out: resolve(import.meta.dirname, 'drizzle/sqlite'),
  dbCredentials: { url: 'sqlite.db' },
})
