# KAN-646/T5 — Discovery regional y boundary biométrico PostgreSQL (2026-10-17)

## Estado de evidencia
PG-0 a PG-6 fueron confirmados GREEN por operador sobre laboratorio descartable `kan646_biometric_disposable`. PG-6 demuestra default-deny de RLS sin policies para rol ordinario; NO prueba rol productivo ni autorización H2/H3.

## Fuentes verificadas en rama KAN-646
- `lib/physiology/biometric-self-next-server.ts`: `resolveBiometricSelfAuthority('manage')` obtiene sesión autenticada mediante H2 y contexto H5A/active Team; solo emite User, Team y AthleteProfile resueltos server-side; deny ante ausencia/fallo.
- `lib/authorization/h5a-self-next-server.ts`: reutiliza contexto Team activo y evidencia H4A, sin aceptar Team del cliente.
- `lib/physiology/biometric-self-sqlite-server-writer.ts`: recibe `serverContext.timeZone` por dependencia del compositor; no acredita la procedencia autorizada del valor. No puede elevarse a superficie pública.
- `lib/physiology/biometric-regional-civil-date.ts`: valida identificador IANA a través de Intl y transforma instante server-side a YYYY-MM-DD; **no resuelve precedencia, ámbito Team ni fallback**.
- `db/supabase/schema.ts`: sin campo regional/timeZone en `teams` ni `athlete_profiles` en el esquema inspeccionado.
- `service/weather/open-meteo.ts`: `timezone: 'America/Argentina/San_Juan'` para proveedor meteorológico y coordenadas default San Juan. Es una constante de API meteorológica, NO un contrato autorizado de biometría ni regla multi-Team.
- `lib/physiology/biometric-self-postgres-authorized-repository.ts`: reautoriza `physiology.biometric.self.manage` mediante membresía y perfil persistidos dentro de la transacción antes incluso de replay; la API no es una Server Action ni valida H2 por sí sola.

## Discrepancia material de producto/arquitectura — BLOQUEA elección de fecha civil

No se verificó una fuente *autoritativa* de zona horaria biométrica por Team, ni precedencia aprobada para ausencia/ambigüedad. Alternativas técnicamente diferentes:
1. **Configuración IANA persistida por Team**: Team selecciona zona server-side; se requiere contrato de persistencia, migración y manejo fail-closed de ausencia o ambigüedad. Permite equipos en diferentes zonas.
2. **Zona única institucional/fija server-side**: política explícita para todos los Teams, p.ej. `America/Argentina/San_Juan`, pero esa constante hoy pertenece a meteorología y no puede reutilizarse como autoridad biométrica por inferencia.
3. **Regionalidad heredada de otra entidad**: requiere identificar propiedad, precedencia y unicidad verificables. No demostrada.

Ninguna alternativa tiene precedencia respaldada por el código inspeccionado. **No introducir fallback automático a reloj UTC, zona del host, timezone del cliente ni constante del clima.** Falta decisión aprobada; solicitar elección material antes de implementar composición de fecha del boundary.

## Contrato de composición delimitado, independiente de la decisión regional
- Una capa privada Next server-only construye `createBiometricSelfWriter`; `authorize` llama `resolveBiometricSelfAuthority('manage')` por cada operación para asegurar H2 autenticado, Team activo y SELF propio.
- El writer valida allowlist `kind/unit/value`, fecha civil `observedOn`, operación y referencia de corrección.
- `today` se calcula del instante de servidor utilizando **solamente** una zona IANA determinada desde una fuente confiable y sin ambigüedad; si falta, **denied/unavailable sin escrituras**, nunca `client.timeZone`.
- `persist`/`correct` invocan repositorio PostgreSQL autorizado, que relee membresía y AthleteProfile dentro de `client.begin(tx)`, antes de replay. DENY, conflict, invalid => no-write.
- No aceptar UserId, TeamId, AthleteProfileId o timezone como autoridad de parámetros client-facing. No habilitar Server Action pública antes de gates.
- Tests negativos planificados: sesión ausente, cambio Team, membresía revocada, perfil ajeno/inexistente/ambiguo, fecha y payload fuera allowlist; no-write durable. Prueba de rollback posterior a INSERT válido **dentro del repositorio autorizado** todavía pendiente, diferente de PG-4 (motor).

## Próximo checkpoint
Decidir fuente regional autorizada y sus reglas de ausencia/ambigüedad. Recién entonces RED focal de composición productiva con expectativa fail-closed ante región no resoluble. Mantener PostgreSQL KAN-646 exclusivo, guard y separación de roles; no reabrir PG-0..PG-6 sin regresión.
