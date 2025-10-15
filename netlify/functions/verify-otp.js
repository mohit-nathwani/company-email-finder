// netlify/functions/verify-otp.js
import crypto from "crypto";

export async function handler(event) {
  const { email, otp, binId } = JSON.parse(event.body || "{}");
  if (!email || !otp || !binId)
    return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized" }) };

  // Retrieve stored OTP record
  const binRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`);
  const binData = await binRes.json();
  const record = binData.record;

  if (!record || Date.now() > record.expires)
    return { statusCode: 401, body: JSON.stringify({ error: "OTP expired" }) };

  const hashed = crypto.createHash("sha256").update(otp).digest("hex");
  if (hashed !== record.hashed)
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid OTP" }) };

  const token = crypto.randomBytes(16).toString("hex");
  return { statusCode: 200, body: JSON.stringify({ success: true, token }) };
}
