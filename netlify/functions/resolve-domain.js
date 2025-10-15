// netlify/functions/resolve-domain.js

const GEMINI_KEY = process.env.GEMINI_KEY_1; // add this in Netlify env vars
const GOOGLE_KEY = process.env.GOOGLE_API_KEY; // your Programmable Search key
const GOOGLE_CX = process.env.GOOGLE_CX; // your Custom Search Engine ID

export async function handler(event) {
  try {
    const { company } = JSON.parse(event.body || "{}");
    if (!company)
      return { statusCode: 400, body: JSON.stringify({ error: "Company name required" }) };

    // 1️⃣ Try Clearbit Autocomplete
    const clearbitRes = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`
    );
    const clearbit = await clearbitRes.json();
    if (clearbit?.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          source: "clearbit",
          company,
          domain: clearbit[0].domain,
          name: clearbit[0].name,
          logo: clearbit[0].logo,
        }),
      };
    }

    // 2️⃣ Fallback: Google Programmable Search
    const googleURL = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      company
    )}&cx=${GOOGLE_CX}&key=${GOOGLE_KEY}`;
    const googleRes = await fetch(googleURL);
    const googleData = await googleRes.json();

    if (googleData?.items?.length) {
      const topResults = googleData.items
        .slice(0, 5)
        .map((i) => ({ title: i.title, snippet: i.snippet, link: i.link }));
      // 3️⃣ Let Gemini pick the official domain
      const geminiPrompt = `
You are given search results for a company named "${company}". 
Pick which result is most likely the company's official website.
Respond with strict JSON:
{"domain": "the main domain", "reason": "short explanation"}.

Results:
${JSON.stringify(topResults, null, 2)}
`;
      const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GEMINI_KEY}`,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      });
      const geminiData = await geminiRes.json();
      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(text || "{}");
      if (parsed?.domain) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            source: "gemini+google",
            company,
            domain: parsed.domain.replace(/^https?:\/\//, "").split("/")[0],
            reason: parsed.reason,
          }),
        };
      }
    }

    // fallback if everything fails
    return { statusCode: 404, body: JSON.stringify({ message: "Domain not found" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
