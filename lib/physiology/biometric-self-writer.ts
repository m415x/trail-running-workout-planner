import {
  validateSelfDeclaredBiometric,
  validateSelfDeclaredObservedOn,
} from '@/lib/physiology/self-declared-biometric-validation'

export interface BiometricWriteSubject {
  readonly status: 'resolved'
  readonly userId: string
  readonly teamId: string
  readonly athleteProfileId: string
}

export interface BiometricCreateInput {
  readonly kind: string
  readonly unit: string
  readonly value: string
  readonly observedOn: string
  readonly operationKey: string
}

export interface BiometricValidatedCreate extends Omit<BiometricCreateInput, 'value'> {
  readonly valueScaled: number
}

export interface BiometricSelfWriterDeps<T> {
  /** Resolve authenticated SELF authority again for each operation. */
  readonly authorize: () => Promise<BiometricWriteSubject | { readonly status: 'denied' }>
  /** Must be a transactionally authorized, isolated repository; not exposed by this module. */
  readonly persist: (subject: BiometricWriteSubject, input: BiometricValidatedCreate) => Promise<T>
  /** Server-supplied civil day, never taken from the client request. */
  readonly today: () => string
}

/**
 * Pre-write guard only. It deliberately does not implement SQL persistence,
 * replay, concurrency, revision chains or the public Server Action.
 */
export function createBiometricSelfWriter<T>(deps: BiometricSelfWriterDeps<T>) {
  return {
    async create(input: BiometricCreateInput): Promise<
      | { readonly status: 'denied' }
      | { readonly status: 'invalid' }
      | { readonly status: 'conflict' }
      | { readonly status: 'persisted'; readonly result: T }
    > {
      const subject = await deps.authorize()
      if (subject.status !== 'resolved') return { status: 'denied' }

      const validated = validateSelfDeclaredBiometric(input)
      if (validated.status !== 'valid'
        || !validateSelfDeclaredObservedOn({ observedOn: input.observedOn, today: deps.today() })
        || !/^[A-Za-z0-9_-]{1,128}$/.test(input.operationKey)) {
        return { status: 'invalid' }
      }

      const result = await deps.persist(subject, {
        kind: input.kind,
        unit: input.unit,
        observedOn: input.observedOn,
        operationKey: input.operationKey,
        valueScaled: validated.valueScaled,
      })
      if (result !== null && typeof result === 'object' && 'status' in result) {
        if (result.status === 'denied') return { status: 'denied' }
        if (result.status === 'conflict') return { status: 'conflict' }
      }
      return { status: 'persisted', result }
    },
  }
}
