/** Validate a migration approval shape; independent consent and live identity remain separate gates. */
export function requireSpecificLocalMigrationApproval(request: {
  expectedClusterSystemIdentifier?: string
  approval?: unknown
}): void {
  const pin = request.expectedClusterSystemIdentifier
  if (typeof pin !== 'string' || !/^[0-9]{1,20}$/.test(pin)) {
    throw new Error('Trusted local migration approval pin required')
  }

  const document = request.approval
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Explicit migration approval required')
  }

  const fields = document as Record<string, unknown>
  const keys = Object.keys(fields)
  const allowed = ['operation', 'approvedByOperator', 'approvedClusterSystemIdentifier']
  if (
    keys.length !== allowed.length
    || keys.some(key => !allowed.includes(key))
    || fields.operation !== 'migrate'
    || fields.approvedByOperator !== true
    || fields.approvedClusterSystemIdentifier !== pin
  ) {
    throw new Error('Local migration approval invalid or cluster mismatch')
  }
}
