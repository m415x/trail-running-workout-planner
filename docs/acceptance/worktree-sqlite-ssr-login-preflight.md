# Worktree nuevo: login SSR `invalid` por SQLite equivocada (KAN-879, 2026-11-21)

> **Runbook operativo, no cambio de producto.** Aplicable a aceptación local autenticada H2/H3/H4A con Next.js + Supabase Auth + EPT SQLite. Leer antes de iniciar un servidor de aceptación en un worktree nuevo. Evidencia: Jira KAN-879 comentarios 14987–14991; antecedentes KAN-855 (14487, 14488, 14515) y KAN-869 (14673). No sustituye validaciones de identidad ni autorización.

## Síntoma y diagnóstico causal

- En `feat/KAN-593-vertical-prescriptions`, Supabase Auth independiente pasó `signInWithPassword`, `getClaims`, `getUser` y coincidencia de sujeto; el vínculo EPT Assistant en SQLite temporal y la membership activa de `team_1` pasaron. La evaluación H4A read-only denegó `planning.manage` para Assistant y permitió Coach.
- Sin embargo, POST auténtico del formulario de login Next.js devolvió HTTP 200 con RSC `{"status":"invalid"}` y una respuesta `Set-Cookie` que borraba cookie Supabase (`Max-Age=0`). HTTP 200 **no** era login exitoso.
- La inspección read-only de `db/index.ts` y los archivos locales encontró `SQLITE_SCENARIO_MODE` ausente, `EPT_IDENTITY_BACKEND` predeterminado `sqlite`, y `SQLITE_DATABASE_PATH` apuntando a un fixture válido. **Pero esa ruta sólo tiene efecto en runtime ordinario si `SQLITE_SCENARIO_MODE=1`.** Sin ese modo (y fuera de `NODE_TEST_CONTEXT`), `db/index.ts` abre `sqlite.db` relativo al `cwd`.
- Base del worktree: **0 bytes, 0 tablas**, sin `users`, `external_identity_links` ni `team_memberships`. Fixture temporal KAN-855: **806.912 bytes, 55 tablas** y exactamente un vínculo activo al Assistant. La discrepancia es suficiente para explicar un `invalid` fail-closed de la resolución EPT si Next heredó esa configuración. La inspección previa de `.env.local` **no demostraba** el entorno del proceso Next.
- **Resultado de la corrección:** tras detener Next y reiniciarlo desde la **misma terminal Git Bash** con el escenario SQLite activado y el fixture KAN-855, el operador confirmó **«Entró!»** para el login Assistant. PASS de login visual informado por operador, sin captura adicional del redirect HTTP, dashboard o claims SSR. No atribuir a esto DENY READ/UPDATE ni un gate integral.

## Preflight obligatorio antes de levantar Next en un worktree

1. Confirmar que el fixture es **descartable, preexistente y acreditado**, que contiene las migraciones necesarias, vínculo real Supabase subject→EPT y membresías. **Nunca** correr `pn db:seed:acceptance`, migraciones ni `db push` como intento de reparar un login `invalid`: podrían destruir la evidencia y la DB equivocada no es un fixture apto.
2. Verificar `pwd`, el worktree y la existencia del archivo temporal; comparar **sin escribir** el `sqlite.db` del worktree con la SQLite temporal (tamaño, `sqlite_master`, `external_identity_links`, `users`, `team_memberships`). No imprimir tokens, contraseñas, cookies ni sujetos de cuentas reales.
3. **Detener el servidor Next existente.** Desde la terminal Git Bash del worktree correspondiente, configurar y después iniciar Next **en esa misma terminal**:

```bash
export SQLITE_SCENARIO_MODE=1
export SQLITE_SEED_DISPOSABLE_ACK=1
export EPT_IDENTITY_BACKEND=sqlite
export SQLITE_DATABASE_PATH='/ruta/absoluta/ya-acreditada/sqlite.db'
export TSX_TSCONFIG_PATH="$PWD/tsconfig.json"
test -f "$SQLITE_DATABASE_PATH" || { echo "ERROR: fixture temporal ausente"; exit 1; }
test "$SQLITE_SCENARIO_MODE" = 1 || { echo "ERROR: scenario mode desactivado"; exit 1; }
pn exec next dev --hostname 0.0.0.0 --port 3000
```

La ruta es **ilustrativa**, no un valor para copiar literalmente. En Windows/Git Bash puede utilizarse la ruta absoluta Windows que consume Node, verificada con `fs.existsSync`. Evitar que otro proceso Next quede ocupando puerto 3000. No dejar esas exportaciones activas al ejecutar después gates normales en otros contextos: el harness ya documentó contaminación ambiental (KAN-855).
4. En un **perfil de navegador aislado**, autenticar con una cuenta de aceptación Supabase legítima y verificar login, destino de navegación y H2/H3/H4A según el contrato particular. Conservar snapshots antes/después de cualquier prueba de no-write. No usar IDs de Server Actions sintéticos, suplantación de Coach o bypass.
5. Si persiste `invalid` con entorno efectivo ya acreditado, discriminar `signInWithPassword` vs `getClaims/getUser` vs `resolveAuthenticatedEptIdentity` y revisar logs. Referencia independiente: KAN-638 comentarios 11941–11942 documentan JWT expirado por **reloj Windows desincronizado**, resuelto al sincronizar hora; no asumir que sea la causa de cada worktree (en KAN-879 el SDK autenticó 4/4).

## Evidencia/criterios de reporte

- **Configuración inspeccionada vs runtime:** `.env.local` leído desde otra shell y existencia de `SQLITE_DATABASE_PATH` no prueban el `sqlitePath` efectivo de Next. Controlar exportaciones y servidor desde la misma shell, más prueba SSR auténtica.
- Distinguir `Supabase Auth SDK PASS`, `EPT link SQLite PASS`, `H4A efectivo PASS`, `SSR login PASS` y `HTTP DENY no-write PASS`. Ninguno implica automáticamente los siguientes.
- Preservar SQLite temporal y snapshots KAN-879 CREATE/UPDATE/READ; no repetir seeds, no modificar roles/grants, ni tocar `dev` o `docs/handoffs/current.md` (baseline integrado) por una investigación exclusiva de rama.

## Referencias

- [KAN-879](https://trail-running-workout-planning.atlassian.net/browse/KAN-879), comentarios 14985–14991.
- [KAN-855](https://trail-running-workout-planning.atlassian.net/browse/KAN-855) y [handoff KAN-855](../handoffs/kan-855.md): fixture temporal y login SSR auténtico.
- [KAN-869](https://trail-running-workout-planning.atlassian.net/browse/KAN-869): worktree con SQLite local vacía.
- [KAN-638](https://trail-running-workout-planning.atlassian.net/browse/KAN-638): reloj Windows y `getClaims` JWT expirado.
- Código normativo: `db/index.ts`, `lib/auth/identity-backend-selection.ts`, `lib/auth/login-flow.ts`.
