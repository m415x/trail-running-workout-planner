export type RedirectProvenanceInput = {
  status: number
  location: string | null
  middlewareRewrite: string | null
  middlewareRedirect: string | null
  proxyObserved: boolean
}

export type RedirectProvenanceResult = {
  classification: 'unattributed' | 'proxy_redirect_observed' | 'no_redirect'
  reason:
    | 'no_proxy_observation'
    | 'matching_proxy_redirect'
    | 'rewrite_does_not_prove_redirect_source'
    | 'not_redirect_response'
    | 'insufficient_matching_evidence'
}

/**
 * Classifies only observed evidence; a rewrite or a response Location header
 * does not independently identify the component that emitted a redirect.
 */
export function classifyRedirectProvenance(input: RedirectProvenanceInput): RedirectProvenanceResult {
  const isRedirect = [301, 302, 303, 307, 308].includes(input.status) && input.location !== null

  if (!isRedirect) {
    return { classification: 'no_redirect', reason: 'not_redirect_response' }
  }

  if (!input.proxyObserved) {
    return { classification: 'unattributed', reason: 'no_proxy_observation' }
  }

  if (input.middlewareRedirect !== null && input.middlewareRedirect === input.location) {
    return { classification: 'proxy_redirect_observed', reason: 'matching_proxy_redirect' }
  }

  if (input.middlewareRewrite !== null) {
    return { classification: 'unattributed', reason: 'rewrite_does_not_prove_redirect_source' }
  }

  return { classification: 'unattributed', reason: 'insufficient_matching_evidence' }
}
