export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { prompt, modelTier, token } = req.body || {};

  if (!token || !process.env.APP_AUTH_TOKEN || token !== process.env.APP_AUTH_TOKEN) {
    res.status(401).json({ error: "session_expired" });
    return;
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "empty_completion" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "refused" });
    return;
  }

  const model = modelTier === "quick" ? "claude-haiku-4-5-20251001" : "claude-sonnet-5";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (r.status === 429) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    if (!r.ok) {
      res.status(502).json({ error: "refused" });
      return;
    }

    const data = await r.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "";
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      res.status(200).json({ error: "invalid_json" });
      return;
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: "refused" });
  }
}
