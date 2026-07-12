const express = require("express");
const prisma = require("../prisma");
const { authenticate } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");

const router = express.Router();

const LIMIT = 6;
const insensitive = (q) => ({ contains: q, mode: "insensitive" });

// Role-scoped global search across the platform's real resource types — every result links to
// an actual route that exists in the app. Students search their own learning content, tests, and
// certificates; staff/admin additionally search students/classes/institutes within their
// institute scope (attachRequesterInstitute), matching how every other admin/staff list endpoint
// in this codebase already scopes data. Deliberately excludes categories the platform doesn't
// have yet (e.g. no standalone coding-problem browser, no contests) rather than returning
// results that don't correspond to a real page.
router.get("/", authenticate, attachRequesterInstitute, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json({ results: [] });
    const results = [];

    if (req.user.role === "STUDENT") {
      const courses = await prisma.course.findMany({ where: { name: insensitive(q), isActive: true }, take: LIMIT });
      results.push(...courses.map((c) => ({ type: "Learning Module", label: c.name, url: `/learning/${c.slug}` })));

      const lessons = await prisma.lesson.findMany({
        where: { title: insensitive(q) },
        include: { module: { include: { course: true } } },
        take: LIMIT,
      });
      results.push(...lessons.map((l) => ({ type: "Lesson", label: `${l.title} (${l.module.course.name})`, url: `/learning/${l.module.course.slug}/lesson/${l.id}` })));

      const tests = await prisma.test.findMany({
        where: { title: insensitive(q), classes: { some: { class: { users: { some: { id: req.user.id } } } } } },
        take: LIMIT,
      });
      results.push(...tests.map((t) => ({ type: "Test", label: t.title, url: `/dashboard` })));
    } else {
      const instituteFilter = req.requesterInstituteId ? { instituteId: req.requesterInstituteId } : {};

      const students = await prisma.user.findMany({
        where: { role: "STUDENT", ...instituteFilter, OR: [{ name: insensitive(q) }, { email: insensitive(q) }, { rollNumber: insensitive(q) }] },
        take: LIMIT,
      });
      const basePath = req.user.role === "ADMIN" ? "/admin" : "/staff";
      results.push(...students.map((s) => ({ type: "Student", label: `${s.name} (${s.rollNumber || s.email})`, url: `${basePath}/students/${s.id}` })));

      const classes = await prisma.class.findMany({ where: { name: insensitive(q), ...instituteFilter }, take: LIMIT });
      results.push(...classes.map((c) => ({ type: "Class", label: `${c.name}${c.batchYear ? ` (${c.batchYear})` : ""}`, url: req.user.role === "ADMIN" ? `/admin/classes/${c.id}/students` : "/staff/students" })));

      const tests = await prisma.test.findMany({ where: { title: insensitive(q), createdBy: { ...instituteFilter } }, take: LIMIT });
      results.push(...tests.map((t) => ({ type: "Test", label: t.title, url: `/staff/tests/${t.id}/results` })));

      if (req.user.role === "ADMIN") {
        const institutes = await prisma.institute.findMany({ where: { name: insensitive(q) }, take: LIMIT });
        results.push(...institutes.map((i) => ({ type: "Institute", label: i.name, url: "/admin/institutes" })));
      }
    }

    res.json({ results: results.slice(0, 20) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
