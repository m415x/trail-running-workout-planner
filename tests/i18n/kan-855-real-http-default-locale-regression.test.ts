import assert from 'node:assert/strict'
import test from 'node:test'

const enabled = process.env.KAN855_HTTP_ACCEPTANCE === '1'
const port = Number(process.env.KAN855_HTTP_PORT || '3000')
const hosts = ['127.0.0.1', 'localhost']
const paths = ['/', '/es', '/login', '/es/login', '/en/login']
const expected = new Map([
  ['/es', '/'],
  ['/es/login', '/login'],
])

for (const host of hosts) {
  for (const path of paths) {
    test('KAN-855 real HTTP default-locale routing ' + host + path, { skip: !enabled }, async () => {
      assert.ok(Number.isInteger(port) && port > 0 && port < 65536)
      const url = 'http://' + host + ':' + port + path
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      })
      const location = response.headers.get('location')
      if (expected.has(path)) {
        assert.equal(response.status, 307)
        assert.equal(location, expected.get(path))
      } else if (path === '/en/login') {
        assert.equal(response.status, 200)
        assert.equal(location, null)
      } else {
        assert.notEqual(location, path, 'HTTP redirect loops to the original request')
        assert.notEqual(response.status, 500)
        assert.ok([200, 302, 303, 307, 308].includes(response.status))
      }
      await response.body?.cancel()
    })
  }
}
