import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

export type HttpObservation = {
  variant: 'A' | 'B' | 'C'
  appSha: string
  nextVersion: string
  routerSha256: string
  method: string
  requestedUrl: string
  bindHost: string
  status: number
  location: string | null
  actionRedirect: string | null
  setCookieNames: string[]
  visibleOutcome: 'allow' | 'deny' | 'redirect' | 'unknown'
}

export function cookieNames(headers: Headers): string[] {
  const lines = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter((value): value is string => value !== null)
  return [...new Set(lines.map(line => line.split('=', 1)[0]?.trim()).filter(Boolean))].sort()
}

export function normalizeObservation(
  identity: Pick<HttpObservation, 'variant' | 'appSha' | 'nextVersion' | 'routerSha256' | 'method' | 'requestedUrl' | 'bindHost'>,
  response: Response,
  visibleOutcome: HttpObservation['visibleOutcome'] = 'unknown',
): HttpObservation {
  return {
    ...identity,
    status: response.status,
    location: response.headers.get('location'),
    actionRedirect: response.headers.get('x-action-redirect'),
    setCookieNames: cookieNames(response.headers),
    visibleOutcome,
  }
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function assertComparable(a: HttpObservation, b: HttpObservation): void {
  assert.equal(a.appSha, b.appSha, 'different application commits: causal comparison prohibited')
  assert.equal(a.method, b.method, 'different HTTP methods: causal comparison prohibited')
  assert.equal(a.requestedUrl.replace(/^https?:\/\/[^/]+/, ''), b.requestedUrl.replace(/^https?:\/\/[^/]+/, ''), 'different request paths')
  assert.equal(a.bindHost, b.bindHost, 'different bind hosts')
}

test('KAN-854/T1 records redirect and cookie names without persisting credentials', () => {
  const response = new Response(null, {
    status: 307,
    headers: {
      location: '/es/login',
      'x-action-redirect': '/es/dashboard',
      'set-cookie': 'sb-auth-token=DO_NOT_PERSIST; Path=/; HttpOnly',
    },
  })
  const observation = normalizeObservation({
    variant: 'A', appSha: 'sha', nextVersion: '16.3.8', routerSha256: 'router',
    method: 'GET', requestedUrl: 'http://127.0.0.1:3000/es/dashboard', bindHost: '127.0.0.1',
  }, response, 'redirect')
  assert.equal(observation.status, 307)
  assert.equal(observation.location, '/es/login')
  assert.equal(observation.actionRedirect, '/es/dashboard')
  assert.deepEqual(observation.setCookieNames, ['sb-auth-token'])
  assert.doesNotMatch(JSON.stringify(observation), /DO_NOT_PERSIST/)
})

test('KAN-854/T1 rejects unmatched application revision or HTTP method', () => {
  const response = new Response(null, { status: 200 })
  const identity = {
    variant: 'A' as const, appSha: 'app1', nextVersion: '16.3.8',
    routerSha256: 'router1', method: 'GET',
    requestedUrl: 'http://localhost:3000/es/login', bindHost: 'localhost',
  }
  const a = normalizeObservation(identity, response)
  assert.throws(() => assertComparable(a, { ...a, variant: 'C', appSha: 'app2', nextVersion: '16.4.3' }), /different application commits/)
  assert.throws(() => assertComparable(a, { ...a, method: 'POST' }), /different HTTP methods/)
  assert.doesNotThrow(() => assertComparable(a, { ...a, variant: 'C', nextVersion: '16.4.3', routerSha256: 'router2' }))
})

test('KAN-854/T1 requires an actual SHA-256 for router identity', () => {
  assert.match(sha256(readFileSync('next.config.ts')), /^[0-9a-f]{64}$/)
})
