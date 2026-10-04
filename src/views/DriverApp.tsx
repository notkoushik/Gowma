import React, {
  useState,
  useEffect,
  useRef,
  Component,
  ErrorInfo,
  ReactNode,
} from "react"
import {
  ArrowRight,
  ChevronLeft,
  CircleDot,
  Flag,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  Play,
  Crosshair,
  AlertCircle,
  Truck,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Check,
} from "lucide-react"
import { tripStages, type Trip } from "../data/driver"
import { inr, type Booking } from "../data/mock"
import { useStore } from "../store/store"
import LiveTripMap from "../components/LiveTripMap"
import { useDeviceLocation } from "../hooks/useDeviceLocation"
import LocationPromptBanner from "../components/LocationPromptBanner"
import { useRealtime } from "../hooks/useRealtime"
import { api } from "../services/api"

function toTrip(b: Booking): Trip {
  const idStr = String(b.id || "0000")
  return {
    id: "TRIP-" + idStr.slice(-4),
    bookingId: idStr,
    customer: b.customer || "Devotee",
    phone: b.phone || "—",
    animal: b.animal || "Sacred Bovine",
    animalType: b.animalType || "Cow",
    gosala: b.gosala || "Sanctuary Trust",
    pickup: b.gosala || "Gaushala Sanctuary",
    drop: b.address || "Devotee Altar",
    date: b.date || "Scheduled Date",
    window: `${b.start || "—"} – ${b.end || "—"}`,
    distanceKm: typeof b.distanceKm === "number" ? b.distanceKm : 0,
    stageIndex: typeof b.driverStage === "number" ? b.driverStage : 0,
    handoverOtp: b.handoverOtp,
    handoverOtpVerified: b.handoverOtpVerified,
    handoverOtpVerifiedAt: b.handoverOtpVerifiedAt,
  }
}

