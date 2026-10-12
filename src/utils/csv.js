import { formatDate, formatTimestamp } from './dates.js'

// [Column heading, function that reads the value from a record]
export const CSV_COLUMNS = [
  ['Document Title', (d) => d.title],
  ['Document Type', (d) => d.document_type],
  ['Document Number', (d) => d.document_number],
  ['Expiry Date', (d) => (d.expiry_date ? formatDate(d.expiry_date) : '')],
  ['Verification Status', (d) => d.status],
  ['Notes', (d) => d.notes],
  ['Created Date', (d) => formatTimestamp(d.created_at)],
]

/**
 * Make one value safe for CSV (RFC 4180):
 *  - values containing a comma, double quote or line break are wrapped in quotes
 *  - double quotes inside the value are doubled ("" )
 *  - values starting with = + - @ get a leading ' so Excel does not run them as formulas
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(docs) {
  const header = CSV_COLUMNS.map(([label]) => escapeCsvCell(label)).join(',')
  const lines = docs.map((d) => CSV_COLUMNS.map(([, read]) => escapeCsvCell(read(d))).join(','))
  return [header, ...lines].join('\r\n')
}

/** Browser-only: triggers a file download. A BOM is added so Excel reads UTF-8 correctly. */
export function downloadCsv(filename, csvText) {
  const blob = new Blob(['﻿', csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
