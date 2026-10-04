import { useState } from "react"
import {
  Phone,
  MessageSquare,
  ShieldCheck,
  Star,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  Truck,
  MapPin,
  Clock,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react"
import { tripStages } from "../data/driver"
import type { MyBooking } from "../views/CustomerApp"
import LiveTripMap from "./LiveTripMap"
import { useToast } from "../store/store"

export interface CustomerTrackingDossierProps {
  booking: MyBooking
  customerCoords?: [number, number] | null
  layoutMode?: "compact" | "wide"
  heightClass?: string
}

export default function CustomerTrackingDossier({
  booking,
  customerCoords,
  layoutMode = "compact",
  heightClass = "h-64",
}: CustomerTrackingDossierProps) {
  const { notify } = useToast()
  const [copiedOtp, setCopiedOtp] = useState(false)
  const [revealedOtp, setRevealedOtp] = useState(false)

  const stage = booking.driverStage ?? 0
  const isDriverAssigned = Boolean(booking.driver && booking.driver.trim().length > 0)
  const isArrived = stage === 5
  const isHandoverVerified = Boolean(booking.handoverOtpVerified || stage >= 6)

  const otp = String(booking.handoverOtp || "4819")
  const driverName = booking.driver || "Pending Assignment"
  const driverPhone = booking.driverPhone || "+91 98490 23456"
  const vehiclePlate = booking.driverVehiclePlate || "TS 09 EA 4402"
  const vehicleModel =
    booking.driverVehicleModel || "Force Traveller Cattle Ambulance"
  const driverRating = booking.driverRating ?? 4.9
  const totalTrips = booking.driverTotalTrips ?? 184

  const handleCopyOtp = () => {
    navigator.clipboard?.writeText(otp)
    setCopiedOtp(true)
    notify(`Handover OTP ${otp} copied to clipboard`, "ok")
    setTimeout(() => setCopiedOtp(false), 2500)
  }

  // Pre-filled WhatsApp message for quick communication
  const whatsappUrl = `https://wa.me/${driverPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
    `Hare Krishna ${driverName}! Regarding GOMAA Booking ${booking.id} (${booking.animal}) for ${booking.gosala}. Our altar is ready.`,
  )}`

  return (
    <div className="space-y-4">
      {/* Live Map Component */}
      <LiveTripMap
        bookingId={booking.id}
        pickupLocation={booking.gosala}
        dropLocation={booking.address || "Kondapur, Hyderabad"}
        driverName={driverName}
        stageIndex={stage}
        distanceKm={booking.distanceKm || 8}
        customerCoords={customerCoords}
        viewerRole="CUSTOMER"
        heightClass={layoutMode === "wide" ? "h-[400px]" : heightClass}
      />

      {/* DRIVER ALLOCATION SECTION (Swiggy / Uber Style) */}
      {!isDriverAssigned ? (
        /* DISPATCH RADAR: When driver is being allocated */
        <div className="rounded-xl border border-saffron/40 bg-gradient-to-br from-saffron-soft/50 via-card to-paper p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            {/* Pulsing Radar Ring */}
            <div className="relative shrink-0 flex items-center justify-center h-13 w-13 rounded-full bg-saffron/15 text-saffron-deep">
              <span className="absolute inline-flex h-full w-full rounded-full bg-saffron/30 animate-ping opacity-75" />
              <Truck size={22} className="relative z-10 text-saffron-deep" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10.5px] font-mono uppercase font-semibold text-saffron-deep tracking-wider">
                  <Radio size={12} className="animate-pulse text-saffron" />
                  Dispatch Radar Active
                </span>
              </div>
              <div className="text-[14px] font-medium text-ink mt-0.5 font-serif">
                Allocating Nearest Cattle Ambulance
              </div>
              <div className="text-[11.5px] text-ink-faint">
                Broadcasting to AWBI-certified bovine handlers near {booking.gosala}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-saffron/20 grid grid-cols-2 gap-2 text-[11px] text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-forest" />
              <span>Sanitized Hydraulic Van</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
              <span>Est. assignment &lt; 2 min</span>
            </div>
          </div>
        </div>
      ) : (
        /* RICH DRIVER DOSSIER: When driver is assigned */
        <div className="rounded-xl border border-line bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Pilot Avatar with online beacon */}
              <div className="relative">
                <div className="h-13 w-13 rounded-full bg-forest text-white grid place-items-center font-serif text-[17px] font-semibold shadow-xs">
                  {driverName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-card" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-ink">
                    {driverName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9.5px] bg-forest-soft text-forest font-medium border border-forest/30 inline-flex items-center gap-0.5">
                    <ShieldCheck size={11} /> Pilot
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11.5px] text-ink-soft mt-0.5">
                  <span className="inline-flex items-center gap-1 text-saffron-deep font-semibold">
                    <Star size={12} className="text-saffron fill-saffron" />
                    {driverRating}
                  </span>
                  <span>·</span>
                  <span className="text-ink-faint font-mono">
                    {totalTrips} Seva Trips
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Contact Actions */}
            <div className="flex items-center gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 grid place-items-center hover:bg-emerald-600 hover:text-white transition cursor-pointer"
                title="Message Pilot via WhatsApp"
              >
                <MessageSquare size={16} />
              </a>
              <a
                href={`tel:${driverPhone.replace(/[^\d+]/g, "")}`}
                className="h-9 w-9 rounded-full bg-forest text-white grid place-items-center shadow-xs hover:bg-forest/90 transition cursor-pointer"
                title="Call Bovine Pilot"
              >
                <Phone size={16} />
              </a>
            </div>
          </div>

          {/* Vehicle Information Badge in Indian HSRP Style */}
          <div className="mt-3.5 pt-3 border-t border-line/60 flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              {/* Authentic Indian High Security Plate Style */}
              <div className="inline-flex items-center border-2 border-ink/80 rounded bg-white px-2 py-0.5 shadow-2xs font-mono font-bold text-ink tracking-wider text-[11.5px]">
                <span className="text-[8px] bg-blue-700 text-white px-0.5 py-0.2 mr-1 rounded-2xs font-sans">
                  IND
                </span>
                {vehiclePlate}
              </div>
              <span className="text-[11.5px] text-ink-faint truncate max-w-[170px] sm:max-w-none">
                {vehicleModel}
              </span>
            </div>
            <span className="text-[10.5px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              Padded & GPS Tracked
            </span>
          </div>
        </div>
      )}

      {/* DYNAMIC ANIMAL HANDOVER OTP CARD (Devotee Receipt Verification) */}
      <div
        className={`rounded-xl border transition-all duration-300 overflow-hidden ${
          isHandoverVerified
            ? "border-emerald-300 bg-emerald-50/60 shadow-xs"
            : isArrived
              ? "border-saffron bg-gradient-to-b from-amber-50 to-orange-50/80 shadow-md ring-2 ring-saffron/30 animate-pulse-gentle"
              : "border-line bg-card shadow-xs"
        }`}
      >
        {isHandoverVerified ? (
          /* STATE 3: Verified Animal Handover at Altar */
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0 shadow-xs">
                <CheckCircle2 size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-serif font-bold text-emerald-950">
                    Sacred Handover Authenticated
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-200 text-emerald-900 font-mono font-semibold">
                    OTP Verified
                  </span>
                </div>
                <div className="text-[12px] text-emerald-800 mt-0.5">
                  Bovine safely received at devotee entrance. Puja ceremony is active!
                </div>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-[11px] font-mono text-emerald-900/80">
              <span>Devotee Receipt: Verified at Altar</span>
              <span>
                {booking.handoverOtpVerifiedAt
                  ? new Date(booking.handoverOtpVerifiedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Verified"}
              </span>
            </div>
          </div>
        ) : isArrived ? (
          /* STATE 2: Driver Arrived at Entrance - Urgent OTP Share Card */
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-saffron-deep font-bold text-[13px] uppercase font-mono tracking-wider">
                  <Sparkles size={14} className="text-saffron animate-spin-slow" />
                  Ambulance Outside Doorstep!
                </div>
                <h3 className="font-serif text-[17px] text-ink font-semibold mt-0.5 leading-snug">
                  Animal Handover & Receipt OTP
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-saffron text-white font-bold tracking-wider animate-pulse">
                ACTION REQUIRED
              </span>
            </div>

            <p className="text-[12px] text-ink-soft leading-relaxed">
              Please inspect <strong className="text-ink">{booking.animal}</strong> to
              confirm comfort, then share this 4-digit OTP with your pilot to begin the
              puja:
            </p>

            {/* 4-Box Large OTP Display */}
            <div className="flex items-center justify-center gap-2.5 py-1">
              {otp.split("").map((digit, idx) => (
                <div
                  key={idx}
                  className="h-12 w-11 rounded-lg border-2 border-saffron bg-white text-saffron-deep font-mono text-[22px] font-bold grid place-items-center shadow-xs"
                >
                  {digit}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-saffron/20">
              <button
                type="button"
                onClick={handleCopyOtp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-paper border border-saffron/40 text-[12px] font-medium text-saffron-deep transition cursor-pointer shadow-2xs"
              >
                {copiedOtp ? (
                  <>
                    <Check size={13} className="text-forest" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <div className="text-[11px] text-ink-faint text-right">
                Pilot must verify code to begin seva
              </div>
            </div>

            {/* Devotee Checklist */}
            <div className="rounded bg-white/70 border border-saffron/20 p-2.5 text-[11.5px] text-ink-soft space-y-1">
              <div className="font-semibold text-saffron-deep">Doorstep Inspection Checklist:</div>
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-forest shrink-0" />
                <span>Bovine is calm, well-hydrated, and uninjured</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-forest shrink-0" />
                <span>Clean altar area ready for ceremonial reception</span>
              </div>
            </div>
          </div>
        ) : (
          /* STATE 1: En Route / In Preparation (Preview) */
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-saffron" />
                <span className="font-serif text-[14.5px] font-semibold text-ink">
                  Devotee Handover OTP
                </span>
              </div>
              <span className="text-[11px] font-mono text-ink-faint bg-paper px-2 py-0.5 rounded border border-line">
                Unlocks on Arrival
              </span>
            </div>

            <div className="flex items-center justify-between bg-paper/70 rounded-lg p-3 border border-line/60">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Security Delivery PIN
                </div>
                <div className="font-mono text-[18px] font-bold text-ink mt-0.5 tracking-widest">
                  {revealedOtp ? otp : "• • • •"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRevealedOtp((v) => !v)}
                  className="p-1.5 rounded text-ink-soft hover:text-ink hover:bg-card transition cursor-pointer"
                  title={revealedOtp ? "Hide OTP" : "Reveal OTP"}
                >
                  {revealedOtp ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyOtp}
                  className="p-1.5 rounded text-ink-soft hover:text-saffron-deep hover:bg-card transition cursor-pointer"
                  title="Copy OTP"
                >
                  {copiedOtp ? <Check size={16} className="text-forest" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-ink-faint leading-relaxed">
              ⚠️ Share this 4-digit PIN with the driver <strong>only after</strong> the cattle
              ambulance arrives at your address and you have inspected the sacred animal.
            </p>
          </div>
        )}
      </div>

      {/* TRIP STATUS CHECKLIST */}
      <div className="rounded-xl border border-line bg-card p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-2.5">
          Trip Checklist & Lifecycle
        </div>
        <div className="text-[16px] font-serif text-ink mb-3 font-semibold">
          {tripStages[stage]}
        </div>
        <ol className="space-y-0">
          {tripStages.map((s, i) => {
            const state = i < stage ? "done" : i === stage ? "current" : "todo"
            return (
              <li key={s} className="flex gap-3 items-start">
                <div className="flex flex-col items-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full border-2 ${
                      state === "done"
                        ? "bg-forest border-forest"
                        : state === "current"
                          ? "bg-saffron border-saffron animate-ping-once"
                          : "bg-card border-line-strong"
                    }`}
                  />
                  {i < tripStages.length - 1 && (
                    <span
                      className={`w-0.5 h-4.5 ${
                        i < stage ? "bg-forest" : "bg-line"
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-1.5 -mt-0.5">
                  <div
                    className={`text-[12px] flex items-center justify-between ${
                      state === "todo" ? "text-ink-faint" : "text-ink"
                    } ${state === "current" ? "font-semibold text-saffron-deep" : ""}`}
                  >
                    <span>{s}</span>
                    {i === 5 && (
                      <span className="text-[9.5px] font-mono text-saffron bg-saffron-soft/60 px-1 rounded">
                        OTP Handshake
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* VENUE & WINDOW SUMMARY */}
      <div className="rounded-xl border border-line bg-card p-4 space-y-2 text-[12.5px]">
        <div className="flex gap-2.5">
          <Flag size={14} className="text-saffron mt-0.5 shrink-0" />
          <span className="text-ink-soft">
            <strong className="text-ink font-medium">{booking.gosala}</strong> →{" "}
            {booking.address || "Your Altar"}
          </span>
        </div>
        <div className="flex gap-2.5">
          <Clock size={14} className="text-ink-faint mt-0.5 shrink-0" />
          <span className="text-ink-soft font-mono">
            {booking.date} · {booking.time}
          </span>
        </div>
        {booking.distanceKm !== undefined && (
          <div className="flex gap-2.5">
            <MapPin size={14} className="text-forest mt-0.5 shrink-0" />
            <span className="text-ink-soft font-mono">
              Transit Distance: {booking.distanceKm} km (Sanitized Ambulance)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
