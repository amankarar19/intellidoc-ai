import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import {
  getVerifiedFactorId,
  startTotpEnrollment,
  verifyTotpCode,
} from "../lib/auth.js";
import { formatSecret, validateTotpCode } from "../utils/authInput.js";

/**
 * Second step of sign-in with Google Authenticator.
 *  mode "enroll"    : first time. Shows a QR code to scan, then asks for the 6-digit code.
 *  mode "challenge" : authenticator already set up. Asks for the current 6-digit code.
 * onDone() is called after the code is accepted; onSignOut() lets the user leave.
 */
export default function MfaScreen({ mode, email, onDone, onSignOut }) {
  const [factorId, setFactorId] = useState(null);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const startedRef = useRef(false); // React StrictMode runs effects twice in development; set up only once

  const isEnroll = mode === "enroll";

  async function prepare() {
    setLoading(true);
    setFormError("");
    try {
      if (isEnroll) {
        const result = await startTotpEnrollment();
        setFactorId(result.factorId);
        setQrCode(result.qrCode);
        setSecret(result.secret);
      } else {
        setFactorId(await getVerifiedFactorId());
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busyRef.current) return;
    setFormError("");
    const problem = validateTotpCode(code);
    setCodeError(problem);
    if (problem) return;
    if (!factorId) {
      setFormError("The authenticator is not ready yet. Please try again.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await verifyTotpCode(factorId, code);
      setCode("");
      await onDone();
    } catch (err) {
      setFormError(err.message);
      setCode("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="setup-page">
      <form
        className="setup-card auth-card"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="mfa-title"
      >
        <div className="brand-mark large">
          <KeyRound size={26} />
        </div>
        <h1 id="mfa-title">
          {isEnroll ? "Set up Google Authenticator" : "Two-factor sign-in"}
        </h1>
        <p className="muted">
          {isEnroll
            ? "Add a second step to protect your account. You only do this once."
            : `Enter the 6-digit code from Google Authenticator${email ? ` for ${email}` : ""}.`}
        </p>

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        {loading && (
          <div className="muted" role="status">
            <Loader2 size={16} className="spin" /> Preparing…
          </div>
        )}

        {!loading && isEnroll && (qrCode || secret) && (
          <div className="mfa-setup">
            <ol className="mfa-steps">
              <li>
                Install <strong>Google Authenticator</strong> on your phone.
              </li>
              <li>
                In the app tap <strong>+</strong>, then{" "}
                <strong>Scan a QR code</strong>, and scan this picture.
              </li>
              <li>Type the 6-digit code the app shows below.</li>
            </ol>
            {qrCode && (
              <div className="mfa-qr">
                <img
                  src={qrCode}
                  alt="QR code to add IntelliDoc AI to Google Authenticator"
                  width="180"
                  height="180"
                />
              </div>
            )}
            {!qrCode && (
              <div className="alert alert-info" role="status">
                The QR picture could not be shown. Use the setup key below
                instead.
              </div>
            )}
            <details className="mfa-manual" open={!qrCode}>
              <summary>Can&apos;t scan? Enter the key by hand</summary>
              <p className="muted small">
                In the app choose <strong>Enter a setup key</strong> and type
                this key. Keep it private.
              </p>
              <code className="mfa-secret">{formatSecret(secret)}</code>
            </details>
          </div>
        )}

        {!loading && !isEnroll && !factorId && !formError && (
          <div className="alert alert-error" role="alert">
            No authenticator was found for this account.
          </div>
        )}

        {!loading && factorId && (
          <div className="field">
            <label htmlFor="mfa-code">6-digit code</label>
            <input
              id="mfa-code"
              className="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ""))}
              disabled={busy}
              maxLength={7}
              autoFocus
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? "mfa-code-err" : undefined}
            />
            {codeError && (
              <div className="field-error" id="mfa-code-err">
                {codeError}
              </div>
            )}
          </div>
        )}

        {!loading && factorId && (
          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            {busy ? "Checking…" : isEnroll ? "Verify and turn on" : "Verify"}
          </button>
        )}

        {!loading && !factorId && (
          <button
            type="button"
            className="btn btn-primary auth-submit"
            onClick={() => {
              startedRef.current = true;
              prepare();
            }}
          >
            Try again
          </button>
        )}

        <p className="muted small auth-switch">
          <button
            type="button"
            className="link-btn"
            onClick={onSignOut}
            disabled={busy}
          >
            <LogOut size={14} /> Sign out
          </button>
        </p>
      </form>
    </div>
  );
}
