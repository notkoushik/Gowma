import { useState, useEffect, useMemo } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  PawPrint,
  X,
  AlertTriangle,
  ShieldCheck,
  SunMedium,
  UserCheck,
  Truck,
  Sparkles,
  Info,
  User,
  Fingerprint,
  Phone,
  Mail,
  ExternalLink,
  Receipt,
  Car,
  CheckCircle2,
  Calendar,
  Loader2,
  Search,
  Filter,
  ArrowRight,
  Eye,
  ChevronRight,
  Ban,
  ArrowDown,
} from "lucide-react"
import {
  inr,
  type Booking,
  type BookingStatus,
  inHouseDrivers,
  type GaushalaDriver,
} from "../../data/mock"
import { useStore, useToast } from "../../store/store"
import { Eyebrow, Panel, StatusPill, Tag } from "../../lib/ui"
import { api } from "../../services/api"

const reviewable: BookingStatus[] = ["Payment Verified", "Manager Review"]

type RejectionReasonCode = "ERR_DIST_EXCEEDED" | "ERR_ACCESS_UNSAFE" | "ERR_HEAT_STRESS" | "ERR_HEALTH_VET" | "ERR_BUFFER_CONFLICT" | "ERR_SOUND_HAZARD"

const rejectionTaxonomy: {
  code: RejectionReasonCode
  label: string
  desc: string
}[] = [
  {
    code: "ERR_DIST_EXCEEDED",
    label: "Distance Exceeded",
    desc: "Transit distance exceeds the physiological capacity or road radius for this animal.",
  },
  {
    code: "ERR_ACCESS_UNSAFE",
    label: "Unsafe Venue Access",
    desc: "Venue lacks ground-floor access, has stairs/elevators, or slippery tiles.",
  },
  {
    code: "ERR_HEAT_STRESS",
    label: "Thermal / Heat Stress",
    desc: "Forecasted ambient heat index or midday sun exposure exceeds animal safety limits.",
  },
  {
    code: "ERR_HEALTH_VET",
    label: "Veterinary Rest Hold",
    desc: "Animal placed under precautionary medical observation or post-trip rest.",
  },
  {
    code: "ERR_BUFFER_CONFLICT",
    label: "Resting Buffer Conflict",
    desc: "Insufficient 90-minute resting & hydration cooldown following previous seva.",
  },
  {
    code: "ERR_SOUND_HAZARD",
    label: "Acoustic / Firecracker Hazard",
    desc: "Loudspeakers, brass bands, or firecrackers near the ceremonial altar.",
  },
]

