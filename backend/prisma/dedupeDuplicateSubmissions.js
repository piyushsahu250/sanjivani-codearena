// One-time-safe cleanup that MUST run before `prisma db push` applies the new
// @@unique([attemptId, questionId]) constraint on Submission / ModuleCodingSubmission (added to
// fix a real autosave race that could create two rows for the same question). If any duplicate
// rows already exist in production from that race, `db push` would fail outright and take the
// whole backend down with it. This keeps only the most recently written row per (attemptId,
// questionId) and deletes the rest — safe to run on every deploy (idempotent no-op once clean).
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function dedupe(table, orderColumn) {
  try {
    const result = await prisma.$executeRawUnsafe(`
      DELETE FROM "${table}"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY "attemptId", "questionId"
            ORDER BY "${orderColumn}" DESC, id DESC
          ) AS rn
          FROM "${table}"
        ) ranked
        WHERE ranked.rn > 1
      );
    `);
    if (result > 0) console.log(`[dedupe] Removed ${result} duplicate row(s) from "${table}".`);
  } catch (err) {
    // Best-effort: never block the deploy over this cleanup step itself failing (e.g. a truly
    // fresh DB where the table doesn't exist yet) — if real duplicates remain, the subsequent
    // `prisma db push` will surface that clearly on its own.
    console.error(`[dedupe] Skipped "${table}" cleanup:`, err.message);
  }
}

async function main() {
  await dedupe("Submission", "createdAt");
  await dedupe("ModuleCodingSubmission", "updatedAt");
}

main()
  .catch((err) => console.error("[dedupe] Unexpected failure:", err))
  .finally(() => prisma.$disconnect());
