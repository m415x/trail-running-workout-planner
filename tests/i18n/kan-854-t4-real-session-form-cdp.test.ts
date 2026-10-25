import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

type CdpReply={id?:number;result?:Record<string,unknown>;error?:{message:string};method?:string}
test('KAN-854/T4 observes rendered SessionForm via real Chrome CDP without submitting actions', {timeout:60_000},async()=>{
 const raw=process.env.KAN854_T4_NEXT_ORIGIN?.trim()
 if(!raw){process.stdout.write('KAN-854 T4_RENDER_CAPTURE '+JSON.stringify({outcome:'BLOCKED',reason:'isolated-next-origin-required',bindingCaptured:false})+'\n');return}
 const base=new URL(raw)
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'EXPERIMENT_SETUP_ERROR: loopback host required')
 assert.equal(base.protocol,'http:')
 assert.equal(base.pathname,'/')
 const pageUrl=new URL('/dashboard/sessions/new',base).href
 const browser=process.env.KAN854_T4_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
 const dir=mkdtempSync(join(tmpdir(),'kan-854-t4-render-'))
 const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore',windowsHide:true})
 let socket:WebSocket|undefined
 try{
  let port=0
  for(let i=0;i<60;i++){if(existsSync(join(dir,'DevToolsActivePort'))){port=Number(readFileSync(join(dir,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);break}await delay(150)}
  assert.ok(port>0,'EXPERIMENT_SETUP_ERROR: browser CDP unavailable')
  const target=await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent('about:blank'),{method:'PUT',signal:AbortSignal.timeout(5000)})
  assert.equal(target.status,200)
  const descriptor=await target.json() as {webSocketDebuggerUrl?:string}
  const endpoint=descriptor.webSocketDebuggerUrl
  assert.ok(typeof endpoint==='string'&&endpoint.startsWith('ws://127.0.0.1:'+port+'/devtools/page/'),'EXPERIMENT_SETUP_ERROR: invalid CDP target endpoint')
  socket=new WebSocket(endpoint)
  await new Promise<void>((done,reject)=>{socket!.addEventListener('open',()=>done(),{once:true});socket!.addEventListener('error',()=>reject(new Error('EXPERIMENT_SETUP_ERROR: CDP socket failed')),{once:true})})
  let seq=0
  const pending=new Map<number,{resolve:(v:Record<string,unknown>)=>void;reject:(e:Error)=>void}>()
  socket.addEventListener('message',(event:MessageEvent)=>{
   let item:CdpReply
   try{item=JSON.parse(String(event.data)) as CdpReply}catch{return}
   if(typeof item.id!=='number')return
   const wait=pending.get(item.id);if(!wait)return
   pending.delete(item.id)
   if(item.error)wait.reject(new Error('CDP: '+item.error.message))
   else wait.resolve(item.result??{})
  })
  const send=(method:string,params:Record<string,unknown>={})=>{
   const id=++seq
   return Promise.race([
    new Promise<Record<string,unknown>>((resolve,reject)=>{pending.set(id,{resolve,reject});socket!.send(JSON.stringify({id,method,params}))}),
    delay(12000).then(()=>{pending.delete(id);throw Error('EXPERIMENT_SETUP_ERROR: CDP '+method+' timeout')}),
   ])
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate',{url:pageUrl})
  await delay(8000)
  const evaluated=await send('Runtime.evaluate',{expression:`(() => {const forms=[...document.querySelectorAll('form')];return {path:location.pathname,title:document.title,formCount:forms.length,formFields:forms.map(f=>[...f.querySelectorAll('input,select,textarea')].map(x=>x.getAttribute('name')).filter(Boolean)),bodyHasSessionForm:!!document.querySelector('[name="prescriptionMicrocycleId"]'),bodyText:document.body?.innerText?.slice(0,160)||''}})()`,returnByValue:true})
  const result=evaluated.result as {value?:{path:string;title:string;formCount:number;formFields:string[][];bodyHasSessionForm:boolean;bodyText:string}}|undefined
  const value=result?.value
  assert.ok(value,'EXPERIMENT_SETUP_ERROR: browser did not return DOM')
  const containsFields=value.formFields.some(fields=>fields.includes('date')&&fields.includes('title')&&fields.includes('type'))
  const classification=containsFields?'FORM_RENDERED':value.path.includes('/auth/')?'AUTH_REDIRECT':'ROUTING_OR_ACCESS_BLOCKED'
  process.stdout.write('KAN-854 T4_RENDER_CAPTURE '+JSON.stringify({outcome:classification,origin:base.origin,route:'/dashboard/sessions/new',observedPath:value.path,formCount:value.formCount,fieldNames:value.formFields.flat().filter(name=>!name.toLowerCase().includes('token')).slice(0,70),hasMicrocycleSelection:value.bodyHasSessionForm,actionBinding:'not-extracted',postSent:false,cookieValuesLogged:false,scope:'read-only-browser-CDP'})+'\n')
  assert.equal(classification,'FORM_RENDERED','EXPERIMENT_INCONCLUSIVE: real SessionForm not reached; inspect routing/SSR identity')
 }finally{
  socket?.close()
  if(child.pid&&child.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:8000});else child.kill('SIGTERM')}
  if(child.exitCode===null&&child.signalCode===null)await delay(900)
  for(let i=0;i<12;i++){try{rmSync(dir,{recursive:true,force:true,maxRetries:2,retryDelay:150});break}catch(e){if(i===11)process.stderr.write('KAN-854 T4_CLEANUP_DEFERRED '+JSON.stringify({directory:dir,code:(e as NodeJS.ErrnoException).code})+'\n');else await delay(300)}}
 }
})
