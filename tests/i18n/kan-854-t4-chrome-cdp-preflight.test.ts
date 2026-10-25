import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('KAN-854/T4 Chrome CDP starts with isolated profile and no application navigation', {timeout:35_000}, async()=>{
 const executable=process.env.KAN854_T4_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
 const dir=mkdtempSync(join(tmpdir(),'kan-854-t4-cdp-'))
 const child=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:['ignore','pipe','pipe'],windowsHide:true})
 let stderr=''
 child.stderr?.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-6000)})
 let outcome='BLOCKED',browserVersion:string|null=null,cdpEndpoint=false
 try{
  const devtools=join(dir,'DevToolsActivePort')
  const {existsSync,readFileSync}=await import('node:fs')
  for(let i=0;i<50;i++){
   if(child.exitCode!==null)break
   if(existsSync(devtools)){
    const [rawPort,wsPath]=readFileSync(devtools,'utf8').split(/\r?\n/)
    const port=Number(rawPort)
    assert.ok(port>0&&port<=65535&&wsPath?.startsWith('/devtools/browser/'),'EXPERIMENT_SETUP_ERROR: malformed CDP port marker')
    const response=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(2000)})
    assert.equal(response.status,200)
    const metadata=await response.json() as {Browser?:string;webSocketDebuggerUrl?:string}
    assert.ok(metadata.webSocketDebuggerUrl?.startsWith('ws://127.0.0.1:'+port+'/devtools/browser/'))
    browserVersion=metadata.Browser??null
    cdpEndpoint=true
    outcome='CDP_READY'
    break
   }
   await new Promise(done=>setTimeout(done,200))
  }
  process.stdout.write('KAN-854 T4_CDP_PREFLIGHT '+JSON.stringify({outcome,browserVersion,cdpEndpoint,isolatedProfile:true,applicationNavigation:false,supabaseAuthUsed:false,nextStarted:false,bindingCaptured:false,stderrSummary:outcome==='BLOCKED'?stderr.replace(/https?:\/\/\S+/g,'[url]').slice(-500):undefined})+'\n')
  assert.equal(outcome,'CDP_READY','EXPERIMENT_SETUP_ERROR: isolated browser CDP unavailable')
 }finally{
  if(child.pid&&child.exitCode===null){
   if(process.platform==='win32'){
    const {spawnSync}=await import('node:child_process')
    spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:8000})
   }else child.kill('SIGTERM')
  }
  rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:250})
 }
})
