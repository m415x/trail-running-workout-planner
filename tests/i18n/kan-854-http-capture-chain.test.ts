import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { captureHttpRedirectChain, fingerprintComparableFixture } from '../../scripts/experiments/kan-854-http-capture'

test('KAN-854/T1 captures actual HTTP hops and sanitizes cookie values', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(307, {
        Location: '/en/login',
        'Set-Cookie': 'sb-token=SECRET_MUST_NOT_LEAK; Path=/; HttpOnly',
        'X-Action-Redirect': '/en/dashboard',
      })
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
    }
    res.end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const addr = server.address()
    assert.ok(addr && typeof addr !== 'string')
    const origin = 'http://127.0.0.1:' + addr.port
    const result = await captureHttpRedirectChain(origin + '/start', { permittedOrigins: [origin] })
    assert.equal(result.termination, 'terminal')
    assert.deepEqual(result.hops.map(hop => [hop.method, hop.status, hop.location]), [
      ['GET', 307, '/en/login'],
      ['GET', 200, null],
    ])
    assert.equal(result.hops[0].actionRedirect, '/en/dashboard')
    assert.deepEqual(result.hops[0].cookieNames, ['sb-token'])
    assert.ok(!JSON.stringify(result).includes('SECRET_MUST_NOT_LEAK'))
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

test('KAN-854/T1 refuses off-origin redirect and detects a self-loop', async () => {
  const server = createServer((req, res) => {
    res.writeHead(307, { Location: req.url === '/loop' ? '/loop' : 'https://example.invalid/elsewhere' })
    res.end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const addr = server.address()
    assert.ok(addr && typeof addr !== 'string')
    const origin = 'http://127.0.0.1:' + addr.port
    const loop = await captureHttpRedirectChain(origin + '/loop', { permittedOrigins: [origin] })
    assert.equal(loop.termination, 'loop')
    assert.equal(loop.hops.length, 1)
    const external = await captureHttpRedirectChain(origin + '/external', { permittedOrigins: [origin] })
    assert.equal(external.termination, 'external_redirect')
    assert.equal(external.hops.length, 1)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

test('KAN-854/T1 requires complete variant identities', () => {
  const input = { appSha: 'appsha', nextVersion: '16.3.8', routerSha256: 'router', configSha256: 'config', fixtureSha256: 'fixture', envLabel: 'disposable' }
  assert.match(fingerprintComparableFixture(input), /^[a-f0-9]{64}$/)
  assert.throws(() => fingerprintComparableFixture({ ...input, fixtureSha256: '' }), /Missing experiment identity: fixtureSha256/)
})
