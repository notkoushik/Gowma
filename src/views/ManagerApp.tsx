import React, {
  useState,
  useEffect,
  useMemo,
  Component,
  ErrorInfo,
  ReactNode,
} from "react"
import {
  Bell,
  CalendarRange,
  ClipboardCheck,
  LogOut,
  PawPrint,
  Search,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldCheck,
  X,
  Check,
  Navigation,
  MoreHorizontal,
  UserCheck,
  Building2,
  ArrowRightLeft,
  ArrowRight,
  MapPin,
  HeartHandshake,
} from "lucide-react"
import Queue from "./manager/Queue"
import LiveTracking from "./manager/LiveTracking"
import Schedule from "./manager/Schedule"
import Animals from "./manager/Animals"
import Availability from "./Availability"
import ManagerLedger from "./manager/ManagerLedger"
import GaushalaProfileView from "./manager/GaushalaProfileView"
import ManagerDevotees from "./manager/ManagerDevotees"
import EditProfileModal from "../components/EditProfileModal"
import { useStore } from "../store/store"
import { initialProfiles } from "../data/profiles"

type MView =
  | "queue"
  | "live_tracking"
  | "schedule"
  | "availability"
  | "animals"
  | "gosalas"
  | "ledger"
  | "devotees"

const VALID_MANAGER_VIEWS: MView[] = [
  "queue",
  "live_tracking",
  "schedule",
  "availability",
  "animals",
  "gosalas",
  "ledger",
  "devotees",
]

function getInitialManagerView(): MView {
  if (typeof window !== "undefined") {
    const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase()
    if (hash.startsWith("manager/")) {
      const sub = hash.split("/")[1]
      if (VALID_MANAGER_VIEWS.includes(sub as MView)) {
        return sub as MView
      }
    }
    try {
      const saved = localStorage.getItem("gomaa_manager_view")
      if (saved && VALID_MANAGER_VIEWS.includes(saved as MView)) {
        return saved as MView
      }
    } catch (e) {}
  }
  return "queue"
}

const titles: Record<MView, { title: string; desc: string }> = {
  queue: {
    title: "Shed Feasibility Queue",
    desc: "4-vector pre-dispatch feasibility check for your assigned Gaushala cows",
  },
  live_tracking: {
    title: "Live Cow Travel Tracking",
    desc: "Live GPS map for cows travelling to devotee homes and returning to shed",
  },
  schedule: {
    title: "Today's Shed Schedule",
    desc: "Today's confirmed events, 90m resting buffers & dual-gate checklists for your shed",
  },
  availability: {
    title: "Shed Slot Availability",
    desc: "Per-animal slot availability & resting buffers for your cows",
  },
  animals: {
    title: "Our Sacred Herd Welfare",
    desc: "Health status toggles, veterinary care, daily seva caps & nutrition for your cows",
  },
  gosalas: {
    title: "My Gaushala Facility",
    desc: "On-site premises, amenities, caretaker contacts, capacities & AWBI trust registration",
  },
  ledger: {
    title: "My Gaushala Net Payouts",
    desc: "Dedicated 80% Gaushala trust revenue share & 100% transport pass-through",
  },
  devotees: {
    title: "Devotees & Transit Fleet Registry",
    desc: "Authorize devotees and transit pilots for your Gaushala with instant credential sharing",
  },
}

