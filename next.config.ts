import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Evita problemas en desarrollo
  register: true,
  workboxOptions: {
    skipWaiting: true, // 👈 Se reubica dentro de workboxOptions
  },
})

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  /* config options here */
}

// Envolvemos la configuración aplicando primero PWA y luego next-intl (o viceversa)
export default withNextIntl(withPWA(nextConfig))
