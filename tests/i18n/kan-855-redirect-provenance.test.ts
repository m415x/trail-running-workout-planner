import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { captureHttpRedirectChain } from '../../scripts/experiments/kan-854-http-capture'

test('KAN-855/S3 records bounded redirect provenance without leaking forwarded authority or cookies', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(307, {
        Location: '/',
        'x-middleware-rewrite': 'http://127.0.0.1:3000/es',
        'Set-Cookie': 'sb-token=SECRET_MUST_NOT_LEAK; Path=/; HttpOnly',
      })
    } else {
      res.writeHead(200)
    }
    res.end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const addr = server.address()
    assert.ok(addr && typeof addr !== 'string')
    const origin = 'http://127.0.0.1:' + addr.port
    const result = await captureHttpRedirectChain(origin + '/', {
      permittedOrigins: [origin],
      headers: { 'x-forwarded-host': 'localhost:3000', cookie: 'sb-token=SECRET_MUST_NOT_LEAK' },
    })
    assert.equal(result.termination, 'loop')
    const first = result.hops[0] as typeof result.hops[number] & {
      forwardedHost?: string
      middlewareRewrite?: string | null
    }
    assert.equal(first.forwardedHost, 'localhost:3000')
    assert.equal(first.middlewareRewrite, 'http://127.0.0.1:3000/es')
    assert.equal(first.location, '/')
    assert.deepEqual(first.cookieNames, ['sb-token'])
    assert.ok(!JSON.stringify(result).includes('SECRET_MUST_NOT_LEAK'))
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

test('KAN-855/S3 strips query fragments and action headers from returned HTTP capture', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(307, {
      Location: '/login?code=SECRET_QUERY#SECRET_FRAGMENT',
      'x-action-redirect': '/dashboard?token=SECRET_ACTION',
      'x-middleware-rewrite': 'http://localhost:3000/es/login?secret=SECRET_REWRITE#SECRET_HASH',
    })
    res.end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const origin = 'http://127.0.0.1:' + address.port
    const capture = await captureHttpRedirectChain(origin + '/?key=SECRET_START#SECRET_START_HASH', {
      permittedOrigins: [origin],
      maxHops: 1,
    })
    const text = JSON.stringify(capture)
    for (const secret of ['SECRET_QUERY', 'SECRET_FRAGMENT', 'SECRET_ACTION', 'SECRET_REWRITE', 'SECRET_HASH', 'SECRET_START']) {
      assert.ok(!text.includes(secret), 'Sensitive capture value leaked')
    }
    assert.equal(capture.hops[0]?.location, '/login')
    assert.equal(capture.hops[0]?.actionRedirect, '[redacted]')
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
