import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'

// Conexión a la base de datos local en un archivo sqlite.db
const sqlite = new Database('sqlite.db')

// Instancia de Drizzle con autocompletado y tipos
export const db = drizzle(sqlite, { schema })
