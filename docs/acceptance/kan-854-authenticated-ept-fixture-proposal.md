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