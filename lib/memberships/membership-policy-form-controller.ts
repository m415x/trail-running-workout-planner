import { submitTeamEconomicPolicyForm } from './membership-policy-form-submit'

type TeamEconomicPolicyFormInput = {
  monthlyAmount: string
  currency: string
  ordinaryDueDay: string
  effectiveFrom: string
}

type TeamEconomicPolicyActionInput = {
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
  effectiveFrom: string
}

type ActionResult =
  | { success: true }
  | { success: false; error: string }

type ControllerResult =
  | { success: true; error: null }
  | { success: false; error: string }

export function createTeamEconomicPolicyFormController({
  submitAction,
}: {
  submitAction: (input: TeamEconomicPolicyActionInput) => Promise<ActionResult>
}) {
  return {
    async submit(input: TeamEconomicPolicyFormInput): Promise<ControllerResult> {
      const result = await submitTeamEconomicPolicyForm({
        input,
        submit: submitAction,
      })

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        }
      }

      return {
        success: true,
        error: null,
      }
    },
  }
}
