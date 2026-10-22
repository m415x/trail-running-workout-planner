import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeLocalSpanishRewrite } from '../../lib/i18n/normalize-local-rewrite'

test('KAN-849 diagnoses NextRequest canonical URL versus actual loopback authority', () => {
  const rows = []
  for (const host of ['127.0.0.1', 'localhost']) {
    const request = new NextRequest(`http://${host}:31940/dashboard/athletes`, {
      headers: { host: `${host}:31940`, cookie: 'NEXT_LOCALE=es' },
    })
    const response = NextResponse.rewrite(new URL('http://localhost:31940/es/dashboard/athletes'))
    const before = response.headers.get('x-middleware-rewrite')
    normalizeLocalSpanishRewrite(request, response)
    rows.push({
      host, requestUrl: request.url, nextUrl: request.nextUrl.toString(),
      requestHost: request.headers.get('host'), before,
      after: response.headers.get('x-middleware-rewrite'),
    })
  }
  process.stdout.write('KAN-849 REWRITE_NORMALIZATION_MATRIX ' + JSON.stringify(rows) + '\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].after, 'http://127.0.0.1:31940/es/dashboard/athletes',
    'Loopback rewrite should become relative for actual 127.0.0.1 request')
  assert.equal(rows[1].after, rows[1].before,
    'Matched localhost authority should be left intact')
})
