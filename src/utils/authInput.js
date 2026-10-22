// Pure helpers for the login screen (no React, no network) so they can be unit-tested.

export const MIN_PASSWORD_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase()
}

/** mode is 'signin' or 'signup'. Returns { isValid, errors: { email?, password?, confirm? } } */
export function validateCredentials({ email, password, confirm, mode }) {
  const errors = {}
  const e = normalizeEmail(email)
  if (!e) errors.email = 'Enter your email address.'
  else if (e.length > 254 || !EMAIL_PATTERN.test(e)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Enter your password.'
  else if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  } else if (password.length > 72) errors.password = 'The password is too long (72 characters maximum).'

  if (mode === 'signup' && !errors.password && password !== (confirm ?? '')) errors.confirm = 'The two passwords do not match.'
  return { isValid: Object.keys(errors).length === 0, errors }
}

/** One friendly sentence for each way Supabase Auth can fail. Never echoes raw provider text for unknown cases. */
export function messageForAuthError(error) {
  const raw = String(error?.message ?? '')
  const code = String(error?.code ?? '')
  const status = error?.status
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(raw)) {
    return 'Could not reach the server. Check your internet connection and try again.'
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(raw)) return 'Incorrect email or password.'
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(raw)) return 'Please confirm your email first (check your inbox), then sign in.'
  if (code === 'user_already_exists' || /already registered|already been registered/i.test(raw)) return 'An account with this email already exists. Try signing in instead.'
  if (code === 'weak_password' || /password should be|weak password/i.test(raw)) return `Choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`
  if (code === 'signup_disabled' || /signups? (not allowed|disabled)/i.test(raw)) return 'Sign-up is turned off for this project.'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429 || /rate limit|too many/i.test(raw)) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (code === 'validation_failed' || /unable to validate email|invalid email/i.test(raw)) return 'Enter a valid email address.'
  if (/invalid api key|invalid jwt|apikey/i.test(raw)) return 'The app\'s Supabase key is not accepted. Check VITE_SUPABASE_ANON_KEY in .env.'
  return 'Something went wrong. Please try again.'
}

// ---------- two-factor sign-in (Google Authenticator, TOTP) ----------

/** Removes spaces and dashes so "123 456" and "123-456" are accepted. */
export function normalizeTotpCode(input) {
  return String(input ?? '').replace(/[\s-]/g, '')
}

/** Returns an error message, or '' when the code is exactly six digits. */
export function validateTotpCode(input) {
  const code = normalizeTotpCode(input)
  if (!code) return 'Enter the 6-digit code from Google Authenticator.'
  if (!/^\d{6}$/.test(code)) return 'The code is 6 digits (numbers only).'
  return ''
}

/**
 * What the signed-in user still has to do, from Supabase's assurance levels.
 *  'ok'        -> signed in with the code (aal2): show the app
 *  'challenge' -> authenticator already set up, code not entered yet (aal1, next aal2)
 *  'enroll'    -> no authenticator yet: must scan the QR code first
 */
export function mfaStateFromAssurance(assurance) {
  const current = assurance?.currentLevel
  const next = assurance?.nextLevel
  if (current === 'aal2') return 'ok'
  if (next === 'aal2') return 'challenge'
  return 'enroll'
}

/** Groups a secret key in fours for easier typing: "ABCDEFGH" -> "ABCD EFGH". */
export function formatSecret(secret) {
  return String(secret ?? '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}

/** Friendly sentence for each way the authenticator step can fail. Never echoes unknown provider text. */
export function messageForMfaError(error) {
  const raw = String(error?.message ?? '')
  const code = String(error?.code ?? '')
  const status = error?.status
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(raw)) {
    return 'Could not reach the server. Check your internet connection and try again.'
  }
  if (code === 'mfa_verification_failed' || /invalid totp code|verification failed/i.test(raw)) {
    return 'That code is not correct or has expired. Open Google Authenticator, type the current code and try again.'
  }
  if (code === 'mfa_challenge_expired' || /challenge.*expired/i.test(raw)) return 'The code request expired. Please try again.'
  if (code === 'mfa_factor_not_found') return 'No authenticator was found for this account. Please set it up again.'
  if (code === 'mfa_totp_enroll_not_enabled' || code === 'mfa_totp_verify_not_enabled' || /mfa.*(disabled|not enabled)|enroll.*disabled/i.test(raw)) {
    return 'Authenticator sign-in is turned off in Supabase. Enable TOTP under Authentication, Multi-Factor in the Supabase dashboard.'
  }
  if (code === 'over_request_rate_limit' || status === 429 || /rate limit|too many/i.test(raw)) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (code === 'session_not_found' || code === 'bad_jwt' || status === 401) return 'Your session has ended. Please sign in again.'
  return 'Something went wrong with the authenticator step. Please try again.'
}

/**
 * Makes the QR code safe to use as an <img> source. supabase-js returns an SVG string with a data-URI prefix
 * in front but without escaping it, and characters such as "#" (in colours) can cut a data URI short.
 * Returns '' unless the value is an SVG.
 */
export function qrToImageSrc(qr) {
  const text = String(qr ?? '')
  const raw = text.replace(/^data:image\/svg\+xml;(?:charset=)?utf-8,/i, '')
  let svg = raw
  try {
    svg = decodeURIComponent(raw) // already escaped values are decoded first so they are not escaped twice
  } catch {
    svg = raw
  }
  if (!/^\s*<svg[\s>]/i.test(svg)) return ''
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
