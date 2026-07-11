const { XP_RULE_DEFS, BADGE_DEFS } = require("../src/utils/gamification");

// Idempotent AND non-destructive to admin edits: XpRule upserts by activity (its @id), Badge
// upserts by code (its @unique), but `update: {}` on both — a row that already exists is left
// alone entirely. Admins are meant to be able to edit XP values and badge details via the CMS;
// overwriting those edits on every redeploy would defeat that. This only ever creates rows that
// are missing (e.g. a new badge added to BADGE_DEFS in a future code change).
async function seedGamification(prisma) {
  for (const rule of XP_RULE_DEFS) {
    await prisma.xpRule.upsert({ where: { activity: rule.activity }, update: {}, create: rule });
  }

  for (const badge of BADGE_DEFS) {
    await prisma.badge.upsert({ where: { code: badge.code }, update: {}, create: badge });
  }

  console.log("Seeded gamification:", XP_RULE_DEFS.length, "XP rules,", BADGE_DEFS.length, "badges.");
}

module.exports = { seedGamification };
