import { useState, useMemo, useEffect } from "react"
import {
  Globe,
  MapPin,
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Landmark,
  CreditCard,
  FileText,
  Check,
  X,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Phone,
  Mail,
  ArrowRight,
  HelpCircle,
  BadgeAlert,
  ClipboardList,
} from "lucide-react"
import {
  useStore,
  useToast,
  type OperationalAdmin,
  type OperationalRegion,
  type DataMigrationRecord,
} from "../../store/store"
import {
  getAllIndianStates,
  getDistrictsForIndianState,
  getDefaultZoneForState,
} from "../../data/indiaGeoData"
import { Eyebrow, Panel, PanelHead, Tag } from "../../lib/ui"

interface RegionalGovernanceProps {
  initialSector?: "all" | "free" | "regions" | "migrations"
}

export default function RegionalGovernance({
  initialSector = "all",
}: RegionalGovernanceProps) {
  const { notify } = useToast()
  const {
    operationalAdmins,
    regions,
    migrationHistory,
    gosalas,
    managers,
    bookings,
    addRegion,
    assignRegionAdmin,
    addOperationalAdmin,
    toggleOperationalAdminStatus,
    migrateOperationalAdminData,
    assignGosalaAdmin,
    refreshOperationalAdmins,
    refreshRegions,
    refreshMigrationHistory,
  } = useStore()

  // Active Tab
  const [activeTab, setActiveTab] =
    useState<"all" | "free" | "regions" | "migrations" | "gaushalas">(initialSector)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] =
    useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

  // Modals state
  const [addRegionModalOpen, setAddRegionModalOpen] = useState(false)
  const [addAdminModalOpen, setAddAdminModalOpen] = useState(false)
  const [migrationModalOpen, setMigrationModalOpen] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)

  // Assign Modal target
  const [selectedRegionForAssign, setSelectedRegionForAssign] =
    useState<OperationalRegion | null>(null)
  const [selectedAdminIdForAssign, setSelectedAdminIdForAssign] =
    useState<string>("")

  // Gaushala Reassign Modal target
  const [gosalaAssignModalOpen, setGosalaAssignModalOpen] = useState(false)
  const [selectedGosalaForAssign, setSelectedGosalaForAssign] =
    useState<any | null>(null)
  const [selectedAdminIdForGosalaAssign, setSelectedAdminIdForGosalaAssign] =
    useState<string>("USER-SA-001")
  const [isGosalaAssigning, setIsGosalaAssigning] = useState(false)

  // Pre-selected source admin for migration
  const [preselectedSourceAdminId, setPreselectedSourceAdminId] =
    useState<string>("")

  // --- ADD REGION MODAL FORM STATE ---
  const [newRegState, setNewRegState] = useState<string>("")
  const [newRegDistrict, setNewRegDistrict] = useState<string>("")
  const [newRegName, setNewRegName] = useState<string>("")
  const [newRegZone, setNewRegZone] =
    useState<"North" | "South" | "East" | "West" | "Central" | "Rural">(
      "Central",
    )
  const [newRegRadius, setNewRegRadius] = useState<number>(35)
  const [newRegPincodes, setNewRegPincodes] = useState<string>("")
  const [newRegAssignAdminId, setNewRegAssignAdminId] = useState<string>("")
  const [isSubmittingRegion, setIsSubmittingRegion] = useState(false)

  // --- ADD OPERATIONAL ADMIN MODAL FORM STATE ---
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPhone, setAdminPhone] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [adminDepartment, setAdminDepartment] = useState(
    "Regional Gaushala Operations Hub",
  )
  const [adminDesignation, setAdminDesignation] = useState(
    "Regional Operations Officer",
  )
  // Banking fields
  const [bankAccountHolder, setBankAccountHolder] = useState("")
  const [bankName, setBankName] = useState("State Bank of India")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankIfscCode, setBankIfscCode] = useState("")
  const [bankUpiId, setBankUpiId] = useState("")
  const [bankBranch, setBankBranch] = useState("")
  const [adminAssignRegionId, setAdminAssignRegionId] = useState("")
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false)

  // --- DATA MIGRATION WIZARD STATE ---
  const [migStep, setMigStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [migSourceAdminId, setMigSourceAdminId] = useState<string>("")
  const [migTargetAdminId, setMigTargetAdminId] = useState<string>("")
  const [migDeactivateSource, setMigDeactivateSource] = useState(true)
  const [migTransferRegion, setMigTransferRegion] = useState(true)
  const [migTermsAccepted, setMigTermsAccepted] = useState(false)
  const [migNotes, setMigNotes] = useState("")
  // New Admin Bank Updates if editing in wizard
  const [migTargetBankHolder, setMigTargetBankHolder] = useState("")
  const [migTargetBankName, setMigTargetBankName] = useState("")
  const [migTargetBankAccount, setMigTargetBankAccount] = useState("")
  const [migTargetBankIfsc, setMigTargetBankIfsc] = useState("")
  const [migTargetBankUpi, setMigTargetBankUpi] = useState("")
  const [isMigrating, setIsMigrating] = useState(false)
  const [showScopeDetails, setShowScopeDetails] = useState(false)
  const [migSuccessCert, setMigSuccessCert] =
    useState<DataMigrationRecord | null>(null)

  // All Indian States list
  const allStatesList = useMemo(() => getAllIndianStates(), [])

  // Districts for selected state in Add Region modal
  const districtsForSelectedState = useMemo(() => {
    if (!newRegState) return []
    return getDistrictsForIndianState(newRegState)
  }, [newRegState])

  // Auto-generate password helper
  const handleGeneratePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789"
    let rnd = ""
    for (let i = 0; i < 4; i++) {
      rnd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const gen = `GomaaOps@${rnd}${Math.floor(10 + Math.random() * 90)}!`
    setAdminPassword(gen)
  }

  // Free/Available Operational Admins
  const freeOperationalAdmins = useMemo(() => {
    return operationalAdmins.filter(
      (a) => !a.assignedRegionId && a.assignedGosalaCount === 0,
    )
  }, [operationalAdmins])

  // Free/Available Regions (without assigned admin)
  const freeRegions = useMemo(() => {
    return regions.filter((r) => !r.assignedAdminId)
  }, [regions])

  // Filtered Operational Admins
  const filteredAdmins = useMemo(() => {
    return operationalAdmins.filter((a) => {
      if (
        activeTab === "free" &&
        (a.assignedRegionId || a.assignedGosalaCount > 0)
      ) {
        return false
      }
      if (statusFilter === "ACTIVE" && !a.isActive) return false
      if (statusFilter === "INACTIVE" && a.isActive) return false
      if (
        stateFilter !== "ALL" &&
        a.assignedRegion?.state?.toLowerCase() !== stateFilter.toLowerCase()
      ) {
        return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        (a.uniqueId && a.uniqueId.toLowerCase().includes(q)) ||
        (a.assignedRegionName &&
          a.assignedRegionName.toLowerCase().includes(q)) ||
        (a.assignedRegion?.district &&
          a.assignedRegion.district.toLowerCase().includes(q)) ||
        (a.assignedRegion?.state &&
          a.assignedRegion.state.toLowerCase().includes(q))
      )
    })
  }, [operationalAdmins, activeTab, statusFilter, stateFilter, searchQuery])

  // Filtered Regions
  const filteredRegions = useMemo(() => {
    return regions.filter((r) => {
      if (
        stateFilter !== "ALL" &&
        r.state.toLowerCase() !== stateFilter.toLowerCase()
      ) {
        return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q) ||
        r.district.toLowerCase().includes(q) ||
        (r.assignedAdminName && r.assignedAdminName.toLowerCase().includes(q))
      )
    })
  }, [regions, stateFilter, searchQuery])

  // Filtered Gaushalas
  const filteredGosalas = useMemo(() => {
    return gosalas.filter((g) => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      const gName = (g.name || "").toLowerCase()
      const gRegion = (g.region || "").toLowerCase()
      const gAdminName = String(
        (g as any).adminName || (g as any).governingAdminName || "",
      ).toLowerCase()
      const gAdminEmail = String(
        (g as any).adminEmail || (g as any).governingAdminEmail || "",
      ).toLowerCase()
      return (
        gName.includes(q) ||
        gRegion.includes(q) ||
        gAdminName.includes(q) ||
        gAdminEmail.includes(q)
      )
    })
  }, [gosalas, searchQuery])

  // On State change in Add Region modal
  const handleStateChange = (st: string) => {
    setNewRegState(st)
    setNewRegDistrict("")
    setNewRegZone(getDefaultZoneForState(st))
    setNewRegName("")
  }

  // On District change in Add Region modal
  const handleDistrictChange = (dist: string) => {
    setNewRegDistrict(dist)
    if (dist && newRegState) {
      setNewRegName(`${dist} (${newRegState}) Operational Hub`)
    }
  }

  // Submit Add Region
  const handleSaveRegion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRegState || !newRegDistrict) {
      notify("Please select both Indian State and District", "err")
      return
    }
    setIsSubmittingRegion(true)
    try {
      const pinList = newRegPincodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

      await addRegion({
        state: newRegState,
        district: newRegDistrict,
        name: newRegName || `${newRegDistrict} Operational Hub`,
        zone: newRegZone,
        defaultMaxRadiusKm: newRegRadius,
        pincodePrefixes: pinList,
        assignedAdminId: newRegAssignAdminId || null,
      })

      // Reset and close
      setAddRegionModalOpen(false)
      setNewRegState("")
      setNewRegDistrict("")
      setNewRegName("")
      setNewRegPincodes("")
      setNewRegAssignAdminId("")
    } catch (err: any) {
      // toast handled in store
    } finally {
      setIsSubmittingRegion(false)
    }
  }

  // Submit Add Operational Admin
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminName.trim() || !adminEmail.trim() || !adminPhone.trim()) {
      notify("Full name, email, and mobile number are required", "err")
      return
    }
    setIsSubmittingAdmin(true)
    try {
      await addOperationalAdmin({
        name: adminName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        password: adminPassword.trim() || undefined,
        department: adminDepartment.trim(),
        designation: adminDesignation.trim(),
        bankDetails: {
          accountHolder: bankAccountHolder.trim() || adminName.trim(),
          bankName: bankName.trim(),
          accountNumber: bankAccountNumber.trim() || "••••4819",
          ifscCode: bankIfscCode.trim().toUpperCase() || "SBIN0001042",
          upiId: bankUpiId.trim() || `${adminEmail.split("@")[0]}@okhdfcbank`,
          branchName: bankBranch.trim() || "Regional Operations Hub",
          isVerified: true,
        },
        assignedRegionId: adminAssignRegionId || undefined,
      })

      setAddAdminModalOpen(false)
      setAdminName("")
      setAdminEmail("")
      setAdminPhone("")
      setAdminPassword("")
      setBankAccountHolder("")
      setBankAccountNumber("")
      setBankIfscCode("")
      setBankUpiId("")
      setBankBranch("")
      setAdminAssignRegionId("")
    } catch (err: any) {
      // toast handled in store
    } finally {
      setIsSubmittingAdmin(false)
    }
  }

  // Handle Quick Assign Region
  const handleOpenAssignModal = (region: OperationalRegion) => {
    setSelectedRegionForAssign(region)
    setSelectedAdminIdForAssign(region.assignedAdminId || "")
    setAssignModalOpen(true)
  }

  const handleSaveAssign = async () => {
    if (!selectedRegionForAssign) return
    try {
      await assignRegionAdmin(
        selectedRegionForAssign.id,
        selectedAdminIdForAssign || null,
      )
      setAssignModalOpen(false)
      setSelectedRegionForAssign(null)
    } catch (err: any) {
      // error handled in store
    }
  }

  // Open Migration Wizard
  const handleOpenMigrationWizard = (sourceId?: string) => {
    setMigStep(1)
    setMigSuccessCert(null)
    setMigTermsAccepted(true)
    setShowScopeDetails(false)
    setMigNotes("")
    setMigDeactivateSource(true)
    setMigTransferRegion(true)

    if (sourceId) {
      setMigSourceAdminId(sourceId)
    } else if (operationalAdmins.length > 0) {
      const activeWithPortfolio = operationalAdmins.find(
        (a) => a.isActive && (a.assignedRegionId || a.assignedGosalaCount > 0),
      )
      setMigSourceAdminId(activeWithPortfolio?.id || operationalAdmins[0].id)
    }

    // Default target admin to a free admin if available, or another active admin
    const candidateTarget =
      freeOperationalAdmins.find((a) => a.id !== sourceId) ||
      operationalAdmins.find((a) => a.id !== sourceId && a.isActive)
    if (candidateTarget) {
      setMigTargetAdminId(candidateTarget.id)
      setMigTargetBankHolder(
        candidateTarget.bankDetails?.accountHolder || candidateTarget.name,
      )
      setMigTargetBankName(
        candidateTarget.bankDetails?.bankName || "State Bank of India",
      )
      setMigTargetBankAccount(candidateTarget.bankDetails?.accountNumber || "")
      setMigTargetBankIfsc(candidateTarget.bankDetails?.ifscCode || "")
      setMigTargetBankUpi(candidateTarget.bankDetails?.upiId || "")
    } else {
      setMigTargetAdminId("")
    }

    setMigrationModalOpen(true)
  }

  // Update target bank pre-fill when target admin changes in wizard
  useEffect(() => {
    if (migTargetAdminId) {
      const tgt = operationalAdmins.find((a) => a.id === migTargetAdminId)
      if (tgt) {
        setMigTargetBankHolder(tgt.bankDetails?.accountHolder || tgt.name)
        setMigTargetBankName(tgt.bankDetails?.bankName || "State Bank of India")
        setMigTargetBankAccount(tgt.bankDetails?.accountNumber || "")
        setMigTargetBankIfsc(tgt.bankDetails?.ifscCode || "")
        setMigTargetBankUpi(tgt.bankDetails?.upiId || "")
      }
    }
  }, [migTargetAdminId, operationalAdmins])

  // Resolve Source & Target Admin objects for Wizard
  const sourceAdminObj = useMemo(() => {
    return operationalAdmins.find((a) => a.id === migSourceAdminId) || null
  }, [operationalAdmins, migSourceAdminId])

  const targetAdminObj = useMemo(() => {
    return operationalAdmins.find((a) => a.id === migTargetAdminId) || null
  }, [operationalAdmins, migTargetAdminId])

  // Gaushalas in scope for migration
  const gaushalasInScope = useMemo(() => {
    if (!sourceAdminObj) return []
    const sEmail = (sourceAdminObj.email || "").toLowerCase()
    return gosalas.filter(
      (g) =>
        (g.adminId && g.adminId === sourceAdminObj.id) ||
        (g.governingAdminEmail &&
          g.governingAdminEmail.toLowerCase() === sEmail) ||
        sourceAdminObj.assignedGosalaNames?.includes(g.name),
    )
  }, [gosalas, sourceAdminObj])

  // Execute Migration
  const handleExecuteMigration = async () => {
    if (!migSourceAdminId || !migTargetAdminId) {
      notify("Please select both Source and Target Operational Admins", "err")
      return
    }
    if (migSourceAdminId === migTargetAdminId) {
      notify("Source and Target Operational Admins cannot be identical", "err")
      return
    }
    if (!migTermsAccepted) {
      notify(
        "Please review and accept the Business Separation & Financial Handover agreement",
        "err",
      )
      return
    }

    setIsMigrating(true)
    try {
      const cert = await migrateOperationalAdminData({
        sourceAdminId: migSourceAdminId,
        targetAdminId: migTargetAdminId,
        deactivateSource: migDeactivateSource,
        transferRegion: migTransferRegion,
        targetBankDetails: {
          accountHolder: migTargetBankHolder,
          bankName: migTargetBankName,
          accountNumber: migTargetBankAccount,
          ifscCode: migTargetBankIfsc.toUpperCase(),
          upiId: migTargetBankUpi,
          isVerified: true,
        },
        notes: migNotes,
      })

      setMigSuccessCert(cert)
      setMigStep(5)
    } catch (err: any) {
      // error handled in store
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-card border border-line rounded-sm p-4 shadow-2xs">
          <div className="flex items-center justify-between text-ink-faint mb-1.5">
            <span className="text-[11.5px] uppercase font-mono tracking-wider">
              Operational Hubs
            </span>
            <Globe size={16} className="text-forest" />
          </div>
          <div className="font-serif text-[26px] font-semibold text-ink leading-tight">
            {regions.length}
          </div>
          <div className="text-[11px] text-ink-faint mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-forest" />
            <span>
              {regions.filter((r) => r.assignedAdminId).length} appointed
            </span>
          </div>
        </div>

        <div className="bg-card border border-line rounded-sm p-4 shadow-2xs">
          <div className="flex items-center justify-between text-ink-faint mb-1.5">
            <span className="text-[11.5px] uppercase font-mono tracking-wider">
              Regional Admins
            </span>
            <Users size={16} className="text-saffron-deep" />
          </div>
          <div className="font-serif text-[26px] font-semibold text-ink leading-tight">
            {operationalAdmins.length}
          </div>
          <div className="text-[11px] text-ink-faint mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span>
              {operationalAdmins.filter((a) => a.isActive).length} active
            </span>
          </div>
        </div>

        <div className="bg-card border border-line rounded-sm p-4 shadow-2xs">
          <div className="flex items-center justify-between text-ink-faint mb-1.5">
            <span className="text-[11.5px] uppercase font-mono tracking-wider">
              Free Admins Pool
            </span>
            <UserCheck size={16} className="text-amber-600" />
          </div>
          <div className="font-serif text-[26px] font-semibold text-amber-700 leading-tight">
            {freeOperationalAdmins.length}
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            Available for immediate appointment
          </div>
        </div>

        <div className="bg-card border border-line rounded-sm p-4 shadow-2xs">
          <div className="flex items-center justify-between text-ink-faint mb-1.5">
            <span className="text-[11.5px] uppercase font-mono tracking-wider">
              Gaushalas Governed
            </span>
            <Building2 size={16} className="text-forest" />
          </div>
          <div className="font-serif text-[26px] font-semibold text-ink leading-tight">
            {gosalas.length}
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            Across {regions.length} operational zones
          </div>
        </div>

        <div className="bg-card border border-line rounded-sm p-4 shadow-2xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-ink-faint mb-1.5">
            <span className="text-[11.5px] uppercase font-mono tracking-wider">
              Data Migrations
            </span>
            <ArrowRightLeft size={16} className="text-indigo-600" />
          </div>
          <div className="font-serif text-[26px] font-semibold text-indigo-700 leading-tight">
            {migrationHistory.length}
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            Audited portfolio handovers
          </div>
        </div>
      </div>

      {/* Main Governance Panel */}
      <Panel>
        <div className="p-4 sm:p-5 border-b border-line flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-paper/60">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-[20px] font-semibold text-ink">
                Regional Operations &amp; Admin Governance
              </h2>
              <span className="font-mono text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-[12.5px] text-ink-faint mt-1">
              Appoint operational admins to Indian regions, manage active
              status, and execute verified portfolio &amp; banking data
              migration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => handleOpenMigrationWizard()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-[12.5px] font-medium bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white transition shadow-xs cursor-pointer"
              title="Change Regional Manager and transfer territory, Gaushalas, and banking payouts"
            >
              <ArrowRightLeft size={14} />
              <span>Change Regional Manager</span>
            </button>

            <button
              onClick={() => {
                handleGeneratePassword()
                setAddAdminModalOpen(true)
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-[12.5px] font-medium bg-forest hover:bg-forest/90 text-white transition shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Operational Admin</span>
            </button>

            <button
              onClick={() => setAddRegionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-[12.5px] font-medium bg-saffron hover:bg-saffron-deep text-white transition shadow-xs cursor-pointer"
            >
              <MapPin size={14} />
              <span>Add Region</span>
            </button>
          </div>
        </div>

        {/* Visual 3-Step Lifecycle Guide: Clean & Instant Understanding */}
        <div className="bg-gradient-to-r from-paper via-paper-light to-paper-deep/60 border-b border-line px-4 sm:px-5 py-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-2.5">
              <span className="h-6 w-6 rounded-full bg-saffron text-white font-bold flex items-center justify-center text-[11px] shadow-2xs">
                1
              </span>
              <div>
                <span className="font-semibold text-ink block">Add Region</span>
                <span className="text-ink-faint text-[11px]">Select State &amp; District</span>
              </div>
            </div>

            <div className="hidden sm:block text-ink-faint font-mono text-xs">──►</div>

            <div className="flex items-center gap-2.5">
              <span className="h-6 w-6 rounded-full bg-forest text-white font-bold flex items-center justify-center text-[11px] shadow-2xs">
                2
              </span>
              <div>
                <span className="font-semibold text-ink block">Appoint Manager</span>
                <span className="text-ink-faint text-[11px]">Pick candidate from Free Admin Pool</span>
              </div>
            </div>

            <div className="hidden sm:block text-ink-faint font-mono text-xs">──►</div>

            <div className="flex items-center gap-2.5">
              <span className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shadow-2xs">
                3
              </span>
              <div>
                <span className="font-semibold text-indigo-950 block">Change Manager (Handover)</span>
                <span className="text-ink-faint text-[11px]">1-click transfer of Gaushalas &amp; Bank payouts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-line bg-card px-4 sm:px-5 gap-6 text-[13px] font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`py-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
              activeTab === "all"
                ? "text-saffron-deep font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <span>All Regional Admins</span>
            <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded-full bg-paper-deep text-ink-soft">
              {operationalAdmins.length}
            </span>
            {activeTab === "all" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-saffron" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("free")}
            className={`py-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
              activeTab === "free"
                ? "text-saffron-deep font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <span>Free / Unassigned Admins</span>
            <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold">
              {freeOperationalAdmins.length}
            </span>
            {activeTab === "free" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-saffron" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("regions")}
            className={`py-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
              activeTab === "regions"
                ? "text-saffron-deep font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <span>Operational Regions &amp; Hubs</span>
            <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded-full bg-paper-deep text-ink-soft">
              {regions.length}
            </span>
            {activeTab === "regions" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-saffron" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("migrations")}
            className={`py-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
              activeTab === "migrations"
                ? "text-saffron-deep font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <span>Migration History &amp; Audit</span>
            <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-900 font-bold">
              {migrationHistory.length}
            </span>
            {activeTab === "migrations" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-saffron" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("gaushalas")}
            className={`py-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
              activeTab === "gaushalas"
                ? "text-saffron-deep font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <span>Gaushala Assignments</span>
            <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded-full bg-forest-soft text-forest-deep font-bold">
              {gosalas.length}
            </span>
            {activeTab === "gaushalas" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-saffron" />
            )}
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-line bg-paper-light flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "regions"
                  ? "Search regions, states, districts, appointed admins…"
                  : activeTab === "gaushalas"
                    ? "Search Gaushalas by name, region, assigned operational admin…"
                    : activeTab === "migrations"
                      ? "Search migration certificates by ID, admin, gaushala…"
                      : "Search admins by name, email, phone, region, unique ID…"
              }
              className="w-full bg-card border border-line rounded-sm pl-9 pr-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint outline-none focus:border-saffron transition"
            />
          </div>

          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-ink-faint">State:</span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="bg-card border border-line rounded-sm px-2.5 py-1.5 text-ink outline-none text-[12px]"
            >
              <option value="ALL">All States of India</option>
              {allStatesList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {activeTab !== "regions" && activeTab !== "migrations" && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-ink-faint">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-card border border-line rounded-sm px-2.5 py-1.5 text-ink outline-none text-[12px]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Deactivated Only</option>
              </select>
            </div>
          )}

          {(searchQuery || stateFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("")
                setStateFilter("ALL")
                setStatusFilter("ALL")
              }}
              className="text-[11.5px] text-saffron-deep hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Content based on Active Tab */}
        {activeTab === "migrations" ? (
          // Migration History List
          <div className="divide-y divide-line">
            {migrationHistory.length === 0 ? (
              <div className="p-12 text-center text-ink-faint">
                <ArrowRightLeft size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-serif text-[16px] text-ink">
                  No Data Migrations Recorded Yet
                </p>
                <p className="text-[12.5px] max-w-md mx-auto mt-1">
                  When you replace or transition an Operational Admin, all
                  Gaushalas, Managers, active Bookings, and banking routing will
                  be securely logged here.
                </p>
                <button
                  onClick={() => handleOpenMigrationWizard()}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-[12.5px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer"
                >
                  <ArrowRightLeft size={14} />
                  <span>Launch First Data Migration</span>
                </button>
              </div>
            ) : (
              migrationHistory.map((cert) => (
                <div
                  key={cert.id}
                  className="p-4 sm:p-5 hover:bg-paper-light transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-sm">
                        {cert.id}
                      </span>
                      <span className="text-[11.5px] text-ink-faint font-mono">
                        {new Date(cert.timestamp).toLocaleString("en-IN")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Check size={11} /> Handover Completed
                      </span>
                      {cert.sourceDeactivated && (
                        <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Old Admin Deactivated
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[14px] font-medium text-ink pt-1 flex-wrap">
                      <span className="text-ink-soft">From:</span>
                      <span className="font-semibold text-red-900 bg-red-50 px-2 py-0.5 rounded">
                        {cert.sourceAdminName} ({cert.sourceAdminEmail})
                      </span>
                      <ArrowRight size={14} className="text-indigo-600" />
                      <span className="text-ink-soft">To:</span>
                      <span className="font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded">
                        {cert.targetAdminName} ({cert.targetAdminEmail})
                      </span>
                    </div>

                    <div className="text-[12px] text-ink-soft flex items-center gap-4 flex-wrap pt-0.5">
                      <span>
                        Territory: <strong>{cert.regionName}</strong>
                      </span>
                      <span>
                        Gaushalas Transferred:{" "}
                        <strong>{cert.transferredGosalas?.length || 0}</strong>
                      </span>
                      <span>
                        Managers Reassigned:{" "}
                        <strong>{cert.transferredManagersCount}</strong>
                      </span>
                      <span>
                        Bookings Updated:{" "}
                        <strong>{cert.transferredBookingsCount}</strong>
                      </span>
                    </div>

                    <div className="text-[11.5px] text-ink-faint font-mono pt-1">
                      Banking Separation: {cert.targetBankDetailsSummary}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          JSON.stringify(cert, null, 2),
                        )
                        notify(
                          "Migration Audit Certificate copied to clipboard",
                          "ok",
                        )
                      }}
                      className="px-3 py-1.5 rounded-sm border border-line bg-card hover:bg-paper-deep text-[12px] font-medium text-ink flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Copy size={13} />
                      <span>Copy Certificate</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === "regions" ? (
          // Regions Directory List
          <div className="divide-y divide-line">
            {filteredRegions.length === 0 ? (
              <div className="p-12 text-center text-ink-faint">
                <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-serif text-[16px] text-ink">
                  No Operational Regions Found
                </p>
                <p className="text-[12.5px] max-w-md mx-auto mt-1">
                  Click "Add Region" to create an operational hub covering any
                  Indian State &amp; District.
                </p>
              </div>
            ) : (
              filteredRegions.map((reg) => (
                <div
                  key={reg.id}
                  className="p-4 sm:p-5 hover:bg-paper-light transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-[16px] font-semibold text-ink">
                        {reg.name}
                      </span>
                      <span className="font-mono text-[10.5px] bg-paper-deep border border-line px-2 py-0.5 rounded text-ink-soft">
                        {reg.zone} Zone
                      </span>
                      <span className="font-mono text-[10.5px] bg-paper-deep border border-line px-2 py-0.5 rounded text-ink-soft">
                        Radius: {reg.defaultMaxRadiusKm} km
                      </span>
                      {reg.isCustom && (
                        <span className="text-[10px] font-bold text-saffron-deep bg-saffron-soft px-1.5 py-0.5 rounded">
                          CUSTOM
                        </span>
                      )}
                    </div>

                    <div className="text-[13px] text-ink-soft flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink">
                        {reg.district}, {reg.state}
                      </span>
                      {reg.pincodePrefixes?.length > 0 && (
                        <span className="text-[11.5px] text-ink-faint font-mono">
                          (PINs: {reg.pincodePrefixes.slice(0, 3).join(", ")}
                          {reg.pincodePrefixes.length > 3 ? "…" : ""})
                        </span>
                      )}
                    </div>

                    <div className="pt-1 flex items-center gap-2 flex-wrap text-[12px]">
                      <span className="text-ink-faint">Appointed Admin:</span>
                      {reg.assignedAdminId ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2
                            size={12}
                            className="text-emerald-700"
                          />
                          <span>
                            {reg.assignedAdminName || "Operational Admin"}
                          </span>
                          <span className="text-[11px] text-emerald-700/80">
                            ({reg.assignedAdminEmail})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full font-medium">
                          <AlertTriangle size={12} />
                          <span>Vacant · Needs Operational Admin</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {reg.assignedAdminId ? (
                      <>
                        <button
                          onClick={() =>
                            handleOpenMigrationWizard(
                              reg.assignedAdminId || undefined,
                            )
                          }
                          className="px-3 py-1.5 rounded-sm bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 text-[12px] font-medium flex items-center gap-1.5 transition cursor-pointer"
                          title="Change manager and handover region, gaushalas, and banking"
                        >
                          <ArrowRightLeft size={13} className="text-indigo-600" />
                          <span>Change Manager</span>
                        </button>
                        <button
                          onClick={() => handleOpenAssignModal(reg)}
                          className="px-2.5 py-1.5 rounded-sm border border-line bg-card hover:bg-paper-deep text-[11.5px] font-medium text-ink-soft hover:text-ink flex items-center gap-1 transition cursor-pointer"
                          title="Direct reassign without full handover"
                        >
                          <UserCheck size={12} className="text-ink-faint" />
                          <span>Reassign</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleOpenAssignModal(reg)}
                        className="px-3 py-1.5 rounded-sm bg-forest hover:bg-forest/90 text-white text-[12px] font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <UserCheck size={13} />
                        <span>Appoint Admin</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === "gaushalas" ? (
          // Gaushalas Assignment & Boundary Management List
          <div className="divide-y divide-line">
            {filteredGosalas.length === 0 ? (
              <div className="p-12 text-center text-ink-faint">
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-serif text-[16px] text-ink">
                  No Gaushalas Found Matching Query
                </p>
                <p className="text-[12.5px] max-w-md mx-auto mt-1">
                  Try searching with a different sanctuary name, district, or operational admin name.
                </p>
              </div>
            ) : (
              filteredGosalas.map((g) => {
                const govAdminId = (g as any).adminId || "USER-SA-001"
                const govAdminName =
                  (g as any).adminName ||
                  (g as any).governingAdminName ||
                  "Super Admin (Direct Portfolio)"
                const govAdminEmail =
                  (g as any).adminEmail || (g as any).governingAdminEmail || ""
                const isDirectSA =
                  govAdminId === "USER-SA-001" ||
                  govAdminId === "USER-SA-SUPERADMIN" ||
                  govAdminEmail === "superadmin@gomaa.in"

                return (
                  <div
                    key={g.id}
                    className="p-4 sm:p-5 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-paper-light"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif text-[15px] font-semibold text-ink">
                          {g.name}
                        </span>
                        <Tag
                          variant={g.status === "Active" ? "ok" : "warn"}
                          size="xs"
                        >
                          {g.status || "Active"}
                        </Tag>
                        {isDirectSA ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <ShieldAlert size={11} /> Sovereign Custody
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-forest-soft text-forest-deep border border-forest/30">
                            <ShieldCheck size={11} /> Assigned Regional Hub
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[12px] text-ink-soft flex-wrap">
                        <span className="flex items-center gap-1 text-ink-faint">
                          <MapPin size={13} className="text-forest" />
                          <span className="text-ink font-medium">{g.region}</span>
                          {g.address && (
                            <span className="truncate max-w-[240px] text-ink-faint">
                              · {g.address}
                            </span>
                          )}
                        </span>
                        <span>
                          <strong className="text-ink">Custodian:</strong>{" "}
                          {g.caretaker || g.managerName || "None"}
                        </span>
                      </div>

                      <div className="pt-1 flex items-center gap-2 text-[11.5px] flex-wrap">
                        <span className="text-ink-faint font-medium">Governing Operational Admin:</span>
                        <span className="font-semibold text-ink">
                          {govAdminName}
                        </span>
                        {govAdminEmail && (
                          <span className="text-ink-faint font-mono text-[11px]">
                            ({govAdminEmail})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => {
                          setSelectedGosalaForAssign(g)
                          setSelectedAdminIdForGosalaAssign(govAdminId)
                          setGosalaAssignModalOpen(true)
                        }}
                        className="px-3.5 py-1.5 rounded-sm border border-saffron bg-saffron/10 hover:bg-saffron text-saffron-deep hover:text-white text-[12px] font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <ShieldCheck size={13} />
                        <span>Reassign Admin</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          // Operational Admins List (All or Free)
          <div className="divide-y divide-line">
            {filteredAdmins.length === 0 ? (
              <div className="p-12 text-center text-ink-faint">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-serif text-[16px] text-ink">
                  {activeTab === "free"
                    ? "No Free / Unassigned Operational Admins"
                    : "No Operational Admins Found"}
                </p>
                <p className="text-[12.5px] max-w-md mx-auto mt-1">
                  {activeTab === "free"
                    ? "All operational admins currently have assigned territories or gaushalas."
                    : "Click 'Add Operational Admin' to onboard a new regional operational manager."}
                </p>
              </div>
            ) : (
              filteredAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className={`p-4 sm:p-5 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    !admin.isActive
                      ? "bg-amber-50/40 opacity-80"
                      : "hover:bg-paper-light"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 ${
                          admin.isActive ? "bg-forest" : "bg-ink-faint"
                        }`}
                      >
                        {admin.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-serif text-[16.5px] font-semibold text-ink">
                        {admin.name}
                      </span>
                      <span className="font-mono text-[10.5px] text-ink-faint border border-line px-1.5 py-0.2 rounded">
                        {admin.uniqueId || `GMA-OPS-${admin.id.slice(0, 4)}`}
                      </span>

                      {/* Active Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                          admin.isActive
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : "bg-red-100 text-red-900 border border-red-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            admin.isActive ? "bg-emerald-600" : "bg-red-600"
                          }`}
                        />
                        {admin.isActive ? "ACTIVE" : "DEACTIVATED"}
                      </span>

                      {/* Free Pool Badge */}
                      {admin.isFree && (
                        <span className="font-mono text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                          UNASSIGNED POOL
                        </span>
                      )}
                    </div>

                    <div className="text-[12.5px] text-ink-soft flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1 text-ink">
                        <Mail size={13} className="text-ink-faint" />
                        {admin.email}
                      </span>
                      <span className="flex items-center gap-1 text-ink">
                        <Phone size={13} className="text-ink-faint" />
                        {admin.phone}
                      </span>
                      <span className="text-ink-faint">
                        {admin.designation || "Operations Officer"}
                      </span>
                    </div>

                    {/* Assigned Region Details */}
                    <div className="pt-1 flex items-center gap-3 flex-wrap text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-saffron-deep" />
                        <span className="text-ink-faint">Territory:</span>
                        {admin.assignedRegionName ? (
                          <span className="font-semibold text-ink">
                            {admin.assignedRegionName}
                          </span>
                        ) : (
                          <span className="italic text-amber-700 font-medium">
                            No Region Bound (Free to Appoint)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-ink-faint">
                        <span>•</span>
                        <span>
                          Gaushalas:{" "}
                          <strong className="text-ink font-mono">
                            {admin.assignedGosalaCount}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Managers:{" "}
                          <strong className="text-ink font-mono">
                            {admin.assignedManagerCount}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Bookings:{" "}
                          <strong className="text-ink font-mono">
                            {admin.activeBookingsCount}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Banking Preview */}
                    {admin.bankDetails && (
                      <div className="pt-1 flex items-center gap-2 text-[11.5px] text-ink-faint font-mono bg-paper/60 px-2.5 py-1 rounded border border-line/60 w-fit">
                        <Landmark size={12} className="text-emerald-700" />
                        <span>{admin.bankDetails.bankName}</span>
                        <span>•</span>
                        <span>A/C: {admin.bankDetails.accountNumber}</span>
                        <span>•</span>
                        <span>IFSC: {admin.bankDetails.ifscCode}</span>
                        {admin.bankDetails.upiId && (
                          <>
                            <span>•</span>
                            <span>UPI: {admin.bankDetails.upiId}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="shrink-0 flex items-center gap-2 flex-wrap">
                    {/* Active/Deactivate toggle */}
                    <button
                      onClick={() =>
                        toggleOperationalAdminStatus(admin.id, !admin.isActive)
                      }
                      className={`px-3 py-1.5 rounded-sm text-[12px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                        admin.isActive
                          ? "bg-card border-red-200 text-red-700 hover:bg-red-50"
                          : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                      title={
                        admin.isActive
                          ? "Deactivate Operational Admin"
                          : "Activate Operational Admin"
                      }
                    >
                      {admin.isActive ? (
                        <>
                          <UserX size={13} />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={13} />
                          <span>Activate</span>
                        </>
                      )}
                    </button>

                    {/* Change Regional Manager Button */}
                    <button
                      onClick={() => handleOpenMigrationWizard(admin.id)}
                      className="px-3 py-1.5 rounded-sm bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 text-[12px] font-medium flex items-center gap-1.5 transition cursor-pointer"
                      title="Change regional manager and transfer portfolio & banking to new admin"
                    >
                      <ArrowRightLeft size={13} className="text-indigo-600" />
                      <span>Change Regional Manager</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Panel>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD REGION (WITH STATE -> DISTRICT CASCADING)                   */}
      {/* ========================================================================= */}
      {addRegionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-line rounded-md shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-saffron-deep" />
                <h3 className="font-serif text-[17px] font-semibold text-ink">
                  Add Operational Region
                </h3>
              </div>
              <button
                onClick={() => setAddRegionModalOpen(false)}
                className="text-ink-faint hover:text-ink p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRegion} className="p-5 space-y-4">
              {/* Step 1: State Dropdown (All 36 States & UTs) */}
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  1. Indian State / Union Territory{" "}
                  <span className="text-red-600">*</span>
                </label>
                <select
                  value={newRegState}
                  onChange={(e) => handleStateChange(e.target.value)}
                  required
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                >
                  <option value="">Select Indian State / UT (36 Total)</option>
                  {allStatesList.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Cascading District Dropdown */}
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  2. District in Selected State{" "}
                  <span className="text-red-600">*</span>
                </label>
                <select
                  value={newRegDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={!newRegState}
                  required
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron disabled:opacity-50"
                >
                  <option value="">
                    {!newRegState
                      ? "First select a state above"
                      : `Select District (${districtsForSelectedState.length} districts available)`}
                  </option>
                  {districtsForSelectedState.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Region / Hub Name */}
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  3. Operational Belt / Region Title{" "}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  value={newRegName}
                  onChange={(e) => setNewRegName(e.target.value)}
                  required
                  placeholder="e.g. North Bengaluru Gaushala Cluster"
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                />
              </div>

              {/* Geographic Zone & Operational Radius */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Geographic Zone
                  </label>
                  <select
                    value={newRegZone}
                    onChange={(e) => setNewRegZone(e.target.value as any)}
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                  >
                    <option value="South">South Zone</option>
                    <option value="North">North Zone</option>
                    <option value="West">West Zone</option>
                    <option value="East">East Zone</option>
                    <option value="Central">Central Zone</option>
                    <option value="Rural">Rural Belt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Max Delivery Radius (km)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={150}
                    value={newRegRadius}
                    onChange={(e) => setNewRegRadius(Number(e.target.value))}
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron font-mono"
                  />
                </div>
              </div>

              {/* Pincode Prefixes */}
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Postal Pincode Prefixes (Comma-separated)
                </label>
                <input
                  value={newRegPincodes}
                  onChange={(e) => setNewRegPincodes(e.target.value)}
                  placeholder="e.g. 560001, 560034, 560076"
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron font-mono"
                />
              </div>

              {/* Appoint Operational Admin */}
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Appoint Operational Admin (Optional)
                </label>
                <select
                  value={newRegAssignAdminId}
                  onChange={(e) => setNewRegAssignAdminId(e.target.value)}
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                >
                  <option value="">Leave Unassigned (Free Region)</option>
                  {operationalAdmins
                    .filter((a) => a.isActive)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.email}){" "}
                        {a.isFree
                          ? "— [FREE IN POOL]"
                          : "— [Currently assigned]"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddRegionModalOpen(false)}
                  className="px-4 py-2 rounded-sm border border-line bg-card hover:bg-paper-deep text-[12.5px] font-medium text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingRegion || !newRegState || !newRegDistrict
                  }
                  className="px-5 py-2 rounded-sm bg-saffron hover:bg-saffron-deep text-white text-[12.5px] font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingRegion && (
                    <RefreshCw size={14} className="animate-spin" />
                  )}
                  <span>Establish Region</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD OPERATIONAL ADMIN (WITH COMPLETE BANKING DETAILS)          */}
      {/* ========================================================================= */}
      {addAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-line rounded-md shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-forest" />
                <h3 className="font-serif text-[17px] font-semibold text-ink">
                  Onboard Regional Operational Admin
                </h3>
              </div>
              <button
                onClick={() => setAddAdminModalOpen(false)}
                className="text-ink-faint hover:text-ink p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="p-5 space-y-4">
              {/* Basic Admin Information */}
              <div>
                <span className="font-mono text-[10.5px] font-bold text-ink-faint uppercase tracking-wider block mb-2">
                  1. Administrative Identity
                </span>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-ink mb-1">
                      Full Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      required
                      placeholder="e.g. Ramesh Chandra Sharma"
                      className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Email Address <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        required
                        placeholder="admin.region@gomaa.in"
                        className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Mobile Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        required
                        placeholder="+91 98450 12345"
                        className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                      />
                    </div>
                  </div>

                  {/* Password with generator */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-medium text-ink">
                        Account Password <span className="text-red-600">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] text-forest hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={11} /> Generate Secure
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        className="w-full bg-paper border border-line rounded-sm pl-3 pr-16 py-2 text-[13px] text-ink font-mono outline-none focus:border-saffron"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 text-ink-faint hover:text-ink cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(adminPassword)
                            notify("Password copied to clipboard", "ok")
                          }}
                          className="p-1 text-ink-faint hover:text-ink cursor-pointer"
                          title="Copy Password"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banking & Settlement Profile */}
              <div className="pt-2 border-t border-line">
                <span className="font-mono text-[10.5px] font-bold text-ink-faint uppercase tracking-wider block mb-2">
                  2. Banking Details &amp; Settlement Routing (Required for
                  Disbursements)
                </span>
                <div className="space-y-3 bg-paper/50 p-3.5 rounded border border-line/80">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink mb-1">
                        Bank Name
                      </label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-card border border-line rounded-sm px-2.5 py-1.5 text-[12px] text-ink outline-none"
                      >
                        <option value="State Bank of India">
                          State Bank of India
                        </option>
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="Punjab National Bank">
                          Punjab National Bank
                        </option>
                        <option value="Bank of Baroda">Bank of Baroda</option>
                        <option value="Canara Bank">Canara Bank</option>
                        <option value="Union Bank of India">
                          Union Bank of India
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-medium text-ink mb-1">
                        Account Holder Name
                      </label>
                      <input
                        value={bankAccountHolder || adminName}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        placeholder="As printed on bank passbook"
                        className="w-full bg-card border border-line rounded-sm px-2.5 py-1.5 text-[12px] text-ink outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink mb-1">
                        Bank Account Number
                      </label>
                      <input
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="e.g. 910248194420"
                        className="w-full bg-card border border-line rounded-sm px-2.5 py-1.5 text-[12px] text-ink font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-medium text-ink mb-1">
                        IFSC Code
                      </label>
                      <input
                        value={bankIfscCode}
                        onChange={(e) =>
                          setBankIfscCode(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. SBIN0001042"
                        className="w-full bg-card border border-line rounded-sm px-2.5 py-1.5 text-[12px] text-ink font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium text-ink mb-1">
                      UPI ID for Real-time Settlements
                    </label>
                    <input
                      value={bankUpiId}
                      onChange={(e) => setBankUpiId(e.target.value)}
                      placeholder="e.g. admin@okhdfcbank"
                      className="w-full bg-card border border-line rounded-sm px-2.5 py-1.5 text-[12px] text-ink font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Territory Assignment */}
              <div className="pt-2 border-t border-line">
                <span className="font-mono text-[10.5px] font-bold text-ink-faint uppercase tracking-wider block mb-2">
                  3. Regional Territory Appointment
                </span>
                <div>
                  <select
                    value={adminAssignRegionId}
                    onChange={(e) => setAdminAssignRegionId(e.target.value)}
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                  >
                    <option value="">
                      Keep in Free Pool (Unassigned for now)
                    </option>
                    {freeRegions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.district}, {r.state} [VACANT]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddAdminModalOpen(false)}
                  className="px-4 py-2 rounded-sm border border-line bg-card hover:bg-paper-deep text-[12.5px] font-medium text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdmin || !adminName || !adminEmail}
                  className="px-5 py-2 rounded-sm bg-forest hover:bg-forest/90 text-white text-[12.5px] font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingAdmin && (
                    <RefreshCw size={14} className="animate-spin" />
                  )}
                  <span>Create &amp; Save Operational Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK REASSIGN REGION MODAL                                    */}
      {/* ========================================================================= */}
      {assignModalOpen && selectedRegionForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-line rounded-md shadow-2xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
              <h3 className="font-serif text-[17px] font-semibold text-ink">
                Appoint Admin to Region
              </h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-ink-faint hover:text-ink p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-[13px]">
              <div>
                <span className="text-ink-faint text-[12px] block">
                  Region:
                </span>
                <span className="font-semibold text-ink text-[15px]">
                  {selectedRegionForAssign.name}
                </span>
                <span className="text-ink-soft block text-[12px]">
                  {selectedRegionForAssign.district},{" "}
                  {selectedRegionForAssign.state}
                </span>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink mb-1.5">
                  Select Operational Admin:
                </label>
                <select
                  value={selectedAdminIdForAssign}
                  onChange={(e) => setSelectedAdminIdForAssign(e.target.value)}
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[13px] text-ink outline-none focus:border-saffron"
                >
                  <option value="">Unassign (Make Region Vacant)</option>
                  {operationalAdmins
                    .filter((a) => a.isActive)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.email}){" "}
                        {a.isFree ? "— [FREE]" : "— [Currently assigned]"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-sm border border-line bg-card hover:bg-paper-deep text-[12.5px] font-medium text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssign}
                  className="px-5 py-2 rounded-sm bg-forest hover:bg-forest/90 text-white text-[12.5px] font-medium transition cursor-pointer"
                >
                  Save Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INSTANT & VISUAL REGIONAL MANAGER HANDOVER BOARD                 */}
      {/* ========================================================================= */}
      {migrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-line rounded-md shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold shadow-2xs">
                  <ArrowRightLeft size={17} />
                </div>
                <div>
                  <h3 className="font-serif text-[17px] font-semibold text-ink">
                    Change Regional Manager (Handover)
                  </h3>
                  <p className="text-[11.5px] text-ink-faint">
                    Instantly transfer regional territory, Gaushalas, and banking payouts to a new manager
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMigrationModalOpen(false)}
                className="text-ink-faint hover:text-ink p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* VISUAL HANDOVER BOARD (When not viewing completed certificate) */}
            {migStep !== 5 && (
              <>
                {/* Visual Context Banner */}
                <div className="p-3.5 bg-gradient-to-r from-paper to-paper-deep border-b border-line flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-ink">
                      Handing over <strong>{sourceAdminObj?.assignedRegionName || "Regional Zone"}</strong> from{" "}
                      <strong className="text-red-900">{sourceAdminObj?.name || "Current Admin"}</strong> to{" "}
                      <strong className="text-emerald-900">{targetAdminObj?.name || "New Admin"}</strong>
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    Zero Data Loss
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  {/* Side-by-Side Manager Comparison & Handover Board */}
                  <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                    {/* Outgoing Admin Card (Col 1-5) */}
                    <div className="md:col-span-5 border border-red-200 bg-red-50/40 rounded-sm p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-red-200/80">
                        <span className="font-mono text-[10.5px] uppercase font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded">
                          Outgoing Manager
                        </span>
                        <span className="text-[11px] text-red-700 font-medium">To be replaced</span>
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-medium text-ink-soft mb-1">
                          Select Current Manager:
                        </label>
                        <select
                          value={migSourceAdminId}
                          onChange={(e) => setMigSourceAdminId(e.target.value)}
                          className="w-full bg-card border border-red-200 rounded-sm px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-red-400 font-medium"
                        >
                          {operationalAdmins.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} — [{a.assignedRegionName || "No Region"} | {a.assignedGosalaCount} Gaushalas]
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Details summary */}
                      <div className="bg-card/90 border border-red-100 rounded p-2.5 space-y-1.5 text-[11.5px]">
                        <div className="flex justify-between">
                          <span className="text-ink-faint">Governed Hub:</span>
                          <span className="font-medium text-ink">{sourceAdminObj?.assignedRegionName || "None"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-faint">Gaushalas Supervised:</span>
                          <span className="font-bold text-red-900">{gaushalasInScope.length} Facilities</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-faint">Gaushala Managers:</span>
                          <span className="font-medium text-ink">{sourceAdminObj?.assignedManagerCount || gaushalasInScope.length} Staff</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-faint">Current Bank Route:</span>
                          <span className="font-mono text-[10.5px] text-ink-soft truncate max-w-[160px]" title={sourceAdminObj?.bankDetails?.bankName}>
                            {sourceAdminObj?.bankDetails?.bankName || "SBI"} (••{sourceAdminObj?.bankDetails?.accountNumber?.slice(-4) || "00"})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-red-800 bg-red-100/70 p-2 rounded border border-red-200">
                        <UserX size={13} className="shrink-0 text-red-600" />
                        <span>Account will be deactivated upon handover</span>
                      </div>
                    </div>

                    {/* Center Transfer Bridge Arrow (Col 6) */}
                    <div className="md:col-span-1 flex flex-row md:flex-col items-center justify-center py-2 md:py-0">
                      <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-2xs border border-indigo-200">
                        <ArrowRightLeft size={16} />
                      </div>
                      <span className="text-[10px] font-mono text-indigo-600 uppercase font-semibold mt-1 hidden md:block">
                        Transfer
                      </span>
                    </div>

                    {/* Incoming Admin Card (Col 7-11) */}
                    <div className="md:col-span-5 border border-emerald-200 bg-emerald-50/40 rounded-sm p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                        <span className="font-mono text-[10.5px] uppercase font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          New Appointed Manager
                        </span>
                        <span className="text-[11px] text-emerald-700 font-medium">Takes over</span>
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-medium text-ink-soft mb-1">
                          Select Replacement Manager:
                        </label>
                        <select
                          value={migTargetAdminId}
                          onChange={(e) => setMigTargetAdminId(e.target.value)}
                          className="w-full bg-card border border-emerald-200 rounded-sm px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="">Select Candidate</option>
                          {operationalAdmins
                            .filter((a) => a.id !== migSourceAdminId && a.isActive)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} — {a.isFree ? "[FREE IN POOL]" : "[ACTIVE ADMIN]"}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Details summary */}
                      <div className="bg-card/90 border border-emerald-100 rounded p-2.5 space-y-1.5 text-[11.5px]">
                        <div className="flex justify-between">
                          <span className="text-ink-faint">Assumed Territory:</span>
                          <span className="font-medium text-ink">{sourceAdminObj?.assignedRegionName || "Regional Zone"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-faint">Gaushalas Assigned:</span>
                          <span className="font-bold text-emerald-900">+{gaushalasInScope.length} Facilities</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-faint">New Bank Route:</span>
                          <span className="font-mono text-[10.5px] text-emerald-900 font-semibold truncate max-w-[160px]" title={migTargetBankName}>
                            {migTargetBankName} (••{migTargetBankAccount?.slice(-4) || "4819"})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-faint">IFSC Routing:</span>
                          <span className="font-mono text-[10.5px] text-ink-soft">{migTargetBankIfsc || "SBIN0001042"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-100/70 p-2 rounded border border-emerald-200">
                        <CheckCircle2 size={13} className="shrink-0 text-emerald-700" />
                        <span>Devotee booking payouts will route to this bank</span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Assets Summary Pills */}
                  <div className="p-3 bg-paper rounded border border-line flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink">Assets Transferring:</span>
                      <span className="bg-card border border-line px-2 py-0.5 rounded font-mono text-ink">
                        {gaushalasInScope.length} Gaushalas
                      </span>
                      <span className="bg-card border border-line px-2 py-0.5 rounded font-mono text-ink">
                        {sourceAdminObj?.assignedRegionName || "1 Territory"}
                      </span>
                      <span className="bg-card border border-line px-2 py-0.5 rounded font-mono text-emerald-800 font-semibold">
                        Devotee Payouts
                      </span>
                    </div>
                    <span className="text-ink-faint text-[11px]">
                      Historical audit trails &amp; ledger entries remain permanently preserved.
                    </span>
                  </div>

                  {/* Collapsible Accordion: Gaushalas List & Memo */}
                  <div className="border border-line rounded bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowScopeDetails(!showScopeDetails)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 text-[12px] font-medium text-ink hover:bg-paper cursor-pointer transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-forest" />
                        <span>
                          {showScopeDetails ? "Hide" : "View"} {gaushalasInScope.length} Transferring Gaushala Facilities &amp; Handover Notes
                        </span>
                      </span>
                      {showScopeDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showScopeDetails && (
                      <div className="p-3.5 border-t border-line space-y-3 bg-paper/30">
                        {/* Gaushalas List */}
                        <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-line/60 text-[11.5px]">
                          {gaushalasInScope.length === 0 ? (
                            <div className="p-2 text-center text-ink-faint italic">
                              No Gaushalas currently mapped directly to this admin. Territory assignment and future registrations will transfer.
                            </div>
                          ) : (
                            gaushalasInScope.map((g) => (
                              <div key={g.id} className="py-1 flex items-center justify-between">
                                <span className="font-medium text-ink">{g.name}</span>
                                <span className="text-ink-faint font-mono text-[10.5px]">{g.region}</span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Checkboxes */}
                        <div className="pt-2 border-t border-line/60 space-y-1.5 text-[12px]">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={migTransferRegion}
                              onChange={(e) => setMigTransferRegion(e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            <span className="text-ink">
                              Transfer Regional Territory ({sourceAdminObj?.assignedRegionName || "Assigned Hub"}) to <strong>{targetAdminObj?.name}</strong>
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={migDeactivateSource}
                              onChange={(e) => setMigDeactivateSource(e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            <span className="text-ink">
                              Deactivate outgoing admin account (<strong>{sourceAdminObj?.name}</strong>) upon handover
                            </span>
                          </label>
                        </div>

                        {/* Handover Memo */}
                        <div>
                          <label className="block text-[11px] font-medium text-ink-soft mb-1">
                            Handover Memo / Administrative Record (Optional):
                          </label>
                          <input
                            type="text"
                            value={migNotes}
                            onChange={(e) => setMigNotes(e.target.value)}
                            placeholder="e.g. Regular regional rotation approved by Super Admin."
                            className="w-full bg-card border border-line rounded-sm px-2.5 py-1.5 text-[12px] text-ink outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Buttons */}
                  <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMigrationModalOpen(false)}
                      className="px-4 py-2 rounded-sm border border-line bg-card hover:bg-paper-deep text-[12.5px] font-medium text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteMigration}
                      disabled={isMigrating || !migSourceAdminId || !migTargetAdminId || migSourceAdminId === migTargetAdminId}
                      className="px-6 py-2 rounded-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-[13px] font-semibold transition cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isMigrating ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Executing Handover…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          <span>Confirm &amp; Complete Handover</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* STEP 5: MIGRATION CERTIFICATE */}
            {migStep === 5 && migSuccessCert && (
              <div className="p-6 space-y-5 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={32} />
                </div>

                <div>
                  <h3 className="font-serif text-[22px] font-semibold text-ink">
                    Data Migration Completed Successfully!
                  </h3>
                  <p className="text-[12.5px] text-ink-faint mt-1 max-w-md mx-auto">
                    All portfolio entities, Gaushalas, managers, and banking
                    routing have been cleanly migrated to{" "}
                    <strong>{migSuccessCert.targetAdminName}</strong>.
                  </p>
                </div>

                {/* Formal Certificate Card */}
                <div className="p-4 bg-paper/80 border border-line rounded-sm text-left text-[12.5px] space-y-2 max-w-md mx-auto font-sans shadow-2xs">
                  <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[11px]">
                    <span className="text-ink-faint">TRANSACTION ID:</span>
                    <span className="font-bold text-indigo-700">
                      {migSuccessCert.id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Old Admin:</span>
                    <span className="font-medium text-red-900">
                      {migSuccessCert.sourceAdminName} (
                      {migSuccessCert.sourceDeactivated
                        ? "Deactivated"
                        : "Active"}
                      )
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">New Appointed Admin:</span>
                    <span className="font-semibold text-emerald-900">
                      {migSuccessCert.targetAdminName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Territory:</span>
                    <span className="font-medium">
                      {migSuccessCert.regionName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Gaushalas Migrated:</span>
                    <span className="font-mono font-bold">
                      {migSuccessCert.transferredGosalas?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Banking Routing:</span>
                    <span className="font-mono text-[11px]">
                      {migSuccessCert.targetBankDetailsSummary}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-line text-[11px] text-ink-faint">
                    Certified by: {migSuccessCert.operatorName} on{" "}
                    {new Date(migSuccessCert.timestamp).toLocaleString("en-IN")}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(migSuccessCert, null, 2),
                      )
                      notify("Certificate JSON copied", "ok")
                    }}
                    className="px-4 py-2 rounded-sm border border-line bg-card hover:bg-paper-deep text-[12.5px] font-medium text-ink cursor-pointer flex items-center gap-1.5"
                  >
                    <Copy size={13} />
                    <span>Copy Certificate</span>
                  </button>
                  <button
                    onClick={() => {
                      setMigrationModalOpen(false)
                      setActiveTab("migrations")
                    }}
                    className="px-5 py-2 rounded-sm bg-forest hover:bg-forest/90 text-white text-[12.5px] font-medium transition cursor-pointer"
                  >
                    View in Migration Audit Log
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REASSIGN GAUSHALA GOVERNING OPERATIONAL ADMIN                   */}
      {/* ========================================================================= */}
      {gosalaAssignModalOpen && selectedGosalaForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-line rounded-md shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-saffron-deep" />
                <h3 className="font-serif text-[17px] font-semibold text-ink">
                  Reassign Gaushala Governing Admin
                </h3>
              </div>
              <button
                onClick={() => {
                  setGosalaAssignModalOpen(false)
                  setSelectedGosalaForAssign(null)
                }}
                className="text-ink-faint hover:text-ink p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-paper rounded border border-line space-y-1 text-[12.5px]">
              <div>
                <span className="text-ink-faint">Sanctuary:</span>{" "}
                <strong className="text-ink">{selectedGosalaForAssign.name}</strong>
              </div>
              <div>
                <span className="text-ink-faint">Territory:</span>{" "}
                <span className="text-ink font-medium">{selectedGosalaForAssign.region}</span>
              </div>
              <div>
                <span className="text-ink-faint">Current Admin:</span>{" "}
                <span className="text-ink font-semibold">
                  {selectedGosalaForAssign.adminName ||
                    selectedGosalaForAssign.governingAdminName ||
                    "Super Admin (Direct Portfolio)"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-ink">
                Appoint Operational Admin <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedAdminIdForGosalaAssign}
                onChange={(e) => setSelectedAdminIdForGosalaAssign(e.target.value)}
                className="w-full bg-paper border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron"
              >
                <option value="USER-SA-001">
                  Direct Super Admin Sovereign Oversight (superadmin@gomaa.in)
                </option>
                {operationalAdmins.map((adm) => (
                  <option key={adm.id} value={adm.id}>
                    {adm.name} — {adm.assignedRegionName || "Free Pool"} ({adm.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-saffron-soft/20 border border-saffron/20 rounded text-[11px] text-ink-soft leading-relaxed">
              When confirmed, this Gaushala and all its animals, bookings, and managers will transition under the selected Operational Admin. The previous admin will immediately lose operational access.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                disabled={isGosalaAssigning}
                onClick={() => {
                  setGosalaAssignModalOpen(false)
                  setSelectedGosalaForAssign(null)
                }}
                className="px-4 py-2 rounded-sm border border-line text-[12.5px] font-medium text-ink-soft hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGosalaAssigning}
                onClick={async () => {
                  if (!selectedGosalaForAssign) return
                  setIsGosalaAssigning(true)
                  try {
                    const selectedAdm = operationalAdmins.find(
                      (a) => a.id === selectedAdminIdForGosalaAssign,
                    )
                    await assignGosalaAdmin(
                      selectedGosalaForAssign.id,
                      selectedAdminIdForGosalaAssign,
                      selectedAdm?.email,
                      selectedAdm?.name,
                    )
                    setGosalaAssignModalOpen(false)
                    setSelectedGosalaForAssign(null)
                  } catch (e: any) {
                    notify(e.message || "Failed to reassign Gaushala", "err")
                  } finally {
                    setIsGosalaAssigning(false)
                  }
                }}
                className="px-5 py-2 rounded-sm bg-saffron hover:bg-saffron-deep text-white text-[12.5px] font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                {isGosalaAssigning ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Reassigning...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm Assignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
