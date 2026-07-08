const { PrismaClient } = require("@prisma/client");

// Shared across all routes — a separate PrismaClient per file each opens its own
// connection pool, which multiplies connections to Neon for no benefit and makes
// hitting the free-tier connection limit (and the resulting P1001 errors) more likely.
const prisma = new PrismaClient();

module.exports = prisma;
