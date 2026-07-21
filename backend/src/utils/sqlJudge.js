const path = require("path");
const { Worker } = require("worker_threads");

const SQL_WORKER_PATH = path.join(__dirname, "sqlWorker.js");

// Runs one query against one test case's data in an isolated worker thread, hard-terminated if
// it doesn't finish within timeLimitMs — see sqlWorker.js for why this needs its own thread
// rather than running better-sqlite3 (synchronous) directly on the main event loop.
function runSqlCase({ sqlSchema, caseInput, query, timeLimitMs }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const worker = new Worker(SQL_WORKER_PATH, { workerData: { sqlSchema, caseInput, query } });
    let settled = false;

    const killTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve({ ok: false, timedOut: true, timeMs: Date.now() - startedAt });
    }, timeLimitMs);

    worker.on("message", (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      worker.terminate();
      resolve({ ...msg, timeMs: Date.now() - startedAt });
    });

    worker.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve({ ok: false, error: err.message, timeMs: Date.now() - startedAt });
    });
  });
}

// Canonical text form of a result set for string comparison against admin-authored `expected` —
// one row per line, tab-separated columns, null shown as "NULL" — the same plain-text-diff
// convention this platform's other (STDIO) test cases already use.
function serializeRows(rows) {
  return rows.map((row) => Object.values(row).map((v) => (v === null ? "NULL" : String(v))).join("\t")).join("\n");
}

// Same result shape as judge.js's judgeSubmission (passedCases/totalCases/verdict/details/
// errorSummary) so every call site can treat a SQL question exactly like a CODING one. Single
// SELECT statement only — better-sqlite3's .prepare().all() rejects multi-statement input and
// non-row-returning statements, which is the LeetCode-SQL-problem convention anyway.
async function judgeSqlSubmission({ sqlSchema, code, testCases, timeLimitMs = 3000 }) {
  const query = String(code || "").trim();
  if (!query) {
    return {
      passedCases: 0, totalCases: testCases.length, verdict: "COMPILE_ERROR", details: [],
      errorSummary: { type: "SQL Error", line: null, message: "No query submitted", hint: null },
    };
  }

  const details = [];
  for (const tc of testCases) {
    const result = await runSqlCase({ sqlSchema, caseInput: tc.input, query, timeLimitMs });
    if (!result.ok) {
      details.push({
        input: tc.input, expected: tc.expected, actual: null,
        verdict: result.timedOut ? "TLE" : "RUNTIME_ERROR",
        error: result.error, timeMs: result.timeMs ?? null,
      });
      continue;
    }
    const actual = serializeRows(result.rows);
    const expected = String(tc.expected).trim();
    details.push({
      input: tc.input, expected, actual,
      verdict: actual === expected ? "PASSED" : "WRONG_ANSWER",
      timeMs: result.timeMs ?? null,
    });
  }

  const passed = details.filter((d) => d.verdict === "PASSED").length;
  let verdict = "ACCEPTED";
  if (passed === 0) verdict = details.some((d) => d.verdict === "TLE") ? "TLE" : "WRONG_ANSWER";
  else if (passed < testCases.length) verdict = "PARTIAL";

  let errorSummary = null;
  if (passed === 0) {
    if (verdict === "TLE") {
      errorSummary = { type: "Time Limit Exceeded", line: null, message: "Your query took too long — check for a missing join condition or an unbounded computation.", hint: null };
    } else {
      const errored = details.find((d) => d.verdict === "RUNTIME_ERROR");
      if (errored) errorSummary = { type: "SQL Error", line: null, message: errored.error, hint: null };
    }
  }

  const maxTimeMs = details.reduce((max, d) => (d.timeMs != null && d.timeMs > max ? d.timeMs : max), 0);
  return { passedCases: passed, totalCases: testCases.length, verdict, details, errorSummary, maxTimeMs, maxMemoryKb: null };
}

module.exports = { judgeSqlSubmission };
