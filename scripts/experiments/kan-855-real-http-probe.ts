import { captureHttpRedirectChain } from './kan-854-http-capture'

async function main(): Promise<void> {
  const port = Number(process.env.KAN855_HTTP_PORT ?? '3000')
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('invalid KAN855_HTTP_PORT')
  const origins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
  const paths = ['/', '/es', '/en', '/login']
  const results: unknown[] = []
  for (const origin of origins) {
    for (const path of paths) {
      try {
        const result = await captureHttpRedirectChain(origin + path, {
          permittedOrigins: origins,
          maxHops: 6,
          timeoutMs: 12_000,
        })
        results.push({ origin, path, ...result })
      } catch (error) {
        results.push({ origin, path, error: error instanceof Error ? error.name : 'unknown_error' })
      }
    }
  }
  // No auth cookie/header values or environment variables are printed.
  process.stdout.write(JSON.stringify({ port, results }, null, 2) + '\n')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'probe_failed')
  process.exitCode = 1
})
