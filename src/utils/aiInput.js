// Pure helpers for the AI Review screen (no React, no network), so they can be unit-tested.

import { validateDocument, STATUS } from './validation.js'
import { isValidISODate } from './dates.js'

export const MAX_TEXT_CHARS = 30000
export const MAX_PDF_MB = 6
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024

export const BASIS_LABELS = {
  observation: 'From the document',
  suggestion: 'AI suggestion',
  check: 'Automatic check',
}

export const REVIEW_SECTIONS = [
  { key: 'missing_information', title: 'Possibly missing information' },
  { key: 'inconsistencies', title: 'Possible inconsistencies' },
  { key: 'attention_points', title: 'Needs human attention' },
  { key: 'recommendations', title: 'Recommendations for the reviewer' },
]

const EDITABLE_FIELDS = ['title', 'document_type', 'document_number', 'holder_name', 'issue_date', 'expiry_date']

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Returns an error message, or '' when the pasted text is acceptable. */
export function validateTextInput(text) {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return 'Paste the document text before analysing.'
  if (trimmed.length < 20) return 'The text is very short. Paste more of the document so the AI has something to analyse.'
  if (trimmed.length > MAX_TEXT_CHARS) return `The text is too long (${trimmed.length.toLocaleString()} characters). The limit is ${MAX_TEXT_CHARS.toLocaleString()}.`
  return ''
}

/** Checks a File-like object ({name, type, size}). Returns an error message or ''. */
export function validatePdfFile(file) {
  if (!file) return 'Choose a PDF file to analyse.'
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? '')
  if (!looksLikePdf) return 'Only PDF files are supported.'
  if (!file.size) return 'The selected file is empty.'
  if (file.size > MAX_PDF_BYTES) return `The PDF is too large (${formatBytes(file.size)}). The limit is ${MAX_PDF_MB} MB.`
  return ''
}

/** True when the first bytes spell "%PDF-". */
export function hasPdfHeader(bytes) {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d]
  return bytes && bytes.length >= 5 && sig.every((b, i) => bytes[i] === b)
}

/** Pull a readable message out of the error body our function (or the Supabase gateway) returned. */
export function extractServerMessage(body) {
  if (!body || typeof body !== 'object') return ''
  if (typeof body.error?.message === 'string') return body.error.message
  if (typeof body.message === 'string') return body.message
  if (typeof body.error === 'string') return body.error
  return ''
}

/** One friendly sentence for every way calling the Edge Function can fail. */
export function messageForInvokeFailure({ kind, status, body }) {
  if (kind === 'network') return 'Could not reach the AI service. Check your internet connection and try again.'
  const serverMessage = extractServerMessage(body)
  if (status === 401 || status === 403) {
    // Our own function sends a coded message (e.g. "please sign in"); the Supabase gateway sends a bare one.
    if (body?.error?.code && serverMessage) return serverMessage
    return 'The AI function did not accept your login. Sign out and sign in again. If it keeps happening, check that VITE_SUPABASE_ANON_KEY in .env is the legacy "anon" key (it starts with "eyJ").'
  }
  if (status === 404) return 'The AI function is not deployed yet. Deploy "analyze-document" in your Supabase project (see the README).'
  if (serverMessage) return serverMessage
  if (status >= 500) return 'The AI service had a problem. Please try again.'
  return `The AI request failed${status ? ` (HTTP ${status})` : ''}. Please try again.`
}

/** Starting values for the editable review form, from the AI analysis. */
export function initialFormValues(analysis) {
  const f = analysis?.fields ?? {}
  return {
    title: f.title ?? '',
    document_type: f.document_type ?? '',
    document_number: f.document_number ?? '',
    holder_name: f.holder_name ?? '',
    issue_date: f.issue_date ?? '',
    expiry_date: f.expiry_date ?? '',
    notes: '',
  }
}

/** Reuses the app's existing rules for required fields, then checks the extra AI-only fields. */
export function validateReviewForm(values) {
  const base = validateDocument({ ...values, notes: values.notes ?? '' })
  const errors = { ...base.errors }
  if (values.issue_date && !isValidISODate(values.issue_date)) errors.issue_date = 'Enter a valid issue date.'
  if ((values.holder_name ?? '').length > 120) errors.holder_name = 'Holder name must be 120 characters or fewer.'
  return { isValid: Object.keys(errors).length === 0, errors }
}

/**
 * Builds the row saved to Supabase. Status is ALWAYS Pending: AI output never marks a record Verified.
 * Only metadata and AI results are stored. The PDF itself is not stored.
 */
export function buildSavePayload({ values, analysis, source, model, now = Date.now() }) {
  const original = analysis?.fields ?? {}
  const edited = EDITABLE_FIELDS.filter((key) => (values[key] ?? '') !== (original[key] ?? ''))
  return {
    title: values.title.trim(),
    document_type: values.document_type,
    document_number: values.document_number.trim(),
    expiry_date: values.expiry_date || null,
    notes: (values.notes ?? '').trim() || null,
    status: STATUS.PENDING,
    source_filename: source?.type === 'pdf' && source.filename ? source.filename.slice(0, 200) : null,
    ai_summary: analysis?.summary ? analysis.summary.slice(0, 5000) : null,
    extracted_fields: {
      holder_name: (values.holder_name ?? '').trim(),
      issue_date: values.issue_date || '',
      important_dates: original.important_dates ?? [],
      uncertain_fields: analysis?.uncertain_fields ?? [],
      edited_by_reviewer: edited,
    },
    review_findings: {
      missing_information: analysis?.review?.missing_information ?? [],
      inconsistencies: analysis?.review?.inconsistencies ?? [],
      attention_points: analysis?.review?.attention_points ?? [],
      recommendations: analysis?.review?.recommendations ?? [],
      model: model ?? null,
      source_type: source?.type ?? 'text',
      analyzed_at: new Date(now).toISOString(),
    },
  }
}
