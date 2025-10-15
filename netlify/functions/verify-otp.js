import crypto from "crypto";
import { createClient } from "@netlify/blobs";

export async function handler(event) {
  const { email, otp } = JSON.parse(event.body || "{}");
  if (!email || !otp)
    return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized" }) };

  const hashed = crypto.createHash("sha256").update(otp).digest("hex");
  const blobs = createClient();
  const storedHash = await blobs.get(`otp-${email}`);

  if (!storedHash || storedHash !== hashed)
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP" }) };

  // optional: delete OTP after successful check
  await blobs.delete(`otp-${email}`);

  const token = crypto.randomBytes(16).toString("hex");
  return { statusCode: 200, body: JSON.stringify({ success: true, token }) };
}
