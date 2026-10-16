import assert from 'node:assert/strict'

/** Require both PG connections to target the exact disposable KAN-789 database. */
export function assertKan791LocalDatabaseTargets(
 acceptanceUrl:string|undefined,
 runtimeUrl:string|undefined,
):void {
 assert.ok(acceptanceUrl && runtimeUrl,'Both acceptance database targets are required')
 for(const raw of [acceptanceUrl,runtimeUrl]){
  let target:URL
  try{target=new URL(raw)}catch{throw new Error('Invalid acceptance database target')}
  assert.ok(target.protocol==='postgresql:' || target.protocol==='postgres:','Invalid acceptance database protocol')
  assert.equal(target.hostname,'127.0.0.1','Invalid acceptance database target host')
  assert.equal(target.port,'55439','Invalid acceptance database target port')
  assert.equal(target.pathname,'/kan789_acceptance','Invalid acceptance database target name')
 }
}
