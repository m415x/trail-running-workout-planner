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

for (const bindHost of ['127.0.0.1'] as const) test('KAN-854/T5 C unpatched Next authenticated GET-only routing matrix '+bindHost, { timeout: 300_000 }, async () => {
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
    // C package installed only inside disposable workspace. Nothing in the repo or its lockfile changes.
    const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    const installer=join(dir,'c-next-installer')
    mkdirSync(installer,{recursive:true})
    writeFileSync(join(installer,'package.json'),JSON.stringify({name:'kan854-c-sandbox',private:true,version:'1.0.0'}))
    const npm=process.platform==='win32'?'npm.cmd':'npm'
    // The working directory already scopes installation. Do not pass --prefix with a spaced Windows path to cmd.exe.
    const installed=spawnSync(npm,['install','--no-save','--no-package-lock','--ignore-scripts','--no-audit','--no-fund','next@16.4.3'],{cwd:installer,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:2*1024*1024,shell:process.platform==='win32'})
    assert.equal(installed.status,0,'EXPERIMENT_SETUP_ERROR: cannot install isolated Next 16.4.3; '+(installed.stderr??'').slice(-500))
    const downloaded=join(installer,'node_modules','next')
    const metadata=JSON.parse(readFileSync(join(downloaded,'package.json'),'utf8')) as {version:string}
    assert.equal(metadata.version,'16.4.3','EXPERIMENT_SETUP_ERROR: C package identity mismatch')
    const runtimeRoot=join(dir,'node_modules','next')
    cpSync(downloaded,runtimeRoot,{recursive:true,force:true})
    const deployed=JSON.parse(readFileSync(join(runtimeRoot,'package.json'),'utf8')) as {version:string}
    assert.equal(deployed.version,'16.4.3')
    const routerPath=join(runtimeRoot,'dist/server/lib/router-utils/resolve-routes.js')
    assert.ok(existsSync(routerPath),'EXPERIMENT_SETUP_ERROR: C router absent')
    const routerSha=digest(readFileSync(routerPath))
    const nextBin=join(runtimeRoot,'dist/bin/next')
    assert.ok(existsSync(nextBin),'EXPERIMENT_SETUP_ERROR: C next binary absent')
    const version=deployed.version
    process.stdout.write('KAN-854 C_RUNTIME_PRESTART '+JSON.stringify({bindHost,version,routerSha,patchApplied:false,installerIsolated:true,packageSource:'next@16.4.3',sourceLockfileUnchanged:true})+'\n')
    // Reuse already-accredited T4 data without running migrations or changing its source.
    const domainPathRaw = process.env.KAN854_T4_DOMAIN_DB
    if(!domainPathRaw){process.stdout.write('KAN-854 T4_C_ROUTING '+JSON.stringify({outcome:'BLOCKED',reason:'domain-db-not-configured'})+'\n');return}
    const domainPath=resolve(domainPathRaw)
    assert.ok(existsSync(domainPath),'EXPERIMENT_SETUP_ERROR: disposable domain DB missing')
    assert.ok(domainPath.includes('kan-854-t4-domain-'),'EXPERIMENT_SETUP_ERROR: expected T4 temporary DB')
    const expectedDomainSha='758dc1f1f3e49bccef9bd092219018974901f8392cdb0af062c1fd2158755615'
    assert.equal(digest(readFileSync(domainPath)),expectedDomainSha,'EXPERIMENT_SETUP_ERROR: T4 fixture drift')
    const scenarioDbPath=join(dir,'kan-854-domain-runtime.sqlite')
    copyFileSync(domainPath,scenarioDbPath)
    process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'runtime-install-ready'})+'\n')
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
    process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'http-readiness',ready})+'\n')
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
    process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'authentication-start'})+'\n')
    const login=await auth.auth.signInWithPassword({email:expected.email,password:process.env['KAN791_AUTH_TEST_PASSWORD']!})
    assert.ok(login.data.session&&!login.error,'EXPERIMENT_SETUP_ERROR: dedicated Supabase Auth login rejected')
    const verified=await auth.auth.getUser()
    assert.equal(verified.data.user?.id.toLowerCase(),expected.subject,'EXPERIMENT_SETUP_ERROR: dedicated subject mismatch')
    assert.ok([...authCookies.keys()].some(name=>name.startsWith('sb-')),'EXPERIMENT_SETUP_ERROR: authentic SSR cookies missing')
    process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'authentication-verified'})+'\n')
    const cookieHeader=[...authCookies.values()].map(({name,value})=>encodeURIComponent(name)+'='+encodeURIComponent(value)).join('; ')
    const hops:Array<{path:string;status:number;location:string|null;setCookieNames:string[]}>=[]
    let current=new URL('/dashboard/sessions/new',origin)
    const visited=new Set<string>()
    process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'authenticated-reentry-start'})+'\n')
    for(let i=0;i<6;i++){
      if(visited.has(current.href)){break}
      visited.add(current.href)
      const response=await fetch(current,{redirect:'manual',headers:{cookie:cookieHeader},signal:AbortSignal.timeout(60000)})
      const location=response.headers.get('location')
      hops.push({path:current.pathname,status:response.status,location,setCookieNames:(response.headers.getSetCookie?.()??[]).map(value=>value.split('=',1)[0]).filter(Boolean)})
      if(![301,302,303,307,308].includes(response.status)||!location)break
      const target=new URL(location,current)
      assert.equal(target.origin,origin,'EXPERIMENT_SETUP_ERROR: redirect leaves isolated runtime')
      current=target
    }
    process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'authenticated-reentry-done',hops:hops.map(h=>({path:h.path,status:h.status}))})+'\n')
    // GET-only T5 route matrix. The authentic Supabase session is retained; no token refresh is induced.
    const routePaths=['/','/es','/en','/dashboard','/es/dashboard','/en/dashboard','/dashboard/sessions/new','/login','/es/login','/en/login']
    const routeResults:Array<{path:string;hops:Array<{status:number;path:string;locationPath:string|null;setCookieNames:string[]}>;termination:string}>=[]
    for(const path of routePaths){
      process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'route-start',path})+'\n')
      let route=new URL(path,origin)
      const chain:Array<{status:number;path:string;locationPath:string|null;setCookieNames:string[]}>=[]
      const seen=new Set<string>()
      let ended='terminal'
      for(let hop=0;hop<7;hop++){
        if(seen.has(route.href)){ended='loop';break}
        seen.add(route.href)
        const response=await fetch(route,{redirect:'manual',headers:{cookie:cookieHeader},signal:AbortSignal.timeout(35000)})
        const location=response.headers.get('location')
        const next=location?new URL(location,route):null
        const names=(response.headers.getSetCookie?.()??[]).map(v=>v.split('=',1)[0]).filter(Boolean)
        chain.push({status:response.status,path:route.pathname,locationPath:next?.pathname??null,setCookieNames:names})
        if(!next||![301,302,303,307,308].includes(response.status))break
        if(next.origin!==origin){ended='external-redirect';break}
        route=next
        if(hop===6)ended='redirect-limit'
      }
      routeResults.push({path,hops:chain,termination:ended})
      process.stdout.write('KAN-854 T5_C_PHASE '+JSON.stringify({bindHost,phase:'route-done',path,termination:ended,hops:chain.map(h=>h.status)})+'\n')
    }
    const failures=routeResults.filter(x=>x.termination!=='terminal'||x.hops.some(h=>h.status>=500))
    process.stdout.write('KAN-854 T5_C_GET_MATRIX '+JSON.stringify({version,bindHost,patchApplied:false,authenticated:true,refreshExercised:false,sessionPreservedOnly:true,scenarios:routeResults,failures:failures.length,cookieValuesLogged:false,sourceUnchanged:digest(readFileSync(domainPath))===expectedDomainSha})+'\n')
    assert.equal(failures.length,0,'INCONCLUSIVE: GET-only route matrix contains error/loop/redirect-limit')
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

