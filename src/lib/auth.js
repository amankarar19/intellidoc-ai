// Thin wrapper over Supabase Auth (email + password). Passwords are handled by Supabase,
// never stored or logged by this app. Every failure is rethrown as a readable Error.

import { supabase } from './supabase.js'
import { messageForAuthError, messageForMfaError, mfaStateFromAssurance, normalizeTotpCode, normalizeEmail, qrToImageSrc } from '../utils/authInput.js'

const fail = (error) => Object.assign(new Error(messageForAuthError(error)), { friendly: true })

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session ?? null
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session ?? null))
  return () => data.subscription.unsubscribe()
}

export async function signIn(email, password) {
  let result
  try {
    result = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password })
  } catch (err) {
    throw fail(err)
  }
  if (result.error) throw fail(result.error)
  return result.data.session
}

/** Resolves to { needsConfirmation }. needsConfirmation is true when Supabase wants the email confirmed first. */
export async function signUp(email, password) {
  let result
  try {
    result = await supabase.auth.signUp({ email: normalizeEmail(email), password })
  } catch (err) {
    throw fail(err)
  }
  if (result.error) throw fail(result.error)
  // With email confirmation on, an existing address comes back as a user with no identities.
  if (result.data.user && Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0) {
    throw fail({ code: 'user_already_exists' })
  }
  return { needsConfirmation: !result.data.session }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw fail(error)
}

// ---------- two-factor sign-in with Google Authenticator (TOTP) ----------
// Supabase Auth generates the secret and checks the 6-digit codes. This app never sees or stores a code
// after sending it, and the secret is shown once, during set-up.

const failMfa = (error) => Object.assign(new Error(messageForMfaError(error)), { friendly: true })

/** Resolves to 'ok' | 'challenge' | 'enroll' (see mfaStateFromAssurance). */
export async function getMfaState() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw failMfa(error)
  return mfaStateFromAssurance(data)
}

/** The id of the user's verified authenticator, or null if none is set up. */
export async function getVerifiedFactorId() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw failMfa(error)
  return data?.totp?.[0]?.id ?? null
}

/**
 * Starts set-up. Resolves to { factorId, qrCode, secret }.
 * An earlier set-up that was never finished is removed first, otherwise Supabase refuses a second one.
 */
export async function startTotpEnrollment() {
  try {
    const listed = await supabase.auth.mfa.listFactors()
    if (listed.error) throw listed.error
    for (const factor of listed.data?.all ?? []) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Google Authenticator' })
    if (error) throw error
    return { factorId: data.id, qrCode: qrToImageSrc(data.totp.qr_code), secret: data.totp.secret }
  } catch (err) {
    throw failMfa(err)
  }
}

/** Checks a 6-digit code for a factor (used for both first-time set-up and every later sign-in). */
export async function verifyTotpCode(factorId, code) {
  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: normalizeTotpCode(code) })
    if (error) throw error
  } catch (err) {
    throw failMfa(err)
  }
}
