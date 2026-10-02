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
} from "lucide-react"
import type { GosalaManager } from "../data/mock"
import { useStore, useToast, type Gosala } from "../store/store"
import { Eyebrow, Panel, PanelHead, Tag } from "../lib/ui"

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
  } = useStore()
  const { notify } = useToast()

  const [activeTab, setActiveTab] = useState<"matrix" | "managers">("matrix")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<"All" | "Active" | "Inactive">("All")
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingManager, setEditingManager] = useState<GosalaManager | null>(null)
  
  // Reassign Modal
  const [reassigningGosala, setReassigningGosala] = useState<Gosala | null>(null)
  const [selectedManagerId, setSelectedManagerId] = useState<string>("")

  // Form state
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formSelectedGosalas, setFormSelectedGosalas] = useState<string[]>([])
  const [formRegion, setFormRegion] = useState("Operational Hub")

  const handleOpenAdd = () => {
    setEditingManager(null)
    setFormName("")
    setFormEmail("")
    setFormPhone("+91 98")
    setFormRegion("Operational Hub")
    setFormSelectedGosalas(gosalas.length > 0 ? [gosalas[0].name] : [])
    setShowAddModal(true)
  }

  const handleOpenEdit = (mgr: GosalaManager) => {
    setEditingManager(mgr)
    setFormName(mgr.name)
    setFormEmail(mgr.email)
    setFormPhone(mgr.phone)
    setFormRegion(mgr.region || "Operational Hub")
    const existing =
      mgr.gosalas && mgr.gosalas.length > 0
        ? mgr.gosalas
        : mgr.gosala && mgr.gosala !== "Unassigned"
        ? [mgr.gosala]
        : []
    setFormSelectedGosalas(existing)
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
    }
  }

  const handleOpenReassign = (g: Gosala) => {
    setReassigningGosala(g)
    // Find current manager ID if any
    const cur = managers.find(
      (m) =>
        (m.gosalas &&
          m.gosalas.some((gn) => gn.toLowerCase() === g.name.toLowerCase())) ||
        m.gosala?.toLowerCase() === g.name.toLowerCase() ||
        m.id === g.managerId,
    )
    setSelectedManagerId(cur ? cur.id : "UNASSIGNED")
  }

  const handleSaveReassignment = () => {
    if (!reassigningGosala) return

    if (selectedManagerId === "UNASSIGNED") {
      // Find all managers assigned to this Gaushala and remove this Gaushala from their list
      const assignedMgrs = managers.filter(
        (m) =>
          (m.gosalas &&
            m.gosalas.some(
              (gn) => gn.toLowerCase() === reassigningGosala.name.toLowerCase(),
            )) ||
          m.gosala?.toLowerCase() === reassigningGosala.name.toLowerCase() ||
          m.id === reassigningGosala.managerId,
      )
      for (const mgr of assignedMgrs) {
        const currentList =
          mgr.gosalas && mgr.gosalas.length > 0 ? mgr.gosalas : [mgr.gosala]
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
        // Multi-Gaushala: Add this Gaushala to chosen manager's list (do NOT remove other Gaushalas!)
        const currentList =
          chosen.gosalas && chosen.gosalas.length > 0
            ? chosen.gosalas
            : chosen.gosala && chosen.gosala !== "Unassigned"
            ? [chosen.gosala]
            : []
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

  // Filtered managers for tab 2
  const filteredManagers = managers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      (m.gosala && m.gosala.toLowerCase().includes(query.toLowerCase())) ||
      (m.gosalas &&
        m.gosalas.some((g) => g.toLowerCase().includes(query.toLowerCase()))) ||
      m.region.toLowerCase().includes(query.toLowerCase()) ||
      m.id.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === "All" || m.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Mapping calculation
  const matrixData = useMemo(() => {
    return gosalas.map((g) => {
      // Find all assigned active managers
      const assignedActive = managers.filter(
        (m) =>
          m.status === "Active" &&
          ((m.gosalas &&
            m.gosalas.some(
              (gn) => gn.toLowerCase() === g.name.toLowerCase(),
            )) ||
            m.gosala?.toLowerCase() === g.name.toLowerCase() ||
            m.id === g.managerId),
      )
      const assignedInactive = managers.filter(
        (m) =>
          m.status === "Inactive" &&
          ((m.gosalas &&
            m.gosalas.some(
              (gn) => gn.toLowerCase() === g.name.toLowerCase(),
            )) ||
            m.gosala?.toLowerCase() === g.name.toLowerCase() ||
            m.id === g.managerId),
      )

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
        activeManager: assignedActive[0] || null,
        isOrphan: assignedActive.length === 0,
        animalsCount: shelterAnimals.length,
        pendingBookingsCount: shelterPendingBookings,
      }
    })
  }, [gosalas, managers, animals, bookings])

  const totalGosalas = gosalas.length
  const activeManagersCount = managers.filter((m) => m.status === "Active").length
  const unassignedSheltersCount = matrixData.filter((m) => m.isOrphan).length
  const totalSupervisedCows = animals.length

  return (
    <div className="space-y-6">
      {/* Top Operations Admin Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Registered Gaushalas",
            val: String(totalGosalas),
            sub: "Physical Pune facilities in network",
            icon: Building2,
            tone: "text-forest",
          },
          {
            label: "1:1 Custodian Managers",
            val: String(activeManagersCount),
            sub: "Active local site custodians",
            icon: UserCheck,
            tone: "text-saffron-deep",
          },
          {
            label: "Admin Acting Coverage",
            val: String(unassignedSheltersCount),
            sub: unassignedSheltersCount > 0 ? "⚠️ Shelters under direct Admin triage" : "Zero unassigned shelters",
            icon: ShieldAlert,
            tone: unassignedSheltersCount > 0 ? "text-amber-600" : "text-ok",
          },
          {
            label: "Network Cattle Registered",
            val: String(totalSupervisedCows),
            sub: "Active sacred cattle roster",
            icon: Users,
            tone: "text-ink",
          },
        ].map((k) => (
          <Panel key={k.label} className="p-4 sm:p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
                {k.label}
              </span>
              <k.icon size={16} className={k.tone} />
            </div>
            <div className="font-serif text-[28px] text-ink mt-2 leading-none">
              {k.val}
            </div>
            <div className="text-[12px] text-ink-faint mt-1.5">{k.sub}</div>
          </Panel>
        ))}
      </div>

      {/* Main Governance View with Tabs */}
      <Panel>
        <div className="p-4 sm:p-5 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60">
          <div>
            <div className="flex items-center gap-2">
              <Eyebrow>Operations Admin Oversight</Eyebrow>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-forest-soft text-forest font-semibold">
                Network Tier 1 Authority
              </span>
            </div>
            <h2 className="font-serif text-[20px] text-ink mt-0.5">
              Gaushala Network & Custodian Matrix
            </h2>
            <p className="text-[12.5px] text-ink-faint mt-0.5">
              Strict 1:1 Gaushala-Manager linkage · If unassigned, Operations Admin acts as Custodian for feasibility triage
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* View Switcher Tabs */}
            <div className="inline-flex rounded-sm p-1 bg-paper border border-line">
              <button
                onClick={() => setActiveTab("matrix")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-xs transition-colors ${
                  activeTab === "matrix"
                    ? "bg-saffron text-white shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <Building2 size={14} />
                <span>Gaushala Matrix ({totalGosalas})</span>
              </button>
              <button
                onClick={() => setActiveTab("managers")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-xs transition-colors ${
                  activeTab === "managers"
                    ? "bg-saffron text-white shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <Users size={14} />
                <span>Manager Roster ({managers.length})</span>
              </button>
            </div>

            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 bg-forest text-white rounded-sm px-3.5 py-2 text-[12.5px] font-medium hover:bg-forest-deep transition-colors shadow-xs"
            >
              <Plus size={15} />
              <span>Add Manager</span>
            </button>
          </div>
        </div>

        {/* TAB 1: GAUSHALA-MANAGER 1:1 ASSIGNMENT MATRIX */}
        {activeTab === "matrix" && (
          <div className="divide-y divide-line">
            <div className="p-4 bg-paper/60 border-b border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12.5px]">
              <div className="flex items-center gap-2 text-ink-soft">
                <ShieldCheck size={16} className="text-forest shrink-0" />
                <span>
                  <strong>1 Gaushala = 1 Custodian Rule:</strong> Each physical shelter has one verified local custodian. Unassigned shelters automatically route feasibility reviews to the Operations Admin.
                </span>
              </div>
              {unassignedSheltersCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-semibold shrink-0">
                  <AlertTriangle size={12} /> {unassignedSheltersCount} Acting Admin Shelter{unassignedSheltersCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[880px]">
                <thead>
                  <tr className="border-b border-line bg-card/40">
                    {[
                      "Physical Gaushala & AWBI",
                      "Location & Capacity",
                      "Cattle Supervised",
                      "1:1 Assigned Custodian",
                      "Operational Status",
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
                  {matrixData.map(({ gosala, activeManagers, inactiveManagers, isOrphan, animalsCount, pendingBookingsCount }) => (
                    <tr
                      key={gosala.id}
                      className="border-b border-line/70 hover:bg-paper/70 transition-colors"
                    >
                      {/* Gaushala & AWBI */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-sm bg-forest-soft text-forest flex items-center justify-center font-serif font-bold text-[14px] shrink-0 border border-forest/20">
                            {gosala.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[13px] font-medium text-ink leading-snug">
                              {gosala.name}
                            </div>
                            <div className="font-mono text-[11px] text-ink-faint flex items-center gap-1.5 mt-0.5">
                              <span>AWBI: {gosala.trustRegistrationNo}</span>
                              <span className="text-line-strong">·</span>
                              <span>Est. {gosala.establishedYear}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Region & Capacity */}
                      <td className="px-4 py-3.5">
                        <div className="text-[12.5px] text-ink flex items-center gap-1">
                          <MapPin size={12} className="text-saffron shrink-0" />
                          <span className="truncate">{gosala.region}</span>
                        </div>
                        <div className="text-[11px] text-ink-faint mt-0.5">
                          Capacity: {gosala.capacity} cows ({gosala.facilities?.length || 2} verified facilities)
                        </div>
                      </td>

                      {/* Cattle Supervised */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12.5px] text-ink font-semibold bg-paper-deep px-2 py-0.5 rounded-sm border border-line">
                            {animalsCount} cattle
                          </span>
                          {pendingBookingsCount > 0 && (
                            <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-saffron-soft text-saffron-deep font-bold">
                              {pendingBookingsCount} queue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assigned Manager(s) */}
                      <td className="px-4 py-3.5">
                        {activeManagers.length > 0 ? (
                          <div className="space-y-1.5">
                            {activeManagers.map((mgr) => (
                              <div key={mgr.id} className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-saffron text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                                  {mgr.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[12px] font-medium text-ink leading-tight truncate">
                                    {mgr.name}
                                  </div>
                                  <div className="font-mono text-[10px] text-ink-faint truncate">
                                    {mgr.phone}
                                  </div>
                                </div>
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

                      {/* Operational Status */}
                      <td className="px-4 py-3.5">
                        {activeManagers.length > 0 ? (
                          <Tag tone="ok">
                            {activeManagers.length > 1
                              ? `${activeManagers.length} Managers Assigned`
                              : "Staffed"}
                          </Tag>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20">
                            Admin Acting
                          </span>
                        )}
                      </td>

                      {/* Triage Authority */}
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

                      {/* Actions */}
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
                  ))}
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
                    className={`rounded-sm px-2.5 py-1 text-[11.5px] font-mono transition-colors ${
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
                    const managerGosalas =
                      m.gosalas && m.gosalas.length > 0
                        ? m.gosalas
                        : m.gosala && m.gosala !== "Unassigned"
                        ? [m.gosala]
                        : []
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
                            <div className="h-8 w-8 rounded-full bg-saffron-soft text-saffron-deep font-medium flex items-center justify-center text-[12px] shrink-0">
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
                                {managerGosalas.length} facility{managerGosalas.length > 1 ? "s" : ""} under management
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
                        {m.assignedDate}
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
                            className="text-[12px] font-medium text-saffron-deep hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-line-strong">|</span>
                          <button
                            onClick={() => toggleManagerStatus(m.id)}
                            className={`text-[12px] font-medium hover:underline ${
                              m.status === "Active" ? "text-danger" : "text-forest"
                            }`}
                          >
                            {m.status === "Active" ? "Deactivate" : "Activate"}
                          </button>
                          <span className="text-line-strong">|</span>
                          <button
                            onClick={() => deleteManager(m.id)}
                            className="text-[12px] font-medium text-ink-faint hover:text-danger hover:underline"
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

      {/* Reassign Manager Modal */}
      {reassigningGosala && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setReassigningGosala(null)}
          />
          <div className="relative w-full max-w-md bg-card rounded-md shadow-2xl border border-line p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3.5 border-b border-line">
              <div>
                <Eyebrow>1:1 Assignment Governance</Eyebrow>
                <h3 className="font-serif text-[18px] text-ink mt-0.5">
                  Assign Custodian Manager
                </h3>
              </div>
              <button
                onClick={() => setReassigningGosala(null)}
                className="text-ink-faint hover:text-ink p-1 rounded-sm hover:bg-paper-deep"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-paper rounded border border-line text-[12.5px]">
                <div className="font-medium text-ink">{reassigningGosala.name}</div>
                <div className="text-[11.5px] text-ink-faint mt-0.5 flex items-center gap-1">
                  <MapPin size={11} className="text-saffron" />
                  <span>{reassigningGosala.region}</span> · AWBI: {reassigningGosala.trustRegistrationNo}
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Select Custodian Manager *
                </label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                >
                  <option value="UNASSIGNED">
                    ⚠️ Leave Unassigned (Admin Acts as Custodian)
                  </option>
                  {managers.map((m) => {
                    const managerGosalas =
                      m.gosalas && m.gosalas.length > 0
                        ? m.gosalas
                        : m.gosala && m.gosala !== "Unassigned"
                        ? [m.gosala]
                        : []
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
                <p className="text-[11.5px] text-ink-faint mt-1.5 leading-relaxed">
                  Assigning a manager to this facility adds it to their management portfolio without removing their other Gaushalas. When the manager logs in, they can select and manage this facility independently with zero cross-data mixing.
                </p>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReassigningGosala(null)}
                  className="px-3.5 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded-sm hover:bg-paper-deep transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReassignment}
                  className="bg-saffron text-white px-4 py-2 text-[12.5px] font-medium rounded-sm hover:bg-saffron-deep transition-colors"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Manager Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-lg bg-card rounded-md shadow-2xl border border-line p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div>
                <Eyebrow>Manager Administration</Eyebrow>
                <h3 className="font-serif text-[19px] text-ink mt-0.5">
                  {editingManager
                    ? "Edit Gosala Manager"
                    : "Add New Gosala Manager"}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-ink-faint hover:text-ink p-1 rounded-sm hover:bg-paper-deep"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-ink-soft mb-1">
                  Manager Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dnyaneshwar Jadhav"
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-ink-soft mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98230 00000"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] font-mono text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-ink-soft mb-1">
                    Official Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="manager@gosala.org"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12.5px] font-medium text-ink">
                    Assign Gaushalas to this Manager *
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormSelectedGosalas(gosalas.map((g) => g.name))
                      }
                      className="text-forest hover:underline font-medium cursor-pointer"
                    >
                      Select All ({gosalas.length})
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

                <div className="border border-line rounded-md p-2.5 max-h-52 overflow-y-auto space-y-1.5 bg-paper">
                  {gosalas.length === 0 ? (
                    <div className="text-center py-4 text-[12px] text-ink-faint">
                      No Gaushalas registered yet. Please register Gaushalas first.
                    </div>
                  ) : (
                    gosalas.map((g) => {
                      const isSelected = formSelectedGosalas.some(
                        (gn) => gn.toLowerCase() === g.name.toLowerCase(),
                      )
                      const cowsInG = animals.filter(
                        (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
                      ).length

                      return (
                        <label
                          key={g.id}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
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
                                <span>·</span>
                                <span>AWBI: {g.trustRegistrationNo || "VERIFIED"}</span>
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

                {/* Assignment Summary strip */}
                <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-faint px-1">
                  <span>
                    <strong>{formSelectedGosalas.length}</strong> Gaushala
                    {formSelectedGosalas.length === 1 ? "" : "s"} assigned
                  </span>
                  <span>
                    Total herd:{" "}
                    <strong>
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
                <label className="block text-[12.5px] font-medium text-ink-soft mb-1">
                  Primary Operational Region
                </label>
                <input
                  type="text"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  placeholder="e.g. Pune Western Zone"
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                />
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-[13px] text-ink-soft hover:text-ink border border-line rounded-sm hover:bg-paper-deep transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-saffron text-white px-4 py-2 text-[13px] font-medium rounded-sm hover:bg-saffron-deep transition-colors"
                >
                  {editingManager ? "Save Changes" : "Assign Manager"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
