import { useState, useMemo, useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  ShieldCheck,
  HeartPulse,
  PawPrint,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  ArrowRight,
  Filter,
  Building2,
} from "lucide-react"
import { slots, type Booking } from "../data/mock"
import { useStore, type SlotAvailabilityStatus } from "../store/store"
import { Panel, PanelHead, StatusPill, Eyebrow } from "../lib/ui"
import type { Animal } from "../data/animals"

const TODAY_REFERENCE = new Date().toLocaleDateString("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const legend = [
  {
    s: "Available",
    label: "Available for Seva (Click to lock)",
    cell: "bg-card border border-line hover:border-forest/50 hover:bg-forest-soft/30 cursor-pointer text-forest",
  },
  {
    s: "Booked",
    label: "Booked for Seva (Devotee visit)",
    cell: "bg-saffron text-white shadow-xs font-semibold",
  },
  {
    s: "Buffer",
    label: "90m Rest Break (Mandatory recovery)",
    cell: "bg-amber-100 text-amber-900 border border-amber-300 font-semibold",
  },
  {
    s: "Blocked",
    label: "Locked by Manager (Click to unlock)",
    cell: "bg-paper-deep text-ink-faint border border-line-strong/60 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-line-strong)_4px,var(--color-line-strong)_5px)] cursor-pointer hover:border-danger",
  },
]

const cellClass: Record<SlotAvailabilityStatus, string> = {
  Available:
    "bg-card border border-line text-ink-faint/40 hover:border-forest hover:bg-forest-soft/40 hover:text-forest cursor-pointer font-medium",
  Booked: "bg-saffron text-white font-semibold cursor-default shadow-xs",
  Buffer:
    "bg-amber-100 text-amber-900 border border-amber-300 font-semibold cursor-default",
  Blocked:
    "text-ink-faint border border-line-strong/60 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-line-strong)_4px,var(--color-line-strong)_5px)] cursor-pointer hover:border-danger font-medium",
}

