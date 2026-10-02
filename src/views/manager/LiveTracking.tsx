import { useState, useMemo } from "react"
import {
  Navigation,
  MapPin,
  Truck,
  Phone,
  Clock,
  ShieldCheck,
  HeartPulse,
  Radio,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  Gauge,
  Compass,
  Building2,
  User,
  AlertCircle,
  X,
  Check,
  Eye,
  Droplets,
  Thermometer,
} from "lucide-react"
import { inr, type Booking } from "../../data/mock"
import { type Animal } from "../../data/animals"
import { useStore, useToast } from "../../store/store"
import { Panel } from "../../lib/ui"
import LiveTripMap from "../../components/LiveTripMap"
import { api } from "../../services/api"
import { useRealtime } from "../../hooks/useRealtime"

// Easy, understandable steps for Gaushala managers & gosevaks
// Simple, practical words replacing complex corporate jargon
const tripStepDescriptions = [
  {
    id: 0,
    label: "Driver Assigned",
    desc: "Driver assigned to vehicle for this trip",
  },
  {
    id: 1,
    label: "Coming to Gaushala",
    desc: "Driver is driving vehicle to Gaushala gate",
  },
  {
    id: 2,
    label: "Vehicle at Gaushala",
    desc: "Vehicle arrived at Gaushala; health & water check before departure",
  },
  {
    id: 3,
    label: "Cow Boarded (Gate 1)",
    desc: "Cow walked safely onto vehicle using padded non-slip ramp",
  },
  {
    id: 4,
    label: "Travelling to Devotee",
    desc: "Vehicle is on the road driving gently to devotee's home",
  },
  {
    id: 5,
    label: "Reached Devotee's House",
    desc: "Arrived at devotee's house; cow walked down gently",
  },
  {
    id: 6,
    label: "Puja Ceremony Going On",
    desc: "Sacred Gau Puja taking place at devotee's courtyard",
  },
  {
    id: 7,
    label: "Puja Finished",
    desc: "Aarti finished, water and fresh grass offered to cow",
  },
  {
    id: 8,
    label: "Returning to Gaushala",
    desc: "Cow is travelling safely on vehicle back to Gaushala",
  },
  {
    id: 9,
    label: "Back in Gaushala (Gate 2)",
    desc: "Cow safely back in Gaushala shed · Resting & water time (90m break)",
  },
]

