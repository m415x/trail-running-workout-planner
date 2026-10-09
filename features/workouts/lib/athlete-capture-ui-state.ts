type CaptureResponse =
  | { success: false; status?: 'denied' }
  | { success: true; captured: boolean; workoutLogId: string | null; editableInput: unknown }

type CaptureUiInput =
  | { kind: 'loading' }
  | { kind: 'no-profile' }
  | { kind: 'error' }
  | { kind: 'response'; response: CaptureResponse }

export type AthleteCaptureUiState = {
  status: 'loading' | 'empty' | 'loaded' | 'denied' | 'no-profile' | 'error'
  canCapture: boolean
}

/**
 * Presentation-only projection of authoritative Athlete capture reads.
 * A failed or unresolved request must never enable a write affordance.
 */
export function resolveAthleteCaptureUiState(input: CaptureUiInput): AthleteCaptureUiState {
  switch (input.kind) {
    case 'loading':
      return { status: 'loading', canCapture: false }
    case 'no-profile':
      return { status: 'no-profile', canCapture: false }
    case 'error':
      return { status: 'error', canCapture: false }
    case 'response':
      if (!input.response.success) {
        return { status: input.response.status === 'denied' ? 'denied' : 'error', canCapture: false }
      }
      return {
        status: input.response.captured ? 'loaded' : 'empty',
        canCapture: true,
      }
  }
}
