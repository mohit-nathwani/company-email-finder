// netlify/functions/send-otp.js
import crypto from "crypto";
import { getStore } from "@netlify/blobs";

export async function handler(event) {
  const { email } = JSON.parse(event.body || "{}");
  if (!email)
    return { statusCode: 400, body: JSON.stringify({ error: "Email required" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized email" }) };

  // create random OTP and hash it
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash("sha256").update(otp).digest("hex");

  // --- store OTP hash in Netlify Blobs for 10 min ---
  const store = getStore("otp-store");
  await store.set(`otp-${email}`, hashed, {
    metadata: { expires: Date.now() + 10 * 60 * 1000 },
  });

  // --- send OTP via Mailjet ---
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
          From: { Email: "no-reply@yourdomain.com", Name: "Company Email Finder" },
          To: [{ Email: email }],
          Subject: "Your One-Time Login Code",
          TextPart: `Your OTP code is ${otp}`,
          HTMLPart: `<h2>Your login code is <b>${otp}</b></h2><p>This code expires in 10 minutes.</p>`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return { statusCode: 500, body: JSON.stringify({ error: errorText }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: "OTP sent successfully!" }) };
}
