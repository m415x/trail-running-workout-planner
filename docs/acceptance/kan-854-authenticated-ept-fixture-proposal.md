# KAN-854/T3 — Propuesta de fixture EPT autenticado

**Estado: PROPUESTO, NO APROBADO. Ninguna escritura de identidad autorizada.**

## Evidencia
Supabase Auth con identidad dedicada y cookies SSR: acreditado. La base EPT del clon nuevo no existe; el discovery read-only devolvió acceptance-source-not-found. El esquema SQLite temporal ya está acreditado SCHEMA_READY, pero no contiene usuarios, links, Team ni membresías. Los UUID de H4B son fixtures, no evidencia de cuentas Supabase.

## Contrato propuesto (sujeto a aprobación)
1. Sujeto: usar únicamente el UUID devuelto por la autenticación Supabase real. Nunca guardar o publicar contraseñas, tokens o valores de cookies.
2. Usuario EPT: preferir un User existente recuperado de una fuente de aceptación verificada y consultada read-only. Si no existe, proponer un User exclusivamente de prueba en SQLite temporal, rotulado inequívocamente como sintético, sin atribuirle membresía operativa.
3. Link: insertar únicamente tras aprobación un ExternalIdentityLink activo provider=supabase, subject=UUID verificado, user_id=User de prueba; verificar colisiones, unicidad y ausencia de ambigüedades antes de escribir.
4. Team y TeamMembership: reutilizar únicamente si existe fuente acreditada; alternativamente proponer Team de aceptación aislado y membresía Coach vigente en ese Team, solo para escenario positivo aprobado.
5. Capabilities: inventariar boundaries H2/H3/H4A, capabilities y rutas concretas antes de definir grants; preset Coach no implica todos los permisos. Negative controls separados: unlinked, revoked, expirado, otro Team, insuficiente capability.
6. Aislamiento: transacción y DB local en directorio OS temp kan-854-*, nunca sqlite.db operativo, DB producción, Supabase Auth, pnpm lockfile ni repositorio. Preservar hash de migraciones, esquema y DB antes/después y controles integrity_check/foreign_key_check.
7. Idempotencia y reversibilidad: rechazar estado parcial o drift, no reusar identidades operativas sin acreditación, borrar fixture temporal al concluir. T3 sólo EPT_AUTHORIZED cuando la cadena Subject→Link→User→Team→Membership/capabilities esté probada.
8. HTTP: B y C reutilizan exactamente aplicación y fixture; Server Actions requieren formulario real, no identificador fabricado. Un loop de routing previo al boundary clasifica autorización como BLOCKED/INCONCLUSIVE.

## Pendientes obligatorios
Localizar, si existe, fuente EPT de aceptación legítima fuera del clon, con procedencia y lectura read-only. Inventariar los permisos específicos H2/H3/H4A. Solicitar aprobación explícita del fixture antes de cualquier INSERT en User, ExternalIdentityLink, Team o TeamMembership.

**KAN-854 T3 autorización EPT: BLOCKED. Ningún aprovisionamiento realizado.**

## Anexo de discovery H2/H3/H4A (sin aprovisionamiento)

Fuentes verificadas: `lib/auth/ept-session-access.ts`, `server-session-identity.ts`, `require-authenticated-action.ts`, `lib/authorization/active-team-context.ts`, `active-team-selection.ts`, `active-team-next-server.ts`, `h4a-active-team-authorization.ts`, `h4a-authorization-adapter.ts`, `h4a-next-server-authorization.ts`, `effective-authorization.ts`, `capability-catalog.ts`, `scope-resolution.ts` y `app/actions/team-context-actions.ts`, `app/actions/session-actions.ts`.

