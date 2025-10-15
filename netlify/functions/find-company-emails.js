// netlify/functions/find-company-emails.js
import { verifyToken } from "./auth-middleware.js";   // ✅ Add this line at the very top

export async function handler(event) {
  // ✅ STEP 1: Require Authorization
  const authHeader = event.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token || !verifyToken(token)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  // ✅ STEP 2: Existing code continues from here
  try {
    const { company } = JSON.parse(event.body || "{}");
    if (!company) {
      return { statusCode: 400, body: JSON.stringify({ error: "Company name required" }) };
    }

    // STEP 3: Get domain from resolve-domain endpoint
    const domainRes = await fetch(
      `${process.env.SITE_URL}/.netlify/functions/resolve-domain`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      }
    );
    const domainData = await domainRes.json();
    const domain = domainData?.domain;
    if (!domain)
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "No domain found", company }),
      };

    // STEP 4: Crawl domain for emails
    const emailRes = await fetch(
      `${process.env.SITE_URL}/.netlify/functions/crawl-emails`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      }
    );
    const emailData = await emailRes.json();

    // STEP 5: Merge results
    return {
      statusCode: 200,
      body: JSON.stringify({
        company,
        domain,
        source: domainData.source,
        emails: emailData.results?.flatMap((r) => r.emails) || [],
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
