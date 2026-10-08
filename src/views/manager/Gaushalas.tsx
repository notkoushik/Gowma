import React, { useState, useMemo, useRef } from "react"
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Edit2,
  Trash2,
  PawPrint,
  Sparkles,
  ArrowRight,
  X,
  Check,
  Clock,
  Layers,
  Award,
  ExternalLink,
  Camera,
  Image as ImageIcon,
  UploadCloud,
  Upload,
  RefreshCw,
  Link2,
  Percent,
  Landmark,
  ShieldAlert,
  FileText,
  Crown,
  Globe,
} from "lucide-react"
import { useStore, useToast, type Gosala } from "../../store/store"
import {
  GOSALA_FACILITY_OPTIONS,
  GOSALA_REGION_PRESETS,
  GOSALA_PHOTO_PRESETS,
  type GosalaStatus,
} from "../../data/gosalas"
import {
  INDIAN_REGIONAL_HUBS,
  getAllIndianStates,
  getHubsForState,
} from "../../data/regions"
import { Panel, Tag, StatusPill } from "../../lib/ui"
import GaushalaProfileView from "./GaushalaProfileView"
import MapLocationPicker from "../../components/MapLocationPicker"

// ============================================================================
// Gaushala Premise Photo Uploader Component
// ============================================================================

interface GosalaPhotoUploaderProps {
  currentPhoto: string
  photos?: string[]
  onPhotoChange: (url: string) => void
  onPhotosChange?: (photos: string[]) => void
  label?: string
  helperText?: string
}

