/**
 * Lightweight code judge for JavaScript, Python, C, C++, and Java.
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
 *
 * C/C++/Java require their toolchains (gcc, g++, javac/java) to be present
 * wherever this runs — see backend/Dockerfile.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { mapWithConcurrency } = require("./queue");

const CASE_CONCURRENCY = Number(process.env.JUDGE_CASE_CONCURRENCY || 2);
const MEMORY_LIMIT_KB = Number(process.env.JUDGE_MEMORY_LIMIT_KB || 262144); // 256 MB default

// Text patterns that show up in stderr when a program actually ran out of the memory budget
// `ulimit -v` gave it, as opposed to some unrelated crash — used to report a distinct "Memory
// Limit Exceeded" verdict instead of a generic Runtime Error.
const OOM_PATTERNS = /cannot allocate memory|bad_alloc|outofmemoryerror|memoryerror|std::length_error|java\.lang\.outofmemory/i;

// Compiled languages need the source filename to match what the compiler expects
// (Java in particular requires the file to be named after its public class, so
// student code is expected to declare `public class Main`).
const RUNNERS = {
  javascript: {
    srcName: "sol.js",
    run: (file) => ({ cmd: "node", args: [file] }),
  },
  python: {
    srcName: "sol.py",
    run: (file) => ({ cmd: "python3", args: [file] }),
  },
  c: {
    srcName: "sol.c",
    compile: (file, dir) => ({ cmd: "gcc", args: [file, "-O2", "-o", path.join(dir, "sol_bin")] }),
    run: (_file, dir) => ({ cmd: path.join(dir, "sol_bin"), args: [] }),
  },
  cpp: {
    srcName: "sol.cpp",
    compile: (file, dir) => ({ cmd: "g++", args: [file, "-O2", "-o", path.join(dir, "sol_bin")] }),
    run: (_file, dir) => ({ cmd: path.join(dir, "sol_bin"), args: [] }),
  },
  java: {
    srcName: "Main.java",
    compile: (file, dir) => ({ cmd: "javac", args: [file] }),
    run: (_file, dir) => ({ cmd: "java", args: ["-cp", dir, "Main"] }),
  },
};

// Turns a raw compiler/interpreter stderr dump into a short, readable summary — students
// were seeing a full page of gcc/javac/Python-traceback noise instead of "line 12: ...".
const LINE_PATTERNS = {
  c: /:(\d+):\d+:\s*(?:fatal error|error):\s*(.+)/,
  cpp: /:(\d+):\d+:\s*(?:fatal error|error):\s*(.+)/,
  java: /:(\d+):\s*error:\s*(.+)/,
};
function summarizeError(language, rawMessage) {
  const message = String(rawMessage || "").trim();
  if (!message) return { line: null, message: "Unknown error" };

  let line = null;
  let summary = null;

  if (LINE_PATTERNS[language]) {
    const match = message.match(LINE_PATTERNS[language]);
    if (match) {
      line = Number(match[1]);
      summary = match[2].split("\n")[0].trim();
    }
  } else if (language === "python") {
    // Traceback ends with "File "sol.py", line N, in ..." then the exception on the last line
    const lineMatch = [...message.matchAll(/File "[^"]+", line (\d+)/g)].pop();
    if (lineMatch) line = Number(lineMatch[1]);
    const lastLine = message.trim().split("\n").pop();
    summary = lastLine?.trim();
  } else if (language === "javascript") {
    const lineMatch = message.match(/sol\.js:(\d+)/);
    if (lineMatch) line = Number(lineMatch[1]);
    const errorLine = message.split("\n").find((l) => /error/i.test(l));
    summary = (errorLine || message.split("\n")[0]).trim();
  }

  if (!summary) summary = message.split("\n")[0].trim();
  if (summary.length > 220) summary = `${summary.slice(0, 220)}…`;

  return { line, message: summary };
}

// Runs `cmd args...` under a virtual-memory ulimit (real OS-level enforcement — a process that
// exceeds it gets allocation failures, not just a number we report after the fact) and under
// `/usr/bin/time -v`, which writes real peak-RSS to a separate file (statsFile) so its report
// never gets mixed into the submitted program's own stderr.
function spawnWithTimeout(cmd, args, options, input, timeLimitMs, { enforceMemory = true } = {}) {
  return new Promise((resolve) => {
    const statsFile = path.join(os.tmpdir(), `judge-time-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    // The memory ulimit only applies to actually running submitted code, not to compilation —
    // javac in particular needs real JVM headroom well beyond a student program's own budget,
    // and capping it the same way would misreport legitimate compiler memory use as an MLE.
    const wrappedArgs = enforceMemory
      ? ["-v", "-o", statsFile, "sh", "-c", `ulimit -v ${MEMORY_LIMIT_KB}; exec "$0" "$@"`, cmd, ...args]
      : ["-v", "-o", statsFile, cmd, ...args];
    const child = spawn("/usr/bin/time", wrappedArgs, { ...options, killSignal: "SIGKILL" });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const startedAt = Date.now();

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeLimitMs);

    if (input !== undefined) {
      child.stdin.write(input || "");
      child.stdin.end();
    }

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    function readStatsAndCleanup() {
      let memoryKb = null;
      try {
        const raw = fs.readFileSync(statsFile, "utf8");
        const match = raw.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
        if (match) memoryKb = Number(match[1]);
      } catch { /* stats file may not exist if the process never actually started */ }
      fs.rm(statsFile, () => {});
      return memoryKb;
    }

    child.on("close", (codeExit) => {
      clearTimeout(killTimer);
      const timeMs = Date.now() - startedAt;
      const memoryKb = readStatsAndCleanup();
      if (timedOut) return resolve({ ok: false, timedOut: true, timeMs, memoryKb });
      if (codeExit !== 0) {
        const memoryExceeded = memoryKb != null && memoryKb >= MEMORY_LIMIT_KB * 0.97;
        const oom = memoryExceeded || OOM_PATTERNS.test(stderr);
        return resolve({ ok: false, error: stderr || "Runtime error", oom, timeMs, memoryKb });
      }
      resolve({ ok: true, stdout, timeMs, memoryKb });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      readStatsAndCleanup();
      resolve({ ok: false, error: err.message, timeMs: Date.now() - startedAt });
    });
  });
}

