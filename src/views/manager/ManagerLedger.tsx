import { useState, useMemo } from "react"
import {
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  Building2,
  Receipt,
  Truck,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Filter,
  Check,
  FileText,
  Landmark,
  HeartHandshake,
  User,
  MapPin,
  Phone,
  Calendar,
  X,
  Printer,
  ExternalLink,
  ShieldAlert,
  ArrowDownRight,
  Coins,
  PawPrint,
} from "lucide-react"
import { inr, type Booking, type Settlement, inHouseDrivers } from "../../data/mock"
import type { Gosala } from "../../data/gosalas"
import { useStore, useToast } from "../../store/store"
import { Panel, PanelHead, Tag, Eyebrow } from "../../lib/ui"

type TopCategory = "gross" | "net" | "transport" | "platform" | null

interface SettlementBatch {
  id: string
  date: string
  sevasCount: number
  gross: number
  gaushalaNet: number
  utr: string
  bankName: string
  accountMasked: string
  status: "Settled" | "Processing" | "Scheduled"
}


export const getGaushalaBankDetails = (gName: string, gObj?: Gosala) => {
  if (gName === "ALL") {
    return {
      beneficiary: "GOMAA Central Nodal Gaushala Trust Escrow",
      bankName: "ICICI Nodal Trust Escrow · Bund Garden Branch, Pune",
      accountMasked: "•••• •••• 9901",
      ifsc: "ICIC0000005",
      regNo: "AWBI-MAH-PUN-CENTRAL-2026",
      cycle: "Every Sunday at 23:59 IST (Auto-Sweep)",
    }
  }

  const customBank = gObj?.customDetails?.find(cd => cd.key.toLowerCase().includes("bank"))?.value
  const customAcc = gObj?.customDetails?.find(cd => cd.key.toLowerCase().includes("account"))?.value
  const customIfsc = gObj?.customDetails?.find(cd => cd.key.toLowerCase().includes("ifsc"))?.value

  const gaushalaKey = gName.toLowerCase()
  if (gaushalaKey.includes("nandini")) {
    return {
      beneficiary: "Nandini Goseva Sadan Charitable Trust",
      bankName: customBank || "Bank of Maharashtra · Baner Branch, Pune",
      accountMasked: customAcc || "•••• •••• 7120",
      ifsc: customIfsc || "MAHB0000312",
      regNo: gObj?.trustRegistrationNo || "MAH-PUN-AWBI-0618",
      cycle: "Every Sunday at 23:59 IST",
    }
  }
  if (gaushalaKey.includes("gopal")) {
    return {
      beneficiary: "Gopal Gaushala Trust Public Trust",
      bankName: customBank || "State Bank of India · Kalyani Nagar Branch, Pune",
      accountMasked: customAcc || "•••• •••• 9304",
      ifsc: customIfsc || "SBIN0004182",
      regNo: gObj?.trustRegistrationNo || "MAH-PUN-AWBI-0792",
      cycle: "Every Sunday at 23:59 IST",
    }
  }
  if (gaushalaKey.includes("vrindavan")) {
    return {
      beneficiary: "Vrindavan Goshala Welfare Society",
      bankName: customBank || "ICICI Bank Ltd · Hadapsar Branch, Pune",
      accountMasked: customAcc || "•••• •••• 5519",
      ifsc: customIfsc || "ICIC0001048",
      regNo: gObj?.trustRegistrationNo || "MAH-PUN-AWBI-1034",
      cycle: "Every Sunday at 23:59 IST",
    }
  }
  if (gaushalaKey.includes("kamdhenu") || gaushalaKey.includes("kamadhenu")) {
    return {
      beneficiary: "Kamdhenu Seva Kendra Trust",
      bankName: customBank || "Axis Bank · Wakad Branch, Pune",
      accountMasked: customAcc || "•••• •••• 8831",
      ifsc: customIfsc || "UTIB0002194",
      regNo: gObj?.trustRegistrationNo || "MAH-PUN-AWBI-1190",
      cycle: "Every Sunday at 23:59 IST",
    }
  }

  // Default for Shri Krishna Gaushala or custom newly added Gaushalas
  return {
    beneficiary: `${gName} Charitable Trust`,
    bankName: customBank || "HDFC Bank Ltd · Kothrud Branch, Pune",
    accountMasked: customAcc || "•••• •••• 4829",
    ifsc: customIfsc || "HDFC0001824",
    regNo: gObj?.trustRegistrationNo || "MAH-PUN-AWBI-0421",
    cycle: "Every Sunday at 23:59 IST",
  }
}

export const getDevoteeGotra = (customerName: string) => {
  const surname = customerName.split(" ").slice(-1)[0]?.toLowerCase() || ""
  if (surname.includes("deshmukh")) return "Vatsa"
  if (surname.includes("kulkarni")) return "Kaushika"
  if (surname.includes("joshi")) return "Kashyapa"
  if (surname.includes("iyer")) return "Bharadwaja"
  if (surname.includes("rao")) return "Gautama"
  if (surname.includes("nair")) return "Harita"
  if (surname.includes("patil")) return "Gargya"
  if (surname.includes("sharma")) return "Shandilya"
  if (surname.includes("kale")) return "Vasishtha"
  return "Kashyapa"
}

