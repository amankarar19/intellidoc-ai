import { useRef, useState } from 'react'
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { signIn, signUp } from '../lib/auth.js'
import { MIN_PASSWORD_LENGTH, validateCredentials } from '../utils/authInput.js'

export default function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false) // blocks a second submit before React re-renders

  const isSignup = mode === 'signup'

  function switchMode(next) {
    if (busyRef.current) return
    setMode(next)
    setErrors({})
    setFormError('')
    setInfo('')
    setConfirm('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (busyRef.current) return
    setFormError('')
    setInfo('')
    const result = validateCredentials({ email, password, confirm, mode })
    setErrors(result.errors)
    if (!result.isValid) return

    busyRef.current = true
    setBusy(true)
    try {
      if (isSignup) {
        const { needsConfirmation } = await signUp(email, password)
        if (needsConfirmation) {
          setInfo('Account created. We sent a confirmation link to your email. Confirm it, then sign in.')
          setMode('signin')
          setPassword('')
          setConfirm('')
        }
        // When no confirmation is needed, Supabase signs the user in and the app switches screens by itself.
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="setup-page">
      <form className="setup-card auth-card" onSubmit={handleSubmit} noValidate aria-labelledby="auth-title">
        <div className="brand-mark large"><ShieldCheck size={26} /></div>
        <h1 id="auth-title">{isSignup ? 'Create your account' : 'Sign in to IntelliDoc AI'}</h1>
        <p className="muted">
          {isSignup ? 'Your documents are private to your account.' : 'AI-powered document review and management.'}
        </p>

        {info && <div className="alert alert-info" role="status">{info}</div>}
        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'auth-email-err' : undefined}
          />
          {errors.email && <div className="field-error" id="auth-email-err">{errors.email}</div>}
        </div>

        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <div className="password-row">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              maxLength={72}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'auth-password-err' : isSignup ? 'auth-password-hint' : undefined}
            />
            <button type="button" className="icon-btn" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <div className="field-error" id="auth-password-err">{errors.password}</div>}
          {isSignup && !errors.password && <div className="muted small" id="auth-password-hint">At least {MIN_PASSWORD_LENGTH} characters.</div>}
        </div>

        {isSignup && (
          <div className="field">
            <label htmlFor="auth-confirm">Confirm password</label>
            <input
              id="auth-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              maxLength={72}
              aria-invalid={Boolean(errors.confirm)}
              aria-describedby={errors.confirm ? 'auth-confirm-err' : undefined}
            />
            {errors.confirm && <div className="field-error" id="auth-confirm-err">{errors.confirm}</div>}
          </div>
        )}

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : isSignup ? <UserPlus size={16} /> : <LogIn size={16} />}
          {busy ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
        </button>

        <p className="muted small auth-switch">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="link-btn" onClick={() => switchMode(isSignup ? 'signin' : 'signup')} disabled={busy}>
            {isSignup ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <p className="muted small">Use fictional documents only. This is a college project prototype.</p>
      </form>
    </div>
  )
}
