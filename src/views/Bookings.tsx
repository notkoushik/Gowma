import { useMemo, useState } from "react"
import {
  Check,
  MapPin,
  Search,
  Truck,
  X,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Sparkles,
  KeyRound,
  FileCheck2,
} from "lucide-react"
import { drivers, inr, type Booking, type BookingStatus } from "../data/mock"
import { useStore, useToast } from "../store/store"
import { Eyebrow, Panel, StatusPill, Tag } from "../lib/ui"
import CustomerDetailsModal from "../components/CustomerDetailsModal"
import { normalizeDateStr, isSameDate, getDateChipLabel } from "../lib/dateUtils"

const filters: (BookingStatus | "All")[] = [
  "All",
  "Payment Verified",
  "Manager Review",
  "Manager Confirmed",
  "Admin Review",
  "Confirmed",
  "In Service",
  "Completed",
]

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-line/70 last:border-0">
      <span className="text-[12px] text-ink-faint">{label}</span>
      <span
        className={`text-[13px] text-ink text-right ${
          mono ? "font-mono tabular" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Drawer({
  booking,
  onClose,
  onDecide,
  onActingManagerDecide,
  onAssign,
  onOpenCustomerModal,
}: {
  booking: Booking
  onClose: () => void
  onDecide: (b: Booking, confirm: boolean, remark?: string) => void
  onActingManagerDecide: (b: Booking, confirm: boolean, remark?: string) => void
  onAssign: (b: Booking, driver: string) => void
  onOpenCustomerModal: (b: Booking) => void
}) {
  const { managers } = useStore()
  const b = booking
  const canActAdmin = b.status === "Admin Review"
  const isAwaitingFeasibility = b.status === "Payment Verified" || b.status === "Manager Review"
  
  // Check if this gaushala has an active manager
  const assignedActiveManager = managers.find(
    (m) =>
      m.gosala.toLowerCase() === b.gosala.toLowerCase() &&
      m.status === "Active",
  )
  const isShelterUnassigned = !assignedActiveManager

  const needsDriver = b.status === "Confirmed" && !b.driver
  const chargeableKm = Math.max(0, b.distanceKm - 5)
  const commission = Math.round(
    (b.base + b.extraTime) * (b.commissionPct / 100),
  )

  const isActingManagerAudit =
    b.managerApproval?.isActingManager ||
    b.managerApproval?.actorRole === "OPERATIONS_ADMIN" ||
    b.managerApproval?.name.toLowerCase().includes("acting") ||
    b.managerRemark?.toLowerCase().includes("acting")

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-[440px] h-full bg-card border-l border-line overflow-y-auto shadow-2xl flex flex-col justify-between">
        <div>
          <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-line px-5 py-4 flex items-start justify-between z-10">
            <div>
              <div className="flex items-center gap-2">
                <Eyebrow>Booking Dossier</Eyebrow>
                {isShelterUnassigned && (
                  <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20">
                    Acting Scope
                  </span>
                )}
              </div>
              <div className="font-mono text-[15px] text-ink mt-0.5">{b.id}</div>
            </div>
            <button
              onClick={onClose}
              className="text-ink-faint hover:text-ink hover:bg-paper-deep rounded-sm p-1 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            <div className="flex items-center justify-between">
              <StatusPill status={b.status} />
              {b.paid && <Tag tone="ok">Payment verified · server-side</Tag>}
            </div>

            {/* Acting Manager Notice Banner if shelter is unassigned and awaiting feasibility */}
            {isAwaitingFeasibility && isShelterUnassigned && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-[12px] text-amber-900 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
                  <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                  <span>Unassigned Shelter · Acting Custodian Required</span>
                </div>
                <p className="mt-1 text-[11.5px] text-amber-950/80 dark:text-amber-300/80 leading-relaxed">
                  {b.gosala} does not have an active custodian manager. As Regional Operations Admin, you can review feasibility directly so the devotee booking is not stalled.
                </p>
              </div>
            )}

            {/* Complete Devotee KYC & Profile Dossier Card */}
            <div className="bg-paper-deep rounded-md p-4 border border-line space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-line/70">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-forest text-white flex items-center justify-center font-serif text-[15px] font-semibold shrink-0">
                    {b.customer.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-ink text-[14px]">
                        {b.customer}
                      </span>
                      <span className="text-[10px] font-medium text-forest bg-forest-soft px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <ShieldCheck size={11} /> Verified Devotee
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      Devotee Since {b.devoteeSince || "Aug 2024"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenCustomerModal(b)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-forest bg-forest-soft hover:bg-forest/20 border border-forest/30 rounded transition-colors cursor-pointer shadow-2xs"
                  title="View full customer dossier, submitted identity documents and ceremony protocol"
                >
                  <User size={12} />
                  <span>Full KYC Dossier →</span>
                </button>
              </div>

              {/* Devotee Contact & Lineage */}
              <div className="space-y-1.5 text-[12px]">
                <Row
                  label="Devotee Phone"
                  value={b.phone}
                  mono
                />
                <Row
                  label="Devotee Email"
                  value={
                    b.customerEmail ||
                    `${b.customer.toLowerCase().replace(/\s+/g, ".")}@gmail.com`
                  }
                />
                <Row
                  label="Submitted Aadhaar KYC"
                  value={b.aadhaarNumber || "XXXX-XXXX-4912"}
                  mono
                />
                <Row
                  label="Devotee Gotra"
                  value={b.devoteeGotra || "Kashyapa"}
                />
                <Row
                  label="Family Members"
                  value={b.devoteeFamilyMembers || "Ananya (Self), Rajesh (Husband)"}
                />
                <Row
                  label="Ceremonial Purpose"
                  value={b.ritualPurpose || "Griha Pravesh & Kamadhenu Puja"}
                />
                <Row
                  label="Service Address"
                  value={b.address}
                />
                <Row
                  label="Transit Distance"
                  value={`${b.distanceKm} km transit`}
                  mono
                />
                <Row
                  label="Handover Security OTP"
                  value={b.handoverOtp || "4819"}
                  mono
                />
              </div>

              {/* Special Instructions / Altar Protocol */}
              <div className="pt-2 border-t border-line/70 text-[11.5px] text-ink-faint">
                <span className="font-medium text-ink">Altar Protocol:</span>{" "}
                <span className="italic text-ink-soft">
                  {b.specialInstructions ||
                    "Ground-floor portico ready, clean water bucket and sacred green grass feeding protocol."}
                </span>
              </div>
            </div>

            <div>
              <Eyebrow>Booking & Gaushala</Eyebrow>
              <div className="mt-2">
                <Row label="Animal" value={`${b.animal} · ${b.animalType}`} />
                <Row label="Gosala" value={b.gosala} />
                <Row
                  label="Local Custodian"
                  value={
                    assignedActiveManager
                      ? `${assignedActiveManager.name} (${assignedActiveManager.phone})`
                      : "⚠️ Unassigned (Admin Acting)"
                  }
                />
                <Row label="Date" value={b.date} />
                <Row label="Time" value={`${b.start} – ${b.end}`} mono />
                <Row
                  label="Duration"
                  value={`${b.durationMin} min (60 incl. + ${b.durationMin - 60} extra)`}
                  mono
                />
                <Row label="Driver" value={b.driver ?? "Not assigned"} />
              </div>
            </div>

            <div>
              <Eyebrow>Price snapshot</Eyebrow>
              <div className="mt-2">
                <Row label="Base booking" value={inr(b.base)} mono />
                <Row label="Extra time" value={inr(b.extraTime)} mono />
                <Row
                  label={`Transport · ${chargeableKm.toFixed(1)} chargeable km`}
                  value={inr(b.transport)}
                  mono
                />
                <Row label="Add-ons (mala, flowers)" value={inr(b.addons)} mono />
                <Row label="Tax" value={inr(b.tax)} mono />
                {b.discount > 0 && (
                  <Row label="Discount" value={`− ${inr(b.discount)}`} mono />
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-line-strong">
                <span className="font-serif text-[15px] text-ink">
                  Total charged
                </span>
                <span className="font-mono text-[18px] text-ink tabular">
                  {inr(b.total)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 text-[12px] text-ink-faint">
                <span>GOMAA commission ({b.commissionPct}%)</span>
                <span className="font-mono tabular">{inr(commission)}</span>
              </div>
            </div>

            {(b.managerApproval ||
              b.adminApproval ||
              b.managerRemark ||
              b.adminRemark) && (
              <div>
                <Eyebrow>Approval & audit trail</Eyebrow>
                <div className="mt-2 space-y-2">
                  {b.managerApproval ? (
                    <div className="text-[12px] text-ink-soft bg-paper rounded-sm p-3 border border-line">
                      <div className="flex justify-between items-center text-[10.5px] text-ink-faint">
                        <span className="font-mono uppercase tracking-wider font-semibold text-saffron-deep flex items-center gap-1">
                          {isActingManagerAudit ? (
                            <>
                              <ShieldCheck size={12} className="text-saffron shrink-0" />
                              <span>Admin Acting as Manager · {b.managerApproval.name}</span>
                            </>
                          ) : (
                            <>
                              <UserCheck size={12} className="text-saffron shrink-0" />
                              <span>Gaushala Manager · {b.managerApproval.name}</span>
                            </>
                          )}
                        </span>
                        <span className="font-mono">
                          {b.managerApproval.timestamp}
                        </span>
                      </div>
                      <div className="mt-1 text-ink">
                        {b.managerApproval.remark}
                      </div>
                    </div>
                  ) : b.managerRemark ? (
                    <div className="text-[12px] text-ink-soft bg-paper rounded-sm p-3 border border-line">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                        Manager Feasibility Remark
                      </span>
                      <div className="mt-0.5">{b.managerRemark}</div>
                    </div>
                  ) : null}

                  {b.adminApproval ? (
                    <div className="text-[12px] text-ink-soft bg-paper rounded-sm p-3 border border-line">
                      <div className="flex justify-between items-center text-[10.5px] text-ink-faint">
                        <span className="font-mono uppercase tracking-wider font-semibold text-ok flex items-center gap-1">
                          <Check size={12} className="text-ok shrink-0" />
                          <span>Admin Confirmed · {b.adminApproval.name} ({b.adminApproval.userId})</span>
                        </span>
                        <span className="font-mono">
                          {b.adminApproval.timestamp}
                        </span>
                      </div>
                      <div className="mt-1 text-ink">
                        {b.adminApproval.remark}
                      </div>
                    </div>
                  ) : b.adminRemark ? (
                    <div className="text-[12px] text-ink-soft bg-paper rounded-sm p-3 border border-line">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                        Admin Remark
                      </span>
                      <div className="mt-0.5">{b.adminRemark}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {needsDriver && (
              <div>
                <Eyebrow>Assign driver</Eyebrow>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {drivers.map((d) => (
                    <button
                      key={d}
                      onClick={() => onAssign(b, d)}
                      className="flex items-center gap-2.5 rounded-sm border border-line bg-paper px-3 py-2.5 text-[13px] text-ink hover:border-saffron hover:bg-saffron-soft/50 transition-colors"
                    >
                      <Truck size={15} className="text-saffron" /> {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11.5px] text-ink-faint leading-relaxed bg-paper rounded-sm p-3 border border-line">
              Prices shown are the immutable snapshot captured at checkout (Free
              KM: {b.freeKmSnapshot ?? 5} km, Per-KM: ₹{b.perKmSnapshot ?? 50}
              /km). Later admin pricing changes will not recalculate this booking.
            </p>
          </div>
        </div>

        {/* Action Button Strip */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-line px-5 py-4">
          {/* Case 1: Phase-1 Feasibility Review (Payment Verified) */}
          {isAwaitingFeasibility && (
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    onActingManagerDecide(
                      b,
                      false,
                      "Rejected feasibility by Operations Admin acting as Custodian",
                    )
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1.5 border border-line-strong text-danger rounded-sm py-2.5 text-[12.5px] font-medium hover:bg-danger-soft transition-colors"
                >
                  <X size={15} /> Reject
                </button>
                <button
                  onClick={() =>
                    onActingManagerDecide(
                      b,
                      true,
                      "Feasibility and animal health verified by Admin acting as Gaushala Custodian",
                    )
                  }
                  className="flex-[2] inline-flex items-center justify-center gap-1.5 bg-saffron text-white rounded-sm py-2.5 text-[12.5px] font-medium hover:bg-saffron-deep transition-colors shadow-xs"
                >
                  <ShieldCheck size={15} />
                  <span>
                    {isShelterUnassigned
                      ? "Approve as Acting Manager"
                      : "Intervene & Approve Feasibility"}
                  </span>
                </button>
              </div>
              <p className="text-[10.5px] text-ink-faint text-center">
                Advances to Phase-2 Admin Review for final operations validation
              </p>
            </div>
          )}

          {/* Case 2: Phase-2 Operations Admin Final Confirmation (Admin Review) */}
          {canActAdmin && (
            <div className="flex gap-3">
              <button
                onClick={() =>
                  onDecide(b, false, "Operational constraint - refunded")
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 border border-line-strong text-danger rounded-sm py-2.5 text-[13px] font-medium hover:bg-danger-soft transition-colors"
              >
                <X size={15} /> Reject
              </button>
              <button
                onClick={() =>
                  onDecide(
                    b,
                    true,
                    "Final approval granted. Payment verified via gateway webhook.",
                  )
                }
                className="flex-[1.6] inline-flex items-center justify-center gap-1.5 bg-saffron text-white rounded-sm py-2.5 text-[13px] font-medium hover:bg-saffron-deep transition-colors"
              >
                <Check size={15} /> Admin confirm &amp; book
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

export default function Bookings() {
  const { bookings: rows, managers, gosalas, adminDecide, managerDecide, assignDriver, profiles, authUser, currentRole, users } = useStore()
  const { notify } = useToast()
  const activeAdminName = authUser?.name || profiles?.admin?.name || "Operations Admin"
  const [filter, setFilter] = useState<typeof filters[number]>("All")
  const [gosalaFilter, setGosalaFilter] = useState<string>("All")
  const [adminFilter, setAdminFilter] = useState<string>("All")
  const [q, setQ] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [customerModalBooking, setCustomerModalBooking] =
    useState<Booking | null>(null)

  const registeredOpsAdmins = useMemo(
    () => users.filter((u) => u.role === "admin" || (u as any).dbRole === "OPERATIONS_ADMIN"),
    [users],
  )

  const getBookingAdmin = (b: Booking): string => {
    if (b.governingAdminName) return b.governingAdminName
    const g = gosalas.find((x) => x.name.toLowerCase() === b.gosala.toLowerCase())
    return (g as any)?.governingAdminName || (g as any)?.adminName || ""
  }

  const visible = useMemo(
    () =>
      rows.filter((b) => {
        const mFilter = filter === "All" || b.status === filter
        const mGosala =
          gosalaFilter === "All" ||
          b.gosala.toLowerCase() === gosalaFilter.toLowerCase()
        const govAdmin = getBookingAdmin(b)
        const mAdmin =
          adminFilter === "All" ||
          govAdmin.toLowerCase() === adminFilter.toLowerCase()
        const mQ =
          q === "" ||
          [b.id, b.customer, b.animal, b.gosala, b.devoteeGotra || "", govAdmin].some((f) =>
            f.toLowerCase().includes(q.toLowerCase()),
          )
        return mFilter && mGosala && mAdmin && mQ
      }),
    [rows, filter, gosalaFilter, adminFilter, q, gosalas],
  )

  const open = rows.find((b) => b.id === openId) ?? null

  const decide = (b: Booking, confirm: boolean, remark?: string) => {
    adminDecide(b.id, confirm, remark || "")
    setOpenId(null)
  }

  const actingManagerDecide = (b: Booking, confirm: boolean, remark?: string) => {
    managerDecide(
      b.id,
      confirm,
      remark || "Feasibility verified by Admin as Acting Custodian",
      `${activeAdminName} (Acting Manager)`,
      undefined,
    )
    notify(
      confirm
        ? `Feasibility confirmed as Acting Manager for ${b.id} · Now in Admin Review for final confirmation`
        : `Feasibility rejected as Acting Manager for ${b.id}`,
      confirm ? "ok" : "danger",
    )
  }

  const assign = (b: Booking, driver: string) => assignDriver(b.id, driver)

  return (
    <>
      <Panel>
        <div className="flex flex-col gap-3 px-5 py-4 border-b border-line">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search booking, customer, animal…"
                className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
              />
            </div>

            {/* Gaushala Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ink-faint whitespace-nowrap">Filter Gaushala:</span>
              <select
                value={gosalaFilter}
                onChange={(e) => setGosalaFilter(e.target.value)}
                className="bg-paper border border-line rounded-sm px-2.5 py-1.5 text-[12.5px] text-ink font-medium outline-none focus:border-saffron transition"
              >
                <option value="All">All Gaushalas ({rows.length})</option>
                {gosalas.map((g) => {
                  const count = rows.filter(
                    (b) => b.gosala.toLowerCase() === g.name.toLowerCase(),
                  ).length
                  return (
                    <option key={g.name} value={g.name}>
                      {g.name} ({count})
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Super Admin: Operations Admin Portfolio Filter */}
            {currentRole === "super_admin" && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-ink-faint whitespace-nowrap">Portfolio Admin:</span>
                <select
                  value={adminFilter}
                  onChange={(e) => setAdminFilter(e.target.value)}
                  className="bg-paper border border-amber-300 rounded-sm px-2.5 py-1.5 text-[12.5px] text-ink font-medium outline-none focus:border-amber-500 transition shadow-2xs"
                >
                  <option value="All">All Operations Portfolios ({rows.length})</option>
                  {registeredOpsAdmins.map((adm) => {
                    const count = rows.filter((b) => getBookingAdmin(b).toLowerCase() === adm.name.toLowerCase()).length
                    return (
                      <option key={adm.id} value={adm.name}>
                        {adm.name} ({count})
                      </option>
                    )
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-sm px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  filter === f
                    ? "bg-ink text-paper"
                    : "text-ink-soft hover:bg-paper-deep"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="text-left">
                {[
                  "Booking",
                  "Customer",
                  "Animal / Gosala",
                  "Schedule",
                  "Distance",
                  "Total",
                  "Status & Governance",
                ].map((h) => (
                  <th
                    key={h}
                    className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint font-medium px-5 py-3 border-b border-line"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => {
                const assignedManager = managers.find(
                  (m) =>
                    m.gosala.toLowerCase() === b.gosala.toLowerCase() &&
                    m.status === "Active",
                )
                const isUnassigned = !assignedManager
                const isNeedsActing =
                  isUnassigned &&
                  (b.status === "Payment Verified" || b.status === "Manager Review")

                return (
                  <tr
                    key={b.id}
                    onClick={() => setOpenId(b.id)}
                    className="cursor-pointer border-b border-line/70 hover:bg-paper/70 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink whitespace-nowrap">
                      {b.id}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13.5px] text-ink font-semibold">{b.customer}</span>
                        <span className="text-[10px] font-medium text-forest bg-forest-soft px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <ShieldCheck size={10} /> Verified
                        </span>
                      </div>
                      <div className="text-[11.5px] text-ink-faint font-mono flex items-center gap-2 mt-0.5 flex-wrap">
                        <a
                          href={`tel:${b.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-forest"
                        >
                          {b.phone}
                        </a>
                        <span>·</span>
                        <span className="text-[10.5px] font-sans text-saffron-deep font-semibold">
                          Gotra: {b.devoteeGotra || "Kashyapa"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[13px] text-ink font-medium">
                        {b.animal}{" "}
                        <span className="text-ink-faint font-normal">· {b.animalType}</span>
                      </div>
                      <div className="text-[11.5px] text-ink-faint flex items-center gap-1.5 mt-0.5">
                        <span>{b.gosala}</span>
                        {isUnassigned && (
                          <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            (Admin Scope)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink-soft tabular whitespace-nowrap">
                      {getDateChipLabel(b.date)}
                      <span className="text-ink-faint"> · </span>
                      {b.start}–{b.end}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 font-mono text-[12.5px] text-ink-soft tabular">
                        <MapPin size={12} className="text-ink-faint" />
                        {b.distanceKm} km
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-ink tabular whitespace-nowrap font-medium">
                      {inr(b.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <StatusPill status={b.status} />
                        {isNeedsActing && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30">
                            <ShieldAlert size={11} /> Acting Review
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-[13px] text-ink-faint"
                  >
                    No bookings match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {open && (
        <Drawer
          booking={open}
          onClose={() => setOpenId(null)}
          onDecide={decide}
          onActingManagerDecide={actingManagerDecide}
          onAssign={assign}
          onOpenCustomerModal={(b) => setCustomerModalBooking(b)}
        />
      )}

      {/* Devotee Complete Dossier & KYC Inspection Modal */}
      <CustomerDetailsModal
        booking={customerModalBooking}
        isOpen={Boolean(customerModalBooking)}
        onClose={() => setCustomerModalBooking(null)}
        onAssignDriver={(b) => {
          setOpenId(b.id)
        }}
      />
    </>
  )
}
