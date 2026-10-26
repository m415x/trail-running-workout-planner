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

for (const bindHost of ['localhost'] as const) test('KAN-854/T4 B controlled date React value tracker diagnosis '+bindHost, { timeout: 300_000 }, async () => {
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
  let chrome: ReturnType<typeof spawn> | undefined
  let chromeProfile: string | undefined
  let cdpSocket: WebSocket | undefined
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
    const browserPath=process.env.KAN854_T4_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
    assert.ok(existsSync(browserPath),'EXPERIMENT_SETUP_ERROR: Chrome unavailable')
    chromeProfile=mkdtempSync(join(dir,'chrome-cdp-'))
    chrome=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+chromeProfile,'about:blank'],{windowsHide:true,stdio:'ignore'})
    const marker=join(chromeProfile,'DevToolsActivePort')
    let cdpPort=0
    for(let i=0;i<80;i++){
      if(chrome.exitCode!==null||chrome.signalCode!==null)throw Error('EXPERIMENT_SETUP_ERROR: Chrome exited before CDP readiness')
      if(existsSync(marker)){
        try{
          const raw=readFileSync(marker,'utf8').split(/\r?\n/)[0]
          const parsed=Number(raw)
          if(Number.isInteger(parsed)&&parsed>0&&parsed<=65535){cdpPort=parsed;break}
        }catch(error){
          const code=(error as NodeJS.ErrnoException).code
          if(!['EBUSY','EPERM','EACCES','ENOENT'].includes(code??''))throw error
        }
      }
      await delay(150)
    }
    assert.ok(cdpPort>0,'EXPERIMENT_SETUP_ERROR: Chrome CDP did not start')
    const descriptorResponse=await fetch('http://127.0.0.1:'+cdpPort+'/json/new?about:blank',{method:'PUT',signal:AbortSignal.timeout(5000)})
    assert.equal(descriptorResponse.status,200)
    const descriptor=await descriptorResponse.json() as {webSocketDebuggerUrl?:string}
    const endpoint=descriptor.webSocketDebuggerUrl
    assert.ok(typeof endpoint==='string'&&endpoint.startsWith('ws://127.0.0.1:'+cdpPort+'/devtools/page/'))
    cdpSocket=new WebSocket(endpoint)
    const ws=cdpSocket
    await new Promise<void>((done,reject)=>{ws.addEventListener('open',()=>done(),{once:true});ws.addEventListener('error',()=>reject(Error('EXPERIMENT_SETUP_ERROR: CDP socket failure')),{once:true})})
    let serial=0
    const pending=new Map<number,{resolve:(x:Record<string,unknown>)=>void;reject:(e:Error)=>void}>()
    ws.addEventListener('message',event=>{
      const item=JSON.parse(String(event.data)) as {id?:number;result?:Record<string,unknown>;error?:{message:string}}
      if(typeof item.id!=='number')return
      const p=pending.get(item.id);if(!p)return
      pending.delete(item.id)
      if(item.error)p.reject(Error('CDP: '+item.error.message));else p.resolve(item.result??{})
    })
    async function cdp(method:string,params:Record<string,unknown>={}){
      const id=++serial
      return Promise.race([
        new Promise<Record<string,unknown>>((res,rej)=>{pending.set(id,{resolve:res,reject:rej});ws.send(JSON.stringify({id,method,params}))}),
        delay(15000).then(()=>{pending.delete(id);throw Error('EXPERIMENT_SETUP_ERROR: CDP timeout '+method)}),
      ])
    }
    await cdp('Network.enable')
    await cdp('Page.enable')
    await cdp('Runtime.enable')
    for(const cookie of authCookies.values()){
      const accepted=await cdp('Network.setCookie',{name:cookie.name,value:cookie.value,url:origin,sameSite:'Lax'})
      assert.equal(accepted.success,true,'EXPERIMENT_SETUP_ERROR: SSR cookie rejected by Chrome')
    }
    await cdp('Page.navigate',{url:origin+'/dashboard/sessions/new'})
    let captured:{path:string;fields:string[];forms:number;hasSubmissionControl:boolean}|undefined
    for(let n=0;n<35;n++){
      await delay(400)
      const evaluation=await cdp('Runtime.evaluate',{expression:"(() => {const forms=[...document.forms];return {path:location.pathname,fields:forms.flatMap(f=>[...f.querySelectorAll('input,select,textarea')].map(x=>x.getAttribute('name')).filter(Boolean)),forms:forms.length,hasSubmissionControl:!!document.querySelector('form button[type=submit]')}})()",returnByValue:true})
      const value=(evaluation.result as {value?:typeof captured}|undefined)?.value
      if(value){captured=value;if(value.fields.includes('date')&&value.fields.includes('title'))break}
    }
    assert.ok(captured,'EXPERIMENT_SETUP_ERROR: CDP DOM observation missing')
    const formReached=captured.fields.includes('date')&&captured.fields.includes('title')&&captured.fields.includes('type')
    process.stdout.write('KAN-854 T4_B_CDP_DOM '+JSON.stringify({outcome:formReached?'HYDRATED_FORM_FIELDS_OBSERVED':'FORM_NOT_REACHED',variant:'B',nextVersion:version,route:captured.path,forms:captured.forms,fieldNames:captured.fields.filter(x=>!x.toLowerCase().includes('token')).slice(0,65),hasSubmissionControl:captured.hasSubmissionControl,authVerified:true,postSent:false,actionBindingCaptured:false,cookieValuesLogged:false})+'\n')
    const options=await cdp('Runtime.evaluate',{expression:"(() => {const form=document.querySelector('form');const date=form?.querySelector('input[name=date]');const checkboxes=[...(form?.querySelectorAll('input[type=checkbox]')??[])];return {hasDateInput:!!date,dateValue:date?.value??null,checkboxCount:checkboxes.length,checkboxStates:checkboxes.map(x=>({disabled:x.disabled,checked:x.checked})),microcycleFields:form?.querySelectorAll('input[name=prescriptionMicrocycleId]').length??0,hasForm:!!form}})()",returnByValue:true})
    const optionState=(options.result as {value?:{hasDateInput:boolean;dateValue:string|null;checkboxCount:number;checkboxStates:Array<{disabled:boolean;checked:boolean}>;microcycleFields:number;hasForm:boolean}}|undefined)?.value
    assert.ok(optionState,'EXPERIMENT_SETUP_ERROR: missing DOM option inspection')
    const outcomeOptions=optionState.checkboxCount>0?'MICROCYCLE_OPTIONS_RENDERED':'NO_MICROCYCLE_OPTIONS'
    process.stdout.write('KAN-854 T4_B_MICROCYCLE_OPTIONS '+JSON.stringify({outcome:outcomeOptions,variant:'B',nextVersion:version,route:captured.path,optionState,formReached,sourceFixtureUnchanged:digest(readFileSync(domainPath))===expectedDomainSha,postSent:false,actionBindingCaptured:false,valuesRedacted:true})+'\n')
    authCookies.clear()
    const inspection=await cdp('Runtime.evaluate',{expression:"(() => {const f=document.querySelector('form');const labels=[...(f?.querySelectorAll('fieldset legend')??[])];return {fieldsetCount:labels.length,groupIdInDom:!!f?.textContent?.includes('S2'),microcycleIdInDom:!!document.documentElement.outerHTML.includes('kan854_t4_micro'),loadingElements:document.querySelectorAll('[aria-busy=true]').length,errorAlertPresent:!!document.querySelector('[role=alert]'),formOuterHTMLLength:f?.outerHTML.length??0}})()",returnByValue:true})
    const observed=(inspection.result as {value?:{fieldsetCount:number;groupIdInDom:boolean;microcycleIdInDom:boolean;loadingElements:number;errorAlertPresent:boolean;formOuterHTMLLength:number}}|undefined)?.value
    assert.ok(observed,'EXPERIMENT_SETUP_ERROR: missing DOM diagnostics')
    process.stdout.write('KAN-854 T4_B_OPTIONS_RUNTIME_DIAG '+JSON.stringify({outcome:outcomeOptions,observed,fixtureSourceSha256:expectedDomainSha,readOnly:true,postSent:false,reason:outcomeOptions==='NO_MICROCYCLE_OPTIONS'?'options-not-in-rendered-dom':'options-present'})+'\n')
    // Evaluate the native setter against the actual DOM node, without simulating keyboard input.
    // Separately verify the DOM value and a React-rendered consequence.
    const objectLookup=await cdp('Runtime.evaluate',{expression:"document.querySelector('form input[name=date]')",returnByValue:false})
    const dateObjectId=(objectLookup.result as {objectId?:string}|undefined)?.objectId
    assert.ok(dateObjectId,'EXPERIMENT_SETUP_ERROR: real date element missing')
    const call=await cdp('Runtime.callFunctionOn',{
      objectId:dateObjectId,
      functionDeclaration:"function(iso){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)return {setterPresent:false};setter.call(this,iso);const exact=this.value===iso;this.dispatchEvent(new Event('input',{bubbles:true,composed:true}));this.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return {setterPresent:true,exactDateValue:exact,dateValue:this.value}}",
      arguments:[{value:'2026-10-24'}],returnByValue:true,
    })
    const appliedDate=(call.result as {value?:{setterPresent:boolean;exactDateValue:boolean;dateValue:string}}|undefined)?.value
    assert.equal(appliedDate?.dateValue,'2026-10-24','EXPERIMENT_SETUP_ERROR: CDP native setter did not set ISO date')
    let afterDate:{dateValue:string;checkboxCount:number;enabledCheckboxes:number;checkedCheckboxes:number;microcycleIdInForm:boolean;prescriptionFields:number;selectedMicrocycleValues:string[]}|undefined
    for(let i=0;i<30;i++){
      await delay(200)
      const evaluation=await cdp('Runtime.evaluate',{expression:"(() => {const form=document.querySelector('form');const checks=[...(form?.querySelectorAll('input[type=checkbox]')??[])];return {dateValue:form?.querySelector('input[name=date]')?.value??'',checkboxCount:checks.length,enabledCheckboxes:checks.filter(x=>!x.disabled).length,checkedCheckboxes:checks.filter(x=>x.checked).length,microcycleIdInForm:!!form?.outerHTML.includes('kan854_t4_micro'),prescriptionFields:form?.querySelectorAll('input[name=prescriptionMicrocycleId]').length??0,selectedMicrocycleValues:[...(form?.querySelectorAll('input[name=prescriptionMicrocycleId]')??[])].map(x=>x.value)}})()",returnByValue:true})
      afterDate=(evaluation.result as {value?:typeof afterDate}|undefined)?.value
      if(afterDate?.selectedMicrocycleValues.includes('kan854_t4_micro'))break
    }
    const reactUpdated=!!afterDate?.selectedMicrocycleValues.includes('kan854_t4_micro')&&afterDate.checkedCheckboxes>0
    const reactDateOutcome=reactUpdated?'REACT_DATE_AND_MICROCYCLE_CONFIRMED':afterDate?.dateValue==='2026-10-24'?'DOM_DATE_ONLY':'DATE_NOT_PERSISTED'
    process.stdout.write('KAN-854 T4_B_REACT_DATE '+JSON.stringify({outcome:reactDateOutcome,variant:'B',before:{dateValue:optionState.dateValue,checkboxes:optionState.checkboxCount},nativeSetter:appliedDate,afterDate,reactUpdated,postSent:false,actionBindingCaptured:false,sourceUnchanged:digest(readFileSync(domainPath))===expectedDomainSha})+'\n')
    const probeExpression = `(() => {
      const d = document.querySelector('form input[name=date]');
      if (!d) return {present:false};
      const keys = Object.keys(d);
      const reactPropsKey = keys.find(k => k.startsWith('__reactProps$'));
      const reactFiberKey = keys.find(k => k.startsWith('__reactFiber$'));
      const props = reactPropsKey ? d[reactPropsKey] : undefined;
      return {present:true,hasReactProps:!!reactPropsKey,hasReactFiber:!!reactFiberKey,
        hasOnChangeHandler:typeof props?.onChange === 'function',
        reactPropValue:typeof props?.value === 'string' ? props.value : null,
        nativeDomValue:d.value,scriptCount:document.scripts.length,readyState:document.readyState};
    })()`
    const probe=await cdp('Runtime.evaluate',{expression:probeExpression,returnByValue:true})
    const hydration=(probe.result as {value?:{present:boolean;hasReactProps:boolean;hasReactFiber:boolean;hasOnChangeHandler:boolean;reactPropValue:string|null;nativeDomValue:string;scriptCount:number;readyState:string}}|undefined)?.value
    assert.ok(hydration,'EXPERIMENT_SETUP_ERROR: React hydration observation unavailable')
    process.stdout.write('KAN-854 T4_B_REACT_EVENT_DIAG '+JSON.stringify({outcome:reactDateOutcome,hydration,sourceUnchanged:digest(readFileSync(domainPath))===expectedDomainSha,postSent:false,bindingCaptured:false})+'\n')
    const trackerProbe=await cdp('Runtime.evaluate',{expression:`(() => {
      const input=document.querySelector('form input[name=date]');
      if(!(input instanceof HTMLInputElement))return {found:false};
      const tracker=input._valueTracker;
      return {found:true,hasTracker:!!tracker,trackerValue:tracker?.getValue?.()??null,
        ownValueDescriptor:!!Object.getOwnPropertyDescriptor(input,'value'),
        prototypeValueDescriptor:!!Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value'),
        reactPropsValue:Object.keys(input).filter(k=>k.startsWith('__reactProps
    const last=hops[hops.length-1]
    const outcome=termination==='loop'?'ROUTING_LOOP':last?.status===200&&current.pathname.includes('dashboard/sessions/new')?'AUTHENTICATED_ROUTE_REACHED':last?.status===200&&current.pathname.includes('/login')?'AUTH_REDIRECT':'INCONCLUSIVE'
    process.stdout.write('KAN-854 T4_B_AUTH_HTTP '+JSON.stringify({outcome,variant:'B',nextVersion:version,host:bindHost,termination,hops,verifiedSubject:true,domainSourceUnchanged:digest(readFileSync(domainPath))===expectedDomainSha,postSent:false,bindingCaptured:false,cookieValuesLogged:false})+'\n')
    assert.equal(outcome,'AUTHENTICATED_ROUTE_REACHED','EXPERIMENT_INCONCLUSIVE: real SSR authenticated SessionForm route not reached')
  } catch (error) {
    failure = true
    throw error
  } finally {
    cdpSocket?.close()
    if(chrome?.pid&&chrome.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{windowsHide:true,timeout:8000});else chrome.kill('SIGTERM')}
    if(chromeProfile)await delay(800)
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

)).map(k=>input[k]?.value??null)[0]??null,
        domValue:input.value}
    })()`,returnByValue:true})
    const trackerState=(trackerProbe.result as {value?:{found:boolean;hasTracker:boolean;trackerValue:string|null;ownValueDescriptor:boolean;prototypeValueDescriptor:boolean;reactPropsValue:string|null;domValue:string}}|undefined)?.value
    assert.ok(trackerState?.found,'EXPERIMENT_SETUP_ERROR: React input tracker unavailable')
    process.stdout.write('KAN-854 T4_B_VALUE_TRACKER '+JSON.stringify({outcome:reactDateOutcome,trackerState,postSent:false,sourceUnchanged:digest(readFileSync(domainPath))===expectedDomainSha})+'\n')
    assert.ok(formReached,'EXPERIMENT_INCONCLUSIVE: authenticated client SessionForm did not render')
    const last=hops[hops.length-1]
    const outcome=termination==='loop'?'ROUTING_LOOP':last?.status===200&&current.pathname.includes('dashboard/sessions/new')?'AUTHENTICATED_ROUTE_REACHED':last?.status===200&&current.pathname.includes('/login')?'AUTH_REDIRECT':'INCONCLUSIVE'
    process.stdout.write('KAN-854 T4_B_AUTH_HTTP '+JSON.stringify({outcome,variant:'B',nextVersion:version,host:bindHost,termination,hops,verifiedSubject:true,domainSourceUnchanged:digest(readFileSync(domainPath))===expectedDomainSha,postSent:false,bindingCaptured:false,cookieValuesLogged:false})+'\n')
    assert.equal(outcome,'AUTHENTICATED_ROUTE_REACHED','EXPERIMENT_INCONCLUSIVE: real SSR authenticated SessionForm route not reached')
  } catch (error) {
    failure = true
    throw error
  } finally {
    cdpSocket?.close()
    if(chrome?.pid&&chrome.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{windowsHide:true,timeout:8000});else chrome.kill('SIGTERM')}
    if(chromeProfile)await delay(800)
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

