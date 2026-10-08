import { useState, useEffect, useMemo } from "react"
import {
  Bell,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Search,
  SlidersHorizontal,
  Wallet,
  Users,
  Landmark,
  Building2,
  Navigation,
  PawPrint,
  Crown,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  Store,
  Percent,
} from "lucide-react"
import Overview from "./views/Overview"
import Bookings from "./views/Bookings"
import Availability from "./views/Availability"
import Pricing from "./views/Pricing"
import Settlements from "./views/Settlements"
import GosalaManagers from "./views/GosalaManagers"
import LiveTracking from "./views/manager/LiveTracking"
import Gaushalas from "./views/manager/Gaushalas"
import Animals from "./views/manager/Animals"
import ManagerLedger from "./views/manager/ManagerLedger"
import Login from "./views/Login"
import ManagerApp from "./views/ManagerApp"
import DriverApp from "./views/DriverApp"
import CustomerApp from "./views/CustomerApp"
import EditProfileModal from "./components/EditProfileModal"
import { useStore, useToast } from "./store/store"
import { useRealtime } from "./hooks/useRealtime"
import type { RoleId } from "./data/roles"
import { api } from "./services/api"

type View =
  | "overview"
  | "gosalas"
  | "managers"
  | "bookings"
  | "tracking"
  | "animals"
  | "ledger"
  | "availability"
  | "pricing"
  | "settlements"

const titles: Record<View, { title: string; desc: string }> = {
  overview: {
    title: "Regional Operations & Treasury",
    desc: "Real-time booking pipeline, revenue metrics and network health across regional sanctuaries",
  },
  gosalas: {
    title: "Gaushalas Network",
    desc: "Regional Gaushala directory, AWBI trust compliance, facility capacities & photo galleries",
  },
  managers: {
    title: "Gaushala Custodians & Acting Matrix",
    desc: "1:1 Gaushala custodian assignments, orphan shelter badges & emergency acting manager triage",
  },
  bookings: {
    title: "Bookings Audit & Acting Triage",
    desc: "Regional booking lifecycle, manager approvals & acting manager override triage",
  },
  tracking: {
    title: "Live Cow Fleet GPS Tracking",
    desc: "Real-time GPS tracking for holy cows travelling with live driver stages",
  },
  animals: {
    title: "Sacred Herd Welfare & Empanelled Vets",
    desc: "Regional bovine healthcare, resting buffers, health hold toggles & empanelled veterinary panel",
  },
  ledger: {
    title: "Regional Treasury & 80/20 Revenue Ledger",
    desc: "Network revenue split: 80% Gaushala net share, 100% transport pass-through & platform escrow",
  },
  availability: {
    title: "Availability & Fleet",
    desc: "Per-animal slot management, rest buffers & operational blocking",
  },
  pricing: {
    title: "Master Pricing & Cost Arranger",
    desc: "Super Admin controls: standard duration, extra-time, transport distance slabs & commission %",
  },
  settlements: {
    title: "Gosala Settlements & Disbursements",
    desc: "Super Admin treasury: payout batches, platform commission & Gosala disbursements",
  },
}

const VALID_ROLES: RoleId[] = [
  "customer",
  "manager",
  "driver",
  "admin",
  "super_admin",
]
const VALID_ADMIN_VIEWS: View[] = [
  "overview",
  "gosalas",
  "managers",
  "bookings",
  "tracking",
  "animals",
  "ledger",
  "availability",
  "pricing",
  "settlements",
]

function parseHash(): { role: RoleId | null | undefined; subview?: string; sector?: string } {
  if (typeof window === "undefined") return { role: undefined }
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase()
  if (!hash) return { role: undefined }
  const parts = hash.split("/")
  const r = parts[0]
  if (r === "login") return { role: null }
  if (VALID_ROLES.includes(r as RoleId)) {
    return { role: r as RoleId, subview: parts[1], sector: parts[2] }
  }
  return { role: undefined }
}

function getInitialPricingSector(): "global" | "gosalas" | "commissions" {
  const { subview, sector } = parseHash()
  if (subview === "pricing") {
    if (sector === "gosalas") return "gosalas"
    if (sector === "commissions") return "commissions"
  }
  try {
    const saved = localStorage.getItem("gomaa_pricing_sector")
    if (saved === "gosalas" || saved === "global" || saved === "commissions") {
      return saved as "global" | "gosalas" | "commissions"
    }
  } catch (e) {}
  return "global"
}

