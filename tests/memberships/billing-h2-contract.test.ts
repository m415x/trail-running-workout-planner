import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyGlobalDueDateException,
  applyMonthlyChargeExtension,
  applyMonthlyChargeReduction,
  projectMonthlyChargeWithExceptions,
  type GlobalDueDateExceptionRevision,
  type MonthlyChargeExtensionRevision,
  type MonthlyChargeReductionRevision,
  type MonthlyChargeCandidate,
} from '@/lib/memberships/billing'

const charge: MonthlyChargeCandidate = {
  athleteId: 'athlete-1',
  billingTermsId: 'terms-1',
  year: 2026,
  month: 10,
  baseAmountMinor: 2_500_000,
  amountDueMinor: 2_500_000,
  currency: 'ARS',
  baseDueDate: '2026-10-05',
  effectiveDueDate: '2026-10-05',
}

test('global due-date exceptions have one current revision per team/month and preserve correction history', () => {
  const initial = applyGlobalDueDateException({
    revisions: [],
    id: 'due-exception-1',
    teamId: 'team-1',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Feriado bancario',
  })
  const corrected = applyGlobalDueDateException({
    revisions: initial,
    id: 'due-exception-2',
    teamId: 'team-1',
    year: 2026,
    month: 10,
    dueDate: '2026-10-17',
    reason: 'Corrección de fecha',
  })

  assert.equal(corrected.length, 2)
  assert.deepEqual(
    corrected.map(revision => [revision.id, revision.teamId, revision.year, revision.month]),
    [
      ['due-exception-1', 'team-1', 2026, 10],
      ['due-exception-2', 'team-1', 2026, 10],
    ],
  )
  assert.equal(corrected.filter(revision => revision.isCurrent).length, 1)
  assert.equal(corrected.find(revision => revision.isCurrent)?.dueDate, '2026-10-17')
})

test('repeating the same global due-date decision is idempotent', () => {
  const initial = applyGlobalDueDateException({
    revisions: [],
    id: 'due-exception-1',
    teamId: 'team-1',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Feriado bancario',
  })
  const repeated = applyGlobalDueDateException({
    revisions: initial,
    id: 'retry-id-must-not-create-history',
    teamId: 'team-1',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Feriado bancario',
  })

  assert.deepEqual(repeated, initial)
})

test('all H2 economic facts require a non-empty normalized reason', () => {
  assert.throws(
    () => applyGlobalDueDateException({
      revisions: [],
      id: 'due-exception-1',
      teamId: 'team-1',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: '   ',
    }),
    /reason/i,
  )

  assert.throws(
    () => applyMonthlyChargeReduction({
      revisions: [],
      id: 'reduction-1',
      charge,
      reductionAmountMinor: 500_000,
      reason: '',
    }),
    /reason/i,
  )

  assert.throws(
    () => applyMonthlyChargeExtension({
      revisions: [],
      id: 'extension-1',
      charge,
      extendedDueDate: '2026-10-20',
      reason: '   ',
    }),
    /reason/i,
  )
})

test('a charge has one current reduction revision while corrections remain append-only', () => {
  const first = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca parcial',
  })
  const corrected = applyMonthlyChargeReduction({
    revisions: first,
    id: 'reduction-2',
    charge,
    reductionAmountMinor: 750_000,
    reason: 'Corrección de beca',
  })

  assert.equal(corrected.length, 2)
  assert.equal(corrected.filter(revision => revision.isCurrent).length, 1)

  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: null,
    reductionRevisions: corrected,
    extensionRevisions: [],
  })

  assert.equal(projected.baseAmountMinor, 2_500_000)
  assert.equal(projected.amountDueMinor, 1_750_000)
  assert.equal(projected.currency, 'ARS')
})

test('reductions use absolute minor units, allow a total scholarship, and never make amount due negative', () => {
  const total = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-total',
    charge,
    reductionAmountMinor: charge.baseAmountMinor,
    reason: 'Beca total',
  })
  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: null,
    reductionRevisions: total,
    extensionRevisions: [],
  })

  assert.equal(projected.baseAmountMinor, 2_500_000)
  assert.equal(projected.amountDueMinor, 0)

  assert.throws(
    () => applyMonthlyChargeReduction({
      revisions: [],
      id: 'reduction-invalid',
      charge,
      reductionAmountMinor: charge.baseAmountMinor + 1,
      reason: 'Importe inválido',
    }),
    /reduction|amount/i,
  )
})

test('a reduction can be explicitly withdrawn without deleting its history', () => {
  const first = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca parcial',
  })
  const withdrawn = applyMonthlyChargeReduction({
    revisions: first,
    id: 'reduction-2',
    charge,
    reductionAmountMinor: 0,
    reason: 'Retiro explícito de la beca',
  })
  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: null,
    reductionRevisions: withdrawn,
    extensionRevisions: [],
  })

  assert.equal(withdrawn.length, 2)
  assert.equal(withdrawn.filter(revision => revision.isCurrent).length, 1)
  assert.equal(projected.amountDueMinor, projected.baseAmountMinor)
})

test('a charge has one current extension revision and a new extension must be after the current base due date', () => {
  const first = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge,
    extendedDueDate: '2026-10-20',
    reason: 'Prórroga solicitada',
  })
  const corrected = applyMonthlyChargeExtension({
    revisions: first,
    id: 'extension-2',
    charge,
    extendedDueDate: '2026-10-18',
    reason: 'Corrección de fecha',
  })

  assert.equal(corrected.length, 2)
  assert.equal(corrected.filter(revision => revision.isCurrent).length, 1)
  assert.equal(corrected.find(revision => revision.isCurrent)?.extendedDueDate, '2026-10-18')

  assert.throws(
    () => applyMonthlyChargeExtension({
      revisions: corrected,
      id: 'extension-invalid',
      charge: { ...charge, baseDueDate: '2026-10-18', effectiveDueDate: '2026-10-18' },
      extendedDueDate: '2026-10-18',
      reason: 'No extiende el vencimiento',
    }),
    /after|due date|extension/i,
  )
})

