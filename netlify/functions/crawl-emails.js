// netlify/functions/crawl-emails.js

export async function handler(event) {
  try {
    const { domain } = JSON.parse(event.body || "{}");
    if (!domain)
      return { statusCode: 400, body: JSON.stringify({ error: "Domain required" }) };

    const pagesToCheck = [
      `https://${domain}`,
      `https://${domain}/contact`,
      `https://${domain}/about`,
      `https://${domain}/careers`,
      `https://${domain}/team`,
      `https://${domain}/people`,
      `https://${domain}/jobs`,
    ];

    const emailRegex =
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

    const results = [];

    for (const url of pagesToCheck) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "EmailFinderBot/1.0" } });
        if (!res.ok) continue;
        const text = await res.text();

        const matches = text.match(emailRegex);
        if (matches) {
          results.push({
            page: url,
            emails: [...new Set(matches)],
          });
        }
      } catch (err) {
        // skip failed pages
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        domain,
        foundPages: results.length,
        results,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
