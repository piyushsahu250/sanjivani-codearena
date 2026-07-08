require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const testRoutes = require("./routes/tests");
const questionRoutes = require("./routes/questions");
const submissionRoutes = require("./routes/submissions");
const userRoutes = require("./routes/users");
const classRoutes = require("./routes/classes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Basic protection against brute force / abuse on code execution endpoints
const execLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
app.use("/api/submissions", execLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "Sanjivani Coding Platform API" }));

app.use("/api/auth", authRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/classes", classRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Sanjivani Coding Platform API running on port ${PORT}`));
