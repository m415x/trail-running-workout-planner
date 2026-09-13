import assert from 'node:assert/strict'
import test from 'node:test'
import { courseFormSchema, editionFormSchema, eventFormSchema, isCatalogDate } from '../../lib/race-catalog/catalog-form'

const course = {
  label: '21K', distanceKm: '', elevationGainM: '', modalityCode: '',
  modalityLabel: '', scheduledStartAt: '', startLocationLabel: '', notes: '', status: 'draft',
}
const edition = {
  label: '2027', startDate: '2027-04-10', endDate: '', organizerName: '',
  websiteUrl: '', notes: '', locality: '', region: '', countryCode: '', status: 'draft',
}

test('blank course measurements stay unknown while explicit zero elevation stays known', () => {
  const unknown = courseFormSchema.parse(course)
  assert.equal(unknown.distanceKm, null)
  assert.equal(unknown.elevationGainM, null)
  assert.equal(courseFormSchema.parse({ ...course, distanceKm: '21.5', elevationGainM: '0' }).elevationGainM, 0)
  for (const distanceKm of ['0', '-1', 'NaN', 'Infinity']) {
    assert.equal(courseFormSchema.safeParse({ ...course, distanceKm }).success, false)
  }
  assert.equal(courseFormSchema.safeParse({ ...course, elevationGainM: '-1' }).success, false)
})

test('calendar validation rejects impossible dates and reversed editions', () => {
  assert.equal(isCatalogDate('2028-02-29'), true)
  assert.equal(isCatalogDate('2027-02-29'), false)
  assert.equal(editionFormSchema.safeParse({ ...edition, endDate: '2027-04-09' }).success, false)
  assert.equal(editionFormSchema.safeParse({ ...edition, startDate: '2027-02-30' }).success, false)
  assert.equal(editionFormSchema.parse(edition).endDate, null)
  assert.equal(courseFormSchema.safeParse({ ...course, scheduledStartAt: '2027-02-30T08:00' }).success, false)
  assert.equal(courseFormSchema.safeParse({ ...course, scheduledStartAt: '2027-04-10T25:00' }).success, false)
})

test('server form boundary rejects unsupported lifecycle/modality and unsafe website URLs', () => {
  assert.equal(courseFormSchema.safeParse({ ...course, status: 'archived' }).success, false)
  assert.equal(courseFormSchema.safeParse({ ...course, modalityCode: 'other' }).success, false)
  assert.equal(courseFormSchema.safeParse({ ...course, modalityCode: 'other', modalityLabel: 'Cross country' }).success, true)
  assert.equal(eventFormSchema.safeParse({ name: 'Race', description: '', status: 'active', websiteUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(eventFormSchema.safeParse({ name: 'Race', description: '', status: 'active', websiteUrl: 'https://example.org' }).success, true)
})
