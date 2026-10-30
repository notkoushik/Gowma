// Manual testing helper: pretends the 2-day wait has passed for settlements that are still waiting.
// It only changes the date on settlements in the HELD state. It never moves money.
//   node --env-file=.env --experimental-transform-types --no-warnings scripts/dev-skip-wait.mjs
import { prisma } from "../server/prisma.ts"

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run with NODE_ENV=production")
  process.exit(2)
}
const res = await prisma.bookingSettlement.updateMany({
  where: { status: "HELD" },
  data: { paidAt: new Date(Date.now() - 3 * 86400000), eligibleAt: new Date(Date.now() - 86400000) },
})
console.log(`${res.count} waiting settlement(s) are now past the 2-day wait.`)
await prisma.$disconnect()
