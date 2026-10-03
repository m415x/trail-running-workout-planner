import { inspectSandboxDestination } from '../sandbox/sandbox-destination'

const groupPilotOperations = [
  'getGroupsByTeam',
  'getGroupById',
  'createGroup',
  'updateGroup',
] as const

type GroupPilotOperation = (typeof groupPilotOperations)[number]

/**
 * Non-operational allowlist for pure synthetic contract verification only.
 * Never supplies a database connection, migration permission or runtime switch.
 */
export function inspectGroupPilotIntent(request: {
  surface?: string
  operation?: string
  directUrl?: string
}): { accepted: true; operation: GroupPilotOperation } {
  if (request.surface !== 'synthetic_test') {
    throw new Error('Group pilot synthetic surface required')
  }
  if (!groupPilotOperations.some(operation => operation === request.operation)) {
    throw new Error('Group pilot operation not allowed')
  }
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })
  return { accepted: true, operation: request.operation as GroupPilotOperation }
}
