// Tests for the login helpers. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateCredentials, messageForAuthError, normalizeEmail, MIN_PASSWORD_LENGTH } from '../src/utils/authInput.js'

test('email is trimmed and lower-cased', () => {
  assert.equal(normalizeEmail('  Asha@Example.COM '), 'asha@example.com')
})

test('sign-in: needs a valid email and a password', () => {
  assert.equal(validateCredentials({ email: '', password: '', mode: 'signin' }).isValid, false)
  assert.ok(validateCredentials({ email: 'not-an-email', password: 'x', mode: 'signin' }).errors.email)
  assert.ok(validateCredentials({ email: 'a@b.co', password: '', mode: 'signin' }).errors.password)
  assert.equal(validateCredentials({ email: 'a@b.co', password: 'short', mode: 'signin' }).isValid, true) // no length rule when signing in
})

test('sign-up: minimum length and matching confirmation', () => {
  const short = validateCredentials({ email: 'a@b.co', password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1), confirm: 'x'.repeat(MIN_PASSWORD_LENGTH - 1), mode: 'signup' })
  assert.ok(short.errors.password)
  const mismatch = validateCredentials({ email: 'a@b.co', password: 'longenough1', confirm: 'longenough2', mode: 'signup' })
  assert.ok(mismatch.errors.confirm)
  assert.equal(validateCredentials({ email: 'a@b.co', password: 'longenough1', confirm: 'longenough1', mode: 'signup' }).isValid, true)
})

test('overlong password and email are rejected', () => {
  assert.ok(validateCredentials({ email: 'a@b.co', password: 'x'.repeat(73), mode: 'signin' }).errors.password)
  assert.ok(validateCredentials({ email: 'a'.repeat(250) + '@b.co', password: 'x', mode: 'signin' }).errors.email)
})

test('auth error messages are friendly and never echo unknown provider text', () => {
  assert.match(messageForAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), /Incorrect email or password/)
  assert.match(messageForAuthError({ message: 'User already registered' }), /already exists/)
  assert.match(messageForAuthError({ code: 'email_not_confirmed' }), /confirm your email/)
  assert.match(messageForAuthError({ status: 429, message: 'x' }), /Too many attempts/)
  assert.match(messageForAuthError({ code: 'weak_password' }), /stronger/)
  assert.match(messageForAuthError(new TypeError('Failed to fetch')), /Could not reach/)
  const unknown = messageForAuthError({ message: 'SECRET internal stack detail' })
  assert.ok(!unknown.includes('SECRET'))
})