// Writes the source and compiles it (once) if the language needs it.
// Returns { ok: true, execute(input, timeLimitMs) } or { ok: false, error }.
async function prepare(language, code) {
  const runner = RUNNERS[language];
  if (!runner) return { ok: false, error: "Unsupported language" };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "judge-"));
  const file = path.join(tmpDir, runner.srcName);
  fs.writeFileSync(file, code);

  if (runner.compile) {
    const { cmd, args } = runner.compile(file, tmpDir);
    // Compilation gets a generous fixed budget, separate from the per-test-case run limit, and
    // is exempt from the execution memory ulimit (see spawnWithTimeout's enforceMemory comment).
    const compileResult = await spawnWithTimeout(cmd, args, { cwd: tmpDir }, undefined, 10000, { enforceMemory: false });
    if (!compileResult.ok) {
      fs.rm(tmpDir, { recursive: true, force: true }, () => {});
      return {
        ok: false,
        error: compileResult.timedOut ? "Compilation timed out" : compileResult.error || "Compilation failed",
      };
    }
  }

  return {
    ok: true,
    async execute(input, timeLimitMs) {
      const { cmd, args } = runner.run(file, tmpDir);
      const result = await spawnWithTimeout(cmd, args, { cwd: tmpDir, timeout: timeLimitMs }, input, timeLimitMs);
      if (!result.ok) return result;
      return { ok: true, stdout: result.stdout.trim(), timeMs: result.timeMs, memoryKb: result.memoryKb };
    },
    cleanup() {
      fs.rm(tmpDir, { recursive: true, force: true }, () => {});
    },
  };
}

