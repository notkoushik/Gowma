import { useState, useMemo } from "react"
import {
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  X,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
  BadgeAlert,
  Trash2,
  AlertCircle,
  Info,
  Check,
  Edit3,
  PawPrint,
  Clock,
  Sparkles,
  Crown,
} from "lucide-react"
import type { GosalaManager } from "../data/mock"
import { useStore, useToast, type Gosala } from "../store/store"
import { Eyebrow, Panel, PanelHead, Tag } from "../lib/ui"
import { INDIAN_REGIONAL_HUBS } from "../data/regions"
import MapLocationPicker from "../components/MapLocationPicker"

export default function GosalaManagers() {
  const {
    managers,
    gosalas,
    animals,
    bookings,
    addManager,
    updateManager,
    toggleManagerStatus,
    deleteManager,
    updateGosala,
    addGosala,
    currentRole,
    profiles,
    authUser,
  } = useStore()
  const { notify } = useToast()

  const activeAdminName = authUser?.name || profiles?.admin?.name || "Operations Admin"
  const activeSuperAdminName = authUser?.name || profiles?.super_admin?.name || "Vikramaditya Hegde"

  const [activeTab, setActiveTab] = useState<"matrix" | "managers">("matrix")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<"All" | "Active" | "Inactive">("All")
  const [portfolioScope, setPortfolioScope] = useState<"my_portfolio" | "all_network">("my_portfolio")

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingManager, setEditingManager] = useState<GosalaManager | null>(null)

  // Confirmation Modals for Deactivation & Deletion
  const [deactivatingManager, setDeactivatingManager] = useState<GosalaManager | null>(null)
  const [deletingManager, setDeletingManager] = useState<GosalaManager | null>(null)

  // Reassign Modal
  const [reassigningGosala, setReassigningGosala] = useState<Gosala | null>(null)
  const [selectedManagerId, setSelectedManagerId] = useState<string>("")

  // Form state
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formSelectedGosalas, setFormSelectedGosalas] = useState<string[]>([])
  const [formRegion, setFormRegion] = useState("Cyberabad / Gachibowli Zone")
  const [gosalaSearchFilter, setGosalaSearchFilter] = useState("")

  // Register Gaushala Modal state
  const [showAddGosalaModal, setShowAddGosalaModal] = useState(false)
  const [gFormName, setGFormName] = useState("")
  const [gFormRegion, setGFormRegion] = useState("Hyderabad Central (Banjara Hills / Jubilee Hills)")
  const [gFormAddress, setGFormAddress] = useState("")
  const [gFormPhone, setGFormPhone] = useState("+91 98")
  const [gFormEmail, setGFormEmail] = useState("trust@gomaa.in")
  const [gFormTrustNo, setGFormTrustNo] = useState("")
  const [gFormCapacity, setGFormCapacity] = useState("50")
  const [gFormCaretaker, setGFormCaretaker] = useState("Dedicated Gosevak Caretaker")
  const [gFormManagerId, setGFormManagerId] = useState("")
  const [gFormLat, setGFormLat] = useState<number>(17.4156)
  const [gFormLng, setGFormLng] = useState<number>(78.4358)

  const handleRegionSelect = (hubId: string) => {
    const hub = INDIAN_REGIONAL_HUBS.find((h) => h.id === hubId)
    if (hub) {
      setGFormRegion(`${hub.name} (${hub.city}, ${hub.state})`)
      setGFormLat(hub.lat)
      setGFormLng(hub.lng)
      if (!gFormAddress) {
        setGFormAddress(`${hub.name}, ${hub.city}, ${hub.state}`)
      }
    }
  }

  const handleRegisterGosala = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gFormName.trim() || !gFormAddress.trim()) {
      notify("Please provide Gaushala name and physical address", "danger")
      return
    }
    const chosenMgr = managers.find((m) => m.id === gFormManagerId)
    const newG = addGosala({
      name: gFormName.trim(),
      region: gFormRegion,
      address: gFormAddress.trim(),
      contactPhone: gFormPhone.trim(),
      email: gFormEmail.trim(),
      trustRegistrationNo: gFormTrustNo.trim() || `AWBI-TR-${Math.floor(1000 + Math.random() * 8999)}`,
      capacity: Number(gFormCapacity) || 40,
      caretaker: gFormCaretaker.trim(),
      managerId: chosenMgr ? chosenMgr.id : "",
      managerName: chosenMgr ? chosenMgr.name : "None (Admin Acting)",
      lat: gFormLat,
      lng: gFormLng,
      status: "Active",
      establishedYear: "2024",
      facilities: [
        "Padded Cattle Ambulance / Van",
        "24/7 Pure Borewell Water & Trough",
      ],
      photo: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
      governingAdminRole: currentRole === "super_admin" ? "super_admin" : "admin",
      governingAdminName: currentRole === "super_admin" ? activeSuperAdminName : activeAdminName,
    } as any)
    if (chosenMgr) {
      const existing = getManagerAssignedGosalas(chosenMgr)
      updateManager(chosenMgr.id, {
        gosalas: Array.from(new Set([...existing, newG.name])),
        gosala: existing[0] || newG.name,
      })
    }
    setShowAddGosalaModal(false)
    setGFormName("")
    setGFormAddress("")
    notify(`Gaushala "${newG.name}" registered successfully!`, "ok")
  }

  // Helper: Resolve all assigned Gaushalas for a manager dynamically from all links
  const getManagerAssignedGosalas = (m: GosalaManager): string[] => {
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
            g.managerId.includes(m.id))
        )
          return true
        if (g.managerName && g.managerName.toLowerCase() === m.name.toLowerCase())
          return true
        if (Array.isArray((g as any).assignedManagers)) {
          return (g as any).assignedManagers.some(
            (am: any) =>
              am.id === m.id ||
              am.name?.toLowerCase() === m.name.toLowerCase(),
          )
        }
        return false
      })
      .map((g) => g.name)

    return Array.from(new Set([...directList, ...mappedFromGosalas])).filter(
      Boolean,
    )
  }

  const handleOpenAdd = () => {
    setEditingManager(null)
    setFormName("")
    setFormEmail("")
    setFormPhone("+91 98")
    setFormRegion(gosalas[0]?.region || "Cyberabad / Gachibowli Zone")
    setFormSelectedGosalas(gosalas.length > 0 ? [gosalas[0].name] : [])
    setGosalaSearchFilter("")
    setShowAddModal(true)
  }

  const handleOpenEdit = (mgr: GosalaManager) => {
    setEditingManager(mgr)
    setFormName(mgr.name)
    setFormEmail(mgr.email)
    setFormPhone(mgr.phone)
    setFormRegion(mgr.region || gosalas[0]?.region || "Cyberabad / Gachibowli Zone")
    const existing = getManagerAssignedGosalas(mgr)
    setFormSelectedGosalas(existing)
    setGosalaSearchFilter("")
    setShowAddModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formEmail.trim() || !formPhone.trim()) {
      notify("Please fill all required manager fields", "danger")
      return
    }

    const totalCows = animals.filter((a) =>
      formSelectedGosalas.some(
        (gn) => gn.toLowerCase() === a.gosala.toLowerCase(),
      ),
    ).length

    const primaryGosala =
      formSelectedGosalas.length > 0 ? formSelectedGosalas[0] : "Unassigned"

    if (editingManager) {
      updateManager(editingManager.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        gosala: primaryGosala,
        gosalas: formSelectedGosalas,
        region: formRegion,
        animalsCount: totalCows,
      })
      // Sync each selected Gaushala with managerId and managerName
      for (const gName of formSelectedGosalas) {
        const found = gosalas.find(
          (g) => g.name.toLowerCase() === gName.toLowerCase(),
        )
        if (found) {
          updateGosala(found.id, {
            managerId: editingManager.id,
            managerName: formName.trim(),
          })
        }
      }
      setShowAddModal(false)
      notify(
        `Updated manager ${formName.trim()} with ${formSelectedGosalas.length} assigned Gaushala(s)`,
        "ok",
      )
    } else {
      addManager({
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        gosala: primaryGosala,
        gosalas: formSelectedGosalas,
        region: formRegion,
        status: "Active",
        animalsCount: totalCows,
      })
      setShowAddModal(false)
      notify(
        `Added new Gaushala manager ${formName.trim()} (${formSelectedGosalas.length} assigned)`,
        "ok",
      )
    }
  }

  // Handle Confirmed Deactivation / Activation
  const handleConfirmToggleStatus = () => {
    if (!deactivatingManager) return
    const isActivating = deactivatingManager.status !== "Active"
    toggleManagerStatus(deactivatingManager.id)
    notify(
      isActivating
        ? `Manager ${deactivatingManager.name} has been reactivated.`
        : `Manager ${deactivatingManager.name} deactivated. Operations Admin will act as Custodian for their shelters.`,
      isActivating ? "ok" : "warn",
    )
    setDeactivatingManager(null)
  }

  // Handle Confirmed Deletion
  const handleConfirmDelete = () => {
    if (!deletingManager) return
    const deletedName = deletingManager.name
    deleteManager(deletingManager.id)
    notify(
      `Manager ${deletedName} was permanently removed. Assigned Gaushalas reverted to Admin Custody.`,
      "ok",
    )
    setDeletingManager(null)
  }

  const handleOpenReassign = (g: Gosala) => {
    setReassigningGosala(g)
    // Find current manager ID if any
    const cur = managers.find((m) => {
      const gList = getManagerAssignedGosalas(m)
      return (
        gList.some((gn) => gn.toLowerCase() === g.name.toLowerCase()) ||
        m.id === g.managerId
      )
    })
    setSelectedManagerId(cur ? cur.id : "UNASSIGNED")
  }

  const handleSaveReassignment = () => {
    if (!reassigningGosala) return

    if (selectedManagerId === "UNASSIGNED") {
      // Find all managers assigned to this Gaushala and remove this Gaushala from their list
      const assignedMgrs = managers.filter((m) => {
        const gList = getManagerAssignedGosalas(m)
        return (
          gList.some((gn) => gn.toLowerCase() === reassigningGosala.name.toLowerCase()) ||
          m.id === reassigningGosala.managerId
        )
      })
      for (const mgr of assignedMgrs) {
        const currentList = getManagerAssignedGosalas(mgr)
        const nextList = currentList.filter(
          (g) => g.toLowerCase() !== reassigningGosala.name.toLowerCase(),
        )
        updateManager(mgr.id, {
          gosalas: nextList,
          gosala: nextList[0] || "Unassigned",
          status: nextList.length === 0 ? "Inactive" : mgr.status,
        })
      }
      updateGosala(reassigningGosala.id, {
        managerId: "",
        managerName: "None (Admin Acting)",
      })
      notify(
        `${reassigningGosala.name} is now unassigned. Regional Admin will act as Custodian.`,
        "warn",
      )
    } else {
      const chosen = managers.find((m) => m.id === selectedManagerId)
      if (chosen) {
        const currentList = getManagerAssignedGosalas(chosen)
        const nextList = Array.from(
          new Set([...currentList, reassigningGosala.name]),
        )

        updateManager(chosen.id, {
          gosalas: nextList,
          gosala: nextList[0],
          status: "Active",
        })
        updateGosala(reassigningGosala.id, {
          managerId: chosen.id,
          managerName: chosen.name,
        })
        notify(
          `Assigned ${chosen.name} as Manager for ${reassigningGosala.name}. (${nextList.length} Gaushala${nextList.length > 1 ? "s" : ""} managed by ${chosen.name})`,
          "ok",
        )
      }
    }
    setReassigningGosala(null)
  }

  // Multi-Tenant Isolation Scope:
  // - Operations Admin: Show ONLY Gaushalas & Managers under active admin's regional administration!
  // - Super Admin: By default ("my_portfolio"), show ONLY sovereign Gaushalas & custodians.
  //   Super Admin can also switch to "all_network" for sovereign platform audit.
  const scopedGosalas = useMemo(() => {
    if (currentRole === "admin") {
      return gosalas.filter((g) => {
        const role = (g as any).governingAdminRole
        const name = (g as any).governingAdminName
        const adminName = (g as any).adminName
        return (
          role === "admin" ||
          !role ||
          name === activeAdminName ||
          adminName === activeAdminName ||
          (authUser?.gosalaNames && authUser.gosalaNames.includes(g.name))
        )
      })
    }
    if (currentRole === "super_admin") {
      if (portfolioScope === "my_portfolio") {
        return gosalas.filter((g) => (g as any).governingAdminRole === "super_admin")
      }
      return gosalas
    }
    return gosalas
  }, [gosalas, currentRole, portfolioScope, activeAdminName, authUser])

  const scopedManagers = useMemo(() => {
    if (currentRole === "admin") {
      return managers.filter((m) => {
        const assigned = getManagerAssignedGosalas(m)
        if (assigned.length === 0) return true
        return assigned.some((gName) =>
          scopedGosalas.some(
            (sg) => sg.name.toLowerCase() === gName.toLowerCase()
          )
        )
      })
    }
    if (currentRole === "super_admin" && portfolioScope === "my_portfolio") {
      return managers.filter((m) => {
        const assigned = getManagerAssignedGosalas(m)
        if (assigned.length === 0) return true
        return assigned.some((gName) =>
          scopedGosalas.some(
            (sg) => sg.name.toLowerCase() === gName.toLowerCase()
          )
        )
      })
    }
    return managers
  }, [managers, scopedGosalas, currentRole, portfolioScope])

  // Filtered managers for tab 2
  const filteredManagers = scopedManagers.filter((m) => {
    const assigned = getManagerAssignedGosalas(m)
    const matchesSearch =
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      assigned.some((g) => g.toLowerCase().includes(query.toLowerCase())) ||
      m.region.toLowerCase().includes(query.toLowerCase()) ||
      m.id.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === "All" || m.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Mapping calculation
  const matrixData = useMemo(() => {
    return scopedGosalas.map((g) => {
      const assignedActive = scopedManagers.filter((m) => {
        if (m.status !== "Active") return false
        const gList = getManagerAssignedGosalas(m)
        return (
          gList.some((gn) => gn.toLowerCase() === g.name.toLowerCase()) ||
          m.id === g.managerId
        )
      })

      const assignedInactive = scopedManagers.filter((m) => {
        if (m.status !== "Inactive") return false
        const gList = getManagerAssignedGosalas(m)
        return (
          gList.some((gn) => gn.toLowerCase() === g.name.toLowerCase()) ||
          m.id === g.managerId
        )
      })

      const shelterAnimals = animals.filter(
        (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
      )
      const shelterPendingBookings = bookings.filter(
        (b) =>
          b.gosala.toLowerCase() === g.name.toLowerCase() &&
          (b.status === "Payment Verified" || b.status === "Manager Review"),
      ).length

      return {
        gosala: g,
        activeManagers: assignedActive,
        inactiveManagers: assignedInactive,
        animalsCount: shelterAnimals.length,
        pendingBookings: shelterPendingBookings,
      }
    })
  }, [scopedGosalas, scopedManagers, animals, bookings])

  const unassignedSheltersCount = matrixData.filter(
    (x) => x.activeManagers.length === 0,
  ).length
  const activeManagersCount = scopedManagers.filter((m) => m.status === "Active").length

  return (
    <div className="space-y-6">
      {/* Admin Portfolio Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-line rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-9 w-9 rounded-md flex items-center justify-center text-white shrink-0 ${
              currentRole === "super_admin"
                ? "bg-gradient-to-br from-amber-500 to-amber-700 shadow-xs"
                : "bg-forest shadow-xs"
            }`}
          >
            {currentRole === "super_admin" ? (
              <Crown size={18} className="stroke-[2.2]" />
            ) : (
              <Building2 size={18} />
            )}
          </div>
          <div>
            <div className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
              <span>Administering Portfolio:</span>
              <span className="font-serif text-forest font-bold">
                {currentRole === "super_admin"
                  ? portfolioScope === "my_portfolio"
                    ? `${activeSuperAdminName} (Sovereign Gaushalas)`
                    : "Consolidated Platform Network (Audit Mode)"
                  : `${activeAdminName} (Regional Operations Hub)`}
              </span>
            </div>
            <p className="text-[11.5px] text-ink-faint">
              {currentRole === "super_admin"
                ? portfolioScope === "my_portfolio"
                  ? "Inspecting your sovereign Gaushalas and custodians (Isolated from other admins)"
                  : "Super Admin Captain audit mode: All platform shelters and custodians across all regional admins"
                : `Managing ${scopedGosalas.length} operational shelter(s) and assigned custodians under ${activeAdminName}`}
            </p>
          </div>
        </div>

        {currentRole === "super_admin" && (
          <div className="flex items-center bg-paper border border-line rounded-md p-1 text-[11.5px] font-medium shrink-0">
            <button
              type="button"
              onClick={() => setPortfolioScope("my_portfolio")}
              className={`px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 ${
                portfolioScope === "my_portfolio"
                  ? "bg-gradient-to-r from-amber-500 to-amber-700 text-white font-semibold shadow-xs"
                  : "text-ink-soft hover:text-ink hover:bg-card"
              }`}
            >
              <Crown size={12} className="stroke-[2.2]" />
              <span>
                My Sovereign (
                {
                  gosalas.filter(
                    (g) => (g as any).governingAdminRole === "super_admin",
                  ).length
                }
                )
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPortfolioScope("all_network")}
              className={`px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 ${
                portfolioScope === "all_network"
                  ? "bg-forest text-white font-semibold shadow-xs"
                  : "text-ink-soft hover:text-ink hover:bg-card"
              }`}
            >
              <Users size={12} />
              <span>All Network ({gosalas.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-line rounded-md p-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] text-ink-faint uppercase">
              Registered Gaushalas
            </div>
            <div className="font-serif text-[24px] font-bold text-ink mt-0.5">
              {scopedGosalas.length}
            </div>
          </div>
          <div className="h-10 w-10 rounded-full bg-forest-soft text-forest flex items-center justify-center">
            <Building2 size={20} />
          </div>
        </div>

        <div className="bg-card border border-line rounded-md p-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] text-ink-faint uppercase">
              Active Custodian Managers
            </div>
            <div className="font-serif text-[24px] font-bold text-ink mt-0.5">
              {activeManagersCount}
            </div>
          </div>
          <div className="h-10 w-10 rounded-full bg-saffron-soft text-saffron-deep flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-card border border-line rounded-md p-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] text-ink-faint uppercase">
              Unassigned / Admin Acting
            </div>
            <div className="font-serif text-[24px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
              {unassignedSheltersCount}
            </div>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <Panel>
        <div className="p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Eyebrow>Operations &amp; Custodian Governance</Eyebrow>
            <h2 className="font-serif text-[20px] text-ink mt-0.5">
              Gaushala Custodians &amp; Acting Matrix
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab selector */}
            <div className="bg-paper border border-line rounded-sm p-0.5 flex items-center">
              <button
                onClick={() => setActiveTab("matrix")}
                className={`px-3 py-1 text-[12px] font-mono rounded-sm transition cursor-pointer ${
                  activeTab === "matrix"
                    ? "bg-saffron text-white font-medium shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                Assignment Matrix
              </button>
              <button
                onClick={() => setActiveTab("managers")}
                className={`px-3 py-1 text-[12px] font-mono rounded-sm transition cursor-pointer ${
                  activeTab === "managers"
                    ? "bg-saffron text-white font-medium shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                Managers Directory ({scopedManagers.length})
              </button>
            </div>

            {/* Register Gaushala Button */}
            <button
              onClick={() => setShowAddGosalaModal(true)}
              className="inline-flex items-center gap-1.5 bg-saffron hover:bg-saffron-deep text-white text-[12.5px] font-medium px-3.5 py-1.5 rounded-sm transition shadow-xs cursor-pointer"
            >
              <Building2 size={14} />
              <span>Register Gaushala</span>
            </button>

            {/* Add Manager Button */}
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 bg-forest hover:bg-forest-deep text-white text-[12.5px] font-medium px-3.5 py-1.5 rounded-sm transition shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Manager</span>
            </button>
          </div>
        </div>

        {/* TAB 1: ASSIGNMENT MATRIX */}
        {activeTab === "matrix" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-line bg-card/60">
                    {[
                      "Gaushala Name & Region",
                      "Assigned Custodian(s)",
                      "Status",
                      "Triage Authority",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint font-medium px-4 py-3 text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map(
                    ({
                      gosala,
                      activeManagers,
                      inactiveManagers,
                      animalsCount,
                    }) => (
                      <tr
                        key={gosala.id}
                        className="border-b border-line/70 hover:bg-paper/70 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-[13px] text-ink">
                            {gosala.name}
                          </div>
                          <div className="text-[11.5px] text-ink-faint flex items-center gap-1.5 mt-0.5">
                            <MapPin size={11} className="text-saffron" />
                            <span>{gosala.region}</span>
                            <span>·</span>
                            <span>{animalsCount} cows</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {activeManagers.length > 0 ? (
                            <div className="space-y-1">
                              {activeManagers.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-2"
                                >
                                  <div className="h-6 w-6 rounded-full bg-forest-soft text-forest text-[11px] font-medium flex items-center justify-center">
                                    {m.name.slice(0, 1)}
                                  </div>
                                  <div className="text-[12.5px] font-medium text-ink">
                                    {m.name}
                                  </div>
                                  <span className="font-mono text-[10.5px] text-ink-faint">
                                    ({m.id})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : inactiveManagers.length > 0 ? (
                            <div className="space-y-1">
                              <div className="text-[12px] text-ink-faint line-through">
                                {inactiveManagers[0].name} (Inactive)
                              </div>
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30">
                                <AlertTriangle size={11} /> Unassigned · Inactive Manager
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-semibold">
                              <ShieldAlert size={13} className="shrink-0 text-amber-600" />
                              <span>Unassigned · Direct Admin Custodian</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {activeManagers.length > 0 ? (
                            <Tag tone="ok">
                              {activeManagers.length > 1
                                ? `${activeManagers.length} Staffed`
                                : "Staffed"}
                            </Tag>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20">
                              Admin Acting
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {activeManagers.length > 0 ? (
                            <div className="text-[12px] text-ink-soft">
                              <span className="font-medium text-ink">
                                {activeManagers.map((m) => m.name).join(", ")}
                              </span>
                              <div className="text-[10.5px] text-ink-faint">
                                Local Gaushala Custodian
                              </div>
                            </div>
                          ) : (
                            <div className="text-[12px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
                              <ShieldCheck size={13} className="text-amber-600 shrink-0" />
                              <span>Operations Admin</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => handleOpenReassign(gosala)}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-saffron-deep hover:text-saffron px-2.5 py-1 rounded border border-saffron/30 hover:bg-saffron-soft transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft size={13} />
                            <span>
                              {activeManagers.length > 0
                                ? "Manage Custodian"
                                : "Assign Manager"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MANAGERS DIRECTORY */}
        {activeTab === "managers" && (
          <div>
            {/* Filters bar */}
            <div className="p-4 border-b border-line flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card/40">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by manager name, Gosala, or region…"
                  className="w-full bg-paper border border-line rounded-sm pl-9 pr-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                {(["All", "Active", "Inactive"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-sm px-2.5 py-1 text-[11.5px] font-mono transition-colors cursor-pointer ${
                      statusFilter === s
                        ? "bg-saffron-soft text-saffron-deep font-semibold"
                        : "text-ink-soft hover:bg-paper-deep"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Managers Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[840px]">
                <thead>
                  <tr className="border-b border-line bg-card/60">
                    {[
                      "Manager ID & Name",
                      "Assigned Gaushalas",
                      "Contact Info",
                      "Total Herd",
                      "Assigned Date",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint font-medium px-4 py-3 text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredManagers.map((m) => {
                    const managerGosalas = getManagerAssignedGosalas(m)
                    const dynamicCowCount = animals.filter((a) =>
                      managerGosalas.some(
                        (gn) => gn.toLowerCase() === a.gosala.toLowerCase(),
                      ),
                    ).length

                    return (
                      <tr
                        key={m.id}
                        className="border-b border-line/70 hover:bg-paper/70 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-saffron-soft text-saffron-deep font-medium flex items-center justify-center text-[12px] shrink-0 font-semibold">
                              {m.name
                                .split(" ")
                                .map((x) => x[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-[13px] font-medium text-ink leading-snug">
                                {m.name}
                              </div>
                              <div className="font-mono text-[11px] text-ink-faint">
                                {m.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 max-w-[280px]">
                          {managerGosalas.length > 0 ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {managerGosalas.map((gn) => (
                                  <span
                                    key={gn}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-forest-soft text-forest border border-forest/20"
                                  >
                                    <Building2 size={10} />
                                    <span>{gn}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="text-[10.5px] text-ink-faint">
                                {managerGosalas.length} facility{managerGosalas.length > 1 ? "s" : ""} under custody
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-semibold">
                              ⚠️ Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-[12px] text-ink">
                            <Phone size={12} className="text-ink-faint" />
                            <span className="font-mono">{m.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11.5px] text-ink-faint mt-0.5">
                            <Mail size={12} className="text-ink-faint" />
                            <span>{m.email}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-mono text-[12.5px] text-ink font-medium bg-paper-deep px-2 py-0.5 rounded-sm">
                            {dynamicCowCount} cows
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-[12px] text-ink-faint font-mono">
                          {m.assignedDate || "Active"}
                        </td>

                        <td className="px-4 py-3.5">
                          {m.status === "Active" ? (
                            <Tag tone="ok">Active</Tag>
                          ) : (
                            <Tag tone="warn">Inactive</Tag>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEdit(m)}
                              className="text-[12px] font-medium text-saffron-deep hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <span className="text-line-strong">|</span>
                            <button
                              onClick={() => setDeactivatingManager(m)}
                              className={`text-[12px] font-medium hover:underline cursor-pointer ${
                                m.status === "Active"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-forest"
                              }`}
                            >
                              {m.status === "Active" ? "Deactivate" : "Activate"}
                            </button>
                            <span className="text-line-strong">|</span>
                            <button
                              onClick={() => setDeletingManager(m)}
                              className="text-[12px] font-medium text-ink-faint hover:text-danger hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {filteredManagers.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-ink-faint text-[13px]"
                      >
                        No Gosala managers match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-line bg-card/30 text-[12px] text-ink-faint flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>
            Operations Admin Governance: 1 Gaushala maps to 1 local Custodian Manager. In case of manager absence, the Operations Admin holds Acting Custodian authority to prevent booking stalls.
          </span>
          <span className="font-mono text-[11px] text-saffron shrink-0">
            {activeManagersCount} active custodians · {unassignedSheltersCount} acting admin
          </span>
        </div>
      </Panel>

      {/* ------------------------------------------------------------------------- */}
      {/* MODAL 1: REASSIGN GOSALA CUSTODIAN                                       */}
      {/* ------------------------------------------------------------------------- */}
      {reassigningGosala && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setReassigningGosala(null)}
          />
          <div className="relative w-full max-w-md bg-card rounded-lg shadow-2xl border border-line p-6 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between pb-3.5 border-b border-line">
              <div>
                <Eyebrow>1:1 Assignment Governance</Eyebrow>
                <h3 className="font-serif text-[18px] text-ink mt-0.5">
                  Assign Custodian Manager
                </h3>
              </div>
              <button
                onClick={() => setReassigningGosala(null)}
                className="text-ink-faint hover:text-ink p-1 rounded-sm hover:bg-paper-deep cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3.5 bg-paper rounded-md border border-line text-[12.5px] space-y-1">
                <div className="font-bold text-ink text-[14px]">
                  {reassigningGosala.name}
                </div>
                <div className="text-[11.5px] text-ink-faint flex items-center gap-1.5">
                  <MapPin size={12} className="text-saffron" />
                  <span>{reassigningGosala.region}</span>
                  <span>·</span>
                  <span>AWBI: {reassigningGosala.trustRegistrationNo || "Verified"}</span>
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                  Select Custodian Manager *
                </label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="w-full bg-paper border border-line rounded-md px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                >
                  <option value="UNASSIGNED">
                    ⚠️ Leave Unassigned (Admin Acts as Custodian)
                  </option>
                  {scopedManagers.map((m) => {
                    const managerGosalas = getManagerAssignedGosalas(m)
                    const isCurrentlyHere = managerGosalas.some(
                      (gn) =>
                        gn.toLowerCase() === reassigningGosala.name.toLowerCase(),
                    )
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id}) · {managerGosalas.length} facility(ies) managed{" "}
                        {isCurrentlyHere ? "· [Already Assigned Here]" : ""} ({m.status})
                      </option>
                    )
                  })}
                </select>
                <p className="text-[11.5px] text-ink-faint mt-2 leading-relaxed">
                  Assigning a manager to this facility adds it to their management portfolio without removing their other Gaushalas.
                </p>
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReassigningGosala(null)}
                  className="px-4 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper-deep transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReassignment}
                  className="bg-saffron text-white px-5 py-2 text-[12.5px] font-semibold rounded-md hover:bg-saffron-deep transition-colors cursor-pointer shadow-xs"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* MODAL 2: ADD / EDIT MANAGER                                              */}
      {/* ------------------------------------------------------------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-lg bg-card rounded-lg shadow-2xl border border-line p-6 overflow-hidden animate-fade-in max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3.5 border-b border-line shrink-0">
              <div>
                <Eyebrow>Manager Administration</Eyebrow>
                <h3 className="font-serif text-[19px] font-bold text-ink mt-0.5">
                  {editingManager
                    ? "Edit Gosala Custodian Manager"
                    : "Add New Gosala Custodian Manager"}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-ink-faint hover:text-ink p-1 rounded-sm hover:bg-paper-deep cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1">
                  Manager Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Gajanan Kale"
                  className="w-full bg-paper border border-line rounded-md px-3.5 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-semibold text-ink mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98230 00000"
                    className="w-full bg-paper border border-line rounded-md px-3.5 py-2 text-[13px] font-mono text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-semibold text-ink mb-1">
                    Official Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="manager@gosala.org"
                    className="w-full bg-paper border border-line rounded-md px-3.5 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12.5px] font-semibold text-ink">
                    Assign Gaushalas to this Manager *
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormSelectedGosalas(scopedGosalas.map((g) => g.name))
                      }
                      className="text-forest hover:underline font-semibold cursor-pointer"
                    >
                      Select All ({scopedGosalas.length})
                    </button>
                    <span className="text-line-strong">·</span>
                    <button
                      type="button"
                      onClick={() => setFormSelectedGosalas([])}
                      className="text-ink-faint hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search inside Gaushalas list */}
                {scopedGosalas.length > 4 && (
                  <div className="mb-2 relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="text"
                      value={gosalaSearchFilter}
                      onChange={(e) => setGosalaSearchFilter(e.target.value)}
                      placeholder="Filter Gaushalas..."
                      className="w-full pl-8 pr-2.5 py-1 text-[12px] bg-paper border border-line rounded text-ink outline-none"
                    />
                  </div>
                )}

                <div className="border border-line rounded-md p-2.5 max-h-48 overflow-y-auto space-y-1.5 bg-paper">
                  {scopedGosalas.length === 0 ? (
                    <div className="text-center py-4 text-[12px] text-ink-faint">
                      No Gaushalas in your administered portfolio.
                    </div>
                  ) : (
                    scopedGosalas
                      .filter((g) =>
                        g.name.toLowerCase().includes(gosalaSearchFilter.toLowerCase()),
                      )
                      .map((g) => {
                        const isSelected = formSelectedGosalas.some(
                          (gn) => gn.toLowerCase() === g.name.toLowerCase(),
                        )
                        const cowsInG = animals.filter(
                          (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
                        ).length

                        return (
                          <label
                            key={g.id}
                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition ${
                              isSelected
                                ? "bg-forest-soft/70 border border-forest/30"
                                : "hover:bg-paper-deep border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormSelectedGosalas((prev) => [
                                      ...prev,
                                      g.name,
                                    ])
                                  } else {
                                    setFormSelectedGosalas((prev) =>
                                      prev.filter(
                                        (name) =>
                                          name.toLowerCase() !==
                                          g.name.toLowerCase(),
                                      ),
                                    )
                                  }
                                }}
                                className="rounded border-line text-forest focus:ring-forest h-4 w-4"
                              />
                              <div className="min-w-0">
                                <div className="text-[12.5px] font-medium text-ink truncate">
                                  {g.name}
                                </div>
                                <div className="text-[10.5px] text-ink-faint flex items-center gap-1.5">
                                  <MapPin size={10} className="text-saffron shrink-0" />
                                  <span>{g.region}</span>
                                </div>
                              </div>
                            </div>
                            <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-paper-deep text-ink-soft shrink-0 ml-2">
                              {cowsInG} cows
                            </span>
                          </label>
                        )
                      })
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-faint px-1">
                  <span>
                    <strong>{formSelectedGosalas.length}</strong> Gaushala
                    {formSelectedGosalas.length === 1 ? "" : "s"} assigned
                  </span>
                  <span>
                    Total herd:{" "}
                    <strong className="text-forest">
                      {
                        animals.filter((a) =>
                          formSelectedGosalas.some(
                            (gn) => gn.toLowerCase() === a.gosala.toLowerCase(),
                          ),
                        ).length
                      }
                    </strong>{" "}
                    cows
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1">
                  Primary Operational Region / Zone
                </label>
                <input
                  type="text"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  placeholder="e.g. Cyberabad / Gachibowli Zone"
                  className="w-full bg-paper border border-line rounded-md px-3.5 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-[13px] text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper-deep transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-forest text-white px-5 py-2 text-[13px] font-semibold rounded-md hover:bg-forest-deep transition-colors cursor-pointer shadow-xs"
                >
                  {editingManager ? "Save Manager Changes" : "Create Manager Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* MODAL 3: CONFIRM DEACTIVATION / ACTIVATION                                */}
      {/* ------------------------------------------------------------------------- */}
      {deactivatingManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setDeactivatingManager(null)}
          />
          <div className="relative w-full max-w-md bg-card rounded-lg shadow-2xl border border-line p-6 overflow-hidden">
            {/* Header with tone indicator */}
            <div className="flex items-start gap-3 pb-4 border-b border-line">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  deactivatingManager.status === "Active"
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
              >
                {deactivatingManager.status === "Active" ? (
                  <AlertTriangle size={20} />
                ) : (
                  <UserCheck size={20} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-[18px] font-bold text-ink leading-snug">
                  {deactivatingManager.status === "Active"
                    ? "Confirm Manager Deactivation"
                    : "Reactivate Custodian Manager"}
                </h3>
                <p className="text-[12px] text-ink-soft mt-0.5">
                  Review the operational impact before changing custodian status.
                </p>
              </div>
              <button
                onClick={() => setDeactivatingManager(null)}
                className="text-ink-faint hover:text-ink p-1 rounded hover:bg-paper-deep cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Manager Details Dossier */}
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-paper rounded-lg border border-line space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-saffron-soft text-saffron-deep font-bold flex items-center justify-center text-[13px] shrink-0">
                    {deactivatingManager.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-ink">
                      {deactivatingManager.name}
                    </div>
                    <div className="text-[11.5px] font-mono text-ink-faint">
                      ID: {deactivatingManager.id} · {deactivatingManager.region}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px] pt-2 border-t border-line/70">
                  <div>
                    <span className="text-ink-faint text-[10.5px] block font-mono uppercase">Phone</span>
                    <span className="font-mono text-ink">{deactivatingManager.phone}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint text-[10.5px] block font-mono uppercase">Current Status</span>
                    <span className="font-semibold text-ink">{deactivatingManager.status}</span>
                  </div>
                </div>

                {/* Assigned Gaushalas */}
                <div className="pt-2 border-t border-line/70">
                  <span className="text-ink-faint text-[10.5px] block font-mono uppercase mb-1">
                    Assigned Gaushalas Under Custody:
                  </span>
                  {getManagerAssignedGosalas(deactivatingManager).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getManagerAssignedGosalas(deactivatingManager).map((gn) => (
                        <span
                          key={gn}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-forest-soft text-forest border border-forest/20"
                        >
                          <Building2 size={10} />
                          <span>{gn}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11.5px] text-amber-700 font-mono">
                      ⚠️ No active Gaushalas assigned
                    </span>
                  )}
                </div>
              </div>

              {/* Safeguard Warning */}
              {deactivatingManager.status === "Active" ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-[12px] text-amber-900 dark:text-amber-300 leading-relaxed flex items-start gap-2">
                  <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Acting Custodian Handover: </strong>
                    Deactivating this manager will immediately suspend their authority to triage darshan requests. Regional Operations Admin will automatically assume emergency Acting Custodian triage.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-[12px] text-emerald-900 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
                  <Check size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Restoring Authority: </strong>
                    Reactivating this manager will restore their login access and custody over their assigned Gaushala sanctuary.
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeactivatingManager(null)}
                  className="px-4 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper-deep transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmToggleStatus}
                  className={`px-5 py-2 text-[12.5px] font-semibold rounded-md text-white transition cursor-pointer shadow-xs ${
                    deactivatingManager.status === "Active"
                      ? "bg-amber-700 hover:bg-amber-800"
                      : "bg-forest hover:bg-forest-deep"
                  }`}
                >
                  {deactivatingManager.status === "Active"
                    ? "Yes, Deactivate Manager"
                    : "Reactivate Manager"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* MODAL 4: CONFIRM PERMANENT DELETION                                      */}
      {/* ------------------------------------------------------------------------- */}
      {deletingManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setDeletingManager(null)}
          />
          <div className="relative w-full max-w-md bg-card rounded-lg shadow-2xl border-2 border-red-500/40 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-line">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-[18px] font-bold text-ink leading-snug">
                  Confirm Permanent Deletion
                </h3>
                <p className="text-[12px] text-red-600 font-medium mt-0.5">
                  ⚠️ Irreversible Action: This manager profile will be permanently deleted.
                </p>
              </div>
              <button
                onClick={() => setDeletingManager(null)}
                className="text-ink-faint hover:text-ink p-1 rounded hover:bg-paper-deep cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Manager Dossier to be deleted */}
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-red-50/50 border border-red-200 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-200 text-red-900 font-bold flex items-center justify-center text-[13px] shrink-0">
                    {deletingManager.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-ink">
                      {deletingManager.name}
                    </div>
                    <div className="text-[11.5px] font-mono text-ink-faint">
                      ID: {deletingManager.id} · {deletingManager.email}
                    </div>
                  </div>
                </div>

                <div className="text-[12px] pt-2 border-t border-red-200 space-y-1">
                  <div className="text-ink-soft">
                    <strong>Phone:</strong> {deletingManager.phone}
                  </div>
                  <div className="text-ink-soft">
                    <strong>Assigned Gaushalas: </strong>
                    {getManagerAssignedGosalas(deletingManager).length > 0 ? (
                      <span className="text-red-700 font-semibold">
                        {getManagerAssignedGosalas(deletingManager).join(", ")} (Will become Unassigned)
                      </span>
                    ) : (
                      <span className="text-ink-faint">None</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-paper border border-line rounded-md text-[12px] text-ink-soft leading-relaxed">
                Deleting this record will unassign any associated shelters and immediately transfer all pending ceremony verifications to <strong>Regional Operations Admin</strong> triage.
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingManager(null)}
                  className="px-4 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper-deep transition cursor-pointer"
                >
                  Cancel &amp; Keep Manager
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition cursor-pointer shadow-xs"
                >
                  <Trash2 size={14} />
                  <span>Permanently Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ---------------- REGISTER GAUSHALA MODAL (FULL-SCREEN PORTAL) ---------------- */}
      {showAddGosalaModal && (
        <div className="fixed inset-0 z-50 bg-paper text-ink overflow-y-auto flex flex-col animate-fade-in">
          {/* Top Sticky Enterprise Command Header */}
          <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-line px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-md bg-saffron-soft text-saffron-deep flex items-center justify-center shrink-0 border border-saffron/20 shadow-2xs">
                <Building2 size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-saffron-deep font-semibold">
                    GOMAA Gaushala Trust Governance
                  </span>
                  <span className="text-ink-faint text-[11px]">•</span>
                  <span className="font-mono text-[10.5px] text-ink-faint">
                    Central Onboarding Portal
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-ok-soft text-ok border border-ok/30 font-medium">
                    <ShieldCheck size={11} /> AWBI Section 38 Verification Ready
                  </span>
                </div>
                <h1 className="font-serif text-[19px] sm:text-[22px] text-ink font-bold truncate tracking-tight">
                  Register Sacred Gaushala Sanctuary Premise
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddGosalaModal(false)}
                className="px-3.5 py-1.5 rounded-md border border-line text-[12.5px] font-medium text-ink-soft hover:text-ink hover:bg-paper transition cursor-pointer"
              >
                Cancel / Exit
              </button>
              <button
                type="button"
                onClick={handleRegisterGosala}
                className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-md bg-saffron hover:bg-saffron-deep text-white text-[13px] font-semibold transition shadow-xs cursor-pointer"
              >
                <Building2 size={15} />
                <span>Confirm &amp; Register Sanctuary</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddGosalaModal(false)}
                className="h-9 w-9 rounded-md text-ink-faint hover:text-ink hover:bg-paper grid place-items-center transition cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <form onSubmit={handleRegisterGosala} className="flex-1 flex flex-col">
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
              {/* Top Banner Notice */}
              <div className="p-4 rounded-lg bg-saffron-soft/30 border border-saffron/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-ink">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-saffron text-white grid place-items-center shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-ink">
                      Accredited Sacred Cattle Sanctuary Onboarding
                    </div>
                    <div className="text-[12px] text-ink-soft mt-0.5">
                      Enter verified legal credentials, physical address, and assigned custodian to activate live booking serviceability.
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (7 cols): Legal Identity & Physical Premises */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-saffron-deep" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          1. Sanctuary Legal Identity &amp; Trust Accreditation
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                        Mandatory
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Official Gaushala / Trust Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={gFormName}
                          onChange={(e) => setGFormName(e.target.value)}
                          placeholder="e.g. Govardhan Goseva Trust &amp; Research Sanctuary"
                          className="w-full bg-paper border border-line rounded-md px-3.5 py-2.5 text-[14px] text-ink font-medium outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Operational Hub / City *
                          </label>
                          <select
                            onChange={(e) => handleRegionSelect(e.target.value)}
                            className="w-full bg-paper border border-line rounded-md px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition cursor-pointer"
                          >
                            {INDIAN_REGIONAL_HUBS.map((hub) => (
                              <option key={hub.id} value={hub.id}>
                                {hub.city} — {hub.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Trust Registration / AWBI #
                          </label>
                          <input
                            type="text"
                            value={gFormTrustNo}
                            onChange={(e) => setGFormTrustNo(e.target.value)}
                            placeholder="e.g. AWBI-TR-8421"
                            className="w-full bg-paper border border-line rounded-md px-3 py-2.5 text-[13px] text-ink font-mono outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Physical Premises Address &amp; Pincode *
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={gFormAddress}
                          onChange={(e) => setGFormAddress(e.target.value)}
                          placeholder="Full street address, main road, landmark, city, state and 6-digit pincode"
                          className="w-full bg-paper border border-line rounded-md px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition resize-none leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Trust Contact Phone *
                          </label>
                          <input
                            type="tel"
                            required
                            value={gFormPhone}
                            onChange={(e) => setGFormPhone(e.target.value)}
                            className="w-full bg-paper border border-line rounded-md px-3 py-2.5 text-[13px] text-ink font-mono outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Official Email
                          </label>
                          <input
                            type="email"
                            value={gFormEmail}
                            onChange={(e) => setGFormEmail(e.target.value)}
                            className="w-full bg-paper border border-line rounded-md px-3 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Herd Capacity, Coordinates & Management */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-saffron-deep" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          2. Herd Capacity &amp; Custodian Management
                        </h2>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Herd Capacity (Cattle)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={gFormCapacity}
                            onChange={(e) => setGFormCapacity(e.target.value)}
                            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[14px] text-ink font-semibold outline-none focus:border-saffron transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Lead Caretaker Name
                          </label>
                          <input
                            type="text"
                            value={gFormCaretaker}
                            onChange={(e) => setGFormCaretaker(e.target.value)}
                            placeholder="Chief Gosevak"
                            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Assigned Custodian Manager
                        </label>
                        <select
                          value={gFormManagerId}
                          onChange={(e) => setGFormManagerId(e.target.value)}
                          className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition cursor-pointer"
                        >
                          <option value="">None (Operations Admin Acting)</option>
                          {scopedManagers
                            .filter((m) => m.status === "Active")
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.region})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="pt-2 border-t border-line">
                        <MapLocationPicker
                          key="admin-register-gosala-map"
                          initialLat={gFormLat}
                          initialLng={gFormLng}
                          initialAddress={gFormAddress}
                          initialRegion={gFormRegion}
                          onChange={({ lat, lng, address, suggestedRegion }) => {
                            setGFormLat(lat)
                            setGFormLng(lng)
                            if (address && !gFormAddress) {
                              setGFormAddress(address)
                            }
                            if (suggestedRegion) {
                              setGFormRegion(suggestedRegion)
                            }
                          }}
                          label="Gaushala Premise Map Pinpoint & Coordinates *"
                          helperText="Pinpoint the exact shelter location on the map, search any landmark/town, or jump to any Indian region."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                            Latitude (Lat)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={gFormLat}
                            onChange={(e) => setGFormLat(parseFloat(e.target.value) || 0)}
                            className="w-full bg-paper border border-line rounded px-3 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-saffron"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                            Longitude (Lng)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={gFormLng}
                            onChange={(e) => setGFormLng(parseFloat(e.target.value) || 0)}
                            className="w-full bg-paper border border-line rounded px-3 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-saffron"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-paper border border-line rounded-md text-[11.5px] text-ink-soft leading-relaxed flex items-center gap-2">
                        <Sparkles size={14} className="text-saffron-deep shrink-0" />
                        <span>
                          Coordinates are automatically synchronized with the chosen regional hub for live doorstep distance calculations.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Sticky Action Footer */}
            <footer className="sticky bottom-0 z-30 bg-card/95 backdrop-blur-md border-t border-line px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3 text-[12px] text-ink-soft">
                <span className="font-semibold text-ink">
                  {gFormName.trim() || "New Gaushala Sanctuary"}
                </span>
                <span>•</span>
                <span className="font-mono text-ink-faint">{gFormRegion}</span>
                <span>•</span>
                <span className="font-mono text-saffron-deep font-medium">
                  Capacity: {gFormCapacity} Cattle
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddGosalaModal(false)}
                  className="px-4 py-2 text-[12.5px] font-medium text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper transition cursor-pointer"
                >
                  Cancel &amp; Discard
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-6 py-2 text-[13px] font-bold rounded-md bg-saffron hover:bg-saffron-deep text-white shadow-xs transition cursor-pointer"
                >
                  <Building2 size={16} />
                  <span>Confirm &amp; Register Sanctuary</span>
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </div>
  )
}
