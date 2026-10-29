import { useState } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  AlertTriangle,
  Sparkles,
} from "lucide-react"
import { type RoleId } from "../data/roles"
import { useStore } from "../store/store"
import { api } from "../services/api"

export default function AdminLogin({
  onSignIn,
}: {
  onSignIn: (role: RoleId) => void
}) {
  const { setAuthSession, notify } = useStore()

  const [identifierInput, setIdentifierInput] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [rateLimitLocked, setRateLimitLocked] = useState(false)

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setIsSubmitting(true)

    const cleanIdentifier = identifierInput.trim()
    if (!cleanIdentifier) {
      setAuthError("Please enter your Administrative Email, Phone, or Unique ID.")
      setIsSubmitting(false)
      return
    }

    if (!passwordInput) {
      setAuthError("Please enter your master password.")
      setIsSubmitting(false)
      return
    }

    try {
      const res = await api.adminLogin(cleanIdentifier, passwordInput)

      if (res.ok && res.token && res.user) {
        setAuthSession(res.token, res.user)
        const userRole = (res.user.role as RoleId) || "super_admin"

        notify(
          `Welcome, ${res.user.name}. Clearance granted for ${userRole === "super_admin" ? "Super Admin Platform Governance" : "Operations Administration"}.`,
          "ok",
        )

        onSignIn(userRole)
      } else {
        setAuthError(res.error || "Administrative authentication failed.")
      }
    } catch (err: any) {
      const msg = err.message || "Failed to connect to administrative gateway."
      if (msg.includes("Too many") || msg.includes("Locked out")) {
        setRateLimitLocked(true)
      }
      setAuthError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const navigateToDevoteePortal = () => {
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Security Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-mono uppercase tracking-wider text-slate-300">
            GOMAA Tier-0 Gateway · Zero-Trust Administrative Security Shield
          </span>
        </div>
        <button
          type="button"
          onClick={navigateToDevoteePortal}
          className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft size={13} />
          Return to Devotee Portal
        </button>
      </div>

      {/* Main Console Box */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-lg p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Ambient Security Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>

          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
              <ShieldCheck size={28} className="stroke-[2.2]" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center justify-center gap-2">
              Administrative Control Console
            </h1>
            <p className="text-xs text-slate-400 mt-1.5">
              Restricted to Super Admin & Regional Operations Admin Personnel
            </p>
          </div>

          {/* Rate Limit Warning Banner */}
          {rateLimitLocked && (
            <div className="mb-5 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded text-xs text-rose-200 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Security Throttle Engaged:</span> Multiple failed administrative attempts detected. Rate-limiting is actively protecting this terminal.
              </div>
            </div>
          )}

          {/* Error Message */}
          {authError && !rateLimitLocked && (
            <div className="mb-5 p-3 bg-rose-950/50 border border-rose-900/80 rounded text-xs text-rose-200 flex items-center gap-2">
              <ShieldAlert size={14} className="text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                Admin Email / Unique ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="admin@gomaa.in or GMA-SA-XXXX"
                  disabled={isSubmitting || rateLimitLocked}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors pl-10"
                />
                <Mail size={16} className="absolute left-3.5 top-3 text-slate-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-mono uppercase text-slate-400">
                  Master Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSubmitting || rateLimitLocked}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors pl-10 pr-10"
                />
                <Lock size={16} className="absolute left-3.5 top-3 text-slate-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || rateLimitLocked}
              className="w-full mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold py-2.5 px-4 rounded text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/10"
            >
              {isSubmitting ? (
                <span>Verifying Cryptographic Credentials...</span>
              ) : (
                <>
                  <span>Authenticate & Enter Console</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Security Policy Notice */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-[11px] text-slate-500 leading-relaxed text-center space-y-1">
            <p className="flex items-center justify-center gap-1.5 text-slate-400">
              <KeyRound size={12} className="text-amber-500" />
              <span>Strict Role-Based Access Control (RBAC) Enforced</span>
            </p>
            <p>
              Non-administrative users (Devotees, Drivers, Managers) cannot authenticate through this gateway.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Audit Information */}
      <div className="bg-slate-900/60 border-t border-slate-800/80 px-4 py-3 text-center text-xs text-slate-500">
        GOMAA Vedic Cow Sanctuary Platform · Security Subsystem 2026 · All access logged & monitored
      </div>
    </div>
  )
}
