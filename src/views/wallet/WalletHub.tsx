import EarningsWallet from "./EarningsWallet"
import TreasuryApprovals from "./TreasuryApprovals"

/** One entry point for the commission wallet. Each role sees only its own screen. */
export default function WalletHub({ role }: { role: "super_admin" | "admin" | "manager" }) {
  if (role === "super_admin") return <TreasuryApprovals />
  return <EarningsWallet role={role} />
}