// Error boundary to prevent blank white screens
class ManagerErrorBoundary extends Component<{
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
    console.error("ManagerApp error caught by boundary:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-line rounded p-6 text-center shadow-lg">
            <AlertCircle size={36} className="text-danger mx-auto mb-3" />
            <h2 className="font-serif text-[20px] text-ink font-semibold">
              Manager Portal Recovery
            </h2>
            <p className="text-[12px] text-ink-soft mt-2">
              {this.state.errorMsg}
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-forest text-white rounded text-[13px] font-medium hover:bg-forest-deep transition-colors"
              >
                Reload Manager View
              </button>
              <button
                onClick={this.props.onSignOut}
                className="px-4 py-2 bg-paper-deep text-ink border border-line rounded text-[13px] hover:bg-paper transition-colors"
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

function ManagerAppContent({ onSignOut }: { onSignOut: () => void }) {
  const [view, setView] = useState<MView>(getInitialManagerView)
  const [searchQuery, setSearchQuery] = useState("")
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifFilter, setNotifFilter] =
    useState<"all" | "unread" | "welfare" | "booking">("all")
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const {
    bookings,
    animals,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    profiles,
    gosalas,
    managers,
    activeGosalaFilter,
    setActiveGosalaFilter,
    activeManagerGosala,
    setActiveManagerGosala,
    updateProfile,
    pricingConfig,
  } = useStore()
  const defaultCommPct = pricingConfig?.commissionPct ?? 20
  const defaultGaushalaPct = 100 - defaultCommPct
  const meta = titles[view]
  const managerProfile = profiles?.manager || initialProfiles.manager

  // Find matching manager in managers roster if registered
  const matchedManager = useMemo(() => {
    return managers.find(
      (m) =>
        m.id === managerProfile.id ||
        (m.email &&
          managerProfile.email &&
          m.email.toLowerCase() === managerProfile.email.toLowerCase()) ||
        (m.name &&
          managerProfile.name &&
          m.name.toLowerCase() === managerProfile.name.toLowerCase()),
    )
  }, [managers, managerProfile])

  // Extract all assigned Gaushalas for this manager
  const assignedGosalaNames = useMemo(() => {
    const list: string[] = []
    if (matchedManager) {
      if (matchedManager.gosalas && matchedManager.gosalas.length > 0) {
        list.push(...matchedManager.gosalas)
      } else if (
        matchedManager.gosala &&
        matchedManager.gosala !== "Unassigned"
      ) {
        list.push(matchedManager.gosala)
      }
    }
    // Also check all Gaushalas in network for direct manager link
    for (const g of gosalas) {
      const isDirectManager =
        (g.managerId &&
          (g.managerId === managerProfile.id ||
            g.managerId === matchedManager?.id ||
            Boolean((matchedManager as any)?.rawUserId && g.managerId === (matchedManager as any).rawUserId))) ||
        (g.managerName &&
          g.managerName.toLowerCase() ===
            managerProfile.name.toLowerCase()) ||
        (g.managerName && Boolean(matchedManager?.name) &&
          g.managerName.toLowerCase() ===
            matchedManager!.name.toLowerCase()) ||
        (Boolean((g as any).manager) &&
          (g as any).manager.toLowerCase() ===
            managerProfile.name.toLowerCase()) ||
        (Boolean((g as any).caretaker) &&
          (g as any).caretaker.toLowerCase() ===
            managerProfile.name.toLowerCase()) ||
        (Boolean((g as any).caretaker && matchedManager?.name) &&
          (g as any).caretaker.toLowerCase() ===
            matchedManager!.name.toLowerCase()) ||
        g.assignedManagers?.some(
          (am) =>
            am.id === managerProfile.id ||
            am.id === matchedManager?.id ||
            am.name?.toLowerCase() === managerProfile.name.toLowerCase() ||
            am.email === managerProfile.email,
        )
      if (
        isDirectManager &&
        !list.some((x) => x.toLowerCase() === g.name.toLowerCase())
      ) {
        list.push(g.name)
      }
    }
    // Fallback to managerData if empty
    if (list.length === 0) {
      if (
        managerProfile.managerData?.assignedGosalas &&
        managerProfile.managerData.assignedGosalas.length > 0
      ) {
        list.push(...managerProfile.managerData.assignedGosalas)
      } else if (
        managerProfile.managerData?.gosala &&
        managerProfile.managerData.gosala !== "Unassigned"
      ) {
        list.push(managerProfile.managerData.gosala)
      }
    }
    return Array.from(new Set(list))
  }, [matchedManager, gosalas, managerProfile])

  // Selected Gaushala state (backed by localStorage and store)
  const [selectedGosala, setSelectedGosalaState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("gomaa_active_manager_gosala")
      if (saved) return saved
    } catch {}
    return activeManagerGosala || ""
  })

  // If user has exactly 1 Gaushala assigned, auto-select it immediately
  useEffect(() => {
    if (assignedGosalaNames.length === 1 && !selectedGosala) {
      setSelectedGosalaState(assignedGosalaNames[0])
      setActiveManagerGosala(assignedGosalaNames[0])
    }
  }, [assignedGosalaNames, selectedGosala, setActiveManagerGosala])

  // Current Gaushala name to use throughout the manager portal
  const currentGosala = useMemo(() => {
    if (
      selectedGosala &&
      assignedGosalaNames.some(
        (gn) => gn.toLowerCase() === selectedGosala.toLowerCase(),
      )
    ) {
      return selectedGosala
    }
    if (assignedGosalaNames.length === 1) {
      return assignedGosalaNames[0]
    }
    return selectedGosala || assignedGosalaNames[0] || ""
  }, [selectedGosala, assignedGosalaNames])

  const currentGosalaObj = useMemo(() => {
    if (!currentGosala) return null
    return (
      gosalas.find(
        (g) => g.name.toLowerCase() === currentGosala.toLowerCase(),
      ) || null
    )
  }, [gosalas, currentGosala])

  // Modal switcher state
  const [showGosalaSelectorModal, setShowGosalaSelectorModal] = useState(false)

  const handleSelectActiveGosala = (gName: string) => {
    setSelectedGosalaState(gName)
    setActiveManagerGosala(gName)
    setActiveGosalaFilter(gName)
    const baseManagerData =
      managerProfile.managerData || initialProfiles.manager.managerData!
    updateProfile("manager", {
      managerData: {
        ...baseManagerData,
        gosala: gName,
        assignedGosalas: assignedGosalaNames,
      },
    })
    setShowGosalaSelectorModal(false)
  }

  // Strict Gaushala Isolation Lock: Ensure store activeGosalaFilter is strictly pinned to the active Gaushala
  useEffect(() => {
    if (currentGosala) {
      setActiveGosalaFilter(currentGosala)
    }
  }, [currentGosala, setActiveGosalaFilter])

  const handleSetView = (newView: MView) => {
    setView(newView)
    setMobileMoreOpen(false)
    try {
      localStorage.setItem("gomaa_auth_role", "manager")
      localStorage.setItem("gomaa_manager_view", newView)
      window.location.hash = `#manager/${newView}`
    } catch (e) {}
  }

  // Ensure role and current view are saved in localStorage and URL hash
  useEffect(() => {
    try {
      localStorage.setItem("gomaa_auth_role", "manager")
      localStorage.setItem("gomaa_manager_view", view)
      const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase()
      if (!hash.startsWith("manager")) {
        window.location.hash = `#manager/${view}`
      }
    } catch (e) {}
  }, [view])

  // Listen to hash changes (back/forward button or deep links)
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase()
      if (hash.startsWith("manager/")) {
        const sub = hash.split("/")[1]
        if (VALID_MANAGER_VIEWS.includes(sub as MView)) {
          setView(sub as MView)
          localStorage.setItem("gomaa_manager_view", sub)
        }
      }
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  // Strictly shelter-scoped queue counts
  const pendingReviewCount = bookings.filter(
    (b) =>
      b.gosala.toLowerCase().includes(currentGosala.toLowerCase()) &&
      (b.status === "Payment Verified" || b.status === "Manager Review"),
  ).length

  // Strictly shelter-scoped notifications
  const shelterNotifs = notifications.filter((n) => {
    if (n.bookingId) {
      const b = bookings.find((bk) => bk.id === n.bookingId)
      if (b && !b.gosala.toLowerCase().includes(currentGosala.toLowerCase())) {
        return false
      }
    }
    return true
  })

  const unreadCount = shelterNotifs.filter((n) => !n.read).length

  const filteredNotifs = shelterNotifs.filter((n) => {
    if (notifFilter === "unread") return !n.read
    if (notifFilter === "welfare") return n.category === "welfare"
    if (notifFilter === "booking")
      return n.category === "booking" || n.category === "transport"
    return true
  })

  const handleHeaderSearch = (val: string) => {
    setSearchQuery(val)
    if (view !== "queue") handleSetView("queue")
  }

  // Strictly shelter-scoped transit count
  const activeTransitCount = bookings.filter(
    (b) =>
      b.gosala.toLowerCase().includes(currentGosala.toLowerCase()) &&
      (b.status === "In Service" ||
        b.status === "Driver Assigned" ||
        b.status === "En Route" ||
        b.status === "At Altar" ||
        (b.driverStage !== undefined &&
          b.driverStage > 0 &&
          b.driverStage < 9 &&
          b.status !== "Rejected")),
  ).length

  const nav: {
    id: MView
    label: string
    icon: typeof ClipboardCheck
    badge?: string
  }[] = [
    {
      id: "queue",
      label: "Review Queue",
      icon: ClipboardCheck,
      badge: pendingReviewCount > 0 ? String(pendingReviewCount) : undefined,
    },
    { id: "schedule", label: "Today's Schedule", icon: CalendarRange },
    { id: "animals", label: "Our Sacred Herd", icon: PawPrint },
    {
      id: "gosalas",
      label: "My Gaushala Facility",
      icon: Building2,
    },
    {
      id: "devotees",
      label: "Devotees & Drivers",
      icon: HeartHandshake,
    },
    { id: "ledger", label: "My Gaushala Payouts", icon: Wallet },
    {
      id: "live_tracking",
      label: "Live Cow Transit",
      icon: Navigation,
      badge: activeTransitCount > 0 ? String(activeTransitCount) : undefined,
    },
    { id: "availability", label: "Slot Availability", icon: CalendarRange },
  ]

  if (assignedGosalaNames.length === 0) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-card border border-line rounded-xl p-8 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
            <Building2 size={32} />
          </div>
          <h2 className="font-serif text-[22px] text-ink font-semibold">
            No Gaushala Assigned to Your Profile
          </h2>
          <p className="text-[13px] text-ink-soft leading-relaxed max-w-md mx-auto">
            Welcome, <strong>{managerProfile.name}</strong>. Your manager account is active, but an Operations Admin has not assigned any physical Gaushala to your custody yet.
          </p>
          <div className="p-3.5 bg-paper rounded border border-line text-[12px] text-ink-faint">
            Once your Regional Operations Admin assigns one or more Gaushalas to your profile, you will be able to manage their cattle, feasibility queue, live tracking, and net revenue here.
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onSignOut}
              className="px-4 py-2 bg-paper-deep text-ink border border-line rounded text-[13px] hover:bg-paper transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      <EditProfileModal
        role="manager"
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />

      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-line bg-card sticky top-0 h-screen max-h-screen justify-between overflow-hidden">
        <div className="flex flex-col min-h-0">
          <div className="px-5 h-16 flex items-center gap-3 border-b border-line shrink-0">
            <div className="h-9 w-9 rounded-sm bg-forest flex items-center justify-center text-white font-serif text-[18px] leading-none">
              G
            </div>
            <div className="min-w-0">
              <div className="font-serif text-[18px] leading-none text-ink flex items-center gap-1.5">
                <span>GOMAA</span>
                <span className="font-mono text-[9px] bg-forest-soft text-forest px-1.5 py-0.5 rounded font-bold">
                  SHED
                </span>
              </div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-forest font-semibold mt-1 truncate">
                {currentGosala}
              </div>
            </div>
          </div>

          <nav className="px-3 py-4 space-y-1 overflow-y-auto">
            {nav.map((n) => {
              const active = view === n.id
              const Icon = n.icon
              return (
                <button
                  key={n.id}
                  onClick={() => handleSetView(n.id)}
                  className={`w-full h-10 flex items-center gap-3 rounded-sm px-3 text-[13.5px] transition-colors ${
                    active
                      ? "bg-forest-soft text-forest font-medium"
                      : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                  }`}
                >
                  <Icon
                    size={17}
                    className={`${
                      active ? "text-forest" : "text-ink-faint"
                    } shrink-0`}
                  />
                  <span className="truncate flex-1 text-left">{n.label}</span>
                  {n.badge && (
                    <span
                      className={`ml-auto text-[11px] font-mono font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0 whitespace-nowrap leading-none ${
                        active
                          ? "bg-forest text-white"
                          : "bg-saffron text-white"
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
            onClick={() => setEditProfileOpen(true)}
            className="flex items-center gap-3 rounded-sm px-2 py-2 cursor-pointer hover:bg-paper-deep transition-colors group"
            title="Click to edit manager profile"
          >
            <div className="h-8 w-8 rounded-full bg-saffron text-white flex items-center justify-center text-[12px] font-medium shrink-0">
              {managerProfile?.name?.slice(0, 2).toUpperCase() || "GC"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-ink truncate font-medium flex items-center gap-1">
                <span>{managerProfile?.name || "Gaushala Custodian"}</span>
                <span className="text-[10px] text-saffron-deep opacity-0 group-hover:opacity-100 transition-opacity">
                  ✎
                </span>
              </div>
              <div className="text-[11px] text-ink-faint truncate">
                {managerProfile?.managerData?.gosala || "Shri Krishna Gaushala"}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSignOut()
              }}
              className="text-ink-faint hover:text-ink hover:bg-paper rounded-sm p-1.5 transition-colors shrink-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-paper/85 backdrop-blur border-b border-line flex items-center gap-4 px-5 lg:px-8">
          <div className="min-w-0">
            <h1 className="font-serif text-[19px] leading-tight text-ink truncate flex items-center gap-2">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center p-1 text-ink-faint hover:text-ink hover:bg-paper-deep rounded-sm transition-colors"
                title="Go back"
                aria-label="Go back"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
              </button>
              <span>{meta.title}</span>
            </h1>
            <p className="text-[12px] text-ink-faint truncate hidden sm:block">
              {meta.desc}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {/* Active Gaushala Badge & Switcher */}
            <div className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md bg-forest-soft border border-forest/25 text-forest text-[12px] font-medium shrink-0 shadow-2xs">
              <Building2 size={15} className="text-forest shrink-0" />
              <div className="text-left min-w-0">
                <span className="font-semibold text-ink truncate max-w-[110px] sm:max-w-[180px] md:max-w-[240px] block leading-tight">
                  {currentGosalaObj?.name || currentGosala || "Active Gaushala"}
                </span>
                <span className="text-[10px] text-ink-faint font-mono block leading-none">
                  {currentGosalaObj?.region || "Operational Facility"}
                </span>
              </div>
              {assignedGosalaNames.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowGosalaSelectorModal(true)}
                  className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-forest text-white hover:bg-forest-deep text-[11px] font-mono font-medium transition cursor-pointer shadow-xs"
                  title="Switch between your assigned Gaushalas"
                >
                  <ArrowRightLeft size={11} />
                  <span className="hidden sm:inline">Switch</span>
                </button>
              )}
            </div>

            {/* Header Universal Search Input */}
            <div className="relative hidden md:block">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={searchQuery}
                onChange={(e) => handleHeaderSearch(e.target.value)}
                placeholder="Search bookings, devotees, animals…"
                className="w-72 bg-card border border-line rounded-sm pl-9 pr-16 py-2 text-[12.5px] text-ink placeholder:text-ink-faint outline-none focus:border-forest focus:ring-2 focus:ring-forest/15 transition shadow-2xs"
              />
              {searchQuery && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-[10px] font-mono font-semibold bg-forest-soft text-forest border border-forest/20 px-1.5 py-0.5 rounded">
                    {
                      bookings.filter((b) => {
                        if (!b.gosala.toLowerCase().includes(currentGosala.toLowerCase())) {
                          return false
                        }
                        const q = searchQuery.trim().toLowerCase()
                        return (
                          b.id.toLowerCase().includes(q) ||
                          b.customer.toLowerCase().includes(q) ||
                          (b.phone && b.phone.toLowerCase().includes(q)) ||
                          b.animal.toLowerCase().includes(q) ||
                          b.animalType.toLowerCase().includes(q) ||
                          b.address.toLowerCase().includes(q) ||
                          (b.ritualPurpose &&
                            b.ritualPurpose.toLowerCase().includes(q)) ||
                          (b.driver && b.driver.toLowerCase().includes(q)) ||
                          (b.aadhaarNumber &&
                            b.aadhaarNumber.toLowerCase().includes(q))
                        )
                      }).length
                    }{" "}
                    found
                  </span>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-ink-faint hover:text-ink p-0.5 rounded transition-colors"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Search Toggle */}
            <button
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              className="md:hidden h-9 w-9 grid place-items-center rounded-sm border border-line bg-card text-ink-soft hover:text-ink transition-colors"
              aria-label="Toggle Search"
              title="Search"
            >
              <Search size={16} />
            </button>

            {/* Notification Center Trigger & Flyout */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative h-9 w-9 grid place-items-center rounded-sm border border-line bg-card text-ink-soft hover:text-ink transition-colors"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full bg-saffron text-white text-[10px] font-mono font-bold flex items-center justify-center px-1 shadow-xs animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-forest" />
                )}
              </button>

              {/* Notification Center Flyout (Responsive Bottom Sheet on Mobile, Popover on Desktop) */}
              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-ink/40 sm:bg-transparent backdrop-blur-[1px] sm:backdrop-blur-none"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="fixed inset-x-0 bottom-0 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-2 w-full sm:w-96 bg-card border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in text-ink flex flex-col max-h-[85vh] pb-[env(safe-area-inset-bottom)] sm:pb-0">
                    {/* Mobile Sheet Drag Indicator */}
                    <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
                    {/* Flyout Header */}
                    <div className="px-4 py-3 border-b border-line bg-paper flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-[15px] font-semibold text-ink">
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-saffron/15 text-saffron-deep font-semibold">
                            {unreadCount} unread
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {unreadCount > 0 && (
                          <button
                            onClick={() => markAllNotificationsRead()}
                            className="text-forest hover:underline font-medium"
                          >
                            Mark all read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={() => clearNotifications()}
                            className="text-ink-faint hover:text-ink transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="px-3 py-2 border-b border-line/60 bg-card flex gap-1.5 text-[11px] overflow-x-auto">
                      {[
                        { id: "all", label: "All" },
                        { id: "unread", label: `Unread (${unreadCount})` },
                        { id: "welfare", label: "Welfare" },
                        { id: "booking", label: "Bookings" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setNotifFilter(tab.id as any)}
                          className={`px-2.5 py-1 rounded-full font-medium transition ${
                            notifFilter === tab.id
                              ? "bg-forest-soft text-forest font-semibold"
                              : "text-ink-faint hover:text-ink hover:bg-paper"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Notification Items List */}
                    <div className="overflow-y-auto max-h-[380px] divide-y divide-line/40">
                      {filteredNotifs.length === 0 ? (
                        <div className="p-8 text-center text-ink-faint text-[12.5px] space-y-1">
                          <CheckCircle2
                            size={24}
                            className="text-forest/60 mx-auto"
                          />
                          <p className="font-serif text-ink text-[13.5px]">
                            All Caught Up
                          </p>
                          <p className="text-[11.5px]">
                            No notifications in this filter view.
                          </p>
                        </div>
                      ) : (
                        filteredNotifs.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={`p-3.5 hover:bg-paper-deep/50 transition-colors flex gap-3 cursor-pointer ${
                              !n.read ? "bg-saffron-soft/10" : ""
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {n.tone === "ok" && (
                                <CheckCircle2
                                  size={16}
                                  className="text-forest"
                                />
                              )}
                              {n.tone === "warn" && (
                                <AlertTriangle
                                  size={16}
                                  className="text-amber-600"
                                />
                              )}
                              {(n.tone === "danger" || n.tone === "err") && (
                                <AlertCircle
                                  size={16}
                                  className="text-danger"
                                />
                              )}
                              {n.tone === "info" && (
                                <Info size={16} className="text-forest" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[12.5px] font-semibold text-ink truncate">
                                  {n.title}
                                </span>
                                <span className="text-[10.5px] text-ink-faint shrink-0 font-mono">
                                  {n.timestamp}
                                </span>
                              </div>
                              <p className="text-[11.5px] text-ink-soft leading-snug line-clamp-2">
                                {n.message}
                              </p>

                              <div className="flex items-center justify-between pt-0.5">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                                  {n.category}
                                </span>
                                {n.bookingId ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      markNotificationRead(n.id)
                                      setNotificationsOpen(false)
                                      handleSetView("queue")
                                      setSearchQuery(n.bookingId!)
                                    }}
                                    className="text-[11px] font-medium text-forest hover:underline flex items-center gap-0.5"
                                  >
                                    Inspect in Queue →
                                  </button>
                                ) : (
                                  !n.read && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Header Sign Out button */}
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink border border-line rounded-sm hover:bg-paper-deep transition-colors ml-1"
              title="Sign out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Mobile Search Bar Strip (Expandable) */}
        {mobileSearchOpen && (
          <div className="md:hidden px-4 py-2.5 bg-card border-b border-line flex items-center gap-2 animate-fade-in shadow-xs">
            <Search size={15} className="text-ink-faint shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => handleHeaderSearch(e.target.value)}
              placeholder="Search bookings, devotees, cows…"
              className="w-full bg-paper border border-line rounded px-3 py-1.5 text-[16px] sm:text-[12.5px] text-ink placeholder:text-ink-faint outline-none focus:border-forest"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-ink-faint hover:text-ink p-1 rounded"
                title="Clear"
              >
                <X size={15} />
              </button>
            )}
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="text-[12px] text-forest font-medium px-1.5 shrink-0"
            >
              Done
            </button>
          </div>
        )}

        <main className="flex-1 p-3.5 sm:p-5 lg:p-8 pb-24 lg:pb-8">
          {view === "queue" && (
            <Queue
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          )}
          {view === "live_tracking" && <LiveTracking />}
          {view === "schedule" && <Schedule />}
          {view === "availability" && <Availability />}
          {view === "animals" && <Animals />}
          {view === "gosalas" && currentGosalaObj && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-forest-soft border border-forest/20 rounded-md text-[12.5px] text-forest">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="shrink-0 text-forest" />
                  <div>
                    <span className="font-semibold text-ink">
                      {currentGosalaObj.name} · Physical Facility Profile
                    </span>
                    <span className="text-ink-faint text-[11.5px] ml-2">
                      (On-Site Shed Custodian:{" "}
                      {managerProfile?.name || "Gaushala Custodian"})
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10.5px] bg-forest text-white px-2 py-0.5 rounded font-semibold self-start sm:self-auto">
                  1:1 Custodian Lock
                </span>
              </div>
              <GaushalaProfileView
                gosala={currentGosalaObj}
                onBack={() => handleSetView("queue")}
                onEdit={() => {}}
                onUpdatePhotos={() => {}}
                onRegisterCow={() => handleSetView("animals")}
                onViewAnimalWelfare={() => handleSetView("animals")}
              />
            </div>
          )}
          {view === "ledger" && <ManagerLedger />}
          {view === "devotees" && (
            <ManagerDevotees
              currentGosalaName={
                currentGosalaObj?.name || currentGosala || "My Gaushala"
              }
            />
          )}
        </main>

        {/* Mobile Fixed Native Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-line shadow-lg pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5 h-16 items-center px-1">
            <button
              onClick={() => handleSetView("queue")}
              className={`flex flex-col items-center justify-center h-full relative transition-colors ${
                view === "queue"
                  ? "text-forest font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <div className="relative">
                <ClipboardCheck size={20} />
                {pendingReviewCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] rounded-full bg-saffron text-white text-[9.5px] font-mono font-bold flex items-center justify-center px-1 shadow-xs">
                    {pendingReviewCount > 9 ? "9+" : pendingReviewCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-1">
                Queue
              </span>
            </button>

            <button
              onClick={() => handleSetView("live_tracking")}
              className={`flex flex-col items-center justify-center h-full relative transition-colors ${
                view === "live_tracking"
                  ? "text-forest font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <div className="relative">
                <Navigation size={20} />
                {activeTransitCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] rounded-full bg-forest text-white text-[9.5px] font-mono font-bold flex items-center justify-center px-1 shadow-xs animate-pulse">
                    {activeTransitCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-1">
                Live GPS
              </span>
            </button>

            <button
              onClick={() => handleSetView("animals")}
              className={`flex flex-col items-center justify-center h-full relative transition-colors ${
                view === "animals"
                  ? "text-forest font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <PawPrint size={20} />
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-1">
                Herd
              </span>
            </button>

            <button
              onClick={() => handleSetView("schedule")}
              className={`flex flex-col items-center justify-center h-full relative transition-colors ${
                view === "schedule"
                  ? "text-forest font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <CalendarRange size={20} />
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-1">
                Schedule
              </span>
            </button>

            <button
              onClick={() => setMobileMoreOpen(true)}
              className={`flex flex-col items-center justify-center h-full relative transition-colors ${
                view === "availability" ||
                view === "ledger" ||
                view === "gosalas"
                  ? "text-forest font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <div className="relative">
                <MoreHorizontal size={20} />
                {(view === "availability" ||
                  view === "ledger" ||
                  view === "gosalas") && (
                  <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-forest" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-1">
                {view === "ledger"
                  ? "Ledger"
                  : view === "availability"
                    ? "Slots"
                    : view === "gosalas"
                      ? "Gaushalas"
                      : "More"}
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile "More" Drawer Bottom Sheet */}
        {mobileMoreOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm animate-fade-in">
            <div
              className="fixed inset-0"
              onClick={() => setMobileMoreOpen(false)}
            />
            <div className="bg-card border-t border-line rounded-t-2xl shadow-2xl w-full max-h-[85vh] overflow-hidden flex flex-col z-10 animate-slide-up pb-[env(safe-area-inset-bottom)]">
              {/* Drag handle */}
              <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-3" />
              <div className="px-5 pb-3 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-saffron text-white flex items-center justify-center text-[11px] font-medium">
                    {managerProfile?.name?.slice(0, 2).toUpperCase() || "GC"}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-ink">
                      {managerProfile?.name || "Gaushala Custodian"}
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      {managerProfile?.managerData?.gosala ||
                        "Shri Krishna Gaushala"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-1.5 text-ink-faint hover:text-ink rounded"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 space-y-1 overflow-y-auto">
                <button
                  onClick={() => {
                    handleSetView("gosalas")
                    setMobileMoreOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                    view === "gosalas"
                      ? "bg-forest-soft text-forest font-semibold"
                      : "hover:bg-paper-deep text-ink"
                  }`}
                >
                  <Building2
                    size={18}
                    className={
                      view === "gosalas" ? "text-forest" : "text-ink-faint"
                    }
                  />
                  <div>
                    <div className="text-[13px] flex items-center gap-1.5 font-medium">
                      <span>My Gaushalas</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-forest-soft text-forest font-semibold">
                        {gosalas.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      Premises, shed capacities &amp; AWBI trust details
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleSetView("devotees")
                    setMobileMoreOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                    view === "devotees"
                      ? "bg-forest-soft text-forest font-semibold"
                      : "hover:bg-paper-deep text-ink"
                  }`}
                >
                  <HeartHandshake
                    size={18}
                    className={
                      view === "devotees" ? "text-forest" : "text-ink-faint"
                    }
                  />
                  <div>
                    <div className="text-[13px] flex items-center gap-1.5 font-medium">
                      <span>Devotees &amp; Drivers</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-saffron-soft text-saffron-deep font-semibold">
                        Users
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      Authorize devotees &amp; transit pilots with credentials
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleSetView("ledger")
                    setMobileMoreOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                    view === "ledger"
                      ? "bg-forest-soft text-forest font-semibold"
                      : "hover:bg-paper-deep text-ink"
                  }`}
                >
                  <Wallet
                    size={18}
                    className={
                      view === "ledger" ? "text-forest" : "text-ink-faint"
                    }
                  />
                  <div>
                    <div className="text-[13px]">Earnings &amp; Ledger</div>
                    <div className="text-[11px] text-ink-faint">
                      {defaultGaushalaPct}/{defaultCommPct} Gaushala Trust revenue split
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleSetView("availability")
                    setMobileMoreOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                    view === "availability"
                      ? "bg-forest-soft text-forest font-semibold"
                      : "hover:bg-paper-deep text-ink"
                  }`}
                >
                  <CalendarRange
                    size={18}
                    className={
                      view === "availability" ? "text-forest" : "text-ink-faint"
                    }
                  />
                  <div>
                    <div className="text-[13px]">
                      Availability &amp; Slot Locking
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      Per-animal slot state and daily bookings
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMobileMoreOpen(false)
                    setEditProfileOpen(true)
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-paper-deep text-ink transition"
                >
                  <UserCheck size={18} className="text-saffron-deep" />
                  <div>
                    <div className="text-[13px]">Edit Manager Profile</div>
                    <div className="text-[11px] text-ink-faint">
                      Gaushala contact, phone &amp; bank details
                    </div>
                  </div>
                </button>

                {assignedGosalaNames.length > 1 && (
                  <button
                    onClick={() => {
                      setMobileMoreOpen(false)
                      setShowGosalaSelectorModal(true)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-forest-soft text-forest transition"
                  >
                    <ArrowRightLeft size={18} className="text-forest" />
                    <div>
                      <div className="text-[13px] font-medium">
                        Switch Gaushala Facility
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        Currently: {currentGosalaObj?.name || currentGosala}
                      </div>
                    </div>
                  </button>
                )}

                <div className="pt-2 border-t border-line mt-2">
                  <button
                    onClick={() => {
                      setMobileMoreOpen(false)
                      onSignOut()
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left text-danger hover:bg-danger-soft transition"
                  >
                    <LogOut size={18} />
                    <div className="text-[13px] font-medium">
                      Sign Out from Gaushala
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- GAUSHALA GATEWAY / SELECTOR MODAL ----------------- */}
        {(showGosalaSelectorModal ||
          (!currentGosala && assignedGosalaNames.length > 1)) && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink/75 backdrop-blur-md animate-fade-in overflow-y-auto">
            <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-[10000] my-auto">
              <div className="p-6 border-b border-line bg-card/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-forest-soft text-forest flex items-center justify-center shrink-0">
                    <Building2 size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif text-[20px] font-semibold text-ink">
                      Select Gaushala to Manage
                    </h3>
                    <p className="text-[12.5px] text-ink-faint mt-0.5">
                      You are authorized as Manager for multiple facilities. Select the Gaushala you want to oversee. Details and cattle records between Gaushalas are strictly isolated.
                    </p>
                  </div>
                </div>
                {currentGosala && (
                  <button
                    onClick={() => setShowGosalaSelectorModal(false)}
                    className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
                    title="Close"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                {assignedGosalaNames.map((gName) => {
                  const gObj = gosalas.find(
                    (g) => g.name.toLowerCase() === gName.toLowerCase(),
                  )
                  const cowsCount = animals.filter(
                    (a) => a.gosala.toLowerCase() === gName.toLowerCase(),
                  ).length
                  const queueCount = bookings.filter(
                    (b) =>
                      b.gosala.toLowerCase().includes(gName.toLowerCase()) &&
                      (b.status === "Payment Verified" ||
                        b.status === "Manager Review"),
                  ).length
                  const isCurrentlyActive =
                    currentGosala &&
                    currentGosala.toLowerCase() === gName.toLowerCase()

                  return (
                    <div
                      key={gName}
                      onClick={() => handleSelectActiveGosala(gName)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isCurrentlyActive
                          ? "bg-forest-soft/70 border-forest shadow-xs ring-1 ring-forest/30"
                          : "bg-card border-line hover:border-forest/60 hover:bg-paper-deep/60"
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-forest text-white font-serif font-bold text-[16px] flex items-center justify-center shrink-0 shadow-xs">
                          {gName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif text-[16px] font-semibold text-ink truncate">
                              {gName}
                            </h4>
                            {isCurrentlyActive && (
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-forest text-white font-semibold shrink-0">
                                Active Now
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-ink-faint flex items-center gap-1.5 mt-1">
                            <MapPin size={11} className="text-saffron shrink-0" />
                            <span className="truncate">
                              {gObj?.region || "Operational Hub"}
                            </span>
                            <span>·</span>
                            <span className="truncate">
                              {gObj?.address || "Regional Sanctuary Hub"}
                            </span>
                          </div>
                          <div className="text-[11.5px] text-ink-soft mt-1">
                            AWBI Reg:{" "}
                            <strong>
                              {gObj?.trustRegistrationNo || "AWBI-VERIFIED"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-line/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-paper-deep text-ink font-medium border border-line">
                            {cowsCount} cattle
                          </span>
                          {queueCount > 0 && (
                            <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-saffron-soft text-saffron-deep font-bold">
                              {queueCount} in queue
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectActiveGosala(gName)
                          }}
                          className={`px-3 py-1.5 rounded text-[12px] font-medium transition cursor-pointer flex items-center gap-1 ${
                            isCurrentlyActive
                              ? "bg-forest text-white hover:bg-forest-deep"
                              : "bg-paper-deep text-ink hover:bg-forest hover:text-white border border-line"
                          }`}
                        >
                          <span>
                            {isCurrentlyActive
                              ? "Currently Managing"
                              : "Manage this Gaushala"}
                          </span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="p-4 border-t border-line bg-paper text-[11.5px] text-ink-faint flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-forest shrink-0" />
                  Zero cross-shelter leakage · Each Gaushala is an isolated workspace
                </span>
                <span className="font-mono text-[11px] text-ink-soft">
                  {assignedGosalaNames.length} facilities authorized
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ManagerApp({ onSignOut }: { onSignOut: () => void }) {
  return (
    <ManagerErrorBoundary onSignOut={onSignOut}>
      <ManagerAppContent onSignOut={onSignOut} />
    </ManagerErrorBoundary>
  )
}
