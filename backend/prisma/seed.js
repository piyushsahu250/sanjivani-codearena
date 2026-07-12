const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { seedLearningModule } = require("./seedLearning");
const { seedGamification } = require("./seedGamification");
const { seedInterviewModule } = require("./seedInterview");
const { seedInterviewExtras } = require("./seedInterviewExtras");
const { seedInterviewExtras2 } = require("./seedInterviewExtras2");
const { seedModuleCoding } = require("./seedModuleCoding");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@sanjivani.edu.in";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
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
  } else {
    console.log("Admin already exists:", adminEmail);
  }

  await seedLearningModule(prisma);
  await seedGamification(prisma);
  await seedInterviewModule(prisma);
  await seedInterviewExtras(prisma);
  await seedInterviewExtras2(prisma);
  await seedModuleCoding(prisma);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
