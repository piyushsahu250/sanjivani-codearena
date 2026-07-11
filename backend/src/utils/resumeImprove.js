// Rule-based text improvement — NOT a real AI/LLM call, consistent with the "no real AI anywhere
// on this platform" decision already made for the ATS scorer and Interview Prep evaluation.
// Deliberately never invents a quantified metric ("reduced X by 35%") that isn't already present
// in the student's own text — fabricating a fake statistic on someone's resume would be resume
// fraud, not an improvement. Instead it prompts the student to add a real one.

const WEAK_TO_STRONG_VERBS = {
  "worked on": "Developed",
  "worked with": "Collaborated with",
  "worked as": "Served as",
  "helped with": "Contributed to",
  "helped": "Assisted with",
  "was responsible for": "Led",
  "responsible for": "Led",
  "in charge of": "Led",
  "did": "Executed",
  "made": "Built",
  "used": "Utilized",
  "handled": "Managed",
  "involved in": "Contributed to",
  "took care of": "Managed",
  "in order to": "to",
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// section: "summary" | "project" | "experience" | "achievement" | "general" — only project/
// experience descriptions get the quantify-impact nudge; a summary or achievement line doesn't
// need one in the same way.
function improveText(text, section = "general") {
  const original = String(text || "").trim();
  if (!original) return { original, improved: "", changes: [] };

  const normalizedOriginal = original.replace(/\s+/g, " ").trim();
  let improved = normalizedOriginal;
  const changes = [];

  for (const [weak, strong] of Object.entries(WEAK_TO_STRONG_VERBS)) {
    const re = new RegExp(`\\b${escapeRegExp(weak)}\\b`, "gi");
    if (re.test(improved)) {
      improved = improved.replace(re, (match) => (match[0] === match[0].toUpperCase() ? strong : strong.toLowerCase()));
      changes.push(`Replaced weak phrasing ("${weak}") with a stronger action verb.`);
    }
  }

  const beforeGrammar = improved;
  improved = improved
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(capitalizeFirst)
    .join(" ")
    .replace(/\bi\b/g, "I")
    .replace(/\s+([.,!?])/g, "$1");
  if (improved && !/[.!?]$/.test(improved)) improved += ".";
  if (improved !== beforeGrammar) changes.push("Cleaned up grammar, spacing, and capitalization.");

  if ((section === "project" || section === "experience") && !/\d/.test(improved)) {
    improved += ' [Add a measurable outcome if you have one — e.g. "reduced processing time by 20%" or "supported 200+ users".]';
    changes.push("Added a prompt to quantify impact — NOT auto-filled with an invented number; add a real metric if you have one.");
  }

  if (changes.length === 0) changes.push("No changes needed — this already reads well.");

  return { original, improved, changes };
}

module.exports = { improveText, WEAK_TO_STRONG_VERBS };
