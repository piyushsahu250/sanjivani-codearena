const { parentPort, workerData } = require("worker_threads");
const Database = require("better-sqlite3");

// Runs entirely inside a worker thread — a runaway or malicious query (huge cartesian join,
// recursive CTE, etc.) blocks only this worker's own thread, never the main event loop every
// other request on this platform runs on. The parent (sqlJudge.js) terminates this worker
// outright if it doesn't respond within the time limit; that termination is the actual timeout
// enforcement, nothing in here needs its own timer.
try {
  const { sqlSchema, caseInput, query } = workerData;
  const db = new Database(":memory:");
  try {
    if (sqlSchema) db.exec(sqlSchema);
    if (caseInput) db.exec(caseInput);
    const rows = db.prepare(query).all();
    parentPort.postMessage({ ok: true, rows });
  } finally {
    db.close();
  }
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
