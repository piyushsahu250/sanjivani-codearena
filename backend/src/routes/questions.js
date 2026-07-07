const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Create a question with test cases
router.post("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { title, description, difficulty, points, timeLimitMs, starterCode, testCases } = req.body;
    const question = await prisma.question.create({
      data: {
        title,
        description,
        difficulty: difficulty || "EASY",
        points: points ?? 10,
        timeLimitMs: timeLimitMs ?? 2000,
        starterCode: starterCode || "",
        testCases: {
          create: (testCases || []).map((tc) => ({
            input: tc.input,
            expected: tc.expected,
            isHidden: tc.isHidden ?? true,
          })),
        },
      },
      include: { testCases: true },
    });
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create question" });
  }
});

// List all questions (question bank) — staff only
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const questions = await prisma.question.findMany({
    include: { _count: { select: { testCases: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(questions);
});

router.get("/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const question = await prisma.question.findUnique({
    where: { id: req.params.id },
    include: { testCases: true },
  });
  res.json(question);
});

router.delete("/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  await prisma.question.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
