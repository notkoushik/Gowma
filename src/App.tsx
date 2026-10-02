import { useState, useEffect } from "react"
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
    desc: "Real-time booking pipeline, revenue metrics and network health across Pune",
  },
  gosalas: {
    title: "Pune Gaushalas Network",
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
    desc: "Real-time GPS tracking for holy cows travelling across Pune with live driver stages",
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

function parseHash(): { role: RoleId | null | undefined; subview?: string } {
  if (typeof window === "undefined") return { role: undefined }
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase()
  if (!hash) return { role: undefined }
  const parts = hash.split("/")
  const r = parts[0]
  if (r === "login") return { role: null }
  if (VALID_ROLES.includes(r as RoleId)) {
    return { role: r as RoleId, subview: parts[1] }
  }
  return { role: undefined }
}

function getInitialAuth(): RoleId | null {
  const fromHash = parseHash().role
  if (fromHash !== undefined) return fromHash
  try {
    const saved = localStorage.getItem("gomaa_auth_role")
    if (saved === "login" || saved === "null") return null
    if (saved && VALID_ROLES.includes(saved as RoleId)) {
      return saved as RoleId
    }
  } catch (e) {}
  return "customer"
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
  } = useStore()
  const [auth, setAuth] = useState<RoleId | null>(getInitialAuth)
  const [view, setView] = useState<View>(getInitialAdminView)
  const [editAdminProfileOpen, setEditAdminProfileOpen] = useState(false)

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

  // Ensure Operations Admin and Super Admin have regional scope across all Pune Gaushalas
  useEffect(() => {
    if (auth === "admin" || auth === "super_admin") {
      if (activeGosalaFilter !== "ALL") {
        setActiveGosalaFilter("ALL")
      }
    }
  }, [auth, activeGosalaFilter, setActiveGosalaFilter])

  const handleSetAuth = (role: RoleId | null) => {
    setAuth(role)
    try {
      if (role) {
        localStorage.setItem("gomaa_auth_role", role)
        if (role === "admin" || role === "super_admin") {
          window.location.hash = `#${role}/${view}`
        } else if (role === "manager") {
          const savedManagerView =
            localStorage.getItem("gomaa_manager_view") || "queue"
          window.location.hash = `#manager/${savedManagerView}`
        } else {
          window.location.hash = `#${role}`
        }
      } else {
        localStorage.setItem("gomaa_auth_role", "login")
        window.location.hash = "#login"
      }
    } catch (e) {}
  }

  const handleSetAdminView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem("gomaa_admin_view", v)
      if (auth === "admin" || auth === "super_admin") {
        window.location.hash = `#${auth}/${v}`
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
            window.location.hash = `#${auth}/${view}`
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
  }, [auth, setCurrentRole, view])

  // Listen to hash changes (back/forward or direct navigation)
  useEffect(() => {
    const onHashChange = () => {
      const { role, subview } = parseHash()
      if (role !== undefined) {
        setAuth(role)
        if (role) {
          localStorage.setItem("gomaa_auth_role", role)
          if (
            (role === "admin" || role === "super_admin") &&
            subview &&
            VALID_ADMIN_VIEWS.includes(subview as View)
          ) {
            setView(subview as View)
            localStorage.setItem("gomaa_admin_view", subview)
          }
        }
      }
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  if (!auth) return <Login onSignIn={(role) => handleSetAuth(role)} />
  if (auth === "customer")
    return <CustomerApp onSignOut={() => handleSetAuth(null)} />
  if (auth === "manager")
    return <ManagerApp onSignOut={() => handleSetAuth(null)} />
  if (auth === "driver")
    return <DriverApp onSignOut={() => handleSetAuth(null)} />

  const isSuperAdmin = auth === "super_admin"

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
      label: "Network 80/20 Ledger",
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
      label: "Gaushalas Network",
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
      label: "Pune Gaushalas",
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
      label: "Treasury 80/20 Ledger",
      icon: Landmark,
    },
    { id: "availability", label: "Availability & Fleet", icon: CalendarRange },
  ]

  const nav = isSuperAdmin ? superAdminNav : adminNav
  const meta = titles[view] || titles.overview

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-line bg-card sticky top-0 h-screen justify-between">
        <div className="flex flex-col min-h-0">
          <div className="px-5 h-16 flex items-center gap-3 border-b border-line shrink-0">
            <div
              className={`h-9 w-9 rounded-sm flex items-center justify-center text-white font-serif text-[18px] leading-none ${
                isSuperAdmin ? "bg-saffron" : "bg-forest"
              }`}
            >
              {isSuperAdmin ? "SA" : "OA"}
            </div>
            <div className="min-w-0">
              <div className="font-serif text-[18px] leading-none text-ink flex items-center gap-1.5">
                <span>GOMAA</span>
                {isSuperAdmin && (
                  <span className="font-mono text-[9px] bg-saffron/15 text-saffron-deep px-1.5 py-0.5 rounded font-bold">
                    MASTER
                  </span>
                )}
              </div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint mt-1 truncate">
                {isSuperAdmin ? "Super Admin (Finance)" : "Operations Admin"}
              </div>
            </div>
          </div>

          <nav className="px-3 py-4 space-y-0.5 overflow-y-auto">
            {nav.map((n) => {
              const active = view === n.id
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
                isSuperAdmin ? "bg-saffron" : "bg-forest"
              }`}
            >
              {(profiles?.[auth]?.name || (isSuperAdmin ? "VH" : "PS"))
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-ink truncate font-medium group-hover:text-saffron-deep">
                {profiles?.[auth]?.name ||
                  (isSuperAdmin ? "Vikramaditya Hegde" : "Priya Sharma")}
              </div>
              <div className="text-[11px] text-ink-faint truncate">
                {profiles?.[auth]?.adminData?.department ||
                  (isSuperAdmin
                    ? "Chief Treasury Officer"
                    : "Regional Operations")}
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
                className={`hidden md:inline-block font-mono text-[10px] px-2 py-0.5 rounded-full ${
                  isSuperAdmin
                    ? "bg-saffron/15 text-saffron-deep font-semibold"
                    : "bg-forest/15 text-forest font-semibold"
                }`}
              >
                {isSuperAdmin ? "Super Admin Authority" : "Operations Hub"}
              </span>
            </div>
            <p className="text-[12px] text-ink-faint truncate hidden sm:block">
              {meta.desc}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
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
          {view === "pricing" && <Pricing />}
          {view === "settlements" && <Settlements />}
        </main>
      </div>

      {editAdminProfileOpen && (auth === "admin" || auth === "super_admin") && (
        <EditProfileModal
          role={auth}
          onClose={() => setEditAdminProfileOpen(false)}
        />
      )}
    </div>
  )
}
