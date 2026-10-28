import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== QUERYING USERS WITH 'raju' ===");
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'raju', mode: 'insensitive' } },
        { name: { contains: 'raju', mode: 'insensitive' } }
      ]
    },
    include: { managerAssignments: { include: { gosala: true } } }
  });
  console.log("Found users count:", users.length);
  for (const u of users) {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      passwordLen: u.password?.length,
      passwordStart: u.password?.slice(0, 15),
      rawPassword: u.password,
      isActive: u.isActive,
      managerAssignments: u.managerAssignments.map(a => ({
        id: a.id,
        gosalaId: a.gosalaId,
        gosalaName: a.gosala?.name,
        region: a.region
      }))
    });
  }

  console.log("\n=== ALL MANAGERS IN DB ===");
  const allManagers = await prisma.user.findMany({
    where: { role: 'GOSALA_MANAGER' },
    select: { id: true, name: true, email: true, role: true, password: true }
  });
  console.log("All managers:", allManagers);

  console.log("\n=== ALL GOSALAS IN DB ===");
  const gosalas = await prisma.gosala.findMany({
    select: { id: true, name: true, region: true }
  });
  console.log("All gosalas:", gosalas);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
