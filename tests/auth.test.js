// Tests for the login helpers. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCredentials,
  messageForAuthError,
  normalizeEmail,
  MIN_PASSWORD_LENGTH,
} from "../src/utils/authInput.js";

test("email is trimmed and lower-cased", () => {
  assert.equal(normalizeEmail("  Asha@Example.COM "), "asha@example.com");
});

test("sign-in: needs a valid email and a password", () => {
  assert.equal(
    validateCredentials({ email: "", password: "", mode: "signin" }).isValid,
    false,
  );
  assert.ok(
    validateCredentials({
      email: "not-an-email",
      password: "x",
      mode: "signin",
    }).errors.email,
  );
  assert.ok(
    validateCredentials({ email: "a@b.co", password: "", mode: "signin" })
      .errors.password,
  );
  assert.equal(
    validateCredentials({ email: "a@b.co", password: "short", mode: "signin" })
      .isValid,
    true,
  ); // no length rule when signing in
});

test("sign-up: minimum length and matching confirmation", () => {
  const short = validateCredentials({
    email: "a@b.co",
    password: "x".repeat(MIN_PASSWORD_LENGTH - 1),
    confirm: "x".repeat(MIN_PASSWORD_LENGTH - 1),
    mode: "signup",
  });
  assert.ok(short.errors.password);
  const mismatch = validateCredentials({
    email: "a@b.co",
    password: "longenough1",
    confirm: "longenough2",
    mode: "signup",
  });
  assert.ok(mismatch.errors.confirm);
  assert.equal(
    validateCredentials({
      email: "a@b.co",
      password: "longenough1",
      confirm: "longenough1",
      mode: "signup",
    }).isValid,
    true,
  );
});

test("overlong password and email are rejected", () => {
  assert.ok(
    validateCredentials({
      email: "a@b.co",
      password: "x".repeat(73),
      mode: "signin",
    }).errors.password,
  );
  assert.ok(
    validateCredentials({
      email: "a".repeat(250) + "@b.co",
      password: "x",
      mode: "signin",
    }).errors.email,
  );
});

test("auth error messages are friendly and never echo unknown provider text", () => {
  assert.match(
    messageForAuthError({
      code: "invalid_credentials",
      message: "Invalid login credentials",
    }),
    /Incorrect email or password/,
  );
  assert.match(
    messageForAuthError({ message: "User already registered" }),
    /already exists/,
  );
  assert.match(
    messageForAuthError({ code: "email_not_confirmed" }),
    /confirm your email/,
  );
  assert.match(
    messageForAuthError({ status: 429, message: "x" }),
    /Too many attempts/,
  );
  assert.match(messageForAuthError({ code: "weak_password" }), /stronger/);
  assert.match(
    messageForAuthError(new TypeError("Failed to fetch")),
    /Could not reach/,
  );
  const unknown = messageForAuthError({
    message: "SECRET internal stack detail",
  });
  assert.ok(!unknown.includes("SECRET"));
});

// ---------- two-factor sign-in (Google Authenticator) ----------
import {
  qrToImageSrc,
  normalizeTotpCode,
  validateTotpCode,
  mfaStateFromAssurance,
  formatSecret,
  messageForMfaError,
} from "../src/utils/authInput.js";

test("authenticator code: spaces and dashes are removed, exactly six digits are required", () => {
  assert.equal(normalizeTotpCode(" 123 456 "), "123456");
  assert.equal(normalizeTotpCode("123-456"), "123456");
  assert.ok(validateTotpCode(""));
  assert.ok(validateTotpCode("12345"));
  assert.ok(validateTotpCode("1234567"));
  assert.ok(validateTotpCode("12a456"));
  assert.equal(validateTotpCode("123 456"), "");
});

test("assurance level decides what the user still has to do", () => {
  assert.equal(
    mfaStateFromAssurance({ currentLevel: "aal2", nextLevel: "aal2" }),
    "ok",
  );
  assert.equal(
    mfaStateFromAssurance({ currentLevel: "aal1", nextLevel: "aal2" }),
    "challenge",
  );
  assert.equal(
    mfaStateFromAssurance({ currentLevel: "aal1", nextLevel: "aal1" }),
    "enroll",
  );
  assert.equal(mfaStateFromAssurance(null), "enroll"); // unknown never lets the user straight in
  assert.equal(mfaStateFromAssurance({}), "enroll");
});

test("setup key is grouped in fours", () => {
  assert.equal(formatSecret("ABCDEFGHIJ"), "ABCD EFGH IJ");
  assert.equal(formatSecret(undefined), "");
});

test("authenticator error messages are friendly and never echo unknown provider text", () => {
  assert.match(
    messageForMfaError({
      code: "mfa_verification_failed",
      message: "Invalid TOTP code entered",
    }),
    /not correct or has expired/,
  );
  assert.match(
    messageForMfaError({ code: "mfa_totp_enroll_not_enabled" }),
    /turned off in Supabase/,
  );
  assert.match(
    messageForMfaError({ status: 429, message: "x" }),
    /Too many attempts/,
  );
  assert.match(
    messageForMfaError(new TypeError("Failed to fetch")),
    /Could not reach/,
  );
  const unknown = messageForMfaError({
    message: "SECRET internal stack detail",
  });
  assert.ok(!unknown.includes("SECRET"));
});

test("QR code: the SDK data URI is turned into a safe image source; non-SVG input is refused", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#fff"/></svg>';
  const src = qrToImageSrc("data:image/svg+xml;utf-8," + svg);
  assert.ok(src.startsWith("data:image/svg+xml;charset=utf-8,"));
  assert.ok(!src.includes("#") && !src.includes("<"));
  assert.equal(qrToImageSrc(svg), src); // same result with or without the prefix
  assert.equal(qrToImageSrc(src), src); // already escaped: not escaped twice
  const withProlog =
    '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
    svg;
  assert.ok(
    qrToImageSrc("data:image/svg+xml;utf-8," + withProlog).startsWith(
      "data:image/svg+xml;charset=utf-8,",
    ),
  );
  assert.equal(qrToImageSrc("<script>alert(1)</script>"), "");
  assert.equal(qrToImageSrc(undefined), "");
});
