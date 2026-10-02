import { useState, useMemo, useRef } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  ClipboardCheck,
  CheckCircle2,
  ShieldCheck,
  Truck,
  Droplets,
  HeartPulse,
  UserCheck,
  X,
  Check,
  AlertCircle,
  PawPrint,
  Sparkles,
  Users,
  MapPin,
  Eye,
  ArrowRight,
} from "lucide-react"
import { inr, type Booking } from "../../data/mock"
import { useStore, useToast } from "../../store/store"
import { Panel, PanelHead, StatusPill, Eyebrow } from "../../lib/ui"

const hours = Array.from({ length: 11 }, (_, i) => 8 + i) // 08:00–18:00

// Base reference date matching the seed database
const TODAY_REFERENCE = "28 Sep 2026"

export default function Schedule() {
  const {
    bookings: allBookings,
    animals: allAnimals,
    activeGosalaFilter,
    activeManagerGosala,
    gosalas,
    updateAnimalStatus,
    currentRole,
    profiles,
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

  const bookings = useMemo(() => {
    if (currentRole === "manager") {
      return allBookings.filter((b) =>
        b.gosala.toLowerCase().includes(assignedGosala.toLowerCase()),
      )
    }
    if (!activeGosalaFilter || activeGosalaFilter === "ALL") return allBookings
    return allBookings.filter((b) =>
      b.gosala.toLowerCase().includes(activeGosalaFilter.toLowerCase()),
    )
  }, [allBookings, activeGosalaFilter, currentRole, assignedGosala])

  const animals = useMemo(() => {
    if (currentRole === "manager") {
      return allAnimals.filter((a) =>
        a.gosala.toLowerCase().includes(assignedGosala.toLowerCase()),
      )
    }
    if (!activeGosalaFilter || activeGosalaFilter === "ALL") return allAnimals
    return allAnimals.filter((a) =>
      a.gosala.toLowerCase().includes(activeGosalaFilter.toLowerCase()),
    )
  }, [allAnimals, activeGosalaFilter, currentRole, assignedGosala])

  const [selectedDate, setSelectedDate] = useState(TODAY_REFERENCE)
  const [selectedAnimal, setSelectedAnimal] = useState<string>("ALL")

  // Hover Popover State for Date Strip
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })

  // Handover Checklist Completion Tracking
  const [completedGate1, setCompletedGate1] = useState<Record<string, boolean>>(
    {
      "GMA-24815": true,
      "GMA-24814": true,
    },
  )
  const [completedGate2, setCompletedGate2] = useState<Record<string, boolean>>(
    {
      "GMA-24813": true,
    },
  )

  // Checklist Modals State
  const [activeGate1Booking, setActiveGate1Booking] = useState<Booking | null>(
    null,
  )
  const [activeGate2Booking, setActiveGate2Booking] = useState<Booking | null>(
    null,
  )

  // Gate 1 Checklist Form State
  const [gate1Checks, setGate1Checks] = useState({
    demeanorVitals: true,
    feedHydration: true,
    rampBedding: true,
    handlerEscort: true,
  })

  // Gate 2 Checklist Form State
  const [gate2Checks, setGate2Checks] = useState({
    returnGait: true,
    respirationNormal: true,
    waterProvided: true,
    restingBufferInitiated: true,
  })

  // 1. Dynamically Generate Available Dates from Bookings & Calendar Window
  const availableDates = useMemo(() => {
    // Collect all unique dates from bookings
    const uniqueDates = new Set<string>()
    bookings.forEach((b) => {
      if (b.date) uniqueDates.add(b.date)
    })

    // Add standard 7-day rolling window around reference date
    const standardWindow = [
      "25 Sep 2026",
      "26 Sep 2026",
      "27 Sep 2026",
      "28 Sep 2026",
      "29 Sep 2026",
      "30 Sep 2026",
      "01 Oct 2026",
      "02 Oct 2026",
    ]
    standardWindow.forEach((d) => uniqueDates.add(d))

    // Parse and sort chronologically
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

  // 2. Filter bookings for the selected date
  const dayBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.date === selectedDate &&
        [
          "Confirmed",
          "In Service",
          "Completed",
          "Admin Review",
          "Payment Verified",
        ].includes(b.status),
    )
  }, [bookings, selectedDate])

  // Filter by selected cow if requested
  const displayBookings = useMemo(() => {
    if (selectedAnimal === "ALL") return dayBookings
    return dayBookings.filter((b) => b.animal === selectedAnimal)
  }, [dayBookings, selectedAnimal])

  // Distinct cows scheduled on this date
  const distinctCows = useMemo(() => {
    return Array.from(new Set(dayBookings.map((b) => b.animal)))
  }, [dayBookings])

  // Hover Popover Details Calculation
  const hoveredInfo = useMemo(() => {
    if (!hoveredDate) return null
    const bList = bookings.filter(
      (b) =>
        b.date === hoveredDate &&
        [
          "Confirmed",
          "In Service",
          "Completed",
          "Admin Review",
          "Payment Verified",
        ].includes(b.status),
    )
    const cows = Array.from(new Set(bList.map((b) => b.animal)))
    const dateObj = availableDates.find((d) => d.value === hoveredDate)
    return {
      date: hoveredDate,
      tag: dateObj?.tag || "Upcoming",
      count: bList.length,
      cows,
      bookings: bList,
    }
  }, [hoveredDate, bookings, availableDates])

  const dateObj = availableDates.find((d) => d.value === selectedDate) || {
    label: selectedDate,
    value: selectedDate,
    tag: "Upcoming" as const,
  }

  // Time conversion helper
  const toMin = (t?: string | null) => {
    if (!t) return 8 * 60
    const clean = t.replace(/(am|pm)/i, "").trim()
    const [h, m] = clean.split(":").map(Number)
    let hour = h || 0
    if (/pm/i.test(t) && hour < 12) hour += 12
    return hour * 60 + (m || 0)
  }
  const dayStart = 8 * 60
  const dayEnd = 18 * 60
  const span = dayEnd - dayStart

  const handlePrev = () => {
    const idx = availableDates.findIndex((d) => d.value === selectedDate)
    if (idx > 0) setSelectedDate(availableDates[idx - 1].value)
  }

  const handleNext = () => {
    const idx = availableDates.findIndex((d) => d.value === selectedDate)
    if (idx < availableDates.length - 1)
      setSelectedDate(availableDates[idx + 1].value)
  }

  const handleSignGate1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeGate1Booking) return
    setCompletedGate1((prev) => ({ ...prev, [activeGate1Booking.id]: true }))
    notify(
      `Departure check completed for ${activeGate1Booking.animal} · Safe journey authorized`,
      "ok",
    )
    setActiveGate1Booking(null)
  }

  const handleSignGate2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeGate2Booking) return
    setCompletedGate2((prev) => ({ ...prev, [activeGate2Booking.id]: true }))
    updateAnimalStatus(
      activeGate2Booking.animal,
      "Resting Buffer",
      `Completed seva for ${activeGate2Booking.customer}; 90-minute resting break active`,
    )
    notify(
      `Return check completed for ${activeGate2Booking.animal} · 90-minute rest period started`,
      "ok",
    )
    setActiveGate2Booking(null)
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Dynamic Date Selector */}
      <Panel className="p-4 sm:p-5 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-saffron-soft text-saffron-deep">
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
                {dayBookings.length}{" "}
                {dayBookings.length === 1 ? "Seva visit" : "Seva visits"}{" "}
                scheduled · Departure & Return safety checks
              </p>
            </div>
          </div>

          {/* Date Slider Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={
                availableDates.findIndex((d) => d.value === selectedDate) === 0
              }
              className="p-1.5 rounded-sm border border-line bg-card text-ink-soft hover:text-ink disabled:opacity-40 transition-colors"
              aria-label="Previous date"
              title="Previous date"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Horizontal Scrollable Date Buttons with Hover Detection */}
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
                  <div
                    key={d.value}
                    className="relative"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoverPos({
                        top: rect.bottom + 8,
                        left: rect.left + rect.width / 2,
                      })
                      setHoveredDate(d.value)
                    }}
                    onMouseLeave={() => setHoveredDate(null)}
                  >
                    <button
                      onClick={() => {
                        setSelectedDate(d.value)
                        setSelectedAnimal("ALL")
                      }}
                      className={`px-3 py-1.5 text-[12px] rounded-sm transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        isActive
                          ? "bg-saffron text-white font-medium shadow-sm ring-1 ring-saffron"
                          : "bg-paper border border-line text-ink-soft hover:border-line-strong hover:text-ink"
                      }`}
                    >
                      <span>{d.label}</span>
                      {dateBookingsCount > 0 && (
                        <span
                          className={`text-[9.5px] px-1 rounded-full font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-forest-soft text-forest font-semibold"
                          }`}
                        >
                          {dateBookingsCount}
                        </span>
                      )}
                    </button>
                  </div>
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
              aria-label="Next date"
              title="Next date"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Dynamic Cow Filter Row */}
        {distinctCows.length > 0 && (
          <div className="mt-4 pt-3 border-t border-line flex items-center gap-2 overflow-x-auto">
            <span className="text-[11.5px] text-ink-faint font-medium shrink-0 flex items-center gap-1">
              <PawPrint size={13} className="text-saffron-deep" />
              Filter by Cow:
            </span>
            <button
              onClick={() => setSelectedAnimal("ALL")}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-all whitespace-nowrap ${
                selectedAnimal === "ALL"
                  ? "bg-forest text-white font-medium shadow-xs"
                  : "bg-card border border-line text-ink-soft hover:text-ink"
              }`}
            >
              All Cows ({dayBookings.length})
            </button>
            {distinctCows.map((c) => {
              const count = dayBookings.filter((b) => b.animal === c).length
              return (
                <button
                  key={c}
                  onClick={() => setSelectedAnimal(c)}
                  className={`px-2.5 py-1 text-[11px] rounded-full transition-all whitespace-nowrap ${
                    selectedAnimal === c
                      ? "bg-forest text-white font-medium shadow-xs"
                      : "bg-card border border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  {c} ({count})
                </button>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Floating Hover Card (Zero Layout Shift, Fixed Position) */}
      {hoveredInfo && (
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
                <CalendarIcon size={14} className="text-saffron-deep" />
                <span>{hoveredInfo.date}</span>
              </div>
              <span
                className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium ${
                  hoveredInfo.tag === "Today"
                    ? "bg-forest-soft text-forest"
                    : hoveredInfo.tag === "Upcoming"
                      ? "bg-saffron-soft text-saffron-deep"
                      : "bg-paper-deep text-ink-faint"
                }`}
              >
                {hoveredInfo.tag}
              </span>
            </div>

            {hoveredInfo.count > 0 ? (
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex items-center justify-between text-ink-soft">
                  <span>Scheduled Sevas:</span>
                  <span className="font-semibold text-ink font-mono">
                    {hoveredInfo.count} bookings
                  </span>
                </div>
                <div className="space-y-1 pt-1 border-t border-line/50">
                  {hoveredInfo.bookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-ink-faint text-[11px]"
                    >
                      <span className="text-ink font-medium truncate max-w-[120px]">
                        {b.animal}
                      </span>
                      <span className="font-mono text-saffron-deep">
                        {b.start}–{b.end}
                      </span>
                    </div>
                  ))}
                  {hoveredInfo.bookings.length > 3 && (
                    <p className="text-[10px] text-ink-faint italic text-right">
                      +{hoveredInfo.bookings.length - 3} more seva...
                    </p>
                  )}
                </div>
                <div className="pt-1.5 border-t border-line/50 flex items-center gap-1 text-[10.5px] text-amber-700 bg-amber-50/70 p-1 rounded">
                  <Clock size={11} className="shrink-0" />
                  <span>90-min rest protected after each seva</span>
                </div>
              </div>
            ) : (
              <div className="text-[11.5px] text-ink-faint py-1 flex items-center gap-1.5">
                <HeartPulse size={14} className="text-forest" />
                <span>No visits scheduled · All cows resting safely</span>
              </div>
            )}

            <div className="pt-1 text-[10px] text-ink-faint/80 italic text-center">
              Click date to view full daily schedule
            </div>
          </div>
        </div>
      )}

      {/* 2. Daily Summary Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-saffron-soft text-saffron-deep">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              Sevas Today
            </div>
            <div className="text-[16px] font-serif font-bold text-ink">
              {dayBookings.length}{" "}
              {dayBookings.length === 1 ? "Booking" : "Bookings"}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-forest-soft text-forest">
            <PawPrint size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              Cows on Duty
            </div>
            <div className="text-[16px] font-serif font-bold text-ink">
              {distinctCows.length} {distinctCows.length === 1 ? "Cow" : "Cows"}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-amber-100 text-amber-800">
            <Clock size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              Rest Buffer
            </div>
            <div className="text-[13px] font-semibold text-amber-900">
              90m Rest Protected
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-sm border border-line bg-card flex items-center gap-3">
          <div className="p-2 rounded bg-blue-100 text-blue-800">
            <ClipboardCheck size={16} />
          </div>
          <div>
            <div className="text-[11px] text-ink-faint font-medium">
              Safety Checks
            </div>
            <div className="text-[13px] font-semibold text-ink">
              {Object.keys(completedGate1).length +
                Object.keys(completedGate2).length}{" "}
              Completed
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Timeline Panel (Schedule & 90-min Rest) */}
      <Panel>
        <PanelHead
          title="Daily Schedule & Cow Rest Timeline"
          desc={`Visual schedule for ${selectedDate} including mandatory 90-minute cow rest breaks`}
          right={
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11.5px] text-ink-faint">
                {displayBookings.length}{" "}
                {displayBookings.length === 1 ? "visit" : "visits"}
              </span>
            </div>
          }
        />

        {displayBookings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-forest-soft text-forest flex items-center justify-center mx-auto">
              <HeartPulse size={24} />
            </div>
            <div>
              <h4 className="font-serif text-[16px] text-ink font-semibold">
                No Sevas Scheduled for {selectedDate}
              </h4>
              <p className="text-[12.5px] text-ink-faint max-w-md mx-auto mt-1">
                All sacred cattle are peacefully resting in the Gaushala shed.
                There are no home visits scheduled on this date.
              </p>
            </div>
            {selectedDate !== TODAY_REFERENCE && (
              <button
                onClick={() => setSelectedDate(TODAY_REFERENCE)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium bg-saffron text-white rounded hover:bg-saffron-deep transition-colors"
              >
                <span>Jump to Today ({TODAY_REFERENCE})</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="p-5 overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Hour Ruler */}
              <div className="relative h-6 ml-[160px] border-b border-line">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 font-mono text-[10.5px] text-ink-faint -translate-x-1/2"
                    style={{ left: `${((h * 60 - dayStart) / span) * 100}%` }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Gantt Rows per Booking */}
              <div className="mt-3 space-y-3">
                {displayBookings.map((b) => {
                  const left = Math.max(
                    0,
                    Math.min(100, ((toMin(b.start) - dayStart) / span) * 100),
                  )
                  const width = Math.max(
                    8,
                    Math.min(
                      100 - left,
                      ((toMin(b.end) - toMin(b.start)) / span) * 100,
                    ),
                  )
                  // 90m Resting Buffer width
                  const bufferWidth = Math.max(
                    5,
                    Math.min(100 - left - width, (90 / span) * 100),
                  )

                  const isGate1Done = completedGate1[b.id]
                  const isGate2Done = completedGate2[b.id]

                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      {/* Left Cow Label */}
                      <div className="w-[150px] shrink-0">
                        <div className="text-[13px] text-ink font-semibold truncate flex items-center gap-1.5">
                          <PawPrint size={13} className="text-saffron-deep" />
                          <span>{b.animal}</span>
                          <span className="text-[10px] text-ink-faint font-normal font-sans">
                            ({b.animalType})
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-faint truncate">
                          {b.gosala}
                        </div>
                      </div>

                      {/* Timeline Bar Track */}
                      <div className="relative flex-1 h-12 bg-paper rounded-sm border border-line">
                        {/* Seva Duration Bar */}
                        <div
                          className="absolute top-1 bottom-1 rounded-sm bg-saffron text-white px-2.5 flex items-center justify-between overflow-hidden shadow-xs cursor-pointer hover:bg-saffron-deep transition-colors"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            minWidth: 110,
                          }}
                          title={`Seva: ${b.customer} · ${b.start}–${b.end} · ${b.address}`}
                        >
                          <span className="font-mono text-[11px] font-medium whitespace-nowrap">
                            {b.start}–{b.end}
                          </span>
                          <span className="text-[11px] font-medium truncate ml-2 hidden sm:inline">
                            {b.customer}
                          </span>
                        </div>

                        {/* 90-min Resting Buffer Bar */}
                        <div
                          className="absolute top-1 bottom-1 rounded-sm bg-amber-100/95 border border-dashed border-amber-400 px-2 flex items-center overflow-hidden"
                          style={{
                            left: `${left + width}%`,
                            width: `${bufferWidth}%`,
                            minWidth: 80,
                          }}
                          title={`Mandatory 90-Minute Rest & Fresh Water for ${b.animal} post-seva`}
                        >
                          <span className="font-mono text-[9.5px] text-amber-900 whitespace-nowrap flex items-center gap-1 font-semibold">
                            <Clock size={10} /> 90m Rest
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. Safety Health Checks & Departure Handover */}
        {displayBookings.length > 0 && (
          <div className="border-t border-line divide-y divide-line">
            <div className="px-5 py-2.5 bg-paper/60 text-[11.5px] font-medium text-ink-soft flex items-center justify-between">
              <span>Cattle Safety & Welfare Action Checklists</span>
              <span className="text-ink-faint text-[10.5px]">
                Clear Gate 1 before departure · Clear Gate 2 upon return
              </span>
            </div>

            {displayBookings.map((b) => {
              const isGate1Done = completedGate1[b.id]
              const isGate2Done = completedGate2[b.id]

              return (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[12px] text-ink-faint w-[92px] shrink-0">
                      {b.id}
                    </span>
                    <div>
                      <div className="text-[13.5px] text-ink font-medium truncate flex items-center gap-1.5">
                        <span>{b.customer}</span>
                        <span>·</span>
                        <span className="text-saffron-deep font-semibold">
                          {b.animal}
                        </span>
                        <span className="text-[11px] text-ink-faint font-normal">
                          ({b.animalType})
                        </span>
                      </div>
                      <div className="text-[11.5px] text-ink-faint flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-medium text-ink-soft">
                          {b.start}–{b.end}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[280px]">
                          {b.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                    <StatusPill status={b.status} />

                    {/* Departure Safety Check (Gate 1) */}
                    <button
                      onClick={() => setActiveGate1Booking(b)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium rounded border transition-colors ${
                        isGate1Done
                          ? "bg-forest-soft text-forest border-forest/30 hover:bg-forest-soft/80"
                          : "border-line bg-card hover:bg-paper-deep text-ink"
                      }`}
                      title="Safety check before cow leaves Gaushala"
                    >
                      {isGate1Done ? (
                        <>
                          <CheckCircle2 size={13} className="text-forest" />
                          <span>Departure Approved ✓</span>
                        </>
                      ) : (
                        <>
                          <ClipboardCheck size={13} className="text-forest" />
                          <span>Departure Check (Gate 1)</span>
                        </>
                      )}
                    </button>

                    {/* Return Health Check (Gate 2) */}
                    <button
                      onClick={() => setActiveGate2Booking(b)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium rounded border transition-colors ${
                        isGate2Done
                          ? "bg-saffron-soft text-saffron-deep border-saffron/30 hover:bg-saffron-soft/80"
                          : "border-line bg-card hover:bg-paper-deep text-ink"
                      }`}
                      title="Health inspection when cow returns to Gaushala"
                    >
                      {isGate2Done ? (
                        <>
                          <CheckCircle2
                            size={13}
                            className="text-saffron-deep"
                          />
                          <span>Return & 90m Rest ✓</span>
                        </>
                      ) : (
                        <>
                          <HeartPulse size={13} className="text-saffron" />
                          <span>Return Check (Gate 2)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* 5. Departure Safety Check Modal (Gate 1 - Simple & Respectful Words) */}
      {activeGate1Booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-md shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={20} className="text-forest" />
                <div>
                  <h3 className="font-serif text-[17px] text-ink font-semibold">
                    Departure Safety Check (Before Leaving Gaushala)
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Trip {activeGate1Booking.id} · {activeGate1Booking.animal} (
                    {activeGate1Booking.animalType}) · Devotee:{" "}
                    {activeGate1Booking.customer}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveGate1Booking(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSignGate1} className="p-5 space-y-4">
              <p className="text-[12.5px] text-ink-soft">
                Essential safety checklist before departure. Confirms the cow is
                alert, fed, and comfortable for travel.
              </p>

              <div className="space-y-3">
                {[
                  {
                    key: "demeanorVitals",
                    icon: ShieldCheck,
                    label: "Cow Health & Energy Check",
                    desc: "Bright eyes, moist nose, clean hooves, walking comfortably without any limp.",
                  },
                  {
                    key: "feedHydration",
                    icon: Droplets,
                    label: "Fresh Water & Feeding Check",
                    desc: "Offered fresh water to drink, plus 20 liters clean water and green fodder packed for the journey.",
                  },
                  {
                    key: "rampBedding",
                    icon: Truck,
                    label: "Vehicle Floor & Ramp Safety",
                    desc: "Clean soft paddy straw spread on vehicle floor, non-slip ramp, and chest bar padded.",
                  },
                  {
                    key: "handlerEscort",
                    icon: UserCheck,
                    label: "Trained Gosevak Assigned",
                    desc: "Dedicated Gaushala caretaker (Gosevak) accompanies the cow with a gentle soft cotton rope.",
                  },
                ].map(({ key, icon: Icon, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-3 rounded border border-line bg-card hover:border-line-strong cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={gate1Checks[(key as keyof typeof gate1Checks)]}
                      onChange={(e) =>
                        setGate1Checks({
                          ...gate1Checks,
                          [key]: e.target.checked,
                        })
                      }
                      className="mt-1 accent-forest h-4 w-4"
                    />
                    <div className="text-[12px]">
                      <div className="font-semibold text-ink flex items-center gap-1.5">
                        <Icon size={14} className="text-forest" />
                        <span>{label}</span>
                      </div>
                      <div className="text-[11.5px] text-ink-faint mt-0.5">
                        {desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setActiveGate1Booking(null)}
                  className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:opacity-95 transition-opacity shadow-sm"
                >
                  <Check size={15} /> Confirm Safe for Departure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Return Health Check Modal (Gate 2 - Simple & Respectful Words) */}
      {activeGate2Booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-md shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <HeartPulse size={20} className="text-saffron-deep" />
                <div>
                  <h3 className="font-serif text-[17px] text-ink font-semibold">
                    Return Health Check (When Cow Returns to Gaushala)
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Return inspection for {activeGate2Booking.animal} (
                    {activeGate2Booking.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveGate2Booking(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSignGate2} className="p-5 space-y-4">
              <p className="text-[12.5px] text-ink-soft">
                Completed upon vehicle return to Gaushala. Verifies health and
                starts the mandatory 90-minute resting break.
              </p>

              <div className="space-y-3">
                {[
                  {
                    key: "returnGait",
                    label: "Walking & Hoof Check",
                    desc: "Walked gently in the shed; hooves are clean and healthy, with no rope rubs or scratches.",
                  },
                  {
                    key: "respirationNormal",
                    label: "Breathing & Cool-down Check",
                    desc: "Calm and steady breathing, no panting or tiredness, normal body temperature.",
                  },
                  {
                    key: "waterProvided",
                    label: "Fresh Water & Energy Feed",
                    desc: "Cool fresh water and nutritious feed given in the cow's resting stall.",
                  },
                  {
                    key: "restingBufferInitiated",
                    label: "Start Mandatory 90-Minute Rest Period",
                    desc: "The cow will be safely resting in the shed and will not be assigned to another seva for 90 minutes.",
                  },
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-3 rounded border border-line bg-card hover:border-line-strong cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={gate2Checks[(key as keyof typeof gate2Checks)]}
                      onChange={(e) =>
                        setGate2Checks({
                          ...gate2Checks,
                          [key]: e.target.checked,
                        })
                      }
                      className="mt-1 accent-saffron h-4 w-4"
                    />
                    <div className="text-[12px]">
                      <div className="font-semibold text-ink">{label}</div>
                      <div className="text-[11.5px] text-ink-faint mt-0.5">
                        {desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setActiveGate2Booking(null)}
                  className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-saffron text-white rounded hover:bg-saffron-deep transition-colors shadow-sm"
                >
                  <Check size={15} /> Save Check & Start 90m Rest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
