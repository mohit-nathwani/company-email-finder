// netlify/functions/send-otp.js
import crypto from "crypto";

const STEP_SECONDS = 600; // 10-minute code

function generateOtp(email, secret, now = Date.now()) {
  // Derive a per-user key from your app secret + email
  const userKey = crypto.createHmac("sha256", secret).update(email).digest();
  // 10-minute time counter
  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  // HOTP dynamic truncation
  const hmac = crypto.createHmac("sha256", userKey).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export async function handler(event) {
  const { email } = JSON.parse(event.body || "{}");
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Email required" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized email" }) };

  const secret = process.env.OTP_SECRET;
  if (!secret)
    return { statusCode: 500, body: JSON.stringify({ error: "Missing OTP_SECRET env var" }) };

  const otp = generateOtp(email, secret);

  // Send via Mailjet
  const fromEmail = process.env.MAILJET_FROM || allowedEmail; // must be a verified sender in Mailjet
  const auth = Buffer.from(
    `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`
  ).toString("base64");

  const res = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: Mohitnathwani55@gmail.com, Name: "Company Email Finder" },
          To: [{ Email: Mohitnathwani55@gmail.com }],
          Subject: "Your One-Time Login Code",
          TextPart: `Your login code is ${otp}. It changes every 10 minutes.`,
          HTMLPart: `<h2>Your login code is: <b>${otp}</b></h2><p>This code changes every 10 minutes.</p>`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return { statusCode: 502, body: JSON.stringify({ error: `Mailjet error: ${txt}` }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: "OTP sent successfully!" }) };
}
