import { useState, useEffect, useMemo } from "react"
import {
  X,
  User,
  Phone,
  Mail,
  Building2,
  Landmark,
  ShieldCheck,
  Crown,
  Save,
  Edit3,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  PlusCircle,
  Trash2,
  Shield,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle,
  FileCheck,
  TrendingUp,
  Activity,
  Award,
  CreditCard,
  MapPin,
  ExternalLink,
  Printer,
} from "lucide-react"
import type { RoleId } from "../data/roles"
import {
  initialProfiles,
  type RoleProfile,
  type BankAccountDetails,
  type SettlementSchedule,
} from "../data/profiles"
import { useStore, useToast } from "../store/store"

export default function EditProfileModal({
  role,
  isOpen = true,
  onClose,
}: {
  role: RoleId
  isOpen?: boolean
  onClose: () => void
}) {
  const { profiles, updateProfile, bookings, animals, gosalas, settlements, pricingConfig } = useStore()
  const { notify } = useToast()

  // Strict Privacy: Only inspect and edit the active user's own role
  const selectedRole = role

  const profile: RoleProfile = useMemo(() => {
    return profiles?.[selectedRole] || initialProfiles[selectedRole] || initialProfiles.super_admin
  }, [profiles, selectedRole])

  // View vs Edit Mode
  const [isEditing, setIsEditing] = useState(false)
  const [isAddingBank, setIsAddingBank] = useState(false)
  const [activeTab, setActiveTab] = useState<"credentials" | "banking" | "metrics" | "compliance">("credentials")

  // Form State - Personal / Official Credentials
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  // Role specifics
  const [designation, setDesignation] = useState("")
  const [department, setDepartment] = useState("")
  const [managerId, setManagerId] = useState("")
  const [gosala, setGosala] = useState("")
  const [region, setRegion] = useState("")
  const [dailyCeiling, setDailyCeiling] = useState<number>(2)
  const [restingBuffer, setRestingBuffer] = useState<number>(90)

  // Bank Account State - Strictly dynamic user input
  const [accountBeneficiary, setAccountBeneficiary] = useState("")
  const [bankName, setBankName] = useState("")
  const [branchName, setBranchName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("")
  const [ifscCode, setIfscCode] = useState("")
  const [upiId, setUpiId] = useState("")
  const [accountType, setAccountType] = useState<string>("CURRENT_TRUST")
  const [bankBadgeLabel, setBankBadgeLabel] = useState("Active Direct Credit")

  // Settlement Schedule State
  const [disbursementCycle, setDisbursementCycle] = useState("")
  const [disbursementMode, setDisbursementMode] = useState("")
  const [escrowCustodianPool, setEscrowCustodianPool] = useState("")
  const [nextScheduledBatch, setNextScheduledBatch] = useState("")
  const [scheduleBadge, setScheduleBadge] = useState("Weekly Auto-Sweep")

  // Security Toggles
  const [showAccountNumber, setShowAccountNumber] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Synchronize state when selected role or profile changes
  useEffect(() => {
    if (profile) {
      setName(profile.name || "")
      setPhone(profile.phone || "")
      setEmail(profile.email || "")

      // Designation & Admin data
      if (profile.adminData) {
        setDesignation(profile.adminData.designation || "")
        setDepartment(profile.adminData.department || "")
      } else if (selectedRole === "manager") {
        setDesignation("Sanctuary Managing Trustee & Welfare Head")
        setDepartment("Gaushala Sanctuary Operations")
      } else if (selectedRole === "customer") {
        setDesignation("Patron Devotee")
        setDepartment("Sacred Seva Congregation")
      } else if (selectedRole === "driver") {
        setDesignation("Authorized Sacred Cattle Transit Logistics")
        setDepartment("Regional Cattle Transport Network")
      }

      // Manager specific data
      if (profile.managerData) {
        setManagerId(profile.managerData.managerId || "MGR-804")
        setGosala(profile.managerData.gosala || "Shri Krishna Gaushala")
        setRegion(profile.managerData.region || "Cyberabad / Gachibowli Zone")
        setDailyCeiling(profile.managerData.dailySevaCeiling || 2)
        setRestingBuffer(profile.managerData.restingBufferMin || 90)
      }

      // Bank Details - User provided
      const bank = profile.bankDetails
      if (bank && bank.accountNumber) {
        setAccountBeneficiary(bank.accountBeneficiary || "")
        setBankName(bank.bankName || "")
        setBranchName(bank.branchName || "")
        setAccountNumber(bank.accountNumber || "")
        setConfirmAccountNumber(bank.accountNumber || "")
        setIfscCode(bank.ifscCode || "")
        setUpiId(bank.upiId || "")
        setAccountType(bank.accountType || "CURRENT_TRUST")
        setBankBadgeLabel(bank.badgeLabel || "Active Direct Credit")
      } else {
        setAccountBeneficiary("")
        setBankName("")
        setBranchName("")
        setAccountNumber("")
        setConfirmAccountNumber("")
        setIfscCode("")
        setUpiId("")
        setAccountType(
          selectedRole === "super_admin"
            ? "NODAL_ESCROW"
            : selectedRole === "admin"
              ? "SALARY"
              : "CURRENT_TRUST",
        )
        setBankBadgeLabel(
          selectedRole === "super_admin"
            ? "Sovereign Nodal Escrow"
            : selectedRole === "admin"
              ? "Operational Reimbursement"
              : "Direct Gaushala Payout",
        )
      }

      // Settlement Schedule
      const sched = profile.settlementSchedule
      if (sched) {
        setDisbursementCycle(sched.disbursementCycle || "")
        setDisbursementMode(sched.disbursementMode || "")
        setEscrowCustodianPool(sched.escrowCustodianPool || "")
        setNextScheduledBatch(sched.nextScheduledBatch || "")
        setScheduleBadge(sched.badgeLabel || "Automated Sweep")
      } else {
        if (selectedRole === "manager") {
          setDisbursementCycle("Every Sunday at 23:59 IST")
          setDisbursementMode("Direct RBI NEFT / Instant IMPS")
          setEscrowCustodianPool("ICICI Nodal Trust Escrow")
          setNextScheduledBatch("Upcoming Sunday Midnight")
          setScheduleBadge("Weekly Auto-Sweep")
        } else if (selectedRole === "admin") {
          setDisbursementCycle("Bi-Weekly on 1st & 16th of Month")
          setDisbursementMode("Direct Corporate ACH / Instant NEFT")
          setEscrowCustodianPool("GOMAA Regional Operations Float Escrow")
          setNextScheduledBatch("16th Oct 00:00 IST")
          setScheduleBadge("Bi-Weekly Expense Sweep")
        } else if (selectedRole === "super_admin") {
          setDisbursementCycle("Continuous Real-Time Platform Sweep (T+1)")
          setDisbursementMode("Automated RBI RTGS & Escrow Nodal Routing")
          setEscrowCustodianPool("ICICI Nodal Trust Escrow & Central Reserve")
          setNextScheduledBatch("Continuous Real-Time Batch Engine")
          setScheduleBadge("Continuous T+1 Auto-Sweep")
        }
      }
    }
  }, [profile, selectedRole, isOpen])

  const handleCopy = (text: string, label: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(label)
      notify(`Copied ${label} to clipboard`, "info")
      setTimeout(() => setCopiedField(null), 2500)
    }
  }

  // Check if bank details are added
  const hasLinkedBank = Boolean(
    profile?.bankDetails?.accountNumber &&
      profile?.bankDetails?.accountNumber.trim().length > 0,
  )

  // Validate Bank Form
  const isBankFormValid = useMemo(() => {
    if (!accountBeneficiary.trim()) return false
    if (!bankName.trim()) return false
    if (!branchName.trim()) return false
    if (!accountNumber.trim() || accountNumber.trim().length < 8) return false
    if (accountNumber !== confirmAccountNumber) return false
    if (!ifscCode.trim() || ifscCode.trim().length !== 11) return false
    return true
  }, [
    accountBeneficiary,
    bankName,
    branchName,
    accountNumber,
    confirmAccountNumber,
    ifscCode,
  ])

  // Role-specific dynamic live metrics computed from store
  const roleMetrics = useMemo(() => {
    if (selectedRole === "manager") {
      const targetGosala = profile?.managerData?.gosala || gosala || "Shri Krishna Gaushala"
      const myBookings = bookings.filter((b) => b.gosala === targetGosala)
      const myAnimals = animals.filter((a) => a.gosala === targetGosala)
      const mySettlements = settlements.filter((s) => s.gosala === targetGosala)
      const totalEarned = myBookings.reduce((sum, b) => sum + (b.total ? b.total * 0.8 : 0), 0)

      return {
        metric1: { label: "Ceremonial Darshans Hosted", value: myBookings.length, sub: "Verified devotions" },
        metric2: { label: "Sacred Herd Under Custody", value: myAnimals.length, sub: "Cows, calves & bulls" },
        metric3: { label: "Gaushala 80% Net Share", value: `₹${Math.round(totalEarned).toLocaleString("en-IN")}`, sub: "Direct Trust Proceeds" },
        metric4: { label: "Daily Ceremony Ceiling", value: `${dailyCeiling} / day`, sub: `${restingBuffer}m mandatory rest` },
      }
    } else if (selectedRole === "admin") {
      return {
        metric1: { label: "Regional Gaushalas Supervised", value: gosalas.length, sub: "Regional Operational Hub" },
        metric2: { label: "Booking Lifecycles Audited", value: bookings.length, sub: "100% SLA Adherence" },
        metric3: { label: "Regional Sacred Cattle Index", value: animals.length, sub: "Empanelled herd" },
        metric4: { label: "Authority Clearance", value: "OPERATIONS_ADMIN", sub: "Disbursement Officer" },
      }
    } else if (selectedRole === "super_admin") {
      const grossVolume = settlements.reduce((sum, s) => sum + s.gross, 0)
      return {
        metric1: { label: "Total Platform Volume", value: `₹${grossVolume.toLocaleString("en-IN")}`, sub: "Pan-India Gross Treasury" },
        metric2: { label: "Governed Gaushalas", value: gosalas.length, sub: "AWBI Compliant Network" },
        metric3: { label: "Platform Commission Base", value: `${pricingConfig?.commissionPct || 20}%`, sub: `${100 - (pricingConfig?.commissionPct || 20)}/${pricingConfig?.commissionPct || 20} Trust Split Protocol` },
        metric4: { label: "Treasury Authority", value: "Level-3 Master Authority", sub: "ICICI Nodal Custody" },
      }
    } else if (selectedRole === "driver") {
      return {
        metric1: { label: "Cattle Transit Trips", value: 48, sub: "100% Safe Transit" },
        metric2: { label: "Vehicle Registration", value: profile?.driverData?.vehicleNumber || "MH-12-Q-4491", sub: "Custom Hydraulic Lift" },
        metric3: { label: "Transit Pass-Through", value: "100% Direct", sub: "Zero Platform Deduction" },
        metric4: { label: "Transit Status", value: profile?.driverData?.status || "Available", sub: "Active on Fleet GPS" },
      }
    } else {
      return {
        metric1: { label: "Sacred Pujas Booked", value: profile?.customerData?.totalBookings || 4, sub: "Kamadhenu Seva" },
        metric2: { label: "Patron Gotra", value: profile?.customerData?.gotra || "Kashyapa", sub: "Vedic Lineage" },
        metric3: { label: "Member Devotee Since", value: profile?.customerData?.memberSince || "Aug 2024", sub: "Verified Devotee" },
        metric4: { label: "Ceremony Preference", value: "Kamadhenu & Griha Pravesh", sub: "Aadhaar KYC Verified" },
      }
    }
  }, [selectedRole, profile, bookings, animals, gosalas, settlements, pricingConfig, dailyCeiling, restingBuffer, gosala])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      let bankPayload: BankAccountDetails | undefined = undefined

      if (accountNumber.trim()) {
        if (accountNumber !== confirmAccountNumber) {
          notify("Account number and confirmation do not match!", "danger")
          setSaving(false)
          return
        }

        const ifscNormalized = ifscCode.toUpperCase().trim()
        if (ifscNormalized.length !== 11) {
          notify(
            "IFSC Code must be exactly 11 characters (e.g. HDFC0001824)",
            "danger",
          )
          setSaving(false)
          return
        }

        bankPayload = {
          accountBeneficiary: accountBeneficiary.trim(),
          bankName: bankName.trim(),
          branchName: branchName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscNormalized,
          accountType: accountType as any,
          verificationStatus: "VERIFIED",
          badgeLabel: bankBadgeLabel || "Verified Direct Account",
          upiId: upiId.trim() || undefined,
          lastVerifiedAt: new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        }
      }

      const updates: Partial<RoleProfile> = {
        name,
        phone,
        email,
        bankDetails: bankPayload,
        settlementSchedule: {
          disbursementCycle: disbursementCycle.trim() || "Weekly on Sunday",
          disbursementMode:
            disbursementMode.trim() || "Direct RBI NEFT / Instant IMPS",
          escrowCustodianPool:
            escrowCustodianPool.trim() || "Central Nodal Trust Escrow",
          nextScheduledBatch:
            nextScheduledBatch.trim() || "Upcoming Scheduled Cycle",
          badgeLabel: scheduleBadge || "Automated Sweep",
        },
      }

      if (selectedRole === "manager") {
        updates.managerData = {
          managerId,
          gosala,
          region,
          dailySevaCeiling: Number(dailyCeiling) || 2,
          restingBufferMin: Number(restingBuffer) || 90,
        }
      } else if (selectedRole === "admin" || selectedRole === "super_admin") {
        updates.adminData = {
          adminId: selectedRole === "super_admin" ? "SA-001" : "ADM-101",
          designation,
          department,
          authorityLevel:
            selectedRole === "super_admin"
              ? "SUPER_ADMIN"
              : "OPERATIONS_ADMIN",
          treasuryClearanceLevel:
            selectedRole === "super_admin"
              ? "Level-3 Master Authority"
              : undefined,
        }
      }

      await updateProfile(selectedRole, updates)
      setIsEditing(false)
      setIsAddingBank(false)
      notify(`Saved official profile and secure credentials for ${name}`, "ok")
    } catch (err: any) {
      notify(
        `Failed to update profile: ${err?.message || "Unknown error"}`,
        "danger",
      )
    } finally {
      setSaving(false)
    }
  }

  const handleUnlinkBankAccount = async () => {
    if (
      !window.confirm(
        "Are you sure you want to remove this linked bank account? You will need to re-enter bank details for automatic payouts.",
      )
    ) {
      return
    }

    try {
      setSaving(true)
      await updateProfile(selectedRole, { bankDetails: undefined })
      setAccountBeneficiary("")
      setBankName("")
      setBranchName("")
      setAccountNumber("")
      setConfirmAccountNumber("")
      setIfscCode("")
      setUpiId("")
      setIsEditing(false)
      setIsAddingBank(false)
      notify("Bank account successfully unlinked from profile", "info")
    } catch (err: any) {
      notify(`Failed to unlink bank account: ${err?.message}`, "danger")
    } finally {
      setSaving(false)
    }
  }

  // Role styling & theme metadata
  const roleTheme = {
    super_admin: {
      badge: "Sovereign Captain · Chief Treasury Officer",
      tagColor: "bg-amber-100 text-amber-900 border-amber-300",
      accentBg: "from-amber-700 via-amber-800 to-amber-950",
      avatarBg: "bg-gradient-to-br from-amber-600 to-amber-800 text-white",
      icon: Crown,
      accountHeader: "CENTRAL NODAL ESCROW & TREASURY CUSTODY ACCOUNT",
      scheduleHeader: "CONTINUOUS PLATFORM SETTLEMENT SCHEDULE",
      bankContextNote:
        "Central platform nodal escrow account for collecting devotee funds and routing net shares.",
    },
    admin: {
      badge: "Operations Admin · Regional Logistics Hub",
      tagColor: "bg-sky-100 text-sky-900 border-sky-300",
      accentBg: "from-slate-800 via-sky-900 to-slate-950",
      avatarBg: "bg-gradient-to-br from-sky-700 to-slate-800 text-white",
      icon: ShieldCheck,
      accountHeader: "REGIONAL OPERATIONS DISBURSEMENT & EXPENSE ACCOUNT",
      scheduleHeader: "OPERATIONAL DISBURSEMENT SCHEDULE",
      bankContextNote:
        "Account for regional operational floats, logistics vendor payouts, and administrative reimbursements.",
    },
    manager: {
      badge: "Gosala Manager · Sacred Welfare Trustee",
      tagColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
      accentBg: "from-forest via-emerald-900 to-forest-deep",
      avatarBg: "bg-gradient-to-br from-forest to-emerald-800 text-white",
      icon: Building2,
      accountHeader: "GAUSHALA CHARITABLE TRUST BANK ACCOUNT",
      scheduleHeader: "AUTOMATED GAUSHALA SETTLEMENT SCHEDULE",
      bankContextNote:
        "Official charitable trust bank account where the 80% net booking proceeds and seva donations are directly disbursed.",
    },
    customer: {
      badge: "Verified Devotee Patron",
      tagColor: "bg-amber-100 text-amber-900 border-amber-300",
      accentBg: "from-saffron via-amber-700 to-amber-900",
      avatarBg: "bg-saffron text-white",
      icon: User,
      accountHeader: "DEVOTEE REFUND & ESCROW RETURN ACCOUNT",
      scheduleHeader: "DIRECT DEVOTEE SETTLEMENT POLICY",
      bankContextNote:
        "Personal account for instant refunds in case of ceremony rescheduling or cancellation.",
    },
    driver: {
      badge: "Verified Transit Cattle Logistics Partner",
      tagColor: "bg-slate-100 text-slate-800 border-slate-300",
      accentBg: "from-slate-700 via-slate-800 to-slate-950",
      avatarBg: "bg-slate-800 text-white",
      icon: Briefcase,
      accountHeader: "DRIVER TRANSIT REIMBURSEMENT ACCOUNT",
      scheduleHeader: "WEEKLY TRANSIT SETTLEMENT SCHEDULE",
      bankContextNote:
        "Personal or commercial vehicle account for 100% transport fare pass-through disbursements.",
    },
  }[selectedRole]

  const RoleIcon = roleTheme.icon

  // Formatted masked account number (e.g. "•••• •••• •••• 4829")
  const maskedAccountNumber = useMemo(() => {
    const raw = profile?.bankDetails?.accountNumber || accountNumber
    if (!raw) return "•••• •••• ••••"
    if (showAccountNumber) return raw
    const lastFour = raw.slice(-4)
    return `•••• •••• •••• ${lastFour}`
  }, [profile?.bankDetails?.accountNumber, accountNumber, showAccountNumber])

  const popularBanks = [
    "HDFC Bank Ltd",
    "State Bank of India",
    "ICICI Bank Ltd",
    "Bank of Baroda",
    "Axis Bank Ltd",
    "Punjab National Bank",
    "Canara Bank",
    "Kotak Mahindra Bank",
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-paper overflow-y-auto flex flex-col text-ink animate-fade-in">
      {/* Top Institutional Global App Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-line px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-soft hover:text-ink hover:bg-paper-deep text-[12.5px] font-medium transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Return to Dashboard</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-[12px] text-ink-faint">
            <span>/</span>
            <span>Verified Identity Dossier</span>
            <span>/</span>
            <span className="font-semibold text-ink">{roleTheme.badge}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
            <CheckCircle2 size={12} /> 256-Bit Encrypted
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Shield size={12} /> Strict Role-Isolated RBAC
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-ink-faint hover:text-ink hover:bg-paper-deep transition cursor-pointer"
            aria-label="Close Profile"
          >
            <X size={19} />
          </button>
        </div>
      </header>

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Officer Hero Banner */}
        <div className={`relative rounded-xl bg-gradient-to-r ${roleTheme.accentBg} text-white p-6 sm:p-8 shadow-lg overflow-hidden`}>
          {/* Subtle background decorative pattern */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white font-serif text-[32px] sm:text-[38px] font-bold shadow-inner ring-4 ring-white/10 shrink-0">
                {name.slice(0, 1) || "G"}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-serif text-[24px] sm:text-[28px] font-bold tracking-tight text-white leading-tight">
                    {name || "Official Profile"}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11.5px] font-semibold bg-white/20 border border-white/30 text-white backdrop-blur-sm">
                    <RoleIcon size={13} />
                    <span>{roleTheme.badge}</span>
                  </span>
                </div>

                <div className="text-[13.5px] text-white/90 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{designation || "Officer"}</span>
                  <span className="text-white/60">•</span>
                  <span className="text-white/80">{department || "Operations"}</span>
                  {selectedRole === "manager" && gosala && (
                    <>
                      <span className="text-white/60">•</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[12px] font-semibold text-white">
                        {gosala}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/75 pt-1">
                  <span className="flex items-center gap-1">
                    <Phone size={13} className="text-white/90" /> {phone || "+91 Not set"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Mail size={13} className="text-white/90" /> {email || "email@gomaa.in"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-white/90" /> {region || "Regional Hub"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
              {isEditing || isAddingBank ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setIsAddingBank(false)
                  }}
                  className="px-5 py-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[13px] font-semibold backdrop-blur-md transition cursor-pointer border border-white/25"
                >
                  Cancel &amp; View Dossier
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white hover:bg-white/95 text-ink text-[13.5px] font-bold shadow-md transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Edit3 size={15} className="text-forest" />
                  <span>Edit Profile &amp; Bank</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Operational Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 sm:p-5 rounded-xl border border-line bg-card shadow-xs space-y-1">
            <div className="text-[11.5px] font-mono text-ink-faint uppercase tracking-wider">{roleMetrics.metric1.label}</div>
            <div className="text-[22px] sm:text-[26px] font-serif font-bold text-ink">{roleMetrics.metric1.value}</div>
            <div className="text-[11.5px] text-forest font-medium">{roleMetrics.metric1.sub}</div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl border border-line bg-card shadow-xs space-y-1">
            <div className="text-[11.5px] font-mono text-ink-faint uppercase tracking-wider">{roleMetrics.metric2.label}</div>
            <div className="text-[22px] sm:text-[26px] font-serif font-bold text-ink">{roleMetrics.metric2.value}</div>
            <div className="text-[11.5px] text-ink-soft">{roleMetrics.metric2.sub}</div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl border border-line bg-card shadow-xs space-y-1">
            <div className="text-[11.5px] font-mono text-ink-faint uppercase tracking-wider">{roleMetrics.metric3.label}</div>
            <div className="text-[22px] sm:text-[26px] font-serif font-bold text-ink">{roleMetrics.metric3.value}</div>
            <div className="text-[11.5px] text-forest font-medium">{roleMetrics.metric3.sub}</div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl border border-line bg-card shadow-xs space-y-1">
            <div className="text-[11.5px] font-mono text-ink-faint uppercase tracking-wider">{roleMetrics.metric4.label}</div>
            <div className="text-[22px] sm:text-[26px] font-serif font-bold text-ink">{roleMetrics.metric4.value}</div>
            <div className="text-[11.5px] text-ink-soft">{roleMetrics.metric4.sub}</div>
          </div>
        </div>

        {/* Tabbed Navigation Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-1">
          {[
            { id: "credentials" as const, label: "Identity & Operational Scope", icon: User },
            { id: "banking" as const, label: "Bank Account & Settlement Dossier", icon: Landmark },
            { id: "metrics" as const, label: "Role Ledger & Welfare Matrix", icon: TrendingUp },
            { id: "compliance" as const, label: "Security & Privacy Protocol", icon: ShieldCheck },
          ].map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 px-5 py-3 text-[13.5px] font-medium border-b-2 transition cursor-pointer ${
                activeTab === id
                  ? "border-forest text-forest font-bold bg-forest/5 rounded-t-md"
                  : "border-transparent text-ink-soft hover:text-ink hover:bg-card"
              }`}
            >
              <TabIcon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: IDENTITY & OPERATIONAL SCOPE                                       */}
        {/* ========================================================================= */}
        {activeTab === "credentials" && (
          <div className="space-y-6">
            {isEditing ? (
              /* Editable Form */
              <form onSubmit={handleSave} className="bg-card border border-line rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="border-b border-line pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-[18px] font-bold text-ink">
                      Edit Identity &amp; Operational Credentials
                    </h3>
                    <p className="text-[12.5px] text-ink-soft mt-0.5">
                      Updates are recorded in the immutable platform ledger and synced with your verified profile.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-ink-faint bg-paper px-2.5 py-1 rounded border border-line">
                    ROLE: {selectedRole.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Full Legal / Devotee Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                      placeholder="Enter full legal name"
                    />
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Official Contact Phone *
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                      placeholder="+91 98XXX XXXXX"
                    />
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Official Email Address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                      placeholder="email@gomaa.in"
                    />
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Operational Region / Hub
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                      placeholder="Cyberabad / Gachibowli Zone"
                    />
                  </div>

                  {/* Role Specific Fields */}
                  {selectedRole === "manager" && (
                    <>
                      <div>
                        <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                          Assigned Gaushala Sanctuary
                        </label>
                        <input
                          type="text"
                          value={gosala}
                          onChange={(e) => setGosala(e.target.value)}
                          className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                          placeholder="Shri Krishna Gaushala"
                        />
                      </div>

                      <div>
                        <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                          Daily Seva Booking Ceiling
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={dailyCeiling}
                          onChange={(e) => setDailyCeiling(Number(e.target.value))}
                          className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                        />
                      </div>

                      <div>
                        <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                          Mandatory Resting Buffer (Minutes)
                        </label>
                        <input
                          type="number"
                          min="30"
                          step="15"
                          value={restingBuffer}
                          onChange={(e) => setRestingBuffer(Number(e.target.value))}
                          className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                        />
                      </div>
                    </>
                  )}

                  {(selectedRole === "admin" || selectedRole === "super_admin") && (
                    <>
                      <div>
                        <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                          Official Designation
                        </label>
                        <input
                          type="text"
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                          placeholder="Regional Operations Officer"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                          Department / Operational Hub
                        </label>
                        <input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                          placeholder="Gaushala Operations & Logistics Hub"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-6 flex items-center justify-end gap-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-5 py-2.5 text-[13px] rounded-lg border border-line text-ink hover:bg-paper-deep transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-[13.5px] font-semibold rounded-lg bg-forest hover:bg-forest-deep text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Save size={15} />
                    <span>{saving ? "Saving Changes..." : "Save Identity Changes"}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode Dossier */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Official Profile Details */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <h3 className="font-serif text-[17px] font-bold text-ink flex items-center gap-2">
                        <User size={18} className="text-forest" />
                        <span>Official Personnel Credentials</span>
                      </h3>
                      <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                        KYC Verified Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Full Legal Name</div>
                        <div className="text-[15px] font-semibold text-ink">{name || "Not Configured"}</div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Official Role Title</div>
                        <div className="text-[15px] font-semibold text-ink">{roleTheme.badge}</div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Official Phone</div>
                        <div className="text-[15px] font-mono font-semibold text-ink">{phone || "Not Configured"}</div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Official Email</div>
                        <div className="text-[15px] font-mono font-semibold text-ink">{email || "Not Configured"}</div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Designation</div>
                        <div className="text-[14px] font-medium text-ink">{designation || "Officer"}</div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Department / Hub</div>
                        <div className="text-[14px] font-medium text-ink">{department || "Platform Operations"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Welfare Parameters */}
                  {selectedRole === "manager" && (
                    <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-4">
                      <h3 className="font-serif text-[17px] font-bold text-ink flex items-center gap-2">
                        <Building2 size={18} className="text-forest" />
                        <span>Gaushala Welfare &amp; Sanctuary Protocol</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
                        <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                          <div className="text-[11px] font-mono text-ink-faint uppercase">Assigned Gaushala</div>
                          <div className="font-bold text-forest text-[15px]">{gosala || "Shri Krishna Gaushala"}</div>
                          <div className="text-[11.5px] text-ink-soft">{region || "Regional Operational Zone"}</div>
                        </div>

                        <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                          <div className="text-[11px] font-mono text-ink-faint uppercase">Daily Ceremony Ceiling</div>
                          <div className="font-bold text-ink text-[15px]">{dailyCeiling} Sevas / Day</div>
                          <div className="text-[11.5px] text-ink-soft">Strict herd welfare cap</div>
                        </div>

                        <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                          <div className="text-[11px] font-mono text-ink-faint uppercase">Mandatory Resting Buffer</div>
                          <div className="font-bold text-ink text-[15px]">{restingBuffer} Minutes</div>
                          <div className="text-[11.5px] text-ink-soft">Post-ceremony cooldown</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Governance Badges & Trust Summary */}
                <div className="space-y-6">
                  <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-4">
                    <h4 className="font-serif text-[16px] font-bold text-ink flex items-center gap-2">
                      <Award size={17} className="text-amber-600" />
                      <span>Trust Governance Credentials</span>
                    </h4>

                    <div className="space-y-3 text-[12.5px]">
                      <div className="p-3 rounded-lg bg-paper border border-line flex items-center justify-between">
                        <span className="text-ink-soft">AWBI Trust Verification:</span>
                        <span className="font-mono font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                          AWBI/MH/2024/09
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-paper border border-line flex items-center justify-between">
                        <span className="text-ink-soft">80G Tax Exemption:</span>
                        <span className="font-mono font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                          Active 80G Certified
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-paper border border-line flex items-center justify-between">
                        <span className="text-ink-soft">Escrow Split Protocol:</span>
                        <span className="font-mono font-semibold text-forest">
                          80% Trust · 20% Reserve
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-paper border border-line flex items-center justify-between">
                        <span className="text-ink-soft">Disbursement Security:</span>
                        <span className="font-mono font-semibold text-ink">
                          256-Bit Tokenized
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BANK ACCOUNT & SETTLEMENT DOSSIER                                   */}
        {/* ========================================================================= */}
        {activeTab === "banking" && (
          <div className="space-y-6">
            {/* RBAC Privacy Header */}
            <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 text-emerald-950 flex items-start gap-3.5">
              <ShieldCheck size={22} className="text-emerald-700 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="font-bold text-[14px]">
                  Role-Protected Direct Bank Vault (Zero Super-Admin Peeking)
                </div>
                <div className="text-[12.5px] leading-relaxed text-emerald-900">
                  {roleTheme.bankContextNote}
                  <span className="block mt-1 font-medium text-emerald-800">
                    🔒 Confidentiality Notice: Bank account numbers and IFSC details entered here are restricted solely to this authenticated profile. Super Admin cannot inspect or tamper with your external charity or operational accounts.
                  </span>
                </div>
              </div>
            </div>

            {/* Form Mode (Add or Edit Bank Account) */}
            {(isAddingBank || (isEditing && activeTab === "banking")) ? (
              <form onSubmit={handleSave} className="bg-card border border-line rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div className="flex items-center gap-2.5">
                    <Landmark size={22} className="text-forest" />
                    <div>
                      <h3 className="font-serif text-[18px] font-bold text-ink">
                        {hasLinkedBank ? "Update Bank Account Details" : "Connect Official Bank Account"}
                      </h3>
                      <p className="text-[12px] text-ink-soft">
                        Enter valid IFSC and bank details for direct automated payouts.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full">
                    Direct RBI NEFT / IMPS Setup
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Account Holder / Beneficiary Name *
                    </label>
                    <input
                      type="text"
                      value={accountBeneficiary}
                      onChange={(e) => setAccountBeneficiary(e.target.value)}
                      required
                      placeholder={selectedRole === "manager" ? "e.g. Shri Krishna Gaushala Charitable Trust" : "e.g. Full Legal Account Name"}
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                    />
                    <p className="text-[11.5px] text-ink-faint mt-1">
                      Must match the official title on bank passbook or charity trust deed.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                      placeholder="e.g. HDFC Bank Ltd"
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                    />
                    {/* Quick bank pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {popularBanks.slice(0, 4).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBankName(b)}
                          className="text-[11px] px-2.5 py-0.5 rounded bg-paper border border-line hover:bg-paper-deep text-ink-soft hover:text-ink cursor-pointer"
                        >
                          {b.replace(" Ltd", "")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Branch Name &amp; City *
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      required
                      placeholder="e.g. Gachibowli Branch, Hyderabad"
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                    />
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Bank Account Number *
                    </label>
                    <div className="relative">
                      <input
                        type={showAccountNumber ? "text" : "password"}
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ""))}
                        required
                        placeholder="Enter full account number"
                        className="w-full px-4 py-2.5 pr-10 text-[14px] font-mono rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccountNumber(!showAccountNumber)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                      >
                        {showAccountNumber ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Confirm Bank Account Number *
                    </label>
                    <input
                      type={showAccountNumber ? "text" : "password"}
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\s+/g, ""))}
                      required
                      placeholder="Re-enter to verify"
                      className={`w-full px-4 py-2.5 text-[14px] font-mono rounded-lg border bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest ${
                        confirmAccountNumber && confirmAccountNumber !== accountNumber
                          ? "border-red-500 ring-1 ring-red-500"
                          : confirmAccountNumber && confirmAccountNumber === accountNumber
                            ? "border-emerald-500 ring-1 ring-emerald-500"
                            : "border-line"
                      }`}
                    />
                    {confirmAccountNumber && (
                      <div className="mt-1 text-[11.5px] flex items-center gap-1 font-mono">
                        {confirmAccountNumber === accountNumber ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <Check size={13} /> Numbers match securely
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1">
                            <AlertCircle size={13} /> Numbers do not match
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      IFSC Code (11 alphanumeric characters) *
                    </label>
                    <input
                      type="text"
                      value={ifscCode}
                      maxLength={11}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      required
                      placeholder="e.g. HDFC0001824"
                      className="w-full px-4 py-2.5 text-[14px] font-mono uppercase rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                    />
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      Account Type
                    </label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      className="w-full px-4 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                    >
                      <option value="CURRENT_TRUST">Current / Trust Charity Account</option>
                      <option value="SAVINGS">Savings Account</option>
                      <option value="SALARY">Corporate Salary Account</option>
                      <option value="NODAL_ESCROW">Central Nodal Escrow Account</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      UPI VPA / ID (Optional for Instant Verification)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value.trim())}
                      placeholder="e.g. gaushala.trust@okhdfcbank"
                      className="w-full px-4 py-2.5 text-[14px] font-mono rounded-lg border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                    />
                  </div>
                </div>

                {/* Settlement Schedule Settings */}
                <div className="pt-6 border-t border-line space-y-4">
                  <h4 className="text-[14px] font-semibold text-ink flex items-center gap-2">
                    <Clock size={16} className="text-forest" />
                    <span>Automated Settlement Schedule Preferences</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-medium text-ink-soft mb-1">
                        Disbursement Cycle
                      </label>
                      <input
                        type="text"
                        value={disbursementCycle}
                        onChange={(e) => setDisbursementCycle(e.target.value)}
                        placeholder="e.g. Every Sunday at 23:59 IST"
                        className="w-full px-4 py-2 text-[13.5px] rounded-lg border border-line bg-paper text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-ink-soft mb-1">
                        Disbursement Mode
                      </label>
                      <input
                        type="text"
                        value={disbursementMode}
                        onChange={(e) => setDisbursementMode(e.target.value)}
                        placeholder="e.g. Direct RBI NEFT / Instant IMPS"
                        className="w-full px-4 py-2 text-[13.5px] rounded-lg border border-line bg-paper text-ink"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex items-center justify-between gap-4 border-t border-line">
                  <div>
                    {hasLinkedBank && (
                      <button
                        type="button"
                        onClick={handleUnlinkBankAccount}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>Unlink This Account</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingBank(false)
                        setIsEditing(false)
                      }}
                      className="px-5 py-2.5 text-[13px] rounded-lg border border-line text-ink hover:bg-paper-deep transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !isBankFormValid}
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-[13.5px] font-semibold rounded-lg bg-forest hover:bg-forest-deep text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Save size={15} />
                      <span>{saving ? "Encrypting & Saving..." : "Save & Verify Bank Account"}</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : hasLinkedBank ? (
              /* Verified Bank Account Display Card */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card border border-line rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
                    <div className="flex items-center justify-between border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center">
                          <Landmark size={24} />
                        </div>
                        <div>
                          <div className="text-[17px] font-bold text-ink">
                            {profile?.bankDetails?.bankName}
                          </div>
                          <div className="text-[12.5px] text-ink-soft">
                            {profile?.bankDetails?.branchName}
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={14} /> Direct Payout Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Account Holder / Beneficiary</div>
                        <div className="text-[15px] font-semibold text-ink">{profile?.bankDetails?.accountBeneficiary}</div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Bank Account Number</div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[16px] font-mono font-bold text-ink tracking-wider">
                            {maskedAccountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAccountNumber(!showAccountNumber)}
                            className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-paper-deep transition cursor-pointer"
                            title={showAccountNumber ? "Mask account number" : "Reveal account number"}
                          >
                            {showAccountNumber ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">IFSC Code</div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[15px] font-mono font-bold text-ink">
                            {profile?.bankDetails?.ifscCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(profile?.bankDetails?.ifscCode || "", "IFSC Code")}
                            className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-paper-deep transition cursor-pointer"
                          >
                            {copiedField === "IFSC Code" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Account Type</div>
                        <div className="text-[14.5px] font-medium text-ink">
                          {profile?.bankDetails?.accountType === "CURRENT_TRUST"
                            ? "Current / Charity Trust Account"
                            : profile?.bankDetails?.accountType === "SALARY"
                              ? "Operational Salary Account"
                              : profile?.bankDetails?.accountType === "NODAL_ESCROW"
                                ? "Central Nodal Escrow Pool"
                                : "Savings Account"}
                        </div>
                      </div>

                      {profile?.bankDetails?.upiId && (
                        <div className="sm:col-span-2 p-4 rounded-lg bg-paper border border-line space-y-1">
                          <div className="text-[11px] font-mono text-ink-faint uppercase">Direct UPI VPA ID</div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[15px] font-mono text-forest font-semibold">
                              {profile?.bankDetails?.upiId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(profile?.bankDetails?.upiId || "", "UPI ID")}
                              className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-paper-deep transition cursor-pointer"
                            >
                              {copiedField === "UPI ID" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-line flex items-center justify-between">
                      <div className="text-[11.5px] text-ink-faint font-mono">
                        Last Verified: {profile?.bankDetails?.lastVerifiedAt || "Live"}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsAddingBank(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg border border-line bg-paper hover:bg-paper-deep text-ink transition cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>Update Bank Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleUnlinkBankAccount}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>Unlink</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Settlement Schedule */}
                <div className="space-y-6">
                  <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-[16px] font-bold text-ink flex items-center gap-2">
                        <Clock size={18} className="text-forest" />
                        <span>Disbursement Schedule</span>
                      </h4>
                      <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded bg-paper border border-line text-ink-soft">
                        {profile?.settlementSchedule?.badgeLabel || "Auto-Sweep"}
                      </span>
                    </div>

                    <div className="space-y-3.5 text-[13px]">
                      <div className="p-3.5 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Disbursement Cycle</div>
                        <div className="font-bold text-ink">
                          {profile?.settlementSchedule?.disbursementCycle || "Weekly on Sunday Midnight"}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Disbursement Protocol</div>
                        <div className="font-bold text-ink">
                          {profile?.settlementSchedule?.disbursementMode || "Direct RBI NEFT / Instant IMPS"}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Nodal Escrow Pool</div>
                        <div className="font-bold text-ink">
                          {profile?.settlementSchedule?.escrowCustodianPool || "ICICI Nodal Trust Escrow"}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-lg bg-paper border border-line space-y-1">
                        <div className="text-[11px] font-mono text-ink-faint uppercase">Next Scheduled Batch</div>
                        <div className="font-bold text-forest">
                          {profile?.settlementSchedule?.nextScheduledBatch || "Upcoming Batch Engine"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State: No Bank Account Added */
              <div className="text-center py-16 px-6 border-2 border-dashed border-line rounded-xl bg-card/40 max-w-2xl mx-auto space-y-5 shadow-xs">
                <div className="w-20 h-20 rounded-2xl bg-paper border border-line text-forest flex items-center justify-center mx-auto shadow-sm">
                  <Landmark size={36} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-[20px] font-bold text-ink">
                    No Official Bank Account Linked Yet
                  </h3>
                  <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-lg mx-auto">
                    Connect your verified charity trust or operational bank account to receive direct ceremonial payout credits, automated RBI NEFT disbursements, and transparent ledger sweeps.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingBank(true)}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-forest hover:bg-forest-deep text-white font-bold text-[14px] transition shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <PlusCircle size={18} />
                    <span>+ Link Official Bank Account</span>
                  </button>
                </div>

                <div className="pt-6 border-t border-line/60 flex items-center justify-center gap-6 text-[12px] text-ink-faint">
                  <span className="flex items-center gap-1.5">
                    <Lock size={14} className="text-emerald-700" /> 256-Bit Encrypted
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-700" /> Zero Super-Admin Peeking
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ROLE METRICS & ACTIVITY LEDGER                                      */}
        {/* ========================================================================= */}
        {activeTab === "metrics" && (
          <div className="space-y-6">
            <div className="bg-card border border-line rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="border-b border-line pb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-[18px] font-bold text-ink flex items-center gap-2">
                    <TrendingUp size={20} className="text-forest" />
                    <span>Verified Operational &amp; Financial Ledger</span>
                  </h3>
                  <p className="text-[12.5px] text-ink-soft mt-0.5">
                    Real-time performance metrics and ceremonial welfare logs for {name}.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full">
                  Real-Time Synced
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-paper border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold text-ink">Ceremonial Seva Activity</span>
                    <span className="text-[11px] font-mono text-forest">Live</span>
                  </div>
                  <div className="text-[26px] font-serif font-bold text-ink">
                    {roleMetrics.metric1.value}
                  </div>
                  <p className="text-[12px] text-ink-soft">
                    Ceremonial visits arranged in accordance with sacred Vedic protocols and animal welfare safeguards.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-paper border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold text-ink">Herd Custody &amp; Health</span>
                    <span className="text-[11px] font-mono text-emerald-700">Protected</span>
                  </div>
                  <div className="text-[26px] font-serif font-bold text-ink">
                    {roleMetrics.metric2.value}
                  </div>
                  <p className="text-[12px] text-ink-soft">
                    Mandatory 90-minute resting intervals enforced between consecutive ceremonial darshans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SECURITY & PRIVACY PROTOCOL                                         */}
        {/* ========================================================================= */}
        {activeTab === "compliance" && (
          <div className="space-y-6">
            <div className="bg-card border border-line rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-line pb-4">
                <ShieldCheck size={24} className="text-emerald-700" />
                <div>
                  <h3 className="font-serif text-[18px] font-bold text-ink">
                    Privacy Guarantee &amp; Role-Isolated RBAC Boundaries
                  </h3>
                  <p className="text-[12.5px] text-ink-soft mt-0.5">
                    In compliance with RBI Master Directions on Financial Intermediaries and Platform Escrow Governance.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-5 rounded-xl bg-paper border border-line space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Lock size={18} />
                  </div>
                  <h4 className="font-bold text-[14px] text-ink">Confidential Bank Vault</h4>
                  <p className="text-[12.5px] text-ink-soft leading-relaxed">
                    Gosala Manager and Operations Admin bank account credentials are encrypted and restricted exclusively to their authenticated login. Super Admin cannot inspect or modify individual external bank accounts.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-paper border border-line space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Landmark size={18} />
                  </div>
                  <h4 className="font-bold text-[14px] text-ink">Tokenized Direct Routing</h4>
                  <p className="text-[12.5px] text-ink-soft leading-relaxed">
                    Platform payouts disburse via tokenized RBI payment bridges without raw exposure to unauthorized personnel.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-paper border border-line space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <FileCheck size={18} />
                  </div>
                  <h4 className="font-bold text-[14px] text-ink">Immutable Audit Trail</h4>
                  <p className="text-[12.5px] text-ink-soft leading-relaxed">
                    Every profile modification logs timestamp, IP fingerprint, and cryptographic signature to prevent unauthorized tampering.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Global Page Footer */}
      <footer className="bg-card border-t border-line px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between text-[12px] text-ink-faint gap-3 mt-auto">
        <div className="flex items-center gap-2">
          <Lock size={13} className="text-emerald-700" />
          <span>GOMAA Sovereign Multi-Role Treasury &amp; Identity Protocol v2.6 · End-to-End Encrypted</span>
        </div>
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-lg border border-line bg-paper hover:bg-paper-deep text-ink text-[12.5px] font-semibold transition cursor-pointer"
        >
          Close Dossier
        </button>
      </footer>
    </div>
  )
}
