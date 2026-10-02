import { useState, useEffect } from "react"
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  ShieldCheck,
  Landmark,
  Building2,
  Save,
} from "lucide-react"
import type { RoleId } from "../data/roles"
import { initialProfiles } from "../data/profiles"
import { useStore } from "../store/store"

export default function EditProfileModal({
  role,
  isOpen = true,
  onClose,
}: {
  role: RoleId
  isOpen?: boolean
  onClose: () => void
}) {
  const { profiles, updateProfile } = useStore()
  const profile = profiles?.[role] || initialProfiles[role]

  const [name, setName] = useState(profile?.name || "")
  const [phone, setPhone] = useState(profile?.phone || "")
  const [email, setEmail] = useState(profile?.email || "")

  // Role specific fields
  const [address, setAddress] = useState(profile?.customerData?.address || "")
  const [aadhaar, setAadhaar] = useState(
    profile?.customerData?.aadhaarNumber || "XXXX-XXXX-4819",
  )
  const [ceremony, setCeremony] = useState(
    profile?.customerData?.preferredCeremony ||
      "Griha Pravesh & Kamadhenu Puja",
  )

  const [managerId, setManagerId] = useState(
    profile?.managerData?.managerId || "MGR-804",
  )
  const [gosala, setGosala] = useState(
    profile?.managerData?.gosala || "Shri Krishna Gaushala",
  )
  const [region, setRegion] = useState(
    profile?.managerData?.region || "Pune Western Zone",
  )
  const [dailyCeiling, setDailyCeiling] = useState(
    profile?.managerData?.dailySevaCeiling || 2,
  )
  const [restingBuffer, setRestingBuffer] = useState(
    profile?.managerData?.restingBufferMin || 90,
  )

  const [driverId, setDriverId] = useState(
    profile?.driverData?.driverId || "DRV-102",
  )
  const [vehicleNumber, setVehicleNumber] = useState(
    profile?.driverData?.vehicleNumber || "MH-12-Q-4491",
  )
  const [vehicleType, setVehicleType] = useState(
    profile?.driverData?.vehicleType || "Tata 407 (8ft Open Bed)",
  )
  const [licenseNumber, setLicenseNumber] = useState(
    profile?.driverData?.licenseNumber || "DL-142011009823",
  )

  const [designation, setDesignation] = useState(
    profile?.adminData?.designation ||
      (role === "super_admin"
        ? "Chief Treasury Officer"
        : "Regional Operations Officer"),
  )
  const [department, setDepartment] = useState(
    profile?.adminData?.department || "Pune Operations Hub",
  )

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name || "")
      setPhone(profile.phone || "")
      setEmail(profile.email || "")
      if (profile.customerData) {
        setAddress(profile.customerData.address || "")
        setAadhaar(profile.customerData.aadhaarNumber || "XXXX-XXXX-4819")
        setCeremony(profile.customerData.preferredCeremony || "")
      }
      if (profile.managerData) {
        setManagerId(profile.managerData.managerId || "MGR-804")
        setGosala(profile.managerData.gosala || "Shri Krishna Gaushala")
        setRegion(profile.managerData.region || "Pune Western Zone")
        setDailyCeiling(profile.managerData.dailySevaCeiling || 2)
        setRestingBuffer(profile.managerData.restingBufferMin || 90)
      }
      if (profile.driverData) {
        setDriverId(profile.driverData.driverId || "DRV-102")
        setVehicleNumber(profile.driverData.vehicleNumber || "MH-12-Q-4491")
        setVehicleType(
          profile.driverData.vehicleType || "Tata 407 (8ft Open Bed)",
        )
        setLicenseNumber(profile.driverData.licenseNumber || "DL-142011009823")
      }
      if (profile.adminData) {
        setDesignation(profile.adminData.designation || "")
        setDepartment(profile.adminData.department || "")
      }
    }
  }, [profile, isOpen])

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updates: any = {
        name,
        phone,
        email,
      }
      if (role === "customer") {
        updates.customerData = {
          address,
          aadhaarNumber: aadhaar,
          preferredCeremony: ceremony,
        }
      } else if (role === "manager") {
        updates.managerData = {
          managerId,
          gosala,
          region,
          dailySevaCeiling: Number(dailyCeiling),
          restingBufferMin: Number(restingBuffer),
        }
      } else if (role === "driver") {
        updates.driverData = {
          driverId,
          vehicleNumber,
          vehicleType,
          licenseNumber,
          gosalaBase: gosala,
        }
      } else if (role === "admin" || role === "super_admin") {
        updates.adminData = {
          designation,
          department,
        }
      }
      await updateProfile(role, updates)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const roleTitle =
    role === "customer"
      ? "Devotee Profile Dossier"
      : role === "manager"
        ? "Gosala Manager Profile & Settings"
        : role === "driver"
          ? "Driver Profile & Transport Vehicle"
          : role === "super_admin"
            ? "Super Admin (Chief Treasury Officer) Profile"
            : "Operations Admin Profile"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in text-ink">
      <div className="bg-paper border border-line rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-forest text-white flex items-center justify-center font-serif text-[16px]">
              {name.slice(0, 1) || "G"}
            </div>
            <div>
              <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                <span>{roleTitle}</span>
              </h3>
              <p className="text-[12px] text-ink-faint">
                Live dynamic account settings · Synced with backend & database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSave}
          className="p-6 overflow-y-auto space-y-4 max-h-[calc(92vh-130px)]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-ink mb-1">
                Full Legal / Devotee Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-ink mb-1">
                Primary Mobile Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink font-mono outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
            />
          </div>

          {/* Customer Specific */}
          {role === "customer" && (
            <>
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Default Puja Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 14 Tulsi Nagar, Kothrud, Pune"
                  className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Self-Attested Aadhaar (Masked)
                  </label>
                  <input
                    type="text"
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value)}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink font-mono outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Preferred Ritual Ceremony
                  </label>
                  <input
                    type="text"
                    value={ceremony}
                    onChange={(e) => setCeremony(e.target.value)}
                    placeholder="e.g. Griha Pravesh & Kamadhenu Puja"
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>
              </div>
            </>
          )}

          {/* Manager Specific */}
          {role === "manager" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Manager Employee ID
                  </label>
                  <input
                    type="text"
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink font-mono outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Assigned Gaushala Trust
                  </label>
                  <input
                    type="text"
                    value={gosala}
                    onChange={(e) => setGosala(e.target.value)}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Default Daily Seva Ceiling (Per Cow)
                  </label>
                  <select
                    value={dailyCeiling}
                    onChange={(e) => setDailyCeiling(Number(e.target.value))}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                  >
                    <option value={1}>1 Seva / Day (Maximum Rest)</option>
                    <option value={2}>2 Sevas / Day (Standard Welfare)</option>
                    <option value={3}>3 Sevas / Day (Express Festival)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Resting Buffer Duration
                  </label>
                  <select
                    value={restingBuffer}
                    onChange={(e) => setRestingBuffer(Number(e.target.value))}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={60}>60 Minutes</option>
                    <option value={90}>90 Minutes (Recommended)</option>
                    <option value={120}>120 Minutes</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Driver Specific */}
          {role === "driver" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Driver Badge / ID
                  </label>
                  <input
                    type="text"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink font-mono outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Vehicle Registration Plate
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink font-mono uppercase outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Cattle Carrier Vehicle Model
                  </label>
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Driving License Number
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink font-mono outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                  />
                </div>
              </div>
            </>
          )}

          {/* Admin Specific */}
          {(role === "admin" || role === "super_admin") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Official Designation
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Department / Hub
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest transition"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:bg-forest-deep transition-colors shadow-sm disabled:opacity-50"
            >
              <Save size={15} /> {saving ? "Saving..." : "Save Profile Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
