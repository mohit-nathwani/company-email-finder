import fs from "fs";
import crypto from "crypto";

export async function handler(event) {
  const { email, otp } = JSON.parse(event.body || "{}");
  if (!email || !otp)
    return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized" }) };

  const otpFile = "/tmp/otp.json";
  if (!fs.existsSync(otpFile))
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP" }) };

  const otpData = JSON.parse(fs.readFileSync(otpFile, "utf8"));
  const record = otpData[email];
  if (!record || Date.now() > record.expires)
    return { statusCode: 401, body: JSON.stringify({ error: "OTP expired" }) };

  const hashed = crypto.createHash("sha256").update(otp).digest("hex");
  if (record.hash !== hashed)
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid OTP" }) };

  // Remove after verification
  delete otpData[email];
  fs.writeFileSync(otpFile, JSON.stringify(otpData));

  const token = crypto.randomBytes(16).toString("hex");
  return { statusCode: 200, body: JSON.stringify({ success: true, token }) };
}
