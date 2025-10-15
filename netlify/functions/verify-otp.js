// netlify/functions/verify-otp.js
import crypto from "crypto";
import { getStore } from "@netlify/blobs";

export async function handler(event) {
  const { email, otp } = JSON.parse(event.body || "{}");
  if (!email || !otp)
    return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized" }) };

  const hashed = crypto.createHash("sha256").update(otp).digest("hex");
  const store = getStore("otp-store");
  const storedHash = await store.get(`otp-${email}`);

  if (!storedHash || storedHash !== hashed)
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP" }) };

  await store.delete(`otp-${email}`);

  const token = crypto.randomBytes(16).toString("hex");
  return { statusCode: 200, body: JSON.stringify({ success: true, token }) };
}
