import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Lock,
  MapPin,
  Minus,
  Plus,
  QrCode,
  ShieldCheck,
  Timer,
  X,
  Camera,
  Eye,
  Sparkles,
  Building2,
} from "lucide-react"
import type { Animal, AnimalType } from "../../data/animals"
import { type Gosala } from "../../data/customer"
import { DEFAULT_GOSALA_OFFERINGS } from "../../data/gosalas"
import { inr } from "../../data/mock"
import { useStore } from "../../store/store"
import { api } from "../../services/api"
import CattleAndShelterGallery from "../../components/CattleAndShelterGallery"

import {
  findNearestIndianHub,
  calculateRoadDistanceKm,
  INDIAN_REGIONAL_HUBS,
} from "../../data/regions"
import { useDeviceLocation } from "../../hooks/useDeviceLocation"

const steps = ["Date", "Time", "Duration", "Add-ons", "Address", "Pay"]
const weekDays = ["S", "M", "T", "W", "T", "F", "S"]
const standardSlots = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
]

function Calendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: Date
  onSelect: (d: Date) => void
}) {
  const [viewDate, setViewDate] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  const monthLabel = viewDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  })

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="font-serif text-[15px] font-semibold text-ink">
          {monthLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded hover:bg-paper-deep text-ink-soft cursor-pointer transition"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded hover:bg-paper-deep text-ink-soft cursor-pointer transition"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((d, i) => (
          <div
            key={i}
            className="text-center font-mono text-[10px] text-ink-faint py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const dateObj = new Date(viewYear, viewMonth, d)
          dateObj.setHours(0, 0, 0, 0)
          const isPast = dateObj.getTime() < today.getTime()
          const isActive =
            selectedDate.getDate() === d &&
            selectedDate.getMonth() === viewMonth &&
            selectedDate.getFullYear() === viewYear

          return (
            <button
              key={d}
              disabled={isPast}
              onClick={() => onSelect(dateObj)}
              className={`h-9 rounded-sm text-[13px] tabular transition-colors ${
                isActive
                  ? "bg-saffron text-white font-medium shadow-xs"
                  : isPast
                    ? "text-ink-faint/30 cursor-not-allowed line-through"
                    : "text-ink hover:bg-saffron-soft cursor-pointer"
              }`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function BookingFlow({
  animal,
  gosala,
  onClose,
  onComplete,
}: {
  animal: Animal
  gosala: Gosala
  onClose: () => void
  onComplete: (summary: import("../CustomerApp").BookingSummary) => void
}) {
  const { pricingConfig, checkAnimalAvailability, profiles, authUser } = useStore()
  const devoteeName = authUser?.name || profiles?.customer?.name || "Devotee"
  const deviceLocation = useDeviceLocation()

  // Dynamic Pan-India Venue & Landmark Options based on Gaushala's geographic coordinates
  const venueOptions = useMemo(() => {
    const originLat = gosala.lat ?? 18.5074
    const originLng = gosala.lng ?? 73.8077

    const nearestHub = findNearestIndianHub(originLat, originLng).hub

    const sameCityHubs = INDIAN_REGIONAL_HUBS.filter(
      (h) =>
        h.city.toLowerCase() === nearestHub.city.toLowerCase() ||
        h.state.toLowerCase() === nearestHub.state.toLowerCase(),
    ).slice(0, 4)

    const list: { name: string; distanceKm: number }[] = []

    // 1. If devotee has a detected or active device location, calculate real road distance to this Gaushala
    if (deviceLocation.lat && deviceLocation.lng) {
      const roadDist = Math.max(
        2.5,
        calculateRoadDistanceKm(originLat, originLng, deviceLocation.lat, deviceLocation.lng),
      )
      const userLabel =
        deviceLocation.address || `${deviceLocation.city || nearestHub.city} (Current Devotee Location)`
      list.push({
        name: `Current Location: ${userLabel}`,
        distanceKm: roadDist,
      })
    }

    // 2. Add local landmark presets corresponding to the Gaushala's metropolitan territory
    sameCityHubs.forEach((hub) => {
      const roadDist = Math.max(
        3.5,
        calculateRoadDistanceKm(originLat, originLng, hub.lat, hub.lng),
      )
      list.push({
        name: `${hub.name}, ${hub.city}`,
        distanceKm: roadDist,
      })
    })

    if (list.length === 0) {
      list.push(
        { name: `${gosala.name} Environs (${gosala.area || nearestHub.city})`, distanceKm: 4.2 },
        { name: `Central Temple Courtyard, ${nearestHub.city}`, distanceKm: 8.5 },
      )
    }

    return list
  }, [
    gosala.lat,
    gosala.lng,
    gosala.name,
    gosala.area,
    deviceLocation.lat,
    deviceLocation.lng,
    deviceLocation.address,
    deviceLocation.city,
  ])

  const [step, setStep] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [slot, setSlot] = useState<string | null>(null)
  const [duration, setDuration] = useState(60)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [includeCalfPair, setIncludeCalfPair] = useState(animal.type === "Cow & Calf")
  const CALF_PAIR_ADDON_PRICE = 1300
  const isPairService = animal.type === "Cow & Calf" || (animal.type === "Cow" && includeCalfPair)
  const pairSurcharge = (animal.type === "Cow" && includeCalfPair) ? CALF_PAIR_ADDON_PRICE : 0
  const effectiveAnimalType: AnimalType = isPairService ? "Cow & Calf" : (animal.type as AnimalType)
  const effectiveAnimalName =
    animal.type === "Cow" && includeCalfPair
      ? `${animal.name} & Accompanying Baby Calf`
      : animal.name
  const [selectedLocIndex, setSelectedLocIndex] = useState(0)
  const [address, setAddress] = useState(() => venueOptions[0]?.name || "Local Sanctuary Area")
  const [distanceKm, setDistanceKm] = useState(() => venueOptions[0]?.distanceKm || 6.5)

  useEffect(() => {
    if (venueOptions.length > 0 && (!address || address === "Local Sanctuary Area")) {
      setAddress(venueOptions[0].name)
      setDistanceKm(venueOptions[0].distanceKm)
    }
  }, [venueOptions, address])
  const [payMethod, setPayMethod] = useState<"upi" | "card" | "netbanking">(
    "upi",
  )
  const [payingStep, setPayingStep] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [holdSecs, setHoldSecs] = useState(300) // 5 minutes temporary slot hold
  const [photoInspectorOpen, setPhotoInspectorOpen] = useState(false)
  const [inspectorCategory, setInspectorCategory] = useState<"animal" | "shelter">("animal")

  const animalPhotos = useMemo(() => {
    if (animal.photos && animal.photos.length > 0) return animal.photos
    return [animal.photo]
  }, [animal])

  const shelterPhotos = useMemo(() => {
    if (gosala && (gosala as any).photos && (gosala as any).photos.length > 0) {
      return (gosala as any).photos as string[]
    }
    if (gosala && gosala.photo) {
      return [gosala.photo]
    }
    return [animal.photo]
  }, [gosala, animal])

  // Backend certified pricing and availability states
  const [backendPricing, setBackendPricing] = useState<{
    base: number
    extraTime: number
    transport: number
    addons: number
    tax: number
    discount: number
    total: number
    commission: number
    commissionPct: number
    freeKmSnapshot: number
    perKmSnapshot: number
    extraUnitRateSnapshot: number
    chargeableKm: number
  } | null>(null)

  const [backendSlotChecks, setBackendSlotChecks] = useState<Record<string, {
    available: boolean
    status: string
    reason?: string
  }>>({})

  const [holdId, setHoldId] = useState<string | null>(null)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [isHoldingSlot, setIsHoldingSlot] = useState(false)

  // Dynamically formatted date string (e.g., "4 Oct 2026")
  const selectedDateStr = useMemo(() => {
    return selectedDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }, [selectedDate])

  // Dynamically load add-ons/offerings from the Gaushala's inventory, or fallback to default offerings
  const dynamicAddons = useMemo(() => {
    const gaushalaItems = (gosala as any)?.items
    if (Array.isArray(gaushalaItems) && gaushalaItems.length > 0) {
      return gaushalaItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        desc: item.desc || "Gaushala sacred offering",
        price: item.price,
        maxQty: item.maxQty || 5,
      }))
    }
    return DEFAULT_GOSALA_OFFERINGS.map((item) => ({
      id: item.id,
      name: item.name,
      desc: item.desc,
      price: item.price,
      maxQty: item.maxQty || 5,
    }))
  }, [gosala])

  // Dynamic extra-time calculation based on Super Admin pricingConfig
  const durationOptions = useMemo(() => {
    return [
      { min: 60, label: "60 min", extra: 0, tag: "Included (Standard)" },
      {
        min: 90,
        label: "90 min",
        extra:
          Math.ceil(30 / pricingConfig.extraUnitMin) *
          pricingConfig.extraUnitRate,
        tag: `+30 min (+${inr(pricingConfig.extraUnitRate)})`,
      },
      {
        min: 120,
        label: "120 min",
        extra:
          Math.ceil(60 / pricingConfig.extraUnitMin) *
          pricingConfig.extraUnitRate,
        tag: `+60 min (+${inr(pricingConfig.extraUnitRate * 2)})`,
      },
      {
        min: 180,
        label: "180 min",
        extra:
          Math.ceil(120 / pricingConfig.extraUnitMin) *
          pricingConfig.extraUnitRate,
        tag: `+120 min (+${inr(pricingConfig.extraUnitRate * 4)})`,
      },
    ]
  }, [pricingConfig])

  const dur =
    durationOptions.find((d) => d.min === duration) || durationOptions[0]
  const addonTotal =
    dynamicAddons.reduce((a, x) => a + (qty[x.id] || 0) * x.price, 0) + pairSurcharge

  const effectiveTaxPct =
    gosala.taxTreatment === "section_80g_exempt"
      ? 0
      : gosala.taxTreatment === "reduced_charity_gst"
      ? 5
      : gosala.customTaxPct !== undefined
      ? gosala.customTaxPct
      : pricingConfig.taxPct

  // Real-time backend pricing engine call
  useEffect(() => {
    let active = true
    api
      .calculatePrice({
        baseRate: animal.price,
        durationMin: duration,
        distanceKm,
        addonsCost: addonTotal,
        taxPct: effectiveTaxPct,
        commissionPct: gosala.customCommissionPct ?? pricingConfig.commissionPct,
        commissionFlat: gosala.customCommissionFlat,
        gosalaId: gosala.id,
        gosala: gosala.name,
      })
      .then((res) => {
        if (active && res) {
          setBackendPricing(res)
        }
      })
      .catch((err) => {
        console.warn("Backend pricing calculation fallback:", err)
      })
    return () => {
      active = false
    }
  }, [
    animal.price,
    duration,
    distanceKm,
    addonTotal,
    effectiveTaxPct,
    gosala.id,
    gosala.name,
    gosala.customCommissionPct,
    gosala.customCommissionFlat,
    pricingConfig.commissionPct,
  ])

  // Real-time backend slot availability check
  useEffect(() => {
    let active = true
    async function loadSlotAvailability() {
      const checks: Record<string, {
        available: boolean
        status: string
        reason?: string
      }> = {}
      await Promise.all(
        standardSlots.map(async (time) => {
          try {
            const res = await api.getAvailability(
              animal.name,
              selectedDateStr,
              time,
              duration,
            )
            if (res) checks[time] = res
          } catch {}
        }),
      )
      if (active) setBackendSlotChecks(checks)
    }
    loadSlotAvailability()
    return () => {
      active = false
    }
  }, [animal.name, selectedDateStr, duration])

  // Slot availability check combining backend checks with local welfare rules
  const evaluatedSlots = useMemo(() => {
    return standardSlots.map((time) => {
      const localCheck = checkAnimalAvailability(
        animal.name,
        selectedDateStr,
        time,
        duration,
      )
      const backendCheck = backendSlotChecks[time]
      if (backendCheck) {
        return {
          time,
          available: backendCheck.available,
          status: backendCheck.status as any,
          reason: backendCheck.reason || localCheck.reason,
        }
      }
      return {
        time,
        ...localCheck,
      }
    })
  }, [
    animal.name,
    selectedDateStr,
    duration,
    checkAnimalAvailability,
    backendSlotChecks,
  ])

  // Server-certified derived calculations
  const chargeableKm = backendPricing
    ? backendPricing.chargeableKm
    : Math.max(0, distanceKm - pricingConfig.freeKm)
  const transport = backendPricing
    ? backendPricing.transport
    : Math.round((chargeableKm * pricingConfig.perKm) / 10) * 10
  const extraTime = backendPricing ? backendPricing.extraTime : dur.extra

  const tax = backendPricing
    ? backendPricing.tax
    : Math.round(
        ((animal.price + extraTime + transport + addonTotal) *
          effectiveTaxPct) /
          100,
      )
  const total = backendPricing
    ? backendPricing.total
    : animal.price + extraTime + transport + addonTotal + tax

  // Atomic server-side slot hold on Step 5 (Payment & Checkout)
  useEffect(() => {
    if (step !== 5 || !slot) return
    let active = true
    setIsHoldingSlot(true)
    setHoldError(null)

    api
      .holdSlot({
        animal: animal.name,
        date: selectedDateStr,
        start: slot,
        durationMin: duration,
        customerName: devoteeName,
      })
      .then((res) => {
        if (!active) return
        if (res.success && res.hold) {
          setHoldId(res.hold.id)
          setHoldError(null)
          setHoldSecs(300)
        } else {
          setHoldError(
            res.reason ||
              "This time slot is temporarily held by another devotee. Please select another slot.",
          )
        }
      })
      .catch((err) => {
        if (active) console.warn("Slot hold error:", err)
      })
      .finally(() => {
        if (active) setIsHoldingSlot(false)
      })

    return () => {
      active = false
    }
  }, [step, slot, animal.name, selectedDateStr, duration, devoteeName])

  // Hold timer countdown in step 5
  useEffect(() => {
    if (step !== 5) return
    const timer = setInterval(() => {
      setHoldSecs((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

  const formatHoldTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  }

  const handleClose = () => {
    if (holdId) {
      api.releaseHold(holdId).catch(() => {})
    }
    onClose()
  }

  const canNext = useMemo(() => {
    if (step === 0) return !!selectedDate
    if (step === 1) return !!slot
    return true
  }, [step, selectedDate, slot])

  const calculateEndTime = (startTime: string, durMin: number) => {
    const [h, m] = startTime.split(":").map(Number)
    const totalMin = h * 60 + m + durMin
    const endH = Math.floor(totalMin / 60)
    const endM = totalMin % 60
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`
  }

  const endTime = slot ? calculateEndTime(slot, duration) : ""

  const handleSelectLocation = (idx: number) => {
    setSelectedLocIndex(idx)
    const venue = venueOptions[idx]
    if (venue) {
      setAddress(venue.name)
      setDistanceKm(venue.distanceKm)
    }
  }

  const pay = () => {
    if (holdError) return
    setPayingStep("Connecting to payment gateway…")
    setTimeout(() => {
      setPayingStep("Verifying server-side webhook signature…")
      setTimeout(() => {
        setPayingStep("Validating concurrency & securing atomic slot hold…")
        setTimeout(() => {
          setPayingStep(null)
          setDone(true)
        }, 600)
      }, 700)
    }, 700)
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-paper flex items-center justify-center p-6">
        <div className="w-full max-w-[390px] text-center">
          <div className="h-16 w-16 rounded-full bg-ok-soft grid place-items-center mx-auto">
            <Check size={30} className="text-ok" />
          </div>
          <h2 className="font-serif text-[24px] text-ink mt-5">
            Payment verified
          </h2>
          <p className="text-[13px] text-ink-soft mt-2 leading-relaxed">
            Your booking is verified server-side and has entered the Manager
            review queue. You'll be notified on WhatsApp, SMS, and in-app once
            confirmed.
          </p>
          <div className="mt-6 rounded-sm border border-line bg-card p-4 text-left space-y-2 text-[13px]">
            {[
              ["Service Category", effectiveAnimalType === "Cow & Calf" ? "Gau-Vatsa Jodi Seva (Mother & Calf Pair)" : effectiveAnimalType],
              ["Bovine", effectiveAnimalName],
              ["Gosala", gosala.name],
              ["Date", selectedDateStr],
              ["Time", `${slot} – ${endTime} (${duration} min)`],
              [
                "Distance",
                `${distanceKm} km (${chargeableKm.toFixed(1)} km chargeable)`,
              ],
              ["Amount paid", inr(total)],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-ink-faint">{l}</span>
                <span className="text-ink font-medium text-right">{v}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              onComplete({
                animal: `${effectiveAnimalName} · ${effectiveAnimalType}`,
                animalName: effectiveAnimalName,
                animalType: effectiveAnimalType,
                gosala: gosala.name,
                date: selectedDateStr,
                time: `${slot} – ${endTime}`,
                start: slot!,
                end: endTime,
                durationMin: duration,
                address,
                distanceKm,
                base: backendPricing?.base ?? animal.price,
                extraTime: backendPricing?.extraTime ?? extraTime,
                transport: backendPricing?.transport ?? transport,
                addons: backendPricing?.addons ?? addonTotal,
                tax: backendPricing?.tax ?? tax,
                total: backendPricing?.total ?? total,
                holdId: holdId || undefined,
                freeKmSnapshot:
                  backendPricing?.freeKmSnapshot ?? pricingConfig.freeKm,
                perKmSnapshot:
                  backendPricing?.perKmSnapshot ?? pricingConfig.perKm,
                extraUnitRateSnapshot:
                  backendPricing?.extraUnitRateSnapshot ??
                  pricingConfig.extraUnitRate,
                commissionSnapshot: backendPricing?.commission,
                commissionPct:
                  backendPricing?.commissionPct ??
                  (gosala.customCommissionPct !== undefined
                    ? gosala.customCommissionPct
                    : pricingConfig.commissionPct),
              })
            }
            className="w-full mt-6 bg-saffron text-white rounded-sm py-3 text-[14px] font-medium hover:bg-saffron-deep transition-colors shadow-sm"
          >
            View my booking & tracking
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper flex justify-center">
      <div className="w-full max-w-[440px] flex flex-col bg-paper">
        {/* Header + progress */}
        <div className="px-4 pt-4 pb-3 border-b border-line bg-card">
          <div className="flex items-center gap-2">
            <button
              onClick={step === 0 ? handleClose : () => setStep((s) => s - 1)}
              className="text-ink-soft hover:text-ink -ml-1 p-1"
              aria-label="Back"
            >
              {step === 0 ? <X size={20} /> : <ChevronLeft size={20} />}
            </button>
            <div className="min-w-0">
              <div className="font-serif text-[15px] text-ink leading-tight">
                Book {animal.name}
              </div>
              <div className="text-[11px] text-ink-faint truncate">
                {gosala.name}
              </div>
            </div>
            <span className="ml-auto font-mono text-[11px] text-ink-faint">
              {step + 1}/{steps.length}
            </span>
            {step > 0 && (
              <button
                onClick={handleClose}
                className="text-ink-faint hover:text-ink p-1 ml-1"
                aria-label="Cancel and Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex gap-1 mt-3">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-saffron" : "bg-paper-deep"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Photo Transparency & Inspection Quick Bar */}
        <div className="mx-4 mt-2.5 p-2 rounded-md bg-paper-deep/80 border border-line flex items-center justify-between gap-2 text-[12px]">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex -space-x-1.5 shrink-0">
              <img
                src={animalPhotos[0]}
                alt={animal.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-card shadow-xs cursor-pointer hover:scale-105 transition"
                onClick={() => {
                  setInspectorCategory("animal")
                  setPhotoInspectorOpen(true)
                }}
              />
              <img
                src={shelterPhotos[0]}
                alt={gosala.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-card shadow-xs cursor-pointer hover:scale-105 transition"
                onClick={() => {
                  setInspectorCategory("shelter")
                  setPhotoInspectorOpen(true)
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-ink truncate">
                {animal.name} · {gosala.name}
              </div>
              <div className="text-[10px] text-ink-faint flex items-center gap-1.5 font-mono">
                <span>🐄 {animalPhotos.length} cow photos</span>
                <span>·</span>
                <span>🏛️ {shelterPhotos.length} shelter photos</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInspectorCategory("animal")
              setPhotoInspectorOpen(true)
            }}
            className="px-2.5 py-1 rounded bg-card hover:bg-paper-light border border-line text-[11px] font-medium text-saffron-deep hover:text-saffron shrink-0 transition flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Camera size={12} />
            <span>Photos</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="font-serif text-[20px] text-ink mb-4">
            {steps[step]}
          </h2>

          {step === 0 && (
            <div className="rounded-sm border border-line bg-card p-4">
              <Calendar selectedDate={selectedDate} onSelect={setSelectedDate} />
              <p className="text-[11.5px] text-ink-faint mt-3 pt-3 border-t border-line">
                Availability is checked live for {animal.name} on the selected
                date ({selectedDateStr}).
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                {evaluatedSlots.map((s) => {
                  const isSelected = slot === s.time
                  const isAvailable = s.available
                  const isBooked = s.status === "Booked"
                  const isBuffer = s.status === "Buffer"
                  const isBlocked = s.status === "Blocked"

                  return (
                    <button
                      key={s.time}
                      disabled={!isAvailable}
                      onClick={() => setSlot(s.time)}
                      title={s.reason}
                      className={`rounded-sm border p-3 text-left transition-colors relative ${
                        isSelected
                          ? "border-saffron bg-saffron-soft ring-2 ring-saffron/20"
                          : isAvailable
                            ? "border-line bg-card hover:border-saffron/60 cursor-pointer"
                            : "border-line bg-paper-deep/60 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div
                        className={`font-mono text-[14px] tabular ${
                          isAvailable
                            ? "text-ink font-medium"
                            : "text-ink-faint line-through"
                        }`}
                      >
                        {s.time}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isAvailable
                              ? "bg-ok"
                              : isBooked
                                ? "bg-saffron"
                                : isBuffer
                                  ? "bg-warn"
                                  : "bg-ink-faint"
                          }`}
                        />
                        <span
                          className={`text-[10.5px] font-medium ${
                            isAvailable
                              ? "text-ok"
                              : isBooked
                                ? "text-saffron-deep font-semibold"
                                : isBuffer
                                  ? "text-warn"
                                  : "text-ink-faint"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      {s.reason && !isAvailable && (
                        <div className="text-[9.5px] text-ink-faint truncate mt-0.5">
                          {s.reason}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="p-3 bg-paper-deep rounded-sm border border-line text-[11px] text-ink-faint flex items-center gap-2">
                <ShieldCheck size={14} className="text-saffron shrink-0" />
                <span>
                  Availability = Animal ({animal.name}) + Date (
                  {selectedDateStr}) + Slot duration. Overlapping bookings are
                  prevented automatically.
                </span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2.5">
              {durationOptions.map((d) => (
                <button
                  key={d.min}
                  onClick={() => setDuration(d.min)}
                  className={`w-full flex items-center gap-3 rounded-sm border p-4 transition-colors ${
                    duration === d.min
                      ? "border-saffron bg-saffron-soft ring-1 ring-saffron"
                      : "border-line bg-card hover:border-line-strong"
                  }`}
                >
                  <Clock
                    size={18}
                    className={
                      duration === d.min ? "text-saffron" : "text-ink-faint"
                    }
                  />
                  <div className="text-left">
                    <div className="text-[14px] text-ink font-medium">
                      {d.label}
                    </div>
                    <div className="text-[11px] text-ink-faint">{d.tag}</div>
                  </div>
                  <div className="ml-auto font-mono text-[13px] text-ink tabular font-medium">
                    {d.extra === 0 ? "Included" : `+${inr(d.extra)}`}
                  </div>
                </button>
              ))}
              <p className="text-[11.5px] text-ink-faint px-1">
                First 60 minutes included. Extra time billed at{" "}
                {inr(pricingConfig.extraUnitRate)} /{" "}
                {pricingConfig.extraUnitMin} min.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {/* Mother Cow & Calf Pair (Gau-Vatsa Jodi) Upgrade */}
              {animal.type === "Cow" && (
                <div
                  className={`p-3.5 rounded-sm border transition-all ${
                    includeCalfPair
                      ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-400"
                      : "bg-card border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif text-[14.5px] font-semibold text-ink">
                          Gau-Vatsa Jodi Seva · Cow & Calf Joint Booking
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          Single-Time Joint Seva
                        </span>
                      </div>
                      <p className="text-[11.5px] text-ink-soft mt-1 leading-relaxed">
                        Bring the accompanying baby calf along with {animal.name} for sacred Mother-Calf puja & blessings at your doorstep. Both bovines arrive together.
                      </p>
                      <div className="font-mono text-[12.5px] text-amber-900 font-bold mt-1.5 flex items-center gap-1.5">
                        <span>+{inr(CALF_PAIR_ADDON_PRICE)}</span>
                        <span className="text-[11px] text-ink-faint font-normal font-sans">
                          (Accompanying calf transport & attendant included)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIncludeCalfPair(!includeCalfPair)}
                      className={`shrink-0 px-3 py-1.5 rounded-sm text-[12px] font-medium transition cursor-pointer shadow-2xs ${
                        includeCalfPair
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : "bg-paper text-ink border border-line hover:border-line-strong hover:bg-paper-deep"
                      }`}
                    >
                      {includeCalfPair ? "✓ Pair Selected" : "+ Add Calf (Jodi)"}
                    </button>
                  </div>
                </div>
              )}

              {animal.type === "Cow & Calf" && (
                <div className="p-3.5 rounded-sm border border-amber-300 bg-amber-50/70">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-700" />
                    <span className="font-serif text-[14.5px] font-semibold text-ink">
                      Sacred Gau-Vatsa Jodi Seva Included
                    </span>
                  </div>
                  <p className="text-[11.5px] text-ink-soft mt-1 leading-relaxed">
                    This booking includes both the Mother Cow and her nursing Calf together for a single-time holistic Vedic blessing ceremony.
                  </p>
                </div>
              )}

              {animal.type === "Buffalo" && (
                <div className="p-3.5 rounded-sm border border-indigo-200 bg-indigo-50/50">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-indigo-700" />
                    <span className="font-serif text-[14.5px] font-semibold text-ink">
                      Indigenous Sacred Buffalo (Mahishi Seva)
                    </span>
                  </div>
                  <p className="text-[11.5px] text-ink-soft mt-0.5 leading-relaxed">
                    Doorstep darshan and Gau Gras feeding for revered indigenous buffalo breed with trained attendant.
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {dynamicAddons.map((a) => {
                const q = qty[a.id] || 0
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-sm border border-line bg-card p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-ink font-medium">
                        {a.name}
                      </div>
                      <div className="text-[11px] text-ink-faint">{a.desc}</div>
                      <div className="font-mono text-[12px] text-ink mt-0.5 tabular">
                        {inr(a.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() =>
                          setQty((p) => ({ ...p, [a.id]: Math.max(0, q - 1) }))
                        }
                        disabled={q === 0}
                        className="h-7 w-7 grid place-items-center rounded-sm border border-line text-ink-soft disabled:opacity-40 hover:bg-paper-deep"
                        aria-label="Decrease"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="font-mono text-[13px] w-4 text-center tabular">
                        {q}
                      </span>
                      <button
                        onClick={() =>
                          setQty((p) => ({
                            ...p,
                            [a.id]: Math.min(a.maxQty, q + 1),
                          }))
                        }
                        disabled={q >= a.maxQty}
                        className="h-7 w-7 grid place-items-center rounded-sm border border-line text-ink-soft disabled:opacity-40 hover:bg-paper-deep"
                        aria-label="Increase"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint block mb-2">
                  Select service area / landmark ({venueOptions.length} available)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {venueOptions.map((loc, idx) => (
                    <button
                      key={loc.name}
                      onClick={() => handleSelectLocation(idx)}
                      className={`p-3 rounded-sm border text-left flex items-center justify-between text-[12.5px] transition-colors ${
                        selectedLocIndex === idx
                          ? "border-saffron bg-saffron-soft font-medium text-ink"
                          : "border-line bg-card text-ink-soft hover:border-line-strong"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <MapPin
                          size={14}
                          className={`shrink-0 ${
                            selectedLocIndex === idx
                              ? "text-saffron"
                              : "text-ink-faint"
                          }`}
                        />
                        <span className="truncate">{loc.name}</span>
                      </span>
                      <span className="font-mono tabular text-ink-faint shrink-0 ml-2">
                        {loc.distanceKm} km
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-sm border border-line bg-card p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Detailed address
                </div>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="mt-2 w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 resize-none"
                />
              </div>

              <div className="rounded-sm border border-line bg-card p-4 space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-ink-faint">Total distance</span>
                  <span className="font-mono text-ink tabular">
                    {distanceKm} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-faint">
                    Free transport included
                  </span>
                  <span className="font-mono text-ok tabular">
                    First {pricingConfig.freeKm} km (₹0)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-faint">
                    Chargeable ({chargeableKm.toFixed(1)} km ×{" "}
                    {inr(pricingConfig.perKm)}/km)
                  </span>
                  <span className="font-mono text-ink tabular font-medium">
                    {inr(transport)}
                  </span>
                </div>
              </div>
              <p className="text-[11.5px] text-ink-faint px-1">
                Transport is free within {pricingConfig.freeKm} km. Beyond that,{" "}
                {inr(pricingConfig.perKm)}/km applies to the chargeable
                distance, rounded per admin rules.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {/* Temporary slot hold banner */}
              {holdError ? (
                <div className="rounded-sm border border-danger/40 bg-danger-soft/60 p-3.5 flex items-start gap-2.5 text-[12.5px] text-danger">
                  <AlertCircle size={17} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[13px]">
                      Slot Temporarily Unavailable
                    </div>
                    <div className="mt-0.5 text-danger/90">{holdError}</div>
                    <button
                      onClick={() => setStep(1)}
                      className="mt-2 inline-flex items-center text-[12px] font-medium underline cursor-pointer text-danger hover:text-danger/80"
                    >
                      Choose another available slot →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-sm border border-saffron/40 bg-saffron-soft/60 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer size={16} className="text-saffron animate-pulse" />
                    <span className="text-[12px] text-saffron-deep font-medium">
                      Temporary slot hold active
                    </span>
                  </div>
                  <span className="font-mono text-[13px] text-saffron-deep font-bold tabular">
                    {formatHoldTime(holdSecs)}
                  </span>
                </div>
              )}

              {/* Photo & Premise Visual Verification Card */}
              <div className="rounded-sm border border-line bg-card p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    Verified Sacred Animal & Shelter
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorCategory("animal")
                      setPhotoInspectorOpen(true)
                    }}
                    className="text-[11.5px] text-saffron font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={12} /> Inspect Gallery
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => {
                      setInspectorCategory("animal")
                      setPhotoInspectorOpen(true)
                    }}
                    className="group relative rounded overflow-hidden aspect-[4/3] bg-paper-deep border border-line cursor-pointer"
                  >
                    <img
                      src={animalPhotos[0]}
                      alt={animal.name}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-1.5 inset-x-2 text-white">
                      <div className="text-[11px] font-medium truncate">🐄 {animal.name}</div>
                      <div className="text-[9.5px] opacity-85 font-mono">{animalPhotos.length} angles</div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setInspectorCategory("shelter")
                      setPhotoInspectorOpen(true)
                    }}
                    className="group relative rounded overflow-hidden aspect-[4/3] bg-paper-deep border border-line cursor-pointer"
                  >
                    <img
                      src={shelterPhotos[0]}
                      alt={gosala.name}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-1.5 inset-x-2 text-white">
                      <div className="text-[11px] font-medium truncate">🏛️ {gosala.name}</div>
                      <div className="text-[9.5px] opacity-85 font-mono">{shelterPhotos.length} facility photos</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-sm border border-line bg-card p-4 space-y-2.5 text-[13px]">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-1">
                  Booking overview
                </div>
                {[
                  ["Service Category", isPairService ? "Gau-Vatsa Jodi Seva (Mother & Calf Pair)" : effectiveAnimalType],
                  ["Bovine", `${effectiveAnimalName} (${animal.breed || "Indigenous Gir"})`],
                  ["Gosala", gosala.name],
                  ["Date", selectedDateStr],
                  ["Time", `${slot} – ${endTime}`],
                  ["Duration", `${duration} min (${dur.label})`],
                  ["Service address", address],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-4">
                    <span className="text-ink-faint shrink-0">{l}</span>
                    <span className="text-ink text-right truncate font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {/* Payment Method Selector */}
              <div className="rounded-sm border border-line bg-card p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-3">
                  Payment Method
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "upi", label: "UPI / QR", icon: QrCode },
                    { id: "card", label: "Card", icon: CreditCard },
                    { id: "netbanking", label: "NetBanking", icon: Lock },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPayMethod(m.id as any)}
                      className={`p-2.5 rounded-sm border text-center transition-colors ${
                        payMethod === m.id
                          ? "border-saffron bg-saffron-soft text-saffron-deep font-medium"
                          : "border-line bg-paper text-ink-soft hover:border-line-strong"
                      }`}
                    >
                      <m.icon size={15} className="mx-auto mb-1" />
                      <div className="text-[11.5px]">{m.label}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 p-2.5 bg-paper rounded-sm border border-line text-[11px] text-ink-faint">
                  {payMethod === "upi" &&
                    "Google Pay, PhonePe, Paytm or UPI QR Code"}
                  {payMethod === "card" &&
                    "Visa, Mastercard, RuPay debit & credit cards"}
                  {payMethod === "netbanking" &&
                    "All major Indian banks supported (HDFC, ICICI, SBI, etc.)"}
                </div>
              </div>

              <div className="rounded-sm border border-line bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    Price breakdown
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-ok bg-ok-soft px-1.5 py-0.5 rounded-xs font-mono font-medium">
                    <ShieldCheck size={11} /> Server-Verified
                  </span>
                </div>
                <div className="space-y-2 text-[13px]">
                  <Line
                    l="Base booking (60 min)"
                    v={backendPricing?.base ?? animal.price}
                  />
                  {pairSurcharge > 0 && (
                    <div className="flex justify-between text-amber-900 font-medium text-[12.5px]">
                      <span>Accompanying Baby Calf Seva (Gau-Vatsa Jodi)</span>
                      <span className="font-mono tabular">+{inr(pairSurcharge)}</span>
                    </div>
                  )}
                  {extraTime > 0 && (
                    <Line
                      l={`Extra time (${duration - 60} min)`}
                      v={extraTime}
                    />
                  )}
                  <Line
                    l={`Transport (${chargeableKm.toFixed(1)} km chargeable)`}
                    v={transport}
                  />
                  {addonTotal - pairSurcharge > 0 && (
                    <Line l="Sacred Offerings & Add-ons" v={addonTotal - pairSurcharge} />
                  )}
                  <Line
                    l={
                      effectiveTaxPct === 0
                        ? "GST / Tax (Section 80G Exempt: 0%)"
                        : `GST / Tax (${effectiveTaxPct}%)`
                    }
                    v={tax}
                  />
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-line-strong">
                  <span className="font-serif text-[16px] text-ink">
                    Total payable
                  </span>
                  <span className="font-mono text-[20px] text-ink tabular font-bold">
                    {inr(total)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11.5px] text-ink-faint px-1">
                <ShieldCheck size={14} className="text-ok mt-0.5 shrink-0" />
                Payment is verified server-side via webhook. Concurrency-safe
                slot lock ensures no double booking.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line bg-card p-4">
          {step < 5 ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Running total
                </div>
                <div className="font-mono text-[16px] text-ink tabular">
                  {inr(total)}
                </div>
              </div>
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="ml-auto inline-flex items-center gap-2 bg-saffron text-white rounded-sm px-6 py-3 text-[14px] font-medium hover:bg-saffron-deep disabled:opacity-40 transition-colors shadow-sm"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={pay}
              disabled={payingStep !== null || isHoldingSlot || !!holdError}
              className="w-full inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-3.5 text-[14px] font-medium hover:bg-saffron-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {payingStep ? (
                <span className="animate-pulse">{payingStep}</span>
              ) : isHoldingSlot ? (
                <span className="animate-pulse">
                  Securing server slot lock…
                </span>
              ) : holdError ? (
                <span>Slot unavailable · Select new slot</span>
              ) : (
                <>
                  <CreditCard size={16} /> Pay {inr(total)} &amp; Book
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Full-Screen / Modal Photo Inspector Dialog */}
      {photoInspectorOpen && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-[520px] max-h-[92vh] bg-card rounded-xl border border-line shadow-2xl flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-line flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-saffron-deep" />
                <span className="font-serif text-[15px] text-ink font-semibold">
                  Photos & Premises Verification
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPhotoInspectorOpen(false)}
                className="p-1.5 rounded-full text-ink-soft hover:text-ink bg-card border border-line cursor-pointer hover:bg-paper-light transition"
                aria-label="Close photo inspector"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-3 sm:p-4 overflow-y-auto flex-1">
              <CattleAndShelterGallery
                animal={animal}
                gosalaName={gosala.name}
                initialCategory={inspectorCategory}
              />
            </div>

            <div className="p-3 border-t border-line bg-paper/70 flex items-center justify-between gap-3 text-[12px]">
              <span className="text-ink-faint text-[11px] truncate">
                Inspect sacred cattle and shelter before confirming dakshina
              </span>
              <button
                type="button"
                onClick={() => setPhotoInspectorOpen(false)}
                className="px-3.5 py-1.5 bg-saffron text-white rounded font-medium hover:bg-saffron-deep cursor-pointer shrink-0 transition"
              >
                Back to Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Line({ l, v }: { l: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{l}</span>
      <span className="font-mono text-ink tabular">{inr(v)}</span>
    </div>
  )
}
