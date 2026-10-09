import { useMemo } from 'react'

export function useHomeHeader(presentationLocale: string) {
  const today = useMemo(() => {
    const formatted = new Intl.DateTimeFormat(presentationLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())

    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [presentationLocale])

  return { today }
}
