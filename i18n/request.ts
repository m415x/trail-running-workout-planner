import { getRequestConfig } from 'next-intl/server'
import { loadMessages, type SupportedLocale } from './messages'

const supportedLocales = new Set<SupportedLocale>(['en', 'es'])

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: SupportedLocale =
    requested && supportedLocales.has(requested as SupportedLocale) ? (requested as SupportedLocale) : 'es'

  return {
    locale,
    messages: await loadMessages(locale),
  }
})
