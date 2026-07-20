const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { askClaudeJson, isConfigured } = require("../utils/aiClient");

const router = express.Router();

// Scoped to the four QuestionType values this platform can actually grade (CODING via the judge,
// MCQ/TRUE_FALSE/MULTISELECT via stored correctAnswer indices — see schema.prisma's QuestionType
// enum and routes/questions.js). Deliberately does NOT offer SQL, fill-in-the-blank, or free-text
// "subjective" generation — there is no SQL execution engine and no subjective-answer question
// type or grading path anywhere on this platform, so generating those would produce content this
// codebase has no way to actually score. Every draft here is reviewed and edited by an
// admin/staff member in the existing CreateQuestion form before it's ever saved — this endpoint
// only drafts, it never writes to the question bank itself.
router.get("/status", authenticate, requireRole("ADMIN", "STAFF"), (req, res) => {
  res.json({ configured: isConfigured() });
});

router.post("/generate-question", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { questionType, subject, topic, difficulty } = req.body;
  const type = ["CODING", "MCQ", "TRUE_FALSE", "MULTISELECT"].includes(questionType) ? questionType : "MCQ";
  if (!subject || !subject.trim()) return res.status(400).json({ error: "Subject is required" });

  try {
    if (type === "CODING") {
      const draft = await askClaudeJson({
        system: "You write programming exam questions for a computer-science education platform. Return only JSON matching the requested schema — no markdown formatting inside JSON string values.",
        prompt: `Write one ${difficulty || "MEDIUM"}-difficulty CODING question about "${subject.trim()}"${topic ? ` (topic: ${topic.trim()})` : ""}. The student writes a complete stdin/stdout program in any language — no function-signature harness.
Return JSON exactly shaped: {"title": string, "description": string (full problem statement including input/output format and constraints), "explanation": string (brief solution approach), "testCases": [{"input": string, "expected": string, "isHidden": boolean}]}.
Provide exactly 5 testCases: 2 with isHidden=false (visible samples shown to students) and 3 with isHidden=true (used only for grading, covering edge cases).`,
        maxTokens: 1500,
      });
      return res.json({ questionType: "CODING", ...draft });
    }

    const shapeHint = type === "TRUE_FALSE"
      ? 'Exactly 2 options: "True" and "False", with exactly 1 correct.'
      : type === "MULTISELECT"
      ? "4 to 6 options with 2 or more correct."
      : "4 options with exactly 1 correct.";
    const draft = await askClaudeJson({
      system: "You write exam questions for a computer-science education platform. Return only JSON matching the requested schema.",
      prompt: `Write one ${difficulty || "MEDIUM"}-difficulty ${type} question about "${subject.trim()}"${topic ? ` (topic: ${topic.trim()})` : ""}. ${shapeHint}
Return JSON exactly shaped: {"title": string, "description": string (the question text), "options": string[], "correctAnswer": number[] (0-based indices into options), "explanation": string}.`,
      maxTokens: 800,
    });
    res.json({ questionType: type, ...draft });
  } catch (err) {
    if (err.notConfigured) return res.status(503).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "AI question generation failed — try again or write it manually" });
  }
});

module.exports = router;