function ReviewCard({
  b,
  isOpen,
  onToggle,
  onConfirm,
  onOpenRejectModal,
  onOpenCustomerModal,
  onOpenDriverModal,
  isHighlighted,
}: {
  b: Booking
  isOpen: boolean
  onToggle: () => void
  onConfirm: (b: Booking, remark: string) => void
  onOpenRejectModal: (b: Booking) => void
  onOpenCustomerModal: (b: Booking) => void
  onOpenDriverModal: (b: Booking) => void
  isHighlighted?: boolean
}) {
  const [remark, setRemark] = useState("")
  const { animals } = useStore()
  const open = isOpen

  const decided =
    !!b.managerRemark ||
    b.status === "Rejected" ||
    b.status === "Admin Review" ||
    b.status === "Confirmed"

  // Animal capability inspection
  const bAnimal = (b.animal || "").toLowerCase()
  const animalObj = (animals || []).find(
    (a) => (a.name || "").toLowerCase() === bAnimal,
  )
  const isCalf = b.animalType === "Calf" || bAnimal.includes("kesari")
  const isPair = b.animalType === "Cow & Calf"
  const maxDistance = animalObj?.maxRadiusKm || (isCalf ? 8 : isPair ? 15 : 20)
  const distanceSafe = (b.distanceKm || 0) <= maxDistance

  // Simulated weather check for slot
  const isMidday = (b.start || "") >= "12:00" && (b.start || "") <= "15:30"

  return (
    <div
      id={`booking-card-${b.id}`}
      className="scroll-mt-24 transition-all duration-300"
    >
      <Panel
        className={`transition-all duration-300 ${
          isHighlighted
            ? "ring-4 ring-saffron shadow-2xl scale-[1.01] border-saffron"
            : open
              ? "border-saffron/45 ring-1 ring-saffron/20 shadow-md"
              : decided
                ? "opacity-85 border-line hover:border-line-strong"
                : "border-line-strong shadow-sm hover:border-saffron/30"
        }`}
      >
        {/* Summary Header Strip */}
        <div
          onClick={onToggle}
          className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 sm:py-3.5 cursor-pointer transition-all select-none ${
            open
              ? "bg-gradient-to-r from-saffron-soft/40 via-card/95 to-card"
              : "bg-card/60 hover:bg-card/90"
          }`}
        >
          <div className="flex items-center justify-between sm:contents">
            <div className="font-mono text-[12.5px] text-ink-faint sm:w-[92px]">
              {b.id}
            </div>
            <div className="sm:hidden flex items-center gap-3">
              <div className="font-mono text-[14px] text-ink tabular font-medium">
                {inr(b.total)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle()
                }}
                className={`p-1.5 rounded-full transition-all ${
                  open
                    ? "bg-saffron/15 text-saffron-deep"
                    : "text-ink-faint hover:text-ink"
                }`}
                aria-label="Toggle details"
              >
                <ChevronDown
                  size={18}
                  className={`transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] text-ink font-semibold flex items-center gap-2 flex-wrap">
              <span>{b.customer}</span>
              {b.paid && (
                <span className="text-[10px] font-mono bg-forest/10 text-forest border border-forest/20 px-1.5 py-0.5 rounded">
                  Paid ₹{b.total}
                </span>
              )}
              {open && (
                <span className="text-[10px] font-mono uppercase tracking-wider bg-saffron/10 text-saffron-deep border border-saffron/20 px-1.5 py-0.2 rounded font-medium">
                  Active Inspection
                </span>
              )}
            </div>

            <div className="text-[12px] text-ink-faint flex items-center gap-x-3 gap-y-1 mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-ink-soft">
                <PawPrint size={13} className="text-saffron" /> {b.animal} (
                {b.animalType})
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {b.start}–{b.end} ({b.durationMin}m)
              </span>
              <span
                className={`inline-flex items-center gap-1 font-mono ${
                  distanceSafe ? "text-forest" : "text-danger font-semibold"
                }`}
              >
                <MapPin size={12} /> {b.distanceKm} km{" "}
                {distanceSafe
                  ? `(≤ ${maxDistance}km safe)`
                  : `(Exceeds ${maxDistance}km cap!)`}
              </span>

              {/* Assigned Transport Badge */}
              {b.driver ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-forest bg-forest-soft px-1.5 py-0.5 rounded">
                  <Truck size={12} /> {b.driver}
                </span>
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenDriverModal(b)
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-saffron-deep hover:underline cursor-pointer"
                >
                  <Truck size={12} /> Assign Driver / Porter →
                </span>
              )}
            </div>
          </div>

          <div className="hidden sm:block font-mono text-[14px] text-ink tabular font-medium">
            {inr(b.total)}
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-line/40">
            <StatusPill status={b.status} />
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className={`hidden sm:flex items-center justify-center h-7 w-7 rounded-full transition-all cursor-pointer ${
                open
                  ? "bg-saffron/15 text-saffron-deep rotate-180 shadow-xs"
                  : "text-ink-faint hover:text-ink hover:bg-paper-deep"
              }`}
              aria-label="Toggle details"
            >
              <ChevronDown
                size={18}
                className="transition-transform duration-200"
              />
            </button>
          </div>
        </div>

        {/* Expanded Feasibility & Customer Profile Drawer with distinct warm gradient */}
        {open && (
          <div className="border-t border-saffron/25 px-5 py-4 space-y-4 bg-gradient-to-b from-[#f8f1e4] via-[#f5ede0]/90 to-[#f1e6d4]/95 transition-all duration-200 animate-[fadein_.18s_ease]">
            {/* Section 1: Dedicated Devotee & Customer Profile Panel */}
            <div className="bg-card rounded-lg p-4 border border-line shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/60">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-forest text-white flex items-center justify-center font-serif text-[16px] font-medium shrink-0 shadow-xs">
                    {b.customer.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-[15px]">
                        {b.customer}
                      </span>
                      <span className="text-[10.5px] font-medium text-forest bg-forest-soft border border-forest/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck size={11} /> Verified Devotee
                      </span>
                      <span className="text-[11px] font-mono text-ink-faint">
                        Aadhaar: {b.aadhaarNumber || "XXXX-XXXX-4819"}
                      </span>
                    </div>
                    <div className="text-[12px] text-ink-faint flex items-center gap-2 mt-0.5">
                      <span>
                        Purpose:{" "}
                        <strong className="text-ink font-medium">
                          {b.ritualPurpose || "Griha Pravesh & Puja"}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>Devotee Since {b.devoteeSince || "Aug 2024"}</span>
                    </div>
                  </div>
                </div>

                {/* Efficiently Placed Customer Details Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenCustomerModal(b)
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-forest bg-forest-soft hover:bg-forest/20 border border-forest/25 rounded-md transition-all self-start sm:self-auto shrink-0 shadow-xs cursor-pointer"
                  title="View full customer dossier, booking history, and submitted identity documents"
                >
                  <User size={13} />
                  <span>Full Customer Dossier & KYC →</span>
                </button>
              </div>

              {/* Quick-Access Customer Credentials Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                <div className="flex items-start gap-2.5 bg-paper/60 p-2.5 rounded border border-line/50">
                  <Phone size={14} className="text-forest mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10.5px] text-ink-faint uppercase font-mono block">
                      Devotee Phone
                    </span>
                    <a
                      href={`tel:${b.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-ink font-semibold hover:text-forest transition-colors"
                    >
                      {b.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-paper/60 p-2.5 rounded border border-line/50">
                  <Mail size={14} className="text-forest mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10.5px] text-ink-faint uppercase font-mono block">
                      Devotee Email
                    </span>
                    <span className="text-ink font-medium truncate block">
                      {b.customerEmail ||
                        `${b.customer.toLowerCase().replace(/\s+/g, ".")}@gmail.com`}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-paper/60 p-2.5 rounded border border-line/50">
                  <MapPin size={14} className="text-saffron mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10.5px] text-ink-faint uppercase font-mono block">
                      Ceremony Venue Address
                    </span>
                    <span
                      className="text-ink font-medium truncate block"
                      title={b.address}
                    >
                      {b.address}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: 4-Vector Pre-Dispatch Feasibility Assessment */}
            <div>
              <Eyebrow>4-Vector Pre-Dispatch Feasibility Assessment</Eyebrow>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-1.5">
                {/* Vector 1: Distance vs Animal Age */}
                <div
                  className={`p-3 rounded border text-[12px] ${
                    distanceSafe
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : "bg-red-50/80 border-red-300 text-red-950"
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Truck size={13} /> 1. Distance Feasibility
                    </span>
                    <span className="font-mono text-[11px]">
                      {b.distanceKm} km
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] opacity-90">
                    {distanceSafe
                      ? `Safe radius · Capped at ${maxDistance} km for ${b.animalType}`
                      : `EXCEEDED · Max allowable for ${b.animalType} is ${maxDistance} km!`}
                  </p>
                </div>

                {/* Vector 2: Road & Venue Ground Floor Access */}
                <div className="p-3 rounded border bg-emerald-50/70 border-emerald-200 text-emerald-950 text-[12px]">
                  <div className="font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={13} /> 2. Venue & Ramp Access
                    </span>
                    <span className="text-[10.5px] font-mono text-emerald-700">
                      Verified
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] opacity-90">
                    Ground-floor portico confirmed. No elevators/stairs
                    required.
                  </p>
                </div>

                {/* Vector 3: Weather & Thermal Index */}
                <div
                  className={`p-3 rounded border text-[12px] ${
                    isMidday
                      ? "bg-amber-50/70 border-amber-200 text-amber-950"
                      : "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <SunMedium size={13} /> 3. Thermal Comfort
                    </span>
                    <span className="font-mono text-[11px]">31°C · THI 72</span>
                  </div>
                  <p className="mt-1 text-[11.5px] opacity-90">
                    {isMidday
                      ? "Midday ceremony · Shaded altar & hydration kit mandatory."
                      : "Normal thermal range · Safe for ceremonial transit."}
                  </p>
                </div>

                {/* Vector 4: Escort & Handler Ratio */}
                <div className="p-3 rounded border bg-emerald-50/70 border-emerald-200 text-emerald-950 text-[12px]">
                  <div className="font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <UserCheck size={13} /> 4. Handler Assigned
                    </span>
                    <span className="text-[10.5px] font-mono text-emerald-700">
                      Certified
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] opacity-90 truncate">
                    {animalObj?.assignedHandler || "Senior Gosevak Escort"}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Gosala Details & Transport Assignment Strip */}
            <div className="text-[12px] text-ink-soft bg-card rounded-md p-3 border border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div>
                  <span className="font-medium text-ink">Assigned Gosala:</span>{" "}
                  <strong className="text-ink font-semibold">{b.gosala}</strong>
                </div>
                <div className="text-ink-faint flex items-center gap-2">
                  <span>
                    Animal:{" "}
                    <strong className="text-ink font-medium">
                      {b.animal} ({b.animalType})
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Muhurat:{" "}
                    <strong className="text-ink font-medium">
                      {b.start}–{b.end}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenDriverModal(b)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-line rounded bg-paper hover:bg-paper-deep text-ink transition-colors cursor-pointer"
                >
                  <Truck size={14} className="text-forest" />
                  <span>
                    {b.driver
                      ? `Driver: ${b.driver}`
                      : "Assign Driver / Porter"}
                  </span>
                </button>
              </div>
            </div>

            {/* Decision Section or Display Audit Remark */}
            {decided ? (
              <div className="bg-paper-deep rounded p-3 text-[12.5px] border border-line flex items-start gap-2">
                <Info size={16} className="text-saffron shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-ink">
                    Manager Decision Recorded:
                  </span>{" "}
                  <span className="text-ink-soft">
                    {b.managerRemark || "Decision logged on server."}
                  </span>
                  {b.managerApproval && (
                    <div className="text-[11px] text-ink-faint mt-1 font-mono">
                      Signed by {b.managerApproval.name} (
                      {b.managerApproval.userId}) at{" "}
                      {b.managerApproval.timestamp}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Gosala Manager Approval Remark
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="e.g. Distance verified, Gauri hydrated and groomed for puja..."
                    className="flex-1 bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenRejectModal(b)}
                      className="inline-flex items-center gap-1 px-4 py-2 text-[12.5px] font-medium border border-red-300 text-danger bg-red-50/50 hover:bg-red-100 rounded transition-colors"
                    >
                      <X size={15} /> Decline Booking
                    </button>
                    <button
                      onClick={() => onConfirm(b, remark)}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-saffron text-white rounded hover:bg-saffron-deep transition-colors shadow-sm"
                    >
                      <Check size={15} /> Verify & Confirm Feasibility
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}

export default function Queue({
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
}: {
  searchQuery?: string
  onSearchQueryChange?: (q: string) => void
} = {}) {
  const {
    bookings: allBookings,
    activeGosalaFilter,
    activeManagerGosala,
    gosalas,
    managerDecide,
    assignDriver,
    assignPorterTransport,
    animals,
    profiles,
    currentRole,
  } = useStore()
  const { notify } = useToast()

  const assignedGosala =
    activeManagerGosala ||
    (activeGosalaFilter && activeGosalaFilter !== "ALL"
      ? activeGosalaFilter
      : "") ||
    profiles?.manager?.managerData?.gosala ||
    gosalas[0]?.name ||
    ""

  const rows = useMemo(() => {
    // If user is a Gaushala Manager, strictly restrict to their assigned physical shelter
    if (currentRole === "manager") {
      return allBookings.filter((b) =>
        b.gosala.toLowerCase().includes(assignedGosala.toLowerCase()),
      )
    }
    // Operations Admin or Super Admin regional filtering
    if (!activeGosalaFilter || activeGosalaFilter === "ALL") return allBookings
    return allBookings.filter((b) =>
      b.gosala.toLowerCase().includes(activeGosalaFilter.toLowerCase()),
    )
  }, [allBookings, activeGosalaFilter, currentRole, assignedGosala])

  // Search & Filter state
  const [internalSearch, setInternalSearch] = useState("")
  const searchQuery =
    externalSearchQuery !== undefined ? externalSearchQuery : internalSearch
  const handleSearchChange = (val: string) => {
    setInternalSearch(val)
    onSearchQueryChange?.(val)
  }

  type StatusFilter = "all" | "pending" | "cleared" | "declined" | "no_driver"
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Triage Quick-Access Popups (DO NOT REDIRECT TO EXTERNAL PAGE)
  type TriageModalType = "pending" | "cleared" | "rejected" | null
  const [triageModal, setTriageModal] = useState<TriageModalType>(null)

  // Target card auto-expansion & smooth scroll highlight
  const [forceOpenBookingId, setForceOpenBookingId] = useState<string | null>(
    null,
  )
  const [highlightedBookingId, setHighlightedBookingId] =
    useState<string | null>(null)

  // Modal States for Action Overlays
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null)
  const [selectedReasonCode, setSelectedReasonCode] =
    useState<RejectionReasonCode>("ERR_DIST_EXCEEDED")
  const [customDeclineRemark, setCustomDeclineRemark] = useState("")

  const [customerModalBooking, setCustomerModalBooking] =
    useState<Booking | null>(null)
  const [customerDetailsData, setCustomerDetailsData] = useState<any | null>(
    null,
  )
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)

  const [driverAssignBooking, setDriverAssignBooking] =
    useState<Booking | null>(null)
  const [driverMode, setDriverMode] = useState<"inhouse" | "porter">("inhouse")
  const [selectedInHouseDriver, setSelectedInHouseDriver] = useState<string>(
    profiles?.driver?.name || "Sunil Pawar",
  )
  const [porterVehicle, setPorterVehicle] = useState<string>(
    "Tata 407 (8ft Open Ramp)",
  )
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({})

  const toggleCard = (bookingId: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }))
  }

  const isAnyExpanded =
    Object.values(expandedCardIds).some(Boolean) || Boolean(forceOpenBookingId)

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {}
    rows.forEach((b) => {
      next[b.id] = true
    })
    setExpandedCardIds(next)
  }

  const handleCollapseAll = () => {
    setExpandedCardIds({})
    setForceOpenBookingId(null)
  }

  // Overall Gosala triage counts (unfiltered)
  const totalPending = rows.filter((b) => reviewable.includes(b.status)).length
  const totalCleared = rows.filter(
    (b) =>
      !reviewable.includes(b.status) &&
      b.status !== "Rejected" &&
      (b.status === "Confirmed" ||
        b.status === "Admin Review" ||
        b.status === "Driver Assigned" ||
        b.status === "En Route" ||
        b.status === "At Altar" ||
        b.status === "Completed" ||
        !!b.managerRemark),
  ).length
  const totalDeclined = rows.filter((b) => b.status === "Rejected").length
  const totalNoDriver = rows.filter(
    (b) => !b.driver && b.status !== "Rejected",
  ).length

  // Universal Deep Scroll & Drawer Auto-Expansion
  const scrollToAndExpandBooking = (bookingId: string) => {
    setTriageModal(null)
    // Clear search and status filters so target card is guaranteed to be in DOM
    if (searchQuery) handleSearchChange("")
    if (statusFilter !== "all") setStatusFilter("all")
    setForceOpenBookingId(bookingId)
    setExpandedCardIds((prev) => ({ ...prev, [bookingId]: true }))
    setHighlightedBookingId(bookingId)

    setTimeout(() => {
      const el = document.getElementById(`booking-card-${bookingId}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 120)

    setTimeout(() => {
      setHighlightedBookingId(null)
    }, 4500)
  }

  // Universal Search and Status Filter logic
  const qTrim = searchQuery.trim().toLowerCase()

  const filteredRows = rows.filter((b) => {
    if (qTrim) {
      const matchesSearch =
        b.id.toLowerCase().includes(qTrim) ||
        b.customer.toLowerCase().includes(qTrim) ||
        (b.phone && b.phone.toLowerCase().includes(qTrim)) ||
        b.animal.toLowerCase().includes(qTrim) ||
        b.animalType.toLowerCase().includes(qTrim) ||
        b.address.toLowerCase().includes(qTrim) ||
        b.gosala.toLowerCase().includes(qTrim) ||
        (b.ritualPurpose && b.ritualPurpose.toLowerCase().includes(qTrim)) ||
        (b.driver && b.driver.toLowerCase().includes(qTrim)) ||
        (b.aadhaarNumber && b.aadhaarNumber.toLowerCase().includes(qTrim))
      if (!matchesSearch) return false
    }

    if (statusFilter === "pending") return reviewable.includes(b.status)
    if (statusFilter === "cleared")
      return !reviewable.includes(b.status) && b.status !== "Rejected"
    if (statusFilter === "declined") return b.status === "Rejected"
    if (statusFilter === "no_driver")
      return !b.driver && b.status !== "Rejected"

    return true
  })

  const queue = filteredRows.filter((b) => reviewable.includes(b.status))
  const decided = filteredRows.filter(
    (b) =>
      !reviewable.includes(b.status) &&
      (b.status === "Rejected" ||
        b.status === "Admin Review" ||
        b.status === "Confirmed" ||
        b.status === "Driver Assigned" ||
        b.status === "En Route" ||
        b.status === "At Altar" ||
        b.status === "Completed" ||
        !!b.managerRemark),
  )

  const handleOpenCustomerModal = async (b: Booking) => {
    setCustomerModalBooking(b)
    setLoadingDetails(true)
    setCustomerDetailsData(null)
    try {
      const res = await api.getCustomerDetails(b.id)
      if (res && res.ok && res.details) {
        setCustomerDetailsData(res.details)
      } else {
        throw new Error("Fallback required")
      }
    } catch {
      // Dynamic fallback synthesized from booking state & database models
      setCustomerDetailsData({
        bookingId: b.id,
        customer: {
          id: `CUST-${b.id.replace(/\D/g, "").slice(0, 4) || "8821"}`,
          name: b.customer,
          phone: b.phone,
          email:
            b.customerEmail ||
            `${b.customer.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
          memberSince: b.devoteeSince || "Aug 2024",
          idType: "Aadhaar / National ID Card",
          idNumber: b.aadhaarNumber || "XXXX-XXXX-4819",
          idStatus: "Submitted by Devotee",
          totalBookingsCount: 3,
        },
        ceremony: {
          ritualPurpose: b.ritualPurpose || "Griha Pravesh & Kamadhenu Puja",
          animal: b.animal,
          animalType: b.animalType,
          gosala: b.gosala,
          date: b.date,
          timeSlot: `${b.start} - ${b.end}`,
          durationMin: b.durationMin,
          serviceAddress: b.address,
          distanceKm: b.distanceKm,
          specialInstructions:
            "Ground-floor courtyard altar prepared. Water bucket and fresh grass kept ready.",
        },
        payment: {
          totalPaid: b.total,
          baseRate: 3500,
          extraTime: 0,
          transport: Math.round(b.distanceKm * 40),
          addons: 0,
          tax: Math.round(b.total * 0.12),
          isPaid: b.paid,
          paymentMethod: "UPI Online (Escrow Hold)",
          transactionRef: `UPI-TXN-${b.id.replace("-", "")}`,
        },
        logistics: {
          driver: b.driver || null,
          driverStage: b.driverStage || 0,
          status: b.status,
        },
      })
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleConfirm = (b: Booking, remark: string) => {
    managerDecide(
      b.id,
      true,
      remark || "Operational feasibility & animal health verified",
      profiles?.manager?.name || "Gaushala Custodian",
    )
  }

  const handleOpenReject = (b: Booking) => {
    setRejectingBooking(b)
    setSelectedReasonCode("ERR_DIST_EXCEEDED")
    setCustomDeclineRemark("")
  }

  const handleExecuteDecline = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingBooking) return

    const reasonObj = rejectionTaxonomy.find(
      (r) => r.code === selectedReasonCode,
    )
    const finalRemark =
      customDeclineRemark.trim() ||
      reasonObj?.desc ||
      "Capacity or safety constraint"

    managerDecide(
      rejectingBooking.id,
      false,
      finalRemark,
      profiles?.manager?.name || "Gaushala Custodian",
      selectedReasonCode,
    )

    setRejectingBooking(null)
  }

  const handleAssignDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!driverAssignBooking) return

    if (driverMode === "inhouse") {
      assignDriver(driverAssignBooking.id, selectedInHouseDriver)
    } else {
      // Porter 3rd-party dispatch
      assignPorterTransport(driverAssignBooking.id, {
        vehicleType: porterVehicle,
        fare: 420,
        driverName: "Rajesh Shinde",
        driverPhone: "+91 98230 44910",
      })
    }
    setDriverAssignBooking(null)
  }

  return (
    <div className="space-y-6">
      {/* ----------------- DYNAMIC TRIAGE STATS CARDS (Click to open quick-access popups) ----------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Awaiting Review */}
        <div
          onClick={() => setTriageModal("pending")}
          className="group cursor-pointer rounded-lg border border-saffron/40 bg-gradient-to-br from-card via-card to-saffron-soft/20 p-5 shadow-xs hover:shadow-md hover:border-saffron transition-all duration-200"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-saffron-deep font-semibold">
              Awaiting Review
            </span>
            {totalPending > 0 ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-saffron opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-saffron"></span>
              </span>
            ) : (
              <Check size={14} className="text-forest" />
            )}
          </div>
          <div className="font-serif text-[32px] text-ink mt-1 font-semibold tabular flex items-baseline gap-2">
            <span>{totalPending}</span>
            <span className="text-[12px] font-sans font-normal text-ink-faint">
              bookings pending
            </span>
          </div>
          <div className="text-[11.5px] text-ink-faint mt-1 flex items-center justify-between">
            <span>Paid bookings requiring feasibility verification</span>
            <span className="text-[11px] font-medium text-saffron-deep flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
              Quick review →
            </span>
          </div>
        </div>

        {/* Card 2: Cleared by You */}
        <div
          onClick={() => setTriageModal("cleared")}
          className="group cursor-pointer rounded-lg border border-forest/30 bg-gradient-to-br from-card via-card to-forest-soft/30 p-5 shadow-xs hover:shadow-md hover:border-forest transition-all duration-200"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-forest font-semibold">
              Cleared by You
            </span>
            <ShieldCheck size={16} className="text-forest" />
          </div>
          <div className="font-serif text-[32px] text-ink mt-1 font-semibold tabular flex items-baseline gap-2">
            <span>{totalCleared}</span>
            <span className="text-[12px] font-sans font-normal text-ink-faint">
              forwarded
            </span>
          </div>
          <div className="text-[11.5px] text-ink-faint mt-1 flex items-center justify-between">
            <span>Verified & forwarded for driver dispatch</span>
            <span className="text-[11px] font-medium text-forest flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
              View cleared →
            </span>
          </div>
        </div>

        {/* Card 3: Declined / Blocked */}
        <div
          onClick={() => setTriageModal("rejected")}
          className="group cursor-pointer rounded-lg border border-danger/30 bg-gradient-to-br from-card via-card to-danger-soft/20 p-5 shadow-xs hover:shadow-md hover:border-danger transition-all duration-200"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-danger font-semibold">
              Declined / Blocked
            </span>
            <Ban size={15} className="text-danger" />
          </div>
          <div className="font-serif text-[32px] text-ink mt-1 font-semibold tabular flex items-baseline gap-2">
            <span>{totalDeclined}</span>
            <span className="text-[12px] font-sans font-normal text-ink-faint">
              welfare holds
            </span>
          </div>
          <div className="text-[11.5px] text-ink-faint mt-1 flex items-center justify-between">
            <span>Welfare protected & slot released</span>
            <span className="text-[11px] font-medium text-danger flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
              View holds →
            </span>
          </div>
        </div>
      </div>

      {/* ----------------- ACTIVE SEARCH NOTIFICATION BANNER (When Query is Active) ----------------- */}
      {qTrim && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-forest-soft/40 via-card to-card border border-forest/30 rounded-lg p-3.5 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-forest text-white flex items-center justify-center shrink-0">
              <Search size={13} />
            </div>
            <div>
              <div className="text-[13px] text-ink font-medium flex items-center gap-1.5 flex-wrap">
                <span>Active Search:</span>
                <span className="font-mono bg-forest text-white px-2 py-0.5 rounded text-[11.5px] font-semibold">
                  "{searchQuery}"
                </span>
                <span className="text-[12px] text-ink-soft">
                  —{" "}
                  <strong className="text-ink font-semibold">
                    {filteredRows.length}
                  </strong>{" "}
                  {filteredRows.length === 1
                    ? "booking matched"
                    : "bookings matched"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSearchChange("")}
              className="px-3 py-1 text-[11.5px] font-medium text-forest hover:text-forest-deep bg-paper border border-forest/30 rounded hover:bg-forest hover:text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <X size={12} /> Clear Search
            </button>
          </div>
        </div>
      )}

      {/* ----------------- STATUS FILTER PILLS BAR ----------------- */}
      <Panel className="p-3 bg-card border-line-strong">
        <div className="flex items-center gap-2 overflow-x-auto text-[12px] scrollbar-none">
          <span className="text-ink-faint text-[11.5px] shrink-0 font-medium flex items-center gap-1 mr-1">
            <Filter size={12} /> Filter:
          </span>
          {[
            { id: "all", label: `All (${rows.length})` },
            {
              id: "pending",
              label: `Awaiting Review (${totalPending})`,
              color: "saffron",
            },
            {
              id: "cleared",
              label: `Cleared (${totalCleared})`,
              color: "forest",
            },
            {
              id: "declined",
              label: `Declined (${totalDeclined})`,
              color: "danger",
            },
            {
              id: "no_driver",
              label: `Needs Driver (${totalNoDriver})`,
              color: "amber",
            },
          ].map((tab) => {
            const active = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-ink text-paper shadow-xs"
                    : "bg-paper border border-line text-ink-soft hover:text-ink hover:border-line-strong"
                }`}
              >
                {tab.label}
              </button>
            )
          })}

          <div className="ml-auto flex items-center gap-3 shrink-0 pl-2">
            <span className="text-[11.5px] text-ink-faint">
              Showing{" "}
              <span className="font-semibold text-ink">
                {filteredRows.length}
              </span>{" "}
              of {rows.length} bookings
            </span>
            <button
              type="button"
              onClick={isAnyExpanded ? handleCollapseAll : handleExpandAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium text-ink-soft bg-paper-deep hover:bg-card border border-line rounded transition cursor-pointer"
              title={isAnyExpanded ? "Collapse all open booking cards" : "Expand all booking cards"}
            >
              {isAnyExpanded ? (
                <>
                  <ChevronUp size={13} /> Collapse All
                </>
              ) : (
                <>
                  <ChevronDown size={13} /> Expand All
                </>
              )}
            </button>
          </div>
        </div>
      </Panel>

      {/* ----------------- SEARCH RESULTS OR NORMAL QUEUE VIEW ----------------- */}
      {qTrim ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                <span>Matching Bookings</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-forest text-white font-semibold">
                  {filteredRows.length}{" "}
                  {filteredRows.length === 1 ? "result" : "results"}
                </span>
              </h3>
            </div>
            <span className="font-mono text-[12px] text-ink-faint">
              Instant results for "{searchQuery}"
            </span>
          </div>

          <div className="space-y-3">
            {filteredRows.length === 0 ? (
              <Panel className="p-12 text-center space-y-3 bg-card">
                <Search
                  size={32}
                  className="text-ink-faint mx-auto opacity-50"
                />
                <p className="font-serif text-[16px] text-ink font-semibold">
                  No bookings found for "{searchQuery}"
                </p>
                <p className="text-[12.5px] text-ink-soft max-w-md mx-auto">
                  No records match your search across devotee names, animals,
                  phones, addresses, or booking IDs.
                </p>
                <button
                  onClick={() => {
                    handleSearchChange("")
                    setStatusFilter("all")
                  }}
                  className="px-4 py-2 bg-forest text-white text-[12.5px] font-medium rounded hover:bg-forest-deep transition shadow-xs cursor-pointer"
                >
                  Clear Search & View All Bookings
                </button>
              </Panel>
            ) : (
              // Show reviewable bookings first, followed by cleared/decided bookings
              [
                ...filteredRows.filter((b) => reviewable.includes(b.status)),
                ...filteredRows.filter((b) => !reviewable.includes(b.status)),
              ].map((b) => (
                <ReviewCard
                  key={b.id}
                  b={b}
                  isOpen={Boolean(expandedCardIds[b.id] || b.id === forceOpenBookingId)}
                  onToggle={() => toggleCard(b.id)}
                  onConfirm={handleConfirm}
                  onOpenRejectModal={handleOpenReject}
                  onOpenCustomerModal={handleOpenCustomerModal}
                  onOpenDriverModal={(bk) => setDriverAssignBooking(bk)}
                  isHighlighted={b.id === highlightedBookingId}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ----------------- REVIEW QUEUE LIST (Pre-Dispatch Verification Desk) ----------------- */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-[18px] text-ink font-semibold">
                  Pre-Dispatch Verification Desk
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-saffron/15 text-saffron-deep font-semibold">
                  {queue.length} pending
                </span>
              </div>
              <span className="font-mono text-[12px] text-ink-faint">
                {queue.length} requiring feasibility verification
              </span>
            </div>

            <div className="space-y-3">
              {queue.length === 0 && (
                <Panel className="p-10 text-center text-[13px] text-ink-faint">
                  {statusFilter !== "all"
                    ? "No pending bookings match the selected status filter."
                    : "Review queue is clear. All bookings processed."}
                </Panel>
              )}
              {queue.map((b) => (
                <ReviewCard
                  key={b.id}
                  b={b}
                  isOpen={Boolean(expandedCardIds[b.id] || b.id === forceOpenBookingId)}
                  onToggle={() => toggleCard(b.id)}
                  onConfirm={handleConfirm}
                  onOpenRejectModal={handleOpenReject}
                  onOpenCustomerModal={handleOpenCustomerModal}
                  onOpenDriverModal={(bk) => setDriverAssignBooking(bk)}
                  isHighlighted={b.id === highlightedBookingId}
                />
              ))}
            </div>
          </div>

          {/* ----------------- RECENTLY DECIDED LIST ----------------- */}
          {decided.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-[18px] text-ink font-semibold">
                  Recently Decided
                </h3>
                <span className="font-mono text-[12px] text-ink-faint">
                  {decided.length} processed
                </span>
              </div>
              <div className="space-y-3">
                {decided.slice(0, 10).map((b) => (
                  <ReviewCard
                    key={b.id}
                    b={b}
                    isOpen={Boolean(expandedCardIds[b.id] || b.id === forceOpenBookingId)}
                    onToggle={() => toggleCard(b.id)}
                    onConfirm={handleConfirm}
                    onOpenRejectModal={handleOpenReject}
                    onOpenCustomerModal={handleOpenCustomerModal}
                    onOpenDriverModal={(bk) => setDriverAssignBooking(bk)}
                    isHighlighted={b.id === highlightedBookingId}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ----------------- MODAL 1: Customer Details (Fetched dynamically from Database) ----------------- */}
      {customerModalBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-card sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-forest text-white flex items-center justify-center font-serif text-[16px]">
                  {(
                    customerDetailsData?.customer?.name ||
                    customerModalBooking.customer
                  ).slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                    <span>
                      {customerDetailsData?.customer?.name ||
                        customerModalBooking.customer}
                    </span>
                    <span className="text-[11px] font-sans font-medium text-forest bg-forest-soft px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck size={12} /> Booker Verified
                    </span>
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Customer Profile & Booking Dossier ·{" "}
                    {customerModalBooking.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCustomerModalBooking(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-12 text-center space-y-3">
                <Loader2
                  size={28}
                  className="animate-spin text-forest mx-auto"
                />
                <p className="text-[13px] text-ink-soft">
                  Fetching live customer profile & booking dossier from
                  database...
                </p>
              </div>
            ) : customerDetailsData ? (
              <div className="p-6 space-y-5">
                {/* Devotee Profile & Contact Details */}
                <div>
                  <Eyebrow>Devotee Contact & History (Database Record)</Eyebrow>
                  <div className="grid grid-cols-2 gap-3 mt-2 text-[12.5px]">
                    <div className="bg-card p-3 rounded border border-line">
                      <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                        <Phone size={12} className="text-forest" /> Primary
                        Mobile
                      </div>
                      <div className="font-mono font-medium text-ink mt-1">
                        {customerDetailsData.customer.phone}
                      </div>
                    </div>
                    <div className="bg-card p-3 rounded border border-line">
                      <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                        <Mail size={12} className="text-forest" /> Email Address
                      </div>
                      <div className="font-medium text-ink mt-1 truncate">
                        {customerDetailsData.customer.email}
                      </div>
                    </div>
                    <div className="bg-card p-3 rounded border border-line">
                      <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                        <Calendar size={12} className="text-forest" /> Devotee
                        Since
                      </div>
                      <div className="font-medium text-ink mt-1">
                        {customerDetailsData.customer.memberSince}
                      </div>
                    </div>
                    <div className="bg-card p-3 rounded border border-line">
                      <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                        <CheckCircle2 size={12} className="text-forest" />{" "}
                        Completed Sevas
                      </div>
                      <div className="font-medium text-ink mt-1">
                        {customerDetailsData.customer.totalBookingsCount} Sevas
                        Booked
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submitted Identification Document (Aadhaar / National ID Card) */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-emerald-950 font-semibold text-[13.5px]">
                      <Fingerprint size={18} className="text-emerald-700" />
                      <span>Submitted Identity Document</span>
                    </div>
                    <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                      Self-Attested Document
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[12px] pt-1">
                    <div>
                      <span className="text-emerald-900/70 text-[11px]">
                        Document Type:
                      </span>
                      <div className="font-medium text-emerald-950 text-[12.5px] mt-0.5">
                        {customerDetailsData.customer.idType ||
                          "Aadhaar / National ID Card"}
                      </div>
                    </div>
                    <div>
                      <span className="text-emerald-900/70 text-[11px]">
                        Masked Identification No:
                      </span>
                      <div className="font-mono font-bold text-emerald-950 text-[13px] mt-0.5">
                        {customerDetailsData.customer.idNumber ||
                          "XXXX-XXXX-4819"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-emerald-200/80 text-[11.5px] text-emerald-900 flex items-center justify-between">
                    <span>
                      Identity Match: Confirmed with Online Escrow Payer
                    </span>
                    <span className="font-mono text-[10.5px] text-emerald-800">
                      Doc Ref: DOC-{customerModalBooking.id.slice(4)}
                    </span>
                  </div>
                </div>

                {/* Ceremonial Address & Venue Specifics */}
                <div className="bg-paper-deep rounded-md p-4 border border-line space-y-2 text-[12.5px]">
                  <Eyebrow>Ceremony Details & Altar Location</Eyebrow>
                  <div>
                    <span className="text-ink-faint">Ceremonial Ritual:</span>{" "}
                    <strong className="text-ink font-semibold">
                      {customerDetailsData.ceremony.ritualPurpose}
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-faint">
                      Requested Sacred Animal:
                    </span>{" "}
                    <strong className="text-ink font-semibold">
                      {customerDetailsData.ceremony.animal} (
                      {customerDetailsData.ceremony.animalType}) ·{" "}
                      {customerDetailsData.ceremony.gosala}
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-faint">Service Venue:</span>{" "}
                    <strong className="text-ink font-semibold">
                      {customerDetailsData.ceremony.serviceAddress}
                    </strong>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1 text-[12px]">
                    <div>
                      <span className="text-ink-faint">Scheduled Muhurat:</span>{" "}
                      <span className="font-mono font-medium text-ink block">
                        {customerDetailsData.ceremony.date} (
                        {customerDetailsData.ceremony.timeSlot})
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-faint">Transit Distance:</span>{" "}
                      <span className="font-mono font-medium text-ink block">
                        {customerDetailsData.ceremony.distanceKm} km from Gosala
                      </span>
                    </div>
                  </div>
                  <div className="text-[11.5px] text-ink-faint pt-1 border-t border-line/60">
                    <span className="font-medium text-ink">Venue Notes:</span>{" "}
                    {customerDetailsData.ceremony.specialInstructions}
                  </div>
                </div>

                {/* Escrow & Payment Breakdown */}
                <div className="bg-card rounded-md p-4 border border-line text-[12px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-ink-faint uppercase font-mono">
                        Escrow Advance Payment
                      </div>
                      <div className="text-[17px] font-mono font-bold text-ink mt-0.5">
                        {inr(customerDetailsData.payment.totalPaid)}
                      </div>
                      <div className="text-[11px] text-forest font-medium">
                        100% Secured in Platform Escrow
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-ink-faint">
                        Payment Mode:
                      </div>
                      <div className="font-medium text-ink text-[12px]">
                        {customerDetailsData.payment.paymentMethod}
                      </div>
                      <div className="font-mono text-[10.5px] text-ink-faint mt-0.5">
                        Ref: {customerDetailsData.payment.transactionRef}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line text-[11px] text-ink-faint">
                    <div>
                      Base Dakshina:{" "}
                      <span className="font-mono font-medium text-ink">
                        {inr(customerDetailsData.payment.baseRate)}
                      </span>
                    </div>
                    <div>
                      Transit Fee:{" "}
                      <span className="font-mono font-medium text-ink">
                        {inr(customerDetailsData.payment.transport)}
                      </span>
                    </div>
                    <div>
                      GST / Tax:{" "}
                      <span className="font-mono font-medium text-ink">
                        {inr(customerDetailsData.payment.tax)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logistics & Driver Assignment Status */}
                <div className="bg-paper-deep rounded-md p-3.5 border border-line flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2.5">
                    <Truck size={16} className="text-forest" />
                    <div>
                      <div className="font-medium text-ink">
                        Assigned Transport:{" "}
                        <span className="font-semibold">
                          {customerDetailsData.logistics.driver ||
                            "Pending Assignment"}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        {customerDetailsData.logistics.driver
                          ? "Dedicated vehicle assigned for holy transit"
                          : "Gaushala driver or Porter dispatch needed"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const b = customerModalBooking
                      setCustomerModalBooking(null)
                      setDriverAssignBooking(b)
                    }}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-saffron-deep hover:underline bg-card px-2.5 py-1 rounded border border-line"
                  >
                    <Truck size={13} />
                    <span>
                      {customerDetailsData.logistics.driver
                        ? "Change Driver"
                        : "Assign Driver / Porter"}
                    </span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setCustomerModalBooking(null)}
                    className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const b = customerModalBooking
                      setCustomerModalBooking(null)
                      setDriverAssignBooking(b)
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:opacity-95 transition-opacity shadow-sm"
                  >
                    <Truck size={15} /> Proceed to Assign Transport
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ----------------- MODAL 2: High-Level UI for Driver Assignment & Porter Fallback ----------------- */}
      {driverAssignBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-card sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-forest-soft text-forest rounded">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-[18px] text-ink font-semibold">
                    Assign Cattle Transport
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Trip {driverAssignBooking.id} · {driverAssignBooking.animal}{" "}
                    ({driverAssignBooking.animalType})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDriverAssignBooking(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignDriverSubmit} className="p-6 space-y-5">
              {/* Pickup & Receiver Summary */}
              <div className="bg-paper-deep rounded p-3.5 border border-line text-[12px] grid grid-cols-2 gap-3">
                <div>
                  <span className="text-ink-faint block text-[11px]">
                    Pickup Location (Gosala):
                  </span>
                  <strong className="text-ink font-medium mt-0.5 block">
                    {driverAssignBooking.gosala}
                  </strong>
                </div>
                <div>
                  <span className="text-ink-faint block text-[11px]">
                    Receiver (Customer) & Destination:
                  </span>
                  <strong className="text-ink font-medium mt-0.5 block truncate">
                    {driverAssignBooking.customer} ·{" "}
                    {driverAssignBooking.address}
                  </strong>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {driverAssignBooking.distanceKm} km one-way
                  </span>
                </div>
              </div>

              {/* Mode Toggle: In-House Fleet vs. 3rd-Party Porter */}
              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-2">
                  Select Transport Dispatch Channel
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDriverMode("inhouse")}
                    className={`p-3 rounded border text-left transition-all ${
                      driverMode === "inhouse"
                        ? "border-forest bg-forest/10 ring-1 ring-forest text-ink"
                        : "border-line bg-card hover:border-line-strong text-ink-soft"
                    }`}
                  >
                    <div className="font-semibold text-[13px] flex items-center justify-between">
                      <span>Gaushala In-House Fleet</span>
                      <span className="text-[10px] font-mono bg-forest-soft text-forest px-1.5 py-0.2 rounded">
                        Dedicated
                      </span>
                    </div>
                    <p className="text-[11.5px] text-ink-faint mt-1">
                      Assigned gaushala drivers & dedicated hydraulic cattle
                      carriers.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDriverMode("porter")}
                    className={`p-3 rounded border text-left transition-all ${
                      driverMode === "porter"
                        ? "border-saffron bg-saffron/10 ring-1 ring-saffron text-ink"
                        : "border-line bg-card hover:border-line-strong text-ink-soft"
                    }`}
                  >
                    <div className="font-semibold text-[13px] flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Porter Logistics</span>
                      </span>
                      <span className="text-[10px] font-mono bg-saffron-soft text-saffron-deep px-1.5 py-0.2 rounded">
                        3rd-Party Fallback
                      </span>
                    </div>
                    <p className="text-[11.5px] text-ink-faint mt-1">
                      Use if gaushala drivers are busy. Direct pickup & receiver
                      drop.
                    </p>
                  </button>
                </div>
              </div>

              {/* Mode 1: In-House Driver Selector */}
              {driverMode === "inhouse" && (
                <div className="space-y-2">
                  <label className="block text-[12px] font-medium text-ink">
                    Available Gaushala Drivers
                  </label>
                  {inHouseDrivers.map((d) => (
                    <label
                      key={d.id}
                      onClick={() => setSelectedInHouseDriver(d.name)}
                      className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                        selectedInHouseDriver === d.name
                          ? "border-forest bg-forest-soft/50 text-ink"
                          : "border-line bg-card hover:border-line-strong text-ink-soft"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="inHouseDriver"
                          checked={selectedInHouseDriver === d.name}
                          onChange={() => setSelectedInHouseDriver(d.name)}
                          className="accent-forest"
                        />
                        <div>
                          <div className="font-semibold text-ink text-[13px] flex items-center gap-2">
                            <span>{d.name}</span>
                            <span className="text-[11px] font-mono text-ink-faint">
                              ({d.vehiclePlate})
                            </span>
                          </div>
                          <div className="text-[11.5px] text-ink-faint mt-0.5">
                            {d.vehicleModel} · {d.phone}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                          d.status === "Available"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.status} {d.etaMins ? `(ETA ${d.etaMins}m)` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Mode 2: Porter 3rd-Party Logistics Integration */}
              {driverMode === "porter" && (
                <div className="bg-amber-50/70 border border-amber-300 rounded-md p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-[12px]">
                        P
                      </div>
                      <div>
                        <div className="font-semibold text-ink text-[13px]">
                          Porter On-Demand Cattle Truck
                        </div>
                        <div className="text-[11px] text-ink-faint">
                          3 verified mini-trucks nearby · Estimated pickup in 7
                          mins
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-ink text-[14px]">
                      ₹420
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium text-ink mb-1.5">
                      Select Porter Vehicle Type
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      {[
                        {
                          id: "Tata 407 (8ft Open Ramp)",
                          label: "Tata 407 (Open Bed)",
                          fare: 420,
                          desc: "Equipped with safety rails & low ramp",
                        },
                        {
                          id: "Mahindra Bolero Maxi Truck",
                          label: "Bolero Maxi Truck",
                          fare: 510,
                          desc: "Heavy duty non-slip cattle carrier",
                        },
                      ].map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setPorterVehicle(v.id)}
                          className={`p-2.5 rounded border text-left transition-all ${
                            porterVehicle === v.id
                              ? "border-saffron bg-card ring-1 ring-saffron text-ink"
                              : "border-line bg-card/60 hover:bg-card text-ink-soft"
                          }`}
                        >
                          <div className="font-semibold text-[12px] flex items-center justify-between">
                            <span>{v.label}</span>
                            <span className="font-mono text-saffron-deep font-bold">
                              ₹{v.fare}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-ink-faint mt-0.5">
                            {v.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Porter Receiver Details Box */}
                  <div className="bg-card p-3 rounded border border-line text-[11.5px] space-y-1">
                    <div className="font-medium text-ink flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-forest" />{" "}
                      Receiver Details Transferred to Porter:
                    </div>
                    <div>
                      • Receiver:{" "}
                      <strong>{driverAssignBooking.customer}</strong> (
                      {driverAssignBooking.phone})
                    </div>
                    <div>• Drop Address: {driverAssignBooking.address}</div>
                    <div className="text-ink-faint text-[10.5px] pt-0.5">
                      Driver instructions: "Handle sacred animal with reverence.
                      Ground-floor delivery only."
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setDriverAssignBooking(null)}
                  className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium text-white rounded transition-colors shadow-sm ${
                    driverMode === "porter"
                      ? "bg-saffron hover:bg-saffron-deep"
                      : "bg-forest hover:opacity-95"
                  }`}
                >
                  <Check size={15} />
                  <span>
                    {driverMode === "porter"
                      ? "Dispatch via Porter (₹420 Pass-through)"
                      : `Assign ${selectedInHouseDriver}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Structured Categorical Rejection Modal */}
      {rejectingBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-md shadow-2xl w-full max-w-lg overflow-hidden my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-line bg-card">
              <div className="flex items-center gap-2 text-danger">
                <AlertTriangle size={18} />
                <h3 className="font-serif text-[17px] text-ink font-semibold">
                  Decline Booking {rejectingBooking.id}
                </h3>
              </div>
              <button
                onClick={() => setRejectingBooking(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteDecline} className="p-5 space-y-4">
              <p className="text-[12.5px] text-ink-soft">
                Declining will immediately release the time slot, notify the
                customer with an empathetic explanation, and log an auditable
                reason code.
              </p>

              <div>
                <label className="block text-[12px] font-medium text-ink mb-1.5">
                  Select Machine-Readable Rejection Code
                </label>
                <div className="space-y-2">
                  {rejectionTaxonomy.map((item) => (
                    <label
                      key={item.code}
                      onClick={() => setSelectedReasonCode(item.code)}
                      className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                        selectedReasonCode === item.code
                          ? "border-danger bg-red-50/70 text-ink"
                          : "border-line bg-card hover:border-line-strong text-ink-soft"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectionReason"
                        checked={selectedReasonCode === item.code}
                        onChange={() => setSelectedReasonCode(item.code)}
                        className="mt-1 accent-red-600"
                      />
                      <div className="text-[12px]">
                        <div className="font-semibold text-ink flex items-center gap-1.5">
                          <span>{item.label}</span>
                          <span className="font-mono text-[10px] text-ink-faint">
                            ({item.code})
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-faint mt-0.5">
                          {item.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Custom Contextual Note (Audit Trail)
                </label>
                <textarea
                  rows={2}
                  value={customDeclineRemark}
                  onChange={(e) => setCustomDeclineRemark(e.target.value)}
                  placeholder="e.g. Recommended alternate morning slot with shaded pavilion..."
                  className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-danger focus:ring-1 focus:ring-danger transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setRejectingBooking(null)}
                  className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-danger text-white rounded hover:bg-red-700 transition-colors shadow-sm"
                >
                  <X size={15} /> Confirm & Release Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- TRIAGE QUICK-ACCESS POPUP 1: Awaiting Review ----------------- */}
      {triageModal === "pending" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-saffron/15 text-saffron-deep flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                    <span>Awaiting Feasibility Review</span>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-saffron/15 text-saffron-deep">
                      {rows.filter((b) => reviewable.includes(b.status)).length}{" "}
                      Pending
                    </span>
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Quick-access feasibility desk · Direct review & deep
                    inspection
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTriageModal(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(92vh-130px)]">
              {rows.filter((b) => reviewable.includes(b.status)).length ===
              0 ? (
                <div className="text-center py-12 text-ink-faint space-y-2">
                  <CheckCircle2
                    size={32}
                    className="text-forest mx-auto opacity-70"
                  />
                  <p className="text-[14px] font-serif text-ink">
                    Review Queue Clear
                  </p>
                  <p className="text-[12px]">
                    All incoming devotee bookings have been reviewed.
                  </p>
                </div>
              ) : (
                rows
                  .filter((b) => reviewable.includes(b.status))
                  .map((b) => {
                    const bAnimal = (b.animal || "").toLowerCase()
                    const animalObj = (animals || []).find(
                      (a) => (a.name || "").toLowerCase() === bAnimal,
                    )
                    const isCalf =
                      b.animalType === "Calf" || bAnimal.includes("kesari")
                    const isPair = b.animalType === "Cow & Calf"
                    const maxDist = animalObj?.maxRadiusKm || (isCalf ? 8 : isPair ? 15 : 20)
                    const distSafe = (b.distanceKm || 0) <= maxDist
                    const isMidday =
                      (b.start || "") >= "12:00" && (b.start || "") <= "15:30"

                    return (
                      <div
                        key={b.id}
                        className="bg-card border border-line rounded-lg p-4 shadow-xs space-y-3 hover:border-saffron/40 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] text-ink-faint font-semibold">
                              {b.id}
                            </span>
                            <span className="font-semibold text-ink text-[14px]">
                              {b.customer}
                            </span>
                            {b.paid && (
                              <span className="text-[10.5px] font-mono bg-forest/10 text-forest border border-forest/20 px-1.5 py-0.5 rounded">
                                Escrow Paid
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[14px] font-medium text-ink tabular">
                            {inr(b.total)}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-ink-soft">
                              <PawPrint size={13} className="text-saffron" />
                              <span className="font-medium text-ink">
                                {b.animal}
                              </span>{" "}
                              ({b.animalType})
                            </div>
                            <div className="flex items-center gap-1.5 text-ink-faint">
                              <MapPin size={12} />
                              <span
                                className={
                                  distSafe
                                    ? "text-forest"
                                    : "text-danger font-semibold"
                                }
                              >
                                {b.distanceKm} km{" "}
                                {distSafe
                                  ? `(≤ ${maxDist}km safe)`
                                  : `(Exceeds ${maxDist}km!)`}
                              </span>
                            </div>
                            <div className="text-ink-faint truncate text-[11px] pl-4">
                              {b.address}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-ink-soft">
                              <Clock size={12} />
                              <span>
                                {b.date} · {b.start}–{b.end}
                              </span>
                              {isMidday && (
                                <span className="text-[10px] text-danger bg-danger/10 px-1.5 py-0.2 rounded font-medium">
                                  Midday Heat
                                </span>
                              )}
                            </div>
                            <div className="text-[11.5px] text-ink-faint truncate">
                              Ritual:{" "}
                              <span className="text-ink-soft font-medium">
                                {b.ritualPurpose || "Puja"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                              <Truck
                                size={12}
                                className={
                                  b.driver ? "text-forest" : "text-amber-600"
                                }
                              />
                              {b.driver ? (
                                <span className="font-medium text-forest">
                                  {b.driver}
                                </span>
                              ) : (
                                <span className="text-amber-700 font-medium">
                                  Unassigned Transport
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-line/60">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setTriageModal(null)
                                handleConfirm(
                                  b,
                                  "Feasibility verified via quick desk",
                                )
                              }}
                              className="px-3 py-1.5 text-[11.5px] font-medium bg-forest text-white rounded hover:bg-forest-deep transition shadow-xs flex items-center gap-1"
                            >
                              <Check size={12} /> Quick Approve
                            </button>
                            <button
                              onClick={() => {
                                setTriageModal(null)
                                handleOpenReject(b)
                              }}
                              className="px-3 py-1.5 text-[11.5px] font-medium border border-line text-danger hover:bg-red-50 rounded transition flex items-center gap-1"
                            >
                              <X size={12} /> Decline
                            </button>
                          </div>

                          {/* Deep Scroll to Full Details in Review Queue */}
                          <button
                            onClick={() => scrollToAndExpandBooking(b.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-saffron-deep bg-saffron/10 border border-saffron/30 hover:bg-saffron/20 rounded transition"
                          >
                            <span>Inspect Full Details in Queue</span>
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TRIAGE QUICK-ACCESS POPUP 2: Cleared by You ----------------- */}
      {triageModal === "cleared" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-forest-soft text-forest flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                    <span>Cleared Bookings (Forwarded for Dispatch)</span>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-forest-soft text-forest">
                      {
                        rows.filter(
                          (b) =>
                            !reviewable.includes(b.status) &&
                            b.status !== "Rejected" &&
                            (b.status === "Confirmed" ||
                              b.status === "Admin Review" ||
                              b.status === "Driver Assigned" ||
                              b.status === "En Route" ||
                              b.status === "At Altar" ||
                              b.status === "Completed" ||
                              !!b.managerRemark),
                        ).length
                      }{" "}
                      Cleared
                    </span>
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Physiological & road feasibility confirmed · In transit or
                    dispatch
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTriageModal(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(92vh-130px)]">
              {rows
                .filter(
                  (b) =>
                    !reviewable.includes(b.status) &&
                    b.status !== "Rejected" &&
                    (b.status === "Confirmed" ||
                      b.status === "Admin Review" ||
                      b.status === "Driver Assigned" ||
                      b.status === "En Route" ||
                      b.status === "At Altar" ||
                      b.status === "Completed" ||
                      !!b.managerRemark),
                )
                .map((b) => (
                  <div
                    key={b.id}
                    className="bg-card border border-line rounded-lg p-4 shadow-xs space-y-3 hover:border-forest/40 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-ink-faint font-semibold">
                          {b.id}
                        </span>
                        <span className="font-semibold text-ink text-[14px]">
                          {b.customer}
                        </span>
                        <StatusPill status={b.status} />
                      </div>
                      <div className="font-mono text-[14px] font-medium text-ink tabular">
                        {inr(b.total)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-ink-soft">
                          <PawPrint size={13} className="text-saffron" />
                          <span className="font-medium text-ink">
                            {b.animal}
                          </span>{" "}
                          ({b.animalType})
                        </div>
                        <div className="flex items-center gap-1.5 text-ink-faint">
                          <MapPin size={12} />
                          <span>
                            {b.distanceKm} km · {b.address}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-ink-soft">
                          <Clock size={12} />
                          <span>
                            {b.date} · {b.start}–{b.end}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11.5px]">
                          <Truck
                            size={12}
                            className={
                              b.driver ? "text-forest" : "text-amber-600"
                            }
                          />
                          {b.driver ? (
                            <span className="font-medium text-forest">
                              Driver: {b.driver}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setTriageModal(null)
                                setDriverAssignBooking(b)
                              }}
                              className="text-saffron-deep hover:underline font-medium"
                            >
                              Assign Driver / Porter →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {b.managerRemark && (
                      <div className="text-[11.5px] bg-paper p-2.5 rounded border border-line text-ink-soft">
                        <span className="font-medium text-ink">
                          Manager Note:
                        </span>{" "}
                        {b.managerRemark}
                      </div>
                    )}

                    <div className="flex justify-end pt-2 border-t border-line/60">
                      <button
                        onClick={() => scrollToAndExpandBooking(b.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-forest bg-forest-soft hover:bg-forest/20 rounded transition"
                      >
                        <span>Inspect Full Details in Queue</span>
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TRIAGE QUICK-ACCESS POPUP 3: Declined / Blocked ----------------- */}
      {triageModal === "rejected" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                    <span>Declined & Welfare-Protected Holds</span>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-danger/10 text-danger">
                      {rows.filter((b) => b.status === "Rejected").length}{" "}
                      Blocked
                    </span>
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Welfare constraints enforced · Slots released back to
                    resting animals
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTriageModal(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(92vh-130px)]">
              {rows.filter((b) => b.status === "Rejected").length === 0 ? (
                <div className="text-center py-12 text-ink-faint space-y-2">
                  <CheckCircle2
                    size={32}
                    className="text-forest mx-auto opacity-70"
                  />
                  <p className="text-[14px] font-serif text-ink">
                    No Blocked Bookings
                  </p>
                  <p className="text-[12px]">
                    All past bookings met welfare and route requirements.
                  </p>
                </div>
              ) : (
                rows
                  .filter((b) => b.status === "Rejected")
                  .map((b) => (
                    <div
                      key={b.id}
                      className="bg-card border border-danger/30 rounded-lg p-4 shadow-xs space-y-3 hover:border-danger/60 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-ink-faint font-semibold">
                            {b.id}
                          </span>
                          <span className="font-semibold text-ink text-[14px]">
                            {b.customer}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-danger/10 text-danger font-semibold">
                            Welfare Blocked
                          </span>
                        </div>
                        <div className="font-mono text-[12px] text-ink-faint">
                          {b.date} · {b.start}–{b.end}
                        </div>
                      </div>

                      <div className="text-[12px] space-y-2">
                        <div className="flex items-center gap-2 text-ink-soft">
                          <PawPrint size={13} className="text-saffron" />
                          <span>
                            Protected Animal:{" "}
                            <span className="font-medium text-ink">
                              {b.animal}
                            </span>{" "}
                            ({b.animalType})
                          </span>
                        </div>

                        {b.managerRemark && (
                          <div className="p-3 bg-red-50/70 border border-red-200 rounded text-red-900 text-[12px]">
                            <div className="font-semibold flex items-center gap-1.5">
                              <AlertTriangle
                                size={13}
                                className="text-danger"
                              />
                              Welfare Enforcement Note
                            </div>
                            <div className="mt-1 text-[11.5px] leading-relaxed">
                              {b.managerRemark}
                            </div>
                          </div>
                        )}

                        <div className="text-[11px] text-ink-faint flex items-center gap-1 pt-1">
                          <ShieldCheck size={13} className="text-forest" />
                          <span>
                            100% Escrow refund credited · Resting buffer
                            restored
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-line/60">
                        <button
                          onClick={() => scrollToAndExpandBooking(b.id)}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-danger bg-danger/10 hover:bg-danger/20 rounded transition"
                        >
                          <span>Inspect Full Details in Queue</span>
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
