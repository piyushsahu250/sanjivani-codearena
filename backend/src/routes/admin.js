const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

// ADMIN: dashboard summary stats
router.get("/stats", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const now = new Date();
    const [
      totalInstitutes, totalClasses, totalUsers, totalStudents, totalStaff,
      totalTests, totalQuestions, activeTests, scheduledTests, completedTests,
    ] = await Promise.all([
      prisma.institute.count(),
      prisma.class.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STAFF" } }),
      prisma.test.count(),
      prisma.question.count(),
      prisma.test.count({ where: { isPublished: true, startTime: { lte: now }, endTime: { gte: now } } }),
      prisma.test.count({ where: { isPublished: true, startTime: { gt: now } } }),
      prisma.test.count({ where: { isPublished: true, endTime: { lt: now } } }),
    ]);

    res.json({
      totalInstitutes, totalClasses, totalUsers, totalStudents, totalStaff,
      totalTests, totalQuestions, activeTests, scheduledTests, completedTests,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

module.exports = router;
