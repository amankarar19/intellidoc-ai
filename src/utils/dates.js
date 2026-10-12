// Date helpers. Expiry dates are plain calendar dates ("YYYY-MM-DD"), so we
// never convert them through `new Date("YYYY-MM-DD")` (that parses as UTC and
// can shift the day in some time zones). We compare and format the strings directly.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n) => String(n).padStart(2, '0')

/** Today's date in the user's LOCAL time zone as "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** True only for real calendar dates such as "2026-02-28" (rejects "2026-02-31"). */
export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const check = new Date(Date.UTC(y, m - 1, d))
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
}

/** "2026-10-11" -> "11 Oct 2026". Returns "—" for empty values. */
export function formatDate(value) {
  if (!value) return '—'
  if (!isValidISODate(value)) return String(value)
  const [y, m, d] = value.split('-').map(Number)
  return `${pad(d)} ${MONTHS[m - 1]} ${y}`
}

/** ISO timestamp (created_at) -> local "11 Oct 2026". */
export function formatTimestamp(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

const utcDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Add days to a "YYYY-MM-DD" date. Calendar maths in UTC, so no daylight-saving surprises. */
export function addDaysISO(iso, days) {
  const dt = new Date(utcDay(iso) + days * 86400000)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Whole calendar days from `fromIso` to `toIso` (negative if `toIso` is earlier). */
export function daysBetween(fromIso, toIso) {
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / 86400000)
}

/**
 * Short relative description of an expiry date for the table.
 * Returns null when there is nothing worth saying (no date, or far in the future).
 */
export function describeExpiry(expiry, today = todayISO()) {
  if (!expiry || !isValidISODate(expiry)) return null
  const diff = daysBetween(today, expiry)
  const plural = (n) => `${n} day${n === 1 ? '' : 's'}`
  if (diff < 0) return { tone: 'bad', text: `Expired ${plural(-diff)} ago` }
  if (diff === 0) return { tone: 'warn', text: 'Expires today' }
  if (diff <= 30) return { tone: 'warn', text: `In ${plural(diff)}` }
  return null
}
