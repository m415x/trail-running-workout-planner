import assert from 'node:assert/strict'
import test from 'node:test'
import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

import { routing } from '../../i18n/routing'
import { carryAuthRefreshIntoResponse } from '../../lib/auth/proxy-response'

const intlMiddleware = createMiddleware(routing)

type Observation = {
  requestUrl: string
  host: string
  cookie: string | null
  status: number
  location: string | null
  rewrite: string | null
  composedStatus: number
  composedLocation: string | null
  composedRewrite: string | null
}

test('KAN-848/T2 isolates next-intl response from auth response composition across host and locale', () => {
  const observations: Observation[] = []
  for (const host of ['127.0.0.1', 'localhost']) {
    for (const cookie of [null, 'es', 'en']) {
      for (const path of ['/', '/dashboard/athletes', '/es/dashboard/athletes', '/en/dashboard/athletes']) {
        const url = `http://${host}:31940${path}`
        const headers = new Headers({ host: `${host}:31940` })
        if (cookie) headers.set('cookie', 'NEXT_LOCALE=' + cookie)
        const request = new NextRequest(url, { headers })
        const localized = intlMiddleware(request)
        const auth = NextResponse.next({ request })
        auth.headers.set('Cache-Control', 'private, no-store')
        const prior = {
          status: localized.status,
          location: localized.headers.get('location'),
          rewrite: localized.headers.get('x-middleware-rewrite'),
        }
        const composed = carryAuthRefreshIntoResponse(auth, localized)
        observations.push({
          requestUrl: url, host, cookie,
          status: prior.status, location: prior.location, rewrite: prior.rewrite,
          composedStatus: composed.status,
          composedLocation: composed.headers.get('location'),
          composedRewrite: composed.headers.get('x-middleware-rewrite'),
        })
      }
    }
  }
  // Auth composition is not allowed to change routing status, Location or rewrite.
  assert.equal(observations.length, 24)
  for (const o of observations) {
    assert.equal(o.composedStatus, o.status, JSON.stringify(o))
    assert.equal(o.composedLocation, o.location, JSON.stringify(o))
    assert.equal(o.composedRewrite, o.rewrite, JSON.stringify(o))
  }
  // Print the controlled matrix for comparison with the independently captured
  // Next.js HTTP trace from KAN-847, even when no causal hypothesis is yet proved.
  process.stdout.write('KAN-848 NEXT_INTL_ISOLATED_MATRIX ' + JSON.stringify(observations) + '\\n')
})
