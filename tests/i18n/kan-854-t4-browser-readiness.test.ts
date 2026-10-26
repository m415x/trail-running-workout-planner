import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'

const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex')
test('KAN-854/T4 checks disposable browser and runtime capture prerequisites without HTTP side effects',()=>{
 const require=createRequire(import.meta.url)
 const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(dir:string,dev:boolean)=>unknown}
 loadEnvConfig(resolve('.'),true)
 const raw=process.env.KAN854_T4_DOMAIN_DB
 if(!raw){
  process.stdout.write('KAN-854 T4_BROWSER_READINESS '+JSON.stringify({outcome:'BLOCKED',reason:'domain-fixture-path-required',noHttpRequests:true})+'\n')
  return
 }
 const file=resolve(raw)
 assert.equal(basename(file),'acceptance-domain.sqlite')
 assert.match(basename(dirname(file)),/^kan-854-t4-domain-/)
 assert.ok(existsSync(file),'EXPERIMENT_SETUP_ERROR: accredited disposable domain DB missing')
 const expected='758dc1f1f3e49bccef9bd092219018974901f8392cdb0af062c1fd2158755615'
 const actual=sha(file)
 assert.equal(actual,expected,'EXPERIMENT_SETUP_ERROR: T4 fixture changed since accredited checkpoint')
 const candidates=process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/microsoft-edge']
 const configured=process.env.KAN854_T4_BROWSER_PATH?.trim()
 const browser=[configured,...candidates].find((candidate):candidate is string=>Boolean(candidate&&existsSync(candidate)))
 const ownVersion=(require('next/package.json') as {version:string}).version
 const cPath=process.env.KAN854_T4_C_NEXT_BIN?.trim()
 const cPresent=Boolean(cPath&&existsSync(resolve(cPath)))
 const result={outcome:browser?'BROWSER_BINARY_AVAILABLE':'BLOCKED',reason:browser?null:'native-browser-not-found',browserAvailable:Boolean(browser),browserExecutable:browser??null,baselineNext:ownVersion,cRuntimeProvided:cPresent,fixtureSha256:actual,originalFixtureProtected:true,authSession:'not-reused-or-refreshed',serverActionBinding:'not-captured',httpBC:'not-executed',noHttpRequests:true}
 process.stdout.write('KAN-854 T4_BROWSER_READINESS '+JSON.stringify(result)+'\n')
 if(browser){
  const v=spawnSync(browser,['--version'],{encoding:'utf8',windowsHide:true,timeout:10_000})
  assert.equal(v.error,undefined,'EXPERIMENT_SETUP_ERROR: browser version launch error')
  // Windows GUI browsers sometimes provide no CLI version output. Availability is path-only, not automation proof.
 }
})
