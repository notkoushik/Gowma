import React, { useState, useMemo } from "react"
import {
  HeartHandshake,
  Truck,
  Plus,
  Search,
  Copy,
  Check,
  Eye,
  EyeOff,
  MessageSquare,
  Lock,
  RefreshCw,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  X,
  Building2,
  Info,
  Car,
  FileText,
  Users,
} from "lucide-react"
import { useStore } from "../../store/store"

interface ShareCredentialsData {
  name: string
  email: string
  phone: string
  role: "customer" | "driver"
  roleTitle: string
  password: string
  // Customer specific
  address?: string
  gotra?: string
  city?: string
  // Driver specific
  vehicleNumber?: string
  vehicleType?: string
  licenseNumber?: string
  gosalaBase?: string
}

export default function ManagerDevotees({
  currentGosalaName,
}: {
  currentGosalaName: string
}) {
  const { users, addUser, gosalas, notify } = useStore()

  const [activeTab, setActiveTab] = useState<"all" | "customers" | "drivers">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Modals
  const [showDevoteeModal, setShowDevoteeModal] = useState(false)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Devotee form state
  const [devoteeName, setDevoteeName] = useState("")
  const [devoteePhone, setDevoteePhone] = useState("+91 ")
  const [devoteeEmail, setDevoteeEmail] = useState("")
  const [devoteeAddress, setDevoteeAddress] = useState("")
  const [devoteeCity, setDevoteeCity] = useState("Hyderabad")
  const [devoteeGotra, setDevoteeGotra] = useState("Kashyapa")
  const [devoteePassword, setDevoteePassword] = useState("Devotee@2025")
  const [showDevoteePassword, setShowDevoteePassword] = useState(true)

  // Driver form state
  const [driverName, setDriverName] = useState("")
  const [driverPhone, setDriverPhone] = useState("+91 ")
  const [driverEmail, setDriverEmail] = useState("")
  const [driverVehiclePlate, setDriverVehiclePlate] = useState("TS-09-UA-")
  const [driverVehicleType, setDriverVehicleType] = useState("Tata 407 (Hydraulic Cattle Bed)")
  const [driverLicenseNo, setDriverLicenseNo] = useState("DL-")
  const [driverGosalaBase, setDriverGosalaBase] = useState(currentGosalaName)
  const [driverPassword, setDriverPassword] = useState("Pilot@2025")
  const [showDriverPassword, setShowDriverPassword] = useState(true)

  // Revealed password toggle map for card items
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({})

  // Credentials Ready Modal
  const [shareCredentials, setShareCredentials] = useState<ShareCredentialsData | null>(null)
  const [showSharePassword, setShowSharePassword] = useState(true)
  const [copiedSuccess, setCopiedSuccess] = useState(false)

  const generateRandomPassword = (prefix: "Devotee" | "Pilot" = "Devotee") => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    let code = ""
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${prefix}@${code}`
  }

  // Filter devotees and drivers
  const allManagedUsers = useMemo(() => {
    return users.filter(
      (u) =>
        u.role === "customer" ||
        u.role === "driver" ||
        (u as any).dbRole === "CUSTOMER" ||
        (u as any).dbRole === "DRIVER" ||
        u.customerData ||
        u.driverData
    )
  }, [users])

  const customersList = useMemo(() => {
    return allManagedUsers.filter(
      (u) => u.role === "customer" || (u as any).dbRole === "CUSTOMER" || u.customerData
    )
  }, [allManagedUsers])

  const driversList = useMemo(() => {
    return allManagedUsers.filter(
      (u) => u.role === "driver" || (u as any).dbRole === "DRIVER" || u.driverData
    )
  }, [allManagedUsers])

  const displayedUsers = useMemo(() => {
    let list = allManagedUsers
    if (activeTab === "customers") list = customersList
    if (activeTab === "drivers") list = driversList

    const q = searchQuery.trim().toLowerCase()
    if (!q) return list

    return list.filter((u) => {
      const matchBasic =
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)

      const matchCustomer =
        u.customerData?.gotra?.toLowerCase().includes(q) ||
        u.customerData?.address?.toLowerCase().includes(q) ||
        u.customerData?.city?.toLowerCase().includes(q)

      const matchDriver =
        u.driverData?.vehicleNumber?.toLowerCase().includes(q) ||
        u.driverData?.vehicleType?.toLowerCase().includes(q) ||
        u.driverData?.licenseNumber?.toLowerCase().includes(q) ||
        u.driverData?.gosalaBase?.toLowerCase().includes(q)

      return matchBasic || matchCustomer || matchDriver
    })
  }, [allManagedUsers, customersList, driversList, activeTab, searchQuery])

  const togglePasswordReveal = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Handle Devotee Registration
  const handleCreateDevotee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!devoteeName.trim() || !devoteeEmail.trim() || !devoteePassword.trim()) {
      notify("Please fill in all required fields (Name, Email, Password).", "warn")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: devoteeName.trim(),
        email: devoteeEmail.trim(),
        phone: devoteePhone.trim(),
        role: "customer",
        password: devoteePassword.trim(),
        customerData: {
          address: devoteeAddress.trim() || "Devotee Residence",
          city: devoteeCity.trim() || "Hyderabad",
          gotra: devoteeGotra.trim() || "Kashyapa",
          preferredCeremony: "Kamadhenu Puja & Gau Seva",
        },
      }

      const res = await addUser(payload)
      if (res) {
        setShowDevoteeModal(false)
        setShareCredentials({
          name: devoteeName.trim(),
          email: devoteeEmail.trim(),
          phone: devoteePhone.trim(),
          role: "customer",
          roleTitle: "Devotee (Customer)",
          password: devoteePassword.trim(),
          address: devoteeAddress.trim() || "Devotee Residence",
          city: devoteeCity.trim() || "Hyderabad",
          gotra: devoteeGotra.trim() || "Kashyapa",
          gosalaBase: currentGosalaName,
        })
        // Reset form
        setDevoteeName("")
        setDevoteePhone("+91 ")
        setDevoteeEmail("")
        setDevoteeAddress("")
        setDevoteeGotra("Kashyapa")
        setDevoteePassword(generateRandomPassword("Devotee"))
      }
    } catch (err: any) {
      notify(err.message || "Failed to register devotee", "err")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Driver Registration
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!driverName.trim() || !driverEmail.trim() || !driverPassword.trim()) {
      notify("Please fill in all required fields (Name, Email, Password).", "warn")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: driverName.trim(),
        email: driverEmail.trim(),
        phone: driverPhone.trim(),
        role: "driver",
        password: driverPassword.trim(),
        driverData: {
          vehicleNumber: driverVehiclePlate.trim() || "TS-09-UA-1088",
          vehicleType: driverVehicleType.trim() || "Tata 407 (Hydraulic Cattle Bed)",
          licenseNumber: driverLicenseNo.trim() || "DL-PENDING",
          gosalaBase: driverGosalaBase || currentGosalaName,
          status: "Available",
        },
      }

      const res = await addUser(payload)
      if (res) {
        setShowDriverModal(false)
        setShareCredentials({
          name: driverName.trim(),
          email: driverEmail.trim(),
          phone: driverPhone.trim(),
          role: "driver",
          roleTitle: "Transit Pilot (Driver)",
          password: driverPassword.trim(),
          vehicleNumber: driverVehiclePlate.trim() || "TS-09-UA-1088",
          vehicleType: driverVehicleType.trim() || "Tata 407 (Hydraulic Cattle Bed)",
          licenseNumber: driverLicenseNo.trim(),
          gosalaBase: driverGosalaBase || currentGosalaName,
        })
        // Reset form
        setDriverName("")
        setDriverPhone("+91 ")
        setDriverEmail("")
        setDriverVehiclePlate("TS-09-UA-")
        setDriverLicenseNo("DL-")
        setDriverPassword(generateRandomPassword("Pilot"))
      }
    } catch (err: any) {
      notify(err.message || "Failed to register driver", "err")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Pre-formatted WhatsApp share link
  const getWhatsAppShareUrl = (data: ShareCredentialsData) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gomaa.in"
    let text = ""

    if (data.role === "driver") {
      text = `🚚 Namaste ${data.name},\n\nYou have been authorized as a GOMAA Transit Pilot (Driver) for ${data.gosalaBase || currentGosalaName}.\n\nVehicle: ${data.vehicleNumber || "Assigned Rig"} (${data.vehicleType || "Hydraulic Bovine Bed"})\n\nYou can now log in to the GOMAA Pilot App to view assigned cow trips and GPS navigation:\n\n🌐 Portal: ${origin}\n📧 Email: ${data.email}\n📱 Phone: ${data.phone}\n🔑 Password: ${data.password}\n\nPlease keep your credentials safe.`
    } else {
      text = `🙏 Namaste ${data.name},\n\nYour GOMAA Devotee Account has been registered by ${currentGosalaName}.\n\nYou can now log in to schedule sacred Gau Seva and Kamadhenu Puja ceremonies:\n\n🌐 Portal: ${origin}\n📧 Email: ${data.email}\n📱 Phone: ${data.phone}\n🔑 Password: ${data.password}\n🕉️ Family Gotra: ${data.gotra || "Kashyapa"}\n\nPlease keep your credentials safe.`
    }

    const cleanPhone = (data.phone || "").replace(/[^0-9]/g, "")
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
  }

  // Copy credentials helper
  const copyCredentialsToClipboard = (data: ShareCredentialsData) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gomaa.in"
    let text = ""
    if (data.role === "driver") {
      text = `GOMAA Transit Pilot Credentials:\nName: ${data.name}\nRole: Transit Pilot (Driver)\nSanctuary Base: ${data.gosalaBase || currentGosalaName}\nVehicle: ${data.vehicleNumber || "Fleet Rig"} (${data.vehicleType || ""})\nEmail: ${data.email}\nPhone: ${data.phone}\nPassword: ${data.password}\nPortal: ${origin}`
    } else {
      text = `GOMAA Devotee Account Credentials:\nName: ${data.name}\nRole: Devotee (Customer)\nGotra: ${data.gotra || "Kashyapa"}\nSanctuary: ${currentGosalaName}\nEmail: ${data.email}\nPhone: ${data.phone}\nPassword: ${data.password}\nPortal: ${origin}`
    }
    navigator.clipboard.writeText(text)
    setCopiedSuccess(true)
    notify(`Full credentials for ${data.name} copied to clipboard!`, "ok")
    setTimeout(() => setCopiedSuccess(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Card */}
      <div className="bg-card border border-line rounded-sm p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-saffron-soft text-saffron-deep grid place-items-center">
              <Users size={18} />
            </div>
            <h2 className="font-serif text-[18px] text-ink font-semibold">
              Devotees &amp; Transit Fleet Management
            </h2>
          </div>
          <p className="text-[12.5px] text-ink-soft max-w-2xl leading-relaxed">
            Manage authorized users for <strong>{currentGosalaName}</strong>.
            Register devotees for sacred ceremonies and transit pilots for bovine logistics. All accounts sign in using their issued credentials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDevoteePassword(generateRandomPassword("Devotee"))
              setShowDevoteeModal(true)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-saffron hover:bg-saffron-deep text-white font-medium text-[12.5px] rounded-sm transition shadow-xs cursor-pointer"
          >
            <HeartHandshake size={15} />
            <span>+ Register Devotee</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDriverPassword(generateRandomPassword("Pilot"))
              setDriverGosalaBase(currentGosalaName)
              setShowDriverModal(true)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-forest hover:bg-forest-deep text-white font-medium text-[12.5px] rounded-sm transition shadow-xs cursor-pointer"
          >
            <Truck size={15} />
            <span>+ Register Transit Pilot</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Role Tabs */}
        <div className="flex bg-paper p-1 rounded-sm border border-line">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-sm transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-card text-ink shadow-xs border border-line font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <span>All Users</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-paper-deep text-ink-faint">
              {allManagedUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-sm transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "customers"
                ? "bg-card text-saffron-deep shadow-xs border border-line font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <HeartHandshake size={13} className="text-saffron shrink-0" />
            <span>Devotees</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-saffron-soft text-saffron-deep font-semibold">
              {customersList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("drivers")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-sm transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "drivers"
                ? "bg-card text-forest shadow-xs border border-line font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Truck size={13} className="text-forest shrink-0" />
            <span>Transit Pilots</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-forest-soft text-forest font-semibold">
              {driversList.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, vehicle plate, phone..."
            className="w-full bg-paper border border-line rounded-sm pl-8 pr-3 py-1.5 text-[12px] text-ink outline-none focus:border-saffron transition"
          />
        </div>
      </div>

      {/* Users Grid */}
      {displayedUsers.length === 0 ? (
        <div className="bg-card border border-line rounded-sm p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-paper-deep text-ink-faint grid place-items-center mx-auto">
            {activeTab === "drivers" ? <Truck size={24} /> : <Users size={24} />}
          </div>
          <h3 className="font-serif text-[17px] text-ink font-medium">
            {searchQuery
              ? "No matching records found"
              : activeTab === "drivers"
                ? "No Transit Pilots Registered Yet"
                : activeTab === "customers"
                  ? "No Devotees Registered Yet"
                  : "No Users Registered Yet"}
          </h3>
          <p className="text-[12.5px] text-ink-soft max-w-md mx-auto">
            {searchQuery
              ? "Try clearing your search query to see all registered records."
              : "Register your first devotee or driver to issue them login credentials."}
          </p>
          {!searchQuery && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDevoteePassword(generateRandomPassword("Devotee"))
                  setShowDevoteeModal(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-saffron text-white rounded-sm text-[12px] font-medium hover:bg-saffron-deep transition cursor-pointer"
              >
                <HeartHandshake size={14} />
                <span>+ Register Devotee</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDriverPassword(generateRandomPassword("Pilot"))
                  setDriverGosalaBase(currentGosalaName)
                  setShowDriverModal(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-forest text-white rounded-sm text-[12px] font-medium hover:bg-forest-deep transition cursor-pointer"
              >
                <Truck size={14} />
                <span>+ Register Pilot</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {displayedUsers.map((user) => {
            const isDriver =
              user.role === "driver" ||
              (user as any).dbRole === "DRIVER" ||
              Boolean(user.driverData)

            const isRevealed = Boolean(revealedPasswords[user.id])
            const pwd = (user as any).password || (isDriver ? "gomaa-driver" : "gomaa-secure")

            // Devotee specifics
            const gotra = user.customerData?.gotra || "Kashyapa"
            const address = user.customerData?.address || "Devotee Residence"
            const city = user.customerData?.city || "Hyderabad"

            // Driver specifics
            const vehicleNumber = user.driverData?.vehicleNumber || "TS-09-UA-1088"
            const vehicleType = user.driverData?.vehicleType || "Tata 407 (Hydraulic Cattle Bed)"
            const licenseNo = user.driverData?.licenseNumber || "DL-VERIFIED"
            const base = user.driverData?.gosalaBase || currentGosalaName

            return (
              <div
                key={user.id}
                className="bg-card border border-line rounded-sm p-4 hover:border-line-strong transition-all flex flex-col justify-between space-y-3.5 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-sm text-white grid place-items-center font-serif text-[15px] shrink-0 font-semibold ${
                          isDriver ? "bg-forest" : "bg-saffron"
                        }`}
                      >
                        {isDriver ? (
                          <Truck size={16} />
                        ) : (
                          user.name?.slice(0, 1).toUpperCase() || "D"
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-[13.5px] text-ink truncate leading-tight">
                          {user.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isDriver ? (
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-forest-soft text-forest font-semibold">
                              Transit Pilot
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-saffron-soft text-saffron-deep font-semibold">
                              Devotee · {gotra}
                            </span>
                          )}
                          <span className="h-1.5 w-1.5 rounded-full bg-forest" />
                        </div>
                      </div>
                    </div>

                    {isDriver && (
                      <span className="font-mono text-[10px] text-forest px-1.5 py-0.5 bg-forest-soft rounded border border-forest/20">
                        Fleet Rig
                      </span>
                    )}
                  </div>

                  {/* Body Details */}
                  <div className="mt-3 space-y-1.5 text-[12px] text-ink-soft">
                    <div className="flex items-center gap-2 text-ink">
                      <Mail size={13} className="text-ink-faint shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-ink-faint shrink-0" />
                      <span className="font-mono text-[11.5px]">{user.phone || "—"}</span>
                    </div>

                    {isDriver ? (
                      <>
                        <div className="flex items-center gap-2 text-ink">
                          <Car size={13} className="text-forest shrink-0" />
                          <span className="font-mono font-medium text-[11.5px]">{vehicleNumber}</span>
                          <span className="text-[10.5px] text-ink-faint truncate">({vehicleType})</span>
                        </div>
                        <div className="flex items-center gap-2 text-ink-faint text-[11px]">
                          <Building2 size={13} className="text-ink-faint shrink-0" />
                          <span>Base: {base}</span>
                          <span className="text-line-strong">·</span>
                          <span className="font-mono">{licenseNo}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-ink-faint">
                        <MapPin size={13} className="text-saffron shrink-0" />
                        <span className="truncate text-[11.5px]">{address}, {city}</span>
                      </div>
                    )}
                  </div>

                  {/* Password Display Strip */}
                  <div className="mt-3 p-2 bg-paper rounded border border-line flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-1.5 font-mono text-ink">
                      <Lock
                        size={12}
                        className={isDriver ? "text-forest" : "text-saffron-deep"}
                      />
                      <span className="font-medium">
                        {isRevealed ? pwd : "•".repeat(Math.max(6, pwd.length))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePasswordReveal(user.id)}
                        className="text-ink-faint hover:text-ink cursor-pointer"
                        title={isRevealed ? "Hide Password" : "Show Password"}
                      >
                        {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(pwd)
                          notify("Password copied to clipboard!", "ok")
                        }}
                        className="text-ink-faint hover:text-ink cursor-pointer"
                        title="Copy Password"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
                  <a
                    href={getWhatsAppShareUrl({
                      name: user.name,
                      email: user.email,
                      phone: user.phone,
                      role: isDriver ? "driver" : "customer",
                      roleTitle: isDriver ? "Transit Pilot" : "Devotee",
                      password: pwd,
                      gotra,
                      address,
                      city,
                      vehicleNumber,
                      vehicleType,
                      gosalaBase: base,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-medium transition cursor-pointer"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      copyCredentialsToClipboard({
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        role: isDriver ? "driver" : "customer",
                        roleTitle: isDriver ? "Transit Pilot" : "Devotee",
                        password: pwd,
                        gotra,
                        address,
                        city,
                        vehicleNumber,
                        vehicleType,
                        gosalaBase: base,
                      })
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-line bg-card hover:bg-paper-deep text-ink text-[11.5px] font-medium transition cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ======================= ADD DEVOTEE MODAL ======================= */}
      {showDevoteeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-card border border-line rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-sm bg-saffron text-white grid place-items-center">
                  <HeartHandshake size={15} />
                </div>
                <div>
                  <h3 className="font-serif text-[16px] text-ink font-semibold">
                    Register New Devotee
                  </h3>
                  <div className="text-[11px] text-ink-faint">
                    Allocated to {currentGosalaName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDevoteeModal(false)}
                className="text-ink-faint hover:text-ink p-1 rounded transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDevotee} className="p-5 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="block text-[12px] font-medium text-ink-soft mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={devoteeName}
                  onChange={(e) => setDevoteeName(e.target.value)}
                  placeholder="e.g. Radhika Sharma"
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={devoteePhone}
                    onChange={(e) => setDevoteePhone(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={devoteeEmail}
                    onChange={(e) => setDevoteeEmail(e.target.value)}
                    placeholder="devotee@example.com"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    Family Gotra
                  </label>
                  <input
                    type="text"
                    value={devoteeGotra}
                    onChange={(e) => setDevoteeGotra(e.target.value)}
                    placeholder="e.g. Kashyapa, Bharadwaja"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={devoteeCity}
                    onChange={(e) => setDevoteeCity(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink-soft mb-1">
                  Altar / Residence Address
                </label>
                <input
                  type="text"
                  value={devoteeAddress}
                  onChange={(e) => setDevoteeAddress(e.target.value)}
                  placeholder="House/Flat No, Locality, Landmark"
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                />
              </div>

              {/* Password Setting with Auto-Generate */}
              <div className="p-3 bg-paper rounded border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-ink-soft flex items-center gap-1.5">
                    <Lock size={12} className="text-saffron-deep" />
                    <span>Account Login Password *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDevoteePassword(generateRandomPassword("Devotee"))}
                    className="text-[11px] text-saffron-deep hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showDevoteePassword ? "text" : "password"}
                    required
                    value={devoteePassword}
                    onChange={(e) => setDevoteePassword(e.target.value)}
                    className="w-full bg-card border border-line rounded pl-3 pr-9 py-2 text-[12.5px] font-mono text-ink outline-none focus:border-saffron transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDevoteePassword(!showDevoteePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                  >
                    {showDevoteePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint leading-snug">
                  Share this password with the devotee so they can log into the GOMAA portal directly.
                </p>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDevoteeModal(false)}
                  className="px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-saffron hover:bg-saffron-deep text-white text-[12.5px] font-medium rounded-sm transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Create Devotee Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= ADD DRIVER (TRANSIT PILOT) MODAL ======================= */}
      {showDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-card border border-line rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-sm bg-forest text-white grid place-items-center">
                  <Truck size={15} />
                </div>
                <div>
                  <h3 className="font-serif text-[16px] text-ink font-semibold">
                    Authorize Transit Pilot (Driver)
                  </h3>
                  <div className="text-[11px] text-ink-faint">
                    Allocated to {currentGosalaName} Transit Fleet
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDriverModal(false)}
                className="text-ink-faint hover:text-ink p-1 rounded transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDriver} className="p-5 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="block text-[12px] font-medium text-ink-soft mb-1">
                  Pilot Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Ramesh Jadhav"
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={driverEmail}
                    onChange={(e) => setDriverEmail(e.target.value)}
                    placeholder="driver@gomaa.in"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    Vehicle Registration Plate *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverVehiclePlate}
                    onChange={(e) => setDriverVehiclePlate(e.target.value)}
                    placeholder="TS-09-UA-1088"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] font-mono text-ink outline-none focus:border-forest transition"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-ink-soft mb-1">
                    Driving License Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverLicenseNo}
                    onChange={(e) => setDriverLicenseNo(e.target.value)}
                    placeholder="DL-142011009823"
                    className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] font-mono text-ink outline-none focus:border-forest transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink-soft mb-1">
                  Vehicle Model / Cattle Rig Specification
                </label>
                <select
                  value={driverVehicleType}
                  onChange={(e) => setDriverVehicleType(e.target.value)}
                  className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                >
                  <option value="Tata 407 (Hydraulic Cattle Bed)">Tata 407 (Hydraulic Cattle Bed)</option>
                  <option value="Mahindra Bolero Maxi Truck (Padded Bovine Rig)">Mahindra Bolero Maxi Truck (Padded Bovine Rig)</option>
                  <option value="Ashok Leyland Dost (Sacred Transit Van)">Ashok Leyland Dost (Sacred Transit Van)</option>
                  <option value="Eicher Pro 2049 (Low-Floor Bovine Carrier)">Eicher Pro 2049 (Low-Floor Bovine Carrier)</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink-soft mb-1">
                  Home Gaushala Base
                </label>
                <input
                  type="text"
                  disabled
                  value={driverGosalaBase || currentGosalaName}
                  className="w-full bg-paper-deep border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink-soft font-medium cursor-not-allowed"
                />
              </div>

              {/* Password Setting with Auto-Generate */}
              <div className="p-3 bg-paper rounded border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-ink-soft flex items-center gap-1.5">
                    <Lock size={12} className="text-forest" />
                    <span>Pilot App Login Password *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDriverPassword(generateRandomPassword("Pilot"))}
                    className="text-[11px] text-forest hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showDriverPassword ? "text" : "password"}
                    required
                    value={driverPassword}
                    onChange={(e) => setDriverPassword(e.target.value)}
                    className="w-full bg-card border border-line rounded pl-3 pr-9 py-2 text-[12.5px] font-mono text-ink outline-none focus:border-forest transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDriverPassword(!showDriverPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                  >
                    {showDriverPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint leading-snug">
                  The pilot will use this password to sign into the GOMAA Transit App on their mobile device.
                </p>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-forest hover:bg-forest-deep text-white text-[12.5px] font-medium rounded-sm transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Authorize Transit Pilot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= CREDENTIALS READY MODAL ======================= */}
      {shareCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-card border border-line rounded-sm shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line bg-paper flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 grid place-items-center font-bold">
                  <Check size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-[17px] text-ink font-semibold">
                    {shareCredentials.role === "driver" ? "Transit Pilot" : "Devotee"} Credentials Ready
                  </h3>
                  <div className="text-[11px] text-ink-faint">
                    Share directly with {shareCredentials.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareCredentials(null)}
                className="text-ink-faint hover:text-ink p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 bg-paper rounded border border-line space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-[11.5px] text-ink-faint">Authorized Name:</span>
                  <span className="font-semibold text-[13px] text-ink">{shareCredentials.name}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-[11.5px] text-ink-faint">Assigned Role:</span>
                  <span className="font-semibold text-[12px] font-mono px-2 py-0.5 rounded bg-card border border-line">
                    {shareCredentials.roleTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-[11.5px] text-ink-faint">Registered Email:</span>
                  <span className="font-mono text-[12px] text-ink font-medium">{shareCredentials.email}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-[11.5px] text-ink-faint">Mobile Phone:</span>
                  <span className="font-mono text-[12px] text-ink">{shareCredentials.phone}</span>
                </div>

                {shareCredentials.role === "driver" ? (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-line">
                      <span className="text-[11.5px] text-ink-faint">Vehicle Plate:</span>
                      <span className="font-mono font-bold text-[12px] text-forest">{shareCredentials.vehicleNumber}</span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-line">
                      <span className="text-[11.5px] text-ink-faint">Sanctuary Base:</span>
                      <span className="font-medium text-[12px] text-ink">{shareCredentials.gosalaBase || currentGosalaName}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="text-[11.5px] text-ink-faint">Family Gotra:</span>
                    <span className="font-semibold text-[12px] text-saffron-deep">{shareCredentials.gotra || "Kashyapa"}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11.5px] font-medium text-ink">Sign-In Password:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[13px] text-ink bg-card px-2.5 py-1 rounded border border-line">
                      {showSharePassword ? shareCredentials.password : "••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSharePassword(!showSharePassword)}
                      className="text-ink-faint hover:text-ink p-1"
                    >
                      {showSharePassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-[12px] text-ink-soft leading-relaxed flex items-start gap-2">
                <Info size={14} className="text-saffron-deep shrink-0 mt-0.5" />
                <span>
                  The account is active immediately. Share credentials with the user via WhatsApp or Copy so they can sign in directly.
                </span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setShareCredentials(null)}
                  className="w-full sm:w-auto px-4 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded cursor-pointer"
                >
                  Close
                </button>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={getWhatsAppShareUrl(shareCredentials)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[12.5px] font-semibold transition cursor-pointer shadow-xs"
                  >
                    <MessageSquare size={14} />
                    <span>Send via WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyCredentialsToClipboard(shareCredentials)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-saffron hover:bg-saffron-deep text-white rounded text-[12.5px] font-semibold transition cursor-pointer shadow-xs"
                  >
                    {copiedSuccess ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSuccess ? "Copied!" : "Copy Full Text"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