function getInitialAuth(): RoleId | null {
  const token = typeof window !== "undefined" ? localStorage.getItem("gomaa_auth_token") : null
  if (!token) return null

  const fromHash = parseHash().role
  if (fromHash !== undefined && fromHash !== null) return fromHash
  try {
    const saved = localStorage.getItem("gomaa_auth_role")
    if (saved === "login" || saved === "null") return null
    if (saved && VALID_ROLES.includes(saved as RoleId)) {
      return saved as RoleId
    }
  } catch (e) {}
  return null
}

function getInitialAdminView(): View {
  const { subview } = parseHash()
  if (subview && VALID_ADMIN_VIEWS.includes(subview as View)) {
    return subview as View
  }
  try {
    const saved = localStorage.getItem("gomaa_admin_view")
    if (saved && VALID_ADMIN_VIEWS.includes(saved as View)) {
      return saved as View
    }
  } catch (e) {}
  return "overview"
}

function CaptainAccessGate({
  feature,
  onSwitchToCaptain,
}: {
  feature: "Master Pricing & Platform Economics" | "Settlements & Treasury Payouts"
  onSwitchToCaptain: () => void
}) {
  return (
    <div className="max-w-2xl mx-auto my-12 p-8 border border-amber-300 rounded-sm bg-linear-to-b from-amber-50/90 to-card text-center shadow-xs space-y-5">
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center mx-auto shadow-sm">
        <Crown size={28} className="stroke-[2.2]" />
      </div>
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-600 text-white shadow-2xs">
          <ShieldAlert size={12} /> Captain Clearance Required
        </span>
        <h2 className="font-serif text-[23px] font-semibold text-amber-950 mt-3">
          {feature}
        </h2>
        <p className="text-[13px] text-amber-900/80 mt-1.5 max-w-lg mx-auto leading-relaxed">
          This module configures live PostgreSQL database economics, platform commission splits,
          and bank treasury disbursements. It is strictly reserved for the <strong>Super Admin ("The Captain")</strong>.
        </p>
      </div>

      <div className="p-4 bg-white/90 border border-amber-200/80 rounded-sm text-left text-[12.5px] text-ink-soft space-y-2 max-w-md mx-auto font-sans shadow-2xs">
        <div className="flex items-start gap-2">
          <span className="text-forest font-bold shrink-0">✓</span>
          <span><strong>Operations Admin Scope:</strong> Managing regional Gaushalas, assigning custodians, reviewing devotee bookings, monitoring live GPS fleet, and animal resting schedules.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-600 font-bold shrink-0">★</span>
          <span><strong>Super Admin Captain Scope:</strong> Database Master Pricing, 80/20 platform-to-Gosala split formulas, NACH batch payout clearances, and overall network governance.</span>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={onSwitchToCaptain}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-medium px-5 py-2.5 rounded-sm text-[13px] transition shadow-xs cursor-pointer"
        >
          <Crown size={15} />
          Switch to Super Admin Captain Role
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { notify } = useToast()
  const {
    bookings,
    managers,
    settlements,
    gosalas,
    animals,
    activeGosalaFilter,
    setActiveGosalaFilter,
    setCurrentRole,
    profiles,
    pricingConfig,
    setAuthSession,
    clearAuthSession,
  } = useStore()
  const [auth, setAuth] = useState<RoleId | null>(getInitialAuth)
  const [view, setView] = useState<View>(getInitialAdminView)
  const [pricingSector, setPricingSector] = useState<"global" | "gosalas" | "commissions">(getInitialPricingSector)
  const [isPricingMenuOpen, setIsPricingMenuOpen] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  const [editAdminProfileOpen, setEditAdminProfileOpen] = useState(false)

  // Listen for Escape key to exit maximized mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMaximized) {
        setIsMaximized(false)
      }
    }
    const handleFsChange = () => {
      if (!document.fullscreenElement && isMaximized) {
        setIsMaximized(false)
      }
    }
    window.addEventListener("keydown", handleKey)
    document.addEventListener("fullscreenchange", handleFsChange)
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.removeEventListener("fullscreenchange", handleFsChange)
    }
  }, [isMaximized])

  const toggleMaximize = () => {
    const next = !isMaximized
    setIsMaximized(next)
    if (next) {
      notify("Maximized view enabled · Press ESC or click Minimize to restore normal layout", "info")
    }
  }

  const handleSetPricingSector = (sec: "global" | "gosalas" | "commissions") => {
    setPricingSector(sec)
    try {
      localStorage.setItem("gomaa_pricing_sector", sec)
      if (auth === "admin" || auth === "super_admin") {
        if (sec === "gosalas") {
          window.location.hash = `#${auth}/pricing/gosalas`
        } else if (sec === "commissions") {
          window.location.hash = `#${auth}/pricing/commissions`
        } else {
          window.location.hash = `#${auth}/pricing`
        }
      }
    } catch (e) {}
  }

  const adminBookingsCount = bookings.length
  const adminReviewPending = bookings.filter(
    (b) => b.status === "Admin Review",
  ).length
  const activeTransitsCount = bookings.filter(
    (b) =>
      b.status === "In Service" ||
      b.status === "Driver Assigned" ||
      b.status === "En Route" ||
      b.status === "At Altar" ||
      (b.driverStage !== undefined &&
        b.driverStage > 0 &&
        b.driverStage < 9 &&
        b.status !== "Rejected"),
  ).length

  useRealtime()

  // Dynamically compute the active/registered operational region from registered Gaushalas
  const dynamicRegion = useMemo(() => {
    let raw = ""
    if (activeGosalaFilter !== "ALL") {
      const g = gosalas.find((x) => x.id === activeGosalaFilter || x.name === activeGosalaFilter)
      if (g?.region) raw = g.region
      else if (g?.address) raw = g.address
    }
    if (!raw && gosalas.length > 0) {
      const g = gosalas[0]
      raw = g.region || g.address || ""
    }
    if (!raw) return "Regional"
    if (raw.includes(",")) {
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
      const last = parts[parts.length - 1]
      if (last && isNaN(Number(last))) return last
    }
    if (raw.includes(" - ")) {
      const after = raw.split(" - ")[1].trim()
      return after.split("(")[0].trim()
    }
    return raw.split("(")[0].trim()
  }, [gosalas, activeGosalaFilter])

  // Ensure Operations Admin and Super Admin have regional scope across all registered Gaushalas
  useEffect(() => {
    if (auth === "admin" || auth === "super_admin") {
      if (activeGosalaFilter !== "ALL") {
        setActiveGosalaFilter("ALL")
      }
    }
  }, [auth, activeGosalaFilter, setActiveGosalaFilter])

  const handleLoginSuccess = (role: RoleId) => {
    setAuth(role)
    try {
      localStorage.setItem("gomaa_auth_role", role)
      if (role === "admin" || role === "super_admin") {
        if (view === "pricing" && pricingSector === "gosalas") {
          window.location.hash = `#${role}/pricing/gosalas`
        } else {
          window.location.hash = `#${role}/${view}`
        }
      } else if (role === "manager") {
        const savedManagerView =
          localStorage.getItem("gomaa_manager_view") || "queue"
        window.location.hash = `#manager/${savedManagerView}`
      } else {
        window.location.hash = `#${role}`
      }
    } catch (e) {}
  }

  const handleSignOut = () => {
    setAuth(null)
    clearAuthSession()
    try {
      localStorage.setItem("gomaa_auth_role", "login")
      window.location.hash = "#login"
    } catch (e) {}
  }

  const handleSwitchRole = async (role: RoleId) => {
    try {
      let email = ""
      let password = ""
      if (role === "super_admin") {
        email = "koushik@gmail.com"
        password = "Koushik.git"
      } else if (role === "admin") {
        email = "vikramaditya@gomaa.in"
        password = "OpsAdmin@2026!"
      } else if (role === "manager") {
        email = profiles?.manager?.email || "rammohan@gmail.com"
        password = "Koushik.git"
      } else if (role === "driver") {
        email = profiles?.driver?.email || "sunil.pawar@gomaa.in"
        password = "koushik.git"
      } else if (role === "customer") {
        email = profiles?.customer?.email || "radha@gmail.com"
        password = "koushik.git"
      }

      if (email) {
        const authRes = await api.login(email, role, password)
        if (authRes.ok && authRes.token) {
          setAuthSession(authRes.token, authRes.user)
          handleLoginSuccess(role)
          notify(`Switched session to ${role.replace("_", " ").toUpperCase()}`, "ok")
        } else {
          throw new Error("Invalid credentials or user not found")
        }
      }
    } catch (err: any) {
      console.warn("Authentication failed on role switch:", err)
      notify(err.message || "Authentication failed: Invalid credentials", "err")
    }
  }

  const handleSetAuth = (role: RoleId | null) => {
    if (!role) {
      handleSignOut()
    } else {
      handleSwitchRole(role)
    }
  }

  const handleSetAdminView = (v: View, targetSector?: "global" | "gosalas" | "commissions") => {
    setView(v)
    if (v === "pricing" && targetSector) {
      setPricingSector(targetSector)
      try {
        localStorage.setItem("gomaa_pricing_sector", targetSector)
      } catch (e) {}
    }
    try {
      localStorage.setItem("gomaa_admin_view", v)
      if (auth === "admin" || auth === "super_admin") {
        const effectiveSector = targetSector || pricingSector
        if (v === "pricing") {
          if (effectiveSector === "gosalas") {
            window.location.hash = `#${auth}/pricing/gosalas`
          } else if (effectiveSector === "commissions") {
            window.location.hash = `#${auth}/pricing/commissions`
          } else {
            window.location.hash = `#${auth}/${v}`
          }
        } else {
          window.location.hash = `#${auth}/${v}`
        }
      }
    } catch (e) {}
  }

  // Ensure active view is legal for the authenticated role and sync to store
  useEffect(() => {
    setCurrentRole(auth)
    try {
      if (auth) {
        localStorage.setItem("gomaa_auth_role", auth)
        const currentHash = window.location.hash
          .replace(/^#\/?/, "")
          .toLowerCase()
        if (auth === "admin" || auth === "super_admin") {
          if (!currentHash.startsWith(auth)) {
            if (view === "pricing") {
              if (pricingSector === "gosalas") {
                window.location.hash = `#${auth}/pricing/gosalas`
              } else if (pricingSector === "commissions") {
                window.location.hash = `#${auth}/pricing/commissions`
              } else {
                window.location.hash = `#${auth}/${view}`
              }
            } else {
              window.location.hash = `#${auth}/${view}`
            }
          }
        } else if (auth === "manager") {
          if (!currentHash.startsWith("manager")) {
            const savedManagerView =
              localStorage.getItem("gomaa_manager_view") || "queue"
            window.location.hash = `#manager/${savedManagerView}`
          }
        } else if (auth === "customer" || auth === "driver") {
          if (currentHash !== auth) {
            window.location.hash = `#${auth}`
          }
        }
      } else {
        localStorage.setItem("gomaa_auth_role", "login")
        window.location.hash = "#login"
      }
    } catch (e) {}
  }, [auth, setCurrentRole, view, pricingSector])

  // Listen to hash changes (back/forward or direct navigation)
  useEffect(() => {
    const onHashChange = () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("gomaa_auth_token")
          : null
      const { role, subview, sector } = parseHash()

      if (!token) {
        setAuth(null)
        if (window.location.hash && window.location.hash !== "#login") {
          window.location.hash = "#login"
        }
        return
      }

      if (role === null) {
        setAuth(null)
        return
      }

      if (role !== undefined) {
        setAuth(role)
        localStorage.setItem("gomaa_auth_role", role)
        if (
          (role === "admin" || role === "super_admin") &&
          subview &&
          VALID_ADMIN_VIEWS.includes(subview as View)
        ) {
          setView(subview as View)
          localStorage.setItem("gomaa_admin_view", subview)
          if (subview === "pricing") {
            if (sector === "gosalas") {
              setPricingSector("gosalas")
            } else if (sector === "commissions") {
              setPricingSector("commissions")
            } else {
              setPricingSector("global")
            }
          }
        }
      }
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  if (!auth) return <Login onSignIn={(role) => handleLoginSuccess(role)} />
  if (auth === "customer")
    return <CustomerApp onSignOut={handleSignOut} />
  if (auth === "manager")
    return <ManagerApp onSignOut={handleSignOut} />
  if (auth === "driver")
    return <DriverApp onSignOut={handleSignOut} />

  const isSuperAdmin = auth === "super_admin"

  const currentCommPct = pricingConfig?.commissionPct || 20
  const currentGaushalaPct = 100 - currentCommPct

  // Super Admin Navigation (Master Financial Controller & Money Arranger)
  const superAdminNav: {
    id: View
    label: string
    icon: typeof LayoutDashboard
    badge?: string
  }[] = [
    { id: "overview", label: "Financial Overview", icon: LayoutDashboard },
    { id: "pricing", label: "Pricing Rules", icon: SlidersHorizontal },
    {
      id: "settlements",
      label: "Settlements & Payouts",
      icon: Wallet,
      badge: `${settlements.length}`,
    },
    {
      id: "ledger",
      label: `Network ${currentGaushalaPct}/${currentCommPct} Ledger`,
      icon: Landmark,
    },
    {
      id: "bookings",
      label: "All Bookings Audit",
      icon: ClipboardList,
      badge: String(adminBookingsCount),
    },
    {
      id: "gosalas",
      label: dynamicRegion !== "Regional" ? `${dynamicRegion} Gaushalas` : "Gaushalas Network",
      icon: Building2,
      badge: `${gosalas.length}`,
    },
    {
      id: "managers",
      label: "Manager Governance",
      icon: Users,
      badge: `${managers.length}`,
    },
    {
      id: "tracking",
      label: "Live Fleet GPS",
      icon: Navigation,
      badge: activeTransitsCount > 0 ? `${activeTransitsCount} live` : undefined,
    },
  ]

  // Operations Admin Navigation (Regional Operations & Gosala Manager Governance)
  const adminNav: {
    id: View
    label: string
    icon: typeof LayoutDashboard
    badge?: string
  }[] = [
    { id: "overview", label: "Operations Overview", icon: LayoutDashboard },
    {
      id: "gosalas",
      label: dynamicRegion !== "Regional" ? `${dynamicRegion} Gaushalas` : "Gaushalas Network",
      icon: Building2,
      badge: `${gosalas.length}`,
    },
    {
      id: "managers",
      label: "Gosala Managers",
      icon: Users,
      badge: `${managers.length}`,
    },
    {
      id: "bookings",
      label: "Bookings & Triage",
      icon: ClipboardList,
      badge:
        adminReviewPending > 0
          ? `${adminReviewPending} pending`
          : String(adminBookingsCount),
    },
    {
      id: "tracking",
      label: "Live Fleet GPS",
      icon: Navigation,
      badge: activeTransitsCount > 0 ? `${activeTransitsCount} live` : undefined,
    },
    {
      id: "animals",
      label: "Sacred Herd & Vets",
      icon: PawPrint,
      badge: `${animals.length}`,
    },
    {
      id: "ledger",
      label: `Treasury ${currentGaushalaPct}/${currentCommPct} Ledger`,
      icon: Landmark,
    },
    { id: "availability", label: "Availability & Fleet", icon: CalendarRange },
  ]

  const nav = isSuperAdmin ? superAdminNav : adminNav
  const baseTitle = titles[view] || titles.overview
  const meta =
    view === "gosalas" && dynamicRegion !== "Regional"
      ? {
          title: `${dynamicRegion} Gaushalas Network`,
          desc: `${dynamicRegion} Gaushala directory, AWBI trust compliance, facility capacities & photo galleries`,
        }
      : view === "ledger"
      ? {
          title: `Regional Treasury & ${currentGaushalaPct}/${currentCommPct} Revenue Ledger`,
          desc: `Network revenue split: ${currentGaushalaPct}% Gaushala net share, 100% transport pass-through & platform escrow`,
        }
      : baseTitle

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      {/* Sidebar */}
      <aside className={`${isMaximized ? "hidden" : "hidden lg:flex"} w-[240px] shrink-0 flex-col border-r border-line bg-card sticky top-0 h-screen justify-between transition-all duration-200`}>
        <div className="flex flex-col min-h-0">
          <div className="px-5 h-16 flex items-center gap-3 border-b border-line shrink-0">
            <div
              className={`h-9 w-9 rounded-sm flex items-center justify-center text-white font-serif text-[18px] leading-none shadow-xs ${
                isSuperAdmin
                  ? "bg-gradient-to-br from-amber-500 to-amber-700"
                  : "bg-forest"
              }`}
            >
              {isSuperAdmin ? <Crown size={18} className="stroke-[2.2]" /> : "OA"}
            </div>
            <div className="min-w-0">
              <div className="font-serif text-[18px] leading-none text-ink flex items-center gap-1.5">
                <span>GOMAA</span>
                {isSuperAdmin ? (
                  <span className="font-mono text-[9px] bg-gradient-to-r from-amber-500 to-amber-700 text-white px-1.5 py-0.5 rounded font-bold tracking-wider shadow-2xs">
                    CAPTAIN
                  </span>
                ) : (
                  <span className="font-mono text-[9px] bg-forest/15 text-forest px-1.5 py-0.5 rounded font-semibold">
                    OPERATIONS
                  </span>
                )}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint mt-1 truncate">
                {isSuperAdmin ? "Platform Captain · Finance Master" : `Operations Admin · ${dynamicRegion.toUpperCase()}`}
              </div>
            </div>
          </div>

          <nav className="px-3 py-4 space-y-0.5 overflow-y-auto">
            {nav.map((n) => {
              const active = view === n.id

              if (n.id === "pricing") {
                const isOpen = isPricingMenuOpen
                return (
                  <div key={n.id} className="space-y-1">
                    <div
                      className={`w-full flex items-center justify-between rounded-sm text-[13.5px] transition-colors ${
                        active
                          ? "bg-saffron-soft text-saffron-deep font-medium"
                          : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (view !== "pricing") {
                            handleSetAdminView("pricing")
                            setIsPricingMenuOpen(true)
                          } else {
                            setIsPricingMenuOpen((prev) => !prev)
                          }
                        }}
                        className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer min-w-0"
                      >
                        <n.icon
                          size={17}
                          className={active ? "text-saffron" : "text-ink-faint"}
                        />
                        <span className="truncate">{n.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsPricingMenuOpen((prev) => !prev)
                        }}
                        className="p-2 mr-1 text-ink-faint hover:text-amber-700 hover:bg-amber-100/50 rounded-xs transition cursor-pointer"
                        title={isOpen ? "Collapse pricing sub-sectors" : "Expand pricing sub-sectors"}
                        aria-label={isOpen ? "Collapse pricing sub-sectors" : "Expand pricing sub-sectors"}
                      >
                        <ChevronRight
                          size={13}
                          className={`transition-transform duration-200 ${
                            isOpen ? "rotate-90 text-amber-600" : ""
                          }`}
                        />
                      </button>
                    </div>

                    {/* Integrated Sub-Menu: Clean, visible, NEVER clipped! */}
                    {isOpen && (
                      <div className="pl-3 pr-1 py-1 space-y-1 border-l-2 border-amber-400/80 ml-4 animate-in fade-in duration-150">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetAdminView("pricing", "global")
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-sm text-[12px] transition flex items-center gap-2 cursor-pointer ${
                            active && pricingSector === "global"
                              ? "bg-amber-100 text-amber-950 font-semibold border border-amber-300 shadow-2xs"
                              : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                          }`}
                        >
                          <SlidersHorizontal size={13} className="text-saffron-deep shrink-0" />
                          <span className="truncate">Global Platform Rules</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetAdminView("pricing", "gosalas")
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-sm text-[12px] transition flex items-center gap-2 cursor-pointer ${
                            active && pricingSector === "gosalas"
                              ? "bg-amber-100 text-amber-950 font-semibold border border-amber-300 shadow-2xs"
                              : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                          }`}
                        >
                          <Building2 size={13} className="text-amber-700 shrink-0" />
                          <span className="truncate">Individual Gaushala Pricing</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetAdminView("pricing", "commissions")
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-sm text-[12px] transition flex items-center gap-2 cursor-pointer ${
                            active && pricingSector === "commissions"
                              ? "bg-amber-100 text-amber-950 font-semibold border border-amber-300 shadow-2xs"
                              : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                          }`}
                        >
                          <Percent size={13} className="text-amber-800 shrink-0" />
                          <span className="truncate">Commission &amp; Economics</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <button
                  key={n.id}
                  onClick={() => handleSetAdminView(n.id)}
                  className={`w-full group flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13.5px] transition-colors ${
                    active
                      ? "bg-saffron-soft text-saffron-deep font-medium"
                      : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                  }`}
                >
                  <n.icon
                    size={17}
                    className={active ? "text-saffron" : "text-ink-faint"}
                  />
                  <span className="truncate">{n.label}</span>
                  {n.badge && (
                    <span
                      className={`ml-auto text-[10.5px] font-mono rounded-full px-1.5 py-0.5 shrink-0 ${
                        active
                          ? "bg-saffron text-white"
                          : "bg-paper-deep text-ink-faint"
                      }`}
                    >
                      {n.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-line shrink-0 bg-card">
          <div
            onClick={() => setEditAdminProfileOpen(true)}
            className="flex items-center gap-3 rounded-sm px-2 py-2 hover:bg-paper-deep transition-colors cursor-pointer group"
            title="Edit Admin Profile"
          >
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-medium text-white shrink-0 ${
                isSuperAdmin
                  ? "bg-gradient-to-br from-amber-500 to-amber-700 shadow-xs"
                  : "bg-forest"
              }`}
            >
              {isSuperAdmin ? (
                <Crown size={14} className="stroke-[2.2]" />
              ) : (
                (profiles?.[auth]?.name || "DS").slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-ink truncate font-medium group-hover:text-saffron-deep flex items-center gap-1.5">
                <span>{profiles?.[auth]?.name || (isSuperAdmin ? "Koushik" : "Operations Admin")}</span>
              </div>
              <div className="text-[10.5px] text-ink-faint truncate font-mono">
                {isSuperAdmin ? "Platform Captain · Master" : "Operations Lead · Regional Hub"}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSetAuth(null)
              }}
              className="text-ink-faint hover:text-ink hover:bg-paper-deep rounded-sm p-1.5 transition-colors shrink-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-paper/85 backdrop-blur border-b border-line flex items-center gap-4 px-5 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-[19px] leading-tight text-ink truncate">
                {meta.title}
              </h1>
              <span
                className={`hidden md:inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full ${
                  isSuperAdmin
                    ? "bg-amber-100 text-amber-900 border border-amber-300/80 font-semibold"
                    : "bg-forest/15 text-forest font-semibold"
                }`}
              >
                {isSuperAdmin ? (
                  <>
                    <Crown size={11} className="text-amber-700 stroke-[2.2]" />
                    <span>Captain Supreme Authority</span>
                  </>
                ) : (
                  <span>{dynamicRegion !== "Regional" ? `${dynamicRegion} Hub` : "Operations Hub"}</span>
                )}
              </span>
            </div>
            <p className="text-[12px] text-ink-faint truncate hidden sm:block">
              {meta.desc}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Quick Switcher Between Super Admin Captain & Operations Admin */}
            <div className="flex items-center bg-paper-deep border border-line rounded-sm p-0.5 text-[11.5px] font-medium shrink-0">
              <button
                onClick={() => handleSetAuth("super_admin")}
                className={`px-2.5 py-1 rounded-sm transition flex items-center gap-1.5 cursor-pointer ${
                  isSuperAdmin
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold shadow-2xs"
                    : "text-ink-soft hover:text-ink hover:bg-card/70"
                }`}
                title="Super Admin Captain: Sovereign Platform Authority, Master Pricing & Economics"
              >
                <Crown size={12} className={isSuperAdmin ? "stroke-[2.5]" : ""} />
                <span>Captain</span>
              </button>
              <button
                onClick={() => handleSetAuth("admin")}
                className={`px-2.5 py-1 rounded-sm transition flex items-center gap-1.5 cursor-pointer ${
                  !isSuperAdmin
                    ? "bg-forest text-white font-semibold shadow-2xs"
                    : "text-ink-soft hover:text-ink hover:bg-card/70"
                }`}
                title="Operations Admin: Regional Operations, Manager Governance, Herd Health & Driver Dispatch"
              >
                <Users size={12} />
                <span>Operations</span>
              </button>
            </div>
            <div className="relative hidden md:block">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                placeholder={
                  isSuperAdmin
                    ? "Search transactions, batches…"
                    : "Search bookings, Gosalas…"
                }
                className="w-56 bg-card border border-line rounded-sm pl-9 pr-3 py-2 text-[12.5px] text-ink placeholder:text-ink-faint outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
              />
            </div>
            <button
              onClick={() =>
                notify(
                  isSuperAdmin
                    ? "Settlement batch SEP-W4 ready for disbursement"
                    : "3 bookings awaiting operational approval",
                  "info",
                )
              }
              className="relative h-9 w-9 grid place-items-center rounded-sm border border-line bg-card text-ink-soft hover:text-ink transition-colors"
              aria-label="Notifications"
            >
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-saffron" />
            </button>

            {/* Maximize / Minimize Workspace Toggle */}
            <button
              onClick={toggleMaximize}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-medium transition cursor-pointer border ${
                isMaximized
                  ? "bg-amber-600 text-white border-amber-600 shadow-2xs hover:bg-amber-700"
                  : "bg-card text-ink-soft hover:text-ink border-line hover:bg-paper-deep"
              }`}
              title={isMaximized ? "Exit Maximized View (Restore Sidebar)" : "Maximize Workspace (Hide Sidebar & Expand)"}
              aria-label={isMaximized ? "Exit Maximized View" : "Maximize Workspace"}
            >
              {isMaximized ? (
                <>
                  <Minimize2 size={13} />
                  <span className="hidden sm:inline">Minimize</span>
                </>
              ) : (
                <>
                  <Maximize2 size={13} />
                  <span className="hidden sm:inline">Maximize</span>
                </>
              )}
            </button>

            {/* Header Sign Out button */}
            <button
              onClick={() => handleSetAuth(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink border border-line rounded-sm hover:bg-paper-deep transition-colors ml-1"
              title="Sign out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 py-2 border-b border-line bg-card">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => handleSetAdminView(n.id)}
              className={`whitespace-nowrap rounded-sm px-3 py-1.5 text-[12.5px] transition-colors ${
                view === n.id
                  ? "bg-saffron-soft text-saffron-deep font-medium"
                  : "text-ink-soft"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 p-5 lg:p-8">
          {view === "overview" && <Overview />}
          {view === "gosalas" && (
            <Gaushalas onNavigateToHerd={() => handleSetAdminView("animals")} />
          )}
          {view === "managers" && <GosalaManagers />}
          {view === "bookings" && <Bookings />}
          {view === "tracking" && <LiveTracking />}
          {view === "animals" && <Animals />}
          {view === "ledger" && <ManagerLedger />}
          {view === "availability" && <Availability />}
          {view === "pricing" && (
            <Pricing
              initialSector={pricingSector}
              onSectorChange={handleSetPricingSector}
              isMaximized={isMaximized}
              onToggleMaximize={toggleMaximize}
            />
          )}
          {view === "settlements" &&
            (isSuperAdmin ? (
              <Settlements />
            ) : (
              <CaptainAccessGate
                feature="Settlements & Treasury Payouts"
                onSwitchToCaptain={() => handleSetAuth("super_admin")}
              />
            ))}
        </main>
      </div>

      {editAdminProfileOpen && (auth === "admin" || auth === "super_admin") && (
        <EditProfileModal
          role={auth}
          onClose={() => setEditAdminProfileOpen(false)}
        />
      )}

      {/* Floating Exit Maximize Badge when workspace is maximized */}
      {isMaximized && (
        <button
          onClick={toggleMaximize}
          className="fixed bottom-5 right-5 z-50 bg-ink/95 hover:bg-ink text-white px-4 py-2.5 rounded-full shadow-2xl border border-amber-500/50 flex items-center gap-2 text-[12.5px] font-medium backdrop-blur-md cursor-pointer transition-transform hover:scale-105 active:scale-95 animate-in fade-in"
          title="Restore standard layout (or press Escape)"
        >
          <Minimize2 size={14} className="text-amber-400" />
          <span>Exit Maximized View (ESC)</span>
        </button>
      )}
    </div>
  )
}
