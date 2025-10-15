// netlify/functions/send-otp.js
import crypto from "crypto";

export async function handler(event) {
  const { email } = JSON.parse(event.body || "{}");
  if (!email)
    return { statusCode: 400, body: JSON.stringify({ error: "Email required" }) };

  const allowedEmail = process.env.ADMIN_EMAIL;
  if (email !== allowedEmail)
    return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized email" }) };

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash("sha256").update(otp).digest("hex");

  // Save OTP in JSONBin for 10 minutes
  const otpRecord = { email, hashed, expires: Date.now() + 10 * 60 * 1000 };
  const binRes = await fetch("https://api.jsonbin.io/v3/b", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(otpRecord),
  });
  const binData = await binRes.json();
  const binId = binData.metadata.id;

  // Send via Mailjet
  const auth = Buffer.from(
    `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`
  ).toString("base64");
  await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: "Mohitnathwani55@gmail.com", Name: "Company Email Finder" },
          To: [{ Email: email }],
          Subject: "Your One-Time Login Code",
          TextPart: `Your OTP code is ${otp}`,
          HTMLPart: `<h2>Your login code is <b>${otp}</b></h2><p>This code expires in 10 minutes.</p>`,
        },
      ],
    }),
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "OTP sent successfully!", binId }),
  };
}
