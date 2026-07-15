// In-process metrics collection for the admin monitoring page. Deliberately limited to what a
// single Node process can honestly measure without adding new infrastructure (no APM/Redis/
// external monitoring service) — everything here resets on restart and reflects only this
// process, which is the only process this platform currently runs (single Render instance).

const RING_SIZE = 200;
const responseTimes = []; // rolling window of recent request durations (ms)
const recentErrors = []; // rolling window of the most severe, process-level failures

// Event-loop lag: how much later than expected a periodic timer actually fires. A healthy
// process shows a few ms; a process struggling to keep up (CPU-bound work blocking the loop,
// e.g. many judge submissions running synchronously) shows this climbing into the hundreds+.
// This is the same technique Node's own `perf_hooks` monitor / most APM agents use.
let lastEventLoopLagMs = 0;
const LAG_SAMPLE_MS = 500;
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  lastEventLoopLagMs = Math.max(0, now - lastTick - LAG_SAMPLE_MS);
  lastTick = now;
}, LAG_SAMPLE_MS).unref();

function recordRequestTime(ms) {
  responseTimes.push(ms);
  if (responseTimes.length > RING_SIZE) responseTimes.shift();
}

// Only uncaught exceptions / unhandled rejections land here — routes that catch their own
// errors and respond with a handled 500 are, by definition, not process-level failures, and
// surfacing every one of those would require touching every route file. This log is for the
// failures that would otherwise crash the process silently.
function recordProcessError(err, context) {
  recentErrors.push({ time: new Date().toISOString(), context: context || "unknown", message: err?.message || String(err) });
  if (recentErrors.length > 50) recentErrors.shift();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function getSnapshot() {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null;
  return {
    requestTimingMs: {
      sampleSize: sorted.length,
      avg,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    },
    eventLoopLagMs: lastEventLoopLagMs,
    recentErrors: [...recentErrors].reverse(),
  };
}

// Express middleware — times every request and records it into the rolling window.
function timingMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordRequestTime(ms);
  });
  next();
}

module.exports = { timingMiddleware, recordProcessError, getSnapshot };