function GosalaPhotoUploader({
  currentPhoto,
  photos,
  onPhotoChange,
  onPhotosChange,
  label = "Gaushala Shelter Photographs",
  helperText = "Prominently displayed on manager roster, devotee booking screens, and official transit permits",
}: GosalaPhotoUploaderProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "presets" | "url">("upload")
  const [urlInput, setUrlInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Combined active photos array
  const galleryList: string[] = useMemo(() => {
    if (photos && photos.length > 0) {
      return photos
    }
    if (currentPhoto) {
      return [currentPhoto]
    }
    return [GOSALA_PHOTO_PRESETS[0].url]
  }, [photos, currentPhoto])

  const [activePreview, setActivePreview] = useState<string>(
    currentPhoto || galleryList[0],
  )

  // Ensure activePreview points to a valid photo
  const currentPreview = galleryList.includes(activePreview)
    ? activePreview
    : (currentPhoto || galleryList[0])

  const handleSetCover = (url: string) => {
    onPhotoChange(url)
    setActivePreview(url)
    if (onPhotosChange) {
      const reordered = [url, ...galleryList.filter((p) => p !== url)]
      onPhotosChange(reordered)
    }
  }

  const handleRemovePhoto = (url: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (galleryList.length <= 1) {
      alert("At least one photo must be kept for this Gaushala premise.")
      return
    }
    const filtered = galleryList.filter((p) => p !== url)
    if (onPhotosChange) {
      onPhotosChange(filtered)
    }
    if (currentPhoto === url) {
      onPhotoChange(filtered[0])
    }
    if (activePreview === url) {
      setActivePreview(filtered[0])
    }
  }

  const handleAddPhotos = (newUrls: string[]) => {
    const fresh = newUrls.filter((u) => !galleryList.includes(u))
    if (fresh.length === 0) return
    const updated = [...galleryList, ...fresh]
    if (onPhotosChange) {
      onPhotosChange(updated)
    }
    setActivePreview(fresh[0])
  }

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (fileArray.length === 0) {
      alert("Please upload valid image files (JPG, PNG, WebP).")
      return
    }
    setIsProcessing(true)

    const readPromises = fileArray.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const res = e.target?.result as string
            if (res) resolve(res)
            else reject(new Error("Empty image"))
          }
          reader.onerror = () => reject(new Error("File read error"))
          reader.readAsDataURL(file)
        }),
    )

    try {
      const results = await Promise.all(readPromises)
      handleAddPhotos(results)
    } catch {
      alert("Some files could not be processed. Please try again.")
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    handleAddPhotos([urlInput.trim()])
    setUrlInput("")
  }

  const isCover = currentPreview === currentPhoto

  return (
    <div className="space-y-4 bg-card border border-line rounded-lg p-3.5 sm:p-4">
      {/* 1. Header with Gallery Counter & Badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="block text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
            <Camera size={14} className="text-forest" />
            <span>{label}</span>
          </label>
          <p className="text-[11px] text-ink-faint mt-0.5">{helperText}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-forest-soft text-forest border border-forest/20 font-medium">
            {galleryList.length} Photos in Gallery
          </span>
        </div>
      </div>

      {/* 2. Main Large Photo Viewport & Cover Indicator */}
      <div className="relative w-full h-48 sm:h-56 rounded-md overflow-hidden border border-line bg-paper-deep group">
        <img
          src={currentPreview}
          alt="Gaushala Premise Preview"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-3 flex items-center justify-between text-white text-[11px]">
          {isCover ? (
            <span className="font-mono px-2.5 py-0.5 rounded-full bg-forest/90 text-white backdrop-blur-md border border-white/20 flex items-center gap-1 shadow-xs">
              <CheckCircle2 size={12} /> Primary Cover Photo
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleSetCover(currentPreview)}
              className="font-mono px-2.5 py-1 rounded bg-black/70 hover:bg-forest text-white backdrop-blur-md border border-white/20 flex items-center gap-1 text-[10.5px] transition cursor-pointer shadow-xs"
            >
              ★ Make Primary Cover
            </button>
          )}

          <span className="font-mono px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10.5px]">
            {galleryList.indexOf(currentPreview) + 1} / {galleryList.length}
          </span>
        </div>

        {/* Bottom Actions */}
        <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-white text-[11px]">
          <div className="drop-shadow-xs font-medium text-[11px] truncate">
            {GOSALA_PHOTO_PRESETS.find((p) => p.url === currentPreview)?.label || "Gaushala Facility Angle"}
          </div>
          {galleryList.length > 1 && (
            <button
              type="button"
              onClick={(e) => handleRemovePhoto(currentPreview, e)}
              className="px-2 py-1 rounded bg-danger/80 hover:bg-danger text-white text-[10.5px] font-medium flex items-center gap-1 cursor-pointer transition shadow-xs"
              title="Delete this photo from shelter"
            >
              <Trash2 size={11} /> Remove Photo
            </button>
          )}
        </div>
      </div>

      {/* 3. Multi-Photo Gallery Strip (Devotees see all these photos) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="font-medium text-ink flex items-center gap-1.5">
            <Layers size={13} className="text-saffron-deep" />
            <span>Active Photo Gallery ({galleryList.length})</span>
          </span>
          <span className="text-[10.5px] text-ink-faint">
            Tap thumbnail to view · ★ marks listing cover
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {galleryList.map((url, idx) => {
            const isSelected = url === currentPreview
            const isMainCover = url === currentPhoto
            return (
              <div
                key={url + idx}
                onClick={() => setActivePreview(url)}
                className={`relative group rounded-md overflow-hidden aspect-[4/3] border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-forest ring-2 ring-forest/30 shadow-xs"
                    : "border-line opacity-85 hover:opacity-100 hover:border-forest/50"
                }`}
              >
                <img
                  src={url}
                  alt={`Shelter Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Cover badge on thumbnail */}
                {isMainCover && (
                  <div className="absolute top-1 left-1 px-1 py-0.2 rounded bg-forest text-white text-[8.5px] font-mono font-bold tracking-tight shadow-xs">
                    Cover
                  </div>
                )}

                {/* Remove button on thumbnail hover */}
                {galleryList.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleRemovePhoto(url, e)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 hover:bg-danger text-white opacity-0 group-hover:opacity-100 transition shadow-xs cursor-pointer"
                    title="Remove from gallery"
                  >
                    <X size={10} />
                  </button>
                )}

                <div className="absolute bottom-0 inset-x-0 bg-ink/75 text-white text-[9px] px-1 py-0.5 truncate text-center font-mono">
                  #{idx + 1}
                </div>
              </div>
            )
          })}

          {/* Quick Add Card */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("upload")
              fileInputRef.current?.click()
            }}
            className="rounded-md border-2 border-dashed border-line hover:border-forest aspect-[4/3] flex flex-col items-center justify-center p-1 text-ink-soft hover:text-forest bg-paper/60 hover:bg-forest-soft/10 transition cursor-pointer"
            title="Upload more photos"
          >
            <Plus size={16} />
            <span className="text-[9.5px] font-medium mt-0.5">Add More</span>
          </button>
        </div>
      </div>

      {/* 4. Add Photos Tabs (Upload multiple, Presets, URL) */}
      <div className="pt-2 border-t border-line space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
            Add More Photos to Shelter
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-paper border border-line rounded text-[11.5px] font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded transition cursor-pointer ${
              activeTab === "upload"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <UploadCloud size={13} />
            <span>Device / Camera (Multiple)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded transition cursor-pointer ${
              activeTab === "presets"
                ? "bg-card text-forest shadow-xs font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <ImageIcon size={13} />
            <span>Sanctuary Presets ({GOSALA_PHOTO_PRESETS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded transition cursor-pointer ${
              activeTab === "url"
                ? "bg-card text-saffron-deep shadow-xs font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Link2 size={13} />
            <span>Image URL</span>
          </button>
        </div>

        {/* Tab 1: Upload Multiple Photos */}
        {activeTab === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-line-strong/60 hover:border-forest rounded-lg p-4 text-center bg-card/60 hover:bg-forest-soft/10 transition cursor-pointer"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files)
                }
              }}
            />
            <div className="w-9 h-9 rounded-full bg-forest-soft/40 text-forest mx-auto flex items-center justify-center mb-1.5">
              {isProcessing ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
            </div>
            <div className="text-[12px] font-semibold text-ink">
              {isProcessing ? "Adding photos to shelter..." : "Click or Drag Multiple Photos"}
            </div>
            <p className="text-[10.5px] text-ink-faint mt-0.5">
              Upload multiple photos from phone camera or storage (resting sheds, vet bay, grazing pastures)
            </p>
          </div>
        )}

        {/* Tab 2: Curated Vedic Presets */}
        {activeTab === "presets" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {GOSALA_PHOTO_PRESETS.map((p) => {
              const isInGallery = galleryList.includes(p.url)
              const isCover = p.url === currentPhoto

              return (
                <div
                  key={p.label}
                  className={`rounded-md overflow-hidden border text-left transition flex flex-col ${
                    isInGallery
                      ? "border-forest/50 bg-forest-soft/10"
                      : "border-line hover:border-line-strong bg-card"
                  }`}
                >
                  <div
                    onClick={() => {
                      if (isInGallery) {
                        setActivePreview(p.url)
                      } else {
                        handleAddPhotos([p.url])
                      }
                    }}
                    className="h-16 w-full overflow-hidden bg-paper relative cursor-pointer group"
                  >
                    <img
                      src={p.url}
                      alt={p.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {isInGallery && (
                      <div className="absolute top-1 right-1 p-0.5 rounded-full bg-forest text-white shadow-xs">
                        <Check size={10} />
                      </div>
                    )}
                    {isCover && (
                      <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-forest text-white text-[8px] font-mono">
                        Cover
                      </div>
                    )}
                  </div>

                  <div className="p-1.5 flex-1 flex flex-col justify-between">
                    <div className="text-[10.5px] font-semibold text-ink line-clamp-1">
                      {p.label}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      {isInGallery ? (
                        <button
                          type="button"
                          onClick={() => handleSetCover(p.url)}
                          className="text-[9.5px] text-forest font-medium hover:underline cursor-pointer"
                        >
                          {isCover ? "★ Cover" : "Make Cover"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddPhotos([p.url])}
                          className="w-full py-0.5 px-1.5 bg-forest text-white rounded text-[10px] font-medium hover:opacity-90 transition cursor-pointer text-center"
                        >
                          + Add to Shelter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab 3: External URL */}
        {activeTab === "url" && (
          <form onSubmit={handleUrlSubmit} className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/shelter-photo.jpg"
                className="flex-1 bg-card border border-line rounded px-3 py-1.5 text-[16px] sm:text-[12px] text-ink outline-none focus:border-forest"
              />
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="px-3 py-1.5 rounded bg-forest text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-40 transition cursor-pointer shrink-0"
              >
                + Add Photo
              </button>
            </div>
            <p className="text-[10px] text-ink-faint">
              Paste public image URL to append to this shelter's photo collection.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main Gaushalas Management Component
// ============================================================================

export default function Gaushalas({
  onNavigateToHerd,
}: {
  onNavigateToHerd?: (gosalaName?: string) => void
}) {
  const { gosalas, animals, addGosala, updateGosala, deleteGosala, vets, currentRole, profiles, authUser } =
    useStore()
  const { notify } = useToast()

  const activeAdminName = authUser?.name || profiles?.admin?.name || "Operations Admin"
  const activeSuperAdminName = authUser?.name || profiles?.super_admin?.name || "Koushik"

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [portfolioScope, setPortfolioScope] = useState<"my_portfolio" | "all_network">("my_portfolio")

  // Selected Gaushala for Professional Profile View
  const [selectedGosalaId, setSelectedGosalaId] = useState<string | null>(null)

  // Resolved Selected Gosala
  const selectedGosala = useMemo(() => {
    if (!selectedGosalaId) return null
    return (
      gosalas.find(
        (g) =>
          g.id === selectedGosalaId ||
          g.name.toLowerCase() === selectedGosalaId.toLowerCase(),
      ) || null
    )
  }, [gosalas, selectedGosalaId])

  // Multi-Tenant Isolation Scope:
  // - Operations Admin: Show ONLY Gaushalas under the active admin's regional administration!
  // - Super Admin: By default ("my_portfolio"), show ONLY Gaushalas directly under Super Admin!
  //   Super Admin can also switch to "all_network" for sovereign audit.
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

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGosala, setEditingGosala] = useState<Gosala | null>(null)

  // Quick Photo Edit Modal
  const [showQuickPhotoModal, setShowQuickPhotoModal] = useState(false)
  const [photoEditingGosala, setPhotoEditingGosala] = useState<Gosala | null>(null)
  const [quickPhotoValue, setQuickPhotoValue] = useState<string>(
    GOSALA_PHOTO_PRESETS[0].url,
  )
  const [quickPhotos, setQuickPhotos] = useState<string[]>([])

  // Form Fields
  const [formName, setFormName] = useState("")
  const [formRegNo, setFormRegNo] = useState("")
  const [formRegion, setFormRegion] = useState(GOSALA_REGION_PRESETS[0])
  const [customRegion, setCustomRegion] = useState("")
  const [isCustomRegionMode, setIsCustomRegionMode] = useState(false)
  const [formAddress, setFormAddress] = useState("")
  const [formLat, setFormLat] = useState<number | undefined>(undefined)
  const [formLng, setFormLng] = useState<number | undefined>(undefined)
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formCaretaker, setFormCaretaker] = useState("")
  const [formCapacity, setFormCapacity] = useState("40")
  const [formYear, setFormYear] = useState("2024")
  const [formStatus, setFormStatus] = useState<GosalaStatus>("Active")
  const [formPhoto, setFormPhoto] = useState<string>(GOSALA_PHOTO_PRESETS[0].url)
  const [formPhotos, setFormPhotos] = useState<string[]>([])
  const [formFacilities, setFormFacilities] = useState<string[]>([
    GOSALA_FACILITY_OPTIONS[0],
    GOSALA_FACILITY_OPTIONS[1],
    GOSALA_FACILITY_OPTIONS[2],
  ])
  const [formNotes, setFormNotes] = useState("")
  const [formPartnershipTier, setFormPartnershipTier] = useState<"PREFERRED" | "STANDARD" | "CHARITABLE">("STANDARD")
  const [formCommissionType, setFormCommissionType] = useState<"percentage" | "fixed">("percentage")
  const [formCommissionValue, setFormCommissionValue] = useState<number>(10)
  const [formTaxTreatment, setFormTaxTreatment] = useState<"standard_gst" | "section_80g_exempt" | "reduced_charity_gst">("standard_gst")
  const [formBufferMinutes, setFormBufferMinutes] = useState<number>(30)
  const [formPartnershipNotes, setFormPartnershipNotes] = useState("")
  const [formLandAcres, setFormLandAcres] = useState("5.5")
  const [formVisitingHours, setFormVisitingHours] = useState("6:00 AM – 7:30 PM (All 7 Days)")

  // Filtered Gaushalas
  const filteredGosalas = useMemo(() => {
    return scopedGosalas.filter((g) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.region.toLowerCase().includes(q) ||
        g.address.toLowerCase().includes(q) ||
        g.caretaker.toLowerCase().includes(q) ||
        g.trustRegistrationNo.toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === "ALL" || g.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [scopedGosalas, searchQuery, statusFilter])

  // Aggregate Metrics
  const totalGosalas = scopedGosalas.length
  const totalCapacity = scopedGosalas.reduce((acc, g) => acc + (g.capacity || 0), 0)
  const scopedHousedCows = animals.filter((a) =>
    scopedGosalas.some((g) => g.name.toLowerCase() === a.gosala.toLowerCase()),
  )
  const totalResidentCows = scopedHousedCows.length
  const utilizationPct =
    totalCapacity > 0 ? Math.round((totalResidentCows / totalCapacity) * 100) : 0

  const handleOpenAdd = () => {
    setEditingGosala(null)
    setFormName("")
    setFormRegNo(`MAH-PUN-AWBI-${Math.floor(1000 + Math.random() * 8999)}`)
    setFormRegion(GOSALA_REGION_PRESETS[0])
    setIsCustomRegionMode(false)
    setCustomRegion("")
    setFormAddress("")
    setFormLat(17.3753)
    setFormLng(78.3615)
    setFormPhone("+91 98230 44910")
    setFormEmail("trust@gomaa.in")
    setFormCaretaker("Rameshwar Shastri (Senior Gosevak)")
    setFormCapacity("45")
    setFormYear(String(new Date().getFullYear()))
    setFormStatus("Active")
    setFormPhoto(GOSALA_PHOTO_PRESETS[0].url)
    setFormPhotos([
      GOSALA_PHOTO_PRESETS[0].url,
      GOSALA_PHOTO_PRESETS[1].url,
      GOSALA_PHOTO_PRESETS[2].url,
    ])
    setFormFacilities([
      GOSALA_FACILITY_OPTIONS[0],
      GOSALA_FACILITY_OPTIONS[1],
      GOSALA_FACILITY_OPTIONS[2],
    ])
    setFormNotes("")
    setFormPartnershipTier("STANDARD")
    setFormCommissionType("percentage")
    setFormCommissionValue(10)
    setFormTaxTreatment("standard_gst")
    setFormBufferMinutes(30)
    setFormPartnershipNotes("")
    setFormLandAcres("5.5")
    setFormVisitingHours("6:00 AM – 7:30 PM (All 7 Days)")
    setShowAddModal(true)
  }

  const handleOpenEdit = (g: Gosala) => {
    setEditingGosala(g)
    setFormName(g.name)
    setFormRegNo(g.trustRegistrationNo)
    if (GOSALA_REGION_PRESETS.includes(g.region)) {
      setFormRegion(g.region)
      setIsCustomRegionMode(false)
    } else {
      setFormRegion("__CUSTOM__")
      setIsCustomRegionMode(true)
      setCustomRegion(g.region)
    }
    setFormAddress(g.address)
    setFormLat(g.lat || 18.5074)
    setFormLng(g.lng || 73.8077)
    setFormPhone(g.contactPhone)
    setFormEmail(g.email || "")
    setFormCaretaker(g.caretaker)
    setFormCapacity(String(g.capacity))
    setFormYear(g.establishedYear)
    setFormLandAcres(g.landAcres != null ? String(g.landAcres) : "5.5")
    setFormVisitingHours(g.visitingHours || "6:00 AM – 7:30 PM (All 7 Days)")
    setFormStatus(g.status)
    setFormPhoto(g.photo || GOSALA_PHOTO_PRESETS[0].url)
    setFormPhotos(
      g.photos && g.photos.length > 0
        ? g.photos
        : [g.photo || GOSALA_PHOTO_PRESETS[0].url],
    )
    setFormFacilities(g.facilities || [])
    setFormNotes(g.notes || "")
    setFormPartnershipTier((g.partnershipTier as any) || "STANDARD")
    setFormCommissionType((g.commissionType as any) || "percentage")
    setFormCommissionValue(g.customCommissionPct || (g.customCommissionFlat ? g.customCommissionFlat : 10))
    setFormTaxTreatment((g.taxTreatment as any) || "standard_gst")
    setFormBufferMinutes(g.bufferMinutes || 30)
    setFormPartnershipNotes(g.partnershipNotes || "")
    setShowAddModal(true)
  }

  const handleOpenQuickPhotoEdit = (g: Gosala) => {
    setPhotoEditingGosala(g)
    const initialPhotos =
      g.photos && g.photos.length > 0
        ? g.photos
        : [g.photo || GOSALA_PHOTO_PRESETS[0].url]
    setQuickPhotos(initialPhotos)
    setQuickPhotoValue(g.photo || initialPhotos[0])
    setShowQuickPhotoModal(true)
  }

  const handleSaveQuickPhoto = () => {
    if (photoEditingGosala) {
      const finalCover = quickPhotos.includes(quickPhotoValue)
        ? quickPhotoValue
        : quickPhotos[0] || quickPhotoValue
      updateGosala(photoEditingGosala.id, {
        photo: finalCover,
        photos: quickPhotos,
      })
      notify(
        `Saved ${quickPhotos.length} premise photographs for "${photoEditingGosala.name}"`,
        "ok",
      )
    }
    setShowQuickPhotoModal(false)
    setPhotoEditingGosala(null)
  }

  const handleToggleFacility = (fac: string) => {
    setFormFacilities((prev) =>
      prev.includes(fac) ? prev.filter((f) => f !== fac) : [...prev, fac],
    )
  }

  const handleSaveGosala = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      notify("Please provide a Gaushala name", "warn")
      return
    }

    const regionToSave = isCustomRegionMode
      ? customRegion.trim() || "Regional Hub"
      : formRegion

    if (editingGosala) {
      updateGosala(editingGosala.id, {
        name: formName.trim(),
        trustRegistrationNo: formRegNo.trim(),
        region: regionToSave,
        address: formAddress.trim(),
        lat: formLat,
        lng: formLng,
        contactPhone: formPhone.trim(),
        email: formEmail.trim(),
        caretaker: formCaretaker.trim(),
        capacity: Number(formCapacity) || 40,
        landAcres: parseFloat(formLandAcres) || 5.0,
        establishedYear: formYear.trim(),
        visitingHours: formVisitingHours.trim() || "6:00 AM – 7:30 PM (All 7 Days)",
        status: formStatus,
        photo: formPhoto,
        photos: formPhotos.length > 0 ? formPhotos : [formPhoto],
        facilities: formFacilities,
        notes: formNotes.trim(),
        partnershipTier: formPartnershipTier,
        commissionType: formCommissionType,
        customCommissionPct: formCommissionType === "percentage" ? formCommissionValue : undefined,
        customCommissionFlat: formCommissionType === "fixed" ? formCommissionValue : undefined,
        taxTreatment: formTaxTreatment,
        bufferMinutes: formBufferMinutes,
        partnershipNotes: formPartnershipNotes.trim(),
      })
    } else {
      addGosala({
        name: formName.trim(),
        trustRegistrationNo: formRegNo.trim(),
        region: regionToSave,
        address: formAddress.trim(),
        lat: formLat,
        lng: formLng,
        contactPhone: formPhone.trim(),
        email: formEmail.trim(),
        managerId: "",
        managerName: formCaretaker.trim() || "Dedicated Caretaker",
        caretaker: formCaretaker.trim(),
        governingAdminRole: currentRole === "super_admin" ? "super_admin" : "admin",
        governingAdminName: currentRole === "super_admin" ? activeSuperAdminName : activeAdminName,
        adminId: currentRole === "super_admin" ? (authUser?.userId || "USER-SA-001") : (authUser?.userId || "USER-ADM-101"),
        adminName: currentRole === "super_admin" ? activeSuperAdminName : activeAdminName,
        capacity: Number(formCapacity) || 40,
        landAcres: parseFloat(formLandAcres) || 5.0,
        establishedYear: formYear.trim(),
        visitingHours: formVisitingHours.trim() || "6:00 AM – 7:30 PM (All 7 Days)",
        status: formStatus,
        photo: formPhoto,
        photos: formPhotos.length > 0 ? formPhotos : [formPhoto],
        facilities: formFacilities,
        notes: formNotes.trim(),
        partnershipTier: formPartnershipTier,
        commissionType: formCommissionType,
        customCommissionPct: formCommissionType === "percentage" ? formCommissionValue : undefined,
        customCommissionFlat: formCommissionType === "fixed" ? formCommissionValue : undefined,
        taxTreatment: formTaxTreatment,
        bufferMinutes: formBufferMinutes,
        partnershipNotes: formPartnershipNotes.trim(),
      })
    }

    setShowAddModal(false)
    setEditingGosala(null)
  }

  const handleDeleteGosalaPrompt = (g: Gosala) => {
    const assignedCows = animals.filter(
      (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
    )
    if (assignedCows.length > 0) {
      notify(
        `Cannot remove ${g.name}: ${assignedCows.length} cows are currently housed here. Please reassign the herd first.`,
        "warn",
      )
      return
    }

    if (
      window.confirm(
        `Are you sure you want to remove "${g.name}" from your Gaushala management network?`,
      )
    ) {
      deleteGosala(g.id)
    }
  }

  return (
    <div className="space-y-6">
      {selectedGosala ? (
        <GaushalaProfileView
          gosala={selectedGosala}
          onBack={() => setSelectedGosalaId(null)}
          onEdit={handleOpenEdit}
          onUpdatePhotos={handleOpenQuickPhotoEdit}
          onRegisterCow={(gosalaName) => {
            if (onNavigateToHerd) {
              onNavigateToHerd(gosalaName)
            }
          }}
          onViewAnimalWelfare={(animalName) => {
            if (onNavigateToHerd) {
              onNavigateToHerd(selectedGosala.name)
            }
          }}
        />
      ) : (
        <>
          {/* 1. Top KPI Summary Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Panel className="p-3 sm:p-4">
          <div className="font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] text-ink-faint truncate">
            Managed Gaushalas
          </div>
          <div className="font-serif text-[22px] sm:text-[26px] text-ink mt-0.5 sm:mt-1 font-semibold tabular">
            {totalGosalas} Facilities
          </div>
          <div className="text-[11px] sm:text-[11.5px] text-forest mt-0.5 truncate flex items-center gap-1 font-medium">
            <CheckCircle2 size={12} /> 100% Operational
          </div>
        </Panel>

        <Panel className="p-3 sm:p-4">
          <div className="font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] text-ink-faint truncate">
            Total Bovine Capacity
          </div>
          <div className="font-serif text-[22px] sm:text-[26px] text-ink mt-0.5 sm:mt-1 font-semibold tabular">
            {totalCapacity} Cows
          </div>
          <div className="text-[11px] sm:text-[11.5px] text-ink-faint mt-0.5 truncate">
            Approved pasture &amp; shed space
          </div>
        </Panel>

        <Panel className="p-3 sm:p-4">
          <div className="font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] text-ink-faint truncate">
            Current Herd Housed
          </div>
          <div className="font-serif text-[22px] sm:text-[26px] text-forest mt-0.5 sm:mt-1 font-semibold tabular">
            {totalResidentCows} Sacred Cattle
          </div>
          <div className="text-[11px] sm:text-[11.5px] text-forest mt-0.5 truncate font-medium">
            {utilizationPct}% Overall occupancy
          </div>
        </Panel>

        <Panel className="p-3 sm:p-4">
          <div className="font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] text-ink-faint truncate">
            AWBI Verification
          </div>
          <div className="font-serif text-[22px] sm:text-[26px] text-ink mt-0.5 sm:mt-1 font-semibold flex items-center gap-2">
            <span>Verified</span>
            <ShieldCheck size={20} className="text-forest" />
          </div>
          <div className="text-[11px] sm:text-[11.5px] text-forest mt-0.5 truncate">
            Animal Welfare Board of India
          </div>
        </Panel>
      </div>

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
                  ? "Inspecting your sovereign Gaushalas portfolio (Isolated from other admins)"
                  : "Super Admin Captain audit mode: All platform shelters across all regional admins"
                : `Managing ${scopedGosalas.length} operational shelter(s) assigned under ${activeAdminName}`}
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
                My Gaushalas (
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
              <Globe size={12} />
              <span>All Network ({gosalas.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Controls & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-line rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search gaushalas by name, region, caretaker, or reg no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[16px] sm:text-[12.5px] rounded border border-line bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:border-forest transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter Pills */}
          <div className="inline-flex items-center border border-line rounded bg-paper p-0.5 text-[11.5px] font-medium">
            {["ALL", "Active", "Maintenance"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-card text-ink shadow-xs font-semibold"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {st === "ALL" ? `All (${gosalas.length})` : st}
              </button>
            ))}
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-1.5 bg-forest text-white rounded px-3.5 py-2 text-[12.5px] font-medium hover:bg-forest-deep transition shadow-xs cursor-pointer min-h-[40px] sm:min-h-0"
          >
            <Plus size={15} />
            <span className="whitespace-nowrap">Register New Gaushala</span>
          </button>
        </div>
      </div>

      {/* 3. Gaushalas Grid Display */}
      {filteredGosalas.length === 0 ? (
        <Panel className="p-8 sm:p-12 text-center bg-card">
          <div className="w-14 h-14 rounded-full bg-forest-soft/30 text-forest mx-auto flex items-center justify-center mb-3">
            <Building2 size={26} />
          </div>
          <h3 className="font-serif text-[18px] text-ink font-semibold">
            No Gaushala Shelters Found
          </h3>
          <p className="text-[12.5px] text-ink-faint mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No shelters match "${searchQuery}". Try clearing search filters.`
              : "No facilities registered under this category yet."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-3.5 py-1.5 rounded border border-line bg-paper text-ink text-[12px] hover:bg-paper-deep transition"
              >
                Clear Search
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 bg-forest text-white px-3.5 py-1.5 rounded text-[12px] font-medium hover:bg-forest-deep transition"
            >
              <Plus size={14} />
              <span>Register First Gaushala</span>
            </button>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredGosalas.map((g) => {
            const housedCows = animals.filter(
              (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
            )
            const occupancyPct = Math.min(
              100,
              Math.round((housedCows.length / (g.capacity || 1)) * 100),
            )
            const assignedVets = vets.filter(
              (v) =>
                v.assignedGosalas.includes("All Gaushalas") ||
                v.assignedGosalas.some(
                  (sg) => sg.toLowerCase() === g.name.toLowerCase(),
                ),
            )

            return (
              <div
                key={g.id}
                className="bg-card border border-line rounded-lg shadow-xs hover:border-line-strong transition flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* 1. Premise Photo Banner with Overlay */}
                  <div className="relative h-44 sm:h-48 w-full bg-paper-deep overflow-hidden">
                    <img
                      src={g.photo || GOSALA_PHOTO_PRESETS[0].url}
                      alt={g.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                    {/* Top Badges on Photo */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full backdrop-blur-md text-white shadow-xs ${
                          g.status === "Active"
                            ? "bg-forest/85 border border-forest-light/40"
                            : "bg-amber-600/85 border border-amber-300/40"
                        }`}
                      >
                        {g.status}
                      </span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20">
                        AWBI: {g.trustRegistrationNo}
                      </span>
                    </div>

                    {/* Quick Photo Edit Camera Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenQuickPhotoEdit(g)}
                      className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/65 hover:bg-black/85 backdrop-blur-md text-white text-[11px] font-medium transition cursor-pointer border border-white/25 hover:border-white/50 shadow-sm"
                      title={`Change photograph for ${g.name}`}
                    >
                      <Camera size={12} className="text-saffron-light" />
                      <span className="hidden sm:inline">Change Photo</span>
                    </button>

                    {/* Bottom Info on Photo Banner */}
                    <div
                      onClick={() => setSelectedGosalaId(g.id)}
                      className="absolute bottom-2.5 inset-x-3 flex items-end justify-between gap-2 text-white cursor-pointer hover:opacity-95"
                      title={`Open profile for ${g.name}`}
                    >
                      <div className="min-w-0">
                        <h3 className="font-serif text-[17px] font-semibold drop-shadow leading-snug truncate hover:underline">
                          {g.name}
                        </h3>
                        <p className="text-[11.5px] text-white/85 drop-shadow-xs flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-saffron-light shrink-0" />
                          <span className="truncate">{g.region}</span>
                          <span>·</span>
                          <span className="shrink-0">Est. {g.establishedYear}</span>
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span className="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded bg-white/20 backdrop-blur-md text-white border border-white/25">
                          Cap: {g.capacity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Subheader Action Bar */}
                  <div className="p-2.5 px-4 border-b border-line bg-paper/30 flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-2 text-ink-faint">
                      <span>
                        Manager: <strong className="text-ink">{g.managerName}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenQuickPhotoEdit(g)}
                        className="p-1.5 text-ink-soft hover:text-forest hover:bg-paper rounded transition-colors"
                        title="Update Shelter Photo"
                      >
                        <Camera size={13} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(g)}
                        className="p-1.5 text-ink-soft hover:text-ink hover:bg-paper rounded transition-colors"
                        title="Edit Gaushala details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteGosalaPrompt(g)}
                        className="p-1.5 text-ink-soft hover:text-danger hover:bg-paper rounded transition-colors"
                        title="Remove Gaushala"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* 3. Body Info */}
                  <div className="p-4 space-y-3.5 text-[12px]">
                    {/* Capacity Utilization Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-medium text-ink-soft">
                          Bovine Capacity Utilization
                        </span>
                        <span className="font-mono font-semibold text-ink">
                          {housedCows.length} / {g.capacity} Cattle ({occupancyPct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-paper border border-line overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            occupancyPct > 90
                              ? "bg-danger"
                              : occupancyPct > 70
                                ? "bg-amber-500"
                                : "bg-forest"
                          }`}
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Address & Contact Details */}
                    <div className="space-y-1.5 text-ink-soft">
                      <div className="flex items-start gap-2">
                        <MapPin size={13} className="text-ink-faint shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed text-[11.5px]">
                          {g.address}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-ink-faint shrink-0" />
                          <a
                            href={`tel:${g.contactPhone}`}
                            className="text-forest hover:underline font-mono text-[11px]"
                          >
                            {g.contactPhone}
                          </a>
                        </div>
                        {g.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-ink-faint shrink-0" />
                            <a
                              href={`mailto:${g.email}`}
                              className="text-ink-soft hover:underline text-[11px] truncate max-w-[140px]"
                            >
                              {g.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lead Gosevak / Caretaker */}
                    <div className="p-2.5 rounded bg-paper-deep/60 border border-line flex items-center justify-between gap-2">
                      <div className="text-[11px]">
                        <span className="text-ink-faint block">Caretaker in-charge</span>
                        <span className="font-medium text-ink">{g.caretaker}</span>
                      </div>
                      <span className="text-[10px] font-mono bg-paper px-2 py-0.5 rounded border border-line text-ink-faint">
                        On-Site
                      </span>
                    </div>

                    {/* Facilities / Amenities Tags */}
                    <div>
                      <span className="text-[11px] font-medium text-ink-faint mb-1.5 block">
                        Verified Bovine Amenities ({g.facilities?.length || 0})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {g.facilities?.slice(0, 4).map((fac) => (
                          <span
                            key={fac}
                            className="text-[10.5px] px-2 py-0.5 rounded bg-paper border border-line text-ink-soft"
                          >
                            {fac}
                          </span>
                        ))}
                        {(g.facilities?.length || 0) > 4 && (
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-paper-deep text-ink-faint font-mono">
                            +{(g.facilities?.length || 0) - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resident Cattle Avatars */}
                    <div className="pt-2 border-t border-line">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium text-ink-faint flex items-center gap-1">
                          <PawPrint size={12} className="text-forest" />
                          Resident Cattle ({housedCows.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedGosalaId(g.id)}
                          className="text-[11px] text-forest hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Shed Profile</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                      {housedCows.length === 0 ? (
                        <p className="text-[11px] text-ink-faint italic">
                          No cows currently registered at this shed.
                        </p>
                      ) : (
                        <div
                          onClick={() => setSelectedGosalaId(g.id)}
                          className="flex items-center gap-1.5 flex-wrap cursor-pointer group-hover:opacity-95"
                          title="Click to view resident cattle herd"
                        >
                          {housedCows.slice(0, 6).map((c) => (
                            <img
                              key={c.name}
                              src={c.photo}
                              alt={c.name}
                              title={`${c.name} (${c.breed || c.type})`}
                              className="w-7 h-7 rounded-full object-cover border border-line shadow-xs"
                            />
                          ))}
                          {housedCows.length > 6 && (
                            <span className="text-[10.5px] font-mono text-ink-faint">
                              +{housedCows.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 border-t border-line bg-paper/30 flex items-center justify-between text-[11.5px]">
                  <span className="text-ink-faint text-[10.5px]">
                    {assignedVets.length > 0
                      ? `${assignedVets[0].name} (Vet)`
                      : "Regular Doctor On-Call"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenQuickPhotoEdit(g)}
                      className="text-ink-soft hover:text-forest text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-paper-deep transition"
                    >
                      <Camera size={12} />
                      <span>Photos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGosalaId(g.id)}
                      className="px-2.5 py-1 rounded bg-forest text-white hover:bg-forest-deep text-[11.5px] font-medium inline-flex items-center gap-1 cursor-pointer shadow-xs transition"
                    >
                      <Building2 size={12} />
                      <span>Manage Shed &amp; Profile</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )}

      {/* 4. Dedicated Quick Photo Edit Modal */}
      {showQuickPhotoModal && photoEditingGosala && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Handle */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-card sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-forest-soft text-forest">
                  <Camera size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-[17px] text-ink font-bold">
                    Update Shelter Photos ({quickPhotos.length})
                  </h3>
                  <p className="text-[11.5px] text-ink-faint">
                    {photoEditingGosala.name} ({photoEditingGosala.region})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowQuickPhotoModal(false)
                  setPhotoEditingGosala(null)
                }}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <GosalaPhotoUploader
                currentPhoto={quickPhotoValue}
                photos={quickPhotos}
                onPhotoChange={setQuickPhotoValue}
                onPhotosChange={setQuickPhotos}
                label="Gaushala Premise Photographs"
                helperText="Upload multiple photos (resting sheds, vet hospital, green pastures, Vedic courtyard) shown to devotees when booking"
              />

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickPhotoModal(false)
                    setPhotoEditingGosala(null)
                  }}
                  className="px-4 py-2 text-[12px] font-medium bg-paper border border-line rounded text-ink hover:bg-paper-deep transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickPhoto}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:opacity-95 shadow-xs cursor-pointer"
                >
                  <Check size={14} />
                  <span>Save {quickPhotos.length} Shelter Photos</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Comprehensive Full-Screen Gaushala Onboarding & Dossier Portal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-paper text-ink overflow-y-auto flex flex-col animate-fade-in">
          {/* Top Sticky Enterprise Command Header */}
          <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-line px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-md bg-forest-soft text-forest flex items-center justify-center shrink-0 border border-forest/20 shadow-2xs">
                <Building2 size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-forest font-semibold">
                    GOMAA Sacred Sanctuary Infrastructure
                  </span>
                  <span className="text-ink-faint text-[11px]">•</span>
                  <span className="font-mono text-[10.5px] text-ink-faint">
                    AWBI Section 38 Verification Ready
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-ok-soft text-ok border border-ok/30 font-medium">
                    <ShieldCheck size={11} /> Active GOMAA Trust Protocol
                  </span>
                </div>
                <h1 className="font-serif text-[19px] sm:text-[22px] text-ink font-bold truncate tracking-tight">
                  {editingGosala
                    ? `Sanctuary Master Dossier: ${editingGosala.name}`
                    : "Register New Sacred Gaushala Premise"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setEditingGosala(null)
                }}
                className="px-3.5 py-1.5 rounded-md border border-line text-[12.5px] font-medium text-ink-soft hover:text-ink hover:bg-paper transition cursor-pointer"
              >
                Cancel / Exit
              </button>
              <button
                type="button"
                onClick={handleSaveGosala}
                className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-md bg-forest hover:bg-forest-deep text-white text-[13px] font-semibold transition shadow-xs cursor-pointer"
              >
                <Check size={15} />
                <span>
                  {editingGosala ? "Save Gaushala Changes" : "Confirm & Register Gaushala"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setEditingGosala(null)
                }}
                className="h-9 w-9 rounded-md text-ink-faint hover:text-ink hover:bg-paper grid place-items-center transition cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Full Screen Form Body */}
          <form onSubmit={handleSaveGosala} className="flex-1 flex flex-col">
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
              {/* Executive Notice Banner */}
              <div className="p-4 rounded-lg bg-forest-soft/30 border border-forest/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-ink">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-forest text-white grid place-items-center shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-ink flex items-center gap-2">
                      <span>Government &amp; AWBI Certified Cow Shelter Onboarding</span>
                      <span className="font-mono text-[10.5px] px-2 py-0.2 rounded bg-forest/20 text-forest font-semibold">
                        ISO / AWBI Standard
                      </span>
                    </div>
                    <div className="text-[12px] text-ink-soft mt-0.5">
                      Ensure accurate physical coordinates, valid registration certificates, and lead caretaker details for doorstep van transit authorization.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] text-ink-faint">
                    Capacity: <strong>{formCapacity} Bovines</strong>
                  </span>
                  <span className="text-ink-faint">•</span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    Status: <strong className="text-forest">{formStatus}</strong>
                  </span>
                </div>
              </div>

              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (7 cols): Identity, Photography & Facilities */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Card 1: Sanctuary Legal Identity & Trust Accreditation */}
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-forest" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          1. Sanctuary Legal Identity &amp; Trust Accreditation
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                        Step 1 of 6
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Official Gaushala / Trust Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="e.g. Govardhan Goseva Trust &amp; Research Sanctuary"
                          className="w-full bg-paper border border-line rounded-md px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          AWBI / Govt. Trust Reg. No. *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={formRegNo}
                            onChange={(e) => setFormRegNo(e.target.value)}
                            placeholder="e.g. MAH-PUN-AWBI-4722"
                            className="w-full bg-paper border border-line rounded-md pl-3 pr-8 py-2.5 text-[13px] text-ink font-mono outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition"
                          />
                          <ShieldCheck size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-forest pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Operational Hub &amp; State *
                        </label>
                        <select
                          value={isCustomRegionMode ? "__CUSTOM__" : formRegion}
                          onChange={(e) => {
                            if (e.target.value === "__CUSTOM__") {
                              setIsCustomRegionMode(true)
                              setCustomRegion("")
                            } else {
                              setIsCustomRegionMode(false)
                              setFormRegion(e.target.value)
                            }
                          }}
                          className="w-full bg-paper border border-line rounded-md px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition cursor-pointer"
                        >
                          {getAllIndianStates().map((st) => (
                            <optgroup key={st} label={st}>
                              {getHubsForState(st).map((h) => (
                                <option key={h.id} value={`${h.state} - ${h.name}`}>
                                  {h.city} — {h.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <optgroup label="Custom / New Operational Hub">
                            <option
                              value="__CUSTOM__"
                              className="font-semibold text-forest"
                            >
                              + Customize / Add New Hub...
                            </option>
                          </optgroup>
                        </select>

                        {isCustomRegionMode && (
                          <div className="mt-2 flex items-center gap-1.5 animate-fade-in">
                            <input
                              type="text"
                              autoFocus
                              value={customRegion}
                              onChange={(e) => setCustomRegion(e.target.value)}
                              placeholder="Enter custom region / district name..."
                              className="w-full bg-paper border border-forest/60 focus:border-forest rounded-md px-3 py-2 text-[12.5px] text-ink outline-none shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomRegionMode(false)
                                setFormRegion(GOSALA_REGION_PRESETS[0])
                              }}
                              className="text-[11px] text-ink-faint hover:text-ink px-3 py-2 border border-line rounded-md bg-paper-deep shrink-0 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Full Physical Sanctuary Premises Address &amp; Pincode *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={formAddress}
                          onChange={(e) => setFormAddress(e.target.value)}
                          placeholder="Survey number, main road, landmark, village/suburb, district, state &amp; 6-digit postal pincode"
                          className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[13px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition resize-none leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Trust Helpline Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder="+91 98230 44910"
                          className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[13px] text-ink font-mono outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Official Trust Email
                        </label>
                        <input
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder="trust@gomaa.in"
                          className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[13px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Premise Inspection Photography & Media Vault */}
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <Camera size={16} className="text-forest" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          2. Premise Photography &amp; Visual Verification
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                        High-Resolution Multi-Angle Visuals
                      </span>
                    </div>

                    <GosalaPhotoUploader
                      currentPhoto={formPhoto}
                      photos={formPhotos}
                      onPhotoChange={setFormPhoto}
                      onPhotosChange={setFormPhotos}
                      label="Gaushala Premise &amp; Sacred Shed Photographs *"
                      helperText="Prominently displayed on devotee booking screens, driver waybills, and official transit permits"
                    />
                  </div>

                  {/* Card 3: Bovine Facilities & Welfare Infrastructure */}
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <Award size={16} className="text-forest" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          3. Certified Bovine Facilities &amp; Welfare Infrastructure
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                        {formFacilities.length} of {GOSALA_FACILITY_OPTIONS.length} Selected
                      </span>
                    </div>

                    <p className="text-[12px] text-ink-soft">
                      Select all verified amenities available on the sanctuary grounds. These are displayed as trust badges to devotees.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {GOSALA_FACILITY_OPTIONS.map((fac) => {
                        const checked = formFacilities.includes(fac)
                        return (
                          <label
                            key={fac}
                            className={`flex items-start gap-2.5 p-3 rounded-md border transition cursor-pointer ${
                              checked
                                ? "bg-forest-soft/40 border-forest/40 text-ink font-medium shadow-2xs"
                                : "bg-paper border-line hover:border-line-strong text-ink-soft"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleFacility(fac)}
                              className="accent-forest shrink-0 mt-0.5"
                            />
                            <span className="text-[12px] leading-snug">{fac}</span>
                          </label>
                        )
                      })}
                    </div>

                    <div>
                      <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                        Special Welfare, Medical, &amp; Sanctuary Protocol Notes
                      </label>
                      <textarea
                        rows={3}
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="e.g. 24/7 borehole solar pump installed. In-house organic hydro-fodder chamber running daily at 5:30 AM."
                        className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Capacity, Geodesics & Platform Economics */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Card 4: Herd Scale & Staffing Matrix */}
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <PawPrint size={16} className="text-forest" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          4. Herd Scale &amp; Staffing Matrix
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                        Operational Capacity
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider">
                                  Herd Capacity *
                                </label>
                                <span className="font-mono text-[11px] font-bold text-forest">
                                  {formCapacity} Cattle
                                </span>
                              </div>
                              <input
                                type="number"
                                min="5"
                                max="1000"
                                required
                                value={formCapacity}
                                onChange={(e) => setFormCapacity(e.target.value)}
                                className="w-full bg-paper border border-line rounded-md px-3.5 py-2 text-[13px] text-ink font-semibold outline-none focus:border-forest transition"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider">
                                  Sanctuary Land Area *
                                </label>
                                <span className="font-mono text-[11px] font-bold text-forest">
                                  {formLandAcres} Acres
                                </span>
                              </div>
                              <input
                                type="number"
                                step="0.1"
                                min="0.5"
                                max="500"
                                required
                                value={formLandAcres}
                                onChange={(e) => setFormLandAcres(e.target.value)}
                                placeholder="e.g. 5.5"
                                className="w-full bg-paper border border-line rounded-md px-3.5 py-2 text-[13px] text-ink font-semibold outline-none focus:border-forest transition"
                              />
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                              Visiting & Darshan Hours (Shown to Devotees) *
                            </label>
                            <input
                              type="text"
                              required
                              value={formVisitingHours}
                              onChange={(e) => setFormVisitingHours(e.target.value)}
                              placeholder="e.g. 6:00 AM – 7:30 PM (All 7 Days)"
                              className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition"
                            />
                            <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto text-[10.5px]">
                              <span className="text-ink-faint shrink-0">Quick presets:</span>
                              {[
                                "6:00 AM – 7:30 PM (All 7 Days)",
                                "7:00 AM – 8:00 PM (Daily)",
                                "Dawn to Dusk (Vedic Darshan)",
                              ].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setFormVisitingHours(preset)}
                                  className="px-2 py-0.5 rounded border border-line bg-paper hover:bg-forest-soft/40 hover:text-forest text-ink-soft shrink-0 transition"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                              Lead Gosevak / Chief Caretaker *
                            </label>
                            <input
                              type="text"
                              required
                              value={formCaretaker}
                              onChange={(e) => setFormCaretaker(e.target.value)}
                              placeholder="e.g. Rameshwar Shastri"
                              className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition"
                            />
                          </div>

                          <div>
                            <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                              Established Year
                            </label>
                            <input
                              type="text"
                              value={formYear}
                              onChange={(e) => setFormYear(e.target.value)}
                              placeholder="e.g. 2018"
                              className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[13px] text-ink font-mono outline-none focus:border-forest transition"
                            />
                          </div>
                        </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1.5">
                          Operational Status
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["Active", "Maintenance", "Under Audit"] as GosalaStatus[]).map((st) => (
                            <label
                              key={st}
                              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md border text-[11.5px] font-medium transition cursor-pointer text-center ${
                                formStatus === st
                                  ? st === "Active"
                                    ? "bg-ok-soft text-ok border-ok/40 font-semibold shadow-2xs"
                                    : st === "Maintenance"
                                      ? "bg-warn-soft text-warn border-warn/40 font-semibold shadow-2xs"
                                      : "bg-danger-soft text-danger border-danger/40 font-semibold shadow-2xs"
                                  : "bg-paper border-line text-ink-soft hover:bg-paper-deep"
                              }`}
                            >
                              <input
                                type="radio"
                                name="gosala_status"
                                value={st}
                                checked={formStatus === st}
                                onChange={() => setFormStatus(st)}
                                className="sr-only"
                              />
                              <span>{st}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Geodesic Coordinates & Doorstep Serviceability */}
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-forest" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          5. Geodesics &amp; Doorstep Radius
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                        GPS Geofencing
                      </span>
                    </div>

                    <MapLocationPicker
                      key={editingGosala?.id || "new"}
                      initialLat={formLat}
                      initialLng={formLng}
                      initialAddress={formAddress}
                      initialRegion={formRegion}
                      onChange={({ lat, lng, address, suggestedRegion }) => {
                        setFormLat(lat)
                        setFormLng(lng)
                        if (address) {
                          setFormAddress(address)
                        }
                        if (suggestedRegion && !isCustomRegionMode) {
                          setFormRegion(suggestedRegion)
                        }
                      }}
                      label="Gaushala Location Pinpoint & Coordinates *"
                      helperText="Pinpoint the exact shelter location on the map, search any landmark/town, or jump to any Indian region."
                    />

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                          Latitude (Lat)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formLat || ""}
                          onChange={(e) => setFormLat(parseFloat(e.target.value) || undefined)}
                          className="w-full bg-paper border border-line rounded px-3 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-forest"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                          Longitude (Lng)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formLng || ""}
                          onChange={(e) => setFormLng(parseFloat(e.target.value) || undefined)}
                          className="w-full bg-paper border border-line rounded px-3 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-forest"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-paper border border-line text-[11px] text-ink-soft leading-relaxed flex items-start gap-2">
                      <Clock size={13} className="text-forest shrink-0 mt-0.5" />
                      <span>
                        <strong>Doorstep Service Radius:</strong> Devotees within <strong>35 km</strong> qualify for direct van delivery. Transit beyond 35 km automatically enters extended transit buffer mode.
                      </span>
                    </div>
                  </div>

                  {/* Card 6: Custom Gaushala Economics, Commission & Buffer */}
                  <div className="bg-card border border-line rounded-lg p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <Landmark size={16} className="text-forest" />
                        <h2 className="font-serif text-[16px] text-ink font-bold">
                          6. Custom Economics &amp; Welfare Buffer
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] text-forest uppercase tracking-wider font-semibold">
                        Dynamic Commission
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Partnership Tier
                        </label>
                        <select
                          value={formPartnershipTier}
                          onChange={(e) => setFormPartnershipTier(e.target.value as any)}
                          className="w-full bg-paper border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest cursor-pointer"
                        >
                          <option value="PREFERRED">Preferred Trust Partner (Close Sanctuary, Low 8-10% Commission)</option>
                          <option value="STANDARD">Standard Platform Gaushala (Standard 12-15% Commission)</option>
                          <option value="CHARITABLE">100% Non-Profit Trust (0% Platform Margin / 80G Exempt)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Commission Model
                          </label>
                          <select
                            value={formCommissionType}
                            onChange={(e) => setFormCommissionType(e.target.value as any)}
                            className="w-full bg-paper border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest cursor-pointer"
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Rate (₹)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            {formCommissionType === "percentage" ? "Commission %" : "Fixed Amount (₹)"}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={formCommissionType === "percentage" ? 50 : 5000}
                            value={formCommissionValue}
                            onChange={(e) => setFormCommissionValue(parseFloat(e.target.value) || 0)}
                            className="w-full bg-paper border border-line rounded px-3 py-2 text-[13px] text-ink font-mono outline-none focus:border-forest"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Tax Exemption Treatment
                          </label>
                          <select
                            value={formTaxTreatment}
                            onChange={(e) => setFormTaxTreatment(e.target.value as any)}
                            className="w-full bg-paper border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest cursor-pointer"
                          >
                            <option value="standard_gst">Standard GST (12%)</option>
                            <option value="section_80g_exempt">Section 80G Tax Exempt (0%)</option>
                            <option value="reduced_charity_gst">Concessional Charity GST (5%)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                            Resting Buffer (Mins)
                          </label>
                          <input
                            type="number"
                            min="15"
                            max="120"
                            step="5"
                            value={formBufferMinutes}
                            onChange={(e) => setFormBufferMinutes(parseInt(e.target.value) || 30)}
                            className="w-full bg-paper border border-line rounded px-3 py-2 text-[13px] text-ink font-mono outline-none focus:border-forest"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                          Partnership Rationale &amp; Notes
                        </label>
                        <input
                          type="text"
                          value={formPartnershipNotes}
                          onChange={(e) => setFormPartnershipNotes(e.target.value)}
                          placeholder="e.g. Close Partner Gaushala - 8% preferential commission agreed"
                          className="w-full bg-paper border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest"
                        />
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
                  {formName.trim() || "New Gaushala Premise"}
                </span>
                <span>•</span>
                <span className="font-mono text-ink-faint">
                  {isCustomRegionMode ? customRegion : formRegion}
                </span>
                <span>•</span>
                <span className="font-mono text-forest font-medium">
                  Capacity: {formCapacity} Cattle
                </span>
                <span>•</span>
                <span className="font-mono text-ink-faint">
                  Tier: {formPartnershipTier} ({formCommissionValue}{formCommissionType === "percentage" ? "%" : "₹"})
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingGosala(null)
                  }}
                  className="px-4 py-2 text-[12.5px] font-medium text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper transition cursor-pointer"
                >
                  Cancel &amp; Discard
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-6 py-2 text-[13px] font-bold rounded-md bg-forest hover:bg-forest-deep text-white shadow-xs transition cursor-pointer"
                >
                  <Check size={16} />
                  <span>{editingGosala ? "Save Gaushala Changes" : "Confirm & Register Gaushala Premise"}</span>
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </div>
  )
}
