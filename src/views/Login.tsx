import { useState } from "react"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Building2,
  HeartHandshake,
  Truck,
  Crown,
  AlertCircle,
  KeyRound,
  Shield,
  Check,
} from "lucide-react"
import { type RoleId } from "../data/roles"
import { initialProfiles } from "../data/profiles"
import { useStore } from "../store/store"
import { api } from "../services/api"

const flow = [
  "Slot held",
  "Payment verified",
  "Manager review",
  "Admin confirmed",
  "Driver assigned",
  "Settled",
]

export default function Login({
  onSignIn,
}: {
  onSignIn: (role: RoleId) => void
}) {
  const {
    profiles,
    managers,
    gosalas,
    users,
    updateProfile,
    setActiveManagerGosala,
    setActiveGosalaFilter,
    setAuthSession,
    notify,
  } = useStore()

  const [emailInput, setEmailInput] = useState<string>("koushik@gmail.com")
  const [passwordInput, setPasswordInput] = useState<string>("Koushik.git")
  const [showPw, setShowPw] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Robust helper to resolve all assigned Gaushalas for a manager from roster & network
  const resolveManagerGosalas = (m: any): string[] => {
    if (!m) return []
    const directList =
      m.gosalas && m.gosalas.length > 0
        ? m.gosalas
        : m.gosala && m.gosala !== "Unassigned"
          ? [m.gosala]
          : []

    const mappedFromGosalas = gosalas
      .filter((g) => {
        if (
          g.managerId &&
          (g.managerId === m.id ||
            m.id.includes(g.managerId) ||
            g.managerId.includes(m.id) ||
            ((m as any).rawUserId && g.managerId === (m as any).rawUserId))
        )
          return true
        if (g.managerName && g.managerName.toLowerCase() === m.name.toLowerCase())
          return true
        if ((g as any).manager && (g as any).manager.toLowerCase() === m.name.toLowerCase())
          return true
        if ((g as any).caretaker && (g as any).caretaker.toLowerCase() === m.name.toLowerCase())
          return true
        if (Array.isArray(g.assignedManagers)) {
          return g.assignedManagers.some(
            (am) =>
              am.id === m.id ||
              am.name?.toLowerCase() === m.name.toLowerCase() ||
              am.email?.toLowerCase() === m.email?.toLowerCase(),
          )
        }
        return false
      })
      .map((g) => g.name)

    return Array.from(new Set([...directList, ...mappedFromGosalas])).filter(
      Boolean,
    )
  }

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setAuthError(null)

    const cleanEmailOrPhone = emailInput.trim()
    if (!cleanEmailOrPhone) {
      setAuthError("Please enter your registered email address or phone number.")
      setIsSubmitting(false)
      return
    }

    try {
      // Authenticate directly against PostgreSQL / JWT service without forcing any role hint
      const authRes = await api.login(cleanEmailOrPhone, undefined, passwordInput)

      if (authRes.ok && authRes.token && authRes.user) {
        setAuthSession(authRes.token, authRes.user)

        // Automatically route user to their true system role returned by the server
        const targetRole = (authRes.user.role as RoleId) || "customer"

        // If authenticated as a Gaushala Manager, sync their scoped sanctuary data
        if (targetRole === "manager") {
          const directManager = managers.find(
            (m) =>
              m.id === authRes.user.id ||
              (m.email && m.email.toLowerCase() === authRes.user.email?.toLowerCase()) ||
              (m.name && m.name.toLowerCase() === authRes.user.name?.toLowerCase())
          ) || {
            id: authRes.user.id,
            name: authRes.user.name,
            email: authRes.user.email,
            phone: authRes.user.phone,
            gosala: authRes.user.assignedGosalaNames?.[0] || gosalas[0]?.name || "Surya",
            gosalas: authRes.user.assignedGosalaNames || [gosalas[0]?.name || "Surya"],
            status: "Active",
          }

          const gList = resolveManagerGosalas(directManager)
          const targetGosala =
            authRes.user.assignedGosalaNames?.[0] ||
            gList[0] ||
            directManager.gosala ||
            gosalas[0]?.name ||
            ""

          const baseManagerData =
            profiles.manager?.managerData || initialProfiles.manager.managerData!

          await updateProfile("manager", {
            name: authRes.user.name || directManager.name,
            email: authRes.user.email || directManager.email || cleanEmailOrPhone,
            phone: authRes.user.phone || directManager.phone,
            managerData: {
              ...baseManagerData,
              managerId: directManager.id || authRes.user.id,
              gosala: targetGosala,
              assignedGosalas: gList.length > 0 ? gList : [targetGosala],
            },
          })

          if (targetGosala) {
            setActiveManagerGosala(targetGosala)
            setActiveGosalaFilter(targetGosala)
          }
        }

        // If authenticated as Customer (Devotee)
        if (targetRole === "customer" && authRes.user.customerData) {
          await updateProfile("customer", {
            name: authRes.user.name,
            email: authRes.user.email,
            phone: authRes.user.phone,
            customerData: authRes.user.customerData,
          })
        }

        // If authenticated as Operations Admin
        if (targetRole === "admin") {
          await updateProfile("admin", {
            name: authRes.user.name,
            email: authRes.user.email,
            phone: authRes.user.phone,
          })
        }

        const roleDisplay = targetRole === "super_admin" 
          ? "SUPER ADMIN (CAPTAIN)" 
          : targetRole.toUpperCase()

        notify(`Signed in as ${authRes.user.name || cleanEmailOrPhone} [${roleDisplay}]`, "ok")

        // Route dynamically to their true dashboard
        onSignIn(targetRole)
      } else {
        setAuthError("Failed to authenticate session. Please check your credentials.")
      }
    } catch (err: any) {
      setAuthError(err.message || "Invalid email or password. Please verify your credentials.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick helper accounts for developer/testing convenience
  const quickAccounts = [
    {
      label: "Super Admin",
      name: "Koushik",
      icon: Crown,
      email: "koushik@gmail.com",
      password: "Koushik.git",
      roleBadge: "Captain",
      badgeColor: "bg-amber-600 text-white",
    },
    {
      label: "Gaushala Manager",
      name: managers.find((m) => m.email?.toLowerCase().includes("rammohan"))?.name || managers[0]?.name || "Rammohan",
      icon: Building2,
      email: managers.find((m) => m.email?.toLowerCase().includes("rammohan"))?.email || managers[0]?.email || "rammohan@gmail.com",
      password: managers.find((m) => m.email?.toLowerCase().includes("rammohan"))?.password || "Koushik.git",
      roleBadge: "Manager",
      badgeColor: "bg-forest text-white",
    },
    {
      label: "Devotee",
      name: users.find((u) => u.role === "customer")?.name || "Ananya",
      icon: HeartHandshake,
      email: users.find((u) => u.role === "customer")?.email || "ananya@gomaa.in",
      password: (users.find((u) => u.role === "customer") as any)?.password || "gomaa-secure",
      roleBadge: "Customer",
      badgeColor: "bg-saffron text-white",
    },
    {
      label: "Transit Pilot",
      name: users.find((u) => u.role === "driver")?.name || "Ramesh",
      icon: Truck,
      email: users.find((u) => u.role === "driver")?.email || "driver@gomaa.in",
      password: (users.find((u) => u.role === "driver") as any)?.password || "gomaa-secure",
      roleBadge: "Pilot",
      badgeColor: "bg-blue-600 text-white",
    },
  ]

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden lg:block overflow-hidden bg-forest">
        <img
          src="https://images.unsplash.com/photo-1673229266917-89abfa3ebc58?w=1200&h=1600&fit=crop&auto=format"
          alt="A sacred cow with flowers at a Gosala"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#201c16]/95 via-[#201c16]/50 to-[#201c16]/65" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-paper">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-sm bg-saffron grid place-items-center font-serif text-[20px] text-white shadow-xs">
              G
            </div>
            <div>
              <div className="font-serif text-[22px] leading-none">GOMAA</div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-paper/70 mt-1">
                Sacred Operations &amp; Welfare Platform
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur text-[11.5px] font-mono text-saffron mb-4 border border-white/15">
              <ShieldCheck size={13} />
              <span>Multi-Tenant Role-Governed Access</span>
            </div>
            <h2 className="font-serif text-[34px] leading-[1.15] text-white">
              Sacred cattle welfare, altar seva, and trust logistics.
            </h2>
            <p className="text-[14px] text-paper/80 mt-4 leading-relaxed">
              Every devotee, transit pilot, gaushala custodian, and operations officer
              accesses their dedicated workspace authenticated by secure credentials.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-2 gap-y-2">
              {flow.map((f, i) => (
                <span key={f} className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-paper/85 bg-white/10 backdrop-blur rounded-full px-2.5 py-1">
                    {f}
                  </span>
                  {i < flow.length - 1 && (
                    <span className="text-saffron text-[11px]">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="font-mono text-[11px] text-paper/60">
            Protected with RFC 7519 JWT Cryptographic Tokens · PostgreSQL Backend
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-10 overflow-y-auto bg-paper">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-sm bg-saffron grid place-items-center font-serif text-[18px] text-white">
              G
            </div>
            <span className="font-serif text-[20px] text-ink font-semibold">GOMAA</span>
          </div>

          {/* Form Header */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-forest-soft text-forest text-[11px] font-mono font-medium border border-forest/20">
              <KeyRound size={12} />
              <span>Secure Authentication Portal</span>
            </div>
            <h1 className="font-serif text-[28px] text-ink mt-2.5 leading-tight font-semibold">
              Sign In to GOMAA
            </h1>
            <p className="text-[13px] text-ink-faint mt-1.5 leading-relaxed">
              Enter your registered email or phone and password to enter your verified workspace.
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mt-5 p-3.5 bg-red-50 border border-red-200 rounded-sm text-[12.5px] text-red-800 flex items-start gap-2.5 animate-[fadein_.2s_ease]">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="leading-snug flex-1">{authError}</div>
            </div>
          )}

          {/* Clean Unified Sign-In Form */}
          <form className="mt-6 space-y-4" onSubmit={handleSignInSubmit}>
            <div>
              <label className="block text-[12.5px] text-ink-soft font-medium mb-1">
                Registered Email or Phone Number
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="text"
                  required
                  autoFocus
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. rammohan@gmail.com or +91 98..."
                  className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[12.5px] text-ink-soft font-medium">
                  Account Password
                </label>
                <span className="text-[11px] text-ink-faint">
                  Case sensitive
                </span>
              </div>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full bg-paper border border-line rounded-sm pl-9 pr-10 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer p-1"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-saffron text-white rounded-sm py-2.5 text-[13.5px] font-semibold hover:bg-saffron-deep transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Authenticating Session...</span>
                </div>
              ) : (
                <>
                  <span>Sign In to GOMAA Portal</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Devotee Registration Notice */}
          <div className="mt-5 p-3 rounded bg-amber-500/10 border border-amber-500/20 text-[12px] text-ink-soft leading-relaxed flex items-start gap-2.5">
            <HeartHandshake size={15} className="text-saffron-deep shrink-0 mt-0.5" />
            <div>
              <strong className="text-ink font-semibold">Devotee &amp; User Provisioning:</strong>
              {" "}Devotees and Transit Pilots are registered and authorized by their local Gaushala Manager or Operations Officer. Devotees sign in using the credentials shared with them.
            </div>
          </div>

          {/* Quick-Fill Test Credentials */}
          <div className="mt-8 pt-6 border-t border-line">
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint font-semibold">
                Quick Fill Test Credentials
              </span>
              <span className="text-[10px] text-ink-faint">
                (Click to populate fields)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {quickAccounts.map((acc) => {
                const isSelected =
                  emailInput.trim().toLowerCase() === acc.email.toLowerCase()
                return (
                  <button
                    key={acc.label}
                    type="button"
                    onClick={() => {
                      setEmailInput(acc.email)
                      setPasswordInput(acc.password)
                      setAuthError(null)
                    }}
                    className={`p-2.5 rounded-sm border text-left transition cursor-pointer flex items-center justify-between gap-1.5 ${
                      isSelected
                        ? "border-saffron bg-saffron-soft/40 ring-1 ring-saffron/30"
                        : "border-line bg-card hover:border-line-strong hover:bg-paper-deep/60"
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <acc.icon
                        size={14}
                        className={isSelected ? "text-saffron-deep" : "text-ink-soft"}
                      />
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-semibold text-ink truncate leading-tight">
                          {acc.label}
                        </div>
                        <div className="text-[10px] text-ink-faint truncate leading-tight mt-0.5">
                          {acc.name}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${acc.badgeColor}`}
                    >
                      {acc.roleBadge}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Security footnote */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Shield size={12} className="text-forest" />
              <span>GOMAA Multi-Tenant Governance · Cryptographically Secured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
