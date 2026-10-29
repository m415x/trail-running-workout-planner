import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyRedirectProvenance } from '../../scripts/experiments/kan-855-redirect-origin'

test('KAN-855/S3 classifies observed proxy and response evidence without guessing a 307 emitter', () => {
  assert.deepEqual(classifyRedirectProvenance({
    status: 307,
    location: '/',
    middlewareRewrite: null,
    middlewareRedirect: null,
    proxyObserved: false,
  }), { classification: 'unattributed', reason: 'no_proxy_observation' })

  assert.deepEqual(classifyRedirectProvenance({
    status: 307,
    location: '/',
    middlewareRewrite: null,
    middlewareRedirect: '/',
    proxyObserved: true,
  }), { classification: 'proxy_redirect_observed', reason: 'matching_proxy_redirect' })

  assert.deepEqual(classifyRedirectProvenance({
    status: 307,
    location: '/',
    middlewareRewrite: '/es',
    middlewareRedirect: null,
    proxyObserved: true,
  }), { classification: 'unattributed', reason: 'rewrite_does_not_prove_redirect_source' })

  assert.deepEqual(classifyRedirectProvenance({
    status: 200,
    location: null,
    middlewareRewrite: '/es',
    middlewareRedirect: null,
    proxyObserved: true,
  }), { classification: 'no_redirect', reason: 'not_redirect_response' })
})
