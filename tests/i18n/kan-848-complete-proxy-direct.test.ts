import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { proxy } from '../../proxy'

test('KAN-848/T2 direct complete proxy keeps ES rewrite without a self-redirect', async () => {
  const rows = []
  for (const host of ['127.0.0.1', 'localhost']) {
    for (const path of ['/', '/dashboard/athletes', '/es/dashboard/athletes']) {
      const url = `http://${host}:31940${path}`
      const request = new NextRequest(url, {
        headers: { host: `${host}:31940`, cookie: 'NEXT_LOCALE=es' },
      })
      const response = await proxy(request)
      rows.push({
        url,
        status: response.status,
        location: response.headers.get('location'),
        rewrite: response.headers.get('x-middleware-rewrite'),
      })
    }
  }
  process.stdout.write('KAN-848 COMPLETE_PROXY_DIRECT_MATRIX ' + JSON.stringify(rows) + '\n')
  for (const row of rows) {
    if (new URL(row.url).pathname.startsWith('/es/')) {
      assert.equal(row.status, 307, JSON.stringify(row))
      assert.equal(new URL(row.location!, row.url).pathname, '/dashboard/athletes', JSON.stringify(row))
    } else {
      assert.equal(row.status, 200, JSON.stringify(row))
      assert.equal(row.location, null, JSON.stringify(row))
      assert.ok(row.rewrite?.includes('/es'), JSON.stringify(row))
    }
  }
})
