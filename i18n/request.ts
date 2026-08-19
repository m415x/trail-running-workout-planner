import { getRequestConfig } from 'next-intl/server'
import { routing, type Locale } from '@/i18n/routing'

function isValidLocale(locale: string): locale is Locale {
  return routing.locales.includes(locale as Locale)
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale

  const locale = requestedLocale && isValidLocale(requestedLocale) ? requestedLocale : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
