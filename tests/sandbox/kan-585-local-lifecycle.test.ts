import assert from 'node:assert/strict'
import test from 'node:test'

import { planLocalCoachSandboxLifecycle } from '../../lib/sandbox/local-lifecycle'

test('KAN-585 plans only a project-scoped local Supabase CLI status check', () => {
  assert.deepEqual(planLocalCoachSandboxLifecycle({
    action: 'status',
    repositoryRoot: '/workspace/trail-running-workout-planner',
  }), {
    command: 'supabase',
    args: ['status', '--workdir', '/workspace/trail-running-workout-planner'],
    cwd: '/workspace/trail-running-workout-planner',
  })
})

test('KAN-585 cannot plan cloud-linked or destructive CLI operations', () => {
  for (const action of ['link', 'db push', 'db reset', 'projects create', 'stop', 'migration up']) {
    assert.throws(() => planLocalCoachSandboxLifecycle({
      action,
      repositoryRoot: '/workspace/trail-running-workout-planner',
    }), /local|unsupported|sandbox/i)
  }
})

test('KAN-585 rejects missing and ambiguous repository roots', () => {
  for (const repositoryRoot of ['', '.', '/workspace/project\n--project-ref=production']) {
    assert.throws(() => planLocalCoachSandboxLifecycle({
      action: 'status',
      repositoryRoot,
    }), /root|sandbox|path/i)
  }
})

test('KAN-585 lifecycle planning performs no process execution', () => {
  const plan = planLocalCoachSandboxLifecycle({
    action: 'status',
    repositoryRoot: '/workspace/trail-running-workout-planner',
  })
  assert.equal(plan.args.includes('--linked'), false)
  assert.equal(plan.command, 'supabase')
})
