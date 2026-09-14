import { defineConfig } from 'drizzle-kit'
import config from './drizzle.config'

// Keep the SQLite journal separate from the existing PostgreSQL chain.
export default defineConfig({ ...config, out: './drizzle/sqlite' })
