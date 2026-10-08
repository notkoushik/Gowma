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
  Truck,
  HeartHandshake,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Key,
  RefreshCw,
  MessageSquare,
} from "lucide-react"
import type { GosalaManager } from "../data/mock"
import { useStore, useToast, type Gosala } from "../store/store"
import { Eyebrow, Panel, PanelHead, Tag } from "../lib/ui"
import { INDIAN_REGIONAL_HUBS } from "../data/regions"
import MapLocationPicker from "../components/MapLocationPicker"

export type CredentialShareInfo = {
  name: string
  role: string
  roleLabel: string
  email: string
  phone: string
  password: string
  assignedScope?: string
  region?: string
}

function generateRandomPassword(prefix = "Gomaa") {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"
  let randomStr = ""
  for (let i = 0; i < 4; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}@${randomStr}${Math.floor(10 + Math.random() * 90)}!`
}

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
    users,
    addUser,
    updateUser,
    deleteUser,
    refreshUsers,
  } = useStore()
  const { notify } = useToast()

  const activeAdminName = authUser?.name || profiles?.admin?.name || "Operations Admin"
  const activeSuperAdminName = authUser?.name || profiles?.super_admin?.name || "Koushik"

  const registeredOperationsAdmins = useMemo(() => {
    return users.filter(
      (u) => u.role === "admin" || (u as any).dbRole === "OPERATIONS_ADMIN",
    )
  }, [users])

  const [activeTab, setActiveTab] = useState<"matrix" | "managers" | "users">("matrix")
  const [query, setQuery] = useState("")
  const [userQuery, setUserQuery] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("All")
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPhone, setNewUserPhone] = useState("+91 ")
  const [newUserPassword, setNewUserPassword] = useState("User@Gomaa2026!")
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [newUserRole, setNewUserRole] = useState<"customer" | "driver" | "manager" | "admin">("customer")
  const [newUserAddress, setNewUserAddress] = useState("")
  const [newUserVehiclePlate, setNewUserVehiclePlate] = useState("TS-09-")
  const [newUserLicense, setNewUserLicense] = useState("DL-")
  const [newUserGosala, setNewUserGosala] = useState(gosalas[0]?.name || "Surya")
  const [statusFilter, setStatusFilter] =
    useState<"All" | "Active" | "Inactive">("All")
  const [portfolioScope, setPortfolioScope] = useState<"my_portfolio" | "all_network">("my_portfolio")
  const [adminPortfolioFilter, setAdminPortfolioFilter] = useState<string>("All")

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingManager, setEditingManager] = useState<GosalaManager | null>(null)

  // Share Credentials Modal state
  const [shareCredentials, setShareCredentials] = useState<CredentialShareInfo | null>(null)
  const [copiedSuccess, setCopiedSuccess] = useState(false)
  const [showSharePassword, setShowSharePassword] = useState(false)

  const copyCredentialsToClipboard = (info: CredentialShareInfo) => {
    const portalUrl = window.location.origin
    const lines = [
      `════════════════════════════════════════`,
      `🕉️ GOMAA PLATFORM - ACCESS CREDENTIALS`,
      `════════════════════════════════════════`,
      `Role:      ${info.roleLabel}`,
      `Name:      ${info.name}`,
      `Email:     ${info.email}`,
      `Phone:     ${info.phone || "N/A"}`,
      `Password:  ${info.password}`,
      ...(info.assignedScope ? [`Scope:     ${info.assignedScope}`] : []),
      ...(info.region ? [`Region:    ${info.region}`] : []),
      `Portal:    ${portalUrl}`,
      `════════════════════════════════════════`,
      `Instructions: Please visit ${portalUrl}, click Login, and sign in with this email and password.`,
    ]
    const text = lines.join("\n")
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedSuccess(true)
        notify("Credentials copied to clipboard! Ready to share.", "ok")
        setTimeout(() => setCopiedSuccess(false), 3000)
      }).catch(() => {
        notify("Credentials ready to copy.", "ok")
      })
    } else {
      notify("Credentials ready to copy.", "ok")
    }
  }

  const getWhatsAppShareUrl = (info: CredentialShareInfo) => {
    const portalUrl = window.location.origin
    const lines = [
      `🕉️ *GOMAA PLATFORM - ACCESS CREDENTIALS*`,
      `*Role:* ${info.roleLabel}`,
      `*Name:* ${info.name}`,
      `*Email:* ${info.email}`,
      `*Password:* ${info.password}`,
      ...(info.assignedScope ? [`*Scope:* ${info.assignedScope}`] : []),
      ...(info.region ? [`*Region:* ${info.region}`] : []),
      `*Portal:* ${portalUrl}`,
      ``,
      `Please visit the portal and sign in with the email and password above.`,
    ]
    const text = lines.join("\n")
    const cleanPhone = (info.phone || "").replace(/[^0-9]/g, "")
    if (cleanPhone && cleanPhone.length >= 10) {
      const intlPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
      return `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`
    }
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

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
  const [formPassword, setFormPassword] = useState("Mgr@Gomaa2026!")
  const [showFormPassword, setShowFormPassword] = useState(false)
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
  const [gFormActAsManager, setGFormActAsManager] = useState(false)
  const [gFormGoverningAdminEmail, setGFormGoverningAdminEmail] = useState("")
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
    setFormPassword(generateRandomPassword("Mgr"))
    setShowFormPassword(false)
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
    setFormPassword(mgr.password || "")
    setShowFormPassword(false)
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
    const passwordToSave = formPassword.trim() || generateRandomPassword("Mgr")

    if (editingManager) {
      updateManager(editingManager.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        password: passwordToSave,
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
        password: passwordToSave,
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

      // Open credentials sharing card for admin to copy & dispatch
      setShareCredentials({
        name: formName.trim(),
        role: "manager",
        roleLabel: "Gaushala Manager",
        email: formEmail.trim(),
        phone: formPhone.trim(),
        password: passwordToSave,
        assignedScope:
          formSelectedGosalas.length > 0
            ? formSelectedGosalas.join(", ")
            : "Unassigned",
        region: formRegion,
      })
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

  const handleTakeOverAsActing = (g: Gosala) => {
    const callerName = currentRole === "super_admin" ? activeSuperAdminName : activeAdminName
    // Remove g from all managers' assigned list
    const assignedMgrs = managers.filter((m) => {
      const gList = getManagerAssignedGosalas(m)
      return (
        gList.some((gn) => gn.toLowerCase() === g.name.toLowerCase()) ||
        m.id === g.managerId
      )
    })
    for (const mgr of assignedMgrs) {
      const currentList = getManagerAssignedGosalas(mgr)
      const nextList = currentList.filter(
        (x) => x.toLowerCase() !== g.name.toLowerCase(),
      )
      updateManager(mgr.id, {
        gosalas: nextList,
        gosala: nextList[0] || "Unassigned",
        status: nextList.length === 0 ? "Inactive" : mgr.status,
      })
    }
    updateGosala(g.id, {
      managerId: "",
      managerName: `${callerName} (Acting Manager)`,
      caretaker: `${callerName} (Acting Custodian)`,
      isActingManager: true,
      actAsManagerMyself: true,
    } as any)
    notify(
      `You (${callerName}) have taken over as Acting Manager for ${g.name}.`,
      "ok",
    )
  }

  const handleSaveReassignment = () => {
    if (!reassigningGosala) return

    if (selectedManagerId === "ACTING_ADMIN") {
      handleTakeOverAsActing(reassigningGosala)
    } else if (selectedManagerId === "UNASSIGNED") {
      const callerName = currentRole === "super_admin" ? activeSuperAdminName : activeAdminName
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
        managerName: "None (Admin Custody)",
        caretaker: `${callerName} (Admin Custodian)`,
        isActingManager: true,
        actAsManagerMyself: true,
      } as any)
      notify(
        `${reassigningGosala.name} is now unassigned. Operations Admin will act as Custodian.`,
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
          caretaker: chosen.name,
          isActingManager: false,
          actAsManagerMyself: false,
        } as any)
        notify(
          `Assigned ${chosen.name} as Manager for ${reassigningGosala.name}. (${nextList.length} Gaushala${nextList.length > 1 ? "s" : ""} managed by ${chosen.name})`,
          "ok",
        )
      }
    }
    setReassigningGosala(null)
  }

  // Multi-Tenant Isolation Scope:
  // - Operations Admin: Show ONLY Gaushalas & Managers under active admin's isolated regional administration!
  // - Super Admin: Platform overseer with complete visibility across all Operations Admins and Gaushalas, with portfolio filtering.
  const scopedGosalas = useMemo(() => {
    if (currentRole === "admin") {
      const adminEmail = (authUser?.email || "").toLowerCase()
      const adminName = (authUser?.name || activeAdminName || "").toLowerCase()

      return gosalas.filter((g: any) => {
        const emailMatch = g.governingAdminEmail && g.governingAdminEmail.toLowerCase() === adminEmail
        const nameMatch = g.governingAdminName && g.governingAdminName.toLowerCase().includes(adminName)
        const admNameMatch = g.adminName && g.adminName.toLowerCase().includes(adminName)
        const listMatch = authUser?.gosalaNames && authUser.gosalaNames.some((gn: string) => g.name.toLowerCase() === gn.toLowerCase())
        return emailMatch || nameMatch || admNameMatch || listMatch || (!g.governingAdminEmail && g.governingAdminRole !== "super_admin")
      })
    }
    if (currentRole === "super_admin") {
      if (adminPortfolioFilter === "All") {
        return gosalas
      }
      return gosalas.filter((g: any) => {
        const govName = g.governingAdminName || g.adminName || ""
        return govName.toLowerCase() === adminPortfolioFilter.toLowerCase()
      })
    }
    return gosalas
  }, [gosalas, currentRole, adminPortfolioFilter, activeAdminName, authUser])

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
    if (currentRole === "super_admin" && adminPortfolioFilter !== "All") {
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
  }, [managers, scopedGosalas, currentRole, adminPortfolioFilter])

  // Comprehensive active managers list for Gaushala appointing (combines managers roster & users directory)
  const availableManagersForAppointing = useMemo(() => {
    const list: Array<{
      id: string
      name: string
      email?: string
      phone?: string
      region?: string
      gosalas?: string[]
      status?: string
    }> = []

    const seen = new Set<string>()

    // 1. From scoped managers
    scopedManagers.forEach((m) => {
      const assigned = getManagerAssignedGosalas(m)
      const key = (m.email || m.id || m.name).toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        list.push({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          region: m.region,
          gosalas: assigned,
          status: m.status || "Active",
        })
      }
    })

    // 2. From users directory who have manager role
    users.forEach((u) => {
      if (u.role === "manager" || (u as any).dbRole === "GOSALA_MANAGER") {
        const key = (u.email || u.id || u.name).toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          list.push({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            region: (u as any).region || "Assigned Hub",
            gosalas: (u as any).assignedGosalaNames || [],
            status: "Active",
          })
        }
      }
    })

    return list
  }, [scopedManagers, users])

  const openRegisterGosalaModal = () => {
    setGFormActAsManager(false)
    if (availableManagersForAppointing.length > 0) {
      setGFormManagerId(availableManagersForAppointing[0].id)
    }
    setGFormGoverningAdminEmail(adminPortfolioFilter !== "All" ? adminPortfolioFilter : "")
    setShowAddGosalaModal(true)
  }

  const handleRegisterGosala = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gFormName.trim() || !gFormAddress.trim()) {
      notify("Please provide Gaushala name and physical address", "danger")
      return
    }
    const isActing = gFormActAsManager || !gFormManagerId
    const chosenMgr = !isActing
      ? availableManagersForAppointing.find((m) => m.id === gFormManagerId)
      : null

    let governingAdminRole: "super_admin" | "admin" = "admin"
    let governingAdminName = activeAdminName
    let governingAdminEmail = authUser?.email || "admin@gomaa.in"

    if (currentRole === "super_admin") {
      if (!gFormGoverningAdminEmail || gFormGoverningAdminEmail === "super_admin" || gFormGoverningAdminEmail === authUser?.email) {
        governingAdminRole = "super_admin"
        governingAdminName = activeSuperAdminName
        governingAdminEmail = authUser?.email || "superadmin@gomaa.in"
      } else {
        const selectedOpsAdmin = registeredOperationsAdmins.find(
          (a) => a.email.toLowerCase() === gFormGoverningAdminEmail.toLowerCase() || a.name.toLowerCase() === gFormGoverningAdminEmail.toLowerCase() || a.id === gFormGoverningAdminEmail
        )
        if (selectedOpsAdmin) {
          governingAdminRole = "admin"
          governingAdminName = selectedOpsAdmin.name
          governingAdminEmail = selectedOpsAdmin.email
        }
      }
    }

    const newG = addGosala({
      name: gFormName.trim(),
      region: gFormRegion,
      address: gFormAddress.trim(),
      contactPhone: gFormPhone.trim(),
      email: gFormEmail.trim(),
      trustRegistrationNo: gFormTrustNo.trim() || `AWBI-TR-${Math.floor(1000 + Math.random() * 8999)}`,
      capacity: Number(gFormCapacity) || 40,
      caretaker: isActing ? `${governingAdminName} (Acting Custodian)` : gFormCaretaker.trim() || chosenMgr?.name || "Chief Gosevak",
      managerId: isActing ? "" : (chosenMgr ? chosenMgr.id : ""),
      managerName: isActing ? `${governingAdminName} (Acting Manager)` : (chosenMgr ? chosenMgr.name : "None (Admin Acting)"),
      isActingManager: isActing,
      actAsManagerMyself: isActing,
      lat: gFormLat,
      lng: gFormLng,
      status: "Active",
      establishedYear: "2024",
      facilities: [
        "Padded Cattle Ambulance / Van",
        "24/7 Pure Borewell Water & Trough",
      ],
      photo: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
      governingAdminRole,
      governingAdminName,
      governingAdminEmail,
    } as any)

    if (chosenMgr && !isActing) {
      const existing = chosenMgr.gosalas || []
      updateManager(chosenMgr.id, {
        gosalas: Array.from(new Set([...existing, newG.name])),
        gosala: existing[0] || newG.name,
      })
    }
    setShowAddGosalaModal(false)
    setGFormName("")
    setGFormAddress("")
    notify(
      `Gaushala "${newG.name}" registered successfully! (${
        isActing
          ? `Admin ${governingAdminName} Acting as Manager`
          : `Assigned to Manager ${chosenMgr?.name} under ${governingAdminName}'s Portfolio`
      })`,
      "ok"
    )
  }

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
                  ? adminPortfolioFilter === "All"
                    ? "Consolidated Platform Governance (All Portfolios)"
                    : `${adminPortfolioFilter} Portfolio`
                  : `${activeAdminName} (Operations Admin Hub)`}
              </span>
            </div>
            <p className="text-[11.5px] text-ink-faint">
              {currentRole === "super_admin"
                ? "Sovereign platform audit: Review all sanctuaries, managers, and operational portfolios or filter by specific Operations Admin."
                : `Managing ${scopedGosalas.length} operational shelter(s) and assigned custodians under ${activeAdminName}. You may appoint managers or act as manager yourself.`}
            </p>
          </div>
        </div>

        {currentRole === "super_admin" ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <select
              value={adminPortfolioFilter}
              onChange={(e) => setAdminPortfolioFilter(e.target.value)}
              className="w-full sm:w-auto bg-paper border border-amber-300 rounded px-2.5 py-2 sm:py-1.5 text-[12px] text-ink font-medium outline-none focus:border-amber-500 transition shadow-2xs"
            >
              <option value="All">All Operations Portfolios ({gosalas.length} Sanctuaries)</option>
              {registeredOperationsAdmins.map((adm) => {
                const count = gosalas.filter(
                  (g) =>
                    g.governingAdminName === adm.name ||
                    g.adminName === adm.name ||
                    g.adminId === adm.id ||
                    (g as any).governingAdminEmail === adm.email,
                ).length
                return (
                  <option key={adm.id} value={adm.name}>
                    {adm.name} ({count})
                  </option>
                )
              })}
            </select>
            <button
              type="button"
              onClick={() => {
                setNewUserName("")
                setNewUserEmail("")
                setNewUserPhone("+91 ")
                setNewUserRole("admin")
                setNewUserPassword(generateRandomPassword("OpsAdmin"))
                setShowNewUserPassword(false)
                setShowAddUserModal(true)
              }}
              className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-[12px] font-semibold px-3 py-2 sm:py-1.5 rounded transition shadow-xs cursor-pointer w-full sm:w-auto whitespace-nowrap"
            >
              <Plus size={13} />
              <span>Register Operations Admin</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-forest-soft text-forest px-2.5 py-1 rounded border border-forest/20 font-semibold">
              <ShieldCheck size={13} /> Strict Portfolio Isolation
            </span>
          </div>
        )}
      </div>

      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-card border border-line rounded-md p-3.5 sm:p-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10.5px] sm:text-[11px] text-ink-faint uppercase">
              Registered Gaushalas
            </div>
            <div className="font-serif text-[22px] sm:text-[24px] font-bold text-ink mt-0.5">
              {scopedGosalas.length}
            </div>
          </div>
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-forest-soft text-forest flex items-center justify-center shrink-0">
            <Building2 size={18} />
          </div>
        </div>

        <div className="bg-card border border-line rounded-md p-3.5 sm:p-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10.5px] sm:text-[11px] text-ink-faint uppercase">
              Active Custodian Managers
            </div>
            <div className="font-serif text-[22px] sm:text-[24px] font-bold text-ink mt-0.5">
              {activeManagersCount}
            </div>
          </div>
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-saffron-soft text-saffron-deep flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-card border border-line rounded-md p-3.5 sm:p-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10.5px] sm:text-[11px] text-ink-faint uppercase">
              Unassigned / Admin Acting
            </div>
            <div className="font-serif text-[22px] sm:text-[24px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
              {unassignedSheltersCount}
            </div>
          </div>
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} />
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <Panel>
        <div className="p-3.5 sm:p-5 border-b border-line space-y-3.5">
          {/* Header Title + Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <Eyebrow>Operations &amp; Custodian Governance</Eyebrow>
              <h2 className="font-serif text-[18px] sm:text-[20px] text-ink mt-0.5 font-semibold">
                Gaushala Custodians &amp; Acting Matrix
              </h2>
            </div>

            {/* Persistent Action Bar - Clean responsive grid on mobile, row on desktop */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full lg:w-auto">
              {/* Register Gaushala Button */}
              <button
                type="button"
                onClick={openRegisterGosalaModal}
                className="inline-flex items-center justify-center gap-1.5 h-9 bg-saffron hover:bg-saffron-deep text-white text-[12px] sm:text-[12.5px] font-medium px-3 sm:px-3.5 rounded-sm transition shadow-xs cursor-pointer whitespace-nowrap"
                title="Register a new Gaushala sanctuary"
              >
                <Building2 size={14} className="shrink-0" />
                <span>Register Gaushala</span>
              </button>

              {/* Add Manager Button */}
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center justify-center gap-1.5 h-9 bg-forest hover:bg-forest-deep text-white text-[12px] sm:text-[12.5px] font-medium px-3 sm:px-3.5 rounded-sm transition shadow-xs cursor-pointer whitespace-nowrap"
                title="Add a new Gaushala custodian manager"
              >
                <Plus size={14} className="shrink-0" />
                <span>Add Manager</span>
              </button>

              {/* Add Platform User Button (spans 2 cols on mobile) */}
              <button
                type="button"
                onClick={() => {
                  setNewUserName("")
                  setNewUserEmail("")
                  setNewUserPhone("+91 ")
                  setNewUserRole("customer")
                  setNewUserPassword(generateRandomPassword("User"))
                  setShowNewUserPassword(false)
                  setNewUserAddress("")
                  setShowAddUserModal(true)
                }}
                className={`col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 h-9 text-[12px] sm:text-[12.5px] font-medium px-3 sm:px-3.5 rounded-sm transition shadow-xs cursor-pointer whitespace-nowrap ${
                  activeTab === "users"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-paper hover:bg-paper-deep text-ink border border-line"
                }`}
                title="Authorize a new devotee, driver, or user"
              >
                <Plus size={14} className="shrink-0" />
                <span>Add User / Role</span>
              </button>
            </div>
          </div>

          {/* Tab Selector - Scrollable pill bar on mobile, seamless on desktop */}
          <div className="w-full overflow-x-auto no-scrollbar pt-0.5">
            <div className="bg-paper border border-line rounded-sm p-0.5 inline-flex items-center min-w-full sm:min-w-0 sm:w-fit">
              <button
                onClick={() => setActiveTab("matrix")}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-[11.5px] sm:text-[12px] font-mono rounded-sm transition cursor-pointer whitespace-nowrap ${
                  activeTab === "matrix"
                    ? "bg-saffron text-white font-medium shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                Assignment Matrix
              </button>
              <button
                onClick={() => setActiveTab("managers")}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-[11.5px] sm:text-[12px] font-mono rounded-sm transition cursor-pointer whitespace-nowrap ${
                  activeTab === "managers"
                    ? "bg-saffron text-white font-medium shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                Managers ({scopedManagers.length})
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-[11.5px] sm:text-[12px] font-mono rounded-sm transition cursor-pointer whitespace-nowrap ${
                  activeTab === "users"
                    ? "bg-saffron text-white font-medium shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                All Users &amp; Roles ({users.length})
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: ASSIGNMENT MATRIX */}
        {activeTab === "matrix" && (
          <div>
            {/* Mobile Card View (md:hidden) */}
            <div className="md:hidden divide-y divide-line">
              {matrixData.map(
                ({
                  gosala,
                  activeManagers,
                  inactiveManagers,
                  animalsCount,
                }) => (
                  <div key={gosala.id} className="p-3.5 space-y-2.5 hover:bg-paper/50 transition">
                    {/* Top Row: Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-[13.5px] text-ink leading-snug">
                          {gosala.name}
                        </div>
                        <div className="text-[11.5px] text-ink-faint flex items-center gap-1.5 mt-0.5">
                          <MapPin size={11} className="text-saffron shrink-0" />
                          <span>{gosala.region}</span>
                          <span>·</span>
                          <span className="font-medium text-ink-soft">{animalsCount} cows</span>
                        </div>
                      </div>
                      {activeManagers.length > 0 ? (
                        <Tag tone="ok">
                          {activeManagers.length > 1 ? `${activeManagers.length} Staffed` : "Staffed"}
                        </Tag>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20 shrink-0">
                          Admin Acting
                        </span>
                      )}
                    </div>

                    {/* Custodian Box */}
                    <div className="bg-card/70 border border-line rounded p-2.5 text-[12px]">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
                        Assigned Custodian
                      </div>
                      {activeManagers.length > 0 ? (
                        <div className="space-y-1.5">
                          {activeManagers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-forest-soft text-forest text-[10.5px] font-semibold flex items-center justify-center shrink-0">
                                  {m.name.slice(0, 1)}
                                </div>
                                <span className="font-medium text-ink">{m.name}</span>
                              </div>
                              <span className="font-mono text-[10.5px] text-ink-faint">({m.id})</span>
                            </div>
                          ))}
                        </div>
                      ) : inactiveManagers.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-[11.5px] text-ink-faint line-through">
                            {inactiveManagers[0].name} (Inactive)
                          </div>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                            <AlertTriangle size={10} /> Unassigned · Inactive Manager
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-mono text-[11px] font-medium">
                          <ShieldAlert size={13} className="shrink-0 text-amber-600" />
                          <span>Direct Operations Admin In-Charge</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2 pt-0.5">
                      {activeManagers.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleTakeOverAsActing(gosala)}
                            className="flex-1 inline-flex items-center justify-center gap-1 text-[11.5px] font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 py-2 px-2.5 rounded border border-amber-500/30 transition shadow-2xs cursor-pointer"
                          >
                            <ShieldCheck size={13} className="text-amber-600 shrink-0" />
                            <span>Act as Manager</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReassign(gosala)}
                            className="flex-1 inline-flex items-center justify-center gap-1 text-[11.5px] font-medium text-saffron-deep bg-saffron-soft/60 hover:bg-saffron-soft py-2 px-2.5 rounded border border-saffron/30 transition cursor-pointer"
                          >
                            <ArrowRightLeft size={13} className="shrink-0" />
                            <span>Reassign</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenReassign(gosala)}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold bg-saffron text-white hover:bg-saffron-deep py-2.5 px-3 rounded shadow-xs transition cursor-pointer"
                        >
                          <Plus size={14} className="shrink-0" />
                          <span>Appoint Sanctuary Manager</span>
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}

              {matrixData.length === 0 && (
                <div className="py-12 px-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200 mb-2">
                    <Building2 size={20} />
                  </div>
                  <div className="font-serif text-[15px] font-medium text-ink">No Gaushalas Registered</div>
                  <p className="text-[12px] text-ink-faint mt-1">Click &quot;Register Gaushala&quot; above to add one.</p>
                </div>
              )}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {activeManagers.length > 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleTakeOverAsActing(gosala)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded border border-amber-500/30 transition-colors cursor-pointer shadow-2xs"
                                  title="Directly take over and manage this Gaushala as Operations Admin"
                                >
                                  <ShieldCheck size={12} className="text-amber-600" />
                                  <span>Act as Manager</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReassign(gosala)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-saffron-deep hover:text-saffron px-2.5 py-1 rounded border border-saffron/30 hover:bg-saffron-soft transition-colors cursor-pointer"
                                >
                                  <ArrowRightLeft size={12} />
                                  <span>Reassign</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-forest bg-forest-soft px-2 py-0.5 rounded border border-forest/20">
                                  <Check size={11} /> Admin In-Charge
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReassign(gosala)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-saffron text-white hover:bg-saffron-deep px-2.5 py-1 rounded transition-colors cursor-pointer shadow-2xs"
                                >
                                  <Plus size={12} />
                                  <span>Appoint Manager</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                  {matrixData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-14 text-center">
                        <div className="max-w-md mx-auto space-y-2">
                          <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
                            <Building2 size={24} />
                          </div>
                          <div className="font-serif text-[17px] text-ink font-medium">
                            No Gaushalas Registered Yet
                          </div>
                          <p className="text-[12.5px] text-ink-faint leading-relaxed">
                            The platform sanctuary registry is completely clean. Click &quot;Register Gaushala&quot; above to register your first accredited sanctuary and test assignment workflows from scratch.
                          </p>
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={openRegisterGosalaModal}
                              className="inline-flex items-center gap-1.5 bg-saffron hover:bg-saffron-deep text-white text-[12px] font-medium px-4 py-2 rounded transition shadow-xs cursor-pointer"
                            >
                              <Plus size={13} />
                              <span>Register First Gaushala</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
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

            {/* Mobile Card View for Managers */}
            <div className="md:hidden divide-y divide-line">
              {filteredManagers.map((m) => {
                const managerGosalas = getManagerAssignedGosalas(m)
                const dynamicCowCount = animals.filter((a) =>
                  managerGosalas.some(
                    (gn) => gn.toLowerCase() === a.gosala.toLowerCase(),
                  ),
                ).length

                return (
                  <div key={m.id} className="p-3.5 space-y-2.5 hover:bg-paper/50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-saffron-soft text-saffron-deep font-semibold flex items-center justify-center text-[12px] shrink-0 border border-saffron/20">
                          {m.name
                            .split(" ")
                            .map((x) => x[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-[13.5px] text-ink leading-snug">
                            {m.name}
                          </div>
                          <div className="font-mono text-[10.5px] text-ink-faint">
                            {m.id} {m.region ? `· ${m.region}` : ""}
                          </div>
                        </div>
                      </div>
                      {m.status === "Active" ? (
                        <Tag tone="ok">Active</Tag>
                      ) : (
                        <Tag tone="warn">Inactive</Tag>
                      )}
                    </div>

                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1 flex items-center justify-between">
                        <span>Assigned Sanctuaries</span>
                        <span className="font-medium text-ink-soft">{dynamicCowCount} cows</span>
                      </div>
                      {managerGosalas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {managerGosalas.map((gn) => (
                            <span
                              key={gn}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-forest-soft text-forest border border-forest/20"
                            >
                              <Building2 size={10} className="shrink-0" />
                              <span>{gn}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-semibold">
                          ⚠️ Unassigned
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-soft bg-card/60 border border-line rounded px-2.5 py-1.5 font-mono">
                      <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-ink">
                        <Phone size={11} className="text-ink-faint shrink-0" />
                        <span>{m.phone}</span>
                      </a>
                      <span className="text-line-strong">·</span>
                      <span className="truncate max-w-[170px]">{m.email}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShareCredentials({
                            name: m.name,
                            role: "manager",
                            roleLabel: "Gaushala Manager",
                            email: m.email,
                            phone: m.phone,
                            password: m.password || "Mgr@Gomaa2026!",
                            assignedScope: m.gosalas?.join(", ") || m.gosala,
                            region: m.region,
                          })
                        }}
                        className="inline-flex items-center justify-center gap-1 py-1.5 px-1.5 bg-paper border border-line rounded text-[11px] font-medium text-forest hover:bg-paper-deep transition shadow-2xs"
                        title="View credentials"
                      >
                        <Key size={11} className="shrink-0" />
                        <span>Pass</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(m)}
                        className="inline-flex items-center justify-center gap-1 py-1.5 px-1.5 bg-paper border border-line rounded text-[11px] font-medium text-saffron-deep hover:bg-paper-deep transition shadow-2xs"
                      >
                        <Edit3 size={11} className="shrink-0" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeactivatingManager(m)}
                        className={`inline-flex items-center justify-center gap-1 py-1.5 px-1.5 bg-paper border border-line rounded text-[11px] font-medium transition shadow-2xs ${
                          m.status === "Active" ? "text-amber-700 hover:bg-amber-50" : "text-forest hover:bg-forest-soft"
                        }`}
                      >
                        <span>{m.status === "Active" ? "Pause" : "Resume"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingManager(m)}
                        className="inline-flex items-center justify-center gap-1 py-1.5 px-1.5 bg-paper border border-line rounded text-[11px] font-medium text-ink-faint hover:text-danger hover:bg-red-50 transition shadow-2xs"
                      >
                        <Trash2 size={11} className="shrink-0" />
                        <span>Del</span>
                      </button>
                    </div>
                  </div>
                )
              })}
              {filteredManagers.length === 0 && (
                <div className="px-4 py-8 text-center text-ink-faint text-[13px]">
                  No Gosala managers match your search criteria.
                </div>
              )}
            </div>

            {/* Desktop Managers Table */}
            <div className="hidden md:block overflow-x-auto">
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
                              onClick={() => {
                                setShareCredentials({
                                  name: m.name,
                                  role: "manager",
                                  roleLabel: "Gaushala Manager",
                                  email: m.email,
                                  phone: m.phone,
                                  password: m.password || "Mgr@Gomaa2026!",
                                  assignedScope: m.gosalas?.join(", ") || m.gosala,
                                  region: m.region,
                                })
                              }}
                              className="text-[12px] font-medium text-forest hover:underline flex items-center gap-1 cursor-pointer"
                              title="View & share sign-in credentials"
                            >
                              <Key size={12} />
                              <span>Credentials</span>
                            </button>
                            <span className="text-line-strong">|</span>
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

        {/* TAB 3: ALL PLATFORM USERS & JWT ACCESS CONTROL */}
        {activeTab === "users" && (
          <div>
            <div className="p-4 border-b border-line bg-card/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Search user name, email, or phone..."
                    className="w-full bg-paper border border-line rounded-sm pl-8 pr-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-[11.5px] text-ink-faint">Role:</span>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="bg-paper border border-line rounded-sm px-2.5 py-1 text-[12px] text-ink outline-none focus:border-saffron transition"
                >
                  <option value="All">All Roles</option>
                  <option value="customer">Devotees (Customers)</option>
                  <option value="driver">Transit Pilots (Drivers)</option>
                  <option value="manager">Gaushala Managers</option>
                  <option value="admin">Operations Admins</option>
                  <option value="super_admin">Super Admin Captains</option>
                </select>
              </div>
            </div>

            {/* Mobile Card View for Users & Roles */}
            <div className="md:hidden divide-y divide-line">
              {users
                .filter((u) => {
                  const matchesQuery =
                    !userQuery ||
                    u.name.toLowerCase().includes(userQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
                    u.phone.includes(userQuery)
                  const matchesRole =
                    userRoleFilter === "All" || u.role === userRoleFilter
                  return matchesQuery && matchesRole
                })
                .map((u) => {
                  const isSa = u.role === "super_admin"
                  const isAdm = u.role === "admin"
                  const isMgr = u.role === "manager"
                  const isDrv = u.role === "driver"
                  const isCust = u.role === "customer"

                  const roleBadge = isSa ? (
                    <span className="font-mono text-[10px] bg-amber-500/15 text-amber-800 border border-amber-500/30 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
                      <Crown size={10} /> Super Admin
                    </span>
                  ) : isAdm ? (
                    <span className="font-mono text-[10px] bg-forest/15 text-forest border border-forest/30 px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1">
                      <ShieldCheck size={10} /> Operations Admin
                    </span>
                  ) : isMgr ? (
                    <span className="font-mono text-[10px] bg-saffron-soft text-saffron-deep border border-saffron/30 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                      <Building2 size={10} /> Gaushala Manager
                    </span>
                  ) : isDrv ? (
                    <span className="font-mono text-[10px] bg-blue-500/15 text-blue-800 border border-blue-500/30 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                      <Truck size={10} /> Transit Pilot
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] bg-purple-500/15 text-purple-800 border border-purple-500/30 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                      <HeartHandshake size={10} /> Devotee
                    </span>
                  )

                  const boundScope = isMgr
                    ? u.assignedGosalaNames?.join(", ") || "General Roster"
                    : isDrv
                      ? `${u.driverData?.vehicleNumber || "Fleet Van"} (${u.driverData?.gosalaBase || "Regional"})`
                      : isCust
                        ? u.customerData?.address || "Devotee Altar"
                        : isSa
                          ? "Central Treasury & Sovereign Governance"
                          : "Regional Sanctuary Cluster"

                  return (
                    <div key={u.id} className="p-3.5 space-y-2.5 hover:bg-paper/50 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full bg-paper-deep text-ink flex items-center justify-center font-bold text-[12px] border border-line shrink-0">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[13.5px] text-ink leading-snug">
                              {u.name}
                            </div>
                            <div className="font-mono text-[10.5px] text-ink-faint">
                              {u.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                        {roleBadge}
                      </div>

                      <div className="bg-card/70 border border-line rounded px-2.5 py-1.5 text-[11.5px]">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                          JWT Scope / Facility
                        </div>
                        <div className="font-medium text-ink truncate mt-0.5" title={boundScope}>
                          {boundScope}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-soft font-mono">
                        <a href={`tel:${u.phone}`} className="flex items-center gap-1 hover:text-ink">
                          <Phone size={11} className="text-ink-faint shrink-0" />
                          <span>{u.phone}</span>
                        </a>
                        <span className="text-line-strong">·</span>
                        <span className="truncate max-w-[170px]">{u.email}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {u.isActive ? (
                          <Tag tone="ok">Active</Tag>
                        ) : (
                          <Tag tone="warn">Suspended</Tag>
                        )}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const roleLabelMap: Record<string, string> = {
                                customer: "Devotee (Customer)",
                                driver: "Transit Pilot (Driver)",
                                manager: "Gaushala Manager",
                                admin: "Operations Admin",
                                super_admin: "Super Admin",
                              }
                              setShareCredentials({
                                name: u.name,
                                role: u.role,
                                roleLabel: roleLabelMap[u.role] || u.role,
                                email: u.email,
                                phone: u.phone,
                                password:
                                  (u as any).password ||
                                  (u.email === "koushik@gmail.com"
                                    ? "Koushik.git"
                                    : "Gomaa@2026!"),
                                assignedScope: (u as any).assignedGosalaNames?.join(", "),
                              })
                            }}
                            className="inline-flex items-center gap-1 py-1 px-2.5 bg-paper border border-line rounded text-[11.5px] font-medium text-forest hover:bg-paper-deep transition shadow-2xs"
                          >
                            <Key size={11} />
                            <span>Pass</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                            className="inline-flex items-center gap-1 py-1 px-2.5 bg-paper border border-line rounded text-[11.5px] font-medium text-saffron-deep hover:bg-paper-deep transition shadow-2xs"
                          >
                            <span>{u.isActive ? "Suspend" : "Activate"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove user ${u.name}?`)) {
                                deleteUser(u.id)
                              }
                            }}
                            className="inline-flex items-center gap-1 py-1 px-2 bg-paper border border-line rounded text-[11.5px] font-medium text-ink-faint hover:text-danger hover:bg-red-50 transition shadow-2xs"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Desktop Users Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-line bg-card/60">
                    {[
                      "User Identity",
                      "Role & Authority",
                      "Contact Info",
                      "JWT Scope / Bound Facility",
                      "Status",
                      "Registered",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users
                    .filter((u) => {
                      const matchesQuery =
                        !userQuery ||
                        u.name.toLowerCase().includes(userQuery.toLowerCase()) ||
                        u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
                        u.phone.includes(userQuery)
                      const matchesRole =
                        userRoleFilter === "All" || u.role === userRoleFilter
                      return matchesQuery && matchesRole
                    })
                    .map((u) => {
                      const isSa = u.role === "super_admin"
                      const isAdm = u.role === "admin"
                      const isMgr = u.role === "manager"
                      const isDrv = u.role === "driver"
                      const isCust = u.role === "customer"

                      const roleBadge = isSa ? (
                        <span className="font-mono text-[10px] bg-amber-500/15 text-amber-800 border border-amber-500/30 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
                          <Crown size={10} /> Super Admin
                        </span>
                      ) : isAdm ? (
                        <span className="font-mono text-[10px] bg-forest/15 text-forest border border-forest/30 px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1">
                          <ShieldCheck size={10} /> Operations Admin
                        </span>
                      ) : isMgr ? (
                        <span className="font-mono text-[10px] bg-saffron-soft text-saffron-deep border border-saffron/30 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                          <Building2 size={10} /> Gaushala Manager
                        </span>
                      ) : isDrv ? (
                        <span className="font-mono text-[10px] bg-blue-500/15 text-blue-800 border border-blue-500/30 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                          <Truck size={10} /> Transit Pilot
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] bg-purple-500/15 text-purple-800 border border-purple-500/30 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                          <HeartHandshake size={10} /> Devotee
                        </span>
                      )

                      const boundScope = isMgr
                        ? u.assignedGosalaNames?.join(", ") || "General Roster"
                        : isDrv
                          ? `${u.driverData?.vehicleNumber || "Fleet Van"} (${u.driverData?.gosalaBase || "Regional"})`
                          : isCust
                            ? u.customerData?.address || "Devotee Altar"
                            : isSa
                              ? "Central Treasury & Sovereign Governance"
                              : "Regional Sanctuary Cluster"

                      return (
                        <tr key={u.id} className="hover:bg-card/40 transition">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-paper-deep text-ink flex items-center justify-center font-bold text-[12px] border border-line">
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-[13px] font-semibold text-ink">
                                  {u.name}
                                </div>
                                <div className="font-mono text-[10.5px] text-ink-faint">
                                  {u.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            {roleBadge}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="text-[12px] text-ink flex items-center gap-1.5">
                              <Phone size={11} className="text-ink-faint" />
                              <span className="font-mono">{u.phone}</span>
                            </div>
                            <div className="text-[11.5px] text-ink-faint flex items-center gap-1.5 mt-0.5">
                              <Mail size={11} className="text-ink-faint" />
                              <span>{u.email}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-[12px] text-ink">
                            <div className="max-w-[220px] truncate" title={boundScope}>
                              {boundScope}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            {u.isActive ? (
                              <Tag tone="ok">Active</Tag>
                            ) : (
                              <Tag tone="warn">Suspended</Tag>
                            )}
                          </td>

                          <td className="px-4 py-3.5 font-mono text-[11.5px] text-ink-faint">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { month: "short", day: "2-digit" }) : "Active"}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 text-[12px]">
                              <button
                                onClick={() => {
                                  const roleLabelMap: Record<string, string> = {
                                    customer: "Devotee (Customer)",
                                    driver: "Transit Pilot (Driver)",
                                    manager: "Gaushala Manager",
                                    admin: "Operations Admin",
                                    super_admin: "Super Admin",
                                  }
                                  setShareCredentials({
                                    name: u.name,
                                    role: u.role,
                                    roleLabel: roleLabelMap[u.role] || u.role,
                                    email: u.email,
                                    phone: u.phone,
                                    password:
                                      (u as any).password ||
                                      (u.email === "koushik@gmail.com"
                                        ? "Koushik.git"
                                        : "Gomaa@2026!"),
                                    assignedScope: (u as any).assignedGosalaNames?.join(", "),
                                  })
                                }}
                                className="text-forest hover:underline flex items-center gap-1 cursor-pointer font-medium"
                                title="View & share sign-in credentials"
                              >
                                <Key size={12} />
                                <span>Credentials</span>
                              </button>
                              <span className="text-line-strong">|</span>
                              <button
                                onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                                className="text-saffron-deep hover:underline cursor-pointer font-medium"
                              >
                                {u.isActive ? "Suspend" : "Activate"}
                              </button>
                              <span className="text-line-strong">|</span>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove user ${u.name}?`)) {
                                    deleteUser(u.id)
                                  }
                                }}
                                className="text-ink-faint hover:text-danger hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
                  <option value="ACTING_ADMIN">
                    🛡️ Act as Manager / Custodian Myself ({currentRole === "super_admin" ? activeSuperAdminName : activeAdminName})
                  </option>
                  <option value="UNASSIGNED">
                    ⚠️ Leave Unassigned (Admin Custody)
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

              <div className="p-3.5 bg-amber-500/5 rounded-lg border border-saffron/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12.5px] font-bold text-ink flex items-center gap-1.5">
                    <Lock size={14} className="text-saffron-deep" />
                    <span>Manager Login Password *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormPassword(generateRandomPassword("Mgr"))}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-saffron-deep hover:text-saffron bg-saffron-soft px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    <RefreshCw size={11} />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="e.g. Mgr@Gomaa2026!"
                    className="w-full bg-card border border-line rounded-md pl-3.5 pr-10 py-2 text-[13px] font-mono text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink p-1 cursor-pointer"
                    title={showFormPassword ? "Hide password" : "Show password"}
                  >
                    {showFormPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint leading-relaxed">
                  Set this manager's sign-in password. Upon saving, you will get a ready-to-share card with 1-click WhatsApp and clipboard copy.
                </p>
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

                      {currentRole === "super_admin" && (
                        <div className="p-3.5 bg-paper rounded-lg border border-amber-200/80 space-y-1.5 shadow-2xs">
                          <label className="block text-[12px] font-semibold text-ink flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-amber-600" />
                            <span>Governing Operations Admin Portfolio:</span>
                          </label>
                          <select
                            value={gFormGoverningAdminEmail}
                            onChange={(e) => setGFormGoverningAdminEmail(e.target.value)}
                            className="w-full bg-card border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-amber-500 transition cursor-pointer font-medium"
                          >
                            <option value="">
                              ★ Direct Super Admin Oversight ({activeSuperAdminName}) - Platform Managed
                            </option>
                            {registeredOperationsAdmins.map((adm) => (
                              <option key={adm.id} value={adm.email}>
                                🛡️ {adm.name} ({adm.email}) - Regional Operations Portfolio
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-ink-faint leading-relaxed">
                            Gaushalas assigned to an Operations Admin will be isolated to their regional dashboard, staff management, and bookings pipeline.
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-2">
                          Manager Appointment &amp; Sanctuary Supervision
                        </label>
                        <div className="space-y-2">
                          <label className={`p-3 rounded-md border flex items-start gap-2.5 cursor-pointer transition ${
                            !gFormActAsManager
                              ? "border-saffron bg-saffron-soft/40 ring-1 ring-saffron/30"
                              : "border-line bg-paper hover:border-line-strong"
                          }`}>
                            <input
                              type="radio"
                              name="managerGovernanceChoice"
                              checked={!gFormActAsManager}
                              onChange={() => {
                                setGFormActAsManager(false)
                                if (availableManagersForAppointing.length > 0 && !gFormManagerId) {
                                  setGFormManagerId(availableManagersForAppointing[0].id)
                                }
                              }}
                              className="mt-0.5 text-saffron focus:ring-saffron cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="font-semibold text-[12.5px] text-ink flex items-center gap-1.5">
                                <Building2 size={14} className="text-saffron-deep" />
                                <span>Appoint an Authorized Manager from Roster</span>
                              </div>
                              <p className="text-[11px] text-ink-faint mt-0.5 leading-relaxed">
                                Delegate day-to-day sanctuary supervision, devotee welcomes, and animal welfare to an authorized manager.
                              </p>
                            </div>
                          </label>

                          <label className={`p-3 rounded-md border flex items-start gap-2.5 cursor-pointer transition ${
                            gFormActAsManager
                              ? "border-forest bg-forest-soft/40 ring-1 ring-forest/30"
                              : "border-line bg-paper hover:border-line-strong"
                          }`}>
                            <input
                              type="radio"
                              name="managerGovernanceChoice"
                              checked={gFormActAsManager}
                              onChange={() => {
                                setGFormActAsManager(true)
                                setGFormManagerId("")
                              }}
                              className="mt-0.5 text-forest focus:ring-forest cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="font-semibold text-[12.5px] text-ink flex items-center gap-1.5">
                                <ShieldCheck size={14} className="text-forest" />
                                <span>I will act as Manager / Custodian myself ({currentRole === "super_admin" ? activeSuperAdminName : activeAdminName})</span>
                              </div>
                              <p className="text-[11px] text-ink-faint mt-0.5 leading-relaxed">
                                You retain direct operational management, booking triage, and cattle herd oversight for this sanctuary without appointing an external manager.
                              </p>
                            </div>
                          </label>
                        </div>

                        {!gFormActAsManager && (
                          <div className="mt-3 p-3 bg-paper rounded border border-line space-y-1.5">
                            <label className="block text-[11.5px] font-semibold text-ink flex items-center justify-between">
                              <span>Select Authorized Manager:</span>
                              <span className="text-[11px] text-forest font-medium">
                                {availableManagersForAppointing.length} manager{availableManagersForAppointing.length !== 1 ? "s" : ""} available
                              </span>
                            </label>
                            {availableManagersForAppointing.filter((m) => m.status === "Active" || !m.status).length > 0 ? (
                              <select
                                value={gFormManagerId}
                                onChange={(e) => setGFormManagerId(e.target.value)}
                                className="w-full bg-card border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition cursor-pointer font-medium"
                              >
                                {availableManagersForAppointing
                                  .filter((m) => m.status === "Active" || !m.status)
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} {m.email ? `(${m.email})` : ""} · {m.gosalas?.length || 0} facility(ies) · {m.region || "Hub"}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <div className="text-[12px] text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                                No active managers currently registered in your roster. You can add one using "+ Add Manager" above.
                              </div>
                            )}
                          </div>
                        )}
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
      {/* ------------------------------------------------------------------------- */}
      {/* MODAL 5: ADD PLATFORM USER (ROLE-BASED JWT)                               */}
      {/* ------------------------------------------------------------------------- */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowAddUserModal(false)}
          />
          <div className="relative w-full max-w-lg bg-card rounded-lg shadow-2xl border border-line p-6 overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-line">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-saffron-soft text-saffron-deep flex items-center justify-center font-bold">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-[17px] text-ink font-semibold">
                    Add Platform User
                  </h3>
                  <p className="text-[11.5px] text-ink-faint">
                    Authorize identity with cryptographic JWT role assignment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-ink-faint hover:text-ink p-1 rounded hover:bg-paper-deep transition"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const passwordToSave =
                  newUserPassword.trim() ||
                  generateRandomPassword(newUserRole === "admin" ? "OpsAdmin" : "User")
                const payload: any = {
                  name: newUserName.trim(),
                  email: newUserEmail.trim(),
                  phone: newUserPhone.trim(),
                  role: newUserRole,
                  password: passwordToSave,
                }
                if (newUserRole === "customer") {
                  payload.customerData = { address: newUserAddress }
                } else if (newUserRole === "driver") {
                  payload.driverData = {
                    vehicleNumber: newUserVehiclePlate,
                    licenseNumber: newUserLicense,
                    gosalaBase: newUserGosala,
                  }
                } else if (newUserRole === "manager") {
                  payload.gosalaName = newUserGosala
                }
                await addUser(payload)
                setShowAddUserModal(false)

                const roleLabelMap: Record<string, string> = {
                  customer: "Devotee (Customer)",
                  driver: "Transit Pilot (Driver)",
                  manager: "Gaushala Manager",
                  admin: "Operations Admin",
                  super_admin: "Super Admin",
                }

                setShareCredentials({
                  name: newUserName.trim(),
                  role: newUserRole,
                  roleLabel: roleLabelMap[newUserRole] || newUserRole,
                  email: newUserEmail.trim(),
                  phone: newUserPhone.trim(),
                  password: passwordToSave,
                  assignedScope:
                    newUserRole === "manager"
                      ? newUserGosala
                      : newUserRole === "driver"
                      ? `Base: ${newUserGosala} (${newUserVehiclePlate})`
                      : newUserRole === "customer"
                      ? newUserAddress || "Direct Devotee"
                      : "Regional Operations Admin",
                })

                setNewUserName("")
                setNewUserEmail("")
                setNewUserPhone("+91 ")
                setNewUserAddress("")
              }}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="text-[12px] font-medium text-ink-soft">
                  User Role
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { id: "customer", label: "Devotee", icon: HeartHandshake },
                    { id: "driver", label: "Transit Pilot", icon: Truck },
                    { id: "manager", label: "Gaushala Manager", icon: Building2 },
                    ...(currentRole === "super_admin"
                      ? [{ id: "admin", label: "Operations Admin", icon: ShieldCheck }]
                      : []),
                  ].map((r) => {
                    const active = newUserRole === r.id
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setNewUserRole(r.id as any)}
                        className={`p-2 rounded border text-left flex items-center gap-2 cursor-pointer transition ${
                          active
                            ? "border-saffron bg-saffron-soft/50 text-saffron-deep font-semibold"
                            : "border-line bg-paper text-ink hover:border-line-strong"
                        }`}
                      >
                        <r.icon size={14} />
                        <span className="text-[12px]">{r.label}</span>
                      </button>
                    )
                  })}
                </div>
                {currentRole !== "super_admin" ? (
                  <p className="text-[10.5px] text-ink-faint mt-1">
                    * Operations Admin accounts can only be provisioned by the Super Admin.
                  </p>
                ) : newUserRole === "admin" ? (
                  <div className="mt-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11.5px] text-ink-soft leading-relaxed flex items-start gap-2">
                    <ShieldCheck size={14} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-ink font-semibold">Super Admin Provisioning:</strong> This account will be authorized as a regional Operations Admin with their own portfolio of Gaushalas and managers.
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <label className="text-[12px] font-medium text-ink-soft">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Radhika Sharma"
                  className="mt-1 w-full bg-paper border border-line rounded px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[12px] font-medium text-ink-soft">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@gomaa.in"
                    className="mt-1 w-full bg-paper border border-line rounded px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-ink-soft">
                    Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="mt-1 w-full bg-paper border border-line rounded px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[12px] font-medium text-ink-soft flex items-center gap-1.5">
                    <Lock size={12} className="text-saffron-deep" />
                    <span>Account Sign-in Password *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewUserPassword(
                        generateRandomPassword(newUserRole === "admin" ? "OpsAdmin" : "User")
                      )
                    }
                    className="text-[10.5px] text-saffron-deep hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? "text" : "password"}
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Sign-in password for this account"
                    className="w-full bg-paper border border-line rounded pl-3 pr-9 py-1.5 text-[12.5px] font-mono text-ink outline-none focus:border-saffron transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink p-1 cursor-pointer"
                    title={showNewUserPassword ? "Hide password" : "Show password"}
                  >
                    {showNewUserPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[10.5px] text-ink-faint mt-1">
                  {newUserRole === "admin"
                    ? "Set the initial password for this Operations Admin. Once saved, you can copy the full credentials to share directly."
                    : "The user will sign in with their email and this password."}
                </p>
              </div>

              {newUserRole === "customer" && (
                <div>
                  <label className="text-[12px] font-medium text-ink-soft">
                    Devotee Address
                  </label>
                  <input
                    type="text"
                    value={newUserAddress}
                    onChange={(e) => setNewUserAddress(e.target.value)}
                    placeholder="Residential address in Hyderabad / Zone"
                    className="mt-1 w-full bg-paper border border-line rounded px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
              )}

              {newUserRole === "driver" && (
                <div className="space-y-2.5 p-3 bg-paper border border-line rounded">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-ink-faint">Vehicle Plate</label>
                      <input
                        type="text"
                        value={newUserVehiclePlate}
                        onChange={(e) => setNewUserVehiclePlate(e.target.value)}
                        placeholder="TS-09-UA-1088"
                        className="mt-0.5 w-full bg-card border border-line rounded px-2 py-1 text-[12px] text-ink outline-none focus:border-saffron"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-ink-faint">License No</label>
                      <input
                        type="text"
                        value={newUserLicense}
                        onChange={(e) => setNewUserLicense(e.target.value)}
                        placeholder="DL-142011009823"
                        className="mt-0.5 w-full bg-card border border-line rounded px-2 py-1 text-[12px] text-ink outline-none focus:border-saffron"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-faint">Home Gaushala Base</label>
                    <select
                      value={newUserGosala}
                      onChange={(e) => setNewUserGosala(e.target.value)}
                      className="mt-0.5 w-full bg-card border border-line rounded px-2 py-1 text-[12px] text-ink outline-none focus:border-saffron"
                    >
                      {gosalas.map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name} ({g.region})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {newUserRole === "manager" && (
                <div>
                  <label className="text-[12px] font-medium text-ink-soft">
                    Assigned Sanctuary
                  </label>
                  <select
                    value={newUserGosala}
                    onChange={(e) => setNewUserGosala(e.target.value)}
                    className="mt-1 w-full bg-paper border border-line rounded px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  >
                    {gosalas.map((g) => (
                      <option key={g.id} value={g.name}>
                        {g.name} ({g.region})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-line flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink border border-line rounded hover:bg-paper transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 text-[12.5px] font-bold bg-saffron hover:bg-saffron-deep text-white rounded transition shadow-xs cursor-pointer"
                >
                  Authorize &amp; Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* MODAL 6: SHARE ACCOUNT CREDENTIALS (INSTANT 1-CLICK CLIPBOARD SHARE)     */}
      {/* ------------------------------------------------------------------------- */}
      {shareCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setShareCredentials(null)}
          />
          <div className="relative w-full max-w-lg bg-card rounded-xl shadow-2xl border border-line p-6 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between pb-3.5 border-b border-line shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-saffron-soft text-saffron-deep flex items-center justify-center font-bold shrink-0">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-[18px] font-bold text-ink leading-tight">
                    Account Credentials Ready
                  </h3>
                  <p className="text-[11.5px] text-ink-faint">
                    Copy and share these credentials with {shareCredentials.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareCredentials(null)}
                className="text-ink-faint hover:text-ink p-1 rounded-sm hover:bg-paper-deep transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Highlight Status Banner */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="font-semibold">Account Authorized Successfully!</span>
                  <p className="text-[11px] text-ink-soft mt-0.5">
                    The user can immediately log in to the GOMAA platform using the email and password below.
                  </p>
                </div>
              </div>

              {/* Credentials Card */}
              <div className="rounded-lg border border-line bg-paper p-4 space-y-3 font-sans">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                    Assigned Role
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-saffron-soft text-saffron-deep border border-saffron/30">
                    <ShieldCheck size={12} />
                    {shareCredentials.roleLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-[12.5px]">
                  <div>
                    <div className="text-[11px] text-ink-faint mb-0.5">Account Holder Name</div>
                    <div className="font-semibold text-ink">{shareCredentials.name}</div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-ink-faint">Login Email Address</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(shareCredentials.email)
                          notify("Email copied to clipboard!", "ok")
                        }}
                        className="text-[11px] text-saffron-deep hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={11} />
                        <span>Copy Email</span>
                      </button>
                    </div>
                    <div className="font-mono bg-card px-3 py-1.5 rounded border border-line text-ink text-[13px] flex items-center justify-between">
                      <span>{shareCredentials.email}</span>
                      <Mail size={13} className="text-ink-faint" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-ink-faint">Account Sign-in Password</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSharePassword(!showSharePassword)}
                          className="text-[11px] text-ink-faint hover:text-ink flex items-center gap-1 cursor-pointer"
                        >
                          {showSharePassword ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{showSharePassword ? "Hide" : "Reveal"}</span>
                        </button>
                        <span className="text-line-strong">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(shareCredentials.password)
                            notify("Password copied to clipboard!", "ok")
                          }}
                          className="text-[11px] text-saffron-deep hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Copy size={11} />
                          <span>Copy Password</span>
                        </button>
                      </div>
                    </div>
                    <div className="font-mono bg-card px-3 py-1.5 rounded border border-line text-ink text-[13px] flex items-center justify-between font-semibold">
                      <span>{showSharePassword ? shareCredentials.password : "•".repeat(Math.max(8, shareCredentials.password.length))}</span>
                      <Lock size={13} className="text-saffron-deep" />
                    </div>
                  </div>

                  {shareCredentials.assignedScope && (
                    <div>
                      <div className="text-[11px] text-ink-faint mb-0.5">Assigned Facility / Scope</div>
                      <div className="font-medium text-ink bg-card px-3 py-1.5 rounded border border-line text-[12px]">
                        {shareCredentials.assignedScope}
                      </div>
                    </div>
                  )}

                  {shareCredentials.region && (
                    <div>
                      <div className="text-[11px] text-ink-faint mb-0.5">Operational Region</div>
                      <div className="font-medium text-ink bg-card px-3 py-1.5 rounded border border-line text-[12px] flex items-center gap-1.5">
                        <MapPin size={12} className="text-saffron-deep" />
                        <span>{shareCredentials.region}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] text-ink-faint mb-0.5">Platform Sign-In Portal</div>
                    <div className="font-mono text-[11.5px] text-ink bg-card px-3 py-1.5 rounded border border-line truncate">
                      {window.location.origin}
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions memo */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11.5px] text-ink-soft leading-relaxed flex items-start gap-2">
                <Info size={14} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Share this info directly with the appointed manager or user via WhatsApp, SMS, or email. They can sign in immediately using this email and password.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-[11.5px] text-ink-faint">
                {copiedSuccess ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check size={14} /> Full credentials copied to clipboard!
                  </span>
                ) : (
                  "Ready to paste anywhere"
                )}
              </span>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShareCredentials(null)}
                  className="px-3.5 py-2 text-[12.5px] font-medium text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper-deep transition cursor-pointer"
                >
                  Close
                </button>
                <a
                  href={getWhatsAppShareUrl(shareCredentials)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[12.5px] font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                >
                  <MessageSquare size={14} />
                  <span>Send via WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyCredentialsToClipboard(shareCredentials)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[12.5px] font-bold rounded-md bg-saffron hover:bg-saffron-deep text-white shadow-xs transition cursor-pointer"
                >
                  {copiedSuccess ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedSuccess ? "Copied!" : "Copy Full Text"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
