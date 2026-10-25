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