export default function LiveTracking() {
  const {
    bookings,
    animals,
    advanceTrip,
    updateAnimalStatus,
    activeGosalaFilter,
    currentRole,
  } = useStore()
  const { notify } = useToast()

  // Scoped animals: strictly locked to manager's Gaushala, or all for admin
  const visibleAnimals = useMemo(() => {
    if (
      currentRole === "manager" &&
      activeGosalaFilter &&
      activeGosalaFilter !== "ALL"
    ) {
      const filtered = animals.filter(
        (a) => a.gosala.toLowerCase() === activeGosalaFilter.toLowerCase(),
      )
      return filtered.length > 0 ? filtered : animals
    }
    return animals
  }, [animals, currentRole, activeGosalaFilter])

  // Filter tabs for animal list: 'all', 'barn' (in gaushala), 'active' (travelling on road), 'puja' (at devotee house)
  type FleetFilter = "all" | "barn" | "active" | "puja"
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>("all")

  // Toggle to view the road route map even when cow is currently resting in Gaushala
  const [showRoutePreview, setShowRoutePreview] = useState(false)

  // Emergency Help Modal State
  const [sosModalOpen, setSosModalOpen] = useState(false)
  const [sosReason, setSosReason] = useState(
    "Cow looks tired or stressed from heat / travel",
  )
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [mobileView, setMobileView] = useState<"map" | "roster">("map")

  // Selectable Animal by name (Animals are uniquely identified by name across GOMAA)
  const [selectedAnimalName, setSelectedAnimalName] = useState<string>(() => {
    // Default to the first animal on trip if available, or first in list
    const firstActive = animals.find((a) => {
      if (a.status === "In Transit" || a.status === "In Seva") return true
      const b = bookings.find(
        (bk) =>
          bk.animal.toLowerCase() === a.name.toLowerCase() &&
          bk.status !== "Rejected" &&
          bk.status !== "Cancelled" &&
          bk.driverStage !== undefined &&
          bk.driverStage >= 4 &&
          bk.driverStage <= 8,
      )
      return !!b
    })
    return firstActive?.name || animals[0]?.name || "Gauri"
  })

  // Current selected animal object (100% reactive to selectedAnimalName)
  const selectedAnimal: Animal = useMemo(() => {
    return (
      visibleAnimals.find(
        (a) => a.name.toLowerCase() === selectedAnimalName.toLowerCase(),
      ) ||
      visibleAnimals[0] ||
      animals[0]
    )
  }, [visibleAnimals, animals, selectedAnimalName])

  // Associated booking for the selected animal
  const matchedBooking = useMemo(() => {
    if (!selectedAnimal) return null
    // 1. Look for active in-progress road trip
    const activeTrip = bookings.find(
      (b) =>
        b.animal.toLowerCase() === selectedAnimal.name.toLowerCase() &&
        b.status !== "Rejected" &&
        b.status !== "Cancelled" &&
        (b.status === "In Service" ||
          b.status === "En Route" ||
          b.status === "At Altar" ||
          (b.driverStage !== undefined &&
            b.driverStage >= 3 &&
            b.driverStage <= 8)),
    )
    if (activeTrip) return activeTrip

    // 2. Look for scheduled / confirmed upcoming booking
    const scheduled = bookings.find(
      (b) =>
        b.animal.toLowerCase() === selectedAnimal.name.toLowerCase() &&
        b.status !== "Rejected" &&
        b.status !== "Cancelled" &&
        (b.status === "Confirmed" ||
          b.status === "Driver Assigned" ||
          b.status === "Admin Review"),
    )
    if (scheduled) return scheduled

    // 3. Fallback to any recent booking for this animal
    return (
      bookings.find(
        (b) =>
          b.animal.toLowerCase() === selectedAnimal.name.toLowerCase() &&
          b.status !== "Rejected" &&
          b.status !== "Cancelled",
      ) || null
    )
  }, [selectedAnimal, bookings])

  // Identify whether the animal is currently travelling on road
  const isAnimalOnRoad = useMemo(() => {
    if (!selectedAnimal) return false
    if (selectedAnimal.status === "In Transit") return true
    if (
      matchedBooking &&
      matchedBooking.driverStage !== undefined &&
      (matchedBooking.driverStage === 4 || matchedBooking.driverStage === 8)
    ) {
      return true
    }
    return false
  }, [selectedAnimal, matchedBooking])

  // Identify whether the animal is currently at devotee house doing puja
  const isAnimalInPuja = useMemo(() => {
    if (!selectedAnimal) return false
    if (selectedAnimal.status === "In Seva") return true
    if (
      matchedBooking &&
      matchedBooking.driverStage !== undefined &&
      (matchedBooking.driverStage === 5 ||
        matchedBooking.driverStage === 6 ||
        matchedBooking.driverStage === 7)
    ) {
      return true
    }
    return false
  }, [selectedAnimal, matchedBooking])

  // Whether animal is away from Gaushala (either on road or at puja)
  const isAwayFromGaushala = isAnimalOnRoad || isAnimalInPuja

  const stageIndex =
    matchedBooking?.driverStage ?? (isAnimalInPuja ? 6 : isAnimalOnRoad ? 4 : 0)

  // Real-time telemetry hook for selected booking
  useRealtime({ bookingId: matchedBooking?.id })

  // Telemetry simulation values (dynamically resolved)
  const simulatedSpeed =
    stageIndex === 4 || stageIndex === 8
      ? 32
      : stageIndex === 5 || stageIndex === 6
        ? 0
        : 22
  const simulatedHeading =
    stageIndex === 8
      ? "Returning to Gaushala (South-West)"
      : "Going to Devotee's House (North-East)"
  const simulatedTemp = 28

  // Helper when clicking top KPI cards to filter roster and pick first matching animal
  const handleKpiClick = (filter: FleetFilter) => {
    setFleetFilter(filter)
    setShowRoutePreview(false)

    const matchingAnimals = animals.filter((a) => {
      const onRoad =
        a.status === "In Transit" ||
        bookings.some(
          (b) =>
            b.animal.toLowerCase() === a.name.toLowerCase() &&
            b.status !== "Rejected" &&
            b.status !== "Cancelled" &&
            (b.driverStage === 4 || b.driverStage === 8),
        )
      const inPuja =
        a.status === "In Seva" ||
        bookings.some(
          (b) =>
            b.animal.toLowerCase() === a.name.toLowerCase() &&
            b.status !== "Rejected" &&
            b.status !== "Cancelled" &&
            (b.driverStage === 5 || b.driverStage === 6 || b.driverStage === 7),
        )

      if (filter === "barn") return !onRoad && !inPuja
      if (filter === "active") return onRoad
      if (filter === "puja") return inPuja
      return true
    })

    if (matchingAnimals.length > 0) {
      const alreadyIncluded = matchingAnimals.some(
        (a) => a.name.toLowerCase() === selectedAnimalName.toLowerCase(),
      )
      if (!alreadyIncluded) {
        setSelectedAnimalName(matchingAnimals[0].name)
      }
    }
  }

  // Handler to step to next trip stage from manager desk
  const handleNextStep = async () => {
    if (!matchedBooking) return
    setIsAdvancing(true)
    try {
      const nextStage = Math.min(9, stageIndex + 1)
      await api.setTripStage(matchedBooking.id, nextStage)
      advanceTrip(matchedBooking.id)

      if (nextStage >= 4 && nextStage <= 5) {
        updateAnimalStatus(selectedAnimal.name, "In Transit")
      } else if (nextStage === 6) {
        updateAnimalStatus(selectedAnimal.name, "In Seva")
      } else if (nextStage >= 7 && nextStage <= 8) {
        updateAnimalStatus(selectedAnimal.name, "In Transit")
      } else if (nextStage === 9) {
        updateAnimalStatus(selectedAnimal.name, "Resting Buffer")
      }

      notify(
        `Step updated to: ${tripStepDescriptions[nextStage]?.label || `Step ${nextStage}`}`,
        "ok",
      )
    } catch (e: any) {
      notify(e.message || "Failed to update step", "err")
    } finally {
      setIsAdvancing(false)
    }
  }

  // Handler to start trip (cow leaves Gaushala for devotee house)
  const handleStartTrip = async () => {
    if (!matchedBooking) {
      notify(
        `Please ensure a confirmed booking is assigned to ${selectedAnimal.name} before starting trip`,
        "warn",
      )
      return
    }
    setIsAdvancing(true)
    try {
      await api.setTripStage(matchedBooking.id, 4) // Step 4: Travelling to Devotee
      updateAnimalStatus(selectedAnimal.name, "In Transit")
      notify(
        `Trip Started: ${selectedAnimal.name} is now travelling on vehicle with padded ramp. Live GPS map active!`,
        "ok",
      )
    } catch (e: any) {
      notify(e.message || "Failed to start trip", "err")
    } finally {
      setIsAdvancing(false)
    }
  }

  // Handler to test/jump to a specific step
  const handleSetSpecificStage = async (targetStage: number) => {
    if (!matchedBooking) return
    try {
      await api.setTripStage(matchedBooking.id, targetStage)
      if (targetStage >= 4 && targetStage <= 5) {
        updateAnimalStatus(selectedAnimal.name, "In Transit")
      } else if (targetStage === 6) {
        updateAnimalStatus(selectedAnimal.name, "In Seva")
      } else if (targetStage === 9) {
        updateAnimalStatus(selectedAnimal.name, "Resting Buffer")
      } else {
        updateAnimalStatus(selectedAnimal.name, "Available")
      }
      notify(`Trip set to: ${tripStepDescriptions[targetStage]?.label}`, "ok")
    } catch (e: any) {
      notify(e.message || "Failed to update step", "err")
    }
  }

  const handleTriggerEmergencySOS = () => {
    notify(
      `🚨 EMERGENCY HELP CALLED: Gaushala Senior Doctor and backup cattle vehicle alerted for ${selectedAnimal.name}.`,
      "danger",
    )
    setSosModalOpen(false)
  }

  // Filtered animal roster list
  const filteredAnimals = visibleAnimals.filter((a) => {
    const onRoad =
      a.status === "In Transit" ||
      bookings.some(
        (b) =>
          b.animal.toLowerCase() === a.name.toLowerCase() &&
          b.status !== "Rejected" &&
          b.status !== "Cancelled" &&
          (b.driverStage === 4 || b.driverStage === 8),
      )
    const inPuja =
      a.status === "In Seva" ||
      bookings.some(
        (b) =>
          b.animal.toLowerCase() === a.name.toLowerCase() &&
          b.status !== "Rejected" &&
          b.status !== "Cancelled" &&
          (b.driverStage === 5 || b.driverStage === 6 || b.driverStage === 7),
      )

    if (fleetFilter === "barn") return !onRoad && !inPuja
    if (fleetFilter === "active") return onRoad
    if (fleetFilter === "puja") return inPuja
    return true
  })

  // Summary counts
  const totalFleetCount = visibleAnimals.length
  const inTransitCount = visibleAnimals.filter(
    (a) =>
      a.status === "In Transit" ||
      bookings.some(
        (b) =>
          b.animal.toLowerCase() === a.name.toLowerCase() &&
          b.status !== "Rejected" &&
          b.status !== "Cancelled" &&
          (b.driverStage === 4 || b.driverStage === 8),
      ),
  ).length

  const inSevaCount = visibleAnimals.filter(
    (a) =>
      a.status === "In Seva" ||
      bookings.some(
        (b) =>
          b.animal.toLowerCase() === a.name.toLowerCase() &&
          b.status !== "Rejected" &&
          b.status !== "Cancelled" &&
          (b.driverStage === 5 || b.driverStage === 6 || b.driverStage === 7),
      ),
  ).length

  const inGaushalaBarnCount = totalFleetCount - inTransitCount - inSevaCount

  return (
    <div className="space-y-6">
      {/* ----------------- TOP METRIC KPI BANNER (CLICKABLE FILTERS) ----------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Cattle */}
        <button
          type="button"
          onClick={() => handleKpiClick("all")}
          className={`p-4 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
            fleetFilter === "all"
              ? "bg-gradient-to-br from-paper-deep/80 via-card to-card border-ink ring-2 ring-ink/20 shadow-md"
              : "bg-card border-line hover:border-line-strong hover:bg-paper-deep/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-ink-faint text-[11px] font-mono uppercase tracking-wider">
            <span className="font-semibold text-ink">Total Cattle</span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                fleetFilter === "all" ? "bg-ink" : "bg-forest"
              }`}
            />
          </div>
          <div className="font-serif text-[26px] text-ink font-semibold mt-1 flex items-baseline gap-1.5">
            <span>{totalFleetCount}</span>
            <span className="text-[12px] font-sans font-normal text-ink-faint">
              cows &amp; calves
            </span>
          </div>
          <div className="text-[11.5px] text-ink-faint mt-0.5 flex items-center justify-between">
            <span>All Gaushala animals</span>
            {fleetFilter === "all" && (
              <span className="text-[10px] font-mono font-bold text-ink bg-paper-deep px-1.5 py-0.5 rounded">
                Selected
              </span>
            )}
          </div>
        </button>

        {/* Card 2: Inside Gaushala */}
        <button
          type="button"
          onClick={() => handleKpiClick("barn")}
          className={`p-4 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
            fleetFilter === "barn"
              ? "bg-gradient-to-br from-forest-soft/70 via-card to-card border-forest ring-2 ring-forest/30 shadow-md"
              : "bg-card border-forest/30 hover:border-forest/60 hover:bg-forest-soft/10 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-forest text-[11px] font-mono uppercase tracking-wider font-semibold">
            <span>Inside Gaushala</span>
            <Building2 size={15} className="text-forest" />
          </div>
          <div className="font-serif text-[26px] text-forest font-semibold mt-1 flex items-baseline gap-1.5">
            <span>{inGaushalaBarnCount}</span>
            <span className="text-[12px] font-sans font-normal text-forest/70">
              in shed
            </span>
          </div>
          <div className="text-[11.5px] text-forest/90 mt-0.5 flex items-center justify-between">
            <span>Resting, eating &amp; ready</span>
            {fleetFilter === "barn" && (
              <span className="text-[10px] font-mono font-bold text-forest bg-forest-soft px-1.5 py-0.5 rounded">
                Selected
              </span>
            )}
          </div>
        </button>

        {/* Card 3: Travelling on Road */}
        <button
          type="button"
          onClick={() => handleKpiClick("active")}
          className={`p-4 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
            fleetFilter === "active"
              ? "bg-gradient-to-br from-saffron-soft/70 via-card to-card border-saffron ring-2 ring-saffron/30 shadow-md"
              : "bg-card border-saffron/30 hover:border-saffron/60 hover:bg-saffron-soft/10 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-saffron-deep text-[11px] font-mono uppercase tracking-wider font-semibold">
            <span>Travelling on Road</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-saffron opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-saffron"></span>
            </span>
          </div>
          <div className="font-serif text-[26px] text-saffron-deep font-semibold mt-1 flex items-baseline gap-1.5">
            <span>{inTransitCount}</span>
            <span className="text-[12px] font-sans font-normal text-saffron-deep/70">
              on way
            </span>
          </div>
          <div className="text-[11.5px] text-saffron-deep/90 mt-0.5 flex items-center justify-between">
            <span>On vehicle with GPS</span>
            {fleetFilter === "active" && (
              <span className="text-[10px] font-mono font-bold text-saffron-deep bg-saffron-soft px-1.5 py-0.5 rounded">
                Selected
              </span>
            )}
          </div>
        </button>

        {/* Card 4: At Puja (Devotee's House) */}
        <button
          type="button"
          onClick={() => handleKpiClick("puja")}
          className={`p-4 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
            fleetFilter === "puja"
              ? "bg-gradient-to-br from-amber-100/80 via-card to-card border-amber-500 ring-2 ring-amber-500/30 shadow-md"
              : "bg-card border-amber-300 hover:border-amber-400 hover:bg-amber-50/50 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 text-[11px] font-mono uppercase tracking-wider font-semibold">
            <span>At Puja (Devotee Home)</span>
            <Sparkles size={15} className="text-amber-600" />
          </div>
          <div className="font-serif text-[26px] text-amber-800 font-semibold mt-1 flex items-baseline gap-1.5">
            <span>{inSevaCount}</span>
            <span className="text-[12px] font-sans font-normal text-amber-700/70">
              in puja
            </span>
          </div>
          <div className="text-[11.5px] text-amber-800/90 mt-0.5 flex items-center justify-between">
            <span>Puja ceremony going on</span>
            {fleetFilter === "puja" && (
              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                Selected
              </span>
            )}
          </div>
        </button>
      </div>

      {/* ----------------- SIMPLE GAUSHALA SAFETY INFORMATION STRIP ----------------- */}
      <div className="bg-gradient-to-r from-forest/10 via-card to-card border border-forest/25 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px] shadow-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-forest text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
            <Radio size={16} className="animate-pulse" />
          </div>
          <div>
            <div className="font-semibold text-ink flex items-center gap-2 flex-wrap">
              <span>Complete Cow Safety &amp; Travel Tracking</span>
              <span className="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-full bg-forest-soft text-forest border border-forest/30">
                In Gaushala + Going for Puja + At Puja + Safe Return
              </span>
            </div>
            <p className="text-[11.5px] text-ink-soft mt-0.5 leading-snug">
              Devotees can only track the cow until it arrives at their house
              for puja. As Gaushala Manager, you have full view at all times:
              inside our Gaushala, travelling on the road, during puja, the
              journey back, and rest time.
            </p>
          </div>
        </div>

        <button
          onClick={() => setSosModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-danger bg-danger-soft border border-danger/30 rounded hover:bg-danger hover:text-white transition-all shadow-2xs shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <AlertCircle size={14} /> 🚨 Emergency Help (Doctor &amp; Van)
        </button>
      </div>

      {/* Mobile Mode Switcher: Live Map vs. Cattle Roster */}
      <div className="lg:hidden flex items-center p-1 bg-card border border-line rounded-lg text-[13px] font-medium">
        <button
          type="button"
          onClick={() => setMobileView("map")}
          className={`flex-1 py-2 text-center rounded-md transition-all cursor-pointer ${
            mobileView === "map"
              ? "bg-forest text-white shadow-xs font-semibold"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          Live Tracking Map
        </button>
        <button
          type="button"
          onClick={() => setMobileView("roster")}
          className={`flex-1 py-2 text-center rounded-md transition-all cursor-pointer ${
            mobileView === "roster"
              ? "bg-forest text-white shadow-xs font-semibold"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          Gaushala Cattle ({animals.length})
        </button>
      </div>

      {/* ----------------- MAIN TWO-COLUMN DASHBOARD ----------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Animal Fleet Roster (4 Cols) */}
        <div className={`lg:col-span-4 space-y-3 ${mobileView === "roster" ? "block" : "hidden lg:block"}`}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-serif text-[17px] text-ink font-semibold flex items-center gap-2">
              <span>Our Gaushala Cows</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-paper-deep text-ink-faint">
                {animals.length}
              </span>
            </h3>

            {/* Filter Pills with Simple Words */}
            <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5">
              {[
                { key: "all", label: "All Animals" },
                { key: "barn", label: "In Gaushala" },
                { key: "active", label: "Travelling" },
                { key: "puja", label: "At Puja" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleKpiClick(key as FleetFilter)}
                  className={`px-2.5 py-0.5 rounded font-medium transition-all cursor-pointer shrink-0 ${
                    fleetFilter === key
                      ? "bg-ink text-paper font-semibold shadow-2xs"
                      : "text-ink-faint hover:text-ink hover:bg-paper-deep"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {filteredAnimals.map((a) => {
              const isSelected =
                a.name.toLowerCase() === selectedAnimal.name.toLowerCase()
              const tripForAnimal = bookings.find(
                (b) =>
                  b.animal.toLowerCase() === a.name.toLowerCase() &&
                  b.status !== "Rejected" &&
                  b.status !== "Cancelled" &&
                  b.driverStage !== undefined &&
                  b.driverStage >= 4 &&
                  b.driverStage <= 8,
              )
              const hasTripOnRoad = !!tripForAnimal || a.status === "In Transit"
              const hasPujaUnderway =
                a.status === "In Seva" || tripForAnimal?.driverStage === 6
              const currentStepNum =
                tripForAnimal?.driverStage ??
                (hasPujaUnderway ? 6 : hasTripOnRoad ? 4 : 0)

              return (
                <div
                  key={a.name}
                  onClick={() => {
                    setSelectedAnimalName(a.name)
                    setShowRoutePreview(false)
                    setMobileView("map")
                  }}
                  className={`rounded-lg border p-3.5 transition-all cursor-pointer select-none ${
                    isSelected
                      ? "bg-gradient-to-r from-forest-soft/40 via-card to-card border-forest ring-1 ring-forest/30 shadow-md"
                      : "bg-card border-line hover:border-line-strong hover:bg-paper-deep/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={a.photo}
                      alt={a.name}
                      className="h-12 w-12 rounded-md object-cover border border-line shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-serif text-[15px] font-semibold text-ink truncate">
                          {a.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                            hasPujaUnderway
                              ? "bg-amber-100 text-amber-800 border border-amber-300 font-semibold"
                              : hasTripOnRoad
                                ? "bg-ok-soft text-ok border border-ok/30 animate-pulse font-semibold"
                                : a.status === "Resting Buffer"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : a.status === "Vet Care"
                                    ? "bg-danger-soft text-danger border border-danger/30"
                                    : "bg-forest-soft text-forest border border-forest/30"
                          }`}
                        >
                          {hasPujaUnderway
                            ? "At Puja (Doing Puja)"
                            : hasTripOnRoad
                              ? "Travelling on Road"
                              : a.status === "Available"
                                ? "In Gaushala"
                                : a.status === "Resting Buffer"
                                  ? "Resting (90m break)"
                                  : a.status}
                        </span>
                      </div>

                      <div className="text-[11.5px] text-ink-faint mt-0.5 truncate">
                        {a.type} ({a.category}) · Travel cap: up to{" "}
                        {a.maxRadiusKm} km
                      </div>

                      {hasTripOnRoad || hasPujaUnderway ? (
                        <div className="mt-2 pt-2 border-t border-line/60 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-forest font-medium truncate">
                            {tripForAnimal?.id || "Trip Active"} ·{" "}
                            {tripForAnimal?.customer || "Devotee Puja"}
                          </span>
                          <span className="font-mono text-ink-faint shrink-0 ml-1">
                            Step {currentStepNum}/9
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[11px] text-forest flex items-center gap-1.5 font-medium">
                          <Building2
                            size={12}
                            className="text-forest shrink-0"
                          />
                          <span className="truncate">
                            Inside our Gaushala shed
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Live Map or Dedicated In-Gaushala Barn Status (8 Cols) */}
        <div className={`lg:col-span-8 space-y-5 ${mobileView === "map" ? "block" : "hidden lg:block"}`}>
          {/* Selected Animal Header Strip */}
          <div className="bg-card border border-line rounded-lg p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedAnimal.photo}
                  alt={selectedAnimal.name}
                  className="h-14 w-14 rounded-md object-cover border border-line shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-[20px] text-ink font-semibold">
                      {selectedAnimal.name}
                    </h2>
                    <span className="text-[11px] font-sans font-medium bg-forest-soft text-forest px-2 py-0.5 rounded-full border border-forest/30">
                      {selectedAnimal.type} ·{" "}
                      {selectedAnimal.breed || "Gir Cow"}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-faint mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>
                      Gaushala: <strong>{selectedAnimal.gosala}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Travel limit:{" "}
                      <strong>Up to {selectedAnimal.maxRadiusKm} km</strong>
                    </span>
                  </p>
                </div>
              </div>

              {/* Status Indicator Pill */}
              <div className="text-left sm:text-right sm:border-l sm:border-line sm:pl-4">
                <div className="text-[11px] font-mono uppercase text-ink-faint">
                  Current Cow Location
                </div>
                {isAnimalInPuja ? (
                  <div className="inline-flex items-center gap-1.5 mt-0.5 text-amber-800 font-semibold text-[13px] bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                    <Sparkles size={13} className="text-amber-600" />
                    <span>
                      At Devotee's House · Doing Puja (Step {stageIndex}/9)
                    </span>
                  </div>
                ) : isAnimalOnRoad ? (
                  <div className="inline-flex items-center gap-1.5 mt-0.5 text-ok font-semibold text-[13px] bg-ok-soft px-2.5 py-1 rounded-full border border-ok/30">
                    <span className="h-2 w-2 rounded-full bg-ok animate-ping" />
                    <span>Travelling on Road · Step {stageIndex}/9</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 mt-0.5 text-forest font-semibold text-[13px] bg-forest-soft px-2.5 py-1 rounded-full border border-forest/30">
                    <Building2 size={13} className="text-forest" />
                    <span>Inside Our Gaushala (Shed &amp; Rest Area)</span>
                  </div>
                )}
                {matchedBooking && (
                  <div className="text-[11px] font-mono text-ink-faint mt-1">
                    Booking:{" "}
                    <strong className="text-ink">{matchedBooking.id}</strong> (
                    {matchedBooking.customer})
                  </div>
                )}
              </div>
            </div>

            {/* Travel Steps Progress Bar (Visible during Travel, Puja or Route Preview) */}
            {(isAwayFromGaushala || showRoutePreview) && (
              <div className="mt-4 pt-3 border-t border-line">
                <div className="flex items-center justify-between text-[11px] text-ink-faint mb-1.5">
                  <span className="font-mono uppercase tracking-wider">
                    Step {stageIndex} of 9:{" "}
                    <strong className="text-ink">
                      {tripStepDescriptions[stageIndex]?.label || "Active"}
                    </strong>
                  </span>
                  <span className="font-mono text-forest">
                    {stageIndex >= 6
                      ? "Puja Completed · Return Journey Monitored"
                      : "On Way to Devotee's House"}
                  </span>
                </div>
                <div className="w-full bg-paper-deep h-2 rounded-full overflow-hidden flex">
                  {tripStepDescriptions.map((s, idx) => {
                    const isDone = idx < stageIndex
                    const isCurrent = idx === stageIndex
                    return (
                      <div
                        key={s.id}
                        className={`h-full flex-1 border-r border-paper last:border-0 transition-all ${
                          isDone
                            ? "bg-forest"
                            : isCurrent
                              ? "bg-saffron animate-pulse"
                              : "bg-paper-deep"
                        }`}
                        title={s.label}
                      />
                    )
                  })}
                </div>
                <div className="text-[11px] text-ink-soft mt-1.5 flex items-center justify-between">
                  <span className="truncate">
                    {tripStepDescriptions[stageIndex]?.desc}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={handleNextStep}
                      disabled={isAdvancing || stageIndex >= 9}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-forest text-white text-[11px] font-medium rounded hover:bg-forest-deep transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      <span>Next Step</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ----------------- BIFURCATED VIEW: INSIDE GAUSHALA vs. TRAVELLING ON ROAD ----------------- */}
          {!isAwayFromGaushala && !showRoutePreview ? (
            /* ========================================================================= */
            /* VIEW 1: INSIDE OUR GAUSHALA (RESTING, FEEDING & DISPATCH PREPARATION)     */
            /* ========================================================================= */
            <div className="space-y-5 animate-fade-in">
              {/* Prominent Hero Banner */}
              <div className="bg-gradient-to-r from-forest/15 via-forest/5 to-card border-2 border-forest/30 rounded-lg p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="h-12 w-12 rounded-full bg-forest text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif text-[20px] font-bold text-ink">
                          This cow is currently inside our Gaushala
                        </h3>
                        <span
                          className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                            selectedAnimal.status === "Resting Buffer"
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : selectedAnimal.status === "Vet Care"
                                ? "bg-danger-soft text-danger border-danger/30"
                                : "bg-forest-soft text-forest border-forest/30"
                          }`}
                        >
                          {selectedAnimal.status === "Resting Buffer"
                            ? `Resting & Drinking Water (${selectedAnimal.cooldownMinutes || 90}m break)`
                            : selectedAnimal.status === "Available"
                              ? "Rested & Ready for Puja"
                              : selectedAnimal.status === "Vet Care"
                                ? "Under Doctor Care in Gaushala"
                                : selectedAnimal.status}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed">
                        <strong>{selectedAnimal.name}</strong> is safely resting
                        at <strong>{selectedAnimal.gosala}</strong> in the cow
                        shed. Fresh grass, clean water, and resting hours are
                        fully managed by our gosevaks.
                      </p>
                    </div>
                  </div>

                  {matchedBooking && (
                    <button
                      onClick={() => setShowRoutePreview(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-card border border-forest/40 hover:bg-forest-soft text-forest text-[12px] font-medium rounded transition-colors shadow-2xs shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                      <Eye size={14} />
                      <span>See Road Route on Map</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Cards: Gaushala Shed & Care Details with Plain Words */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Cow Shed & Stall */}
                <div className="bg-card border border-line rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold flex items-center gap-1.5">
                      <Building2 size={14} /> Gaushala Shed &amp; Resting Spot
                    </span>
                    <span className="text-[11px] font-mono text-ok bg-ok-soft px-2 py-0.5 rounded-full font-medium">
                      Inside Shed
                    </span>
                  </div>

                  <div className="space-y-2 text-[12px] text-ink-soft">
                    <div className="flex justify-between items-center bg-paper p-2 rounded border border-line">
                      <span className="text-ink-faint">
                        Facility &amp; Shed:
                      </span>
                      <strong className="text-ink font-medium">
                        {selectedAnimal.gosala} (Cow Shed A)
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Resting Stall:</span>
                      <strong className="text-ink font-mono">
                        Soft Straw Bedding · Stall #04
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Fan &amp; Cooling:</span>
                      <span className="text-forest font-medium">
                        Mist fans running · 26°C cool &amp; comfortable
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Drinking Water:</span>
                      <span className="text-ink font-medium">
                        Clean fresh drinking water always available
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Food & Grass */}
                <div className="bg-card border border-line rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-saffron-deep font-semibold flex items-center gap-1.5">
                      <Droplets size={14} /> Daily Food &amp; Grass
                    </span>
                    <span className="text-[11px] font-mono text-saffron-deep bg-saffron-soft px-2 py-0.5 rounded-full font-medium">
                      Fed on Time
                    </span>
                  </div>

                  <div className="space-y-2 text-[12px] text-ink-soft">
                    <div className="bg-paper p-2.5 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Daily Food / Grass
                      </div>
                      <div className="font-medium text-ink mt-0.5">
                        {selectedAnimal.diet}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Salt &amp; Minerals:</span>
                      <strong className="text-ink">
                        Mineral salt lick &amp; jaggery water given
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Feeding Routine:</span>
                      <strong className="text-ink">
                        Morning green grass (7:30 AM) · Evening dry grass (5:00
                        PM)
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Card 3: Cow Caretaker (Gosevak) */}
                <div className="bg-card border border-line rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink font-semibold flex items-center gap-1.5">
                      <User size={14} /> Assigned Caretaker (Gosevak)
                    </span>
                    <span className="text-[11px] font-mono text-forest bg-forest-soft px-2 py-0.5 rounded-full font-medium">
                      In Gaushala
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-paper p-2.5 rounded border border-line">
                    <div>
                      <div className="font-serif text-[14px] font-semibold text-ink">
                        {selectedAnimal.assignedHandler}
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        Trained Cow Caretaker &amp; Escort
                      </div>
                    </div>
                    <a
                      href="tel:+919823044910"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-forest text-white text-[11px] font-medium rounded hover:bg-forest-deep transition-colors shadow-2xs"
                    >
                      <Phone size={12} />
                      <span>Call Caretaker</span>
                    </a>
                  </div>

                  <div className="text-[11.5px] text-ink-soft space-y-1">
                    <div className="flex justify-between">
                      <span>Morning Health Check:</span>
                      <span className="text-forest font-medium">
                        Done at 8:30 AM
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Health Condition:</span>
                      <span className="text-ink font-medium truncate max-w-[200px]">
                        {selectedAnimal.healthNotes ||
                          "Healthy, peaceful and active"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Daily Limits & Rest Rules */}
                <div className="bg-card border border-line rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-amber-800 font-semibold flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Daily Puja Limit &amp; Rest
                      Rules
                    </span>
                    <span className="text-[11px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                      Cow Welfare Rules
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="bg-paper p-2 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Pujas Today
                      </div>
                      <div className="font-mono text-[15px] font-bold text-ink mt-0.5">
                        {selectedAnimal.todayBookings} of{" "}
                        {selectedAnimal.maxDailyTrips} allowed
                      </div>
                    </div>
                    <div className="bg-paper p-2 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Travel Limit
                      </div>
                      <div className="font-mono text-[15px] font-bold text-ink mt-0.5">
                        Up to {selectedAnimal.maxRadiusKm} km
                      </div>
                    </div>
                  </div>

                  <div className="text-[11.5px] text-ink-soft space-y-1">
                    <div className="flex justify-between">
                      <span>Compulsory Rest:</span>
                      <strong className="text-amber-800 font-mono">
                        90 minutes rest after every puja
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Age &amp; Weight:</span>
                      <span className="text-ink font-medium">
                        {selectedAnimal.age} · {selectedAnimal.weight}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheduled Seva Booking or Barn Resting State */}
              {matchedBooking ? (
                <div className="bg-card border border-line rounded-lg p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-line pb-3 gap-2">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold flex items-center gap-1.5">
                        <Calendar size={14} /> Upcoming Puja Booking:{" "}
                        {matchedBooking.id}
                      </div>
                      <h4 className="font-serif text-[16px] font-semibold text-ink mt-0.5">
                        Devotee: {matchedBooking.customer} (
                        {matchedBooking.phone})
                      </h4>
                    </div>
                    <div className="text-[11.5px] font-mono text-ink-faint">
                      Puja Time:{" "}
                      <strong className="text-ink">
                        {matchedBooking.date} from {matchedBooking.start} to{" "}
                        {matchedBooking.end}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                    <div className="bg-paper p-2.5 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Puja Ceremony
                      </div>
                      <div className="font-medium text-ink mt-0.5">
                        {matchedBooking.ritualPurpose ||
                          "Griha Pravesh & Kamadhenu Puja"}
                      </div>
                    </div>

                    <div className="bg-paper p-2.5 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Puja Location (Devotee's House)
                      </div>
                      <div className="font-medium text-ink mt-0.5 truncate">
                        {matchedBooking.address || "Kothrud, Pune"}
                      </div>
                      <div className="text-[11px] text-forest font-mono mt-0.5">
                        {matchedBooking.distanceKm || 8} km road drive
                      </div>
                    </div>

                    <div className="bg-paper p-2.5 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Vehicle &amp; Driver
                      </div>
                      <div className="font-medium text-ink mt-0.5">
                        {matchedBooking.driver || "Sunil Pawar"}
                      </div>
                      <div className="text-[11px] text-ink-faint font-mono">
                        Tata 407 (Padded Soft Ramp)
                      </div>
                    </div>
                  </div>

                  {/* Safety Checklist Before Leaving */}
                  <div className="bg-forest-soft/30 border border-forest/20 rounded p-3 text-[12px] space-y-1.5">
                    <div className="font-semibold text-forest flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Before Leaving Gaushala: Safety
                      Checklist (Gate 1)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-ink-soft text-[11.5px] pt-1">
                      <div className="flex items-center gap-1.5">
                        <Check size={13} className="text-forest shrink-0" />
                        <span>Cow has drunk water and is rested</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check size={13} className="text-forest shrink-0" />
                        <span>Gosevak caretaker going along in van</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check size={13} className="text-forest shrink-0" />
                        <span>Ground floor courtyard verified (no stairs)</span>
                      </div>
                    </div>
                  </div>

                  {/* Dispatch Action CTA with Simple Labels */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="text-[12px] text-ink-faint">
                      When the driver is ready at the gate, click below to start
                      the trip and turn on live GPS map.
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setShowRoutePreview(true)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-[12px] font-medium text-ink border border-line rounded hover:bg-paper-deep transition-colors cursor-pointer"
                      >
                        <MapPin size={13} /> See Road Route on Map
                      </button>
                      <button
                        onClick={handleStartTrip}
                        disabled={isAdvancing}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-forest text-white text-[12px] font-medium rounded hover:bg-forest-deep transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <Truck size={14} />
                        <span>Start Trip (Cow Leaves Gaushala)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-line rounded-lg p-6 text-center space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-forest" />
                  <h4 className="font-serif text-[17px] font-semibold text-ink">
                    No Travel or Puja Scheduled for {selectedAnimal.name} Today
                  </h4>
                  <p className="text-[12.5px] text-ink-soft max-w-md mx-auto">
                    {selectedAnimal.name} is resting and grazing peacefully in
                    our Gaushala shed and open yard. When a devotee booking is
                    approved, it will show up here to send the cow.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW 2: ACTIVE ROAD TRIP & LIVE GPS TRACKING                              */
            /* ========================================================================= */
            <div className="space-y-5 animate-fade-in">
              {/* Back to Shed Button when Route Preview was opened */}
              {showRoutePreview && !isAwayFromGaushala && (
                <div className="flex items-center justify-between bg-paper p-3 rounded-lg border border-line text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">
                      Road Route to Devotee's House:
                    </span>
                    <span className="text-ink-soft">
                      {selectedAnimal.gosala} →{" "}
                      {matchedBooking?.address || "Kothrud, Pune"}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowRoutePreview(false)}
                    className="text-forest hover:underline font-medium text-[11.5px] cursor-pointer"
                  >
                    ← Back to Gaushala Shed Details
                  </button>
                </div>
              )}

              {/* Interactive Live Map Component */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <MapPin size={14} className="text-forest" />
                    <span>Live Road GPS Map · Safe Cow Travel</span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {selectedAnimal.gosala} Transit Route
                  </span>
                </div>

                <LiveTripMap
                  bookingId={matchedBooking?.id || `${selectedAnimal.name}-LIVE`}
                  pickupLocation={selectedAnimal.gosala}
                  dropLocation={matchedBooking?.address || "Devotee Destination"}
                  driverName={matchedBooking?.driver || selectedAnimal.assignedHandler || "Gaushala Driver"}
                  stageIndex={Math.min(7, stageIndex)}
                  distanceKm={matchedBooking?.distanceKm || 8}
                  heightClass="h-[360px]"
                  viewerRole="MANAGER"
                />
              </div>

              {/* ----------------- 4-VECTOR TRIP SAFETY DOSSIER (SIMPLE WORDS) ----------------- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Cow Comfort & Travel Safety */}
                <div className="bg-card border border-line rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold flex items-center gap-1.5">
                      <HeartPulse size={14} /> Cow Comfort &amp; Travel Safety
                    </span>
                    <span className="text-[11px] font-mono text-ok bg-ok-soft px-2 py-0.5 rounded-full font-medium">
                      Healthy &amp; Calm
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="bg-paper p-2.5 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Driving Speed
                      </div>
                      <div className="font-mono text-[15px] font-bold text-ink mt-0.5 flex items-baseline gap-1">
                        <span>{simulatedSpeed}</span>
                        <span className="text-[11px] font-normal text-ink-faint">
                          km/h
                        </span>
                      </div>
                      <div className="text-[10px] text-forest font-sans">
                        Safe limit: max 40 km/h
                      </div>
                    </div>

                    <div className="bg-paper p-2.5 rounded border border-line">
                      <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                        Outside Weather
                      </div>
                      <div className="font-mono text-[15px] font-bold text-ink mt-0.5 flex items-baseline gap-1">
                        <span>{simulatedTemp}°C</span>
                        <span className="text-[10px] font-normal text-forest">
                          Comfortable
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-faint font-sans">
                        Fans active in van
                      </div>
                    </div>
                  </div>

                  <div className="text-[12px] space-y-1.5 text-ink-soft">
                    <div className="flex justify-between">
                      <span>Maximum Travel Allowed:</span>
                      <strong className="text-ink font-mono">
                        Up to {selectedAnimal.maxRadiusKm} km only
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Trip Driving Distance:</span>
                      <strong className="text-ink font-mono">
                        {matchedBooking?.distanceKm || 8} km
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Drinking Water Before Departure:</span>
                      <span className="text-forest font-medium flex items-center gap-1">
                        <Check size={12} /> Yes, water given
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compulsory Rest After Return:</span>
                      <strong className="text-amber-800 font-mono">
                        90 mins rest &amp; fresh water
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Card 2: Driver & Transport Vehicle */}
                <div className="bg-card border border-line rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-saffron-deep font-semibold flex items-center gap-1.5">
                      <Truck size={14} /> Driver &amp; Cow Transport Vehicle
                    </span>
                    <span className="text-[11px] font-mono text-ink-faint">
                      {matchedBooking?.driver?.includes("Porter")
                        ? "Partner Vehicle"
                        : "In-House Van"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-paper p-2.5 rounded border border-line">
                    <div>
                      <div className="font-serif text-[14.5px] font-semibold text-ink">
                        {matchedBooking?.driver || "Sunil Pawar"}
                      </div>
                      <div className="font-mono text-[11px] text-ink-faint mt-0.5">
                        Vehicle:{" "}
                        <strong className="text-ink">MH 12 RN 4402</strong>{" "}
                        (Tata 407 Padded Ramp)
                      </div>
                    </div>

                    <a
                      href={`tel:${matchedBooking?.phone || "+919823044910"}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-forest text-white text-[11px] font-medium rounded hover:bg-forest-deep transition-colors shadow-2xs"
                    >
                      <Phone size={12} />
                      <span>Call Driver</span>
                    </a>
                  </div>

                  <div className="text-[12px] space-y-1 text-ink-soft">
                    <div className="flex justify-between">
                      <span>GPS Connection:</span>
                      <span className="text-forest font-medium">
                        Live &amp; Connected
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Direction:</span>
                      <span className="font-mono text-ink text-[11px] truncate max-w-[190px]">
                        {simulatedHeading}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Driver Phone:</span>
                      <span className="font-mono text-ink">
                        +91 98230 44910
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Devotee & Puja Place Details */}
                <div className="bg-card border border-line rounded-lg p-4 space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink font-semibold flex items-center gap-1.5">
                      <User size={14} /> Devotee &amp; Puja Place Details
                    </span>
                    <span className="text-[11px] font-mono text-forest bg-forest-soft px-2 py-0.5 rounded-full font-medium">
                      Verified Devotee
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                    <div>
                      <div className="text-[11px] text-ink-faint">
                        Devotee Name &amp; Phone
                      </div>
                      <div className="font-semibold text-ink mt-0.5">
                        {matchedBooking?.customer || "Ananya Deshmukh"}
                      </div>
                      <div className="font-mono text-ink-soft text-[11.5px]">
                        {matchedBooking?.phone || "+91 98204 11827"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-ink-faint">
                        Puja Ceremony
                      </div>
                      <div className="font-medium text-ink mt-0.5">
                        {matchedBooking?.ritualPurpose ||
                          "Griha Pravesh & Kamadhenu Puja"}
                      </div>
                      <div className="text-[11px] text-ink-faint font-mono">
                        Time: {matchedBooking?.start || "10:00"} –{" "}
                        {matchedBooking?.end || "12:00"} (
                        {matchedBooking?.durationMin || 120}m)
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-ink-faint">
                        Puja Location (Devotee's House)
                      </div>
                      <div className="text-ink mt-0.5 truncate font-medium">
                        {matchedBooking?.address ||
                          "14 Tulsi Nagar, Kothrud, Pune"}
                      </div>
                      <div className="text-[11px] text-forest font-medium">
                        Ground Floor Puja Spot Verified
                      </div>
                    </div>
                  </div>

                  {matchedBooking?.specialInstructions && (
                    <div className="pt-2 border-t border-line text-[11.5px] text-ink-soft bg-paper/60 p-2.5 rounded">
                      <strong className="text-ink">
                        Devotee Note / Request:
                      </strong>{" "}
                      {matchedBooking.specialInstructions}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Step Buttons for Manager Testing */}
              <div className="bg-card border border-line rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                <span className="text-ink-faint font-mono uppercase tracking-wider">
                  Change / Test Trip Step (Quick Buttons):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { stage: 4, label: "Travelling to Devotee (Step 4)" },
                    { stage: 6, label: "At Devotee House for Puja (Step 6)" },
                    { stage: 8, label: "Returning to Gaushala (Step 8)" },
                    { stage: 9, label: "Safely Back in Gaushala (Step 9)" },
                  ].map((s) => (
                    <button
                      key={s.stage}
                      onClick={() => handleSetSpecificStage(s.stage)}
                      className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        stageIndex === s.stage
                          ? "bg-forest text-white border-forest font-semibold"
                          : "bg-paper text-ink-soft border-line hover:border-forest/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ----------------- EMERGENCY HELP MODAL (SIMPLE WORDS & HIGH Z-INDEX) ----------------- */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/75 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-lg overflow-hidden relative z-[10000] my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-danger/10">
              <div className="flex items-center gap-2 text-danger">
                <AlertCircle size={20} />
                <h3 className="font-serif text-[18px] font-semibold">
                  🚨 Emergency Help: Doctor &amp; Vehicle Support
                </h3>
              </div>
              <button
                onClick={() => setSosModalOpen(false)}
                className="text-ink-faint hover:text-ink p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-[13px]">
              <p className="text-ink-soft leading-relaxed">
                If there is any emergency on the road or at the puja, clicking
                this will immediately call our{" "}
                <strong>Gaushala Veterinary Doctor</strong> and dispatch a
                backup cattle carrier van for{" "}
                <strong>{selectedAnimal.name}</strong>.
              </p>

              <div>
                <label className="block text-[11px] font-mono uppercase text-ink-faint mb-1.5">
                  Reason for Emergency Assistance
                </label>
                <select
                  value={sosReason}
                  onChange={(e) => setSosReason(e.target.value)}
                  className="w-full bg-card border border-line rounded p-2.5 text-[13px] text-ink outline-none focus:border-danger"
                >
                  <option value="Cow looks tired or stressed from heat / travel">
                    Cow looks tired or stressed from heat / travel
                  </option>
                  <option value="Vehicle breakdown or tyre puncture on the road">
                    Vehicle breakdown or tyre puncture on the road
                  </option>
                  <option value="Problem at devotee's house (stairs, loud noise, fireworks)">
                    Problem at devotee's house (stairs, loud noise, fireworks)
                  </option>
                  <option value="Cow needs rest or medical check-up">
                    Cow needs rest or medical check-up
                  </option>
                </select>
              </div>

              <div className="bg-danger-soft/40 border border-danger/30 rounded p-3 text-[12px] text-danger-deep space-y-1">
                <div className="font-semibold">
                  What happens when you click:
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    Calls Gaushala Senior Doctor (Dr. Deshpande) immediately on
                    phone
                  </li>
                  <li>
                    Sends nearest standby cattle vehicle with hydraulic ramp to
                    exact location
                  </li>
                  <li>
                    Messages devotee with polite update and gentle rescheduling
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  onClick={() => setSosModalOpen(false)}
                  className="px-4 py-2 text-[12.5px] font-medium text-ink-soft hover:text-ink border border-line rounded hover:bg-paper-deep cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTriggerEmergencySOS}
                  className="px-5 py-2 text-[12.5px] font-medium bg-danger text-white rounded hover:bg-danger-deep transition-colors shadow-xs cursor-pointer font-semibold"
                >
                  Call Emergency Help Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
