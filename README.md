# trail-running-workout-planner

Full-stack web application for trail running group management, workout planning, and runner metrics. Built with Next.js, React, Tailwind CSS, and Supabase.

## Project structure

```textplain
.
```
# Trail Running Workout Planner

## Base de datos

SQLite continúa siendo la base local de desarrollo. El esquema PostgreSQL equivalente y las migraciones destinadas a Supabase viven en `db/supabase` y `drizzle/supabase`.

1. Copiar `.env.example` como `.env.local` y completar las dos URLs desde **Connect** en Supabase.
2. Usar la conexión directa en `SUPABASE_DIRECT_URL` solamente para migraciones.
3. Usar el Shared Pooler en transaction mode en `SUPABASE_DATABASE_URL` para el runtime de Vercel.
4. Generar una migración con `pnpm db:generate:supabase`.
5. Revisar el SQL generado y aplicarlo con `pnpm db:migrate:supabase`.

Las variables no llevan el prefijo `NEXT_PUBLIC_`: son secretos exclusivos del servidor. La conexión de runtime desactiva prepared statements porque Supavisor transaction mode no los admite.
