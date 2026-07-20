// Thin wrapper around the Claude Messages API — every AI feature on this platform (question
// generation, coding hints, resume review, interview feedback) wants "one prompt in, one
// response out," so this stays a single-purpose client rather than a general chat/tool-use SDK.
// Uses Node 20's built-in fetch, so no new npm dependency and no Docker rebuild to ship this.
//
// Requires ANTHROPIC_API_KEY set in the environment (Render → this service → Environment). Every
// caller should catch the `notConfigured` error shape and degrade gracefully (e.g. "AI features
// aren't set up yet" in the UI) rather than 500 — this platform ran on 100% rule-based logic
// before this file existed, so AI being unavailable must never break the underlying feature.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function askClaude({ system, prompt, maxTokens = 1024, temperature = 0.7 }) {
  if (!isConfigured()) {
    const err = new Error("AI features are not configured on this server (ANTHROPIC_API_KEY is not set)");
    err.notConfigured = true;
    throw err;
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Claude API request failed (${res.status}): ${body.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// Same contract as askClaude, but instructs Claude to answer with a single JSON value and parses
// it — every structured-output caller (question generator, resume review) wants this. Strips a
// markdown code fence if Claude adds one anyway despite the instruction not to.
async function askClaudeJson(args) {
  const text = await askClaude({
    ...args,
    system: `${args.system ? args.system + "\n\n" : ""}Respond with ONLY a single valid JSON value — no markdown code fences, no commentary before or after.`,
  });
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude did not return valid JSON: ${cleaned.slice(0, 300)}`);
  }
}

module.exports = { askClaude, askClaudeJson, isConfigured };
