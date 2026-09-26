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


test('H2 revisions cannot mix a different logical identity into an existing revision stream', () => {
  const globalRevisions = applyGlobalDueDateException({
    revisions: [],
    id: 'due-exception-1',
    teamId: 'team-1',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Excepción octubre',
  })

  assert.throws(
    () => applyGlobalDueDateException({
      revisions: globalRevisions,
      id: 'due-exception-other-period',
      teamId: 'team-1',
      year: 2026,
      month: 11,
      dueDate: '2026-11-15',
      reason: 'Excepción noviembre',
    }),
    /identity|revision stream|team.*month/i,
  )

  const reductions = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca parcial',
  })
  const otherCharge = { ...charge, month: 11, baseDueDate: '2026-11-05', effectiveDueDate: '2026-11-05' }

  assert.throws(
    () => applyMonthlyChargeReduction({
      revisions: reductions,
      id: 'reduction-other-charge',
      charge: otherCharge,
      reductionAmountMinor: 500_000,
      reason: 'Otra cuota',
    }),
    /identity|revision stream|charge/i,
  )
})

test('projection rejects more than one current revision for the same H2 fact', () => {
  const ambiguousReductions: MonthlyChargeReductionRevision[] = [
    {
      id: 'reduction-1',
      athleteId: charge.athleteId,
      year: charge.year,
      month: charge.month,
      reductionAmountMinor: 500_000,
      reason: 'Primera',
      isCurrent: true,
    },
    {
      id: 'reduction-2',
      athleteId: charge.athleteId,
      year: charge.year,
      month: charge.month,
      reductionAmountMinor: 750_000,
      reason: 'Segunda',
      isCurrent: true,
    },
  ]

  assert.throws(
    () => projectMonthlyChargeWithExceptions({
      charge,
      globalDueDateException: null,
      reductionRevisions: ambiguousReductions,
      extensionRevisions: [],
    }),
    /more than one current|ambiguous/i,
  )
})

test('reduction, global due-date exception, and extension compose without crossing concerns', () => {
  const reductions = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca parcial',
  })
  const extensions = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge: { ...charge, baseDueDate: '2026-10-15', effectiveDueDate: '2026-10-15' },
    extendedDueDate: '2026-10-20',
    reason: 'Prórroga individual',
  })

  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: {
      id: 'due-exception-1',
      teamId: 'team-1',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Excepción global',
      isCurrent: true,
    },
    reductionRevisions: reductions,
    extensionRevisions: extensions,
  })

  assert.equal(projected.baseAmountMinor, 2_500_000)
  assert.equal(projected.amountDueMinor, 2_000_000)
  assert.equal(projected.baseDueDate, '2026-10-15')
  assert.equal(projected.effectiveDueDate, '2026-10-20')
})


test('projection rejects more than one current extension revision for the same charge', () => {
  const ambiguousExtensions: MonthlyChargeExtensionRevision[] = [
    {
      id: 'extension-1',
      athleteId: charge.athleteId,
      year: charge.year,
      month: charge.month,
      extendedDueDate: '2026-10-20',
      reason: 'Primera prórroga',
      isCurrent: true,
    },
    {
      id: 'extension-2',
      athleteId: charge.athleteId,
      year: charge.year,
      month: charge.month,
      extendedDueDate: '2026-10-25',
      reason: 'Segunda prórroga',
      isCurrent: true,
    },
  ]

  assert.throws(
    () => projectMonthlyChargeWithExceptions({
      charge,
      globalDueDateException: null,
      reductionRevisions: [],
      extensionRevisions: ambiguousExtensions,
    }),
    /more than one current|ambiguous/i,
  )
})

test('projection rejects a global due-date exception from a different charge period', () => {
  assert.throws(
    () => projectMonthlyChargeWithExceptions({
      charge,
      globalDueDateException: {
        id: 'due-exception-november',
        teamId: 'team-1',
        year: 2026,
        month: 11,
        dueDate: '2026-11-15',
        reason: 'Excepción de otro período',
        isCurrent: true,
      },
      reductionRevisions: [],
      extensionRevisions: [],
    }),
    /period|month|identity/i,
  )
})