| Frontera/operación | Actor y datos mínimos del fixture | Decisión positiva | DENY/BLOCKED negativos |
|---|---|---|---|
| H2 / acceso EPT y Action | Cuenta Supabase real, subject comprobado; exactamente un `external_identity_links(provider=supabase,subject,user_id)` activo y User no eliminado | `authenticated` con userId interno, jamás inferido del email | Sin link `unlinked`; múltiples, borrados o subject inválido `invalid`; acciones `forbidden` antes de H3 |
| H3 / contexto y `selectActiveTeamAction` | Team de aceptación y exactamente una TeamMembership vigente para actor/Team; al seleccionar Team se valida pertenencia, no el teamId presentado | `resolved` por cookie `ept_active_team` válida o membresía única; select `accepted` y revalidación | Revocada, `isActive=false`, eliminada o expirada: `invalid_context/rejected`; dos equipos sin selección `selection_required`; Team ajeno `rejected` |
| H4A / autorización sobre recurso de Team | Evidencia membership con preset explícito, recurso `resource.teamId` del mismo Team, capability solicitada y alcance permitido; grants sólo si válidos y delegables | `allowed` únicamente con capacidad efectiva + scope; actor nunca viene del cliente | Sin capability, membership ambigua, recurso cross-Team, grant revocado o scope incompatible: `allowed:false` |
| H4A / gestión de sesiones de Coach (operación candidata) | `coach` con `planning.manage`, Team activo, sesión/grupo/microciclo del mismo Team; boundary y validadores específicos en `app/actions/session-actions.ts` | Acción permitida solo tras H2→H3→H4A y contrato de dominio | Coach de Team ajeno, assistant sin `planning.manage`, falta de contexto o parámetro fuera del dominio: DENY sin mutación |
| H4A / selección de equipo (Server Action real) | Formulario auténtico enlazado a `selectActiveTeamAction` con `teamId` existente; sesión SSR real | Cookie de Team válida solo tras validar pertenencia H3 | Team ajeno o membership vencida: `rejected/forbidden`; no cambio de cookie/revalidación |

Catálogo de capabilities demostrado en `capability-catalog.ts`: `planning.manage` y `competition.manage` corresponden al preset base **coach**; `training.coordinate` es delegable con controles de grants; `athlete.admin.manage` corresponde a assistant/coach/admin; `team_membership.manage` es estructural y corresponde solo a **admin**. Los presets no son jerárquicos. H4A precisa seleccionar operación y scope requerido: `team`, `sporting_group` o `self`; `assigned_athletes` está reservado y siempre deniega. `self` exige AthleteProfile enlazado en el mismo Team. Se prohíbe conceder capabilities suplementarias por defecto.

**Matriz mínima de actores:** (P1) sujeto Supabase real con User EPT experimental vinculado, Team de prueba, TeamMembership **coach** vigente — positivo de `planning.manage` en recurso del mismo Team; (N1) mismo subject sin ExternalIdentityLink — unlinked; (N2) membership revocada/vencida — DENY H3; (N3) **assistant** activo sin `planning.manage` — DENY H4A, sin grants; (N4) coach de Team A con recurso Team B — DENY cross-Team; (N5) Team/contexto ambiguo — selección requerida, nunca Team implícito. Estos son estados alternativos en copias desechables, no cambios simultáneos sobre el mismo actor vivo.

**No mutación en DENY:** capturar snapshots/hash de filas objeto (sessions, grupos, planning, registros de modificación), tabla `authorization_grants` y estado de selección de Team antes/después según operación. Comprobar que boundary deniega **antes de invocar** persistencia/revalidación y, para Server Actions reales, observar la cadena HTTP, cookies `Set-Cookie`, redirecciones y el estado SQLite. Distinguir denegación en H2/H3/H4A de routing que nunca alcanza el boundary; en este último caso autorización `BLOCKED/INCONCLUSIVE`, no FAIL.

**Estado de fuentes:** el discovery local del clon encontró ninguna SQLite original; únicamente una base temporal con esquema canónico vacío (`SCHEMA_READY`). No se identificó copia EPT externa recuperable con acceso probado. Si aparece respaldo legítimo, priorizarlo con inventario read-only y copia auditada. En ausencia, **propuesta** de User/Team/Membership experimentales, nunca presentados como autoridad operativa. Aprovisionamiento requiere aprobación explícita adicional y validación del sub real de Supabase. Las rutas finales HTTP de Coach adicionales deben confirmarse en el siguiente microcorte de surface mapping antes de seleccionar formularios; no se infieren aquí.
