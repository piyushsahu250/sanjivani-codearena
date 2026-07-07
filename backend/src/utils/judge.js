/**
 * Lightweight code judge for JavaScript and Python.
 *
 * IMPORTANT (production note):
 * Running arbitrary student-submitted code with plain child_process is NOT
 * sufficiently secure for a real, internet-facing deployment — students could
 * attempt filesystem access, network calls, fork bombs, etc. For production,
 * replace this module with a call to a hardened sandbox such as:
 *   - Judge0 (self-hosted or RapidAPI) — https://judge0.com
 *   - A per-submission Docker/gVisor/firecracker container with strict
 *     CPU/memory/network limits
 * This implementation is a functional reference for local development and
 * demos, using OS-level timeouts and resource limits as a minimum safeguard.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const RUNNERS = {
  javascript: {
    ext: "js",
    cmd: (file) => ["node", [file]],
  },
  python: {
    ext: "py",
    cmd: (file) => ["python3", [file]],
  },
};

function runOne(language, code, input, timeLimitMs) {
  return new Promise((resolve) => {
    const runner = RUNNERS[language];
    if (!runner) return resolve({ ok: false, error: "Unsupported language" });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "judge-"));
    const file = path.join(tmpDir, `sol.${runner.ext}`);
    fs.writeFileSync(file, code);

    const [cmd, args] = runner.cmd(file);
    const child = spawn(cmd, args, {
      cwd: tmpDir,
      timeout: timeLimitMs,
      killSignal: "SIGKILL",
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeLimitMs);

    child.stdin.write(input || "");
    child.stdin.end();

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (codeExit) => {
      clearTimeout(killTimer);
      fs.rm(tmpDir, { recursive: true, force: true }, () => {});
      if (timedOut) return resolve({ ok: false, timedOut: true });
      if (codeExit !== 0) return resolve({ ok: false, error: stderr || "Runtime error" });
      resolve({ ok: true, stdout: stdout.trim() });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({ ok: false, error: err.message });
    });
  });
}

/**
 * Runs `code` against a list of test cases: [{ input, expected }]
 * Returns { passedCases, totalCases, verdict, details: [...] }
 */
async function judgeSubmission({ language, code, testCases, timeLimitMs = 2000 }) {
  const details = [];
  let passed = 0;

  for (const tc of testCases) {
    const result = await runOne(language, code, tc.input, timeLimitMs);
    if (!result.ok) {
      details.push({
        input: tc.input,
        expected: tc.expected,
        actual: null,
        verdict: result.timedOut ? "TLE" : "RUNTIME_ERROR",
        error: result.error,
      });
      continue;
    }
    const actual = result.stdout;
    const expected = String(tc.expected).trim();
    const isMatch = actual === expected;
    if (isMatch) passed += 1;
    details.push({
      input: tc.input,
      expected,
      actual,
      verdict: isMatch ? "PASSED" : "WRONG_ANSWER",
    });
  }

  let verdict = "ACCEPTED";
  if (passed === 0) {
    verdict = details.some((d) => d.verdict === "TLE") ? "TLE" : "WRONG_ANSWER";
  } else if (passed < testCases.length) {
    verdict = "PARTIAL";
  }

  return { passedCases: passed, totalCases: testCases.length, verdict, details };
}

module.exports = { judgeSubmission };