test('H2 facts reject invalid calendar periods and malformed dates', () => {
  assert.throws(
    () => applyGlobalDueDateException({
      revisions: [],
      id: 'invalid-month',
      teamId: 'team-1',
      year: 2026,
      month: 13,
      dueDate: '2026-12-15',
      reason: 'Período inválido',
    }),
    /month|period/i,
  )

  assert.throws(
    () => applyGlobalDueDateException({
      revisions: [],
      id: 'invalid-date',
      teamId: 'team-1',
      year: 2026,
      month: 10,
      dueDate: '2026-10-99',
      reason: 'Fecha inválida',
    }),
    /invalid date|date/i,
  )
})

test('projection rejects reduction and extension revisions belonging to another charge', () => {
  const foreignReduction: MonthlyChargeReductionRevision = {
    id: 'foreign-reduction',
    athleteId: charge.athleteId,
    year: 2026,
    month: 11,
    reductionAmountMinor: 500_000,
    reason: 'Otra cuota',
    isCurrent: true,
  }
  const foreignExtension: MonthlyChargeExtensionRevision = {
    id: 'foreign-extension',
    athleteId: 'athlete-2',
    year: charge.year,
    month: charge.month,
    extendedDueDate: '2026-10-20',
    reason: 'Otro atleta',
    isCurrent: true,
  }

  assert.throws(
    () => projectMonthlyChargeWithExceptions({
      charge,
      globalDueDateException: null,
      reductionRevisions: [foreignReduction],
      extensionRevisions: [],
    }),
    /identity|charge/i,
  )

  assert.throws(
    () => projectMonthlyChargeWithExceptions({
      charge,
      globalDueDateException: null,
      reductionRevisions: [],
      extensionRevisions: [foreignExtension],
    }),
    /identity|charge/i,
  )
})


test('withdrawal is a current auditable revision and a later correction can reactivate a reduction', () => {
  const applied = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca parcial',
  })
  const withdrawn = applyMonthlyChargeReduction({
    revisions: applied,
    id: 'reduction-2',
    charge,
    reductionAmountMinor: 0,
    reason: 'Retiro de beca',
  })
  const reactivated = applyMonthlyChargeReduction({
    revisions: withdrawn,
    id: 'reduction-3',
    charge,
    reductionAmountMinor: 250_000,
    reason: 'Nueva decisión de beca',
  })

  assert.equal(reactivated.length, 3)
  assert.equal(reactivated.filter(revision => revision.isCurrent).length, 1)
  assert.equal(reactivated.find(revision => revision.isCurrent)?.id, 'reduction-3')

  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: null,
    reductionRevisions: reactivated,
    extensionRevisions: [],
  })
  assert.equal(projected.amountDueMinor, 2_250_000)
})

test('withdrawal is a current auditable revision and a later correction can reactivate an extension', () => {
  const applied = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge,
    extendedDueDate: '2026-10-20',
    reason: 'Prórroga inicial',
  })
  const withdrawn = applyMonthlyChargeExtension({
    revisions: applied,
    id: 'extension-2',
    charge,
    extendedDueDate: null,
    reason: 'Retiro de prórroga',
  })
  const reactivated = applyMonthlyChargeExtension({
    revisions: withdrawn,
    id: 'extension-3',
    charge,
    extendedDueDate: '2026-10-25',
    reason: 'Nueva decisión de prórroga',
  })

  assert.equal(reactivated.length, 3)
  assert.equal(reactivated.filter(revision => revision.isCurrent).length, 1)
  assert.equal(reactivated.find(revision => revision.isCurrent)?.id, 'extension-3')

  const projected = projectMonthlyChargeWithExceptions({
    charge,
    globalDueDateException: null,
    reductionRevisions: [],
    extensionRevisions: reactivated,
  })
  assert.equal(projected.effectiveDueDate, '2026-10-25')
})

test('a materially different correction creates history even when the projected economic value is unchanged', () => {
  const applied = applyMonthlyChargeReduction({
    revisions: [],
    id: 'reduction-1',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca por situación económica',
  })
  const correctedReason = applyMonthlyChargeReduction({
    revisions: applied,
    id: 'reduction-2',
    charge,
    reductionAmountMinor: 500_000,
    reason: 'Beca por convenio institucional',
  })

  assert.equal(correctedReason.length, 2)
  assert.equal(correctedReason.filter(revision => revision.isCurrent).length, 1)
  assert.equal(correctedReason.find(revision => revision.isCurrent)?.id, 'reduction-2')
})
