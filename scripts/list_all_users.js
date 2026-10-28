import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
  });
  console.log("Total users in DB:", allUsers.length);
  console.log(JSON.stringify(allUsers, null, 2));
}

main().finally(() => prisma.$disconnect());