test('effective due date is max(baseDueDate, current extendedDueDate) without invalidating the extension', () => {
  const extensionRevisions = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge,
    extendedDueDate: '2026-10-20',
    reason: 'Prórroga solicitada',
  })

  const baseMovedPastExtension = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: {
      id: 'due-exception-1',
      teamId: 'team-1',
      year: 2026,
      month: 10,
      dueDate: '2026-10-25',
      reason: 'Excepción global posterior',
      isCurrent: true,
    },
    reductionRevisions: [],
    extensionRevisions,
  })

  assert.equal(baseMovedPastExtension.baseDueDate, '2026-10-25')
  assert.equal(baseMovedPastExtension.effectiveDueDate, '2026-10-25')
  assert.equal(extensionRevisions.find(revision => revision.isCurrent)?.extendedDueDate, '2026-10-20')

  const baseCorrectedBeforeExtension = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: {
      id: 'due-exception-2',
      teamId: 'team-1',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Corrección de excepción global',
      isCurrent: true,
    },
    reductionRevisions: [],
    extensionRevisions,
  })

  assert.equal(baseCorrectedBeforeExtension.baseDueDate, '2026-10-15')
  assert.equal(baseCorrectedBeforeExtension.effectiveDueDate, '2026-10-20')
})

test('withdrawing an extension preserves history and removes it from the due-date projection', () => {
  const first = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge,
    extendedDueDate: '2026-10-20',
    reason: 'Prórroga solicitada',
  })
  const withdrawn = applyMonthlyChargeExtension({
    revisions: first,
    id: 'extension-2',
    charge,
    extendedDueDate: null,
    reason: 'Retiro explícito de la prórroga',
  })
  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: null,
    reductionRevisions: [],
    extensionRevisions: withdrawn,
  })

  assert.equal(withdrawn.length, 2)
  assert.equal(withdrawn.filter(revision => revision.isCurrent).length, 1)
  assert.equal(projected.effectiveDueDate, projected.baseDueDate)
})

test('a global exception changes base due date for an existing charge but never amount fields', () => {
  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: {
      id: 'due-exception-1',
      teamId: 'team-1',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Vencimiento excepcional',
      isCurrent: true,
    },
    reductionRevisions: [],
    extensionRevisions: [],
  })

  assert.equal(projected.baseDueDate, '2026-10-15')
  assert.equal(projected.effectiveDueDate, '2026-10-15')
  assert.equal(projected.baseAmountMinor, charge.baseAmountMinor)
  assert.equal(projected.amountDueMinor, charge.amountDueMinor)
})

test('the first reached month cannot become due before economic activation after a global exception', () => {
  const firstMonthCharge: MonthlyChargeCandidate = {
    ...charge,
    baseDueDate: '2026-10-18',
    effectiveDueDate: '2026-10-18',
  }

  const projected = projectMonthlyChargeWithExceptions({
    charge: firstMonthCharge,
    economicActivationDate: '2026-10-18',
    globalDueDateException: {
      id: 'due-exception-1',
      teamId: 'team-1',
      year: 2026,
      month: 10,
      dueDate: '2026-10-10',
      reason: 'Excepción global',
      isCurrent: true,
    },
    reductionRevisions: [],
    extensionRevisions: [],
  })

  assert.equal(projected.baseDueDate, '2026-10-18')
  assert.equal(projected.effectiveDueDate, '2026-10-18')
})

test('reduction and extension retries do not create duplicate history', () => {
  const reductions: MonthlyChargeReductionRevision[] = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca parcial',
  })
  const extensions: MonthlyChargeExtensionRevision[] = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge,
    extendedDueDate: '2026-10-20',
    reason: 'Prórroga solicitada',
  })

  assert.deepEqual(
    applyMonthlyChargeReduction({
      revisions: reductions,
      id: 'retry-reduction',
      charge,
      reductionAmountMinor: 500_000,
      reason: 'Beca parcial',
    }),
    reductions,
  )
  assert.deepEqual(
    applyMonthlyChargeExtension({
      revisions: extensions,
      id: 'retry-extension',
      charge,
      extendedDueDate: '2026-10-20',
      reason: 'Prórroga solicitada',
    }),
    extensions,
  )
})

test('global exception identity is team/month while reductions and extensions are scoped to one charge', () => {
  const exception: GlobalDueDateExceptionRevision[] = applyGlobalDueDateException({
    revisions: [],
    id: 'due-exception-1',
    teamId: 'team-1',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Excepción del período',
  })
  const reductions: MonthlyChargeReductionRevision[] = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca parcial',
  })
  const extensions: MonthlyChargeExtensionRevision[] = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge,
    extendedDueDate: '2026-10-20',
    reason: 'Prórroga solicitada',
  })

  assert.deepEqual(
    [exception[0]?.teamId, exception[0]?.year, exception[0]?.month],
    ['team-1', 2026, 10],
  )
  assert.equal(reductions[0]?.athleteId, charge.athleteId)
  assert.equal(reductions[0]?.year, charge.year)
  assert.equal(reductions[0]?.month, charge.month)
  assert.equal(extensions[0]?.athleteId, charge.athleteId)
  assert.equal(extensions[0]?.year, charge.year)
  assert.equal(extensions[0]?.month, charge.month)
})
