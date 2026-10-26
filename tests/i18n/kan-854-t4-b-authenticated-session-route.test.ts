import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createServerClient } from '@supabase/ssr'
import { resolveKan791AcceptanceIdentity } from '../../lib/auth/kan-791-acceptance-identity'

const require = createRequire(import.meta.url)

for (const bindHost of ['localhost'] as const) test('KAN-854/T4 B patched runtime authentic SSR SessionForm GET '+bindHost, { timeout: 240_000 }, async () => {
  const root = resolve('.')
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer', windowsHide: true })
  assert.equal(tracked.status, 0)
  // Copy the complete tracked application tree, not a hand-maintained directory allowlist.
  // Explicitly exclude non-runtime, executable, secret and local-state paths.
  const excluded = /^(?:tests\/|scripts\/|docs\/|\.github\/|drizzle\/|patches\/|\.tmp\/|\.next\/|node_modules\/|\.env(?:\.|$)|sqlite\.db$|.*\.(?:db|sqlite|zip|log)$)/
  const files = (tracked.stdout as Buffer).toString('utf8').split('\0')
    .filter(path => path && !excluded.test(path) && !path.startsWith('.git/'))
  assert.ok(files.includes('data/data.ts'), 'EXPERIMENT_SETUP_ERROR: tracked data/data.ts absent')
  assert.ok(files.includes('context/MobileShellContext.tsx'), 'EXPERIMENT_SETUP_ERROR: tracked context source absent')
  mkdirSync(resolve('.tmp'), { recursive: true })
  const dir = mkdtempSync(resolve('.tmp/kan-854-routing-'))
  let child: ReturnType<typeof spawn> | undefined
  let stopped = false
  let logs = ''
  let failure = false
  try {
    for (const file of files) {
      const dest = resolve(dir, file)
      const rel = relative(dir, dest)
      assert.ok(rel !== '..' && !rel.startsWith('..' + sep), 'Escaped fixture root')
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(resolve(root, file), dest)
    }
    assert.equal(readFileSync(join(dir, 'proxy.ts'), 'utf8'), readFileSync('proxy.ts', 'utf8'))
    assert.equal(readFileSync(join(dir, 'next.config.ts'), 'utf8'), readFileSync('next.config.ts', 'utf8'))
    // Load developer-local public Auth configuration without copying .env files to the fixture.
    const { loadEnvConfig } = require('@next/env') as { loadEnvConfig: (dir: string, dev?: boolean) => unknown }
    loadEnvConfig(root, true)
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    assert.ok(authUrl && authKey, 'EXPERIMENT_SETUP_ERROR: real-app HTTP requires local Supabase public URL/key; no synthetic fallback')
    const version = (require('next/package.json') as {version:string}).version
    assert.equal(version, '16.3.8')
    const historicalSha = '5df5693f0ab5717b22bebcbea16110a7722d470a'
    const patchHash = '6405c9217c3f38afb8070d800f6c36459927ddc3ed7c8bfd62ba32d951af1912'
    const historicalRouterHash = '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3'
    const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    const runtimeRoot = join(dir, 'node_modules', 'next')
    cpSync(dirname(require.resolve('next/package.json')), runtimeRoot, { recursive: true })
    const routerPath = join(runtimeRoot, 'dist/server/lib/router-utils/resolve-routes.js')
    const sourceRouter = readFileSync(require.resolve('next/dist/server/lib/router-utils/resolve-routes.js'))
    assert.equal(digest(readFileSync(routerPath)), digest(sourceRouter))
    const historical = spawnSync('git', ['show', historicalSha + ':patches/next@16.3.8.patch'], { cwd: root, encoding: 'buffer', windowsHide: true })
    assert.equal(historical.status, 0, 'EXPERIMENT_SETUP_ERROR: cannot retrieve historical patch')
    const patch = historical.stdout as Buffer
    assert.equal(digest(patch), patchHash, 'EXPERIMENT_INCONCLUSIVE: B patch identity differs')
    const patchFile = join(dir, 'historical.patch')
    writeFileSync(patchFile, patch)
    // Git launched inside .tmp otherwise discovers the parent application's .git,
    // so git apply may target the outer worktree instead of this isolated package.
    // Establish a disposable repository root strictly inside the copied runtime.
    const init = spawnSync('git', ['init', '--quiet'], { cwd: runtimeRoot, encoding: 'utf8', windowsHide: true })
    assert.equal(init.status, 0, 'EXPERIMENT_SETUP_ERROR: cannot isolate Git patch target: ' + init.stderr)
    const check = spawnSync('git', ['apply', '--check', patchFile], { cwd: runtimeRoot, encoding: 'utf8', windowsHide: true })
    assert.equal(check.status, 0, 'EXPERIMENT_INCONCLUSIVE: isolated Next router patch cannot apply: '+check.stderr)
    const applied = spawnSync('git', ['apply', patchFile], { cwd: runtimeRoot, encoding: 'utf8', windowsHide: true })
    assert.equal(applied.status, 0, 'EXPERIMENT_SETUP_ERROR: applying B patch failed: '+applied.stderr)
    const routerRaw = readFileSync(routerPath)
    const routerNormalizedHash = digest(Buffer.from(routerRaw.toString('utf8').replace(/\r\n/g, '\n')))
    assert.equal(routerNormalizedHash, historicalRouterHash, 'EXPERIMENT_INCONCLUSIVE: isolated B router identity mismatch')
    const nextBin = join(runtimeRoot, 'dist/bin/next')
    assert.ok(existsSync(nextBin))
    assert.equal(digest(readFileSync(require.resolve('next/dist/server/lib/router-utils/resolve-routes.js'))), digest(sourceRouter), 'A router modified')
    process.stdout.write('KAN-854 B_RUNTIME_PRESTART '+JSON.stringify({bindHost, historicalSha, patchHash, nextBin, routerPath, routerNormalizedHash, mechanism:'git apply on isolated Next package'})+'\n')
    // Reuse already-accredited T4 data without running migrations or changing its source.
    const domainPathRaw = process.env.KAN854_T4_DOMAIN_DB
    if(!domainPathRaw){process.stdout.write('KAN-854 T4_B_ROUTING '+JSON.stringify({outcome:'BLOCKED',reason:'domain-db-not-configured'})+'\n');return}
    const domainPath=resolve(domainPathRaw)
    assert.ok(existsSync(domainPath),'EXPERIMENT_SETUP_ERROR: disposable domain DB missing')
    assert.ok(domainPath.includes('kan-854-t4-domain-'),'EXPERIMENT_SETUP_ERROR: expected T4 temporary DB')
    const expectedDomainSha='758dc1f1f3e49bccef9bd092219018974901f8392cdb0af062c1fd2158755615'
    assert.equal(digest(readFileSync(domainPath)),expectedDomainSha,'EXPERIMENT_SETUP_ERROR: T4 fixture drift')
    const scenarioDbPath=join(dir,'kan-854-domain-runtime.sqlite')
    copyFileSync(domainPath,scenarioDbPath)
    const port = await new Promise<number>((done, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(0, bindHost, () => {
        const address = server.address()
        if (!address || typeof address === 'string') return reject(new Error('No TCP port'))
        server.close(() => done(address.port))
      })
    })
    child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '-H', bindHost, '-p', String(port)], {
      cwd: dir,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: scenarioDbPath },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child.stdout?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.stderr?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.once('close', () => { stopped = true })
    const origin = 'http://' + bindHost + ':' + port
    let ready = false
    for (let n = 0; n < 50; n++) {
      if (stopped) throw new Error('EXPERIMENT_SETUP_ERROR: Next exited: ' + logs)
      try {
        const response = await fetch(origin + '/_next/static/kan-854-probe', { redirect: 'manual', signal: AbortSignal.timeout(2500) })
        if (response.status === 404) { ready = true; break }
      } catch { /* Next startup is bounded */ }
      await delay(1000)
    }
    assert.ok(ready, 'EXPERIMENT_SETUP_ERROR: no HTTP readiness: ' + logs)
    const required=['KAN791_ACCEPTANCE_EMAIL','KAN791_ACCEPTANCE_SUBJECT','KAN791_AUTH_TEST_PASSWORD'] as const
    const missing=required.filter(key=>!process.env[key]?.trim())
    assert.deepEqual(missing,[],'EXPERIMENT_SETUP_ERROR: dedicated Auth variables missing')
    const expected=resolveKan791AcceptanceIdentity({email:process.env.KAN791_ACCEPTANCE_EMAIL!,subject:process.env.KAN791_ACCEPTANCE_SUBJECT!})
    type AuthCookie={name:string;value:string;options?:Record<string,unknown>}
    const authCookies=new Map<string,AuthCookie>()
    const auth=createServerClient(authUrl,authKey,{
      cookies:{getAll:()=>[...authCookies.values()],setAll:(updates)=>{for(const cookie of updates){if(cookie.value)authCookies.set(cookie.name,cookie as AuthCookie);else authCookies.delete(cookie.name)}}},
      auth:{autoRefreshToken:false,detectSessionInUrl:false,persistSession:true},
    })
    const login=await auth.auth.signInWithPassword({email:expected.email,password:process.env['KAN791_AUTH_TEST_PASSWORD']!})
    assert.ok(login.data.session&&!login.error,'EXPERIMENT_SETUP_ERROR: dedicated Supabase Auth login rejected')
    const verified=await auth.auth.getUser()
    assert.equal(verified.data.user?.id.toLowerCase(),expected.subject,'EXPERIMENT_SETUP_ERROR: dedicated subject mismatch')
    assert.ok([...authCookies.keys()].some(name=>name.startsWith('sb-')),'EXPERIMENT_SETUP_ERROR: authentic SSR cookies missing')
    const cookieHeader=[...authCookies.values()].map(({name,value})=>encodeURIComponent(name)+'='+encodeURIComponent(value)).join('; ')
    const hops:Array<{path:string;status:number;location:string|null;setCookieNames:string[]}>=[]
    let current=new URL('/dashboard/sessions/new',origin)
    const visited=new Set<string>()
    let termination='terminal'
    for(let i=0;i<6;i++){
      if(visited.has(current.href)){termination='loop';break}
      visited.add(current.href)
      const response=await fetch(current,{redirect:'manual',headers:{cookie:cookieHeader},signal:AbortSignal.timeout(60000)})
      const location=response.headers.get('location')
      hops.push({path:current.pathname,status:response.status,location,setCookieNames:(response.headers.getSetCookie?.()??[]).map(value=>value.split('=',1)[0]).filter(Boolean)})
      if(![301,302,303,307,308].includes(response.status)||!location)break
      const target=new URL(location,current)
      assert.equal(target.origin,origin,'EXPERIMENT_SETUP_ERROR: redirect leaves isolated runtime')
      current=target
      if(i===5)termination='redirect_limit'
    }
    authCookies.clear()
    const last=hops[hops.length-1]
    const outcome=termination==='loop'?'ROUTING_LOOP':last?.status===200&&current.pathname.includes('dashboard/sessions/new')?'AUTHENTICATED_ROUTE_REACHED':last?.status===200&&current.pathname.includes('/login')?'AUTH_REDIRECT':'INCONCLUSIVE'
    process.stdout.write('KAN-854 T4_B_AUTH_HTTP '+JSON.stringify({outcome,variant:'B',nextVersion:version,host:bindHost,termination,hops,verifiedSubject:true,domainSourceUnchanged:digest(readFileSync(domainPath))===expectedDomainSha,postSent:false,bindingCaptured:false,cookieValuesLogged:false})+'\n')
    assert.equal(outcome,'AUTHENTICATED_ROUTE_REACHED','EXPERIMENT_INCONCLUSIVE: real SSR authenticated SessionForm route not reached')
  } catch (error) {
    failure = true
    throw error
  } finally {
    if (child && !stopped && child.pid) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 })
      else child.kill('SIGTERM')
      if (!stopped) await Promise.race([new Promise<void>(done => child?.once('close', () => done())), delay(4000)])
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 6, retryDelay: 400 }) }
    catch (error) {
      process.stderr.write('KAN-854 CLEANUP_DEFERRED ' + JSON.stringify({ dir, priorFailure: failure, detail: String(error) }) + '\n')
    }
  }
})
