# KAN-854/T4 — Mapping focal de superficies reales

Estado: discovery, no aceptación HTTP acreditada.

| Superficie | Artefactos reales | Observación |
|---|---|---|
| Selección activa de Team | `app/actions/team-context-actions.ts`: `selectActiveTeamAction` → `requireAuthenticatedEptAction` → `createActiveTeamNextServerContext().select` | FormData `teamId` validado en servidor; cookie solamente si `accepted`; no fabricar action ID |
| Creación manual de sesión | `app/[locale]/dashboard/sessions/new/page.tsx` → `features/sessions/components/SessionForm` → `app/actions/session-actions.ts` | Formulario React real; H2/H3/H4A desde acciones; antes de HTTP localizar acción concreta en componente |
| Revisión PG de planificación | `app/[locale]/dashboard/planning/[planId]/review/page.tsx` → `createCoachSessionReviewSnapshot`, `readCoachSessionReviewSnapshot`, `CoachPostgresSnapshotReview` → `SessionGenerationPreview` | La página crea una revisión por `<form action={async formData => {'use server'; ...}}>` y renderiza snapshot persistido; se requieren planId y snapshotId autorizados reales |
| Endpoint legado de generación | `app/actions/session-generation-actions.ts`: `persistGeneratedSessions` | Retirado: retorna error fail-closed; no usar como prueba de flujo vigente |

## Reglas de aceptación HTTP pendientes
- Reutilizar subject Supabase auténtico, EPT sintético explícito, y misma aplicación/fixture entre variantes B/C; la prueba previa de upgrade 16.4.3 por sí solo no resuelve loop IPv4.
- Obtener URLs, FormData y Server Action binding desde renderizado real; no reproducir cabeceras, action IDs ni plan IDs supuestos.
- Verificar al llegar al boundary real: H2 autenticado, Team vigente, capability y alcance. Si el routing evita alcanzar el endpoint, clasificar BLOCKED/INCONCLUSIVE.
- Medir cookies y revalidaciones únicamente en superficies que efectivamente las usan. Guardar snapshots DB antes/después para DENY de escritura. No atribuir cobertura HTTP a tests en memoria.

Este mapping no crea identidades, acciones, sesiones, ni cambia datos operativos.

## T4 — SessionForm: binding productivo verificado estáticamente

Se aprueba la sustitución de `selectActiveTeamAction` por la superficie ya montada `/dashboard/sessions/new` y, con prefijo explícito, `/en/dashboard/sessions/new`. `selectActiveTeamAction` queda `MISSING_RENDERED_FORM / HTTP_NOT_EXECUTABLE` y conserva únicamente su evidencia previa de boundary.

- `app/[locale]/dashboard/sessions/new/page.tsx` importa y monta `SessionForm` y obtiene opciones mediante `getSessionFormOptions()`. El dashboard exige sesión H2, audiencia Coach y proyección H3/H4A.
- `features/sessions/components/SessionForm.tsx` es cliente React: `useActionState(session ? updateSession : createSession, initialState)`; en la ruta `new`, `session` no está definido, por lo que la acción productiva seleccionada es **`createSession`**. El DOM del formulario se produce con `<form action={handleValidatedAction} onSubmit={handleSubmit}>`, donde la función cliente valida y normaliza los campos y finalmente invoca `formAction(formData)`. **No asumir que la referencia de Server Action está disponible como atributo HTML sin hidratación**; determinar binding y serialización con navegador real o payload observado de Next, nunca mediante ID inventado.
- Campos base: `locale,date,title,type,workoutId,locationKey,trackPath,preliminaryExercises,warmup,mainBlock,cooldown,notes`; edición agrega `sessionId`, no forma parte de CREATE.
- Por cada microciclo seleccionado: `prescriptionMicrocycleId` (repetido), `prescriptionGroupId:<microcycleId>`, `distanceKm:<microcycleId>`, `durationMin:<microcycleId>`, `elevationGain:<microcycleId>`, `intensityMethod:<microcycleId>`, `zone:<microcycleId>`, `referencePercentage:<microcycleId>`, `prescriptionNotes:<microcycleId>`.
- El cliente bloquea envío si no hay microciclo seleccionado o si la fecha cae fuera de su semana. `createSession` valida Zod y parser antes de `planningReadAccess`, luego requiere H2 autenticado, H3 Team resuelto, H4A `planning.manage` por cada grupo existente del Team, referencias de microciclo/fecha y solo entonces inserta `sessions` + `group_session_prescriptions` en transacción SQLite. Éxito llama `revalidatePath` y `redirect`; DENY temprano retorna código de error sin hacerlo.
- Por tanto un fixture con solo User, Link, Team y Coach Membership no basta para **submit positivo**: se necesitan Sporting Group + plan/macrocycle/mesocycle/microcycle de aceptación completos y válidos, derivados de la UI real y la DB temporal. Esas entidades no se fabricarán para obtener GREEN sin especificar contrato. La negativa temprana de H2 sí podría ejercerse sin ellas si la ruta es accesible.
- `NEXT_PUBLIC_SUPABASE_*` y subject acreditado previamente no sustituyen una cookie SSR auténtica, y la configuración del backend `EPT_IDENTITY_BACKEND` debe ser `sqlite` explícita o valor por defecto. Ambos runtimes requieren misma aplicación, contenido de fixture equivalente y origen/puerto aislados.

**Estado:** código de binding localizado; referencia de Server Action derivada de renderizado real **NO CAPTURADA**, HTTP B/C **NO EJECUTADO**, cobertura T4 pendiente. No hay autorización para construir action IDs sintéticos ni interpretar un loop anterior a H2 como DENY.
