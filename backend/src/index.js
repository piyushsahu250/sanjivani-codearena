require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { timingMiddleware, recordProcessError } = require("./utils/metrics");

const authRoutes = require("./routes/auth");
const testRoutes = require("./routes/tests");
const questionRoutes = require("./routes/questions");
const submissionRoutes = require("./routes/submissions");
const userRoutes = require("./routes/users");
const classRoutes = require("./routes/classes");
const instituteRoutes = require("./routes/institutes");
const adminRoutes = require("./routes/admin");
const learningRoutes = require("./routes/learning");
const dashboardRoutes = require("./routes/dashboard");
const gamificationRoutes = require("./routes/gamification");
const resumeRoutes = require("./routes/resume");
const interviewRoutes = require("./routes/interview");
const moduleCodingRoutes = require("./routes/moduleCoding");
const searchRoutes = require("./routes/search");

const app = express();
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(timingMiddleware);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "CodeArena API" }));

// Global floor well above any legitimate per-user traffic pattern (dashboard loads fire several
// parallel GETs; this is not meant to constrain normal use, just block runaway scripts/scraping).
// Expensive routes (judge execution, etc.) already carry their own tighter per-route limiters.
const globalLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/institutes", instituteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/module-coding", moduleCodingRoutes);
app.use("/api/search", searchRoutes);

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  recordProcessError(err, "uncaughtException");
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
  recordProcessError(err, "unhandledRejection");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`CodeArena API running on port ${PORT}`));
