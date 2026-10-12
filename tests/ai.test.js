// Tests for the pure helpers behind the AI Review screen. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_TEXT_CHARS, MAX_PDF_BYTES, validateTextInput, validatePdfFile, hasPdfHeader,
  extractServerMessage, messageForInvokeFailure, initialFormValues, validateReviewForm, buildSavePayload,
} from '../src/utils/aiInput.js'
import { STATUS } from '../src/utils/validation.js'

const analysis = {
  summary: 'A fictional training certificate.',
  fields: { title: 'Sample Certificate', document_type: 'Certificate', document_number: 'C-1', holder_name: 'A. Sample', issue_date: '2026-01-01', expiry_date: '2027-01-01', important_dates: [{ label: 'Course end', date: '2026-01-01' }] },
  uncertain_fields: ['holder_name'],
  review: { missing_information: [{ basis: 'check', text: 'x', evidence: '' }], inconsistencies: [], attention_points: [], recommendations: [{ basis: 'suggestion', text: 'Check name', evidence: '' }] },
}

test('text input: empty, short, too long, ok', () => {
  assert.ok(validateTextInput('   '))
  assert.ok(validateTextInput('too short'))
  assert.ok(validateTextInput('a'.repeat(MAX_TEXT_CHARS + 1)))
  assert.equal(validateTextInput('This is a long enough pasted document text.'), '')
})

test('pdf file: type, empty, oversize, ok', () => {
  assert.ok(validatePdfFile(null))
  assert.ok(validatePdfFile({ name: 'a.png', type: 'image/png', size: 100 }))
  assert.ok(validatePdfFile({ name: 'a.pdf', type: 'application/pdf', size: 0 }))
  assert.ok(validatePdfFile({ name: 'a.pdf', type: 'application/pdf', size: MAX_PDF_BYTES + 1 }))
  assert.equal(validatePdfFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 }), '')
})

test('pdf header check', () => {
  assert.equal(hasPdfHeader(new TextEncoder().encode('%PDF-1.7')), true)
  assert.equal(!!hasPdfHeader(new TextEncoder().encode('hello world')), false)
  assert.equal(!!hasPdfHeader(new Uint8Array(2)), false)
})

test('invoke failure messages', () => {
  assert.match(messageForInvokeFailure({ kind: 'network' }), /Could not reach/)
  assert.match(messageForInvokeFailure({ kind: 'http', status: 401 }), /anon/)
  assert.match(messageForInvokeFailure({ kind: 'http', status: 404 }), /not deployed/)
  assert.equal(messageForInvokeFailure({ kind: 'http', status: 429, body: { error: { message: 'Slow down' } } }), 'Slow down')
  assert.match(messageForInvokeFailure({ kind: 'http', status: 500 }), /problem/)
  assert.equal(extractServerMessage(null), '')
})

test('review form validation reuses document rules', () => {
  const ok = validateReviewForm({ ...initialFormValues(analysis) })
  assert.equal(ok.isValid, true)
  const bad = validateReviewForm({ ...initialFormValues(analysis), title: '', issue_date: '2026-13-45' })
  assert.equal(bad.isValid, false)
  assert.ok(bad.errors.title && bad.errors.issue_date)
})

test('save payload is always Pending, never stores the PDF, records edits', () => {
  const values = { ...initialFormValues(analysis), title: 'Edited title' }
  const p = buildSavePayload({ values, analysis, source: { type: 'pdf', filename: 'f.pdf' }, model: 'm', now: 0 })
  assert.equal(p.status, STATUS.PENDING)
  assert.equal(p.source_filename, 'f.pdf')
  assert.deepEqual(p.extracted_fields.edited_by_reviewer, ['title'])
  assert.equal(p.review_findings.analyzed_at, '1970-01-01T00:00:00.000Z')
  assert.ok(!JSON.stringify(p).includes('base64'))
  const t = buildSavePayload({ values, analysis, source: { type: 'text' }, model: 'm' })
  assert.equal(t.source_filename, null)
})
