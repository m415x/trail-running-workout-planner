/**
 * Authorize before invoking a mutation. A denied request cannot evaluate the
 * writer callback; the callback is only reached after an allowed decision.
 */
export async function runAuthorizedCompetitionMutation<TPlan, TResult>(input: {
  authorize(): Promise<TPlan | null>
  onDenied(): TResult
  write(plan: TPlan): TResult | Promise<TResult>
}): Promise<TResult> {
  const plan = await input.authorize()
  if (plan === null) return input.onDenied()
  return input.write(plan)
}
