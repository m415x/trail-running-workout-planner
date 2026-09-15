import type { AbstractIntlMessages } from 'next-intl'
import { messageFragmentPaths } from './message-fragments'

export type SupportedLocale = 'en' | 'es'

type MessageObject = Record<string, unknown>

function isObject(value: unknown): value is MessageObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeMessages(target: MessageObject, source: MessageObject, sourceName: string, prefix = ''): void {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key
    const existing = target[key]

    if (existing === undefined) {
      target[key] = value
      continue
    }

    if (isObject(existing) && isObject(value)) {
      mergeMessages(existing, value, sourceName, path)
      continue
    }

    throw new Error(`Duplicate message key "${path}" while loading ${sourceName}`)
  }
}

async function importFragment(locale: SupportedLocale, path: string): Promise<MessageObject> {
  // Explicit locale branches keep the imports statically discoverable by the bundler.
  if (locale === 'en') {
    switch (path) {
      case 'common/common':
        return (await import('@/messages/en/common/common.json')).default
      case 'common/weather':
        return (await import('@/messages/en/common/weather.json')).default
      case 'planning/base-planning':
        return (await import('@/messages/en/planning/base-planning.json')).default
      case 'planning/training-goals':
        return (await import('@/messages/en/planning/training-goals.json')).default
      case 'planning/workout-templates':
        return (await import('@/messages/en/planning/workout-templates.json')).default
      case 'competitions/race-distance-policy':
        return (await import('@/messages/en/competitions/race-distance-policy.json')).default
      case 'competitions/race-catalog':
        return (await import('@/messages/en/competitions/race-catalog.json')).default
      case 'realized-training/workouts':
        return (await import('@/messages/en/realized-training/workouts.json')).default
      case 'realized-training/plan-real-comparison':
        return (await import('@/messages/en/realized-training/plan-real-comparison.json')).default
      case 'realized-training/history':
        return (await import('@/messages/en/realized-training/history.json')).default
      case 'realized-training/calendar':
        return (await import('@/messages/en/realized-training/calendar.json')).default
      case 'athletes/actions':
        return (await import('@/messages/en/athletes/actions.json')).default
      case 'glossary/planning':
        return (await import('@/messages/en/glossary/planning.json')).default
    }
  } else {
    switch (path) {
      case 'common/common':
        return (await import('@/messages/es/common/common.json')).default
      case 'common/weather':
        return (await import('@/messages/es/common/weather.json')).default
      case 'planning/base-planning':
        return (await import('@/messages/es/planning/base-planning.json')).default
      case 'planning/training-goals':
        return (await import('@/messages/es/planning/training-goals.json')).default
      case 'planning/workout-templates':
        return (await import('@/messages/es/planning/workout-templates.json')).default
      case 'competitions/race-distance-policy':
        return (await import('@/messages/es/competitions/race-distance-policy.json')).default
      case 'competitions/race-catalog':
        return (await import('@/messages/es/competitions/race-catalog.json')).default
      case 'realized-training/workouts':
        return (await import('@/messages/es/realized-training/workouts.json')).default
      case 'realized-training/plan-real-comparison':
        return (await import('@/messages/es/realized-training/plan-real-comparison.json')).default
      case 'realized-training/history':
        return (await import('@/messages/es/realized-training/history.json')).default
      case 'realized-training/calendar':
        return (await import('@/messages/es/realized-training/calendar.json')).default
      case 'athletes/actions':
        return (await import('@/messages/es/athletes/actions.json')).default
      case 'glossary/planning':
        return (await import('@/messages/es/glossary/planning.json')).default
    }
  }

  throw new Error(`Unknown message fragment: ${locale}/${path}`)
}

export async function loadMessages(locale: SupportedLocale): Promise<AbstractIntlMessages> {
  const messages: MessageObject = {}

  for (const path of messageFragmentPaths) {
    mergeMessages(messages, await importFragment(locale, path), `${locale}/${path}`)
  }

  return messages as AbstractIntlMessages
}
