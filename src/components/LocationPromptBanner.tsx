import { useState } from "react"
import {
  MapPin,
  Navigation,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react"

interface LocationPromptBannerProps {
  role: "DRIVER" | "CUSTOMER"
  hasPermission: boolean
  permissionStatus: "prompt" | "granted" | "denied" | "unsupported"
  isLoading: boolean
  error: string | null
  accuracy?: number | null
  address?: string | null
  onRequestLocation: () => Promise<any>
  onOpenLocationPicker?: () => void
  className?: string
}

export default function LocationPromptBanner({
  role,
  hasPermission,
  permissionStatus,
  isLoading,
  error,
  accuracy,
  address,
  onRequestLocation,
  onOpenLocationPicker,
  className = "",
}: LocationPromptBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  // If already granted, show subtle green status pill
  if (hasPermission) {
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-sm bg-ok-soft/70 border border-ok/30 text-[11.5px] text-ink font-medium ${className}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 size={13} className="text-ok shrink-0" />
          <span className="truncate">
            <span className="font-semibold text-ok">
              Live Device GPS Connected
            </span>
            {accuracy && (
              <span className="font-mono text-ink-faint text-[10px] ml-1.5">
                (±{Math.round(accuracy)}m)
              </span>
            )}
            {address && (
              <span className="text-ink-soft text-[10.5px] ml-1.5 hidden md:inline truncate">
                · {address}
              </span>
            )}
          </span>
        </div>
        <button
          onClick={onRequestLocation}
          disabled={isLoading}
          title="Refresh Device Location"
          className="shrink-0 text-ink-faint hover:text-ink cursor-pointer p-0.5"
        >
          <RefreshCw
            size={11}
            className={isLoading ? "animate-spin text-saffron" : ""}
          />
        </button>
      </div>
    )
  }

  // Not granted: show proactive, prominent user-gesture prompt
  const isDriver = role === "DRIVER"

  return (
    <div
      className={`p-3 rounded-sm border ${
        permissionStatus === "denied"
          ? "bg-danger-soft/60 border-danger/30"
          : "bg-saffron-soft/60 border-saffron/40"
      } shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {permissionStatus === "denied" ? (
            <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-saffron text-white grid place-items-center shrink-0">
              <Navigation size={14} className="animate-pulse" />
            </div>
          )}
          <div>
            <div className="text-[13px] font-semibold text-ink leading-tight">
              {permissionStatus === "denied"
                ? "Location Access Blocked in Browser"
                : isDriver
                  ? "Driver Live GPS Tracking Required"
                  : "Connect Your Device GPS to the Live Map"}
            </div>
            <div className="text-[11.5px] text-ink-soft mt-1 leading-relaxed">
              {permissionStatus === "denied"
                ? "Your browser denied location access. Click the lock/settings icon 🔒 next to the address bar (URL) and set Location to 'Allow', then click Retry."
                : isDriver
                  ? "To broadcast your accurate turn-by-turn road arrival to the customer, please enable your device's live location."
                  : "Allow your location to pinpoint your exact home delivery address on the real street map."}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row gap-1.5 items-end sm:items-center">
          {onOpenLocationPicker && !isDriver && (
            <button
              onClick={onOpenLocationPicker}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-[11.5px] font-medium text-ink bg-paper hover:bg-paper-deep border border-line cursor-pointer transition-colors shadow-2xs"
            >
              <MapPin size={11} className="text-saffron-deep" />
              Choose City Manually
            </button>
          )}
          <button
            onClick={onRequestLocation}
            disabled={isLoading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-semibold text-white cursor-pointer shadow-sm transition-colors ${
              permissionStatus === "denied"
                ? "bg-danger hover:bg-danger/90"
                : "bg-saffron-deep hover:bg-saffron"
            }`}
          >
            <MapPin size={12} className={isLoading ? "animate-spin" : ""} />
            {isLoading
              ? "Detecting GPS..."
              : permissionStatus === "denied"
                ? "Retry GPS"
                : isDriver
                  ? "Allow Driver GPS"
                  : "Allow My Location"}
          </button>
        </div>
      </div>

      {error && permissionStatus !== "denied" && (
        <div className="mt-2 text-[11px] text-danger bg-white/70 px-2 py-1 rounded">
          {error}
        </div>
      )}
    </div>
  )
}
