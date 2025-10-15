// netlify/functions/verify-otp.js
import crypto from "crypto";

const STEP_SECONDS = 600; // 10-minute code

function generateOtpForCounter(email, secret, counter) {
  const userKey = crypto.createHmac("sha256", secret).update(email).digest();
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha256", userKey).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function isValidOtp(email, otp, secret, now = Date.now()) {
  const currentCounter = Math.floor(now / 1000 / STEP_SECONDS);
  // accept code for current 10‑min window and also previous window (helps if the email lands near a boundary)
  const countersToCheck = [currentCounter, currentCounter - 1];
  return countersToCheck.some((ctr) => generateOtpForCounter(email, secret, ctr) === otp);
}

// Minimal signed token (JWT‑style HS256) with 12h expiry
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function signToken(payloadObj, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { ...payloadObj };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${headerB64}.${payloadB64}.${sig}`;
}

export async function handler(event) {
  const { email, otp } = JSON.parse(event.body || "{}");
  if (!email || !otp)
    return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized" }) };

  const secret = process.env.OTP_SECRET;
  if (!secret)
    return { statusCode: 500, body: JSON.stringify({ error: "Missing OTP_SECRET env var" }) };

  const ok = isValidOtp(email, String(otp).padStart(6, "0"), secret);
  if (!ok) return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP" }) };

  // 12-hour session token
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const token = signToken({ email, exp }, secret);

  return { statusCode: 200, body: JSON.stringify({ success: true, token }) };
}
