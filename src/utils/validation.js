import { addDaysISO, formatDate, isValidISODate, todayISO } from './dates.js'

// Single source of truth for status values. They must match the CHECK
// constraint in supabase.sql exactly (capitalised).
export const STATUS = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
}
export const STATUSES = [STATUS.PENDING, STATUS.VERIFIED, STATUS.REJECTED]

export const DOCUMENT_TYPES = [
  'Identity Proof',
  'Certificate',
  'Invoice',
  'Permit',
  'Academic Record',
  'Other',
]

/** An expiry date is "expired" when it is strictly before today's local date. */
export function isExpired(expiryDate, today = todayISO()) {
  return Boolean(expiryDate) && expiryDate < today
}

/**
 * Rule-based check of the form values.
 *
 * Rules
 *  1. Missing required information -> invalid, record is NOT created.
 *  2. Expiry date in the past      -> status Rejected (document expired).
 *  3. Otherwise                    -> status Verified by default.
 *
 * NOTE: these rules only check that the record is complete and not expired.
 * They do NOT prove that a real-world document is authentic.
 */
export function validateDocument(values, today = todayISO()) {
  const errors = {}
  const title = (values.title ?? '').trim()
  const type = (values.document_type ?? '').trim()
  const number = (values.document_number ?? '').trim()
  const expiry = (values.expiry_date ?? '').trim()
  const notes = values.notes ?? ''

  if (!title) errors.title = 'Document title is required.'
  else if (title.length > 150) errors.title = 'Title must be 150 characters or fewer.'

  if (!type) errors.document_type = 'Please select a document type.'
  else if (!DOCUMENT_TYPES.includes(type)) errors.document_type = 'Please choose a type from the list.'

  if (!number) errors.document_number = 'Document number is required.'
  else if (number.length > 60) errors.document_number = 'Document number must be 60 characters or fewer.'

  if (expiry && !isValidISODate(expiry)) errors.expiry_date = 'Enter a valid expiry date.'

  if (notes.length > 1000) errors.notes = 'Notes must be 1000 characters or fewer.'

  const isValid = Object.keys(errors).length === 0
  let status = STATUS.PENDING
  let note = ''

  if (isValid) {
    if (isExpired(expiry, today)) {
      status = STATUS.REJECTED
      note = `Expired on ${formatDate(expiry)}. Expired documents are marked Rejected.`
    } else {
      status = STATUS.VERIFIED
      note = expiry
        ? 'Required fields are complete and the document has not expired.'
        : 'Required fields are complete (no expiry date).'
    }
  }

  return { isValid, errors, status, note }
}

/** Short hint shown next to a saved record's status badge (or null). */
export function getRecordWarning(doc, today = todayISO()) {
  if (!isExpired(doc.expiry_date, today)) return null
  if (doc.status === STATUS.VERIFIED) return `Verified manually, but expired on ${formatDate(doc.expiry_date)}`
  return `Expired on ${formatDate(doc.expiry_date)}`
}

/** Count records by status. Used for the dashboard cards (never hardcoded). */
export function computeStats(docs) {
  const stats = { total: docs.length, verified: 0, pending: 0, rejected: 0 }
  for (const d of docs) {
    if (d.status === STATUS.VERIFIED) stats.verified += 1
    else if (d.status === STATUS.PENDING) stats.pending += 1
    else if (d.status === STATUS.REJECTED) stats.rejected += 1
  }
  return stats
}

/** Records whose expiry date is today or within the next `days` days, soonest first. */
export function getExpiringSoon(docs, today = todayISO(), days = 30) {
  const limit = addDaysISO(today, days)
  return docs
    .filter((d) => d.expiry_date && d.expiry_date >= today && d.expiry_date <= limit)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
}

/** Case-insensitive search over title, type, number and status, plus a status filter. */
export function filterDocuments(docs, search, statusFilter) {
  const q = search.trim().toLowerCase()
  return docs.filter((d) => {
    if (statusFilter && statusFilter !== 'All' && d.status !== statusFilter) return false
    if (!q) return true
    return [d.title, d.document_type, d.document_number, d.status].some((field) =>
      String(field ?? '').toLowerCase().includes(q),
    )
  })
}
