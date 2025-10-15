// netlify/functions/verify-otp.js
import crypto from "crypto";

export async function handler(event) {
  const { email, otp } = JSON.parse(event.body || "{}");
  if (!email || !otp)
    return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized" }) };

  const hashed = crypto.createHash("sha256").update(otp).digest("hex");

  // access the in-memory store created by send-otp.js
  globalThis.otpCache = globalThis.otpCache || {};
  const record = globalThis.otpCache[email];

  if (!record || record.hash !== hashed || record.expires < Date.now()) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP" }) };
  }

  // success: issue a short-lived session token
  const token = crypto.randomBytes(16).toString("hex");
  return { statusCode: 200, body: JSON.stringify({ success: true, token }) };
}
