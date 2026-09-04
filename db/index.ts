import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as coreSchema from '@/db/schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'

// Conexión a la base de datos local en un archivo sqlite.db
const sqlite = new Database('sqlite.db')

// Instancia de Drizzle con autocompletado, tipos y relaciones de todos los módulos del esquema
export const db = drizzle(sqlite, {
  schema: {
    ...coreSchema,
    ...loadStrategySchema,
  },
})
