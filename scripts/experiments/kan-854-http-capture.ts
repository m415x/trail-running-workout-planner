import { createHash } from 'node:crypto'

export type HttpHop = {
  method: string
  url: string
  host: string
  forwardedHost: string | null
  middlewareRewrite: string | null
  status: number
  location: string | null
  actionRedirect: string | null
  cookieNames: string[]
}

function cookieNames(headers: Headers): string[] {
  const cookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter((v): v is string => v !== null)
  return [...new Set(cookies.map(v => v.split('=', 1)[0].trim()).filter(Boolean))].sort()
}

export async function captureHttpRedirectChain(
  startUrl: string,
  options: {
    maxHops?: number
    method?: 'GET' | 'HEAD'
    headers?: Record<string, string>
    timeoutMs?: number
    permittedOrigins: string[]
  },
): Promise<{ hops: HttpHop[]; termination: 'terminal' | 'loop' | 'redirect_limit' | 'external_redirect' }> {
  const maxHops = options.maxHops ?? 8
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 16) throw new Error('invalid bounded redirect count')
  const allowed = new Set(options.permittedOrigins.map(origin => new URL(origin).origin))
  let current = new URL(startUrl)
  if (!allowed.has(current.origin)) throw new Error('initial origin is not permitted')
  const seen = new Set<string>()
  const hops: HttpHop[] = []
  for (let i = 0; i < maxHops; i++) {
    if (seen.has(current.href)) return { hops, termination: 'loop' }
    seen.add(current.href)
    const response = await fetch(current, {
      method: options.method ?? 'GET',
      headers: options.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    })
    const location = response.headers.get('location')
    hops.push({
      method: options.method ?? 'GET',
      url: current.href,
      host: current.host,
      forwardedHost: options.headers ? (Object.entries(options.headers).find(([name]) => name.toLowerCase() === 'x-forwarded-host')?.[1] ?? null) : null,
      middlewareRewrite: response.headers.get('x-middleware-rewrite'),
      status: response.status,
      location,
      actionRedirect: response.headers.get('x-action-redirect'),
      cookieNames: cookieNames(response.headers),
    })
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
      return { hops, termination: 'terminal' }
    }
    const next = new URL(location, current)
    if (!allowed.has(next.origin)) return { hops, termination: 'external_redirect' }
    current = next
  }
  return { hops, termination: 'redirect_limit' }
}

export function fingerprintComparableFixture(input: {
  appSha: string
  nextVersion: string
  routerSha256: string
  configSha256: string
  fixtureSha256: string
  envLabel: string
}): string {
  for (const [name, value] of Object.entries(input)) {
    if (!value.trim()) throw new Error('Missing experiment identity: ' + name)
  }
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}
