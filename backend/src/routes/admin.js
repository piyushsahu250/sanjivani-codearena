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
      totalCourses, totalPracticeQuestions, certificatesIssued, interviewCertificatesIssued,
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
      prisma.course.count(),
      prisma.practiceQuestion.count(),
      prisma.certificate.count(),
      prisma.interviewCertificate.count(),
    ]);

    res.json({
      totalInstitutes, totalClasses, totalUsers, totalStudents, totalStaff,
      totalTests, totalQuestions, activeTests, scheduledTests, completedTests,
      totalCourses, totalPracticeQuestions, certificatesIssued: certificatesIssued + interviewCertificatesIssued,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ADMIN: outbound email delivery log — every welcome/password-reset send attempt, with real
// provider-confirmed status (never inferred). Optional ?status=FAILED filter; capped at 300 rows,
// most recent first — this is an operational log, not a paginated archive.
router.get("/email-logs", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const where = {};
    if (req.query.status && ["PENDING", "SENT", "FAILED", "RETRYING"].includes(req.query.status)) {
      where.status = req.query.status;
    }
    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true, studentId: true, recipientName: true, recipientEmail: true, emailType: true,
        status: true, errorMessage: true, messageId: true, retryCount: true, createdAt: true, sentAt: true,
      },
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load email logs" });
  }
});

module.exports = router;
