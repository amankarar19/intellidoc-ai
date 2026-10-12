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
