import React, { useState, useMemo } from "react"
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Users,
  PawPrint,
  Camera,
  Edit3,
  Trash2,
  Plus,
  ExternalLink,
  Heart,
  Sparkles,
  Clock,
  Activity,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  Check,
  Copy,
  AlertTriangle,
  Compass,
  Maximize2,
  X,
  FileText,
  BadgeCheck,
  Sliders,
  UserPlus,
  Tag,
  Wrench,
} from "lucide-react"
import {
  type Gosala,
  type GosalaStaff,
  type GosalaCustomDetail,
  GOSALA_FACILITY_OPTIONS,
  GOSALA_CUSTOM_DETAIL_SUGGESTIONS,
  GOSALA_PHOTO_PRESETS,
} from "../../data/gosalas"
import { type Animal, type EmpanelledVet } from "../../data/animals"
import { useStore, useToast } from "../../store/store"

interface GaushalaProfileViewProps {
  gosala: Gosala
  onBack: () => void
  onEdit: (gosala: Gosala) => void
  onUpdatePhotos: (gosala: Gosala) => void
  onRegisterCow?: (gosalaName: string) => void
  onViewAnimalWelfare?: (animalName: string) => void
}

type ProfileTab = "overview" | "herd" | "gallery" | "team" | "bookings"

const BREED_PRESETS = [
  "Gir Cow",
  "Sahiwal",
  "Rathi",
  "Tharparkar",
  "Kankrej",
  "Red Sindhi",
  "Ongole",
  "Vechur",
]

const ROLE_PRESETS = [
  "Senior Herd Feeder & Milker",
  "Pasture & Cleanliness Gosevak",
  "Veterinary Care Assistant",
  "Night Watchman & Stall Security",
  "Sacred Puja & Aarti Handler",
  "Cattle Transport Van Driver",
]

const SHIFT_PRESETS = [
  "Morning (05:00 AM - 01:00 PM)",
  "Evening (01:00 PM - 09:00 PM)",
  "Night Shift (09:00 PM - 05:00 AM)",
  "Full Day Resident Gosevak",
  "05:30 AM & 04:30 PM (Feeding Hours)",
]

