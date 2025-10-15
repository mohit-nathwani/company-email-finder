// netlify/functions/auth-middleware.js
import crypto from "crypto";

function verifySignature(token, secret) {
  const [headerB64, payloadB64, sig] = token.split(".");
  const data = `${headerB64}.${payloadB64}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return expected === sig;
}

export function verifyToken(token) {
  try {
    const [headerB64, payloadB64] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString());
    if (payload.exp * 1000 < Date.now()) return false;
    const secret = process.env.OTP_SECRET;
    return verifySignature(token, secret);
  } catch {
    return false;
  }
}