export default function Availability() {
  const {
    animals,
    checkAnimalAvailability,
    toggleSlotBlock,
    bookings,
    gosalas,
    profiles,
    currentRole,
    activeGosalaFilter,
    activeManagerGosala,
  } = useStore()

  const assignedGosala =
    activeManagerGosala ||
    (activeGosalaFilter && activeGosalaFilter !== "ALL"
      ? activeGosalaFilter
      : "") ||
    profiles?.manager?.managerData?.gosala ||
    (gosalas[0]?.name || "")

  const [selectedDate, setSelectedDate] = useState<string>(TODAY_REFERENCE)
  const [animalCategory, setAnimalCategory] = useState<string>("ALL")
  const [selectedGosala, setSelectedGosala] = useState<string>(
    () => (currentRole === "manager" ? assignedGosala : "ALL"),
  )

  useEffect(() => {
    if (currentRole === "manager" && assignedGosala) {
      setSelectedGosala(assignedGosala)
    }
  }, [currentRole, assignedGosala])
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Hover Popover State for Grid Slots
  const [hoveredSlot, setHoveredSlot] = useState<{
    animal: Animal
    time: string
    check: ReturnType<typeof checkAnimalAvailability>
    booking?: Booking
  } | null>(null)
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })

  // 1. Dynamic Available Dates Generator
  const availableDates = useMemo(() => {
    const uniqueDates = new Set<string>()
    bookings.forEach((b) => {
      if (b.date) uniqueDates.add(b.date)
    })

    // Dynamic rolling window: 2 days in past to 7 days ahead
    const now = new Date()
    for (let offset = -2; offset <= 7; offset++) {
      const d = new Date(now)
      d.setDate(d.getDate() + offset)
      const dateStr = d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      uniqueDates.add(dateStr)
    }

    const parseDateVal = (s: string) => {
      const parts = s.split(" ")
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10)
        const monthMap: Record<string, number> = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        }
        const month = monthMap[parts[1]] ?? 8
        const year = parseInt(parts[2], 10)
        return new Date(year, month, day).getTime()
      }
      return 0
    }

    const sorted = Array.from(uniqueDates).sort(
      (a, b) => parseDateVal(a) - parseDateVal(b),
    )

    return sorted.map((d) => {
      const parts = d.split(" ")
      const label = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : d
      const timeVal = parseDateVal(d)
      const refTime = parseDateVal(TODAY_REFERENCE)

      let tag: "Today" | "Upcoming" | "Past" = "Upcoming"
      if (d === TODAY_REFERENCE) {
        tag = "Today"
      } else if (timeVal < refTime) {
        tag = "Past"
      }

      return { label, value: d, tag }
    })
  }, [bookings])

  const dateObj = availableDates.find((d) => d.value === selectedDate) || {
    label: selectedDate,
    value: selectedDate,
    tag: "Upcoming" as const,
  }

  // 2. Filter Animals by Category, Gaushala & Search (Strict Multi-tenant Isolation)
  const filteredAnimals = useMemo(() => {
    return animals.filter((a) => {
      const matchesCategory =
        animalCategory === "ALL" || a.type === animalCategory

      const matchesGosala =
        currentRole === "manager"
          ? a.gosala.toLowerCase() === assignedGosala.toLowerCase()
          : selectedGosala === "ALL" ||
            a.gosala.toLowerCase() === selectedGosala.toLowerCase()

      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.gosala.toLowerCase().includes(q) ||
        (a.assignedHandler && a.assignedHandler.toLowerCase().includes(q))

      return matchesCategory && matchesGosala && matchesSearch
    })
  }, [animals, animalCategory, selectedGosala, searchQuery, currentRole, assignedGosala])

  // 3. Grid Metrics for Selected Date
  const metrics = useMemo(() => {
    let availableCount = 0
    let bookedCount = 0
    let bufferCount = 0
    let blockedCount = 0

    animals.forEach((a) => {
      slots.forEach((s) => {
        const c = checkAnimalAvailability(a.name, selectedDate, s, 60)
        if (c.status === "Available") availableCount++
        else if (c.status === "Booked") bookedCount++
        else if (c.status === "Buffer") bufferCount++
        else if (c.status === "Blocked") blockedCount++
      })
    })

    return {
      availableCount,
      bookedCount,
      bufferCount,
      blockedCount,
      totalSlots: animals.length * slots.length,
    }
  }, [animals, selectedDate, checkAnimalAvailability])

  const handlePrev = () => {
    const idx = availableDates.findIndex((d) => d.value === selectedDate)
    if (idx > 0) setSelectedDate(availableDates[idx - 1].value)
  }

  const handleNext = () => {
    const idx = availableDates.findIndex((d) => d.value === selectedDate)
    if (idx < availableDates.length - 1)
      setSelectedDate(availableDates[idx + 1].value)
  }

  const handleCellClick = (
    animalName: string,
    slotTime: string,
    status: SlotAvailabilityStatus,
  ) => {
    if (status === "Available" || status === "Blocked") {
      toggleSlotBlock(animalName, selectedDate, slotTime)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Date Header & Controls */}
      <Panel className="p-4 sm:p-5 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-forest-soft text-forest">
              <CalendarIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-[17px] text-ink font-semibold">
                  {selectedDate}
                </h3>
                <span
                  className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${
                    dateObj.tag === "Today"
                      ? "bg-forest-soft text-forest"
                      : dateObj.tag === "Upcoming"
                        ? "bg-saffron-soft text-saffron-deep"
                        : "bg-paper-deep text-ink-faint"
                  }`}
                >
                  {dateObj.tag}
                </span>
                {selectedDate !== TODAY_REFERENCE && (
                  <button
                    onClick={() => setSelectedDate(TODAY_REFERENCE)}
                    className="text-[11px] text-saffron-deep hover:underline font-medium ml-1"
                  >
                    Jump to Today
                  </button>
                )}
              </div>
              <p className="text-[12px] text-ink-faint">
                Live availability & 90-minute rest buffers for {animals.length}{" "}
                registered cattle
              </p>
            </div>
          </div>

          {/* Date Slider Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={
                availableDates.findIndex((d) => d.value === selectedDate) === 0
              }
              className="p-1.5 rounded-sm border border-line bg-card text-ink-soft hover:text-ink disabled:opacity-40 transition-colors"
              aria-label="Previous day"
              title="Previous day"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Scrollable Date Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {availableDates.map((d) => {
                const isActive = d.value === selectedDate
                const dateBookingsCount = bookings.filter(
                  (b) =>
                    b.date === d.value &&
                    [
                      "Confirmed",
                      "In Service",
                      "Completed",
                      "Admin Review",
                      "Payment Verified",
                    ].includes(b.status),
                ).length

                return (
                  <button
                    key={d.value}
                    onClick={() => setSelectedDate(d.value)}
                    className={`px-3 py-1.5 text-[12px] rounded-sm transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? "bg-forest text-white font-medium shadow-xs ring-1 ring-forest"
                        : "bg-paper border border-line text-ink-soft hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    <span>{d.label}</span>
                    {dateBookingsCount > 0 && (
                      <span
                        className={`text-[9.5px] px-1 rounded-full font-mono ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-saffron-soft text-saffron-deep font-semibold"
                        }`}
                      >
                        {dateBookingsCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleNext}
              disabled={
                availableDates.findIndex((d) => d.value === selectedDate) ===
                availableDates.length - 1
              }
              className="p-1.5 rounded-sm border border-line bg-card text-ink-soft hover:text-ink disabled:opacity-40 transition-colors"
              aria-label="Next day"
              title="Next day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Filter Bar: Cattle Type, Gaushala Shelter & Search */}
        <div className="mt-4 pt-3 border-t border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-wrap">
            <span className="text-[11.5px] text-ink-faint font-medium shrink-0 flex items-center gap-1">
              <PawPrint size={13} className="text-forest" />
              Category:
            </span>
            {[
              { id: "ALL", label: `All (${animals.length})` },
              {
                id: "Cow & Calf",
                label: `Cow & Calf Pairs (${animals.filter((a) => a.type === "Cow & Calf").length})`,
              },
              {
                id: "Cow",
                label: `Cows (${animals.filter((a) => a.type === "Cow").length})`,
              },
              {
                id: "Calf",
                label: `Calves (${animals.filter((a) => a.type === "Calf").length})`,
              },
              {
                id: "Bull",
                label: `Bulls (${animals.filter((a) => a.type === "Bull").length})`,
              },
              {
                id: "Buffalo",
                label: `Buffalos (${animals.filter((a) => a.type === "Buffalo").length})`,
              },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setAnimalCategory(cat.id)}
                className={`px-2.5 py-1 text-[11px] rounded-full transition-all whitespace-nowrap ${
                  animalCategory === cat.id
                    ? "bg-forest text-white font-medium shadow-xs"
                    : "bg-card border border-line text-ink-soft hover:text-ink"
                }`}
              >
                {cat.label}
              </button>
            ))}

            <div className="hidden sm:block w-px h-4 bg-line mx-1" />

            {/* Dynamic Gaushala Shelter Filter */}
            {currentRole === "manager" ? (
              <div className="inline-flex items-center gap-1.5 bg-forest-soft text-forest border border-forest/20 rounded px-2.5 py-1 text-[11px] font-semibold">
                <Building2 size={12} className="text-forest shrink-0" />
                <span>📍 {assignedGosala} Shed</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-card border border-line rounded px-2 py-1 text-[11px] text-ink">
                <Building2 size={12} className="text-saffron shrink-0" />
                <select
                  value={selectedGosala}
                  onChange={(e) => setSelectedGosala(e.target.value)}
                  className="bg-transparent text-[11px] text-ink font-medium outline-none cursor-pointer"
                >
                  <option value="ALL">All Gaushalas ({gosalas.length})</option>
                  {gosalas.map((g) => {
                    const cowCount = animals.filter(
                      (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
                    ).length
                    return (
                      <option key={g.id} value={g.name}>
                        {g.name} ({cowCount})
                      </option>
                    )
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="relative w-full sm:w-60 shrink-0">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by cow or handler..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[16px] sm:text-[11.5px] rounded border border-line bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:border-forest"
            />
          </div>
        </div>
      </Panel>

      {/* 2. Daily Summary Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-forest-soft text-forest">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              Available Slots
            </div>
            <div className="text-[16px] font-serif font-bold text-ink">
              {metrics.availableCount}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-saffron-soft text-saffron-deep">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              Booked for Seva
            </div>
            <div className="text-[16px] font-serif font-bold text-ink">
              {metrics.bookedCount}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-amber-100 text-amber-900">
            <Clock size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              90m Rest Buffers
            </div>
            <div className="text-[16px] font-serif font-bold text-amber-900">
              {metrics.bufferCount}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-paper-deep text-ink-soft">
            <Lock size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              Manager Locked
            </div>
            <div className="text-[16px] font-serif font-bold text-ink">
              {metrics.blockedCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Availability Matrix Panel */}
      <Panel>
        <PanelHead
          title="Cow Time Slots & Rest Availability"
          desc={`Real-time availability for ${selectedDate}. Click any available slot to lock it for vet care or extra rest.`}
          right={
            <div className="text-[11px] text-ink-faint hidden sm:block">
              1-click lock/unlock for manager
            </div>
          }
        />

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-b border-line bg-card">
          {legend.map((l) => (
            <div
              key={l.label}
              className="flex items-center gap-2 text-[11.5px] text-ink-soft"
            >
              <span className={`h-3.5 w-5 rounded-[3px] ${l.cell}`} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Grid Table */}
        <div className="overflow-x-auto p-5">
          <table className="border-separate border-spacing-1 min-w-[840px]">
            <thead>
              <tr>
                <th className="text-left w-[240px]">
                  <Eyebrow>Cow & Gaushala</Eyebrow>
                </th>
                {slots.map((s) => (
                  <th
                    key={s}
                    className="font-mono text-[11px] text-ink-faint font-medium pb-2 tabular text-center"
                  >
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAnimals.map((a) => {
                // Calculate today's seva count on selectedDate
                const dayBookings = bookings.filter(
                  (b) =>
                    b.animal.toLowerCase() === a.name.toLowerCase() &&
                    b.date === selectedDate &&
                    b.status !== "Rejected" &&
                    b.status !== "Cancelled",
                )
                const isLimitReached =
                  dayBookings.length >= (a.maxDailyTrips || 2)

                return (
                  <tr
                    key={a.name}
                    className="hover:bg-paper/30 transition-colors"
                  >
                    {/* Cow Info Cell */}
                    <td className="pr-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={a.photo}
                          alt={a.name}
                          className="w-9 h-9 rounded-full object-cover border border-line shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] text-ink font-semibold truncate">
                              {a.name}
                            </span>
                            <span
                              className={`text-[9.5px] px-1.5 py-0.2 rounded font-medium ${
                                isLimitReached
                                  ? "bg-danger-soft text-danger font-semibold"
                                  : dayBookings.length > 0
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-forest-soft text-forest"
                              }`}
                            >
                              {dayBookings.length}/{a.maxDailyTrips || 2} Sevas
                            </span>
                          </div>
                          <div className="text-[11px] text-ink-faint truncate leading-tight mt-0.5">
                            {a.type} · {a.gosala}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Time Slot Buttons */}
                    {slots.map((s) => {
                      const check = checkAnimalAvailability(
                        a.name,
                        selectedDate,
                        s,
                        60,
                      )
                      const isBlocked = check.status === "Blocked"
                      const isBooked = check.status === "Booked"
                      const isBuffer = check.status === "Buffer"

                      // Match related booking if booked or in buffer
                      const relBooking = bookings.find(
                        (b) =>
                          b.animal.toLowerCase() === a.name.toLowerCase() &&
                          b.date === selectedDate &&
                          (b.id === check.bookingId ||
                            (b.start <= s && b.end >= s)),
                      )

                      return (
                        <td key={s}>
                          <button
                            onClick={() =>
                              handleCellClick(a.name, s, check.status)
                            }
                            onMouseEnter={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect()
                              setHoverPos({
                                top: rect.bottom + 8,
                                left: rect.left + rect.width / 2,
                              })
                              setHoveredSlot({
                                animal: a,
                                time: s,
                                check,
                                booking: relBooking,
                              })
                            }}
                            onMouseLeave={() => setHoveredSlot(null)}
                            className={`w-full h-9 min-w-[62px] rounded-[4px] flex items-center justify-center text-[10.5px] transition-all ${cellClass[check.status]}`}
                          >
                            {isBooked ? (
                              <span className="flex items-center gap-0.5">
                                <Sparkles size={10} /> Booked
                              </span>
                            ) : isBuffer ? (
                              <span className="flex items-center gap-0.5 text-amber-900">
                                <Clock size={10} /> Rest
                              </span>
                            ) : isBlocked ? (
                              <span className="flex items-center gap-0.5 text-ink-faint">
                                <Lock size={10} /> Lock
                              </span>
                            ) : (
                              "·"
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 border-t border-line text-[11.5px] text-ink-faint flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-forest shrink-0" />
            <span>
              All time slots are protected by backend concurrency locks.
              Mandatory 90-minute rest cooldown prevents over-booking.
            </span>
          </div>
          <span className="font-mono text-[10.5px] text-saffron-deep shrink-0">
            Live schedule for {selectedDate}
          </span>
        </div>
      </Panel>

      {/* Floating Hover Popover (Non-Intrusive, Zero Layout Shift) */}
      {hoveredSlot && (
        <div
          className="fixed z-50 pointer-events-none transition-opacity duration-150 transform -translate-x-1/2"
          style={{
            top: `${hoverPos.top}px`,
            left: `${Math.max(160, Math.min(typeof window !== "undefined" ? window.innerWidth - 160 : 300, hoverPos.left))}px`,
          }}
        >
          <div className="w-72 bg-card/95 backdrop-blur-md border border-line rounded-md shadow-xl p-3.5 space-y-2 text-ink text-left">
            <div className="flex items-center justify-between border-b border-line pb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[13px] text-ink">
                <PawPrint size={14} className="text-forest" />
                <span>{hoveredSlot.animal.name}</span>
                <span className="text-[11px] font-normal text-ink-faint font-mono">
                  ({hoveredSlot.time})
                </span>
              </div>
              <span
                className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium ${
                  hoveredSlot.check.status === "Booked"
                    ? "bg-saffron-soft text-saffron-deep"
                    : hoveredSlot.check.status === "Buffer"
                      ? "bg-amber-100 text-amber-900"
                      : hoveredSlot.check.status === "Blocked"
                        ? "bg-paper-deep text-ink-faint"
                        : "bg-forest-soft text-forest"
                }`}
              >
                {hoveredSlot.check.status === "Booked"
                  ? "Booked"
                  : hoveredSlot.check.status === "Buffer"
                    ? "90m Rest"
                    : hoveredSlot.check.status === "Blocked"
                      ? "Locked"
                      : "Available"}
              </span>
            </div>

            {/* Detailed Context Based on Slot Status */}
            {hoveredSlot.check.status === "Booked" && (
              <div className="space-y-1.5 text-[11.5px]">
                <div className="text-ink-soft">
                  <span className="font-semibold text-ink">Devotee: </span>
                  {hoveredSlot.booking?.customer ||
                    hoveredSlot.check.customer ||
                    "Ananya Deshmukh"}
                </div>
                <div className="text-ink-faint text-[11px]">
                  <span>Seva: </span>
                  {hoveredSlot.booking?.ritualPurpose ||
                    "Griha Pravesh & Kamadhenu Puja"}
                </div>
                <div className="text-ink-faint text-[11px] truncate">
                  <span>Address: </span>
                  {hoveredSlot.booking?.address || "Devotee Destination"}
                </div>
                <div className="pt-1 border-t border-line/50 text-[10.5px] text-saffron-deep font-mono">
                  Booking ID:{" "}
                  {hoveredSlot.booking?.id ||
                    hoveredSlot.check.bookingId ||
                    "Active Booking"}
                </div>
              </div>
            )}

            {hoveredSlot.check.status === "Buffer" && (
              <div className="space-y-1 text-[11.5px]">
                <div className="flex items-center gap-1 text-amber-900 font-medium">
                  <Clock size={12} />
                  <span>Mandatory Cow Rest Period</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  90-minute resting and hydration break following ceremonial
                  seva. Protects cow vitality.
                </p>
                <div className="text-[10px] text-amber-800 font-mono pt-1">
                  Trip Reference: {hoveredSlot.check.bookingId || "Active"}
                </div>
              </div>
            )}

            {hoveredSlot.check.status === "Blocked" && (
              <div className="space-y-1 text-[11.5px]">
                <div className="flex items-center gap-1 text-ink font-medium">
                  <Lock size={12} />
                  <span>Locked by Gaushala Manager</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  {hoveredSlot.check.reason ||
                    "Slot held for vet care, feeding, or shed resting."}
                </p>
                <div className="text-[10.5px] text-forest font-medium pt-1">
                  👉 Click to unlock and make available
                </div>
              </div>
            )}

            {hoveredSlot.check.status === "Available" && (
              <div className="space-y-1 text-[11.5px]">
                <div className="flex items-center gap-1 text-forest font-medium">
                  <CheckCircle2 size={12} />
                  <span>Ready for Seva Booking</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Cow is healthy and available for devotee booking during this
                  time.
                </p>
                <div className="text-[10.5px] text-ink-soft font-medium pt-1">
                  👉 Click to lock this slot for vet inspection or rest
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
