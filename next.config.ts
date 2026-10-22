import type { NextConfig } from 'next'
import { resolve } from 'node:path'
import createNextIntlPlugin from 'next-intl/plugin'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  workboxOptions: {
    skipWaiting: true,
  },
})

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  // Test-only Next dev instances must never write generated types into the operator's .next.
  ...(process.env.KAN_HTTP_FIXTURE_DIST_DIR ? {
    distDir: process.env.KAN_HTTP_FIXTURE_DIST_DIR,
    typescript: { tsconfigPath: resolve(process.cwd(), process.env.KAN_HTTP_FIXTURE_DIST_DIR, 'tsconfig.fixture.json') },
  } : {}),
}

// Envolvemos la configuración aplicando primero PWA y luego next-intl (o viceversa)
export default withNextIntl(withPWA(nextConfig))
