// KAN-786 isolated Next application. Keep the default Server Actions body limit.
// Next 16 otherwise infers the parent pnpm workspace root, importing production proxy.ts.
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtureRoot = dirname(fileURLToPath(import.meta.url))
export default {
  devIndicators: false,
  turbopack: { root: fixtureRoot },
}
