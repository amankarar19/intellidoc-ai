// Run with: npm test   (uses Node's built-in test runner, no extra packages)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateDocument, isExpired, computeStats, filterDocuments, getExpiringSoon, STATUS } from '../src/utils/validation.js'
import { escapeCsvCell, toCsv } from '../src/utils/csv.js'
import { formatDate, isValidISODate, todayISO, addDaysISO, daysBetween, describeExpiry } from '../src/utils/dates.js'

const TODAY = '2026-10-11'
const good = { title: 'Sample Certificate', document_type: 'Certificate', document_number: 'C-1', expiry_date: '', notes: '' }

test('missing required fields are rejected with messages', () => {
  const r = validateDocument({ title: '  ', document_type: '', document_number: '', expiry_date: '', notes: '' }, TODAY)
  assert.equal(r.isValid, false)
  assert.ok(r.errors.title && r.errors.document_type && r.errors.document_number)
})

test('complete record without expiry becomes Verified', () => {
  const r = validateDocument(good, TODAY)
  assert.equal(r.isValid, true)
  assert.equal(r.status, STATUS.VERIFIED)
})

test('past expiry date becomes Rejected', () => {
  const r = validateDocument({ ...good, expiry_date: '2026-10-10' }, TODAY)
  assert.equal(r.status, STATUS.REJECTED)
  assert.match(r.note, /Expired/)
})

test('expiry today or in the future stays Verified (no off-by-one)', () => {
  assert.equal(validateDocument({ ...good, expiry_date: TODAY }, TODAY).status, STATUS.VERIFIED)
  assert.equal(validateDocument({ ...good, expiry_date: '2030-01-01' }, TODAY).status, STATUS.VERIFIED)
  assert.equal(isExpired('2026-10-11', TODAY), false)
})

test('impossible calendar dates are invalid', () => {
  assert.equal(isValidISODate('2026-02-31'), false)
  assert.equal(isValidISODate('2026-02-28'), true)
  assert.ok(validateDocument({ ...good, expiry_date: '2026-02-31' }, TODAY).errors.expiry_date)
})

test('todayISO uses local calendar date', () => {
  assert.equal(todayISO(new Date(2026, 9, 11, 23, 59)), '2026-10-11')
  assert.equal(formatDate('2026-10-11'), '11 Oct 2026')
})

test('stats and filtering use the real data', () => {
  const docs = [
    { title: 'A', document_type: 'Invoice', document_number: 'X1', status: 'Verified' },
    { title: 'B', document_type: 'Permit', document_number: 'X2', status: 'Pending' },
    { title: 'C', document_type: 'Permit', document_number: 'Z9', status: 'Rejected' },
  ]
  assert.deepEqual(computeStats(docs), { total: 3, verified: 1, pending: 1, rejected: 1 })
  assert.equal(filterDocuments(docs, 'permit', 'All').length, 2)
  assert.equal(filterDocuments(docs, 'x', 'Pending').length, 1)
  assert.equal(filterDocuments(docs, 'rejected', 'All').length, 1)
  assert.equal(filterDocuments(docs, 'nothing', 'All').length, 0)
})

test('CSV escaping handles commas, quotes and line breaks', () => {
  assert.equal(escapeCsvCell('a,b'), '"a,b"')
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""')
  assert.equal(escapeCsvCell('line1\nline2'), '"line1\nline2"')
  assert.equal(escapeCsvCell(null), '')
  assert.equal(escapeCsvCell('=SUM(A1)'), "'=SUM(A1)")
})

test('toCsv writes header and one line per record', () => {
  const csv = toCsv([{ title: 'T, 1', document_type: 'Invoice', document_number: 'N', expiry_date: null, status: 'Pending', notes: 'He said "ok"', created_at: '2026-10-11T10:00:00.000Z' }])
  const lines = csv.split('\r\n')
  assert.equal(lines.length, 2)
  assert.ok(lines[0].startsWith('Document Title,Document Type'))
  assert.ok(lines[1].startsWith('"T, 1",Invoice,N,,Pending,"He said ""ok"""'))
})

test('date arithmetic crosses month and year ends correctly', () => {
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01')
  assert.equal(addDaysISO('2026-10-11', 30), '2026-11-10')
  assert.equal(daysBetween('2026-10-11', '2026-10-14'), 3)
  assert.equal(daysBetween('2026-10-11', '2026-10-10'), -1)
})

test('describeExpiry gives short relative text', () => {
  assert.deepEqual(describeExpiry('2026-10-10', TODAY), { tone: 'bad', text: 'Expired 1 day ago' })
  assert.deepEqual(describeExpiry(TODAY, TODAY), { tone: 'warn', text: 'Expires today' })
  assert.deepEqual(describeExpiry('2026-10-25', TODAY), { tone: 'warn', text: 'In 14 days' })
  assert.equal(describeExpiry('2027-10-25', TODAY), null)
  assert.equal(describeExpiry(null, TODAY), null)
})

test('getExpiringSoon returns only upcoming expiries within 30 days, soonest first', () => {
  const docs = [
    { id: 1, expiry_date: '2026-11-05' },
    { id: 2, expiry_date: '2026-10-12' },
    { id: 3, expiry_date: '2026-10-01' }, // already expired
    { id: 4, expiry_date: '2027-05-01' }, // too far
    { id: 5, expiry_date: null },
    { id: 6, expiry_date: '2026-11-10' }, // exactly day 30
    { id: 7, expiry_date: '2026-11-11' }, // day 31
  ]
  assert.deepEqual(getExpiringSoon(docs, TODAY).map((d) => d.id), [2, 1, 6])
})
