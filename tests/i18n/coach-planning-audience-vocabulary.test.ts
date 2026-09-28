import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import en from '@/messages/en/glossary/planning.json'
import es from '@/messages/es/glossary/planning.json'

describe('KAN-515 Coach planning audience vocabulary', () => {
  it('keeps the approved Spanish and English product terms exact', () => {
    assert.deepEqual(es.DomainGlossary.planningAudience.terms, {
      sportingGroup: 'Grupo deportivo',
      planningSubgroup: 'Subgrupo de planificación',
      basePlan: 'Plan base',
      variant: 'Variante',
    })
    assert.deepEqual(en.DomainGlossary.planningAudience.terms, {
      sportingGroup: 'Sporting group',
      planningSubgroup: 'Planning subgroup',
      basePlan: 'Base plan',
      variant: 'Variant',
    })
  })

  it('explains stable sporting classification versus temporary planning audience in both locales', () => {
    assert.match(es.DomainGlossary.planningAudience.sportingGroupHelp, /estable|deportiva/i)
    assert.match(es.DomainGlossary.planningAudience.planningSubgroupHelp, /temporal/i)

    assert.match(en.DomainGlossary.planningAudience.sportingGroupHelp, /stable|sporting/i)
    assert.match(en.DomainGlossary.planningAudience.planningSubgroupHelp, /temporary/i)
  })

  it('keeps the two locale catalogs structurally equivalent', () => {
    assert.deepEqual(
      Object.keys(en.DomainGlossary.planningAudience).sort(),
      Object.keys(es.DomainGlossary.planningAudience).sort(),
    )
    assert.deepEqual(
      Object.keys(en.DomainGlossary.planningAudience.terms).sort(),
      Object.keys(es.DomainGlossary.planningAudience.terms).sort(),
    )
  })
})
