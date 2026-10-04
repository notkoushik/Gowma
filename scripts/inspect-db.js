import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      managerAssignments: {
        include: { gosala: true }
      }
    }
  });
  console.log('--- ALL USERS IN DB ---');
  for (const u of users) {
    console.log(`User [${u.id}] ${u.name} (${u.email}) Role: ${u.role}`);
    for (const a of u.managerAssignments) {
      console.log(`  -> Assigned to Gosala: [${a.gosalaId}] ${a.gosala?.name} (Status: ${a.status})`);
    }
  }

  const gosalas = await prisma.gosala.findMany();
  console.log('\n--- ALL GOSALAS IN DB ---');
  for (const g of gosalas) {
    console.log(`Gosala [${g.id}] "${g.name}" Manager: "${g.manager}" Contact: "${g.contactPerson}" Region: "${g.region}"`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
