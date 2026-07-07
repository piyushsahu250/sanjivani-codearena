const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@sanjivani.edu.in";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log("Admin already exists:", adminEmail);
    return;
  }
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.create({
    data: {
      name: "Platform Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log("Seeded admin user:");
  console.log("  email:", adminEmail);
  console.log("  password: Admin@123  (change this immediately after first login)");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
