// netlify/functions/verify-otp.js
import fs from "fs";
import crypto from "crypto";

export async function handler(event) {
  const { email, otp } = JSON.parse(event.body || "{}");
  if (!email || !otp)
    return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized" }) };

  const filePath = `/tmp/otp-${email}.txt`;
  if (!fs.existsSync(filePath))
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP" }) };

  const [storedHash, expiry] = fs.readFileSync(filePath, "utf8").split("|");
  if (Date.now() > Number(expiry))
    return { statusCode: 401, body: JSON.stringify({ error: "OTP expired" }) };

  const hashed = crypto.createHash("sha256").update(otp).digest("hex");
  if (hashed !== storedHash)
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid OTP" }) };

  // Optional: remove file after verification
  fs.unlinkSync(filePath);

  // Issue short-lived token
  const token = crypto.randomBytes(16).toString("hex");
  return { statusCode: 200, body: JSON.stringify({ success: true, token }) };
}