export default function ManagerLedger() {
  const { bookings, animals, settlements, profiles, gosalas, activeGosalaFilter, setActiveGosalaFilter, currentRole } = useStore()
  const { notify } = useToast()

  // State management
  const [activeCategory, setActiveCategory] = useState<TopCategory>("gross")
  const [isPerGosalaModalOpen, setIsPerGosalaModalOpen] = useState(false)
  const [modalSelectedGosala, setModalSelectedGosala] = useState<string>("ALL")
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>("GMA-24815")
  const [expandedGosalaActionId, setExpandedGosalaActionId] = useState<string | null>("Shri Krishna Gaushala")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "confirmed" | "in_service">("all")
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null)

  // Current Gaushala Information (Zero-leakage manager isolation)
  const currentGosalaName =
    currentRole === "manager"
      ? (profiles?.manager?.managerData?.gosala || "Shri Krishna Gaushala")
      : (activeGosalaFilter !== "ALL"
          ? activeGosalaFilter
          : profiles?.manager?.managerData?.gosala || "Shri Krishna Gaushala")

  const currentGosala = gosalas.find(
    (g) => g.name.toLowerCase() === currentGosalaName.toLowerCase(),
  )

  // All verified bookings strictly scoped for manager
  const allRelevantBookings = bookings.filter((b) => {
    if (currentRole === "manager") {
      if ((b.gosala || "Shri Krishna Gaushala").toLowerCase() !== currentGosalaName.toLowerCase()) {
        return false
      }
    }
    return (
      b.status === "Completed" ||
      b.status === "Confirmed" ||
      b.status === "In Service"
    )
  })

  // Compute per-gaushala aggregated net shares and actions performed
  const gosalaBreakdownMap: Record<
    string,
    {
      name: string
      gosalaObj?: (typeof gosalas)[0]
      sevasCount: number
      gross: number
      netShare: number
      transport: number
      addons: number
      platformFee: number
      totalKm: number
      animals: Set<string>
      drivers: Set<string>
      actions: {
        bookingId: string
        customer: string
        ritual: string
        animal: string
        animalType: string
        driver: string
        distanceKm: number
        totalPaid: number
        netShare: number
        date: string
        status: string
      }[]
    }
  > = {}

  // Pre-seed with registered gaushalas so all appear
  gosalas.forEach((g) => {
    gosalaBreakdownMap[g.name] = {
      name: g.name,
      gosalaObj: g,
      sevasCount: 0,
      gross: 0,
      netShare: 0,
      transport: 0,
      addons: 0,
      platformFee: 0,
      totalKm: 0,
      animals: new Set(),
      drivers: new Set(),
      actions: [],
    }
  })

  // Aggregate stats from verified sevas
  allRelevantBookings.forEach((b) => {
    const gName = b.gosala || "Shri Krishna Gaushala"
    if (!gosalaBreakdownMap[gName]) {
      const found = gosalas.find(
        (g) => g.name.toLowerCase() === gName.toLowerCase(),
      )
      gosalaBreakdownMap[gName] = {
        name: gName,
        gosalaObj: found,
        sevasCount: 0,
        gross: 0,
        netShare: 0,
        transport: 0,
        addons: 0,
        platformFee: 0,
        totalKm: 0,
        animals: new Set(),
        drivers: new Set(),
        actions: [],
      }
    }

    const item = gosalaBreakdownMap[gName]
    const baseAndExtra = (b.base || 0) + (b.extraTime || 0)
    const transport = b.transport || 0
    const addons = b.addons || 0
    const commissionPct = b.commissionPct || 20

    const ritualCut = Math.round(baseAndExtra * (1 - commissionPct / 100))
    const net = ritualCut + transport + Math.round(addons * 0.9)
    const platformCut = (b.total || 0) - net

    item.sevasCount += 1
    item.gross += b.total || 0
    item.netShare += net
    item.transport += transport
    item.addons += Math.round(addons * 0.9)
    item.platformFee += platformCut
    item.totalKm += b.distanceKm || 0
    if (b.animal) item.animals.add(b.animal)
    if (b.driver) item.drivers.add(b.driver)

    item.actions.push({
      bookingId: b.id,
      customer: b.customer,
      ritual: b.ritualPurpose || "Griha Pravesh & Puja",
      animal: b.animal,
      animalType: b.animalType,
      driver: b.driver || "Sunil Pawar",
      distanceKm: b.distanceKm || 0,
      totalPaid: b.total,
      netShare: net,
      date: b.date,
      status: b.status,
    })
  })

  const gosalaBreakdownList =
    currentRole === "manager"
      ? Object.values(gosalaBreakdownMap).filter(
          (g) => g.name.toLowerCase() === currentGosalaName.toLowerCase(),
        )
      : Object.values(gosalaBreakdownMap)

  // Filter relevant bookings for the active gaushala scope (or ALL)
  const relevantBookings = bookings.filter((b) => {
    const matchesGosala =
      currentRole === "manager"
        ? (b.gosala || "Shri Krishna Gaushala").toLowerCase() ===
          currentGosalaName.toLowerCase()
        : activeGosalaFilter === "ALL" ||
          (b.gosala || "Shri Krishna Gaushala").toLowerCase() ===
            activeGosalaFilter.toLowerCase()

    const matchesStatus =
      b.status === "Completed" ||
      b.status === "Confirmed" ||
      b.status === "In Service"

    return matchesGosala && matchesStatus
  })

  // Dynamic Financial Computations according to the 80/20 Escrow Formula:
  let totalGross = 0
  let totalBase = 0
  let totalExtraTime = 0
  let totalTransportShare = 0
  let totalAddonsShare = 0
  let totalTax = 0
  let totalRitualShare = 0
  let totalGomaaCommission = 0

  relevantBookings.forEach((b) => {
    const baseAndExtra = (b.base || 0) + (b.extraTime || 0)
    const transport = b.transport || 0
    const addons = b.addons || 0
    const tax = b.tax || 0
    const commissionPct = b.commissionPct || 20

    const ritualCut = Math.round(baseAndExtra * (1 - commissionPct / 100))
    const platformRitualCut = Math.round(baseAndExtra * (commissionPct / 100))
    const addonsCut = Math.round(addons * 0.9)
    const platformAddonsCut = Math.round(addons * 0.1)

    totalGross += b.total || 0
    totalBase += b.base || 0
    totalExtraTime += b.extraTime || 0
    totalTransportShare += transport
    totalAddonsShare += addonsCut
    totalTax += tax
    totalRitualShare += ritualCut
    totalGomaaCommission += platformRitualCut + platformAddonsCut
  })

  const totalGaushalaNet =
    totalRitualShare + totalTransportShare + totalAddonsShare

  // Filtered rows for the itemized payment ledger
  const qTrim = searchQuery.trim().toLowerCase()
  const filteredBookings = relevantBookings.filter((b) => {
    if (statusFilter === "completed" && b.status !== "Completed") return false
    if (statusFilter === "confirmed" && b.status !== "Confirmed") return false
    if (statusFilter === "in_service" && b.status !== "In Service") return false

    if (!qTrim) return true

    return (
      b.id.toLowerCase().includes(qTrim) ||
      b.customer.toLowerCase().includes(qTrim) ||
      (b.phone && b.phone.toLowerCase().includes(qTrim)) ||
      (b.gosala && b.gosala.toLowerCase().includes(qTrim)) ||
      b.animal.toLowerCase().includes(qTrim) ||
      b.animalType.toLowerCase().includes(qTrim) ||
      (b.ritualPurpose && b.ritualPurpose.toLowerCase().includes(qTrim)) ||
      (b.address && b.address.toLowerCase().includes(qTrim)) ||
      (b.driver && b.driver.toLowerCase().includes(qTrim))
    )
  })

  // Seva classification: Cremations (Antim Sanskar / Moksha) vs Puja Ceremonies
  const getBookingServiceInfo = (b: Booking) => {
    const isCremation =
      b.ritualPurpose?.toLowerCase().includes("cremat") ||
      b.ritualPurpose?.toLowerCase().includes("antim") ||
      b.ritualPurpose?.toLowerCase().includes("moksha") ||
      b.animal === "Nandi" ||
      b.animal === "Shyam"

    if (isCremation) {
      return {
        type: "Cremation" as const,
        isCremation: true,
        title: b.ritualPurpose || "Antim Sanskar & Gau Moksha Seva",
        badge: "Antim Sanskar Cremation",
        badgeClass: "bg-purple-100 text-purple-900 border-purple-200",
        description: "Sacred cow Vedic final rites with holy ash urn collection",
      }
    }
    return {
      type: "Puja" as const,
      isCremation: false,
      title: b.ritualPurpose || "Griha Pravesh & Kamadhenu Puja",
      badge: "Ceremonial Puja",
      badgeClass: "bg-forest-soft text-forest border-forest/20",
      description: "Auspicious home sanctification & sacred Gau puja",
    }
  }

  const cremationBookings = relevantBookings.filter((b) => getBookingServiceInfo(b).isCremation)
  const pujaBookings = relevantBookings.filter((b) => !getBookingServiceInfo(b).isCremation)
  const cremationGross = cremationBookings.reduce((acc, b) => acc + (b.total || 0), 0)
  const pujaGross = pujaBookings.reduce((acc, b) => acc + (b.total || 0), 0)
  const totalKmTraveled = relevantBookings.reduce((acc, b) => acc + (b.distanceKm || 0), 0)

  // Dynamic Operational & Banking Computations
  const completedCount = relevantBookings.filter((b) => b.status === "Completed").length
  const completionRate = relevantBookings.length > 0 ? Math.round((completedCount / relevantBookings.length) * 100) : 100
  const effectiveCommissionPct = totalGross > 0 ? ((totalGomaaCommission / totalGross) * 100).toFixed(1) : "18.2"

  const poolInsurance = Math.round(totalGomaaCommission * 0.35)
  const poolGps = Math.round(totalGomaaCommission * 0.25)
  const poolCare = Math.round(totalGomaaCommission * 0.25)
  const poolEscrow = totalGomaaCommission - poolInsurance - poolGps - poolCare

  const activeBank = getGaushalaBankDetails(currentGosalaName, currentGosala)

  // Dynamic Settlement Batches computed from actual volume and active shelter bank
  const dynamicBatches: SettlementBatch[] = useMemo(() => {
    if (relevantBookings.length === 0 || totalGross === 0) {
      return []
    }

    const weeks = [
      { label: "W4", date: "Current Week Dispatch", utrSuffix: "8109281", multiplier: 1.0 },
      { label: "W3", date: "Previous Week Dispatch", utrSuffix: "1048209", multiplier: 0.82 },
      { label: "W2", date: "Cycle -2 Dispatch", utrSuffix: "4091218", multiplier: 0.91 },
      { label: "W1", date: "Cycle -3 Dispatch", utrSuffix: "7012903", multiplier: 0.74 },
    ]

    return weeks.map((w, idx) => {
      const grossVal = Math.round(totalGross * w.multiplier)
      const netVal = Math.round(totalGaushalaNet * w.multiplier)
      const countVal = Math.max(1, Math.round(relevantBookings.length * w.multiplier))
      const utrPrefix = (activeBank.ifsc || "HDFC").slice(0, 4)

      return {
        id: `BTH-${activeGosalaFilter === "ALL" ? "GMA" : activeGosalaFilter.slice(0, 3).toUpperCase()}-2026-${w.label}`,
        date: w.date,
        sevasCount: countVal,
        gross: grossVal,
        gaushalaNet: netVal,
        utr: `${utrPrefix}N2626${w.utrSuffix}`,
        bankName: activeBank.bankName.split("·")[0].trim(),
        accountMasked: activeBank.accountMasked,
        status: (idx === 0 && relevantBookings.some((b) => b.status === "In Service") ? "Processing" : "Settled") as "Settled" | "Processing",
      }
    })
  }, [activeGosalaFilter, totalGross, totalGaushalaNet, relevantBookings, activeBank])

  // Driver and vehicle fleet details dynamically resolved from inHouseDrivers
  const getDriverVehicleInfo = (driverName: string | null) => {
    const found = inHouseDrivers.find((d) => d.name.toLowerCase() === (driverName || "").toLowerCase())
    if (found) {
      return {
        driver: found.name,
        phone: found.phone,
        model: found.vehicleModel,
        plate: found.vehiclePlate,
      }
    }
    // Dynamic fallback matching any assigned driver
    const fallback = inHouseDrivers[0] || {
      name: "Sunil Pawar",
      phone: "+91 98901 23456",
      vehicleModel: "Tata 407 (Hydraulic Ramp)",
      vehiclePlate: "MH-12-PQ-9102",
    }
    return {
      driver: driverName || fallback.name,
      phone: fallback.phone,
      model: fallback.vehicleModel,
      plate: fallback.vehiclePlate,
    }
  }

  // Handle category card tab switch
  const handleToggleCategory = (category: TopCategory) => {
    setActiveCategory(category)
  }

  return (
    <div className="space-y-6">
      {/* ----------------- GAUSHALA SCOPE FILTER STRIP ----------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-forest text-white flex items-center justify-center">
            <Building2 size={16} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-ink flex items-center gap-2">
              <span>Gaushala Account Scope:</span>
              <span className="font-serif text-forest text-[15px]">
                {currentRole === "manager"
                  ? `${currentGosalaName} (Custodian Net Share)`
                  : activeGosalaFilter === "ALL"
                    ? "Consolidated Portfolio (All Gaushalas)"
                    : activeGosalaFilter}
              </span>
            </div>
            <div className="text-[11.5px] text-ink-faint">
              {currentRole === "manager"
                ? "Dedicated 80% Gaushala Trust revenue split with 100% transport pass-through for your cowshed"
                : "Switch between individual Gaushalas to inspect dedicated net shares & trust settlements"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {currentRole === "manager" ? (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-forest text-white flex items-center gap-1.5 shadow-2xs">
                <Building2 size={13} />
                <span>{currentGosalaName} Dedicated Account</span>
              </div>
              <button
                onClick={() => {
                  setModalSelectedGosala(currentGosalaName)
                  setIsPerGosalaModalOpen(true)
                }}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-saffron text-white hover:bg-saffron-deep transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles size={13} />
                <span>View Shelter Net Share Breakdown ↗</span>
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setActiveGosalaFilter("ALL")}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition cursor-pointer whitespace-nowrap ${
                  activeGosalaFilter === "ALL"
                    ? "bg-forest text-white shadow-2xs font-semibold"
                    : "bg-paper border border-line text-ink-soft hover:text-ink hover:bg-paper-deep"
                }`}
              >
                All Gaushalas ({allRelevantBookings.length} Sevas)
              </button>
              {gosalas.map((g) => {
                const isActive =
                  activeGosalaFilter.toLowerCase() === g.name.toLowerCase()
                const gStats = gosalaBreakdownMap[g.name]
                return (
                  <button
                    key={g.id || g.name}
                    onClick={() => setActiveGosalaFilter(g.name)}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? "bg-forest text-white shadow-2xs font-semibold"
                        : "bg-paper border border-line text-ink-soft hover:text-ink hover:bg-paper-deep"
                    }`}
                  >
                    <span>{g.name}</span>
                    {gStats && gStats.netShare > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-forest-soft text-forest"
                        }`}
                      >
                        {inr(gStats.netShare)}
                      </span>
                    )}
                  </button>
                )
              })}
              {/* Pop-up trigger */}
              <button
                onClick={() => {
                  setModalSelectedGosala(activeGosalaFilter)
                  setIsPerGosalaModalOpen(true)
                }}
                className="ml-auto px-3 py-1.5 rounded-md text-[12px] font-medium bg-forest-soft hover:bg-forest hover:text-white text-forest border border-forest/30 transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs"
                title="Open Per-Gaushala Net Share & Actions breakdown modal"
              >
                <Building2 size={13} />
                <span>Per-Gaushala Net Share Pop-up ↗</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ----------------- TOP 4 DYNAMIC CATEGORY METRICS ----------------- */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-[20px] text-ink font-semibold">
              {activeGosalaFilter === "ALL" ? "Consolidated Financial Summary" : `${activeGosalaFilter} Financial Summary`}
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-forest-soft text-forest font-semibold">
              Live Escrow
            </span>
          </div>
          <span className="text-[11.5px] text-ink-faint">
            Tap any card to view transparent audit calculations & policies
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Gross Seva Bookings */}
          <div
            onClick={() => handleToggleCategory("gross")}
            className={`group cursor-pointer rounded-lg border p-5 transition-all duration-200 select-none ${
              activeCategory === "gross"
                ? "bg-gradient-to-br from-card via-card to-saffron-soft/30 border-saffron ring-2 ring-saffron/30 shadow-md scale-[1.01]"
                : "bg-card border-line hover:border-saffron/50 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between text-ink-faint">
              <span className="font-mono text-[10.5px] uppercase tracking-wider font-medium text-ink-soft">
                Total Gross Bookings
              </span>
              <div
                className={`p-1.5 rounded-full transition-colors ${
                  activeCategory === "gross"
                    ? "bg-saffron/20 text-saffron-deep"
                    : "bg-paper-deep text-saffron group-hover:bg-saffron/10"
                }`}
              >
                <Receipt size={16} />
              </div>
            </div>
            <div className="font-serif text-[28px] text-ink font-semibold mt-2 tabular flex items-baseline justify-between">
              <span>{inr(totalGross)}</span>
              <span className="text-[11px] font-sans font-medium text-forest bg-forest/10 px-1.5 py-0.5 rounded">
                +${completionRate}% Fulfill
              </span>
            </div>
            <div className="text-[11.5px] text-ink-faint mt-1 flex items-center justify-between">
              <span>{relevantBookings.length} verified sevas</span>
              <span
                className={`text-[11px] font-medium flex items-center gap-0.5 ${
                  activeCategory === "gross"
                    ? "text-saffron-deep"
                    : "text-ink-faint group-hover:text-ink"
                }`}
              >
                {activeCategory === "gross" ? "Active Breakdown ▾" : "Tap for info →"}
              </span>
            </div>
          </div>

          {/* Card 2: Gaushala Net Share (80% Trust Fund) */}
          <div
            onClick={() => handleToggleCategory("net")}
            className={`group cursor-pointer rounded-lg border p-5 transition-all duration-200 select-none ${
              activeCategory === "net"
                ? "bg-gradient-to-br from-card via-card to-forest-soft/40 border-forest ring-2 ring-forest/30 shadow-md scale-[1.01]"
                : "bg-card border-line hover:border-forest/50 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between text-forest">
              <span className="font-mono text-[10.5px] uppercase tracking-wider font-medium">
                Gaushala Net Share
              </span>
              <div
                className={`p-1.5 rounded-full transition-colors ${
                  activeCategory === "net"
                    ? "bg-forest text-white"
                    : "bg-forest-soft text-forest group-hover:bg-forest/20"
                }`}
              >
                <Wallet size={16} />
              </div>
            </div>
            <div className="font-serif text-[28px] text-forest font-semibold mt-2 tabular flex items-baseline justify-between">
              <span>{inr(totalGaushalaNet)}</span>
              <span className="text-[11px] font-sans font-medium text-forest bg-forest-soft border border-forest/20 px-1.5 py-0.5 rounded">
                80% Net
              </span>
            </div>
            <div className="text-[11.5px] text-ink-faint mt-1 flex items-center justify-between">
              <span>Direct to Trust Account</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-medium flex items-center gap-0.5 ${
                    activeCategory === "net"
                      ? "text-forest font-semibold"
                      : "text-ink-faint group-hover:text-forest"
                  }`}
                >
                  {activeCategory === "net" ? "Active Breakdown ▾" : "Tap for info →"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setModalSelectedGosala(activeGosalaFilter)
                    setIsPerGosalaModalOpen(true)
                  }}
                  className="text-[10px] font-medium text-white bg-forest hover:bg-forest-deep px-1.5 py-0.5 rounded shadow-2xs cursor-pointer"
                  title="Open shelter pop-up modal"
                >
                  Pop-up ↗
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Transport Fuel & Driver Pass-Through */}
          <div
            onClick={() => handleToggleCategory("transport")}
            className={`group cursor-pointer rounded-lg border p-5 transition-all duration-200 select-none ${
              activeCategory === "transport"
                ? "bg-gradient-to-br from-card via-card to-amber-50/50 border-amber-500 ring-2 ring-amber-500/30 shadow-md scale-[1.01]"
                : "bg-card border-line hover:border-amber-400 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between text-ink-faint">
              <span className="font-mono text-[10.5px] uppercase tracking-wider font-medium text-ink-soft">
                Transport Pass-Through
              </span>
              <div
                className={`p-1.5 rounded-full transition-colors ${
                  activeCategory === "transport"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-paper-deep text-amber-700 group-hover:bg-amber-100"
                }`}
              >
                <Truck size={16} />
              </div>
            </div>
            <div className="font-serif text-[28px] text-ink font-semibold mt-2 tabular flex items-baseline justify-between">
              <span>{inr(totalTransportShare)}</span>
              <span className="text-[11px] font-sans font-medium text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                100% Pass
              </span>
            </div>
            <div className="text-[11.5px] text-emerald-700 font-medium mt-1 flex items-center justify-between">
              <span>0% Platform Deduction</span>
              <span
                className={`text-[11px] font-medium flex items-center gap-0.5 ${
                  activeCategory === "transport"
                    ? "text-amber-800 font-semibold"
                    : "text-ink-faint group-hover:text-amber-800"
                }`}
              >
                {activeCategory === "transport" ? "Active Breakdown ▾" : "Tap for info →"}
              </span>
            </div>
          </div>

          {/* Card 4: GOMAA Platform Fee */}
          <div
            onClick={() => handleToggleCategory("platform")}
            className={`group cursor-pointer rounded-lg border p-5 transition-all duration-200 select-none ${
              activeCategory === "platform"
                ? "bg-gradient-to-br from-card via-card to-blue-50/40 border-blue-500 ring-2 ring-blue-500/30 shadow-md scale-[1.01]"
                : "bg-card border-line hover:border-blue-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between text-ink-faint">
              <span className="font-mono text-[10.5px] uppercase tracking-wider font-medium text-ink-soft">
                GOMAA Platform Fee
              </span>
              <div
                className={`p-1.5 rounded-full transition-colors ${
                  activeCategory === "platform"
                    ? "bg-blue-100 text-blue-900"
                    : "bg-paper-deep text-ink-soft group-hover:bg-blue-50"
                }`}
              >
                <ShieldCheck size={16} />
              </div>
            </div>
            <div className="font-serif text-[28px] text-ink-soft font-semibold mt-2 tabular flex items-baseline justify-between">
              <span>{inr(totalGomaaCommission)}</span>
              <span className="text-[11px] font-sans font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                20% Cap
              </span>
            </div>
            <div className="text-[11.5px] text-ink-faint mt-1 flex items-center justify-between">
              <span>Insurance & Live GPS</span>
              <span
                className={`text-[11px] font-medium flex items-center gap-0.5 ${
                  activeCategory === "platform"
                    ? "text-blue-700 font-semibold"
                    : "text-ink-faint group-hover:text-blue-700"
                }`}
              >
                {activeCategory === "platform" ? "Active Breakdown ▾" : "Tap for info →"}
              </span>
            </div>
          </div>
        </div>
      </div>



      
      {/* =========================================================================
          VIEW 1: TOTAL GROSS BOOKINGS (CUSTOMER PAYMENTS & ALL CREMATIONS / SEVAS)
          ========================================================================= */}
      {activeCategory === "gross" && (
        <Panel className="border-line bg-card shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-line bg-paper/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-[19px] text-ink font-bold flex items-center gap-2">
                  <Receipt size={19} className="text-saffron-deep" />
                  <span>Customer Bookings & All Seva Payments Ledger</span>
                </h3>
                <p className="text-[12px] text-ink-faint mt-0.5">
                  Itemized record of each payment from the customer, Vedic ceremonies, and overall sacred cow cremations (Antim Sanskar) with full settlement transparency.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="font-mono text-[11px] text-ink-faint bg-paper-deep px-2.5 py-1 rounded border border-line">
                  {filteredBookings.length} of {relevantBookings.length} transactions
                </span>
                <span className="text-[11px] font-mono bg-forest-soft text-forest px-2.5 py-1 rounded border border-forest/20 font-medium">
                  Razorpay Escrow Verified
                </span>
              </div>
            </div>

            {/* Top 4 KPI Summary Cards for Gross Bookings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>Customer Gross Volume</span>
                  <Receipt size={14} className="text-saffron-deep" />
                </div>
                <div className="font-serif text-[22px] font-bold text-ink tabular">
                  {inr(totalGross)}
                </div>
                <div className="text-[11px] text-ink-soft flex items-center justify-between">
                  <span>{relevantBookings.length} total bookings</span>
                  <span className="text-forest font-semibold">+${completionRate}% Fulfill Rate</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-purple-900 font-medium flex items-center justify-between">
                  <span>Overall Cremations (Antim Sanskar)</span>
                  <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                </div>
                <div className="font-serif text-[22px] font-bold text-purple-950 tabular">
                  {cremationBookings.length} Cremations
                </div>
                <div className="text-[11px] text-purple-800 flex items-center justify-between">
                  <span>{inr(cremationGross)} collected</span>
                  <span className="font-mono font-medium">Vedic Holy Rites</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-forest/20 bg-forest-soft/30 shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-forest font-medium flex items-center justify-between">
                  <span>Ceremonial Pujas & Living Sevas</span>
                  <Sparkles size={14} className="text-forest" />
                </div>
                <div className="font-serif text-[22px] font-bold text-forest tabular">
                  {pujaBookings.length} Sevas
                </div>
                <div className="text-[11px] text-ink-soft flex items-center justify-between">
                  <span>{inr(pujaGross)} collected</span>
                  <span className="font-mono font-medium text-forest">Griha Pravesh & Puja</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>Gateway Settlement</span>
                  <CheckCircle2 size={14} className="text-forest" />
                </div>
                <div className="font-serif text-[22px] font-bold text-forest tabular">
                  100% Cleared
                </div>
                <div className="text-[11px] text-ink-soft flex items-center justify-between">
                  <span>UPI / Netbanking</span>
                  <span className="font-mono font-medium text-ink-faint">Instant Webhook</span>
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-line/70">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="text"
                  placeholder="Search by Gaushala, Devotee, Booking ID, Cow, Address, Ritual..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-card border border-line rounded-lg text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink text-[12px]"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <div className="flex items-center gap-1.5">
                  {[
                    { id: "all", label: `All (${relevantBookings.length})` },
                    { id: "completed", label: "Completed" },
                    { id: "confirmed", label: "Confirmed" },
                    { id: "in_service", label: "In Service" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id as any)}
                      className={`px-2.5 py-1 text-[11.5px] font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
                        statusFilter === f.id
                          ? "bg-ink text-paper shadow-2xs"
                          : "bg-card border border-line text-ink-soft hover:text-ink"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (expandedPaymentId) {
                      setExpandedPaymentId(null)
                    } else {
                      setExpandedPaymentId(filteredBookings[0]?.id || "GMA-24815")
                    }
                  }}
                  className="px-2.5 py-1 text-[11.5px] font-medium rounded-lg border border-forest/30 bg-forest-soft hover:bg-forest hover:text-white text-forest transition cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-2xs"
                >
                  <FileText size={12} />
                  <span>{expandedPaymentId ? "Hide Dossiers ▲" : "Expand Dossier Details ▼"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[980px]">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left">
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Booking & Devotee
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Executing Gaushala
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Ceremony / Cremation & Cow
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Schedule & Time
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Devotee Paid (UPI)
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                    Transport
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-forest uppercase tracking-wider">
                    Gaushala Net
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                    Platform Fee
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider text-right">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-ink-faint text-[13px]">
                      No transactions matched your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => {
                    const isExpanded = expandedPaymentId === b.id
                    const serviceInfo = getBookingServiceInfo(b)
                    const baseAndExtra = (b.base || 0) + (b.extraTime || 0)
                    const transport = b.transport || 0
                    const addons = b.addons || 0
                    const commissionPct = b.commissionPct || 20

                    const ritualCut = Math.round(baseAndExtra * (1 - commissionPct / 100))
                    const platformRitualCut = Math.round(baseAndExtra * (commissionPct / 100))
                    const gaushalaNet = ritualCut + transport + Math.round(addons * 0.9)
                    const platformCut = (b.total || 0) - gaushalaNet
                    const driverObj = getDriverVehicleInfo(b.driver)

                    return (
                      <>
                        <tr
                          key={b.id}
                          onClick={() =>
                            setExpandedPaymentId((prev) =>
                              prev === b.id ? null : b.id,
                            )
                          }
                          className={`cursor-pointer transition-colors text-[12.5px] select-none ${
                            isExpanded
                              ? "bg-saffron-soft/20 font-medium"
                              : "hover:bg-paper/50"
                          }`}
                        >
                          {/* Booking ID & Customer */}
                          <td className="px-4 py-3">
                            <div className="font-mono text-[12px] text-ink font-semibold">
                              {b.id}
                            </div>
                            <div className="text-ink-soft text-[12px]">
                              {b.customer}
                            </div>
                          </td>

                          {/* Gaushala Shelter Column */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 font-semibold text-ink">
                              <Building2 size={13} className="text-forest shrink-0" />
                              <span className="truncate max-w-[170px]" title={b.gosala}>
                                {b.gosala}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-ink-faint block mt-0.5">
                              AWBI Verified Shelter
                            </span>
                          </td>

                          {/* Ceremony / Cremation & Cow */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-medium ${serviceInfo.badgeClass}`}
                              >
                                {serviceInfo.badge}
                              </span>
                            </div>
                            <div className="text-[12px] font-medium text-ink mt-0.5">
                              {b.animal} <span className="text-ink-faint text-[11px]">({b.animalType})</span>
                            </div>
                          </td>

                          {/* Schedule */}
                          <td className="px-4 py-3 text-ink-soft">
                            <div>{b.date}</div>
                            <div className="font-mono text-[11px] text-ink-faint">
                              {b.start}–{b.end} ({b.durationMin}m)
                            </div>
                          </td>

                          {/* Devotee Paid */}
                          <td className="px-4 py-3 font-mono font-medium text-ink tabular">
                            {inr(b.total)}
                          </td>

                          {/* Transport */}
                          <td className="px-4 py-3 font-mono text-emerald-800 tabular">
                            +{inr(transport)}
                          </td>

                          {/* Gaushala Net */}
                          <td className="px-4 py-3 font-mono font-semibold text-forest tabular">
                            {inr(gaushalaNet)}
                          </td>

                          {/* Platform Fee */}
                          <td className="px-4 py-3 font-mono text-ink-faint tabular">
                            −{inr(platformCut)}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span
                              className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full font-medium ${
                                b.status === "Completed"
                                  ? "bg-forest-soft text-forest"
                                  : b.status === "In Service"
                                    ? "bg-saffron/15 text-saffron-deep"
                                    : "bg-paper-deep text-ink-soft"
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>

                          {/* Expander */}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedPaymentId((prev) =>
                                  prev === b.id ? null : b.id,
                                )
                              }}
                              className={`p-1.5 rounded-full transition-all ${
                                isExpanded
                                  ? "bg-forest text-white rotate-180"
                                  : "text-ink-faint hover:text-ink hover:bg-paper-deep"
                              }`}
                              title="Expand payment dossier"
                            >
                              <ChevronDown size={15} />
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Deep Dossier */}
                        {isExpanded && (
                          <tr key={`${b.id}-details`} className="bg-paper/40">
                            <td colSpan={10} className="p-0">
                              <div className="p-5 border-y border-line/80 space-y-4 animate-fade-in text-[12.5px]">
                                {/* Header strip with Gaushala name & Devotee */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                                  <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-forest text-white flex items-center justify-center font-serif text-[15px] font-medium shrink-0">
                                      {b.customer.slice(0, 1)}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-ink text-[14.5px] flex items-center gap-2 flex-wrap">
                                        <span>{b.customer}</span>
                                        <span className="text-[10px] font-mono text-forest bg-forest-soft border border-forest/20 px-2 py-0.5 rounded-full font-medium">
                                          Verified Devotee
                                        </span>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium border ${serviceInfo.badgeClass}`}>
                                          {serviceInfo.badge}
                                        </span>
                                        <span className="text-[11px] font-mono text-ink-faint bg-paper px-2 py-0.5 rounded border border-line">
                                          Executing Shelter: <strong className="text-ink">{b.gosala}</strong>
                                        </span>
                                      </div>
                                      <div className="text-[12px] text-ink-faint flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span>Aadhaar: {b.aadhaarNumber || "XXXX-XXXX-4819"}</span>
                                        <span>•</span>
                                        <span>Gotra: {getDevoteeGotra(b.customer)}</span>
                                        <span>•</span>
                                        <span>Phone: {b.phone}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <button
                                      onClick={() => setReceiptBooking(b)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-forest/30 bg-forest-soft hover:bg-forest hover:text-white text-forest text-[12px] font-medium transition cursor-pointer shadow-2xs"
                                    >
                                      <FileText size={13} /> View Official Voucher
                                    </button>
                                    <button
                                      onClick={() =>
                                        notify(`Downloaded seva voucher for ${b.id}`, "ok")
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-line bg-card hover:bg-paper-deep text-ink text-[12px] font-medium transition cursor-pointer"
                                    >
                                      <Download size={13} /> Download PDF
                                    </button>
                                  </div>
                                </div>

                                {/* Two Column Layout: What Really Happened & Financial Calculation */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                  {/* Left 7 cols: What Really Happened */}
                                  <div className="lg:col-span-7 space-y-3">
                                    <div className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold flex items-center gap-1.5">
                                      <ShieldCheck size={14} /> What Really Happened (Audit Narrative)
                                    </div>

                                    <div className="bg-card p-4 rounded-lg border border-line space-y-3 shadow-2xs">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                                        <div>
                                          <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                                            Executing Gaushala Shelter
                                          </span>
                                          <span className="text-forest font-bold flex items-center gap-1.5">
                                            <Building2 size={13} /> {b.gosala}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                                            Ceremonial Purpose
                                          </span>
                                          <span className="text-ink font-semibold">
                                            {serviceInfo.title}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                                            Sacred Animal Dispatched
                                          </span>
                                          <span className="text-saffron-deep font-semibold">
                                            {b.animal} ({b.animalType})
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                                            Destination & Route
                                          </span>
                                          <span className="text-ink truncate block" title={b.address}>
                                            {b.address}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="p-3 bg-paper rounded border border-line/70 text-[11.5px] space-y-1">
                                        <div className="flex items-center justify-between text-ink-soft">
                                          <span>Assigned Driver & Transit:</span>
                                          <span className="font-semibold text-ink">
                                            {driverObj.driver} ({driverObj.model})
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-ink-soft">
                                          <span>Round-Trip Road Distance:</span>
                                          <span className="font-mono text-ink">
                                            {b.distanceKm} km (₹40/km rate)
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-ink-soft">
                                          <span>Animal Welfare Protocol:</span>
                                          <span className="text-forest font-medium">
                                            ✓ Air-cushioned hydraulic ramp · Zero stress logged
                                          </span>
                                        </div>
                                      </div>

                                      <div className="text-[11.5px] text-ink-soft italic bg-paper-deep/60 p-2.5 rounded">
                                        "{b.managerRemark || "Operational check passed. Sacred cow arrived resting and in serene condition. Devotee completed Vedic rituals with blessed family."}"
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right 5 cols: Itemized Financial Breakdown */}
                                  <div className="lg:col-span-5 space-y-3">
                                    <div className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold flex items-center gap-1.5">
                                      <Receipt size={14} /> Itemized Digital Payment Audit
                                    </div>

                                    <div className="bg-card p-4 rounded-lg border border-line space-y-2 shadow-2xs">
                                      <div className="flex items-center justify-between text-ink-soft">
                                        <span>Base Seva Fee:</span>
                                        <span className="font-mono text-ink">{inr(b.base)}</span>
                                      </div>

                                      {b.extraTime > 0 && (
                                        <div className="flex items-center justify-between text-ink-soft">
                                          <span>Extended Darshan:</span>
                                          <span className="font-mono text-ink">+{inr(b.extraTime)}</span>
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between text-emerald-800">
                                        <span>Transport Pass-Through (100% to Shelter):</span>
                                        <span className="font-mono font-medium">+{inr(transport)}</span>
                                      </div>

                                      {addons > 0 && (
                                        <div className="flex items-center justify-between text-ink-soft">
                                          <span>Puja Samagri Add-ons (90% to Shelter):</span>
                                          <span className="font-mono text-ink">
                                            +{inr(Math.round(addons * 0.9))}
                                          </span>
                                        </div>
                                      )}

                                      <div className="pt-2 border-t border-line/60 flex items-center justify-between font-semibold text-ink">
                                        <span>Total Paid by Devotee:</span>
                                        <span className="font-mono text-[13px]">{inr(b.total)}</span>
                                      </div>

                                      <div className="flex items-center justify-between text-ink-faint text-[11.5px]">
                                        <span>GOMAA Platform Fee (20% on Base):</span>
                                        <span className="font-mono">−{inr(platformCut)}</span>
                                      </div>

                                      <div className="pt-2 border-t border-forest/30 bg-forest-soft/30 p-2.5 rounded flex items-center justify-between font-semibold text-forest text-[13px]">
                                        <span>Net Credited to {b.gosala}:</span>
                                        <span className="font-mono text-[14.5px] tabular">
                                          {inr(gaushalaNet)}
                                        </span>
                                      </div>

                                      <div className="pt-1 text-[11px] text-ink-faint font-mono flex items-center justify-between">
                                        <span>Gateway Ref: UPI-TXN-{b.id.replace(/\D/g, "")}</span>
                                        <span className="text-forest font-semibold">✓ Settled to Trust A/C</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* =========================================================================
          VIEW 2: GAUSHALA NET SHARE (PER-GAUSHALA EARNINGS & ACTIONS BREAKDOWN)
          ========================================================================= */}
      {activeCategory === "net" && (
        <Panel className="p-5 border-line bg-card shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-line">
            <div>
              <h3 className="font-serif text-[19px] text-ink font-bold flex items-center gap-2">
                <Building2 size={19} className="text-forest" />
                <span>Per-Gaushala Actions Performed & Net Share Breakdown</span>
              </h3>
              <p className="text-[12px] text-ink-faint mt-0.5">
                Specific actions completed by each shelter, cattle deployed, transit distances, and the exact money earned for each trust.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11.5px] font-mono text-ink-faint bg-paper px-2.5 py-1 rounded border border-line">
                {gosalaBreakdownList.length} Gaushalas Under Management
              </span>
              <button
                onClick={() => {
                  setModalSelectedGosala(activeGosalaFilter)
                  setIsPerGosalaModalOpen(true)
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-forest-soft hover:bg-forest hover:text-white text-forest border border-forest/30 text-[12px] font-medium transition cursor-pointer shadow-2xs"
              >
                <Building2 size={13} />
                <span>Full-Screen Pop-up ↗</span>
              </button>
            </div>
          </div>

          {/* 3-Pool Trust Mandate Architecture Banner */}
          <div className="mt-4 p-4 rounded-xl border border-forest/30 bg-gradient-to-r from-forest-soft/30 via-paper-deep/40 to-forest-soft/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-forest" />
                <span className="font-serif text-[15px] text-ink font-bold">
                  Transparent 80/20 Gaushala Trust Revenue Architecture
                </span>
              </div>
              <span className="text-[10.5px] font-mono bg-forest text-white px-2 py-0.5 rounded-full font-medium">
                Mandatory Escrow Protection
              </span>
            </div>
            <p className="text-[12px] text-ink-soft leading-relaxed">
              Every ceremonial rupee earned is protected by the Board of Trustees. The 80% net shelter allocation is strictly locked into three non-divertible operational accounts:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-card border border-line space-y-1">
                <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
                  <span>Pool 1: Daily Nutrition</span>
                  <span className="font-mono text-forest font-bold">55%</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Hydroponic green fodder, mustard seed cakes, wheat bran & dry straw supplies.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-card border border-line space-y-1">
                <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
                  <span>Pool 2: Veterinary Care</span>
                  <span className="font-mono text-forest font-bold">25%</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Routine doctor check-ups, vaccines, arthritis tonics & geriatric hospice care.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-card border border-line space-y-1">
                <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
                  <span>Pool 3: Gwalamitra Wages</span>
                  <span className="font-mono text-forest font-bold">20%</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Fair living wages, health coverage & festival bonuses for dedicated cattle handlers.
                </p>
              </div>
            </div>
          </div>

          {/* Grid of Gaushala Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
            {gosalaBreakdownList.map((g) => {
              const isFilterSelected =
                activeGosalaFilter.toLowerCase() === g.name.toLowerCase()
              const isActionsExpanded = expandedGosalaActionId === g.name

              return (
                <div
                  key={g.name}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden bg-card ${
                    isFilterSelected
                      ? "border-forest ring-2 ring-forest/30 shadow-md"
                      : "border-line hover:border-line-strong shadow-2xs"
                  }`}
                >
                  {/* Header Strip with Gaushala Trust identity */}
                  <div className="p-4 bg-paper/60 border-b border-line/70">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-serif text-[16.5px] text-ink font-bold flex items-center gap-2">
                          <span>{g.name}</span>
                          {isFilterSelected && (
                            <span className="text-[10px] font-mono uppercase bg-forest text-white px-2 py-0.5 rounded-full font-medium">
                              Active Scope
                            </span>
                          )}
                        </h4>
                        <div className="text-[11.5px] text-ink-faint mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{g.gosalaObj?.trustRegistrationNo || "AWBI Reg: MAH-PUN-0421"}</span>
                          <span>•</span>
                          <span>Caretaker: {g.gosalaObj?.caretaker || "Rameshwar Shastri"}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10.5px] font-mono text-ink-faint uppercase block">
                          Net Share Credited
                        </span>
                        <span className="font-serif text-[22px] font-bold text-forest tabular block">
                          {inr(g.netShare)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body: Completed Actions Summary & Financial Formula */}
                  <div className="p-4 space-y-3 text-[12.5px]">
                    {/* Actions Completed Pill Grid */}
                    <div>
                      <span className="text-[11px] font-mono uppercase text-ink-faint block mb-1.5 font-medium">
                        Actions Completed by this Shelter
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-[12px]">
                        <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                            ✓
                          </span>
                          <div>
                            <div className="font-semibold text-ink">{g.sevasCount} Sevas / Cremations</div>
                            <div className="text-[10.5px] text-ink-faint">Completed successfully</div>
                          </div>
                        </div>

                        <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                            ✓
                          </span>
                          <div>
                            <div className="font-semibold text-ink">{g.totalKm.toFixed(1)} km Transit</div>
                            <div className="text-[10.5px] text-ink-faint">0 Heat stress incidents</div>
                          </div>
                        </div>

                        <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                            ✓
                          </span>
                          <div>
                            <div className="font-semibold text-ink">{g.animals.size || 2} Cattle Deployed</div>
                            <div className="text-[10.5px] text-ink-faint truncate max-w-[120px]">
                              {Array.from(g.animals).join(", ") || (animals.filter(a => a.gosala?.toLowerCase() === g.name.toLowerCase()).map(a => a.name).join(", ")) || "Sacred Cattle"}
                            </div>
                          </div>
                        </div>

                        <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                            ✓
                          </span>
                          <div>
                            <div className="font-semibold text-ink">100% Feeding Protocol</div>
                            <div className="text-[10.5px] text-ink-faint">Organic grass logged</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Net Share Breakdown for this Gaushala */}
                    <div className="p-3 rounded-lg bg-forest-soft/30 border border-forest/20 space-y-1.5 text-[12px]">
                      <div className="flex items-center justify-between text-ink-soft">
                        <span>Gross Devotee Volume:</span>
                        <span className="font-mono text-ink font-medium">{inr(g.gross)}</span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-800">
                        <span>Transport Pass-Through (100% to this Gaushala):</span>
                        <span className="font-mono font-medium">+{inr(g.transport)}</span>
                      </div>
                      {g.addons > 0 && (
                        <div className="flex items-center justify-between text-ink-soft">
                          <span>Puja Samagri Add-ons (90% to this Gaushala):</span>
                          <span className="font-mono font-medium">+{inr(g.addons)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-ink-faint text-[11.5px]">
                        <span>Platform Operations Fee Deducted (20%):</span>
                        <span className="font-mono">−{inr(g.platformFee)}</span>
                      </div>
                      <div className="pt-1.5 border-t border-forest/30 flex items-center justify-between font-bold text-forest text-[13px]">
                        <span>Specific Net Earned by this Gaushala:</span>
                        <span className="font-mono text-[14.5px] tabular">{inr(g.netShare)}</span>
                      </div>
                    </div>

                    {/* Expandable itemized actions list */}
                    {g.actions.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGosalaActionId(
                              isActionsExpanded ? null : g.name,
                            )
                          }
                          className="w-full py-1.5 px-2.5 rounded bg-paper hover:bg-paper-deep text-ink-soft text-[11.5px] font-medium flex items-center justify-between transition cursor-pointer border border-line"
                        >
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} className="text-forest" />
                            <span>
                              {isActionsExpanded
                                ? `Hide Completed Actions (${g.actions.length})`
                                : `View All ${g.actions.length} Completed Actions & Net Credits`}
                            </span>
                          </span>
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${
                              isActionsExpanded ? "rotate-180 text-forest" : ""
                            }`}
                          />
                        </button>

                        {isActionsExpanded && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {g.actions.map((act) => (
                              <div
                                key={act.bookingId}
                                className="p-2 rounded bg-paper/60 border border-line/70 text-[11.5px] flex items-center justify-between gap-2"
                              >
                                <div className="truncate">
                                  <div className="font-semibold text-ink flex items-center gap-1.5">
                                    <span>{act.customer}</span>
                                    <span className="text-[10px] font-mono text-ink-faint">({act.bookingId})</span>
                                  </div>
                                  <div className="text-ink-soft text-[11px] truncate">
                                    {act.ritual} · Cow: {act.animal} ({act.distanceKm} km with {act.driver})
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono font-semibold text-forest">
                                    +{inr(act.netShare)}
                                  </div>
                                  <div className="text-[10px] text-ink-faint">{act.date}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action row */}
                    <div className="flex items-center justify-between pt-2 border-t border-line/60">
                      <span className="text-[11px] font-mono text-ink-faint">
                        Disburses to: {getGaushalaBankDetails(g.name, g.gosalaObj).bankName.split("·")[0]} A/C {getGaushalaBankDetails(g.name, g.gosalaObj).accountMasked}
                      </span>
                      <button
                        onClick={() => {
                          setActiveGosalaFilter(g.name)
                          notify(`Filtered ledger to ${g.name}`, "ok")
                        }}
                        className="px-3 py-1 rounded bg-paper-deep hover:bg-forest hover:text-white border border-line text-ink text-[11.5px] font-medium transition cursor-pointer shadow-2xs"
                      >
                        Filter Ledger to this Gaushala →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* =========================================================================
          VIEW 3: TRANSPORT PASS-THROUGH (ALL DETAILS OF TRANSPORT COSTS CLEARLY)
          ========================================================================= */}
      {activeCategory === "transport" && (
        <Panel className="border-line bg-card shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-line bg-paper/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-[19px] text-ink font-bold flex items-center gap-2">
                  <Truck size={19} className="text-amber-700" />
                  <span>Transport Pass-Through & Vehicle Transit Ledger</span>
                </h3>
                <p className="text-[12px] text-ink-faint mt-0.5">
                  Clear breakdown of all transport costs: vehicle transit fuel, road kilometers, driver allowances, and 100% direct Gaushala credit with ₹0 platform deduction.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded font-semibold">
                  100% Gaushala Credit · 0% Platform Cut
                </span>
              </div>
            </div>

            {/* Policy & Formula Banner */}
            <div className="mt-4 p-4 rounded-xl border border-amber-300 bg-amber-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-amber-900 font-semibold flex items-center gap-1.5">
                  <ShieldCheck size={14} /> 100% Direct Pass-Through Policy Guarantee
                </span>
                <span className="text-[10.5px] font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-medium">
                  Zero Platform Commission
                </span>
              </div>
              <p className="text-[12px] text-amber-950 leading-relaxed">
                GOMAA takes <strong>₹0.00 platform commission</strong> on animal transport logistics. Every rupee paid by devotees for vehicle transit is passed through at 100% directly to the fulfilling Gaushala Trust to fund vehicle diesel, scheduled maintenance, and dedicated driver allowances.
              </p>
              <div className="pt-1 text-[11.5px] font-mono text-amber-900 flex items-center gap-4 flex-wrap">
                <span><strong>Rate Formula:</strong> ₹300 Base Pickup + ₹40/km Return Route</span>
                <span>•</span>
                <span><strong>Verification:</strong> IoT GPS Telematics & Electronic Odometer</span>
                <span>•</span>
                <span><strong>Equipment:</strong> Air-Cushioned Hydraulic Ramp Vans</span>
              </div>
            </div>

            {/* 4 Transport KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>Total Transport Disbursed</span>
                  <Truck size={14} className="text-amber-700" />
                </div>
                <div className="font-serif text-[22px] font-bold text-emerald-800 tabular">
                  {inr(totalTransportShare)}
                </div>
                <div className="text-[11px] text-ink-soft">
                  100% credited to Gaushalas
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>Road Distance Logged</span>
                  <MapPin size={14} className="text-forest" />
                </div>
                <div className="font-serif text-[22px] font-bold text-ink tabular">
                  {totalKmTraveled.toFixed(1)} km
                </div>
                <div className="text-[11px] text-ink-soft">
                  Across all verified journeys
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>AWBI Hydraulic Fleet</span>
                  <ShieldCheck size={14} className="text-forest" />
                </div>
                <div className="font-serif text-[22px] font-bold text-ink tabular">
                  3 Vans Active
                </div>
                <div className="text-[11px] text-ink-soft">
                  {inHouseDrivers.map(d => d.vehicleModel.split("(")[0].trim()).join(", ")}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>Platform Deduction</span>
                  <Coins size={14} className="text-forest" />
                </div>
                <div className="font-serif text-[22px] font-bold text-forest tabular">
                  ₹0.00 (0%)
                </div>
                <div className="text-[11px] text-forest font-medium">
                  Zero commission retained
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Transport Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[960px]">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left">
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Trip / Booking ID
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Devotee & Destination
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Executing Gaushala & Driver
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Vehicle Model & Plate
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Distance (Return)
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Devotee Transport Fee
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                    Gaushala 100% Credit
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                    Platform Cut
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-forest uppercase tracking-wider">
                    Audit Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {relevantBookings.map((b) => {
                  const driverObj = getDriverVehicleInfo(b.driver)
                  const transportFee = b.transport || 0

                  return (
                    <tr key={b.id} className="text-[12.5px] hover:bg-paper/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[12px] font-semibold text-ink">
                          {b.id}
                        </div>
                        <div className="text-[11px] text-ink-faint">{b.date}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{b.customer}</div>
                        <div className="text-[11.5px] text-ink-soft truncate max-w-[200px]" title={b.address}>
                          {b.address}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-forest flex items-center gap-1">
                          <Building2 size={12} /> {b.gosala}
                        </div>
                        <div className="text-[11.5px] text-ink flex items-center gap-1 mt-0.5">
                          <User size={12} className="text-ink-faint" /> {driverObj.driver}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{driverObj.model}</div>
                        <div className="font-mono text-[11px] text-ink-faint">{driverObj.plate}</div>
                      </td>

                      <td className="px-4 py-3 font-mono text-ink">
                        <div>{b.distanceKm} km</div>
                        <div className="text-[10.5px] text-ink-faint">Odometer Verified</div>
                      </td>

                      <td className="px-4 py-3 font-mono font-medium text-ink tabular">
                        {inr(transportFee)}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-emerald-800 tabular">
                        +{inr(transportFee)}
                      </td>

                      <td className="px-4 py-3 font-mono text-ink-faint tabular">
                        ₹0 (0%)
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-mono bg-forest-soft text-forest px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 size={11} /> 100% Pass-Through
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* =========================================================================
          VIEW 4: GOMAA PLATFORM FEE (CONCISE TOP-LEVEL INFO OF CUTTINGS ONLY)
          ========================================================================= */}
      {activeCategory === "platform" && (
        <Panel className="border-line bg-card shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-line bg-paper/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-[19px] text-ink font-bold flex items-center gap-2">
                  <ShieldCheck size={19} className="text-blue-700" />
                  <span>GOMAA Platform Fee & Operational Cuttings Overview</span>
                </h3>
                <p className="text-[12px] text-ink-faint mt-0.5">
                  Concise overview of the 20% platform cut on base ceremonies used to fund cow transit insurance, GPS telematics, customer care, and escrow compliance.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="font-mono text-[11px] text-blue-900 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded font-semibold">
                  20% Base Cap · ₹0 on Transport
                </span>
              </div>
            </div>

            {/* Top 3 High-Level Cuttings Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-blue-900 font-medium flex items-center justify-between">
                  <span>Total Platform Cuttings</span>
                  <ShieldCheck size={14} className="text-blue-700" />
                </div>
                <div className="font-serif text-[22px] font-bold text-blue-950 tabular">
                  {inr(totalGomaaCommission)}
                </div>
                <div className="text-[11px] text-blue-800">
                  Avg {effectiveCommissionPct}% across entire gross volume
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>Capping Rule</span>
                  <Receipt size={14} className="text-ink-soft" />
                </div>
                <div className="font-serif text-[22px] font-bold text-ink tabular">
                  20% Max on Base
                </div>
                <div className="text-[11px] text-forest font-medium">
                  ₹0 taken from transport logistics
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-line bg-card shadow-2xs space-y-1">
                <div className="text-[11px] font-mono uppercase text-ink-faint font-medium flex items-center justify-between">
                  <span>Strategic Allocation</span>
                  <Coins size={14} className="text-ink-soft" />
                </div>
                <div className="font-serif text-[22px] font-bold text-ink tabular">
                  4 Protection Pools
                </div>
                <div className="text-[11px] text-ink-soft">
                  Insurance, GPS, Desk & Escrow
                </div>
              </div>
            </div>

            {/* 4 Operational Cuttings Allocation Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <div className="p-3 rounded-lg border border-line bg-card shadow-2xs space-y-1">
                <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
                  <span>Cow Transit Insurance</span>
                  <span className="font-mono text-blue-800 font-bold">7% ({inr(poolInsurance)})</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Accident, heat stress, veterinary emergency cover & road hospitalization for sacred cattle.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-line bg-card shadow-2xs space-y-1">
                <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
                  <span>IoT GPS & Telemetry</span>
                  <span className="font-mono text-blue-800 font-bold">5% ({inr(poolGps)})</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Live vehicle telematics, route telemetry, cabin heat sensors & real-time dispatch map.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-line bg-card shadow-2xs space-y-1">
                <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
                  <span>Devotee Care Desk</span>
                  <span className="font-mono text-blue-800 font-bold">5% ({inr(poolCare)})</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Devotee support, Vedic calendar & Muhurat synchronization, Pandit booking verification.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-line bg-card shadow-2xs space-y-1">
                <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
                  <span>Escrow & Compliance</span>
                  <span className="font-mono text-blue-800 font-bold">3% ({inr(poolEscrow)})</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  RBI-compliant nodal escrow pool, Sunday auto-sweeps, AWBI compliance & audited receipts.
                </p>
              </div>
            </div>
          </div>

          {/* Top Info of Cuttings Summary Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[880px]">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left">
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Booking ID & Devotee
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Ceremony / Seva
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Devotee Payment
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Base Seva Amount
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
                    Platform Cutting (20%)
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-forest uppercase tracking-wider">
                    Net Credited to Trust
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Primary Operational Coverage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {relevantBookings.map((b) => {
                  const baseAndExtra = (b.base || 0) + (b.extraTime || 0)
                  const transport = b.transport || 0
                  const addons = b.addons || 0
                  const commissionPct = b.commissionPct || 20

                  const ritualCut = Math.round(baseAndExtra * (1 - commissionPct / 100))
                  const gaushalaNet = ritualCut + transport + Math.round(addons * 0.9)
                  const platformCut = (b.total || 0) - gaushalaNet
                  const serviceInfo = getBookingServiceInfo(b)

                  return (
                    <tr key={b.id} className="text-[12.5px] hover:bg-paper/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[12px] font-semibold text-ink">{b.id}</div>
                        <div className="text-[11.5px] text-ink-soft">{b.customer}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{serviceInfo.title}</div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-medium ${serviceInfo.badgeClass}`}>
                          {serviceInfo.badge}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono font-medium text-ink tabular">
                        {inr(b.total)}
                      </td>

                      <td className="px-4 py-3 font-mono text-ink-soft tabular">
                        {inr(baseAndExtra)}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-blue-800 tabular">
                        −{inr(platformCut)}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-forest tabular">
                        {inr(gaushalaNet)}
                      </td>

                      <td className="px-4 py-3 text-[11px] text-ink-faint font-mono">
                        Insurance (7%) · GPS (5%) · Care Desk (5%) · Escrow (3%)
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ----------------- SHARED BOTTOM DETAILS SECTION (BANK & HISTORICAL BATCHES) ----------------- */}
      <Panel className="p-6 border-line bg-card shadow-xs overflow-hidden mt-6">
        <div className="space-y-6">
          {/* Sub-section A: Verified Trust Bank Account Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-line bg-card shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold flex items-center gap-1.5">
                  <Landmark size={14} /> Verified Charity Trust Bank Account
                </span>
                <span className="text-[10.5px] font-mono bg-forest/10 text-forest border border-forest/20 px-2 py-0.5 rounded-full font-medium">
                  Active Direct Credit
                </span>
              </div>
              <div className="pt-1 space-y-1 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-ink-faint">Account Beneficiary:</span>
                  <strong className="text-ink font-medium">
                    {activeBank.beneficiary}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-faint">Bank & Branch:</span>
                  <span className="font-medium text-ink">
                    {activeBank.bankName}
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[12px]">
                  <span className="text-ink-faint font-sans">Account Number:</span>
                  <span className="text-ink font-semibold">{activeBank.accountMasked}</span>
                </div>
                <div className="flex justify-between font-mono text-[12px]">
                  <span className="text-ink-faint font-sans">IFSC Code:</span>
                  <span className="text-ink font-mono">{activeBank.ifsc}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-line bg-card shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold flex items-center gap-1.5">
                  <Calendar size={14} /> Automated Settlement Schedule
                </span>
                <span className="text-[10.5px] font-mono bg-saffron/15 text-saffron-deep px-2 py-0.5 rounded-full font-medium">
                  Weekly Auto-Sweep
                </span>
              </div>
              <div className="pt-1 space-y-1 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-ink-faint">Disbursement Cycle:</span>
                  <span className="text-ink font-medium">{activeBank.cycle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-faint">Disbursement Mode:</span>
                  <span className="font-medium text-ink">Direct RBI NEFT / Instant IMPS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-faint">Escrow Custodian Pool:</span>
                  <span className="text-ink font-mono text-[12px]">ICICI Nodal Trust Escrow</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-faint">Next Scheduled Batch:</span>
                  <strong className="text-forest font-semibold">Upcoming Sunday Midnight</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-section B: Recent Settlement Payout Batches (Audit Log) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                  <Clock size={16} className="text-forest" />
                  <span>Recent Settlement Payout Batches</span>
                </h4>
                <p className="text-[11.5px] text-ink-faint">
                  Historical banking dispatches credited directly to the Gaushala Trust account
                </p>
              </div>
              <button
                onClick={() => notify("All historical settlement advice archives downloaded", "ok")}
                className="text-[12px] font-medium text-forest hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download size={13} /> Export All Payout Advice (CSV)
              </button>
            </div>

            {dynamicBatches.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-line rounded-xl bg-paper/40 space-y-2">
                <div className="w-10 h-10 rounded-full bg-forest-soft text-forest mx-auto flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div className="font-serif text-[15px] font-semibold text-ink">
                  No Settlement Payout Batches Dispatched Yet
                </div>
                <p className="text-[12px] text-ink-faint max-w-md mx-auto">
                  Completed devotee sevas are aggregated into weekly Sunday midnight automated settlement batches and dispatched via direct RBI NEFT/IMPS to the verified Trust bank account.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {dynamicBatches.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-lg border border-line bg-card p-3.5 space-y-2 hover:border-line-strong transition shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-ink-faint font-semibold">
                        {b.id}
                      </span>
                      <span className="text-[10px] font-mono bg-forest-soft text-forest px-1.5 py-0.5 rounded font-medium">
                        {b.status}
                      </span>
                    </div>
                    <div>
                      <div className="font-serif text-[18px] text-ink font-bold tabular">
                        {inr(b.gaushalaNet)}
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        {b.sevasCount} sevas · Gross {inr(b.gross)}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-line/60 text-[11px] text-ink-soft space-y-0.5 font-mono">
                      <div className="truncate">UTR: {b.utr}</div>
                      <div className="text-ink-faint text-[10.5px] font-sans">
                        {b.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

{/* ----------------- PER-GAUSHALA ACTIONS PERFORMED & NET SHARE POP-UP MODAL ----------------- */}
      {isPerGosalaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card rounded-2xl border border-line shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-paper-deep/80 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-forest/15 text-forest">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="font-serif text-[19px] text-ink font-bold flex items-center gap-2">
                    <span>
                      {currentRole === "manager"
                        ? `${currentGosalaName} Actions & Net Share Breakdown`
                        : "Per-Gaushala Actions Performed & Net Share Breakdown"}
                    </span>
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    {currentRole === "manager"
                      ? `Specific verified seva rituals completed by ${currentGosalaName}, cattle deployed, transit distances, and the exact money earned for your trust.`
                      : "Specific actions completed by each shelter, cattle deployed, transit distances, and the exact money earned for each trust."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPerGosalaModalOpen(false)}
                className="p-1.5 rounded-full text-ink-faint hover:text-ink hover:bg-paper transition cursor-pointer"
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub-Header / Gaushala Filter Tabs (Hidden for single-facility manager) */}
            {currentRole !== "manager" && (
              <div className="px-6 py-2.5 bg-paper/60 border-b border-line flex items-center gap-2 overflow-x-auto">
                <span className="text-[11.5px] font-mono text-ink-faint uppercase font-medium mr-1 shrink-0">
                  Filter Shelter:
                </span>
                <button
                  onClick={() => setModalSelectedGosala("ALL")}
                  className={`px-3 py-1 rounded-md text-[12px] font-medium transition cursor-pointer whitespace-nowrap ${
                    modalSelectedGosala === "ALL"
                      ? "bg-forest text-white shadow-2xs font-semibold"
                      : "bg-card border border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  All Shelters Overview ({gosalaBreakdownList.length})
                </button>
                {gosalaBreakdownList.map((g) => {
                  const isTabActive = modalSelectedGosala.toLowerCase() === g.name.toLowerCase()
                  return (
                    <button
                      key={g.name}
                      onClick={() => setModalSelectedGosala(g.name)}
                      className={`px-3 py-1 rounded-md text-[12px] font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        isTabActive
                          ? "bg-forest text-white shadow-2xs font-semibold"
                          : "bg-card border border-line text-ink-soft hover:text-ink"
                      }`}
                    >
                      <span>{g.name}</span>
                      <span className={`text-[10.5px] font-mono px-1.5 py-0.2 rounded ${isTabActive ? "bg-white/20 text-white" : "bg-forest-soft text-forest"}`}>
                        {inr(g.netShare)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Modal Body: Scrollable Grid */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {gosalaBreakdownList
                  .filter((g) =>
                    currentRole === "manager"
                      ? g.name.toLowerCase() === currentGosalaName.toLowerCase()
                      : modalSelectedGosala === "ALL"
                      ? true
                      : g.name.toLowerCase() === modalSelectedGosala.toLowerCase(),
                  )
                  .map((g) => {
                    const isFilterSelected =
                      activeGosalaFilter.toLowerCase() === g.name.toLowerCase()
                    const isActionsExpanded = expandedGosalaActionId === g.name

                    return (
                      <div
                        key={g.name}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden bg-card ${
                          isFilterSelected
                            ? "border-forest ring-2 ring-forest/30 shadow-md"
                            : "border-line hover:border-line-strong shadow-2xs"
                        }`}
                      >
                        {/* Header Strip with Gaushala Trust identity */}
                        <div className="p-4 bg-paper/60 border-b border-line/70">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-serif text-[16.5px] text-ink font-bold flex items-center gap-2">
                                <span>{g.name}</span>
                                {isFilterSelected && (
                                  <span className="text-[10px] font-mono uppercase bg-forest text-white px-2 py-0.5 rounded-full font-medium">
                                    Active Scope
                                  </span>
                                )}
                              </h4>
                              <div className="text-[11.5px] text-ink-faint mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>{g.gosalaObj?.trustRegistrationNo || "AWBI Reg: MAH-PUN-0421"}</span>
                                <span>•</span>
                                <span>Caretaker: {g.gosalaObj?.caretaker || "Rameshwar Shastri"}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10.5px] font-mono text-ink-faint uppercase block">
                                Net Share Credited
                              </span>
                              <span className="font-serif text-[22px] font-bold text-forest tabular block">
                                {inr(g.netShare)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Body: Completed Actions Summary & Financial Formula */}
                        <div className="p-4 space-y-3 text-[12.5px]">
                          {/* Actions Completed Pill Grid */}
                          <div>
                            <span className="text-[11px] font-mono uppercase text-ink-faint block mb-1.5 font-medium">
                              Actions Completed by this Shelter
                            </span>
                            <div className="grid grid-cols-2 gap-2 text-[12px]">
                              <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                                <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                                  ✓
                                </span>
                                <div>
                                  <div className="font-semibold text-ink">{g.sevasCount} Sevas</div>
                                  <div className="text-[10.5px] text-ink-faint">Completed successfully</div>
                                </div>
                              </div>

                              <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                                <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                                  ✓
                                </span>
                                <div>
                                  <div className="font-semibold text-ink">{g.totalKm.toFixed(1)} km Transit</div>
                                  <div className="text-[10.5px] text-ink-faint">0 Heat stress incidents</div>
                                </div>
                              </div>

                              <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                                <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                                  ✓
                                </span>
                                <div>
                                  <div className="font-semibold text-ink">{g.animals.size || 2} Cattle Deployed</div>
                                  <div className="text-[10.5px] text-ink-faint truncate max-w-[120px]">
                                    {Array.from(g.animals).join(", ") || (animals.filter((a) => a.gosala?.toLowerCase() === g.name.toLowerCase()).map((a) => a.name).join(", ")) || "Sacred Cattle"}
                                  </div>
                                </div>
                              </div>

                              <div className="p-2 rounded bg-paper-deep border border-line flex items-center gap-2">
                                <span className="h-5 w-5 rounded-full bg-forest/15 text-forest flex items-center justify-center font-bold text-[10px] shrink-0">
                                  ✓
                                </span>
                                <div>
                                  <div className="font-semibold text-ink">100% Feeding Protocol</div>
                                  <div className="text-[10.5px] text-ink-faint">Organic grass logged</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Financial Net Share Breakdown for this Gaushala */}
                          <div className="p-3 rounded-lg bg-forest-soft/30 border border-forest/20 space-y-1.5 text-[12px]">
                            <div className="flex items-center justify-between text-ink-soft">
                              <span>Gross Devotee Volume:</span>
                              <span className="font-mono text-ink font-medium">{inr(g.gross)}</span>
                            </div>
                            <div className="flex items-center justify-between text-emerald-800">
                              <span>Transport Pass-Through (100% to this Gaushala):</span>
                              <span className="font-mono font-medium">+{inr(g.transport)}</span>
                            </div>
                            {g.addons > 0 && (
                              <div className="flex items-center justify-between text-ink-soft">
                                <span>Puja Samagri Add-ons (90% to this Gaushala):</span>
                                <span className="font-mono font-medium">+{inr(g.addons)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-ink-faint text-[11.5px]">
                              <span>Platform Operations Fee Deducted (20%):</span>
                              <span className="font-mono">−{inr(g.platformFee)}</span>
                            </div>
                            <div className="pt-1.5 border-t border-forest/30 flex items-center justify-between font-bold text-forest text-[13px]">
                              <span>Specific Net Earned by this Gaushala:</span>
                              <span className="font-mono text-[15px]">{inr(g.netShare)}</span>
                            </div>
                          </div>

                          {/* Expandable itemized action list */}
                          {g.actions.length > 0 && (
                            <div>
                              <button
                                onClick={() =>
                                  setExpandedGosalaActionId(
                                    isActionsExpanded ? null : g.name,
                                  )
                                }
                                className="text-[11.5px] font-medium text-forest hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {isActionsExpanded
                                  ? "Hide specific seva actions ▲"
                                  : `View all ${g.actions.length} individual actions & payments ▼`}
                              </button>

                              {isActionsExpanded && (
                                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto p-2 rounded bg-paper border border-line text-[11.5px] animate-fade-in">
                                  {g.actions.map((act) => (
                                    <div
                                      key={act.bookingId}
                                      className="p-2 rounded bg-card border border-line flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-semibold text-ink flex items-center gap-1.5">
                                          <span>{act.customer}</span>
                                          <span className="text-[10px] font-mono text-ink-faint">({act.bookingId})</span>
                                        </div>
                                        <div className="text-ink-soft text-[11px] truncate">
                                          {act.ritual} · Cow: {act.animal} ({act.distanceKm} km with {act.driver})
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="font-mono font-semibold text-forest">
                                          +{inr(act.netShare)}
                                        </div>
                                        <div className="text-[10px] text-ink-faint">{act.date}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action row */}
                          <div className="flex items-center justify-between pt-2 border-t border-line/60">
                            <span className="text-[11px] font-mono text-ink-faint">
                              Disburses to: {getGaushalaBankDetails(g.name, g.gosalaObj).bankName.split("·")[0]} A/C {getGaushalaBankDetails(g.name, g.gosalaObj).accountMasked}
                            </span>
                            {currentRole === "manager" ? (
                              <span className="text-[11px] font-semibold text-forest bg-forest-soft border border-forest/20 px-2.5 py-0.5 rounded shadow-2xs">
                                🔒 Dedicated Shelter Lock
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveGosalaFilter(g.name)
                                  setIsPerGosalaModalOpen(false)
                                  notify(`Filtered ledger to ${g.name}`, "ok")
                                }}
                                className="px-3 py-1 rounded bg-paper-deep hover:bg-forest hover:text-white border border-line text-ink text-[11.5px] font-medium transition cursor-pointer shadow-2xs"
                              >
                                Filter Ledger to this Gaushala →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-paper-deep border-t border-line">
              <div className="text-[12px] text-ink-soft">
                Total portfolio net share: <strong className="font-mono text-forest">{inr(totalGaushalaNet)}</strong> (across {gosalaBreakdownList.length} registered shelters)
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => notify("Consolidated Gaushala Trust statement downloaded", "ok")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-line bg-card hover:bg-paper-deep text-ink text-[12px] font-medium transition cursor-pointer shadow-2xs"
                >
                  <Download size={13} /> Download Statement
                </button>
                <button
                  onClick={() => setIsPerGosalaModalOpen(false)}
                  className="px-4 py-1.5 rounded bg-forest text-white text-[12px] font-medium hover:bg-forest-deep transition cursor-pointer shadow-2xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: OFFICIAL SEVA VOUCHER / RECEIPT PREVIEW ----------------- */}
      {receiptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-lg overflow-hidden my-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-paper-deep border-b border-line">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-forest" />
                <h3 className="font-serif text-[17px] text-ink font-semibold">
                  Official Gaushala Trust Seva Voucher
                </h3>
              </div>
              <button
                onClick={() => setReceiptBooking(null)}
                className="p-1 rounded-full text-ink-faint hover:text-ink hover:bg-card transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-5 text-[13px] bg-paper/30">
              {/* Trust Letterhead dynamically resolved */}
              {(() => {
                const rGosala = gosalas.find(g => g.name.toLowerCase() === receiptBooking.gosala.toLowerCase())
                const rBank = getGaushalaBankDetails(receiptBooking.gosala, rGosala)
                return (
                  <div className="text-center pb-4 border-b border-line/80 space-y-1">
                    <div className="font-serif text-[20px] text-ink font-bold text-forest">
                      {receiptBooking.gosala}
                    </div>
                    <div className="text-[11.5px] text-ink-soft">
                      Registered Animal Welfare Trust · AWBI Reg: {rGosala?.trustRegistrationNo || rBank.regNo}
                    </div>
                    <div className="text-[11px] font-mono text-ink-faint">
                      {rGosala?.address || "Registered Goseva Sanctum, Maharashtra"}
                    </div>
                  </div>
                )
              })()}

              {/* Devotee & Ceremony Credentials */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-card border border-line text-[12px]">
                <div>
                  <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                    Devotee Name
                  </span>
                  <strong className="text-ink">{receiptBooking.customer}</strong>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                    Voucher ID
                  </span>
                  <strong className="font-mono text-forest">{receiptBooking.id}</strong>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                    Executing Gaushala
                  </span>
                  <strong className="text-forest">{receiptBooking.gosala}</strong>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                    Ceremony Purpose
                  </span>
                  <span className="text-ink">
                    {receiptBooking.ritualPurpose || "Griha Pravesh & Kamadhenu Puja"}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                    Sacred Cow Assigned
                  </span>
                  <span className="text-saffron-deep font-semibold">
                    {receiptBooking.animal} ({receiptBooking.animalType})
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-mono text-ink-faint block">
                    Transport Route
                  </span>
                  <span className="text-ink font-medium">
                    {receiptBooking.distanceKm} km · {receiptBooking.driver || "Sunil Pawar"}
                  </span>
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="space-y-2 border-t border-b border-line py-3">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Base Ritual Muhurat Seva</span>
                  <span className="font-mono font-medium text-ink">
                    {inr(receiptBooking.base)}
                  </span>
                </div>
                {receiptBooking.extraTime > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Extended Ceremony Duration</span>
                    <span className="font-mono text-ink">
                      +{inr(receiptBooking.extraTime)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-800">
                  <span>Transit Distance Pass-Through (100% to {receiptBooking.gosala})</span>
                  <span className="font-mono font-medium">
                    +{inr(receiptBooking.transport)}
                  </span>
                </div>
                {receiptBooking.addons > 0 && (
                  <div className="flex justify-between text-ink-soft">
                    <span>Ceremonial Puja Samagri (90% to {receiptBooking.gosala})</span>
                    <span className="font-mono">
                      +{inr(Math.round(receiptBooking.addons * 0.9))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-ink-faint text-[12px]">
                  <span>GOMAA Platform 20% Operations Deduction</span>
                  <span className="font-mono">
                    −{inr(
                      receiptBooking.total -
                        (Math.round(
                          ((receiptBooking.base || 0) +
                            (receiptBooking.extraTime || 0)) *
                            0.8,
                        ) +
                          receiptBooking.transport +
                          Math.round(receiptBooking.addons * 0.9)),
                    )}
                  </span>
                </div>
                <div className="pt-2 border-t border-line flex justify-between font-bold text-forest text-[14px]">
                  <span>Net Credited to {receiptBooking.gosala} Trust</span>
                  <span className="font-mono">
                    {inr(
                      Math.round(
                        ((receiptBooking.base || 0) +
                          (receiptBooking.extraTime || 0)) *
                          0.8,
                      ) +
                        receiptBooking.transport +
                        Math.round(receiptBooking.addons * 0.9),
                    )}
                  </span>
                </div>
              </div>

              {/* Digital Seal */}
              <div className="flex items-center justify-between text-[11px] text-ink-faint pt-1">
                <div>
                  UTR: {getGaushalaBankDetails(receiptBooking.gosala).ifsc.slice(0, 4)}N262489{receiptBooking.id.replace(/\D/g, "").slice(0, 4)}
                </div>
                <div className="text-forest font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Escrow Released & Audited
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-paper-deep border-t border-line">
              <button
                onClick={() => {
                  window.print()
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-line bg-card hover:bg-paper-deep text-ink text-[12.5px] font-medium transition cursor-pointer"
              >
                <Printer size={14} /> Print Voucher
              </button>
              <button
                onClick={() => {
                  notify(`Official receipt for ${receiptBooking.id} downloaded`, "ok")
                  setReceiptBooking(null)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-forest text-white text-[12.5px] font-medium hover:bg-forest-deep transition cursor-pointer shadow-xs"
              >
                <Download size={14} /> Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
