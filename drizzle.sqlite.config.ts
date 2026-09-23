import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'
import config from './drizzle.config'

const configDirectory = dirname(fileURLToPath(import.meta.url))

// Schema and migration paths belong to the repository; sqlite.db belongs to
// the caller's working directory so isolated verification never targets dev data.
export default defineConfig({
  ...config,
  schema: (Array.isArray(config.schema) ? config.schema : [config.schema])
    .filter((schemaPath): schemaPath is string => typeof schemaPath === 'string')
    .map(schemaPath => resolve(configDirectory, schemaPath)),
  out: resolve(configDirectory, 'drizzle/sqlite'),
  dbCredentials: { url: 'sqlite.db' },
})
