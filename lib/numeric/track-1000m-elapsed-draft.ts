import { parseRegionalNumericInput } from './regional-numeric-input'

export type Track1000mElapsedDraftResult =
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly elapsedTimeSec: number }

/** Parse strict minutes and seconds without truncating fractional input. */
export function normalizeTrack1000mElapsedDraft(
  minutes: string,
  seconds: string,
): Track1000mElapsedDraftResult {
  const parsedMinutes = parseRegionalNumericInput(minutes, { kind: 'integer' })
  const parsedSeconds = parseRegionalNumericInput(seconds, { kind: 'integer' })

  if (parsedMinutes.status !== 'valid' || parsedSeconds.status !== 'valid') {
    return { status: 'invalid' }
  }

  const minuteValue = parsedMinutes.value
  const secondValue = parsedSeconds.value
  if (!Number.isSafeInteger(minuteValue) || !Number.isSafeInteger(secondValue) ||
      minuteValue < 0 || secondValue < 0 || secondValue > 59) {
    return { status: 'invalid' }
  }

  const elapsedTimeSec = minuteValue * 60 + secondValue
  if (!Number.isSafeInteger(elapsedTimeSec) || elapsedTimeSec <= 0) {
    return { status: 'invalid' }
  }

  return { status: 'valid', elapsedTimeSec }
}