export default function GaushalaProfileView({
  gosala,
  onBack,
  onEdit,
  onUpdatePhotos,
  onRegisterCow,
  onViewAnimalWelfare,
}: GaushalaProfileViewProps) {
  const { animals, vets, bookings, updateGosala, addAnimal, updateVet } = useStore()
  const { notify } = useToast()

  const [activeTab, setActiveTab] = useState<ProfileTab>("overview")
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [herdSearchQuery, setHerdSearchQuery] = useState("")

  // --- Modal States for Adding / Editing Details ---
  const [showAddCustomDetailModal, setShowAddCustomDetailModal] = useState(false)
  const [customDetailKeyPreset, setCustomDetailKeyPreset] = useState(GOSALA_CUSTOM_DETAIL_SUGGESTIONS[0])
  const [isCustomDetailCustomMode, setIsCustomDetailCustomMode] = useState(false)
  const [customDetailCustomKey, setCustomDetailCustomKey] = useState("")
  const [customDetailValue, setCustomDetailValue] = useState("")

  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false)
  const [facilityPreset, setFacilityPreset] = useState(GOSALA_FACILITY_OPTIONS[0])
  const [isCustomFacilityMode, setIsCustomFacilityMode] = useState(false)
  const [customFacilityText, setCustomFacilityText] = useState("")

  const [showEditCaretakerModal, setShowEditCaretakerModal] = useState(false)
  const [caretakerName, setCaretakerName] = useState(gosala.caretaker || "")
  const [caretakerPhone, setCaretakerPhone] = useState(gosala.caretakerPhone || gosala.contactPhone || "")
  const [caretakerShift, setCaretakerShift] = useState(gosala.caretakerShift || "05:30 AM & 04:30 PM")
  const [caretakerQuarters, setCaretakerQuarters] = useState(gosala.caretakerQuarters || "On-Site Quarter A")

  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [staffName, setStaffName] = useState("")
  const [staffRole, setStaffRole] = useState(ROLE_PRESETS[0])
  const [staffPhone, setStaffPhone] = useState("+91 98230 ")
  const [staffShift, setStaffShift] = useState(SHIFT_PRESETS[0])

  const [showAssignVetModal, setShowAssignVetModal] = useState(false)
  const [selectedVetId, setSelectedVetId] = useState("")

  const [showAddResidentCowModal, setShowAddResidentCowModal] = useState(false)
  const [newCowName, setNewCowName] = useState("")
  const [newCowBreed, setNewCowBreed] = useState(BREED_PRESETS[0])
  const [newCowType, setNewCowType] = useState<"Cow" | "Calf" | "Bull">("Cow")
  const [newCowAge, setNewCowAge] = useState("4")
  const [newCowWeight, setNewCowWeight] = useState("380")
  const [newCowStatus, setNewCowStatus] = useState("Available")
  const [newCowHandler, setNewCowHandler] = useState(gosala.caretaker || "")
  const [newCowPhoto, setNewCowPhoto] = useState("https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=800&h=600&fit=crop&auto=format")

  const [showEditCapacityModal, setShowEditCapacityModal] = useState(false)
  const [capacityInput, setCapacityInput] = useState(String(gosala.capacity || 40))

  // Normalize photos list
  const photos = useMemo(() => {
    if (gosala.photos && gosala.photos.length > 0) return gosala.photos
    if (gosala.photo) return [gosala.photo]
    return [
      "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=800&h=480&fit=crop&auto=format",
    ]
  }, [gosala.photos, gosala.photo])

  const currentPhoto = photos[activePhotoIdx] || photos[0]

  // Resident Cattle Housed in this Gaushala
  const residentCattle = useMemo(() => {
    const targetName = (gosala?.name || "").toLowerCase().trim()
    if (!targetName) return []
    return animals.filter(
      (a) => a?.gosala && a.gosala.toLowerCase().trim() === targetName,
    )
  }, [animals, gosala?.name])

  // Filtered resident cattle for search
  const filteredHerd = useMemo(() => {
    if (!herdSearchQuery.trim()) return residentCattle
    const q = herdSearchQuery.toLowerCase().trim()
    return residentCattle.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.breed && c.breed.toLowerCase().includes(q)) ||
        (c.type && c.type.toLowerCase().includes(q)) ||
        (c.status && c.status.toLowerCase().includes(q)) ||
        (c.assignedHandler && c.assignedHandler.toLowerCase().includes(q)),
    )
  }, [residentCattle, herdSearchQuery])

  // Capacity & Occupancy
  const capacity = gosala.capacity || 40
  const residentCount = residentCattle.length
  const occupancyPct = Math.min(
    100,
    Math.round((residentCount / Math.max(1, capacity)) * 100),
  )
  const availableStalls = Math.max(0, capacity - residentCount)

  // Status breakdown of resident cattle
  const cattleStats = useMemo(() => {
    let available = 0
    let inSeva = 0
    let resting = 0
    let vetCare = 0

    residentCattle.forEach((c) => {
      if (c.status === "Available") available++
      else if (c.status === "In Seva" || c.status === "In Transit") inSeva++
      else if (c.status === "Resting Buffer") resting++
      else if (c.status === "Vet Care" || c.status === "Heat Hold") vetCare++
      else available++
    })

    return { available, inSeva, resting, vetCare }
  }, [residentCattle])

  // Assigned Vets (Safe against undefined and supporting assignedGosalas array)
  const assignedVets = useMemo(() => {
    const targetName = (gosala?.name || "").toLowerCase().trim()
    if (!targetName) return []
    return vets.filter((v) => {
      if (!v) return false
      if (Array.isArray(v.assignedGosalas)) {
        if (v.assignedGosalas.includes("All Gaushalas")) return true
        if (
          v.assignedGosalas.some(
            (g) => g && g.toLowerCase().trim() === targetName,
          )
        ) {
          return true
        }
      }
      const singleAssigned = (v as any).assignedGaushala
      if (typeof singleAssigned === "string") {
        if (singleAssigned === "All Gaushalas") return true
        if (singleAssigned.toLowerCase().trim() === targetName) return true
      }
      return false
    })
  }, [vets, gosala?.name])

  // Seva Bookings dispatched from this Gaushala
  const relatedBookings = useMemo(() => {
    const targetName = (gosala?.name || "").toLowerCase().trim()
    const residentNames = new Set(
      residentCattle
        .map((c) => (c.name ? c.name.toLowerCase().trim() : ""))
        .filter(Boolean),
    )
    return bookings.filter((b) => {
      if (!b) return false
      if (b.gosala && b.gosala.toLowerCase().trim() === targetName) return true
      const aName = b.animal || (b as any).animalName
      if (aName && residentNames.has(aName.toLowerCase().trim()))
        return true
      return false
    })
  }, [bookings, gosala?.name, residentCattle])

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text)
      setCopiedField(label)
      notify(`Copied ${label} to clipboard`, "ok")
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      notify("Failed to copy", "warn")
    }
  }

  const handleNextPhoto = () => {
    setActivePhotoIdx((prev) => (prev + 1) % photos.length)
  }

  const handlePrevPhoto = () => {
    setActivePhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)
  }

  // --- Handlers for Adding & Modifying Details in this Profile ---

  // 1. Add Custom Detail
  const handleSaveCustomDetail = (e: React.FormEvent) => {
    e.preventDefault()
    const finalKey = isCustomDetailCustomMode
      ? customDetailCustomKey.trim()
      : customDetailKeyPreset.trim()
    const finalVal = customDetailValue.trim()

    if (!finalKey || !finalVal) {
      notify("Please provide both detail name and value", "warn")
      return
    }

    const currentDetails = gosala.customDetails || []
    const updated = [
      ...currentDetails,
      { id: `CD-${Date.now()}`, key: finalKey, value: finalVal },
    ]

    updateGosala(gosala.id, { customDetails: updated })
    notify(`Added detail "${finalKey}"`, "ok")
    setCustomDetailValue("")
    setCustomDetailCustomKey("")
    setIsCustomDetailCustomMode(false)
    setShowAddCustomDetailModal(false)
  }

  const handleDeleteCustomDetail = (index: number) => {
    const currentDetails = gosala.customDetails || []
    const updated = currentDetails.filter((_, i) => i !== index)
    updateGosala(gosala.id, { customDetails: updated })
    notify("Custom detail removed", "ok")
  }

  // 2. Add Facility
  const handleSaveFacility = (e: React.FormEvent) => {
    e.preventDefault()
    const finalFac = isCustomFacilityMode
      ? customFacilityText.trim()
      : facilityPreset.trim()

    if (!finalFac) {
      notify("Please specify facility amenity name", "warn")
      return
    }

    const currentFacilities = gosala.facilities || []
    if (currentFacilities.some((f) => f.toLowerCase() === finalFac.toLowerCase())) {
      notify("Facility amenity already registered", "warn")
      return
    }

    const updated = [...currentFacilities, finalFac]
    updateGosala(gosala.id, { facilities: updated })
    notify(`Added amenity "${finalFac}"`, "ok")
    setCustomFacilityText("")
    setIsCustomFacilityMode(false)
    setShowAddFacilityModal(false)
  }

  const handleRemoveFacility = (facToRemove: string) => {
    const currentFacilities = gosala.facilities || []
    const updated = currentFacilities.filter((f) => f !== facToRemove)
    updateGosala(gosala.id, { facilities: updated })
    notify(`Removed "${facToRemove}"`, "ok")
  }

  // 3. Edit Chief Caretaker
  const handleSaveCaretaker = (e: React.FormEvent) => {
    e.preventDefault()
    if (!caretakerName.trim()) {
      notify("Caretaker name is required", "warn")
      return
    }

    updateGosala(gosala.id, {
      caretaker: caretakerName.trim(),
      caretakerPhone: caretakerPhone.trim(),
      contactPhone: caretakerPhone.trim(),
      caretakerShift: caretakerShift.trim(),
      caretakerQuarters: caretakerQuarters.trim(),
    })
    notify("Chief Gosevak caretaker details updated", "ok")
    setShowEditCaretakerModal(false)
  }

  // 4. Add Additional Staff Member
  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffName.trim()) {
      notify("Staff member name is required", "warn")
      return
    }

    const currentStaff = gosala.additionalStaff || []
    const newStaff: GosalaStaff = {
      id: `STF-${Date.now()}`,
      name: staffName.trim(),
      role: staffRole.trim(),
      phone: staffPhone.trim(),
      shift: staffShift.trim(),
    }

    updateGosala(gosala.id, { additionalStaff: [...currentStaff, newStaff] })
    notify(`Added gosevak "${staffName}" to sanctuary team`, "ok")
    setStaffName("")
    setShowAddStaffModal(false)
  }

  const handleDeleteStaff = (index: number) => {
    const currentStaff = gosala.additionalStaff || []
    const updated = currentStaff.filter((_, i) => i !== index)
    updateGosala(gosala.id, { additionalStaff: updated })
    notify("Gosevak removed from team", "ok")
  }

  // 5. Assign Veterinarian to this Gaushala
  const handleAssignVet = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVetId) {
      notify("Please select a veterinarian from panel", "warn")
      return
    }

    const targetVet = vets.find((v) => v.id === selectedVetId)
    if (!targetVet) return

    const currentAssigned = targetVet.assignedGosalas || []
    if (!currentAssigned.includes(gosala.name)) {
      updateVet(targetVet.id, {
        assignedGosalas: [...currentAssigned, gosala.name],
      })
    }
    notify(`${targetVet.name} assigned to ${gosala.name}`, "ok")
    setShowAssignVetModal(false)
  }

  // 6. Register New Sacred Cow directly in this Gaushala
  const handleRegisterCow = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCowName.trim()) {
      notify("Please enter cow name", "warn")
      return
    }

    const newCow: Animal = {
      name: newCowName.trim(),
      tagId: `IN-MH-${Math.floor(1000 + Math.random() * 8999)}`,
      type: newCowType,
      breed: newCowBreed,
      gosala: gosala.name,
      age: `${newCowAge} yrs`,
      ageYears: Number(newCowAge) || 4,
      weight: `${newCowWeight} kg`,
      height: "135 cm",
      category: "Ceremonial Puja & Seva",
      price: 3500,
      status: newCowStatus as any,
      todayBookings: 0,
      maxDailyTrips: 2,
      maxRadiusKm: 25,
      cooldownMinutes: 90,
      assignedHandler: newCowHandler || gosala.caretaker,
      diet: "Fresh Napier grass, dry fodder, jowar straw, mineral salt lick",
      dietInfo: {
        greenFodder: "18-20 kg fresh Napier & Lucerne grass daily",
        dryRoughage: "6-8 kg dried Sorghum / Wheat straw",
        concentrateMix: "3-4 kg crushed grain mix (cottonseed, maize, wheat bran)",
        waterIntakeLiters: "55-65 liters clean fresh mineral water",
        feedingTimes: "Morning 06:30 AM · Evening 05:30 PM",
        postTripCare: "Warm electrolyte jaggery water within 30 min of arrival",
      },
      photo: newCowPhoto,
      photos: [newCowPhoto],
    }

    addAnimal(newCow)
    notify(`Sacred cow "${newCow.name}" registered to ${gosala.name}`, "ok")
    setNewCowName("")
    setShowAddResidentCowModal(false)
  }

  // 7. Save Capacity
  const handleSaveCapacity = (e: React.FormEvent) => {
    e.preventDefault()
    const capNum = parseInt(capacityInput, 10)
    if (isNaN(capNum) || capNum < 1) {
      notify("Capacity must be at least 1 bovine unit", "warn")
      return
    }
    updateGosala(gosala.id, { capacity: capNum })
    notify(`Capacity updated to ${capNum} bovine units`, "ok")
    setShowEditCapacityModal(false)
  }

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* 1. Top Navigation & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-line rounded-lg p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-md border border-line bg-paper hover:bg-paper-deep text-ink-soft hover:text-ink transition flex items-center gap-1.5 text-[12px] font-medium cursor-pointer"
            title="Return to Gaushalas Directory"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">All Gaushalas</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] uppercase tracking-wider font-mono text-forest font-semibold bg-forest-soft/30 px-2 py-0.5 rounded border border-forest/20">
                Gaushala Sanctuary Profile
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  gosala.status === "Active"
                    ? "bg-ok-soft/60 text-ok border-ok/30"
                    : gosala.status === "Maintenance"
                      ? "bg-warn-soft/60 text-warn border-warn/30"
                      : "bg-danger-soft/60 text-danger border-danger/30"
                }`}
              >
                ● {gosala.status}
              </span>
            </div>
            <h1 className="font-serif text-[18px] sm:text-[22px] text-ink font-semibold mt-0.5 flex items-center gap-2">
              {gosala.name}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddResidentCowModal(true)}
            className="px-3 py-1.5 rounded border border-saffron/40 bg-saffron-soft/30 hover:bg-saffron-soft/60 text-saffron-deep text-[12px] font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus size={13} className="text-saffron-deep" />
            <span>Add Resident Cow</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdatePhotos(gosala)}
            className="px-3 py-1.5 rounded border border-line bg-paper hover:bg-forest-soft/20 text-ink-soft hover:text-forest text-[12px] font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Camera size={13} className="text-forest" />
            <span>Manage Photos ({photos.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onEdit(gosala)}
            className="px-3.5 py-1.5 rounded bg-forest text-white hover:bg-forest-deep text-[12px] font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Edit3 size={13} />
            <span>Edit Shed Details</span>
          </button>
        </div>
      </div>

      {/* 2. Hero Sacred Profile Banner & Interactive Photo Carousel */}
      <div className="bg-card border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="relative aspect-[21/9] sm:aspect-[24/8] min-h-[220px] max-h-[360px] bg-paper-deep overflow-hidden group">
          <img
            src={currentPhoto}
            alt={gosala.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
          {/* Subtle Vedic Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent pointer-events-none" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-paper/95 backdrop-blur-md border border-line text-ink text-[11px] font-medium shadow-sm">
                <ShieldCheck size={13} className="text-forest" />
                <span>AWBI Verified Sanctuary</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-paper/90 backdrop-blur-md border border-line text-ink-soft text-[11px] font-mono shadow-sm">
                Reg: {gosala.trustRegistrationNo}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/90 text-white text-[10.5px] font-medium shadow-sm">
                Est. {gosala.establishedYear}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="p-1.5 rounded bg-ink/60 hover:bg-ink/80 text-white backdrop-blur-sm transition cursor-pointer"
                title="View Fullscreen"
              >
                <Maximize2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => onUpdatePhotos(gosala)}
                className="px-2.5 py-1 rounded bg-white/90 hover:bg-white text-ink text-[11px] font-medium backdrop-blur-sm transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Camera size={12} className="text-forest" />
                <span className="hidden sm:inline">Add / Edit Photos</span>
              </button>
            </div>
          </div>

          {/* Photo Navigation Arrows */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink/60 hover:bg-ink/90 text-white backdrop-blur-sm transition opacity-80 hover:opacity-100 cursor-pointer"
                aria-label="Previous Photo"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink/60 hover:bg-ink/90 text-white backdrop-blur-sm transition opacity-80 hover:opacity-100 cursor-pointer"
                aria-label="Next Photo"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Bottom Title & Sacred Vedic Blessing */}
          <div className="absolute bottom-3 left-4 right-4 text-white pointer-events-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-saffron-light text-[11px] tracking-wider uppercase font-mono">
                  <Sparkles size={13} className="text-amber-300" />
                  <span>गावो विश्वस्य मातरः • Vedic Cow Sanctuary & Seva Trust</span>
                </div>
                <h2 className="font-serif text-[20px] sm:text-[28px] text-white font-bold leading-tight drop-shadow-sm mt-0.5">
                  {gosala.name}
                </h2>
                <div className="flex items-center gap-3 text-[12px] text-paper/90 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-white">
                    <MapPin size={13} className="text-saffron shrink-0" />
                    <span>{gosala.address}</span>
                  </span>
                  <span className="text-white/40">•</span>
                  <span className="font-mono text-amber-200">
                    {gosala.region}
                  </span>
                </div>
              </div>

              {/* Photo Counter Pill */}
              <div className="bg-ink/70 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-white/90 border border-white/20 self-start sm:self-end">
                Photo {activePhotoIdx + 1} of {photos.length}
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail Carousel Bar */}
        {photos.length > 1 && (
          <div className="px-4 py-2.5 bg-paper/60 border-t border-line flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-ink-faint uppercase font-mono tracking-wider shrink-0 flex items-center gap-1">
                <ImageIcon size={12} className="text-forest" />
                Gallery Strip:
              </span>
              <div className="flex items-center gap-1.5">
                {photos.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`relative w-12 h-9 rounded overflow-hidden border-2 transition cursor-pointer shrink-0 ${
                      idx === activePhotoIdx
                        ? "border-forest scale-105 shadow-xs"
                        : "border-line opacity-70 hover:opacity-100 hover:border-line-strong"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-forest text-[8px] text-white text-center leading-tight py-0.2">
                        Cover
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePhotos(gosala)}
              className="text-[11px] text-forest hover:underline font-medium shrink-0 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} />
              <span>Add More Photos</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Vital Gaushala Metrics & Welfare Capacity Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Live Occupancy & Capacity */}
        <div className="bg-card border border-line rounded-lg p-3.5 shadow-xs relative group">
          <div className="flex items-center justify-between text-[11px] text-ink-faint font-medium mb-1">
            <span className="flex items-center gap-1">
              <Building2 size={13} className="text-forest" />
              Shed Capacity
            </span>
            <button
              type="button"
              onClick={() => {
                setCapacityInput(String(gosala.capacity || 40))
                setShowEditCapacityModal(true)
              }}
              className="text-[10px] text-forest hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
            >
              <Edit3 size={10} />
              <span>Edit</span>
            </button>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-[22px] font-bold text-ink">
              {residentCount}
            </span>
            <span className="text-[12px] text-ink-faint font-mono">
              / {capacity} Bovine Units
            </span>
          </div>
          {/* Visual Progress Bar */}
          <div className="w-full bg-paper-deep rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                occupancyPct > 90
                  ? "bg-danger"
                  : occupancyPct > 70
                    ? "bg-saffron"
                    : "bg-forest"
              }`}
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
          <span className="text-[10px] text-ink-faint mt-1.5 block">
            {availableStalls > 0
              ? `${availableStalls} stalls open for intake`
              : "Shed at maximum approved capacity"}
          </span>
        </div>

        {/* Metric 2: Resident Cattle Status */}
        <div className="bg-card border border-line rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-ink-faint font-medium mb-1">
            <span className="flex items-center gap-1">
              <PawPrint size={13} className="text-forest" />
              Resident Cattle
            </span>
            <button
              type="button"
              onClick={() => setShowAddResidentCowModal(true)}
              className="text-[10px] text-saffron-deep hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
            >
              <Plus size={10} />
              <span>Add Cow</span>
            </button>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-[22px] font-bold text-ink">
              {residentCount}
            </span>
            <span className="text-[11.5px] text-ink-soft">Sacred Cows</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10.5px]">
            <span className="px-1.5 py-0.5 rounded bg-ok-soft text-ok font-medium">
              {cattleStats.available} Available
            </span>
            {cattleStats.inSeva > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-saffron-soft text-saffron-deep font-medium">
                {cattleStats.inSeva} In Seva
              </span>
            )}
            {cattleStats.vetCare > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-warn-soft text-warn font-medium">
                {cattleStats.vetCare} Vet Care
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Chief Caretaker */}
        <div className="bg-card border border-line rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-ink-faint font-medium mb-1">
            <span className="flex items-center gap-1">
              <Users size={13} className="text-forest" />
              Chief Caretaker
            </span>
            <button
              type="button"
              onClick={() => {
                setCaretakerName(gosala.caretaker || "")
                setCaretakerPhone(gosala.caretakerPhone || gosala.contactPhone || "")
                setCaretakerShift(gosala.caretakerShift || "05:30 AM & 04:30 PM")
                setCaretakerQuarters(gosala.caretakerQuarters || "On-Site Quarter A")
                setShowEditCaretakerModal(true)
              }}
              className="text-[10px] text-forest hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
            >
              <Edit3 size={10} />
              <span>Edit</span>
            </button>
          </div>
          <div className="font-serif text-[15px] font-semibold text-ink mt-1 truncate">
            {gosala.caretaker}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <a
              href={`tel:${gosala.caretakerPhone || gosala.contactPhone}`}
              className="text-[11px] text-forest hover:underline font-medium inline-flex items-center gap-1 font-mono"
            >
              <Phone size={11} />
              <span>{gosala.caretakerPhone || gosala.contactPhone}</span>
            </a>
          </div>
        </div>

        {/* Metric 4: Dedicated Vet Doctor */}
        <div className="bg-card border border-line rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-ink-faint font-medium mb-1">
            <span className="flex items-center gap-1">
              <Stethoscope size={13} className="text-forest" />
              Empanelled Veterinarian
            </span>
            <button
              type="button"
              onClick={() => setShowAssignVetModal(true)}
              className="text-[10px] text-forest hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
            >
              <Edit3 size={10} />
              <span>Assign</span>
            </button>
          </div>
          <div className="font-serif text-[15px] font-semibold text-ink mt-1 truncate">
            {assignedVets.length > 0
              ? assignedVets[0].name
              : "Emergency Vet Panel"}
          </div>
          <div className="text-[11px] text-ink-faint mt-1.5 flex items-center gap-1">
            <BadgeCheck size={12} className="text-ok shrink-0" />
            <span className="truncate">
              {assignedVets.length > 0
                ? `${assignedVets[0].clinic || (assignedVets[0] as any).clinicName || "Bovine Healthcare Center"}`
                : "24/7 Bovine Emergency Call-out"}
            </span>
          </div>
        </div>
      </div>

      {/* Devotee Public Profile & Road En Route Controls */}
      <div className="bg-gradient-to-r from-forest/10 via-saffron/10 to-forest/5 border border-forest/20 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-forest text-white shadow-xs">
              <Compass size={11} />
              Public Devotee Profile View
            </span>
            <span className="text-[11px] text-ink-faint">
              What devotees see on the customer sanctuary page & road navigation route
            </span>
          </div>
          <div className="flex items-center gap-3.5 text-[12.5px] text-ink pt-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-medium bg-card px-2.5 py-1 rounded border border-line shadow-xs">
              <span className="text-forest">🌾 Land Area:</span>
              <strong className="font-semibold text-ink font-mono">{gosala.landAcres ?? 5.5} Acres</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium bg-card px-2.5 py-1 rounded border border-line shadow-xs">
              <span className="text-saffron-deep">⏰ Darshan Hours:</span>
              <strong className="font-semibold text-ink font-mono">{gosala.visitingHours || "6:00 AM – 7:30 PM (All 7 Days)"}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium bg-card px-2.5 py-1 rounded border border-line shadow-xs">
              <span className="text-forest">📍 Geodesics:</span>
              <span className="font-mono text-[11.5px] text-ink-soft">{(gosala.lat ?? 17.4401).toFixed(4)}, {(gosala.lng ?? 78.3489).toFixed(4)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium bg-card px-2.5 py-1 rounded border border-line shadow-xs">
              <span className="text-ink-soft">🛡️ Geofence:</span>
              <span className="font-mono text-[11.5px] text-forest font-semibold">35 km Radius</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEdit(gosala)}
          className="shrink-0 px-4 py-2 rounded-lg bg-forest hover:bg-forest-deep text-white text-[12px] font-medium transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
        >
          <Edit3 size={13} />
          <span>Edit Public Profile Details</span>
        </button>
      </div>

      {/* 4. Tab Navigation Strip */}
      <div className="flex items-center gap-1 border-b border-line bg-card/60 rounded-t-lg px-2 pt-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview & Facilities", icon: Building2 },
          {
            id: "herd",
            label: `Resident Cattle (${residentCount})`,
            icon: PawPrint,
          },
          {
            id: "gallery",
            label: `Photo Showcase (${photos.length})`,
            icon: Camera,
          },
          {
            id: "team",
            label: `Caretaker & Vet Team (${1 + (gosala.additionalStaff?.length || 0)})`,
            icon: Users,
          },
          {
            id: "bookings",
            label: `Seva Dispatches (${relatedBookings.length})`,
            icon: Calendar,
          },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ProfileTab)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium rounded-t transition cursor-pointer whitespace-nowrap border-b-2 ${
                isActive
                  ? "border-forest text-forest bg-paper font-semibold shadow-xs"
                  : "border-transparent text-ink-soft hover:text-ink hover:bg-paper-deep/60"
              }`}
            >
              <Icon size={14} className={isActive ? "text-forest" : "text-ink-faint"} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 5. Tab Content Views */}
      <div className="bg-card border border-line rounded-b-lg p-4 sm:p-6 shadow-xs">
        {/* TAB 1: OVERVIEW & FACILITIES */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* Sanctuary Mission & Vedic Description */}
            <div className="bg-paper border border-line rounded-lg p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                  <Heart size={16} className="text-saffron-deep" />
                  <span>Sacred Mission & Sanctum Overview</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onEdit(gosala)}
                  className="text-[11.5px] text-forest hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 size={11} />
                  <span>Edit Overview</span>
                </button>
              </div>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                {gosala.notes ||
                  `${gosala.name} is a dedicated indigenous bovine sanctuary established in ${gosala.establishedYear} with certified AWBI recognition (Registration: ${gosala.trustRegistrationNo}). The sanctuary upholds rigorous Vedic goseva standards with daily Surya Namaskar aartis, organic green Napier grazing, pure borewell water troughs, and round-the-clock veterinary oversight.`}
              </p>
            </div>

            {/* Sanctuary Land Area & Public Visiting Hours Card */}
            <div className="bg-paper border border-line rounded-lg p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                    <Compass size={16} className="text-forest" />
                    <span>Devotee Timings & Sanctuary Grounds Scale</span>
                  </h3>
                  <p className="text-[11px] text-ink-faint">
                    These parameters are rendered live on the Customer Portal and mobile route directions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(gosala)}
                  className="px-2.5 py-1 rounded bg-forest-soft/40 hover:bg-forest-soft text-forest text-[11.5px] font-medium transition inline-flex items-center gap-1 cursor-pointer border border-forest/20 shadow-xs"
                >
                  <Edit3 size={11} />
                  <span>Update Scale & Timings</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-card border border-line rounded-lg p-3">
                  <div className="text-[11px] font-mono text-ink-faint uppercase">Total Land Area</div>
                  <div className="font-serif text-[18px] font-bold text-ink mt-0.5">{gosala.landAcres ?? 5.5} Acres</div>
                  <div className="text-[10.5px] text-forest font-medium mt-1">Free-roam grazing & cow paddocks</div>
                </div>
                <div className="bg-card border border-line rounded-lg p-3">
                  <div className="text-[11px] font-mono text-ink-faint uppercase">Visiting & Darshan Hours</div>
                  <div className="font-serif text-[15px] font-semibold text-ink mt-0.5">{gosala.visitingHours || "6:00 AM – 7:30 PM (All 7 Days)"}</div>
                  <div className="text-[10.5px] text-saffron-deep font-medium mt-1">Open for public seva & aarti</div>
                </div>
                <div className="bg-card border border-line rounded-lg p-3">
                  <div className="text-[11px] font-mono text-ink-faint uppercase">Operational Service Geofence</div>
                  <div className="font-serif text-[18px] font-bold text-ink mt-0.5">35 km Radius</div>
                  <div className="text-[10.5px] text-ok font-medium mt-1">Automated dispatch & emergency transit</div>
                </div>
              </div>
            </div>

            {/* Verified Facilities & Infrastructure Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                    <ShieldCheck size={16} className="text-forest" />
                    <span>Verified Bovine Infrastructure & Amenities ({gosala.facilities?.length || 0})</span>
                  </h3>
                  <span className="text-[11px] text-ink-faint font-mono">
                    Inspected & AWBI Certified Facilities
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFacilityModal(true)}
                  className="px-2.5 py-1 rounded bg-forest-soft/40 hover:bg-forest-soft text-forest text-[11.5px] font-medium transition inline-flex items-center gap-1 cursor-pointer border border-forest/20 shadow-xs"
                >
                  <Plus size={12} />
                  <span>Add Facility / Amenity</span>
                </button>
              </div>

              {gosala.facilities && gosala.facilities.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {gosala.facilities.map((facility, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 p-3 rounded-lg border border-line bg-paper/60 hover:bg-paper hover:border-forest/40 transition group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-full bg-forest-soft/40 text-forest shrink-0 mt-0.5">
                          <Check size={12} strokeWidth={2.5} />
                        </div>
                        <div>
                          <div className="text-[12.5px] font-medium text-ink">
                            {facility}
                          </div>
                          <div className="text-[10.5px] text-ink-faint mt-0.5">
                            Active & Operational
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFacility(facility)}
                        className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-danger p-1 rounded transition cursor-pointer"
                        title="Remove facility"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded border border-dashed border-line text-center text-ink-faint text-[12px]">
                  No facilities listed. Click "+ Add Facility / Amenity" to configure amenities.
                </div>
              )}
            </div>

            {/* Customizable Sanctuary Details & Technical Specs */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                    <Sliders size={16} className="text-saffron-deep" />
                    <span>Custom Sanctuary Details & Specifications ({gosala.customDetails?.length || 0})</span>
                  </h3>
                  <span className="text-[11px] text-ink-faint">
                    Manager-defined attributes (pasture acreage, solar capacity, darshan hours, 80G certificate)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomDetailModal(true)}
                  className="px-2.5 py-1 rounded bg-saffron-soft/40 hover:bg-saffron-soft text-saffron-deep text-[11.5px] font-medium transition inline-flex items-center gap-1 cursor-pointer border border-saffron/30 shadow-xs"
                >
                  <Plus size={12} />
                  <span>Add Custom Detail</span>
                </button>
              </div>

              {gosala.customDetails && gosala.customDetails.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {gosala.customDetails.map((detail, idx) => (
                    <div
                      key={detail.id || idx}
                      className="p-3 rounded-lg border border-line bg-paper/50 hover:bg-paper hover:border-line-strong transition flex items-start justify-between gap-2 group"
                    >
                      <div>
                        <div className="text-[11px] font-mono text-ink-faint uppercase tracking-wider">
                          {detail.key}
                        </div>
                        <div className="text-[13px] font-medium text-ink mt-0.5">
                          {detail.value}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomDetail(idx)}
                        className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-danger p-1 rounded transition cursor-pointer"
                        title="Remove detail"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded-lg border border-dashed border-line text-center bg-paper/20">
                  <Sliders size={20} className="text-ink-faint mx-auto mb-1.5" />
                  <p className="text-[12.5px] font-medium text-ink">No Custom Details Added Yet</p>
                  <p className="text-[11px] text-ink-faint mt-0.5 max-w-sm mx-auto">
                    Add custom attributes like Total Land Area, Fodder Silo Capacity, Solar Grid, or Visitor Darshan Timings.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomDetailModal(true)}
                    className="mt-2.5 px-3 py-1 rounded bg-paper-deep text-forest border border-line text-[11.5px] font-medium hover:bg-paper transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add First Sanctuary Detail</span>
                  </button>
                </div>
              )}
            </div>

            {/* Logistics & Address Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-line">
              <div className="bg-paper/60 border border-line rounded-lg p-4 space-y-3">
                <h4 className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
                  <MapPin size={14} className="text-forest" />
                  <span>Physical Address & Logistics Corridor</span>
                </h4>
                <div className="text-[12.5px] text-ink-soft">
                  <p className="font-medium text-ink">{gosala.address}</p>
                  <p className="text-[11.5px] text-ink-faint mt-0.5 font-mono">
                    Region: {gosala.region}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(gosala.address, "Address")}
                    className="text-[11px] text-forest hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Copy size={11} />
                    <span>{copiedField === "Address" ? "Copied!" : "Copy Address"}</span>
                  </button>
                  <span className="text-line-strong">•</span>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(gosala.address + ", " + gosala.region)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-forest hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <ExternalLink size={11} />
                    <span>Open in Maps</span>
                  </a>
                </div>
              </div>

              <div className="bg-paper/60 border border-line rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
                    <Phone size={14} className="text-forest" />
                    <span>Sanctum Communications & Caretaker Desk</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => onEdit(gosala)}
                    className="text-[10.5px] text-forest hover:underline font-medium cursor-pointer"
                  >
                    Edit Phone/Email
                  </button>
                </div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Direct Phone:</span>
                    <a
                      href={`tel:${gosala.contactPhone}`}
                      className="font-medium text-forest hover:underline font-mono"
                    >
                      {gosala.contactPhone}
                    </a>
                  </div>
                  {gosala.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-ink-faint">Official Email:</span>
                      <a
                        href={`mailto:${gosala.email}`}
                        className="font-medium text-forest hover:underline text-[11.5px]"
                      >
                        {gosala.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Head Gosevak:</span>
                    <span className="font-medium text-ink">
                      {gosala.caretaker}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RESIDENT CATTLE HERD */}
        {activeTab === "herd" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
              <div>
                <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                  <PawPrint size={16} className="text-forest" />
                  <span>Resident Sacred Cattle ({residentCattle.length})</span>
                </h3>
                <p className="text-[11.5px] text-ink-faint mt-0.5">
                  Cattle housed at {gosala.name} available for devotee pujas & rituals
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search resident cattle..."
                  value={herdSearchQuery}
                  onChange={(e) => setHerdSearchQuery(e.target.value)}
                  className="bg-paper border border-line rounded px-2.5 py-1 text-[12px] text-ink outline-none focus:border-forest w-48 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowAddResidentCowModal(true)}
                  className="px-3 py-1 bg-saffron text-white rounded text-[12px] font-medium hover:bg-saffron-deep transition flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus size={13} />
                  <span>Register Cow</span>
                </button>
              </div>
            </div>

            {filteredHerd.length === 0 ? (
              <div className="text-center py-12 px-4 bg-paper/40 rounded-lg border border-dashed border-line">
                <PawPrint size={32} className="text-ink-faint mx-auto mb-2" />
                <h4 className="font-serif text-[15px] text-ink font-semibold">
                  No Cattle Found
                </h4>
                <p className="text-[12px] text-ink-faint mt-1 max-w-sm mx-auto">
                  {herdSearchQuery
                    ? `No resident cows matched "${herdSearchQuery}".`
                    : `No cattle are currently assigned to this Gaushala shed.`}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddResidentCowModal(true)}
                  className="mt-3 px-3.5 py-1.5 bg-forest text-white rounded text-[12px] font-medium hover:bg-forest-deep transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={13} />
                  <span>Register First Cow to {gosala.name}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {filteredHerd.map((cow) => (
                  <div
                    key={cow.name}
                    className="border border-line rounded-lg bg-card hover:border-forest/50 transition overflow-hidden shadow-xs group"
                  >
                    <div className="relative aspect-[16/10] bg-paper-deep overflow-hidden">
                      <img
                        src={cow.photo}
                        alt={cow.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <span
                        className={`absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-md shadow-xs ${
                          cow.status === "Available"
                            ? "bg-ok-soft text-ok border border-ok/30"
                            : cow.status === "In Seva"
                              ? "bg-saffron-soft text-saffron-deep border border-saffron/30"
                              : "bg-warn-soft text-warn border border-warn/30"
                        }`}
                      >
                        ● {cow.status}
                      </span>
                      {cow.photos && cow.photos.length > 1 && (
                        <span className="absolute bottom-2 right-2 bg-ink/70 text-white text-[9.5px] font-mono px-1.5 py-0.5 rounded backdrop-blur-sm">
                          {cow.photos.length} photos
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-baseline justify-between">
                        <h4 className="font-serif text-[15px] font-semibold text-ink">
                          {cow.name}
                        </h4>
                        <span className="text-[11px] font-mono text-ink-faint">
                          {cow.breed || cow.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-faint mt-1 flex items-center justify-between">
                        <span>Age: {cow.ageYears || 4} yrs</span>
                        <span>Handler: {cow.assignedHandler || gosala.caretaker}</span>
                      </div>
                      {onViewAnimalWelfare && (
                        <button
                          type="button"
                          onClick={() => onViewAnimalWelfare(cow.name)}
                          className="w-full mt-2.5 pt-2 border-t border-line text-[11px] text-forest hover:underline font-medium text-center inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Inspect Welfare Dossier</span>
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PHOTO SHOWCASE GALLERY */}
        {activeTab === "gallery" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                  <Camera size={16} className="text-forest" />
                  <span>Sanctum & Facility Photographs ({photos.length})</span>
                </h3>
                <p className="text-[11.5px] text-ink-faint mt-0.5">
                  High-resolution premises photos shown to devotees during booking
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdatePhotos(gosala)}
                className="px-3 py-1.5 bg-forest text-white rounded text-[12px] font-medium hover:bg-forest-deep transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={13} />
                <span>Upload New Photos</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((url, idx) => (
                <div
                  key={idx}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border border-line bg-paper-deep group shadow-xs"
                >
                  <img
                    src={url}
                    alt={`Sanctum Photo ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePhotoIdx(idx)
                        setIsLightboxOpen(true)
                      }}
                      className="p-1.5 rounded-full bg-paper text-ink hover:text-forest transition cursor-pointer"
                      title="View Fullscreen"
                    >
                      <Maximize2 size={13} />
                    </button>
                  </div>
                  {idx === 0 && (
                    <span className="absolute top-2 left-2 bg-saffron text-white text-[9.5px] font-semibold px-2 py-0.5 rounded shadow-xs">
                      ★ Primary Cover
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 bg-ink/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded backdrop-blur-sm">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CARETAKER & VET TEAM */}
        {activeTab === "team" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-line">
              <div>
                <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
                  <Users size={16} className="text-forest" />
                  <span>Dedicated Bovine Welfare & Veterinary Personnel</span>
                </h3>
                <p className="text-[11.5px] text-ink-faint">
                  Personnel responsible for cattle feeding, healthcare and sanctuary maintenance
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-2.5 py-1 rounded bg-forest-soft/50 hover:bg-forest-soft text-forest text-[11.5px] font-medium transition inline-flex items-center gap-1 cursor-pointer border border-forest/20 shadow-xs"
                >
                  <UserPlus size={12} />
                  <span>+ Add Gosevak Staff</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignVetModal(true)}
                  className="px-2.5 py-1 rounded bg-saffron-soft/50 hover:bg-saffron-soft text-saffron-deep text-[11.5px] font-medium transition inline-flex items-center gap-1 cursor-pointer border border-saffron/20 shadow-xs"
                >
                  <Stethoscope size={12} />
                  <span>Assign Doctor</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Caretaker Profile Card */}
              <div className="border border-line rounded-lg bg-paper/60 p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-forest-soft text-forest flex items-center justify-center font-serif text-[18px] font-bold shrink-0">
                      {gosala.caretaker.charAt(0)}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-forest font-semibold bg-forest-soft/40 px-2 py-0.5 rounded">
                        Chief On-Site Gosevak
                      </span>
                      <h4 className="font-serif text-[16px] font-semibold text-ink mt-1">
                        {gosala.caretaker}
                      </h4>
                      <p className="text-[11.5px] text-ink-faint">
                        Resident Sanctuary Supervisor
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCaretakerName(gosala.caretaker || "")
                      setCaretakerPhone(gosala.caretakerPhone || gosala.contactPhone || "")
                      setCaretakerShift(gosala.caretakerShift || "05:30 AM & 04:30 PM")
                      setCaretakerQuarters(gosala.caretakerQuarters || "On-Site Quarter A")
                      setShowEditCaretakerModal(true)
                    }}
                    className="p-1 rounded text-ink-faint hover:text-forest hover:bg-paper transition cursor-pointer"
                    title="Edit caretaker details"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>

                <div className="pt-2 border-t border-line text-[12px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Contact:</span>
                    <a
                      href={`tel:${gosala.caretakerPhone || gosala.contactPhone}`}
                      className="font-medium text-forest hover:underline font-mono"
                    >
                      {gosala.caretakerPhone || gosala.contactPhone}
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Feeding Shift:</span>
                    <span className="text-ink font-medium">
                      {gosala.caretakerShift || "05:30 AM & 04:30 PM"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Location:</span>
                    <span className="text-ink font-medium">
                      {gosala.caretakerQuarters || "On-Site Quarter"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel Vet Doctor Card */}
              <div className="border border-line rounded-lg bg-paper/60 p-4 space-y-3 shadow-xs">
                {assignedVets.length > 0 ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-saffron-soft text-saffron-deep flex items-center justify-center font-serif text-[18px] font-bold shrink-0">
                          {assignedVets[0].name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-saffron-deep font-semibold bg-saffron-soft/40 px-2 py-0.5 rounded">
                            Empanelled Veterinary Officer
                          </span>
                          <h4 className="font-serif text-[16px] font-semibold text-ink mt-1">
                            {assignedVets[0].name}
                          </h4>
                          <p className="text-[11.5px] text-ink-faint">
                            {assignedVets[0].clinic || (assignedVets[0] as any).clinicName || "Veterinary Polyclinic"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAssignVetModal(true)}
                        className="p-1 rounded text-ink-faint hover:text-saffron-deep hover:bg-paper transition cursor-pointer"
                        title="Change assigned vet"
                      >
                        <Edit3 size={13} />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-line text-[12px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-ink-faint">Emergency Phone:</span>
                        <a
                          href={`tel:${assignedVets[0].phone}`}
                          className="font-medium text-forest hover:underline font-mono"
                        >
                          {assignedVets[0].phone}
                        </a>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-ink-faint">Registration No:</span>
                        <span className="text-ink font-mono">
                          {assignedVets[0].regNo}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-ink-faint">Visit Frequency:</span>
                        <span className="text-ink font-medium">
                          Weekly & 24/7 On-Call
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center text-ink-faint space-y-2">
                    <Stethoscope size={24} className="text-ink-faint mx-auto" />
                    <p className="text-[12.5px] font-medium text-ink">
                      No Specific Doctor Assigned
                    </p>
                    <p className="text-[11px]">
                      Sanctum is currently serviced by Central Regional Medical Panel.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAssignVetModal(true)}
                      className="px-3 py-1 bg-forest text-white rounded text-[11.5px] font-medium hover:bg-forest-deep transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Assign Dedicated Vet Doctor</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Gosevak Staff Team Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                  <Users size={14} className="text-forest" />
                  <span>Sanctum Caretaking Team & Staff ({gosala.additionalStaff?.length || 0})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="text-[11px] text-forest hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={11} />
                  <span>Add Staff Member</span>
                </button>
              </div>

              {gosala.additionalStaff && gosala.additionalStaff.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {gosala.additionalStaff.map((staff, idx) => (
                    <div
                      key={staff.id || idx}
                      className="border border-line rounded-lg p-3 bg-paper/50 hover:bg-paper transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-forest font-semibold bg-forest-soft/40 px-1.5 py-0.5 rounded">
                            {staff.role}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(idx)}
                            className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-danger p-0.5 rounded transition cursor-pointer"
                            title="Remove staff member"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <h5 className="font-serif text-[14px] font-semibold text-ink mt-1.5">
                          {staff.name}
                        </h5>
                        <div className="text-[11px] text-ink-faint mt-1">
                          Shift: <span className="text-ink-soft">{staff.shift || "Day Shift"}</span>
                        </div>
                      </div>
                      <div className="pt-2 mt-2 border-t border-line/60">
                        <a
                          href={`tel:${staff.phone}`}
                          className="text-[11px] font-mono text-forest hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <Phone size={10} />
                          <span>{staff.phone}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded border border-dashed border-line text-center text-ink-faint text-[12px] bg-paper/20">
                  <p>No additional staff members listed. Click "+ Add Staff Member" to add assistant gosevaks, feed handlers, or van drivers.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SEVA DISPATCHES & PUJA BOOKINGS */}
        {activeTab === "bookings" && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-serif text-[16px] text-ink font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-forest" />
              <span>Sacred Seva Dispatches & Puja Schedule ({relatedBookings.length})</span>
            </h3>

            {relatedBookings.length === 0 ? (
              <div className="text-center py-10 bg-paper/40 rounded-lg border border-dashed border-line">
                <Calendar size={28} className="text-ink-faint mx-auto mb-2" />
                <p className="font-serif text-[14px] text-ink font-semibold">
                  No Home Visit Pujas Scheduled
                </p>
                <p className="text-[12px] text-ink-faint mt-1">
                  All cattle residing at {gosala.name} are currently resting peacefully in the shed.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-line border border-line rounded-lg overflow-hidden">
                {relatedBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-paper/40 hover:bg-paper-deep/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13px] text-ink">
                          {b.ritualPurpose || "Gau Seva / Puja"}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-forest-soft text-forest">
                          {b.status}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-ink-faint mt-0.5">
                        Devotee: <span className="text-ink">{b.customer}</span> •
                        Cattle: <span className="text-ink font-medium">{b.animal}</span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right text-[11px] text-ink-faint">
                      <div className="font-medium text-ink">{b.date} • {b.start} - {b.end}</div>
                      <div className="text-[10.5px]">{b.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MODALS FOR ADDING DETAILS --- */}

      {/* 1. Modal: Add Custom Sanctuary Detail */}
      {showAddCustomDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-saffron-soft text-saffron-deep">
                  <Sliders size={16} />
                </div>
                <h3 className="font-serif text-[16px] text-ink font-bold">
                  Add Sanctuary Specification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomDetailModal(false)}
                className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomDetail} className="p-5 space-y-4">
              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Specification Field
                </label>
                <select
                  value={isCustomDetailCustomMode ? "__CUSTOM__" : customDetailKeyPreset}
                  onChange={(e) => {
                    if (e.target.value === "__CUSTOM__") {
                      setIsCustomDetailCustomMode(true)
                    } else {
                      setIsCustomDetailCustomMode(false)
                      setCustomDetailKeyPreset(e.target.value)
                    }
                  }}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                >
                  {GOSALA_CUSTOM_DETAIL_SUGGESTIONS.map((sug) => (
                    <option key={sug} value={sug}>
                      {sug}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Enter Custom Specification...</option>
                </select>

                {isCustomDetailCustomMode && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom field name (e.g. Borewell Depth, Solar KVA)..."
                    value={customDetailCustomKey}
                    onChange={(e) => setCustomDetailCustomKey(e.target.value)}
                    className="w-full mt-2 bg-paper border border-forest rounded px-3 py-1.5 text-[12px] text-ink outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Value / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15.5 Acres certified organic Napier, 10 kW Grid..."
                  value={customDetailValue}
                  onChange={(e) => setCustomDetailValue(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddCustomDetailModal(false)}
                  className="px-3.5 py-1.5 rounded border border-line bg-card text-ink-soft hover:bg-paper-deep text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-saffron text-white hover:bg-saffron-deep text-[12px] font-medium cursor-pointer shadow-xs"
                >
                  Save Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Add Verified Facility Amenity */}
      {showAddFacilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-forest-soft text-forest">
                  <ShieldCheck size={16} />
                </div>
                <h3 className="font-serif text-[16px] text-ink font-bold">
                  Add Bovine Facility Amenity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFacilityModal(false)}
                className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveFacility} className="p-5 space-y-4">
              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Select or Enter Amenity
                </label>
                <select
                  value={isCustomFacilityMode ? "__CUSTOM__" : facilityPreset}
                  onChange={(e) => {
                    if (e.target.value === "__CUSTOM__") {
                      setIsCustomFacilityMode(true)
                    } else {
                      setIsCustomFacilityMode(false)
                      setFacilityPreset(e.target.value)
                    }
                  }}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                >
                  {GOSALA_FACILITY_OPTIONS.map((fac) => (
                    <option key={fac} value={fac}>
                      {fac}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Enter Custom Amenity / Infrastructure...</option>
                </select>

                {isCustomFacilityMode && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom facility (e.g. Biogas Unit, Solar Fencing)..."
                    value={customFacilityText}
                    onChange={(e) => setCustomFacilityText(e.target.value)}
                    className="w-full mt-2 bg-paper border border-forest rounded px-3 py-1.5 text-[12px] text-ink outline-none"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddFacilityModal(false)}
                  className="px-3.5 py-1.5 rounded border border-line bg-card text-ink-soft hover:bg-paper-deep text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-forest text-white hover:bg-forest-deep text-[12px] font-medium cursor-pointer shadow-xs"
                >
                  Add Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Edit Chief Caretaker */}
      {showEditCaretakerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-forest-soft text-forest">
                  <Users size={16} />
                </div>
                <h3 className="font-serif text-[16px] text-ink font-bold">
                  Edit Chief Gosevak Caretaker
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditCaretakerModal(false)}
                className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCaretaker} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Caretaker Full Name
                </label>
                <input
                  type="text"
                  required
                  value={caretakerName}
                  onChange={(e) => setCaretakerName(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Contact Mobile Phone
                </label>
                <input
                  type="tel"
                  required
                  value={caretakerPhone}
                  onChange={(e) => setCaretakerPhone(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Daily Feeding / Care Shift
                </label>
                <input
                  type="text"
                  value={caretakerShift}
                  onChange={(e) => setCaretakerShift(e.target.value)}
                  placeholder="e.g. 05:30 AM & 04:30 PM"
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Resident Quarter / Stall Location
                </label>
                <input
                  type="text"
                  value={caretakerQuarters}
                  onChange={(e) => setCaretakerQuarters(e.target.value)}
                  placeholder="e.g. On-Site Quarter A"
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowEditCaretakerModal(false)}
                  className="px-3.5 py-1.5 rounded border border-line bg-card text-ink-soft hover:bg-paper-deep text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-forest text-white hover:bg-forest-deep text-[12px] font-medium cursor-pointer shadow-xs"
                >
                  Update Caretaker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Add Additional Gosevak Staff */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-forest-soft text-forest">
                  <UserPlus size={16} />
                </div>
                <h3 className="font-serif text-[16px] text-ink font-bold">
                  Add Gosevak Staff Member
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Staff Member Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Govind Patil"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Role / Specialization
                </label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                >
                  {ROLE_PRESETS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Contact Mobile Phone
                </label>
                <input
                  type="tel"
                  required
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Shift Timing
                </label>
                <select
                  value={staffShift}
                  onChange={(e) => setStaffShift(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                >
                  {SHIFT_PRESETS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-3.5 py-1.5 rounded border border-line bg-card text-ink-soft hover:bg-paper-deep text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-forest text-white hover:bg-forest-deep text-[12px] font-medium cursor-pointer shadow-xs"
                >
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Assign Veterinarian */}
      {showAssignVetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-saffron-soft text-saffron-deep">
                  <Stethoscope size={16} />
                </div>
                <h3 className="font-serif text-[16px] text-ink font-bold">
                  Assign Empanelled Veterinarian
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignVetModal(false)}
                className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAssignVet} className="p-5 space-y-4">
              <p className="text-[12px] text-ink-soft">
                Choose a certified veterinarian from your empanelled panel to oversee health inspections and emergency medical care at <strong>{gosala.name}</strong>:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {vets.map((v) => {
                  const isAssigned =
                    (v.assignedGosalas && v.assignedGosalas.includes(gosala.name)) ||
                    (v.assignedGosalas && v.assignedGosalas.includes("All Gaushalas"))
                  return (
                    <label
                      key={v.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition cursor-pointer ${
                        selectedVetId === v.id
                          ? "border-forest bg-forest-soft/30 shadow-xs"
                          : "border-line bg-card hover:bg-paper-deep"
                      }`}
                    >
                      <input
                        type="radio"
                        name="assignedVet"
                        value={v.id}
                        checked={selectedVetId === v.id}
                        onChange={() => setSelectedVetId(v.id)}
                        className="mt-1 accent-forest"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[13px] text-ink">
                            {v.name}
                          </span>
                          {isAssigned && (
                            <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-ok-soft text-ok font-semibold">
                              Currently Assigned
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-ink-faint mt-0.5 truncate">
                          {v.clinic || (v as any).clinicName}
                        </div>
                        <div className="text-[11px] font-mono text-forest mt-0.5">
                          {v.phone} • Reg: {v.regNo}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAssignVetModal(false)}
                  className="px-3.5 py-1.5 rounded border border-line bg-card text-ink-soft hover:bg-paper-deep text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedVetId}
                  className="px-4 py-1.5 rounded bg-forest text-white hover:bg-forest-deep text-[12px] font-medium cursor-pointer shadow-xs disabled:opacity-50"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Register Cow to this Shed */}
      {showAddResidentCowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-lg my-auto overflow-hidden animate-slide-up max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-saffron-soft text-saffron-deep">
                  <PawPrint size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-[16px] text-ink font-bold">
                    Register Sacred Cow to Shed
                  </h3>
                  <p className="text-[11px] text-ink-faint">
                    Housed at <strong>{gosala.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddResidentCowModal(false)}
                className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRegisterCow} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-medium text-ink mb-1">
                    Sacred Cow Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Surabhi, Kamadhenu"
                    value={newCowName}
                    onChange={(e) => setNewCowName(e.target.value)}
                    className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-ink mb-1">
                    Indigenous Breed
                  </label>
                  <select
                    value={newCowBreed}
                    onChange={(e) => setNewCowBreed(e.target.value)}
                    className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                  >
                    {BREED_PRESETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11.5px] font-medium text-ink mb-1">
                    Bovine Type
                  </label>
                  <select
                    value={newCowType}
                    onChange={(e) => setNewCowType(e.target.value as any)}
                    className="w-full bg-paper border border-line focus:border-forest rounded px-2.5 py-2 text-[12px] text-ink outline-none"
                  >
                    <option value="Cow">Sacred Cow</option>
                    <option value="Calf">Young Calf</option>
                    <option value="Bull">Sacred Bull</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-ink mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="25"
                    value={newCowAge}
                    onChange={(e) => setNewCowAge(e.target.value)}
                    className="w-full bg-paper border border-line focus:border-forest rounded px-2.5 py-2 text-[12px] text-ink outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-ink mb-1">
                    Weight (Kg)
                  </label>
                  <input
                    type="number"
                    value={newCowWeight}
                    onChange={(e) => setNewCowWeight(e.target.value)}
                    className="w-full bg-paper border border-line focus:border-forest rounded px-2.5 py-2 text-[12px] text-ink outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-medium text-ink mb-1">
                    Operational Status
                  </label>
                  <select
                    value={newCowStatus}
                    onChange={(e) => setNewCowStatus(e.target.value)}
                    className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                  >
                    <option value="Available">Available for Pujas</option>
                    <option value="Resting Buffer">Resting Buffer</option>
                    <option value="Vet Care">Vet Care Quarantine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-ink mb-1">
                    Assigned Gosevak
                  </label>
                  <input
                    type="text"
                    value={newCowHandler}
                    onChange={(e) => setNewCowHandler(e.target.value)}
                    className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12.5px] text-ink outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Cow Photo URL
                </label>
                <input
                  type="url"
                  required
                  value={newCowPhoto}
                  onChange={(e) => setNewCowPhoto(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[12px] text-ink outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddResidentCowModal(false)}
                  className="px-3.5 py-1.5 rounded border border-line bg-card text-ink-soft hover:bg-paper-deep text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-saffron text-white hover:bg-saffron-deep text-[12px] font-medium cursor-pointer shadow-xs"
                >
                  Register Sacred Cow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Edit Capacity */}
      {showEditCapacityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-paper border border-line rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-forest-soft text-forest">
                  <Building2 size={16} />
                </div>
                <h3 className="font-serif text-[16px] text-ink font-bold">
                  Adjust Shed Capacity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditCapacityModal(false)}
                className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCapacity} className="p-5 space-y-4">
              <div>
                <label className="block text-[11.5px] font-medium text-ink mb-1">
                  Approved Bovine Capacity (Units)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  className="w-full bg-paper border border-line focus:border-forest rounded px-3 py-2 text-[14px] text-ink outline-none font-bold"
                />
                <p className="text-[11px] text-ink-faint mt-1">
                  Currently housing {residentCount} resident cattle.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowEditCapacityModal(false)}
                  className="px-3.5 py-1.5 rounded border border-line bg-card text-ink-soft hover:bg-paper-deep text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-forest text-white hover:bg-forest-deep text-[12px] font-medium cursor-pointer shadow-xs"
                >
                  Save Capacity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Lightbox Fullscreen Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <img
              src={currentPhoto}
              alt={gosala.name}
              className="max-h-[80vh] w-auto object-contain rounded-lg shadow-2xl border border-white/20"
            />
            <div className="text-white text-center mt-3 text-[12px] font-medium flex items-center gap-3">
              <span>{gosala.name}</span>
              <span>•</span>
              <span>Photo {activePhotoIdx + 1} of {photos.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
