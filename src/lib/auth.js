// Thin wrapper over Supabase Auth (email + password). Passwords are handled by Supabase,
// never stored or logged by this app. Every failure is rethrown as a readable Error.

import { supabase } from './supabase.js'
import { messageForAuthError, normalizeEmail } from '../utils/authInput.js'

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