function StageBadge({ i }: { i: number }) {
  const stageNum =
    typeof i === "number" && i >= 0 && i < tripStages.length ? i : 0
  const done = stageNum >= tripStages.length - 1
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        done ? "bg-ok-soft text-ok" : "bg-saffron-soft text-saffron-deep"
      }`}
    >
      <CircleDot size={11} />
      {tripStages[stageNum]}
    </span>
  )
}

function HandoverOtpModal({
  isOpen,
  onClose,
  trip,
  onVerify,
}: {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  onVerify?: (otp: string) => Promise<boolean>
}) {
  const [pin, setPin] = useState(["", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const input0 = useRef<HTMLInputElement>(null)
  const input1 = useRef<HTMLInputElement>(null)
  const input2 = useRef<HTMLInputElement>(null)
  const input3 = useRef<HTMLInputElement>(null)
  const inputs = [input0, input1, input2, input3]

  useEffect(() => {
    if (isOpen) {
      setPin(["", "", "", ""])
      setErrorMsg("")
      setTimeout(() => input0.current?.focus(), 150)
    }
  }, [isOpen])

  const handleDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1)
    const updated = [...pin]
    updated[index] = digit
    setPin(updated)
    setErrorMsg("")

    if (digit && index < 3) {
      inputs[index + 1].current?.focus()
    }
  }

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputs[index - 1].current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4)
    if (!pasted) return
    const updated = ["", "", "", ""]
    pasted.split("").forEach((ch, idx) => {
      if (idx < 4) updated[idx] = ch
    })
    setPin(updated)
    const nextIdx = Math.min(pasted.length, 3)
    inputs[nextIdx].current?.focus()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const otpCode = pin.join("")
    if (otpCode.length < 4) {
      setErrorMsg("Please enter the complete 4-digit PIN provided by the devotee.")
      return
    }
    setLoading(true)
    setErrorMsg("")
    try {
      if (onVerify) {
        const ok = await onVerify(otpCode)
        if (ok) {
          onClose()
        } else {
          setErrorMsg(
            "Invalid OTP. Please ask the devotee for the 4-digit code on their GOMAA screen.",
          )
        }
      } else {
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to verify OTP. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm bg-card border border-line rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-saffron-soft/60 to-paper border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2 text-saffron-deep">
            <KeyRound size={18} />
            <h3 className="font-serif text-[17px] font-semibold text-ink">
              Devotee Handover OTP
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink p-1 cursor-pointer font-bold"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-[13.5px] text-ink font-semibold">
              Doorstep Handover Verification
            </p>
            <p className="text-[12px] text-ink-faint">
              Ask devotee <strong className="text-ink">{trip.customer}</strong> for
              the 4-digit code displayed on their GOMAA live tracking screen.
            </p>
          </div>

          {/* 4 PIN inputs */}
          <div className="flex justify-center gap-2.5 my-2" onPaste={handlePaste}>
            {pin.map((digit, idx) => (
              <input
                key={idx}
                ref={inputs[idx]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="h-13 w-12 text-center text-[22px] font-mono font-bold rounded-md border-2 border-line focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-paper outline-none transition shadow-2xs"
              />
            ))}
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded bg-danger-soft/60 border border-danger/30 text-danger text-[12px] text-center font-medium">
              {errorMsg}
            </div>
          )}

          <div className="rounded bg-paper p-3 border border-line text-[11.5px] text-ink-soft space-y-1">
            <div className="font-semibold text-forest flex items-center gap-1">
              <ShieldCheck size={13} /> Sacred Welfare Protocol:
            </div>
            <div>✓ Sacred bovine escorted safely to courtyard/altar</div>
            <div>✓ Devotee confirmed holy animal is calm and comfortable</div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded text-[13px] font-medium border border-line hover:bg-paper transition cursor-pointer text-ink-soft"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || pin.join("").length < 4}
              onClick={handleSubmit}
              className="flex-1 py-2.5 px-3 rounded text-[13px] font-medium bg-saffron text-white hover:bg-saffron-deep transition cursor-pointer disabled:opacity-40 shadow-xs flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Verify & Begin
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TripDetail({
  trip,
  driverName = "Assigned Seva Driver",
  onBack,
  onAdvance,
  onVerifyOtp,
  onResetStage,
}: {
  trip: Trip
  driverName?: string
  onBack: () => void
  onAdvance: () => void
  onVerifyOtp?: (otp: string) => Promise<boolean>
  onResetStage: (stage: number) => void
}) {
  const [showOtpModal, setShowOtpModal] = useState(false)
  const done = trip.stageIndex >= tripStages.length - 1
  const isEnRoute = trip.stageIndex >= 4 && !done
  const deviceLocation = useDeviceLocation()

  const handleTogglePhoneGps = async () => {
    if (deviceLocation.isWatching) {
      deviceLocation.stopWatching()
    } else {
      const initial = await deviceLocation.requestLocation()
      if (initial) {
        api
          .sendTelemetry(trip.bookingId, {
            lat: initial.lat,
            lng: initial.lng,
            speedKmh: 30,
            bearing: 45,
            stage: trip.stageIndex,
            stageLabel: tripStages[trip.stageIndex],
          })
          .catch(console.error)

        deviceLocation.startWatching((pos) => {
          api
            .sendTelemetry(trip.bookingId, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speedKmh: pos.coords.speed
                ? Math.round(pos.coords.speed * 3.6)
                : 32,
              bearing: pos.coords.heading || 45,
              stage: trip.stageIndex,
              stageLabel: tripStages[trip.stageIndex],
            })
            .catch(console.error)
        })
      }
    }
  }

  // Automatic 1-Minute Driver Location Beacon when en route
  useEffect(() => {
    if (!isEnRoute) return

    const sendBeacon = async () => {
      if (deviceLocation.lat && deviceLocation.lng) {
        api
          .sendTelemetry(trip.bookingId, {
            lat: deviceLocation.lat,
            lng: deviceLocation.lng,
            speedKmh: deviceLocation.speed || 34,
            bearing: deviceLocation.heading || 45,
            stage: trip.stageIndex,
            stageLabel: tripStages[trip.stageIndex],
          })
          .catch(console.error)
      } else {
        const initial = await deviceLocation.requestLocation().catch(() => null)
        if (initial) {
          api
            .sendTelemetry(trip.bookingId, {
              lat: initial.lat,
              lng: initial.lng,
              speedKmh: 34,
              bearing: 45,
              stage: trip.stageIndex,
              stageLabel: tripStages[trip.stageIndex],
            })
            .catch(console.error)
        }
      }
    }

    sendBeacon()
    const interval = setInterval(sendBeacon, 60000)
    return () => clearInterval(interval)
  }, [
    isEnRoute,
    trip.bookingId,
    trip.stageIndex,
    deviceLocation.lat,
    deviceLocation.lng,
  ])

  return (
    <div>
      <div className="flex items-center gap-2 px-4 h-12 border-b border-line bg-card">
        <button
          onClick={onBack}
          className="text-ink-soft hover:text-ink -ml-1 p-1 cursor-pointer"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-mono text-[13px] text-ink">{trip.id}</span>
        <span className="ml-auto">
          <StageBadge i={trip.stageIndex} />
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Proactive Location Banner */}
        <LocationPromptBanner
          role="DRIVER"
          hasPermission={deviceLocation.hasPermission}
          permissionStatus={deviceLocation.permissionStatus}
          isLoading={deviceLocation.isLoading}
          error={deviceLocation.error}
          accuracy={deviceLocation.accuracy}
          address={deviceLocation.address}
          onRequestLocation={handleTogglePhoneGps}
        />

        {/* Live Trip Map */}
        <LiveTripMap
          bookingId={trip.bookingId}
          pickupLocation={trip.pickup}
          dropLocation={trip.drop}
          driverName={driverName}
          stageIndex={trip.stageIndex}
          distanceKm={trip.distanceKm}
          driverCoords={
            deviceLocation.lat && deviceLocation.lng
              ? [deviceLocation.lat, deviceLocation.lng]
              : null
          }
          viewerRole="DRIVER"
          heightClass="h-64"
        />

        {/* Real Location & Simulation Controls */}
        <div className="rounded-sm border border-line bg-card p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Driver GPS Source
            </span>
            <span className="text-[11px] font-mono text-saffron-deep font-medium">
              {deviceLocation.isWatching
                ? "● Phone GPS Active"
                : isEnRoute
                  ? "● Simulated Road GPS"
                  : "Standby"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTogglePhoneGps}
              className={`inline-flex items-center justify-center gap-1.5 rounded-sm py-2 px-2 text-[12px] font-medium border transition-colors cursor-pointer ${
                deviceLocation.isWatching
                  ? "bg-ok text-white border-ok"
                  : "bg-paper text-ink border-line hover:border-line-strong"
              }`}
            >
              <Radio
                size={13}
                className={deviceLocation.isWatching ? "animate-pulse" : ""}
              />
              {deviceLocation.isWatching
                ? "Stop Phone GPS"
                : "Broadcast Phone GPS"}
            </button>

            <button
              onClick={() => onResetStage(4)}
              className="inline-flex items-center justify-center gap-1.5 rounded-sm py-2 px-2 text-[12px] font-medium bg-saffron-soft text-saffron-deep border border-saffron/30 hover:bg-saffron hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              Simulate Live Drive
            </button>
          </div>

          {deviceLocation.error && (
            <div className="text-[11px] text-danger bg-danger-soft/60 rounded p-2 leading-relaxed">
              {deviceLocation.error}
            </div>
          )}

          {deviceLocation.lat && (
            <div className="text-[10.5px] font-mono text-ink-soft bg-paper rounded px-2.5 py-1 flex items-center justify-between">
              <span>
                Location: {deviceLocation.lat.toFixed(4)}°N,{" "}
                {deviceLocation.lng?.toFixed(4)}°E
              </span>
              <span>±{Math.round(deviceLocation.accuracy || 0)}m</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-[19px] text-ink leading-tight">
              {trip.customer}
            </div>
            <div className="text-[12px] text-ink-faint">
              {trip.animal} · {trip.animalType} · {trip.window}
            </div>
          </div>
          <a
            href={`tel:${(trip.phone || "").replace(/\s/g, "")}`}
            className="h-10 w-10 grid place-items-center rounded-full bg-forest text-white"
            aria-label="Call customer"
          >
            <Phone size={17} />
          </a>
        </div>

        {/* Route Details */}
        <div className="rounded-sm border border-line bg-card">
          <div className="flex gap-3 p-3.5 border-b border-line">
            <MapPin size={16} className="text-forest mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">
                Pickup · Gosala
              </div>
              <div className="text-[13px] text-ink">{trip.pickup}</div>
            </div>
            <button className="text-forest self-center">
              <Navigation size={16} />
            </button>
          </div>
          <div className="flex gap-3 p-3.5">
            <Flag size={16} className="text-saffron mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">
                Destination · Customer
              </div>
              <div className="text-[13px] text-ink">{trip.drop}</div>
            </div>
            <button className="text-saffron self-center">
              <Navigation size={16} />
            </button>
          </div>
        </div>

        {/* Stages list */}
        <div className="rounded-sm border border-line bg-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mb-3">
            Trip checklist
          </div>
          <ol className="space-y-0">
            {tripStages.map((s, i) => {
              const state =
                i < trip.stageIndex
                  ? "done"
                  : i === trip.stageIndex
                    ? "current"
                    : "todo"
              return (
                <li key={s} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <span
                      className={`h-2.5 w-2.5 rounded-full border-2 ${
                        state === "done"
                          ? "bg-forest border-forest"
                          : state === "current"
                            ? "bg-saffron border-saffron"
                            : "bg-card border-line-strong"
                      }`}
                    />
                    {i < tripStages.length - 1 && (
                      <span
                        className={`w-0.5 h-5 ${
                          i < trip.stageIndex ? "bg-forest" : "bg-line"
                        }`}
                      />
                    )}
                  </div>
                  <span
                    className={`text-[12.5px] -mt-0.5 pb-2 ${
                      state === "todo" ? "text-ink-faint" : "text-ink"
                    } ${state === "current" ? "font-medium" : ""}`}
                  >
                    {s}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Advance stage button */}
        {!done ? (
          trip.stageIndex === 5 ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowOtpModal(true)}
                className="w-full bg-saffron text-white rounded-sm py-3.5 text-[14px] font-semibold hover:bg-saffron-deep transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ring-2 ring-saffron/30"
              >
                <KeyRound size={17} />
                Verify Devotee Handover OTP & Begin Seva
              </button>
              <p className="text-[11.5px] text-center text-ink-faint">
                Devotee must inspect bovine comfort and provide 4-digit code before seva commences.
              </p>
            </div>
          ) : (
            <button
              onClick={onAdvance}
              className="w-full bg-saffron text-white rounded-sm py-3 text-[14px] font-medium hover:bg-saffron-deep transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              Advance: {tripStages[trip.stageIndex + 1]}
              <ArrowRight size={16} />
            </button>
          )
        ) : (
          <div className="rounded-sm bg-ok-soft border border-ok/30 p-3 text-center text-ok text-[13px] font-medium">
            Trip completed successfully
          </div>
        )}
      </div>

      <HandoverOtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        trip={trip}
        onVerify={onVerifyOtp}
      />
    </div>
  )
}

function TripRow({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const done = trip.stageIndex >= tripStages.length - 1
  const active = trip.stageIndex >= 1 && !done
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-sm border p-4 transition-colors cursor-pointer ${
        active
          ? "border-saffron bg-saffron-soft/40 shadow-xs"
          : "border-line bg-card hover:border-line-strong"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11.5px] text-ink-faint">
          {trip.window}
        </span>
        <StageBadge i={trip.stageIndex} />
      </div>
      <div className="font-serif text-[16px] text-ink mt-1.5">
        {trip.customer}
      </div>
      <div className="text-[12px] text-ink-faint">
        {trip.animal} · {trip.animalType} · {trip.distanceKm} km
      </div>
      <div className="flex items-center gap-1.5 text-[11.5px] text-ink-soft mt-2">
        <MapPin size={12} className="text-saffron shrink-0" />{" "}
        <span className="truncate">{trip.drop}</span>
      </div>
    </button>
  )
}

// Error Boundary to prevent any blank page
class DriverErrorBoundary extends Component<{
  children: ReactNode
  onSignOut: () => void
}, { hasError: boolean; errorMsg: string }> {
  state = { hasError: false, errorMsg: "" }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMsg: error.message || "An unexpected error occurred",
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DriverApp error boundary caught:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper-deep flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-line rounded p-6 text-center shadow-lg">
            <AlertCircle size={36} className="text-danger mx-auto mb-3" />
            <h2 className="font-serif text-[20px] text-ink">
              Driver App Recovery
            </h2>
            <p className="text-[12px] text-ink-soft mt-2">
              {this.state.errorMsg}
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-saffron text-white rounded text-[13px] font-medium"
              >
                Reload Driver View
              </button>
              <button
                onClick={this.props.onSignOut}
                className="px-4 py-2 bg-paper-deep text-ink border border-line rounded text-[13px]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

import EditProfileModal from "../components/EditProfileModal"

function DriverAppContent({ onSignOut }: { onSignOut: () => void }) {
  const { bookings, advanceTrip, verifyHandoverOtp, assignDriver, notify, profiles } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  const driverProfile = profiles?.driver
  const driverName = driverProfile?.name || "Assigned Seva Driver"
  const firstName = driverName.split(" ")[0] || "Driver"
  const vehicleNo = driverProfile?.driverData?.vehicleNumber || "Cattle Ambulance / Van"
  const licenseNo =
    driverProfile?.driverData?.licenseNumber || "Govt Certified Transport License"

  // Map trips dynamically matching driver name, driverId, or unassigned active trips
  const trips = (bookings || [])
    .filter(
      (b) =>
        (b.driver === driverName ||
          !b.driver ||
          (b as any).driverId === driverProfile?.id ||
          (b as any).driverId === driverProfile?.driverData?.driverId) &&
        b.status !== "Rejected" &&
        b.status !== "Completed" &&
        b.status !== "Cancelled",
    )
    .map(toTrip)

  // Incoming trips awaiting pilot assignment
  const unacceptedTrips = (bookings || []).filter(
    (b) =>
      (!b.driver || b.driverStage === 0) &&
      (b.status === "Confirmed" || b.status === "Admin Review" || b.status === "Payment Verified"),
  )

  const open =
    trips.find((t) => t.id === openId || t.bookingId === openId) ?? null

  useRealtime({ bookingId: open?.bookingId })

  const advance = (bookingId: string) => advanceTrip(bookingId)

  const handleVerifyOtp = async (otpCode: string): Promise<boolean> => {
    if (!open) return false
    try {
      const res = await verifyHandoverOtp(open.bookingId, otpCode)
      if (res.success) {
        notify(`Handover OTP verified! Stage 6: Service Started at Altar.`, "ok")
        return true
      } else {
        notify(res.error || "Invalid OTP code", "err")
        return false
      }
    } catch (e: any) {
      notify(e.message || "Failed to verify OTP", "err")
      return false
    }
  }

  const handleResetStage = async (stage: number) => {
    if (!open) return
    try {
      await api.setTripStage(open.bookingId, stage)
      notify(
        `Trip reset to Stage ${stage}: ${tripStages[stage]} (Live Demo Active)`,
        "ok",
      )
    } catch (e: any) {
      notify(e.message || "Failed to set trip stage", "err")
    }
  }

  const totalKm = trips.reduce((a, t) => a + (t.distanceKm || 0), 0)

  return (
    <div className="min-h-screen bg-paper-deep flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen bg-paper flex flex-col shadow-xl border-x border-line">
        {/* App bar */}
        <header className="h-14 px-4 flex items-center gap-3 border-b border-line bg-card sticky top-0 z-20">
          <div className="h-8 w-8 rounded-sm bg-saffron grid place-items-center font-serif text-[16px] text-white">
            G
          </div>
          <div className="leading-none">
            <div className="font-serif text-[16px]">GOMAA</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint mt-0.5">
              Driver Portal
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setOnline((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                online ? "bg-ok-soft text-ok" : "bg-paper-deep text-ink-faint"
              }`}
            >
              <Radio size={12} /> {online ? "Online" : "Offline"}
            </button>
            <button
              onClick={() => setEditProfileOpen(true)}
              className="h-7 w-7 rounded-full bg-forest-soft text-forest text-[11px] font-bold flex items-center justify-center border border-forest/30 hover:bg-forest hover:text-white transition-colors"
              title="Edit Driver Profile"
            >
              {driverName.slice(0, 1)}
            </button>
            <button
              onClick={onSignOut}
              className="text-ink-faint hover:text-ink p-1 cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col">
          {open ? (
            <TripDetail
              trip={open}
              driverName={driverName}
              onBack={() => setOpenId(null)}
              onAdvance={() => advance(open.bookingId)}
              onVerifyOtp={handleVerifyOtp}
              onResetStage={handleResetStage}
            />
          ) : (
            <div className="p-4 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
                    Driver Assigned Portal
                  </div>
                  <h1 className="font-serif text-[24px] text-ink leading-tight mt-1">
                    Namaste, {firstName}
                  </h1>
                </div>
                <button
                  onClick={() => setEditProfileOpen(true)}
                  className="px-2.5 py-1 text-[11px] font-medium text-forest bg-forest-soft border border-forest/30 rounded hover:bg-forest hover:text-white transition-all shadow-2xs"
                >
                  Edit Profile
                </button>
              </div>

              {/* Driver & Vehicle Badge */}
              <div className="bg-card border border-line rounded p-3 text-[11.5px] space-y-1">
                <div className="flex items-center justify-between text-ink-soft">
                  <span>
                    Vehicle:{" "}
                    <strong className="font-mono text-ink font-semibold">
                      {vehicleNo}
                    </strong>
                  </span>
                  <span>
                    License:{" "}
                    <strong className="font-mono text-ink font-semibold">
                      {licenseNo}
                    </strong>
                  </span>
                </div>
                <div className="text-[11px] text-ink-faint">
                  Phone: {driverProfile?.phone || "Verified Contact"} ·{" "}
                  {driverProfile?.driverData?.assignedGaushala ||
                    "Assigned Sanctuary Trust"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Trips", String(trips.length)],
                  ["Distance", `${totalKm.toFixed(1)} km`],
                  ["Est. payout", inr(trips.length * 180)],
                ].map(([l, v]) => (
                  <div
                    key={l}
                    className="rounded-sm border border-line bg-card p-3 shadow-xs"
                  >
                    <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                      {l}
                    </div>
                    <div className="font-serif text-[19px] text-ink mt-1 tabular">
                      {v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Uber-Style Dispatch Request Card */}
              {unacceptedTrips.length > 0 && (
                <div className="rounded-lg border-2 border-saffron bg-gradient-to-br from-amber-500/10 via-card to-paper p-4 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-saffron text-white">
                      <Sparkles size={11} /> NEW DISPATCH REQUEST
                    </span>
                    <span className="text-[11px] font-mono text-saffron-deep font-semibold">
                      Proximity Dispatch
                    </span>
                  </div>

                  <div>
                    <div className="text-[17px] font-serif font-bold text-ink">
                      {unacceptedTrips[0].animal} ({unacceptedTrips[0].animalType})
                    </div>
                    <div className="text-[12px] text-ink-faint mt-0.5 truncate">
                      From: {unacceptedTrips[0].gosala}
                    </div>
                    <div className="text-[12px] text-ink-soft truncate">
                      To: {unacceptedTrips[0].address}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11.5px] font-mono text-ink-soft">
                      <span>Est. {unacceptedTrips[0].distanceKm || 8} km</span>
                      <span>·</span>
                      <span>
                        Window: {unacceptedTrips[0].start} –{" "}
                        {unacceptedTrips[0].end}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      assignDriver(unacceptedTrips[0].id, driverName)
                      setOpenId(unacceptedTrips[0].id)
                    }}
                    className="w-full py-2.5 px-4 rounded bg-forest hover:bg-forest/90 text-white font-semibold text-[13px] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={16} /> Accept Seva Trip & Start Transit
                  </button>
                </div>
              )}

              <div>
                <h2 className="font-serif text-[16px] text-ink mb-2.5">
                  Today's assigned trips
                </h2>
                <div className="space-y-3">
                  {trips.length === 0 ? (
                    <div className="p-8 text-center text-ink-faint bg-card rounded-sm border border-line">
                      <Truck
                        size={30}
                        className="mx-auto mb-2 text-ink-faint/60"
                      />
                      <p className="text-[13px]">
                        No trips currently assigned.
                      </p>
                    </div>
                  ) : (
                    trips.map((t) => (
                      <TripRow
                        key={t.id}
                        trip={t}
                        onOpen={() => setOpenId(t.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              <p className="text-[11px] text-ink-faint bg-card border border-line rounded-sm p-3 leading-relaxed shadow-xs">
                GPS broadcasts during active trips. Advance each stage as you
                arrive — the customer and manager see your live vehicle progress
                along real street corridors.
              </p>
            </div>
          )}
        </div>

        {editProfileOpen && (
          <EditProfileModal
            role="driver"
            onClose={() => setEditProfileOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

export default function DriverApp({ onSignOut }: { onSignOut: () => void }) {
  return (
    <DriverErrorBoundary onSignOut={onSignOut}>
      <DriverAppContent onSignOut={onSignOut} />
    </DriverErrorBoundary>
  )
}