/**
 * Runs `code` against a list of test cases: [{ input, expected }]
 * Returns { passedCases, totalCases, verdict, details: [...] }
 */
async function judgeSubmission({ language, code, testCases, timeLimitMs = 2000 }) {
  const prepared = await prepare(language, code);
  if (!prepared.ok) {
    const details = testCases.map((tc) => ({
      input: tc.input,
      expected: tc.expected,
      actual: null,
      verdict: "RUNTIME_ERROR",
      error: prepared.error,
    }));
    return {
      passedCases: 0,
      totalCases: testCases.length,
      verdict: "COMPILE_ERROR",
      details,
      errorSummary: { type: "Compilation Error", ...summarizeError(language, prepared.error) },
    };
  }

  let details;
  try {
    // Test cases are independent (same compiled binary, fresh process each run),
    // so run a bounded number concurrently — this mostly cuts down on wall-clock
    // time lost to process-startup overhead (especially the JVM) rather than
    // raw CPU, which matters most on a low-core instance.
    details = await mapWithConcurrency(testCases, CASE_CONCURRENCY, async (tc) => {
      const result = await prepared.execute(tc.input, timeLimitMs);
      if (!result.ok) {
        return {
          input: tc.input,
          expected: tc.expected,
          actual: null,
          verdict: result.timedOut ? "TLE" : result.oom ? "MLE" : "RUNTIME_ERROR",
          error: result.error,
          timeMs: result.timeMs ?? null,
          memoryKb: result.memoryKb ?? null,
        };
      }
      const actual = result.stdout;
      const expected = String(tc.expected).trim();
      const isMatch = actual === expected;
      return {
        input: tc.input,
        expected,
        actual,
        verdict: isMatch ? "PASSED" : "WRONG_ANSWER",
        timeMs: result.timeMs ?? null,
        memoryKb: result.memoryKb ?? null,
      };
    });
  } finally {
    prepared.cleanup();
  }

  const passed = details.filter((d) => d.verdict === "PASSED").length;

  let verdict = "ACCEPTED";
  if (passed === 0) {
    verdict = details.some((d) => d.verdict === "TLE") ? "TLE" : details.some((d) => d.verdict === "MLE") ? "MLE" : "WRONG_ANSWER";
  } else if (passed < testCases.length) {
    verdict = "PARTIAL";
  }

  const maxTimeMs = details.reduce((max, d) => (d.timeMs != null && d.timeMs > max ? d.timeMs : max), 0);
  const maxMemoryKb = details.reduce((max, d) => (d.memoryKb != null && d.memoryKb > max ? d.memoryKb : max), 0);

  // Only surface a technical error summary when every case failed the same way — a mixed
  // pass/fail result (verdict PARTIAL) stays silent here since exposing it would leak how
  // many cases passed, which submissions.js is specifically trying not to reveal.
  let errorSummary = null;
  if (passed === 0) {
    if (verdict === "TLE") {
      errorSummary = { type: "Time Limit Exceeded", line: null, message: "Your program took too long to produce output — the algorithm is likely too slow for the input size; try a more efficient approach." };
    } else if (verdict === "MLE") {
      errorSummary = { type: "Memory Limit Exceeded", line: null, message: "Your program used more memory than allowed — check for unbounded data structures, infinite recursion, or unnecessarily large allocations." };
    } else {
      const errored = details.find((d) => d.verdict === "RUNTIME_ERROR");
      if (errored) errorSummary = { type: "Runtime Error", ...summarizeError(language, errored.error) };
    }
  }

  return { passedCases: passed, totalCases: testCases.length, verdict, details, errorSummary, maxTimeMs, maxMemoryKb: maxMemoryKb || null };
}

module.exports = { judgeSubmission };
