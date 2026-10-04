import { useState, useMemo, useEffect, useRef } from "react"
import {
  Plus,
  X,
  Check,
  CheckCircle2,
  HeartPulse,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Flame,
  ChevronRight,
  UserCheck,
  Phone,
  Stethoscope,
  FileText,
  Sparkles,
  Calendar as CalendarIcon,
  MapPin,
  Activity,
  Droplets,
  Award,
  Layers,
  Search,
  Edit2,
  Save,
  Trash2,
  Building2,
  ExternalLink,
  BadgeCheck,
  Camera,
  UploadCloud,
  Upload,
  Image as ImageIcon,
  Link2,
  RefreshCw,
} from "lucide-react"
import {
  type Animal,
  type AnimalType,
  type AnimalOperationalStatus,
  type AnimalVetInfo,
  type AnimalDietInfo,
  type AnimalCustomDetail,
  type EmpanelledVet,
  CATTLE_BREEDS,
  AGE_PRESETS,
  CEREMONIAL_CATEGORIES,
  GOSEVAK_HANDLERS,
  DIET_PRESETS,
  LACTATION_STATUSES,
  TEMPERAMENT_PRESETS,
} from "../../data/animals"
import { inr, type Booking } from "../../data/mock"
import { useStore, useToast } from "../../store/store"
import { Panel, Tag, Eyebrow, StatusPill } from "../../lib/ui"

export const SACRED_MARKS_PRESETS = [
  "Shrivatsa curl on forehead (Auspicious Mahalakshmi mark)",
  "White crescent tilak mark on forehead",
  "Panchagavya golden sheen coat with white switch tail",
  "Gentle Surya chakra whirl behind right ear",
  "Natural sandalwood tilak blaze on muzzle",
  "Pure unblemished Kapila brown coat",
  "Auspicious white star mark on forehead",
]

export const GOSALA_PRESETS = [
  "Shri Krishna Gaushala",
  "Nandini Goseva Sadan",
  "Gopal Gaushala Trust",
]

interface CustomizableSelectProps {
  label: string
  value: string
  onChange: (val: string) => void
  options: readonly string[] | string[]
  customPlaceholder?: string
  actionLabel?: string
  className?: string
  selectClassName?: string
}

function CustomizableSelect({
  label,
  value,
  onChange,
  options,
  customPlaceholder = "Enter custom value...",
  actionLabel = "+ Customize / Other...",
  className = "",
  selectClassName = "text-[13px]",
}: CustomizableSelectProps) {
  const isCustomValue = !options.includes(value) && value !== ""
  const [isCustomMode, setIsCustomMode] = useState(isCustomValue)
  const [customInputText, setCustomInputText] = useState(isCustomValue ? value : "")

  useEffect(() => {
    if (options.includes(value)) {
      setIsCustomMode(false)
    } else if (value) {
      setIsCustomMode(true)
      setCustomInputText(value)
    }
  }, [value, options])

  return (
    <div className={className}>
      <label className="block text-[12px] font-medium text-ink mb-1">
        {label}
      </label>
      <select
        value={isCustomMode ? "__CUSTOM__" : value}
        onChange={(e) => {
          if (e.target.value === "__CUSTOM__") {
            setIsCustomMode(true)
            if (options.includes(value)) {
              setCustomInputText("")
              onChange("")
            }
          } else {
            setIsCustomMode(false)
            onChange(e.target.value)
          }
        }}
        className={`w-full bg-card border border-line rounded px-3 py-2 text-[16px] sm:text-[13px] text-ink outline-none focus:border-forest transition cursor-pointer ${selectClassName}`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option disabled>──────────</option>
        <option value="__CUSTOM__" className="font-semibold text-forest">
          {actionLabel}
        </option>
      </select>

      {isCustomMode && (
        <div className="mt-1.5 flex items-center gap-1.5 animate-fade-in">
          <input
            type="text"
            autoFocus
            value={customInputText}
            onChange={(e) => {
              setCustomInputText(e.target.value)
              onChange(e.target.value)
            }}
            placeholder={customPlaceholder}
            className="w-full bg-paper border border-forest/60 focus:border-forest rounded px-2.5 py-1.5 text-[16px] sm:text-[12px] text-ink outline-none shadow-xs"
          />
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(false)
              onChange(options[0] || "")
            }}
            className="text-[11px] text-ink-faint hover:text-ink px-2.5 py-1.5 border border-line rounded bg-paper-deep shrink-0 cursor-pointer"
            title="Revert to standard options"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export const CUSTOM_DETAIL_SUGGESTIONS = [
  "Shed Location",
  "Lineage / Dam",
  "Daily Milk Yield",
  "Astrological Nakshatra",
  "Special Offering",
  "Horn Span",
  "Microchip / ID",
  "Special Care Note",
]

const statusToneMap: Record<AnimalOperationalStatus, "ok" | "saffron" | "warn" | "danger" | "neutral"> =
  {
    Available: "ok",
    "In Transit": "neutral",
    "In Seva": "saffron",
    "Resting Buffer": "warn",
    "Vet Care": "warn",
    "Heat Hold": "danger",
    Recovering: "neutral",
  }

const resizeImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const MAX_DIM = 800
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL("image/jpeg", 0.85))
        } else {
          resolve(e.target?.result as string)
        }
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const photoPresets = [
  {
    label: "Gir Cow (Gujarat)",
    url: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=500&h=500&fit=crop&auto=format",
  },
  {
    label: "Kapila White Cow",
    url: "https://images.unsplash.com/photo-1613445564548-7dd79ec70f08?w=500&h=500&fit=crop&auto=format",
  },
  {
    label: "Sacred Nandi Bull",
    url: "https://images.unsplash.com/photo-1673229266917-89abfa3ebc58?w=500&h=500&fit=crop&auto=format",
  },
  {
    label: "Young Vatsa Calf",
    url: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=500&h=500&fit=crop&auto=format",
  },
  {
    label: "Rathi Sacred Cow",
    url: "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=500&h=500&fit=crop&auto=format",
  },
  {
    label: "Sahiwal Dairy Mother",
    url: "https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=500&h=500&fit=crop&auto=format",
  },
]

interface BovinePhotoUploaderProps {
  currentPhoto: string
  photos?: string[]
  onPhotoChange: (url: string) => void
  onPhotosChange?: (photos: string[]) => void
  label?: string
  helperText?: string
}

function BovinePhotoUploader({
  currentPhoto,
  photos,
  onPhotoChange,
  onPhotosChange,
  label = "Sacred Cattle Photograph (Identity Portrait)",
  helperText = "Official photograph used for devotee booking cards, transport permits & Pashu Aadhaar",
}: BovinePhotoUploaderProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "presets" | "url">("upload")
  const [urlInput, setUrlInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const galleryList = useMemo(() => {
    if (photos && photos.length > 0) return photos
    if (currentPhoto) return [currentPhoto]
    return [photoPresets[0].url]
  }, [photos, currentPhoto])

  const [activePreview, setActivePreview] = useState<string>(
    currentPhoto || galleryList[0],
  )

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
      alert("At least one photo must be kept for this sacred animal.")
      return
    }
    const filtered = galleryList.filter((p) => p !== url)
    if (onPhotosChange) onPhotosChange(filtered)
    if (currentPhoto === url) onPhotoChange(filtered[0])
    if (activePreview === url) setActivePreview(filtered[0])
  }

  const handleAddPhotos = (newUrls: string[]) => {
    const fresh = newUrls.filter((u) => !galleryList.includes(u))
    if (fresh.length === 0) return
    const updated = [...galleryList, ...fresh]
    if (onPhotosChange) onPhotosChange(updated)
    setActivePreview(fresh[0])
  }

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (fileArray.length === 0) {
      alert("Please upload valid image files (JPG, PNG, WebP).")
      return
    }
    setIsProcessing(true)
    try {
      const resizePromises = fileArray.map((f) => resizeImageFile(f))
      const loaded = await Promise.all(resizePromises)
      handleAddPhotos(loaded)
    } catch (err) {
      console.error("Failed to process photo upload:", err)
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

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return
    handleAddPhotos([urlInput.trim()])
    setUrlInput("")
  }

  const isCover = currentPreview === currentPhoto

  return (
    <div className="p-3.5 rounded-md bg-paper border border-line space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <label className="block text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
            <Camera size={15} className="text-forest" />
            <span>{label}</span>
          </label>
          <p className="text-[11px] text-ink-faint mt-0.5">{helperText}</p>
        </div>

        <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-forest-soft text-forest border border-forest/20 font-medium">
          {galleryList.length} Angles in Gallery
        </span>
      </div>

      {/* Main Preview with Cover Actions */}
      <div className="relative w-full h-44 sm:h-52 rounded-md overflow-hidden border border-line bg-paper-deep group">
        <img
          src={currentPreview}
          alt="Cattle Preview"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

        <div className="absolute top-2.5 inset-x-3 flex items-center justify-between text-white text-[11px]">
          {isCover ? (
            <span className="font-mono px-2.5 py-0.5 rounded-full bg-forest text-white backdrop-blur-md border border-white/20 flex items-center gap-1 shadow-xs">
              <CheckCircle2 size={12} /> Primary Portrait Cover
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

        <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-white text-[11px]">
          <div className="drop-shadow-xs font-medium text-[11px] truncate">
            {photoPresets.find((p) => p.url === currentPreview)?.label || "Sacred Cow Angle"}
          </div>
          {galleryList.length > 1 && (
            <button
              type="button"
              onClick={(e) => handleRemovePhoto(currentPreview, e)}
              className="px-2 py-1 rounded bg-danger/80 hover:bg-danger text-white text-[10.5px] font-medium flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              <Trash2 size={11} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* Gallery Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-ink flex items-center gap-1">
            <Layers size={12} className="text-saffron-deep" />
            <span>Cow Angles Gallery ({galleryList.length})</span>
          </span>
          <span className="text-[10px] text-ink-faint">
            Tap thumbnail to inspect · ★ marks booking thumbnail
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {galleryList.map((url, idx) => {
            const isSelected = url === currentPreview
            const isMainCover = url === currentPhoto
            return (
              <div
                key={url + idx}
                onClick={() => setActivePreview(url)}
                className={`relative group rounded overflow-hidden aspect-[4/3] border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-forest ring-2 ring-forest/30 shadow-xs"
                    : "border-line opacity-85 hover:opacity-100 hover:border-forest/50"
                }`}
              >
                <img src={url} alt={`Cow angle ${idx + 1}`} className="w-full h-full object-cover" />
                {isMainCover && (
                  <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-forest text-white text-[8px] font-mono font-bold shadow-xs">
                    Cover
                  </div>
                )}
                {galleryList.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleRemovePhoto(url, e)}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 hover:bg-danger text-white opacity-0 group-hover:opacity-100 transition shadow-xs cursor-pointer"
                  >
                    <X size={9} />
                  </button>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-ink/75 text-white text-[8.5px] px-0.5 truncate text-center font-mono">
                  #{idx + 1}
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => {
              setActiveTab("upload")
              fileInputRef.current?.click()
            }}
            className="rounded border-2 border-dashed border-line hover:border-forest aspect-[4/3] flex flex-col items-center justify-center p-1 text-ink-soft hover:text-forest bg-paper-deep/60 hover:bg-forest-soft/10 transition cursor-pointer"
          >
            <Plus size={14} />
            <span className="text-[9px] font-medium">Add Angle</span>
          </button>
        </div>
      </div>

      {/* Source Selection Tabs */}
      <div className="pt-2 border-t border-line space-y-2">
        <div className="flex items-center border border-line rounded bg-card p-0.5 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded transition cursor-pointer ${
              activeTab === "upload"
                ? "bg-paper text-forest shadow-xs font-semibold"
                : "text-ink-faint hover:text-ink"
            }`}
          >
            <UploadCloud size={12} />
            <span>Multiple Photos / Camera</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded transition cursor-pointer ${
              activeTab === "presets"
                ? "bg-paper text-ink shadow-xs font-semibold"
                : "text-ink-faint hover:text-ink"
            }`}
          >
            <ImageIcon size={12} />
            <span>Indigenous Breeds</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded transition cursor-pointer ${
              activeTab === "url"
                ? "bg-paper text-ink shadow-xs font-semibold"
                : "text-ink-faint hover:text-ink"
            }`}
          >
            <Link2 size={12} />
            <span>Image URL</span>
          </button>
        </div>

        {/* Tab 1: Multi-file Upload */}
        {activeTab === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-line hover:border-forest bg-card hover:bg-forest-soft/20 rounded-md p-3 text-center transition cursor-pointer flex flex-col items-center justify-center"
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
            {isProcessing ? (
              <div className="flex items-center gap-2 text-[12px] text-forest font-medium">
                <RefreshCw size={14} className="animate-spin" />
                <span>Optimizing and adding photos...</span>
              </div>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-forest-soft flex items-center justify-center text-forest mb-1">
                  <UploadCloud size={16} />
                </div>
                <div className="text-[12px] font-medium text-ink">
                  Click to select multiple photos or drag & drop
                </div>
                <div className="text-[10.5px] text-ink-faint mt-0.5">
                  Select 1 or more photos (horns, tilak mark, facial portrait, mother-calf)
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Indigenous Breed Presets */}
        {activeTab === "presets" && (
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {photoPresets.map((p) => {
              const isInGallery = galleryList.includes(p.url)
              const isCover = p.url === currentPhoto

              return (
                <div
                  key={p.label}
                  className={`rounded overflow-hidden border text-left transition flex flex-col ${
                    isInGallery ? "border-forest/50 bg-forest-soft/10" : "border-line bg-card"
                  }`}
                >
                  <div
                    onClick={() => {
                      if (isInGallery) setActivePreview(p.url)
                      else handleAddPhotos([p.url])
                    }}
                    className="h-14 w-full overflow-hidden bg-paper relative cursor-pointer group"
                  >
                    <img src={p.url} alt={p.label} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    {isInGallery && (
                      <div className="absolute top-1 right-1 p-0.5 rounded-full bg-forest text-white shadow-xs">
                        <Check size={9} />
                      </div>
                    )}
                    {isCover && (
                      <div className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-forest text-white text-[7.5px] font-mono">
                        Cover
                      </div>
                    )}
                  </div>
                  <div className="p-1 flex items-center justify-between">
                    <span className="text-[9.5px] font-medium text-ink truncate">{p.label}</span>
                    {isInGallery ? (
                      <button
                        type="button"
                        onClick={() => handleSetCover(p.url)}
                        className="text-[8.5px] text-forest font-medium hover:underline cursor-pointer"
                      >
                        {isCover ? "★" : "Cover"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddPhotos([p.url])}
                        className="text-[8.5px] text-forest font-medium hover:underline cursor-pointer"
                      >
                        +Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab 3: URL Input */}
        {activeTab === "url" && (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/cow-photo.jpg"
              className="flex-1 bg-card border border-line rounded px-3 py-1.5 text-[12px] text-ink outline-none focus:border-forest"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              disabled={!urlInput.trim()}
              className="px-3 py-1.5 bg-forest text-white rounded text-[12px] font-medium hover:opacity-95 disabled:opacity-50 transition cursor-pointer shrink-0 shadow-xs"
            >
              + Add Angle
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Assigned Veterinary Doctors mapped per Gaushala
const defaultVetDoctors: Record<string, AnimalVetInfo> = {
  "Shri Krishna Gaushala": {
    doctorName: "Dr. Anand Kulkarni",
    qualification: "B.V.Sc & A.H., M.V.Sc (Bovine Care)",
    regNo: "MH-VET-4821",
    clinic: "Govt. Veterinary Polyclinic, Hyderabad",
    phone: "+91 98220 54321",
    lastVisit: "22 Sep 2026",
    nextDue: "22 Oct 2026",
    dewormingDate: "15 Sep 2026",
    hoofCareDate: "20 Sep 2026",
    vitals: {
      temp: "38.5°C",
      heartRate: "64 bpm",
      respiration: "22 /min",
      rumen: "3 / 2min",
    },
  },
  "Nandini Goseva Sadan": {
    doctorName: "Dr. Rameshwar Deshmukh",
    qualification: "M.V.Sc Medicine & Surgery",
    regNo: "TS-VET-3910",
    clinic: "Regional Animal Healthcare Center, Hyderabad",
    phone: "+91 98901 67890",
    lastVisit: "20 Sep 2026",
    nextDue: "20 Oct 2026",
    dewormingDate: "10 Sep 2026",
    hoofCareDate: "18 Sep 2026",
    vitals: {
      temp: "38.6°C",
      heartRate: "60 bpm",
      respiration: "18 /min",
      rumen: "3 / 2min",
    },
  },
  "Gopal Gaushala Trust": {
    doctorName: "Dr. Suresh Patil",
    qualification: "B.V.Sc & A.H., Cattle Specialist",
    regNo: "TS-VET-5120",
    clinic: "Banjara Hills Veterinary Clinic, Hyderabad",
    phone: "+91 97640 45678",
    lastVisit: "24 Sep 2026",
    nextDue: "24 Oct 2026",
    dewormingDate: "15 Sep 2026",
    hoofCareDate: "20 Sep 2026",
    vitals: {
      temp: "38.8°C",
      heartRate: "76 bpm",
      respiration: "26 /min",
      rumen: "2 / 2min",
    },
  },
}

function getVetDetails(gosala: string): AnimalVetInfo {
  const now = new Date()
  const formatDate = (daysOffset: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + daysOffset)
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const existing = defaultVetDoctors[gosala]
  if (existing) {
    return {
      ...existing,
      lastVisit: formatDate(-7),
      nextDue: formatDate(23),
      dewormingDate: formatDate(-14),
      hoofCareDate: formatDate(-10),
    }
  }

  return {
    doctorName: "Dr. Anand Kulkarni",
    qualification: "B.V.Sc & A.H., Bovine Welfare Specialist",
    regNo: "VET-REG-4821",
    clinic: `${gosala || "Sanctuary"} Veterinary Healthcare Bay`,
    phone: "+91 98220 54321",
    lastVisit: formatDate(-7),
    nextDue: formatDate(23),
    dewormingDate: formatDate(-14),
    hoofCareDate: formatDate(-10),
    vitals: {
      temp: "38.5°C",
      heartRate: "64 bpm",
      respiration: "22 /min",
      rumen: "3 / 2min",
    },
  }
}

function AnimalCard({
  a,
  onOpenDossier,
  onEditCow,
  recentTripsCount,
}: {
  a: Animal
  onOpenDossier: (animal: Animal) => void
  onEditCow?: (animal: Animal) => void
  recentTripsCount: number
}) {
  const isCooldown = a.status === "Resting Buffer"
  const isVet = a.status === "Vet Care"
  const isHeat = a.status === "Heat Hold"

  return (
    <Panel className="overflow-hidden group hover:border-line-strong transition-all flex flex-col justify-between">
      <div>
        <div className="relative h-44 bg-paper-deep overflow-hidden">
          <img
            src={a.photo}
            alt={a.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* Status Badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
            <Tag tone={statusToneMap[a.status] || "ok"}>{a.status}</Tag>
            {isCooldown && (
              <span className="bg-amber-100/90 text-amber-900 border border-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm animate-pulse">
                <Clock size={11} /> 90m Rest Active
              </span>
            )}
            {isVet && (
              <span className="bg-red-100/90 text-red-800 border border-red-300 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
                <HeartPulse size={11} /> Vet Hold
              </span>
            )}
            {isHeat && (
              <span className="bg-orange-100/90 text-orange-900 border border-orange-300 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
                <Flame size={11} /> Heat Alert
              </span>
            )}
          </div>

          {/* Multi-Photo Count Badge */}
          <div className="absolute top-2.5 right-2.5">
            <span className="bg-black/65 backdrop-blur-md text-white border border-white/25 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <Camera size={10} /> {(a.photos && a.photos.length) || 1}
            </span>
          </div>

          {/* Dakshina Base Rate */}
          <div className="absolute bottom-2.5 right-2.5 bg-paper/90 backdrop-blur-sm border border-line rounded px-2 py-0.5 font-mono text-[12.5px] text-ink font-semibold">
            {inr(a.price)}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-serif text-[18px] text-ink font-semibold leading-tight flex items-center gap-1.5 flex-wrap">
                {a.name}
                <span className="text-[11px] font-sans font-normal text-ink-faint">
                  ({a.breed || a.type})
                </span>
                {a.tagId && (
                  <span className="text-[9.5px] font-mono text-forest bg-forest-soft/80 border border-forest/20 px-1.5 py-0.5 rounded">
                    RFID {a.tagId}
                  </span>
                )}
              </div>
              <div className="text-[11.5px] text-ink-faint mt-0.5 flex items-center gap-1.5">
                <span>{a.gosala}</span>
                {a.lactationStatus && (
                  <>
                    <span>•</span>
                    <span className="text-[10.5px] text-saffron-deep font-medium">
                      {a.lactationStatus}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-ink-soft bg-paper-deep px-1.5 py-0.5 rounded border border-line">
                Radius ≤ {a.maxRadiusKm} km
              </span>
            </div>
          </div>

          {/* Biological / Physical Specs */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line text-center">
            {[
              ["Age", a.age],
              ["Weight", a.weight],
              ["Height", a.height],
            ].map(([label, val]) => (
              <div
                key={label}
                className="bg-paper/60 rounded py-1 px-1 border border-line/50"
              >
                <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                  {label}
                </div>
                <div className="text-[12px] font-medium text-ink tabular mt-0.5">
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Welfare & Handler Bar */}
          <div className="mt-3 space-y-1.5 text-[11.5px]">
            <div className="flex items-center justify-between text-ink-soft">
              <span className="flex items-center gap-1 text-ink-faint">
                <UserCheck size={12} className="text-forest" /> Gosevak
                Caretaker:
              </span>
              <span className="font-medium text-ink truncate max-w-[170px]">
                {a.assignedHandler || "Gaushala Gosevak"}
              </span>
            </div>

            {/* Daily & 7-Day Activity */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-ink-faint text-[11px]">
                Today&apos;s Sevas:
              </span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-paper-deep rounded-full overflow-hidden border border-line">
                  <div
                    className={`h-full ${
                      a.todayBookings >= a.maxDailyTrips
                        ? "bg-amber-500"
                        : "bg-forest"
                    }`}
                    style={{
                      width: `${Math.min(100, (a.todayBookings / (a.maxDailyTrips || 2)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] text-ink font-medium">
                  {a.todayBookings}/{a.maxDailyTrips}
                </span>
              </div>
            </div>

            {/* 7-Day Trips Count Tag */}
            <div className="flex items-center justify-between pt-0.5 text-[11px] text-ink-faint">
              <span>7-Day Trips:</span>
              <span className="font-mono font-medium text-saffron-deep">
                {recentTripsCount} Sevas completed
              </span>
            </div>

            {/* Health Notes if present */}
            {a.healthNotes && (
              <div className="bg-paper-deep/80 rounded p-2 text-[11px] text-ink-soft border border-line/60 flex items-start gap-1.5 mt-2">
                <ShieldCheck
                  size={13}
                  className="text-saffron shrink-0 mt-0.5"
                />
                <span className="line-clamp-2">{a.healthNotes}</span>
              </div>
            )}
            {/* Custom Details Badges if present */}
            {a.customDetails && a.customDetails.length > 0 && (
              <div className="pt-2 border-t border-line/50 flex items-center gap-1.5 flex-wrap text-[10.5px]">
                {a.customDetails.slice(0, 2).map((cd) => (
                  <span
                    key={cd.id}
                    className="bg-paper-deep text-ink-soft px-1.5 py-0.5 rounded border border-line truncate max-w-[170px]"
                    title={`${cd.label}: ${cd.value}`}
                  >
                    <span className="font-semibold text-ink">{cd.label}:</span>{" "}
                    {cd.value}
                  </span>
                ))}
                {a.customDetails.length > 2 && (
                  <span className="text-ink-faint text-[10px]">
                    +{a.customDetails.length - 2} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer / Action */}
      <div className="p-4 pt-0 flex items-center gap-2">
        <button
          onClick={() => onOpenDossier(a)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[12.5px] font-medium rounded-sm border border-line bg-card hover:bg-paper-deep text-ink transition-colors group-hover:border-saffron/40 cursor-pointer"
        >
          <span>View Profile & Welfare Dossier</span>
          <ChevronRight size={14} className="text-ink-faint" />
        </button>
        {onEditCow && (
          <button
            onClick={() => onEditCow(a)}
            className="p-2 text-[12.5px] font-medium rounded-sm border border-line bg-card hover:bg-paper-deep text-ink-soft hover:text-saffron-deep transition-colors cursor-pointer"
            title={`Edit details for ${a.name}`}
            aria-label={`Edit details for ${a.name}`}
          >
            <Edit2 size={14} />
          </button>
        )}
      </div>
    </Panel>
  )
}

export default function Animals() {
  const { notify } = useToast()
  const {
    animals,
    addAnimal,
    updateAnimal,
    updateAnimalStatus,
    updateAnimalWelfareConfig,
    bookings,
    vets,
    addVet,
    updateVet,
    deleteVet,
    gosalas,
    activeGosalaFilter,
    activeManagerGosala,
    setActiveGosalaFilter,
    currentRole,
    profiles,
  } = useStore()

  const assignedGosala =
    activeManagerGosala ||
    (activeGosalaFilter && activeGosalaFilter !== "ALL"
      ? activeGosalaFilter
      : "") ||
    profiles?.manager?.managerData?.gosala ||
    gosalas[0]?.name ||
    ""

  // Dynamic Gaushala Shelters from Store
  const dynamicGosalaOptions = useMemo(() => {
    if (currentRole === "manager") {
      return assignedGosala ? [assignedGosala] : (gosalas.map(g => g.name))
    }
    const fromGosalas = (gosalas || []).map((g) => g.name)
    return Array.from(new Set([...fromGosalas]))
  }, [gosalas, currentRole, assignedGosala])

  // State Management
  const [mainTab, setMainTab] = useState<"herd" | "vets">("herd")
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<Booking | null>(null)
  const [activeTab, setActiveTab] =
    useState<"history" | "vet" | "diet" | "rules">("history")
  const [searchQuery, setSearchQuery] = useState("")

  // Empanelled Vet Form State & Modal
  const [showAddVetModal, setShowAddVetModal] = useState(false)
  const [editingVet, setEditingVet] = useState<EmpanelledVet | null>(null)
  const [vetName, setVetName] = useState("")
  const [vetQualification, setVetQualification] = useState(
    "B.V.Sc & A.H., M.V.Sc (Bovine Medicine)",
  )
  const [vetRegNo, setVetRegNo] = useState("")
  const [vetClinic, setVetClinic] = useState("")
  const [vetPhone, setVetPhone] = useState("+91 98")
  const [vetAddress, setVetAddress] = useState("Kondapur, Hyderabad")
  const [vetSpecialization, setVetSpecialization] = useState(
    "Bovine Health, Vaccination & Ultrasound",
  )
  const [vetEmergency, setVetEmergency] = useState(true)
  const [vetAssignedGosala, setVetAssignedGosala] = useState(
    () => (currentRole === "manager" ? assignedGosala : dynamicGosalaOptions[0] || gosalas[0]?.name || ""),
  )

  const handleOpenAddVet = (v?: EmpanelledVet) => {
    if (v) {
      setEditingVet(v)
      setVetName(v.name)
      setVetQualification(v.qualification)
      setVetRegNo(v.regNo)
      setVetClinic(v.clinic)
      setVetPhone(v.phone)
      setVetAddress(v.address)
      setVetSpecialization(v.specialization)
      setVetEmergency(v.emergency24x7)
      setVetAssignedGosala(
        currentRole === "manager"
          ? assignedGosala
          : v.assignedGosalas[0] || dynamicGosalaOptions[0] || gosalas[0]?.name || "",
      )
    } else {
      setEditingVet(null)
      setVetName("")
      setVetQualification("B.V.Sc & A.H., M.V.Sc (Bovine Medicine)")
      setVetRegNo(`MH-VET-${Math.floor(2000 + Math.random() * 7000)}`)
      setVetClinic("")
      setVetPhone("+91 98")
      setVetAddress("Kondapur, Hyderabad")
      setVetSpecialization("Bovine Health, Vaccination & Ultrasound")
      setVetEmergency(true)
      setVetAssignedGosala(
        currentRole === "manager"
          ? assignedGosala
          : dynamicGosalaOptions[0] || gosalas[0]?.name || "",
      )
    }
    setShowAddVetModal(true)
  }

  const handleSaveVet = (e: React.FormEvent) => {
    e.preventDefault()
    if (!vetName.trim()) return

    const formattedName = vetName.trim().startsWith("Dr.")
      ? vetName.trim()
      : `Dr. ${vetName.trim()}`

    const finalAssignedGosalas =
      currentRole === "manager"
        ? [assignedGosala]
        : vetAssignedGosala === "All Gaushalas"
        ? dynamicGosalaOptions
        : [vetAssignedGosala]

    if (editingVet) {
      updateVet(editingVet.id, {
        name: formattedName,
        qualification: vetQualification,
        regNo: vetRegNo,
        clinic: vetClinic,
        phone: vetPhone,
        address: vetAddress,
        specialization: vetSpecialization,
        emergency24x7: vetEmergency,
        assignedGosalas: finalAssignedGosalas,
      })
    } else {
      const newDoc: EmpanelledVet = {
        id: `VET-${Date.now().toString().slice(-4)}`,
        name: formattedName,
        qualification: vetQualification,
        regNo: vetRegNo || `TS-VET-${Math.floor(2000 + Math.random() * 7000)}`,
        clinic: vetClinic || "Govt. Veterinary Polyclinic",
        phone: vetPhone || "+91 98220 54321",
        address: vetAddress || "Hyderabad, Telangana",
        specialization: vetSpecialization,
        emergency24x7: vetEmergency,
        assignedGosalas: finalAssignedGosalas,
      }
      addVet(newDoc)

      // Auto-bind to Add Animal Step 2 form if it was in progress
      setAddVetDocName(newDoc.name)
      setAddVetPhone(newDoc.phone)
      setAddVetClinic(newDoc.clinic)
      setAddVetRegNo(newDoc.regNo)
    }

    setShowAddVetModal(false)
    setEditingVet(null)
  }

  const handleDeleteVet = (id: string, name: string) => {
    if (confirm(`Remove ${name} from empanelled veterinary panel?`)) {
      deleteVet(id)
    }
  }

  // Edit Vet Form State in Dossier
  const [isEditingVet, setIsEditingVet] = useState(false)
  const [vetForm, setVetForm] = useState<AnimalVetInfo>({
    doctorName: "",
    qualification: "",
    regNo: "",
    clinic: "",
    phone: "",
    lastVisit: "",
    nextDue: "",
    dewormingDate: "",
    hoofCareDate: "",
    vitals: {
      temp: "38.5°C",
      heartRate: "64 bpm",
      respiration: "22 /min",
      rumen: "3 / 2min",
    },
  })

  // Welfare Rules Form State
  const [targetStatus, setTargetStatus] =
    useState<AnimalOperationalStatus>("Available")
  const [statusRemark, setStatusRemark] = useState("")
  const [cooldownMinutes, setCooldownMinutes] = useState(90)
  const [customDailyLimit, setCustomDailyLimit] = useState(2)
  const [customRadius, setCustomRadius] = useState(20)

  // Add Animal Form State (Comprehensive & 100% Dynamic Dropdowns)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addStep, setAddStep] = useState<1 | 2>(1)
  const [name, setName] = useState("")
  const [tagId, setTagId] = useState("IN-MH-12-8491")
  const [type, setType] = useState<AnimalType>("Cow")
  const [breed, setBreed] = useState("Gir Cow")
  const [gosala, setGosala] = useState(
    () =>
      currentRole === "manager"
        ? assignedGosala
        : activeGosalaFilter !== "ALL"
        ? activeGosalaFilter
        : dynamicGosalaOptions[0] || gosalas[0]?.name || "",
  )
  const [selectedAgePresetLabel, setSelectedAgePresetLabel] = useState(
    "Prime Sacred Cow (6–8 yrs)",
  )
  const [age, setAge] = useState("6 yrs")
  const [weight, setWeight] = useState("410 kg")
  const [height, setHeight] = useState("132 cm")
  const [lactationStatus, setLactationStatus] = useState(LACTATION_STATUSES[0])
  const [temperament, setTemperament] = useState(TEMPERAMENT_PRESETS[0])
  const [sacredMarks, setSacredMarks] = useState(SACRED_MARKS_PRESETS[0])
  const [category, setCategory] = useState("Ceremonial · Puja & Griha Pravesh")
  const [price, setPrice] = useState("3500")
  const [photo, setPhoto] = useState(photoPresets[0].url)
  const [addPhotos, setAddPhotos] = useState<string[]>([
    photoPresets[0].url,
    photoPresets[1].url,
    photoPresets[2].url,
  ])
  const [handler, setHandler] = useState(GOSEVAK_HANDLERS[0])
  const [customDailySeva, setCustomDailySeva] = useState(2)
  const [customRadiusKm, setCustomRadiusKm] = useState(20)
  const [customCooldownMins, setCustomCooldownMins] = useState(90)

  // Edit Sacred Cow State & Form
  const [editingCow, setEditingCow] = useState<Animal | null>(null)
  const [showEditCowModal, setShowEditCowModal] = useState(false)
  const [editStep, setEditStep] = useState<1 | 2>(1)
  const [editName, setEditName] = useState("")
  const [editTagId, setEditTagId] = useState("")
  const [editBreed, setEditBreed] = useState("Gir Cow")
  const [editType, setEditType] = useState<AnimalType>("Cow")
  const [editGosala, setEditGosala] = useState(
    () => dynamicGosalaOptions[0] || gosalas[0]?.name || "",
  )
  const [editAge, setEditAge] = useState("6 yrs")
  const [editWeight, setEditWeight] = useState("410 kg")
  const [editHeight, setEditHeight] = useState("132 cm")
  const [editCategory, setEditCategory] = useState("Ceremonial · Puja & Griha Pravesh")
  const [editPrice, setEditPrice] = useState("3500")
  const [editHandler, setEditHandler] = useState(GOSEVAK_HANDLERS[0])
  const [editLactation, setEditLactation] = useState(LACTATION_STATUSES[0])
  const [editTemperament, setEditTemperament] = useState(TEMPERAMENT_PRESETS[0])
  const [editSacredMarks, setEditSacredMarks] = useState(SACRED_MARKS_PRESETS[0])
  const [editPhoto, setEditPhoto] = useState(photoPresets[0].url)
  const [editPhotos, setEditPhotos] = useState<string[]>([])
  const [editStatus, setEditStatus] = useState<AnimalOperationalStatus>("Available")
  const [editMaxDailyTrips, setEditMaxDailyTrips] = useState(2)
  const [editMaxRadiusKm, setEditMaxRadiusKm] = useState(20)
  const [editCooldownMinutes, setEditCooldownMinutes] = useState(90)

  // Edit Cow Vet & Diet
  const [editVetDoctorId, setEditVetDoctorId] = useState("VET-101")
  const [editVetDocName, setEditVetDocName] = useState("")
  const [editVetPhone, setEditVetPhone] = useState("")
  const [editVetClinic, setEditVetClinic] = useState("")
  const [editVetRegNo, setEditVetRegNo] = useState("")

  const [editDietPresetId, setEditDietPresetId] = useState("standard")
  const [editGreenGrass, setEditGreenGrass] = useState(DIET_PRESETS[0].greenFodder)
  const [editDryRoughage, setEditDryRoughage] = useState(DIET_PRESETS[0].dryRoughage)
  const [editConcentrateFeed, setEditConcentrateFeed] = useState(DIET_PRESETS[0].concentrateMix)
  const [editWaterIntake, setEditWaterIntake] = useState(DIET_PRESETS[0].waterIntakeLiters)
  const [editFeedingTimes, setEditFeedingTimes] = useState(DIET_PRESETS[0].feedingTimes)
  const [editHealthNotes, setEditHealthNotes] = useState("")

  const handleOpenEditCow = (a: Animal) => {
    setEditingCow(a)
    setEditName(a.name)
    setEditTagId(
      a.tagId || `IN-MH-12-${Math.floor(1000 + Math.random() * 8999)}`,
    )
    setEditBreed(a.breed || "Gir Cow")
    setEditType(a.type)
    setEditGosala(a.gosala)
    setEditAge(a.age)
    setEditWeight(a.weight)
    setEditHeight(a.height)
    setEditCategory(a.category)
    setEditPrice(String(a.price))
    setEditHandler(a.assignedHandler || GOSEVAK_HANDLERS[0])
    setEditLactation(a.lactationStatus || LACTATION_STATUSES[0])
    setEditTemperament(a.temperament || TEMPERAMENT_PRESETS[0])
    setEditSacredMarks(a.sacredMarks || SACRED_MARKS_PRESETS[0])
    setEditPhoto(a.photo)
    setEditPhotos(a.photos && a.photos.length > 0 ? a.photos : [a.photo])
    setEditStatus(a.status)
    setEditMaxDailyTrips(a.maxDailyTrips || 2)
    setEditMaxRadiusKm(a.maxRadiusKm || 20)
    setEditCooldownMinutes(a.cooldownMinutes || 90)

    const matchedVet =
      vets.find(
        (v) =>
          a.vetInfo?.doctorName &&
          v.name.toLowerCase().includes(a.vetInfo.doctorName.toLowerCase()),
      ) || vets[0]

    setEditVetDoctorId(matchedVet?.id || "VET-101")
    setEditVetDocName(
      a.vetInfo?.doctorName || matchedVet?.name || "Dr. Anand Kulkarni",
    )
    setEditVetPhone(
      a.vetInfo?.phone || matchedVet?.phone || "+91 98220 54321",
    )
    setEditVetClinic(
      a.vetInfo?.clinic ||
        matchedVet?.clinic ||
        "Govt. Veterinary Polyclinic, Kothrud",
    )
    setEditVetRegNo(a.vetInfo?.regNo || matchedVet?.regNo || "MH-VET-4821")

    setEditDietPresetId("standard")
    setEditGreenGrass(a.dietInfo?.greenFodder || DIET_PRESETS[0].greenFodder)
    setEditDryRoughage(a.dietInfo?.dryRoughage || DIET_PRESETS[0].dryRoughage)
    setEditConcentrateFeed(
      a.dietInfo?.concentrateMix || DIET_PRESETS[0].concentrateMix,
    )
    setEditWaterIntake(
      a.dietInfo?.waterIntakeLiters || DIET_PRESETS[0].waterIntakeLiters,
    )
    setEditFeedingTimes(
      a.dietInfo?.feedingTimes || DIET_PRESETS[0].feedingTimes,
    )
    setEditHealthNotes(a.healthNotes || "")

    setEditStep(1)
    setShowEditCowModal(true)
  }

  const handleSelectEditVetDoctor = (id: string) => {
    if (id === "NEW_VET") {
      handleOpenAddVet()
      return
    }
    setEditVetDoctorId(id)
    const v = vets.find((x) => x.id === id)
    if (v) {
      setEditVetDocName(v.name)
      setEditVetPhone(v.phone)
      setEditVetClinic(v.clinic)
      setEditVetRegNo(v.regNo)
    }
  }

  const handleSelectEditDietPreset = (id: string) => {
    setEditDietPresetId(id)
    const d = DIET_PRESETS.find((x) => x.id === id)
    if (d) {
      setEditGreenGrass(d.greenFodder)
      setEditDryRoughage(d.dryRoughage)
      setEditConcentrateFeed(d.concentrateMix)
      setEditWaterIntake(d.waterIntakeLiters)
      setEditFeedingTimes(d.feedingTimes)
    }
  }

  const handleSaveEditCow = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCow) return
    if (!editName.trim()) {
      notify("Please enter an animal name", "warn")
      return
    }

    const patch: Partial<Animal> = {
      name: editName.trim(),
      tagId: editTagId.trim(),
      breed: editBreed.trim() || CATTLE_BREEDS[0],
      type: editType,
      gosala: editGosala.trim() || dynamicGosalaOptions[0] || GOSALA_PRESETS[0],
      age: editAge,
      ageYears: Number(editAge.replace(/\D/g, "")) || 5,
      weight: editWeight,
      height: editHeight,
      category: editCategory.trim() || CEREMONIAL_CATEGORIES[0],
      price: Number(editPrice) || 3500,
      status: editStatus,
      maxDailyTrips: Number(editMaxDailyTrips) || 2,
      maxRadiusKm: Number(editMaxRadiusKm) || 20,
      cooldownMinutes: Number(editCooldownMinutes) || 90,
      assignedHandler: editHandler.trim() || GOSEVAK_HANDLERS[0],
      lactationStatus: editLactation.trim() || LACTATION_STATUSES[0],
      temperament: editTemperament.trim() || TEMPERAMENT_PRESETS[0],
      photo: editPhotos.includes(editPhoto) ? editPhoto : (editPhotos[0] || editPhoto),
      photos: editPhotos.length > 0 ? editPhotos : [editPhoto],
      diet: `${editGreenGrass} + ${editConcentrateFeed}`,
      healthNotes: editHealthNotes,
      customDetails: editingCow.customDetails || [],
      dietInfo: {
        greenFodder: editGreenGrass,
        dryRoughage: editDryRoughage,
        concentrateMix: editConcentrateFeed,
        waterIntakeLiters: editWaterIntake,
        feedingTimes: editFeedingTimes,
        postTripCare:
          editingCow.dietInfo?.postTripCare ||
          "Warm electrolyte jaggery water within 30 min of arrival",
      },
      vetInfo: {
        ...(editingCow.vetInfo || {}),
        doctorName: editVetDocName,
        phone: editVetPhone,
        clinic: editVetClinic,
        regNo: editVetRegNo,
        qualification:
          editingCow.vetInfo?.qualification || "B.V.Sc & A.H., M.V.Sc",
        lastVisit: editingCow.vetInfo?.lastVisit || "Recent Routine Checkup",
        nextDue: editingCow.vetInfo?.nextDue || "Scheduled Next Month",
        dewormingDate: editingCow.vetInfo?.dewormingDate || "Up to date",
        hoofCareDate: editingCow.vetInfo?.hoofCareDate || "Inspected & clean",
        vitals: editingCow.vetInfo?.vitals || {
          temp: "38.5°C",
          heartRate: "64 bpm",
          respiration: "22 /min",
          rumen: "3 / 2min",
        },
      },
    }

    updateAnimal(editingCow.name, patch)

    if (selectedAnimal && selectedAnimal.name === editingCow.name) {
      setSelectedAnimal((prev) => (prev ? { ...prev, ...patch } : null))
    }

    setShowEditCowModal(false)
    setEditingCow(null)
  }

  // Add Animal Vet & Diet Extra Fields
  const [selectedVetDoctorId, setSelectedVetDoctorId] = useState(
    vets[0]?.id || "VET-101",
  )
  const [addVetDocName, setAddVetDocName] = useState(
    vets[0]?.name || "Dr. Anand Kulkarni",
  )
  const [addVetPhone, setAddVetPhone] = useState(
    vets[0]?.phone || "+91 98220 54321",
  )
  const [addVetClinic, setAddVetClinic] = useState(
    vets[0]?.clinic || "Govt. Veterinary Polyclinic, Kothrud",
  )
  const [addVetRegNo, setAddVetRegNo] = useState(
    vets[0]?.regNo || "MH-VET-4821",
  )

  const [selectedDietPresetId, setSelectedDietPresetId] = useState("standard")
  const [addGreenGrass, setAddGreenGrass] = useState(
    DIET_PRESETS[0].greenFodder,
  )
  const [addDryRoughage, setAddDryRoughage] = useState(
    DIET_PRESETS[0].dryRoughage,
  )
  const [addConcentrateFeed, setAddConcentrateFeed] = useState(
    DIET_PRESETS[0].concentrateMix,
  )
  const [addWaterIntake, setAddWaterIntake] = useState(
    DIET_PRESETS[0].waterIntakeLiters,
  )
  const [addFeedingTimes, setAddFeedingTimes] = useState(
    DIET_PRESETS[0].feedingTimes,
  )
  const [addHealthNotes, setAddHealthNotes] = useState(
    "Vitals normal, alert demeanor, clear hooves",
  )

  const handleSelectAgePreset = (label: string) => {
    setSelectedAgePresetLabel(label)
    const p = AGE_PRESETS.find((x) => x.label === label)
    if (p) {
      setAge(p.age)
      setWeight(p.weight)
      setHeight(p.height)
      setType(p.type as AnimalType)
      if (p.type === "Calf") {
        setCustomDailySeva(1)
        setCustomRadiusKm(8)
        setCustomCooldownMins(120)
        setPrice("2500")
      } else if (p.type === "Cow & Calf") {
        setCustomDailySeva(2)
        setCustomRadiusKm(15)
        setCustomCooldownMins(120)
        setPrice("4800")
      } else if (p.type === "Buffalo") {
        setCustomDailySeva(2)
        setCustomRadiusKm(18)
        setCustomCooldownMins(90)
        setPrice("3200")
      } else if (p.type === "Bull") {
        setCustomDailySeva(2)
        setCustomRadiusKm(20)
        setCustomCooldownMins(90)
        setPrice("4500")
      } else {
        setCustomDailySeva(2)
        setCustomRadiusKm(20)
        setCustomCooldownMins(90)
        setPrice("3500")
      }
    }
  }

  const handleSelectDietPreset = (id: string) => {
    setSelectedDietPresetId(id)
    const d = DIET_PRESETS.find((x) => x.id === id)
    if (d) {
      setAddGreenGrass(d.greenFodder)
      setAddDryRoughage(d.dryRoughage)
      setAddConcentrateFeed(d.concentrateMix)
      setAddWaterIntake(d.waterIntakeLiters)
      setAddFeedingTimes(d.feedingTimes)
    }
  }

  const handleSelectVetDoctor = (id: string) => {
    if (id === "NEW_VET") {
      handleOpenAddVet()
      return
    }
    setSelectedVetDoctorId(id)
    const v = vets.find((x) => x.id === id)
    if (v) {
      setAddVetDocName(v.name)
      setAddVetPhone(v.phone)
      setAddVetClinic(v.clinic)
      setAddVetRegNo(v.regNo)
    }
  }

  const openDossier = (a: Animal) => {
    setSelectedAnimal(a)
    setActiveTab("history")
    setTargetStatus(a.status)
    setStatusRemark(a.healthNotes || "")
    setCooldownMinutes(a.cooldownMinutes || 90)
    setCustomDailyLimit(a.maxDailyTrips || 2)
    setCustomRadius(a.maxRadiusKm || 20)

    // Pre-populate Vet Form
    const currentVet = a.vetInfo || getVetDetails(a.gosala)
    setVetForm({
      doctorName: currentVet.doctorName,
      qualification: currentVet.qualification,
      regNo: currentVet.regNo,
      clinic: currentVet.clinic,
      phone: currentVet.phone,
      lastVisit: currentVet.lastVisit,
      nextDue: currentVet.nextDue,
      dewormingDate: currentVet.dewormingDate || "15 Sep 2026",
      hoofCareDate: currentVet.hoofCareDate || "20 Sep 2026",
      vitals: currentVet.vitals || {
        temp: "38.5°C",
        heartRate: "64 bpm",
        respiration: "22 /min",
        rumen: "3 / 2min",
      },
    })
    setIsEditingVet(false)
  }

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAnimal) return

    updateAnimalStatus(selectedAnimal.name, targetStatus, statusRemark)
    updateAnimalWelfareConfig(selectedAnimal.name, {
      maxDailyTrips: customDailyLimit,
      cooldownMinutes,
      maxRadiusKm: customRadius,
    })

    notify(
      `Welfare rules updated for ${selectedAnimal.name} (${targetStatus})`,
      "ok",
    )
    setSelectedAnimal(null)
  }

  const handleSaveVetDetails = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAnimal) return

    updateAnimal(selectedAnimal.name, { vetInfo: vetForm })
    setSelectedAnimal((prev) => (prev ? { ...prev, vetInfo: vetForm } : null))
    setIsEditingVet(false)
    notify(`Veterinary records updated for ${selectedAnimal.name}`, "ok")
  }

  const handleAddAnimal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      notify("Please enter an animal name", "warn")
      return
    }

    const isCalf = type === "Calf"
    const newAnimal: Animal = {
      name: name.trim(),
      tagId: tagId.trim(),
      type,
      breed: breed.trim() || CATTLE_BREEDS[0],
      gosala:
        currentRole === "manager"
          ? assignedGosala
          : gosala.trim() || dynamicGosalaOptions[0] || GOSALA_PRESETS[0],
      age,
      ageYears: Number(age.replace(/\D/g, "")) || (isCalf ? 1 : 5),
      weight,
      height,
      category: category.trim() || CEREMONIAL_CATEGORIES[0],
      price: Number(price) || 3500,
      status: "Available",
      todayBookings: 0,
      maxDailyTrips: isCalf ? 1 : Number(customDailySeva) || 2,
      maxRadiusKm: isCalf ? 8 : Number(customRadiusKm) || 20,
      cooldownMinutes: isCalf ? 120 : Number(customCooldownMins) || 90,
      assignedHandler: handler.trim() || GOSEVAK_HANDLERS[0],
      lactationStatus: lactationStatus.trim() || LACTATION_STATUSES[0],
      temperament: temperament.trim() || TEMPERAMENT_PRESETS[0],
      sacredMarks: sacredMarks.trim() || SACRED_MARKS_PRESETS[0],
      diet: `${addGreenGrass} + ${addConcentrateFeed}`,
      healthNotes: addHealthNotes || "Healthy, active demeanour, hooves clean",
      photo: addPhotos.includes(photo) ? photo : (addPhotos[0] || photo),
      photos: addPhotos.length > 0 ? addPhotos : [photo],
      customDetails: [],
      vetInfo: {
        doctorName: addVetDocName,
        qualification: "B.V.Sc & A.H.",
        regNo: addVetRegNo,
        clinic: addVetClinic,
        phone: addVetPhone,
        lastVisit: "Recent (Certified Fit)",
        nextDue: "Next Month",
        dewormingDate: "Up to date",
        hoofCareDate: "Inspected & clean",
        vitals: {
          temp: "38.5°C",
          heartRate: "64 bpm",
          respiration: "22 /min",
          rumen: "3 / 2min",
        },
      },
      dietInfo: {
        greenFodder: addGreenGrass,
        dryRoughage: addDryRoughage,
        concentrateMix: addConcentrateFeed,
        waterIntakeLiters: addWaterIntake,
        feedingTimes: "Morning 06:30 AM · Evening 05:30 PM",
        postTripCare: "Warm electrolyte jaggery water within 30 min of arrival",
      },
    }

    addAnimal(newAnimal)

    // Reset & close
    setName("")
    setAddStep(1)
    setShowAddModal(false)
  }

  // Filtered Animals by Search & Active Gaushala (Strict Multi-tenant Isolation)
  const filteredAnimals = useMemo(() => {
    let list = animals
    if (currentRole === "manager") {
      list = list.filter(
        (a) => a.gosala.toLowerCase() === assignedGosala.toLowerCase(),
      )
    } else if (activeGosalaFilter && activeGosalaFilter !== "ALL") {
      list = list.filter(
        (a) => a.gosala.toLowerCase() === activeGosalaFilter.toLowerCase(),
      )
    }
    const q = searchQuery.toLowerCase().trim()
    if (!q) return list
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.gosala.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        (a.breed && a.breed.toLowerCase().includes(q)) ||
        (a.assignedHandler && a.assignedHandler.toLowerCase().includes(q)),
    )
  }, [animals, searchQuery, activeGosalaFilter, currentRole, assignedGosala])

  // Filtered Empanelled Doctors (Strict Multi-tenant Isolation)
  const filteredVets = useMemo(() => {
    return vets.filter((v) => {
      if (currentRole === "manager") {
        const isAssigned = v.assignedGosalas.some(
          (g) =>
            g.toLowerCase() === assignedGosala.toLowerCase() ||
            g.toLowerCase() === "all gaushalas",
        )
        if (!isAssigned) return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        v.name.toLowerCase().includes(q) ||
        v.regNo.toLowerCase().includes(q) ||
        v.clinic.toLowerCase().includes(q) ||
        v.specialization.toLowerCase().includes(q)
      )
    })
  }, [vets, currentRole, assignedGosala, searchQuery])

  // Summary Metrics scoped dynamically to active shelter filter
  const totalCattle = filteredAnimals.length
  const availableCount = filteredAnimals.filter((a) => a.status === "Available").length
  const restingCount = filteredAnimals.filter(
    (a) =>
      a.status === "Resting Buffer" ||
      a.status === "Vet Care" ||
      a.status === "Heat Hold",
  ).length
  const inServiceCount = filteredAnimals.filter(
    (a) => a.status === "In Seva" || a.status === "In Transit",
  ).length

  // Calculate 7-Day Stats for Selected Animal
  const selectedAnimalDossier = useMemo(() => {
    if (!selectedAnimal) return null

    const cowBookings = bookings.filter(
      (b) =>
        b.animal.toLowerCase() === selectedAnimal.name.toLowerCase() &&
        b.status !== "Rejected",
    )

    const totalSevas = cowBookings.length
    const totalMinutes = cowBookings.reduce(
      (acc, b) => acc + (b.durationMin || 60),
      0,
    )
    const totalHours = (totalMinutes / 60).toFixed(1)
    const totalDistanceKm = cowBookings
      .reduce((acc, b) => acc + (b.distanceKm || 0), 0)
      .toFixed(1)

    const restHours = (
      totalSevas * 1.5 +
      (7 * 18 - Number(totalHours))
    ).toFixed(0)
    const vetInfo =
      selectedAnimal.vetInfo || getVetDetails(selectedAnimal.gosala)
    const dietInfo = selectedAnimal.dietInfo || {
      greenFodder:
        "Fresh Napier Grass & Hybrid CO-4 (18 kg/day), Green Lucerne (5 kg/day)",
      dryRoughage: "Clean dry paddy straw & wheat straw (8-10 kg/day)",
      concentrateMix:
        "Crushed maize, wheat bran, mustard cake, mineral salt & 250g pure jaggery",
      waterIntakeLiters: "45–55 Liters / day (Free-choice borewell water)",
      feedingTimes: "Morning 06:30 AM · Evening 05:30 PM",
      postTripCare: "Warm electrolyte jaggery water within 30 min of arrival",
    }

    return {
      cow: selectedAnimal,
      bookings: cowBookings,
      totalSevas,
      totalHours,
      totalDistanceKm,
      restHours,
      vetInfo,
      dietInfo,
    }
  }, [selectedAnimal, bookings])

  return (
    <div className="space-y-6">
      {/* 1. Top Welfare Roster Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          ["Registered Sacred Cattle", totalCattle, "Individual tracking"],
          ["Active & Available", availableCount, "Ready for seva bookings"],
          ["Resting & Vet Hold", restingCount, "Mandatory welfare buffers"],
          ["In Transit / In Seva", inServiceCount, "Live on road today"],
        ].map(([label, count, sub]) => (
          <Panel key={label as string} className="p-3 sm:p-4">
            <div className="font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] text-ink-faint truncate">
              {label as string}
            </div>
            <div className="font-serif text-[22px] sm:text-[26px] text-ink mt-0.5 sm:mt-1 font-semibold tabular">
              {count as number}
            </div>
            <div className="text-[11px] sm:text-[11.5px] text-ink-faint mt-0.5 truncate">
              {sub as string}
            </div>
          </Panel>
        ))}
      </div>

      {/* 2. Header, Sub-Navigation & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 border-b border-line pb-4">
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <h2 className="font-serif text-[18px] sm:text-[19px] text-ink font-semibold">
              Sacred Cattle Welfare &amp; Healthcare Roster
            </h2>
            <div className="inline-flex items-center border border-line rounded bg-card p-0.5 text-[12px] font-medium self-start">
              <button
                type="button"
                onClick={() => setMainTab("herd")}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-1 rounded transition cursor-pointer ${
                  mainTab === "herd"
                    ? "bg-paper text-ink shadow-xs font-semibold"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                <Layers size={13} />
                <span>
                  Sacred Herd (
                  {currentRole === "manager"
                    ? filteredAnimals.length
                    : animals.length}
                  )
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMainTab("vets")}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-1 rounded transition cursor-pointer ${
                  mainTab === "vets"
                    ? "bg-paper text-forest shadow-xs font-semibold"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                <Stethoscope size={13} className="text-forest" />
                <span>Empanelled Doctors ({filteredVets.length})</span>
              </button>
            </div>
          </div>
          <p className="text-[11.5px] sm:text-[12.5px] text-ink-faint">
            {mainTab === "herd"
              ? "Comprehensive bovine healthcare, 7-day trip history & standardized nutrition tracking"
              : "Certified veterinary panel, state council certifications, 24x7 emergency contacts & clinic locations"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-60 min-w-[140px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
            />
            <input
              type="text"
              placeholder={
                mainTab === "herd"
                  ? "Search cow, breed..."
                  : "Search doctor, clinic..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 sm:py-1.5 text-[16px] sm:text-[12px] rounded border border-line bg-card text-ink placeholder:text-ink-faint focus:outline-none focus:border-forest"
            />
          </div>

          <button
            onClick={() => handleOpenAddVet()}
            className="inline-flex items-center justify-center gap-1.5 bg-forest text-white rounded px-3 py-2 sm:py-1.5 text-[12px] font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer min-h-[40px] sm:min-h-0"
          >
            <Stethoscope size={14} />
            <span className="whitespace-nowrap">+ Add Vet</span>
          </button>

          <button
            onClick={() => {
              setAddStep(1)
              setShowAddModal(true)
            }}
            className="inline-flex items-center justify-center gap-1.5 bg-saffron text-white rounded px-3 py-2 sm:py-1.5 text-[12px] font-medium hover:bg-saffron-deep transition-colors shadow-xs cursor-pointer min-h-[40px] sm:min-h-0"
          >
            <Plus size={15} />
            <span className="whitespace-nowrap">Register Animal</span>
          </button>
        </div>
      </div>

      {/* 3A. Sacred Herd Grid View */}
      {mainTab === "herd" && (
        <div className="space-y-4">
          {/* Gaushala Filter Pills Strip */}
          {currentRole === "manager" ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-forest-soft border border-forest/20 rounded-md text-[12.5px] text-forest">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="shrink-0 text-forest" />
                <div>
                  <span className="font-semibold text-ink">
                    {assignedGosala} Shed
                  </span>
                  <span className="text-ink-faint text-[11.5px] ml-2">
                    · Exclusively managing on-site cattle (
                    {filteredAnimals.length} sacred cows in shed custody)
                  </span>
                </div>
              </div>
              <span className="font-mono text-[10.5px] bg-forest text-white px-2 py-0.5 rounded font-semibold self-start sm:self-auto">
                1:1 Custodian Lock Active
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-[12px]">
              <div className="flex items-center gap-1.5 shrink-0 text-ink-faint font-medium">
                <Building2 size={13} className="text-forest" />
                <span>Shelter:</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveGosalaFilter("ALL")}
                className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                  activeGosalaFilter === "ALL"
                    ? "bg-forest text-white shadow-xs font-semibold"
                    : "bg-card border border-line text-ink-soft hover:text-ink"
                }`}
              >
                All Shelters ({animals.length})
              </button>
              {gosalas.map((g) => {
                const count = animals.filter(
                  (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
                ).length
                const isSelected =
                  activeGosalaFilter.toLowerCase() === g.name.toLowerCase()
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setActiveGosalaFilter(isSelected ? "ALL" : g.name)
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-saffron text-white shadow-xs font-semibold"
                        : "bg-card border border-line text-ink-soft hover:text-ink"
                    }`}
                  >
                    <span>{g.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-paper-deep text-ink-faint"
                      }`}
                    >
                      {count}
                    </span>
                    {isSelected && <X size={12} className="ml-0.5" />}
                  </button>
                )
              })}
            </div>
          )}

          {filteredAnimals.length === 0 ? (
            <Panel className="p-8 text-center bg-card">
              <div className="w-12 h-12 rounded-full bg-forest-soft/30 text-forest mx-auto flex items-center justify-center mb-3">
                <Building2 size={24} />
              </div>
              <h3 className="font-serif text-[16px] text-ink font-semibold">
                No Resident Cattle Found
              </h3>
              <p className="text-[12.5px] text-ink-faint mt-1 max-w-sm mx-auto">
                {currentRole === "manager"
                  ? `No cattle currently found under "${assignedGosala}". You can register new cattle directly to this shelter.`
                  : activeGosalaFilter !== "ALL"
                  ? `No cattle currently housed under "${activeGosalaFilter}". You can register new cattle directly to this shelter.`
                  : "No animals matched your search criteria."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                {(currentRole === "manager" || activeGosalaFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setGosala(currentRole === "manager" ? assignedGosala : activeGosalaFilter)
                      setAddStep(1)
                      setShowAddModal(true)
                    }}
                    className="inline-flex items-center gap-1.5 bg-saffron text-white px-3 py-1.5 rounded text-[12px] font-medium hover:bg-saffron-deep transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>
                      Register Cow in{" "}
                      {currentRole === "manager"
                        ? assignedGosala
                        : activeGosalaFilter}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (currentRole !== "manager") {
                      setActiveGosalaFilter("ALL")
                    }
                    setSearchQuery("")
                  }}
                  className="px-3 py-1.5 rounded border border-line bg-card text-ink text-[12px] hover:bg-paper-deep transition-colors cursor-pointer"
                >
                  {currentRole === "manager" ? "Clear Search" : "Clear Filters"}
                </button>
              </div>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredAnimals.map((a) => {
                const tripCount = bookings.filter(
                  (b) =>
                    b.animal.toLowerCase() === a.name.toLowerCase() &&
                    b.status !== "Rejected",
                ).length
                return (
                  <AnimalCard
                    key={a.name}
                    a={a}
                    onOpenDossier={openDossier}
                    onEditCow={handleOpenEditCow}
                    recentTripsCount={tripCount}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3B. Empanelled Veterinarians Screen */}
      {mainTab === "vets" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVets.map((v) => {
              const assignedCowsCount = (
                currentRole === "manager" ? filteredAnimals : animals
              ).filter(
                (a) =>
                  a.vetInfo?.doctorName
                    ?.toLowerCase()
                    .includes(v.name.toLowerCase()) ||
                  v.assignedGosalas.includes(a.gosala),
              ).length

                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-md border border-line bg-card space-y-3.5 hover:shadow-md transition-shadow relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-forest-soft text-forest flex items-center justify-center shrink-0 border border-forest/20 mt-0.5">
                          <Stethoscope size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-serif text-[15px] font-bold text-ink leading-tight">
                              {v.name}
                            </h4>
                            <span title="Verified by State Veterinary Council">
                              <BadgeCheck
                                size={15}
                                className="text-forest shrink-0"
                              />
                            </span>
                          </div>
                          <p className="text-[11.5px] text-ink-soft font-medium">
                            {v.qualification}
                          </p>
                          <div className="inline-flex items-center gap-1 font-mono text-[10.5px] text-forest font-semibold mt-0.5 bg-forest-soft/60 px-1.5 py-0.5 rounded">
                            <span>Reg: {v.regNo}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          onClick={() => handleOpenAddVet(v)}
                          className="p-1.5 text-ink-faint hover:text-ink hover:bg-paper rounded transition-colors cursor-pointer"
                          title="Edit Doctor Details"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteVet(v.id, v.name)}
                          className="p-1.5 text-ink-faint hover:text-danger hover:bg-paper rounded transition-colors cursor-pointer"
                          title="Remove Doctor"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11.5px] border-t border-line/50 pt-2.5 text-ink-soft">
                      <div className="flex items-center gap-2">
                        <Building2
                          size={13}
                          className="text-ink-faint shrink-0"
                        />
                        <span className="truncate">{v.clinic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin
                          size={13}
                          className="text-saffron-deep shrink-0"
                        />
                        <span className="truncate">{v.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award size={13} className="text-forest shrink-0" />
                        <span className="truncate font-medium text-ink">
                          {v.specialization}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-line/50 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {v.emergency24x7 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            24x7 On-Call
                          </span>
                        ) : (
                          <span className="text-ink-faint bg-paper px-2 py-0.5 rounded-full">
                            Routine Hours
                          </span>
                        )}
                        <span className="text-ink-faint">
                          · {assignedCowsCount} cattle supervised
                        </span>
                      </div>

                      <a
                        href={`tel:${v.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-forest font-semibold hover:bg-forest-soft rounded transition-colors"
                      >
                        <Phone size={12} />
                        <span>{v.phone}</span>
                      </a>
                    </div>
                  </div>
                )
              })}

            {/* + Empanel New Vet Card CTA */}
            <button
              type="button"
              onClick={() => handleOpenAddVet()}
              className="p-6 rounded-md border-2 border-dashed border-line hover:border-forest hover:bg-forest-soft/10 transition flex flex-col items-center justify-center text-center gap-2 text-ink-faint hover:text-forest min-h-[190px] cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-forest-soft text-forest flex items-center justify-center">
                <Plus size={22} />
              </div>
              <div>
                <div className="font-semibold text-[13.5px] text-ink">
                  Empanel New Bovine Doctor
                </div>
                <div className="text-[11px] text-ink-faint max-w-xs mt-0.5">
                  Register a state council certified veterinary surgeon to this
                  Gaushala medical panel
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 4. Comprehensive Cow Welfare & Seva Dossier Modal */}
      {selectedAnimal && selectedAnimalDossier && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-ink/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-md shadow-2xl w-full max-w-3xl my-0 sm:my-auto overflow-hidden flex flex-col max-h-[92vh] pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            {/* Header: Photo, Name & Emergency Call Button */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-line bg-card shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src={selectedAnimal.photo}
                  alt={selectedAnimal.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-line shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-[19px] text-ink font-bold">
                      {selectedAnimal.name}
                    </h3>
                    <Tag tone={statusToneMap[selectedAnimal.status] || "ok"}>
                      {selectedAnimal.status}
                    </Tag>
                  </div>
                  <p className="text-[12px] text-ink-faint">
                    {selectedAnimal.breed || selectedAnimal.type} ·{" "}
                    {selectedAnimal.gosala} · {selectedAnimal.age}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditCow(selectedAnimal)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium bg-card border border-line rounded text-ink hover:bg-paper-deep transition-colors shadow-xs cursor-pointer"
                  title="Edit Cow Details & Welfare Profile"
                >
                  <Edit2 size={13} className="text-saffron-deep" />
                  <span className="hidden sm:inline">Edit Cow Details</span>
                </button>
                <a
                  href={`tel:${selectedAnimalDossier.vetInfo.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium bg-forest text-white rounded hover:opacity-90 transition-opacity shadow-xs"
                  title="Call Assigned Veterinary Doctor"
                >
                  <Phone size={13} />
                  <span className="hidden sm:inline">Call Vet Doctor</span>
                </a>
                <button
                  onClick={() => setSelectedAnimal(null)}
                  className="text-ink-faint hover:text-ink p-1 rounded transition-colors ml-1 cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-line bg-card px-5 gap-2 overflow-x-auto shrink-0 scrollbar-none">
              {[
                { id: "history", label: "7-Day Seva & Rest Log", icon: Clock },
                { id: "vet", label: "Vet Doctor & Health", icon: Stethoscope },
                { id: "diet", label: "Diet & Grass Nutrition", icon: Droplets },
                {
                  id: "rules",
                  label: "Welfare Rules & Status",
                  icon: ShieldCheck,
                },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-1.5 py-3 text-[12.5px] font-medium border-b-2 transition-colors whitespace-nowrap px-1 ${
                    activeTab === id
                      ? "border-saffron text-saffron-deep font-semibold"
                      : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Sacred Bovine Passport & Identity Strip */}
              <div className="p-3.5 rounded bg-card border border-line/80 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-line/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-semibold text-forest bg-forest-soft px-2 py-0.5 rounded border border-forest/20">
                      Govt. Pashu Aadhaar: {selectedAnimal.tagId || "IN-MH-12-8491"}
                    </span>
                    <span className="text-[11px] text-ink-faint font-medium">
                      Breed:{" "}
                      <strong className="text-ink">
                        {selectedAnimal.breed || selectedAnimal.type}
                      </strong>
                    </span>
                    <span className="text-[11px] text-ink-faint font-medium">
                      Lactation:{" "}
                      <strong className="text-ink">
                        {selectedAnimal.lactationStatus ||
                          "Dry / Resting (Non-Lactating)"}
                      </strong>
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenEditCow(selectedAnimal)}
                    className="text-[11.5px] text-saffron-deep hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>Edit Profile Details</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] text-ink-soft pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-saffron shrink-0" />
                    <span>
                      <strong>Sacred Marks:</strong>{" "}
                      {selectedAnimal.sacredMarks ||
                        "Shrivatsa curl on forehead (Auspicious)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck size={12} className="text-forest shrink-0" />
                    <span>
                      <strong>Temperament:</strong>{" "}
                      {selectedAnimal.temperament ||
                        "Extremely Gentle with Children & Elders"}
                    </span>
                  </div>
                </div>

                {selectedAnimal.customDetails &&
                  selectedAnimal.customDetails.length > 0 && (
                    <div className="pt-2 border-t border-line/60 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-ink-faint font-semibold mr-1">
                        Custom Specs:
                      </span>
                      {selectedAnimal.customDetails.map((cd) => (
                        <span
                          key={cd.id}
                          className="inline-flex items-center gap-1 text-[11px] bg-paper-deep px-2 py-0.5 rounded border border-line text-ink"
                        >
                          <strong className="text-forest font-medium">
                            {cd.label}:
                          </strong>
                          <span>{cd.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
              </div>
              {/* TAB 1: 7-DAY SEVA & REST LOG */}
              {activeTab === "history" && (
                <div className="space-y-4">
                  {/* Last 7 Days Workload & Rest Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded border border-line bg-card">
                      <div className="text-[11px] text-ink-faint font-medium">
                        Sevas Completed
                      </div>
                      <div className="text-[18px] font-serif font-bold text-ink mt-0.5">
                        {selectedAnimalDossier.totalSevas} Visits
                      </div>
                      <div className="text-[10px] text-ink-faint">
                        Past 7 days
                      </div>
                    </div>

                    <div className="p-3 rounded border border-line bg-card">
                      <div className="text-[11px] text-ink-faint font-medium">
                        Ceremonial Time
                      </div>
                      <div className="text-[18px] font-serif font-bold text-ink mt-0.5">
                        {selectedAnimalDossier.totalHours} hrs
                      </div>
                      <div className="text-[10px] text-ink-faint">
                        Home puja duties
                      </div>
                    </div>

                    <div className="p-3 rounded border border-line bg-card">
                      <div className="text-[11px] text-ink-faint font-medium">
                        Road Travel
                      </div>
                      <div className="text-[18px] font-serif font-bold text-ink mt-0.5">
                        {selectedAnimalDossier.totalDistanceKm} km
                      </div>
                      <div className="text-[10px] text-ink-faint">
                        Smooth padded vehicle
                      </div>
                    </div>

                    <div className="p-3 rounded border border-line bg-card">
                      <div className="text-[11px] text-ink-faint font-medium">
                        Rest Accumulated
                      </div>
                      <div className="text-[18px] font-serif font-bold text-forest mt-0.5">
                        {selectedAnimalDossier.restHours} hrs
                      </div>
                      <div className="text-[10px] text-forest font-medium">
                        100% Cooldown compliant
                      </div>
                    </div>
                  </div>

                  {/* Seva Chronological History List */}
                  <div className="border border-line rounded bg-card overflow-hidden">
                    <div className="px-4 py-2.5 bg-paper/60 border-b border-line flex items-center justify-between text-[12px] font-semibold text-ink">
                      <span>Trip Log & Sacred Welfare Records</span>
                      <span className="text-ink-faint font-normal text-[11px]">
                        Click any trip to inspect complete details
                      </span>
                    </div>

                    {selectedAnimalDossier.bookings.length === 0 ? (
                      <div className="p-8 text-center text-ink-faint space-y-1">
                        <HeartPulse size={24} className="text-forest mx-auto" />
                        <p className="font-serif text-[14px] text-ink">
                          No Home Visits in Past 7 Days
                        </p>
                        <p className="text-[11.5px]">
                          {selectedAnimal.name} is resting peacefully in the
                          Gaushala shed.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-line/60">
                        {selectedAnimalDossier.bookings.map((b) => (
                          <div
                            key={b.id}
                            onClick={() => setSelectedTrip(b)}
                            className="p-3.5 hover:bg-paper-deep/60 transition-colors cursor-pointer group"
                            title="Click to view complete trip dossier"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="text-[13.5px] text-ink font-semibold flex items-center gap-2">
                                  <span className="group-hover:text-saffron-deep transition-colors">
                                    {b.customer}
                                  </span>
                                  <span className="text-[11px] font-normal text-saffron-deep font-sans">
                                    ·{" "}
                                    {b.ritualPurpose || "Griha Pravesh & Puja"}
                                  </span>
                                </div>
                                <div className="text-[11.5px] text-ink-faint flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="font-mono text-ink-soft">
                                    {b.date} ({b.start}–{b.end})
                                  </span>
                                  <span>•</span>
                                  <span>{b.distanceKm} km transit</span>
                                  <span>•</span>
                                  <span className="truncate max-w-[240px]">
                                    {b.address}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="inline-flex items-center gap-1 text-[10.5px] bg-forest-soft text-forest px-2 py-0.5 rounded font-medium">
                                  <Check size={11} /> 90m Rest Completed
                                </span>
                                <span className="text-[11.5px] text-saffron-deep font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                  <span>Details</span>
                                  <ChevronRight size={13} />
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: VET DOCTOR & HEALTH HISTORY */}
              {activeTab === "vet" && (
                <div className="space-y-4">
                  {/* Doctor Card with Edit Toggle */}
                  <div className="p-4 rounded border border-line bg-card flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded bg-forest-soft text-forest shrink-0 mt-0.5">
                          <Stethoscope size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif text-[16px] text-ink font-bold">
                              {selectedAnimalDossier.vetInfo.doctorName}
                            </h4>
                            <span className="text-[10.5px] font-mono bg-paper-deep text-ink-soft px-1.5 py-0.5 rounded border border-line">
                              {selectedAnimalDossier.vetInfo.regNo}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-ink-faint mt-0.5">
                            {selectedAnimalDossier.vetInfo.qualification} ·{" "}
                            {selectedAnimalDossier.vetInfo.clinic}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-ink-soft mt-1.5 flex-wrap">
                            <span>
                              Last Checkup:{" "}
                              <strong>
                                {selectedAnimalDossier.vetInfo.lastVisit}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Next Due:{" "}
                              <strong className="text-saffron-deep">
                                {selectedAnimalDossier.vetInfo.nextDue}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={() => setIsEditingVet(!isEditingVet)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium border border-line bg-card hover:bg-paper-deep text-ink rounded transition-colors shadow-2xs"
                        >
                          <Edit2 size={13} className="text-saffron-deep" />
                          <span>
                            {isEditingVet ? "Cancel" : "Edit Vet Details"}
                          </span>
                        </button>
                        <a
                          href={`tel:${selectedAnimalDossier.vetInfo.phone}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11.5px] font-medium bg-forest text-white rounded hover:opacity-95 transition-opacity shadow-xs"
                        >
                          <Phone size={13} />
                          <span>Call Doctor</span>
                        </a>
                      </div>
                    </div>

                    {/* Inline Edit Vet Form */}
                    {isEditingVet && (
                      <form
                        onSubmit={handleSaveVetDetails}
                        className="mt-3 pt-3 border-t border-line space-y-3 bg-paper-deep/60 p-3.5 rounded"
                      >
                        <div className="font-semibold text-[13px] text-ink flex items-center gap-1.5">
                          <Edit2 size={14} className="text-saffron-deep" />
                          <span>Update Veterinary & Clinical Vitals</span>
                        </div>

                        {/* Empanelled Doctor Quick Select Dropdown */}
                        <div className="bg-card border border-line rounded p-2.5">
                          <label className="block text-[11.5px] font-semibold text-ink mb-1">
                            Choose from Empanelled Roster (1-Click Auto-Fill)
                          </label>
                          <select
                            onChange={(e) => {
                              const doc = vets.find(
                                (x) => x.id === e.target.value,
                              )
                              if (doc) {
                                setVetForm({
                                  ...vetForm,
                                  doctorName: doc.name,
                                  qualification: doc.qualification,
                                  phone: doc.phone,
                                  clinic: `${doc.clinic}, ${doc.address}`,
                                  regNo: doc.regNo,
                                })
                              }
                            }}
                            className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                          >
                            <option value="">
                              -- Select Certified Doctor from Roster --
                            </option>
                            {vets.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {doc.name} · {doc.qualification} ({doc.clinic} -
                                Reg: {doc.regNo})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                          <div>
                            <label className="block text-ink-faint font-medium mb-1">
                              Veterinary Doctor Name
                            </label>
                            <input
                              type="text"
                              value={vetForm.doctorName}
                              onChange={(e) =>
                                setVetForm({
                                  ...vetForm,
                                  doctorName: e.target.value,
                                })
                              }
                              className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest"
                            />
                          </div>

                          <div>
                            <label className="block text-ink-faint font-medium mb-1">
                              Emergency Phone Number
                            </label>
                            <input
                              type="text"
                              value={vetForm.phone}
                              onChange={(e) =>
                                setVetForm({
                                  ...vetForm,
                                  phone: e.target.value,
                                })
                              }
                              className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-ink-faint font-medium mb-1">
                              Veterinary Clinic / Hospital
                            </label>
                            <input
                              type="text"
                              value={vetForm.clinic}
                              onChange={(e) =>
                                setVetForm({
                                  ...vetForm,
                                  clinic: e.target.value,
                                })
                              }
                              className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest"
                            />
                          </div>

                          <div>
                            <label className="block text-ink-faint font-medium mb-1">
                              Council Registration No.
                            </label>
                            <input
                              type="text"
                              value={vetForm.regNo}
                              onChange={(e) =>
                                setVetForm({
                                  ...vetForm,
                                  regNo: e.target.value,
                                })
                              }
                              className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-ink-faint font-medium mb-1">
                              Last Examination Date
                            </label>
                            <input
                              type="text"
                              value={vetForm.lastVisit}
                              onChange={(e) =>
                                setVetForm({
                                  ...vetForm,
                                  lastVisit: e.target.value,
                                })
                              }
                              placeholder="e.g. 26 Sep 2026"
                              className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest"
                            />
                          </div>

                          <div>
                            <label className="block text-ink-faint font-medium mb-1">
                              Next Due Routine Checkup
                            </label>
                            <input
                              type="text"
                              value={vetForm.nextDue}
                              onChange={(e) =>
                                setVetForm({
                                  ...vetForm,
                                  nextDue: e.target.value,
                                })
                              }
                              placeholder="e.g. 26 Oct 2026"
                              className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest"
                            />
                          </div>
                        </div>

                        {/* Vitals inputs */}
                        <div className="pt-2 border-t border-line/60">
                          <label className="block text-[11.5px] font-semibold text-ink mb-1.5">
                            Certified Clinical Vitals
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
                            <div>
                              <span className="text-ink-faint block text-[10.5px]">
                                Body Temp
                              </span>
                              <input
                                type="text"
                                value={vetForm.vitals?.temp || "38.5°C"}
                                onChange={(e) =>
                                  setVetForm({
                                    ...vetForm,
                                    vitals: {
                                      temp: e.target.value,
                                      heartRate:
                                        vetForm.vitals?.heartRate || "64 bpm",
                                      respiration:
                                        vetForm.vitals?.respiration ||
                                        "22 /min",
                                      rumen:
                                        vetForm.vitals?.rumen || "3 / 2min",
                                    },
                                  })
                                }
                                className="w-full bg-card border border-line rounded px-2 py-1 text-ink font-mono text-[12px]"
                              />
                            </div>
                            <div>
                              <span className="text-ink-faint block text-[10.5px]">
                                Heart Rate
                              </span>
                              <input
                                type="text"
                                value={vetForm.vitals?.heartRate || "64 bpm"}
                                onChange={(e) =>
                                  setVetForm({
                                    ...vetForm,
                                    vitals: {
                                      temp: vetForm.vitals?.temp || "38.5°C",
                                      heartRate: e.target.value,
                                      respiration:
                                        vetForm.vitals?.respiration ||
                                        "22 /min",
                                      rumen:
                                        vetForm.vitals?.rumen || "3 / 2min",
                                    },
                                  })
                                }
                                className="w-full bg-card border border-line rounded px-2 py-1 text-ink font-mono text-[12px]"
                              />
                            </div>
                            <div>
                              <span className="text-ink-faint block text-[10.5px]">
                                Respiration
                              </span>
                              <input
                                type="text"
                                value={vetForm.vitals?.respiration || "22 /min"}
                                onChange={(e) =>
                                  setVetForm({
                                    ...vetForm,
                                    vitals: {
                                      temp: vetForm.vitals?.temp || "38.5°C",
                                      heartRate:
                                        vetForm.vitals?.heartRate || "64 bpm",
                                      respiration: e.target.value,
                                      rumen:
                                        vetForm.vitals?.rumen || "3 / 2min",
                                    },
                                  })
                                }
                                className="w-full bg-card border border-line rounded px-2 py-1 text-ink font-mono text-[12px]"
                              />
                            </div>
                            <div>
                              <span className="text-ink-faint block text-[10.5px]">
                                Deworming
                              </span>
                              <input
                                type="text"
                                value={vetForm.dewormingDate || "15 Sep 2026"}
                                onChange={(e) =>
                                  setVetForm({
                                    ...vetForm,
                                    dewormingDate: e.target.value,
                                  })
                                }
                                className="w-full bg-card border border-line rounded px-2 py-1 text-ink text-[12px]"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingVet(false)}
                            className="px-3 py-1.5 text-[12px] border border-line rounded bg-card text-ink-soft hover:bg-paper"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium bg-forest text-white rounded hover:opacity-95 shadow-xs"
                          >
                            <Save size={13} /> Save Vet Records
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Clinical Vital Signs Display */}
                  <div>
                    <h5 className="text-[12.5px] font-semibold text-ink mb-2">
                      Recent Clinical Vitals (Certified Normal)
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        [
                          "Body Temperature",
                          selectedAnimalDossier.vetInfo.vitals?.temp ||
                            "38.5°C",
                          "Normal 38.0–39.0°C",
                        ],
                        [
                          "Heart Rate",
                          selectedAnimalDossier.vetInfo.vitals?.heartRate ||
                            "64 bpm",
                          "Normal 60–80 bpm",
                        ],
                        [
                          "Respiration",
                          selectedAnimalDossier.vetInfo.vitals?.respiration ||
                            "22 /min",
                          "Calm & steady",
                        ],
                        [
                          "Rumen Motility",
                          selectedAnimalDossier.vetInfo.vitals?.rumen ||
                            "3 / 2min",
                          "Healthy digestion",
                        ],
                      ].map(([title, val, sub]) => (
                        <div
                          key={title}
                          className="p-3 rounded border border-line bg-card"
                        >
                          <div className="text-[10px] uppercase font-mono tracking-wider text-ink-faint">
                            {title}
                          </div>
                          <div className="text-[15px] font-bold text-ink mt-0.5 font-mono">
                            {val}
                          </div>
                          <div className="text-[10px] text-forest font-medium">
                            {sub}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vaccination & Preventive Care Records */}
                  <div>
                    <h5 className="text-[12.5px] font-semibold text-ink mb-2">
                      Vaccination & Preventive Healthcare Schedule
                    </h5>
                    <div className="border border-line rounded bg-card divide-y divide-line">
                      {[
                        {
                          name: "Foot & Mouth Disease (FMD)",
                          date: "14 Jul 2026",
                          expiry: "Valid till Jul 2027",
                          status: "Vaccinated",
                          dose: "6ml s/c (Govt. Batch 881)",
                        },
                        {
                          name: "Black Quarter (BQ) & HS Vaccine",
                          date: "02 Aug 2026",
                          expiry: "Valid till Aug 2027",
                          status: "Vaccinated",
                          dose: "5ml s/c Polyvalent",
                        },
                        {
                          name: "Routine Deworming (Albendazole)",
                          date:
                            selectedAnimalDossier.vetInfo.dewormingDate ||
                            "15 Sep 2026",
                          expiry: "Next due 15 Dec 2026",
                          status: "Completed",
                          dose: "3g Bolus orally",
                        },
                        {
                          name: "Hoof Trimming & Oil Conditioning",
                          date:
                            selectedAnimalDossier.vetInfo.hoofCareDate ||
                            "20 Sep 2026",
                          expiry: "Next due 20 Nov 2026",
                          status: "Completed",
                          dose: "Clean hooves & gentle gait",
                        },
                      ].map((v) => (
                        <div
                          key={v.name}
                          className="p-3 flex items-center justify-between gap-2 text-[12px]"
                        >
                          <div>
                            <div className="font-semibold text-ink flex items-center gap-1.5">
                              <CheckCircle2 size={13} className="text-forest" />
                              <span>{v.name}</span>
                            </div>
                            <div className="text-[11px] text-ink-faint mt-0.5">
                              Given on {v.date} · {v.dose}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10.5px] font-medium bg-forest-soft text-forest px-2 py-0.5 rounded">
                              {v.status}
                            </span>
                            <div className="text-[10px] text-ink-faint mt-0.5">
                              {v.expiry}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DIET & GRASS NUTRITION */}
              {activeTab === "diet" && (
                <div className="space-y-4">
                  {/* Daily Diet Composition */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded border border-line bg-card space-y-2">
                      <div className="flex items-center gap-2 text-forest font-semibold text-[13.5px]">
                        <Droplets size={16} />
                        <span>Fresh Green Grass & Fodder</span>
                      </div>
                      <p className="text-[12px] text-ink-soft leading-relaxed">
                        • <strong>Green Fodder:</strong>{" "}
                        {selectedAnimalDossier.dietInfo.greenFodder}
                      </p>
                      <p className="text-[12px] text-ink-soft leading-relaxed">
                        • <strong>Dry Roughage:</strong>{" "}
                        {selectedAnimalDossier.dietInfo.dryRoughage}
                      </p>
                    </div>

                    <div className="p-4 rounded border border-line bg-card space-y-2">
                      <div className="flex items-center gap-2 text-saffron-deep font-semibold text-[13.5px]">
                        <Sparkles size={16} />
                        <span>Concentrated Mash & Minerals</span>
                      </div>
                      <p className="text-[12px] text-ink-soft leading-relaxed">
                        • <strong>Concentrate Mix:</strong>{" "}
                        {selectedAnimalDossier.dietInfo.concentrateMix}
                      </p>
                      <p className="text-[12px] text-ink-soft leading-relaxed">
                        • <strong>Feeding Schedule:</strong>{" "}
                        {selectedAnimalDossier.dietInfo.feedingTimes}
                      </p>
                    </div>
                  </div>

                  {/* Water & Post-Trip Hydration Protocol */}
                  <div className="p-4 rounded border border-line bg-card">
                    <h5 className="font-semibold text-[13px] text-ink mb-1.5 flex items-center gap-1.5">
                      <Droplets size={15} className="text-forest" />
                      <span>Hydration & Post-Seva Care Protocol</span>
                    </h5>
                    <div className="text-[12px] text-ink-soft space-y-1.5 leading-relaxed">
                      <p>
                        • <strong>Daily Fresh Water:</strong>{" "}
                        {selectedAnimalDossier.dietInfo.waterIntakeLiters}
                      </p>
                      <p>
                        • <strong>Post-Seva Recovery:</strong>{" "}
                        {selectedAnimalDossier.dietInfo.postTripCare}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: WELFARE RULES & STATUS */}
              {activeTab === "rules" && (
                <form onSubmit={handleSaveStatus} className="space-y-4">
                  {/* Status Selector */}
                  <div>
                    <label className="block text-[12.5px] font-medium text-ink mb-2">
                      Operational Health Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          id: "Available",
                          label: "Available",
                          desc: "Healthy & ready for seva",
                        },
                        {
                          id: "Resting Buffer",
                          label: "Resting Cooldown",
                          desc: "Mandatory post-trip rest",
                        },
                        {
                          id: "Vet Care",
                          label: "Vet Inspection",
                          desc: "Precautionary health hold",
                        },
                        {
                          id: "Heat Hold",
                          label: "Heat Hold",
                          desc: "Midday thermal protection",
                        },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setTargetStatus(s.id as any)}
                          className={`text-left p-2.5 rounded border transition-all ${
                            targetStatus === s.id
                              ? "border-saffron bg-saffron/10 ring-1 ring-saffron"
                              : "border-line bg-card hover:border-line-strong"
                          }`}
                        >
                          <div className="text-[12.5px] font-medium text-ink">
                            {s.label}
                          </div>
                          <div className="text-[11px] text-ink-faint mt-0.5">
                            {s.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Welfare Threshold Settings */}
                  <div className="bg-paper-deep rounded p-3.5 border border-line space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-[13.5px] text-ink font-semibold flex items-center gap-1.5">
                        <Clock size={14} className="text-saffron" />
                        <span>Resting Buffer Duration (Starts at 30 mins)</span>
                      </span>
                      <span className="font-mono text-[12.5px] text-saffron-deep font-bold bg-card px-2 py-0.5 rounded border border-line">
                        {cooldownMinutes} mins
                      </span>
                    </div>

                    <input
                      type="range"
                      min={30}
                      max={180}
                      step={15}
                      value={cooldownMinutes}
                      onChange={(e) =>
                        setCooldownMinutes(Number(e.target.value))
                      }
                      className="w-full accent-saffron h-2 bg-card rounded-lg cursor-pointer"
                    />

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line/60">
                      <div>
                        <label className="block text-[11.5px] font-medium text-ink mb-1">
                          Daily Seva Ceiling
                        </label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((trips) => (
                            <button
                              key={trips}
                              type="button"
                              onClick={() => setCustomDailyLimit(trips)}
                              className={`flex-1 py-1 text-[11.5px] font-mono rounded border transition-all ${
                                customDailyLimit === trips
                                  ? "bg-forest text-white font-semibold border-forest"
                                  : "bg-card border-line text-ink-soft hover:text-ink"
                              }`}
                            >
                              {trips}
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] text-ink-faint mt-1 block">
                          {customDailyLimit === 1
                            ? "1 trip (Calves/Seniors)"
                            : `Max ${customDailyLimit} trips/day`}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11.5px] font-medium text-ink mb-1">
                          <span>Transit Radius Cap</span>
                          <span className="font-mono text-ink font-semibold">
                            ≤ {customRadius} km
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={35}
                          step={1}
                          value={customRadius}
                          onChange={(e) =>
                            setCustomRadius(Number(e.target.value))
                          }
                          className="w-full accent-forest h-2 bg-card rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clinical Remarks Input */}
                  <div>
                    <label className="block text-[12.5px] font-medium text-ink mb-1">
                      Clinical Remarks & Caretaker Notes
                    </label>
                    <textarea
                      rows={2}
                      value={statusRemark}
                      onChange={(e) => setStatusRemark(e.target.value)}
                      placeholder="e.g. Fresh green grass fed, hooves clear, post-seva rest complete..."
                      className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setSelectedAnimal(null)}
                      className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-saffron text-white rounded hover:bg-saffron-deep transition-colors shadow-xs"
                    >
                      <Check size={15} /> Save & Broadcast Status
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Specific Trip Details Modal (Triggered by Clicking Any Trip) */}
      {selectedTrip && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-md shadow-2xl w-full max-w-lg overflow-hidden my-0 sm:my-auto animate-slide-up sm:animate-scale-in pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-line bg-card">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-saffron-soft text-saffron-deep">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-[17px] text-ink font-bold">
                      Trip {selectedTrip.id}
                    </h3>
                    <StatusPill status={selectedTrip.status} />
                  </div>
                  <p className="text-[11.5px] text-ink-faint">
                    {selectedTrip.ritualPurpose || "Ceremonial Puja"} ·{" "}
                    {selectedTrip.animal}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-[12px] max-h-[75vh] overflow-y-auto">
              {/* Devotee Info */}
              <div className="p-3.5 rounded bg-card border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink text-[13px]">
                    {selectedTrip.customer}
                  </span>
                  <a
                    href={`tel:${selectedTrip.phone}`}
                    className="inline-flex items-center gap-1 text-forest font-medium hover:underline text-[11.5px]"
                  >
                    <Phone size={11} />
                    <span>{selectedTrip.phone}</span>
                  </a>
                </div>
                <div className="flex items-center gap-3 text-ink-faint text-[11px] flex-wrap">
                  <span>
                    Ritual:{" "}
                    <strong className="text-ink">
                      {selectedTrip.ritualPurpose || "Griha Pravesh"}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Aadhaar:{" "}
                    <strong className="text-ink">
                      {selectedTrip.aadhaarNumber || "XXXX-XXXX-4819"}
                    </strong>{" "}
                    (Verified ✓)
                  </span>
                </div>
                <div className="text-ink-soft text-[11.5px] flex items-center gap-1.5 pt-1 border-t border-line/50">
                  <MapPin size={13} className="text-saffron-deep shrink-0" />
                  <span>{selectedTrip.address}</span>
                </div>
              </div>

              {/* Timing & Logistics */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded bg-card border border-line">
                  <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                    Date & Timing
                  </div>
                  <div className="font-semibold text-ink mt-0.5">
                    {selectedTrip.date}
                  </div>
                  <div className="text-saffron-deep font-mono text-[11.5px]">
                    {selectedTrip.start} – {selectedTrip.end}
                  </div>
                </div>
                <div className="p-3 rounded bg-card border border-line">
                  <div className="text-[10.5px] text-ink-faint uppercase font-mono">
                    Transit Distance
                  </div>
                  <div className="font-semibold text-ink mt-0.5">
                    {selectedTrip.distanceKm} km
                  </div>
                  <div className="text-forest text-[11px]">
                    Padded cattle carrier
                  </div>
                </div>
              </div>

              {/* Assigned Staff */}
              <div className="p-3 rounded bg-card border border-line space-y-1.5 text-[11.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">
                    Assigned Transporter / Driver:
                  </span>
                  <span className="font-medium text-ink">
                    {selectedTrip.driver || "Sunil Pawar (Tata 407 carrier)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Gosevak Caretaker:</span>
                  <span className="font-medium text-ink">
                    {selectedAnimal?.assignedHandler || "Rameshwar Shastri"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Cattle Deployed:</span>
                  <span className="font-medium text-saffron-deep">
                    {selectedTrip.animal} ({selectedTrip.animalType})
                  </span>
                </div>
              </div>

              {/* Welfare Handover & 90-Min Cooldown Status */}
              <div className="p-3.5 rounded bg-forest-soft/60 border border-forest/30 space-y-2">
                <div className="flex items-center gap-1.5 text-forest font-semibold text-[12.5px]">
                  <ShieldCheck size={15} />
                  <span>Animal Welfare Handover Record</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-ink-soft">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-forest shrink-0" />
                    <span>
                      Gate 1 Pre-Departure Clearance:{" "}
                      <strong>Verified Safe & Fed</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-forest shrink-0" />
                    <span>
                      Gate 2 Homecoming Health Intake:{" "}
                      <strong>Hooves & respiration clear</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-800 shrink-0" />
                    <span>
                      Post-Trip Recovery:{" "}
                      <strong>
                        90-minute resting cooldown completed in stall
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Dakshina & Financial Receipt */}
              <div className="p-3.5 rounded bg-card border border-line space-y-1.5">
                <div className="flex items-center justify-between text-ink-faint text-[11px]">
                  <span>Base Seva Dakshina</span>
                  <span className="font-mono text-ink">
                    {inr(selectedTrip.base)}
                  </span>
                </div>
                {selectedTrip.extraTime > 0 && (
                  <div className="flex items-center justify-between text-ink-faint text-[11px]">
                    <span>Extra Time Fee</span>
                    <span className="font-mono text-ink">
                      {inr(selectedTrip.extraTime)}
                    </span>
                  </div>
                )}
                {selectedTrip.transport > 0 && (
                  <div className="flex items-center justify-between text-ink-faint text-[11px]">
                    <span>Transport Fee</span>
                    <span className="font-mono text-ink">
                      {inr(selectedTrip.transport)}
                    </span>
                  </div>
                )}
                {selectedTrip.addons > 0 && (
                  <div className="flex items-center justify-between text-ink-faint text-[11px]">
                    <span>Puja Samagri Addons</span>
                    <span className="font-mono text-ink">
                      {inr(selectedTrip.addons)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-ink-faint text-[11px]">
                  <span>GST (12%)</span>
                  <span className="font-mono text-ink">
                    {inr(selectedTrip.tax)}
                  </span>
                </div>
                <div className="pt-2 border-t border-line flex items-center justify-between font-semibold text-[13px] text-ink">
                  <span>Total Dakshina Received</span>
                  <span className="font-mono text-forest">
                    {inr(selectedTrip.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-line bg-card flex justify-end">
              <button
                onClick={() => setSelectedTrip(null)}
                className="px-4 py-2 text-[12px] font-medium bg-paper border border-line rounded text-ink hover:bg-paper-deep transition-colors"
              >
                Close Trip Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Add Sacred Animal Modal (100% Dynamic & Comprehensive) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-ink/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-md shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-line bg-card sticky top-0 z-10">
              <div>
                <h3 className="font-serif text-[18px] text-ink font-semibold">
                  Register Sacred Cattle
                </h3>
                <p className="text-[12px] text-ink-faint">
                  Step {addStep} of 2 ·{" "}
                  {addStep === 1
                    ? "Identity & Welfare Guardrails"
                    : "Veterinary Doctor & Diet Nutrition"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setAddStep(1)
                }}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleAddAnimal}
              className="p-5 space-y-4 text-[12.5px]"
            >
              {addStep === 1 ? (
                <>
                  {/* Step 1: Basic Identity & Breed */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Animal Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Kamadhenu, Surabhi, Nandi"
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Pashu Aadhaar RFID Ear Tag
                      </label>
                      <input
                        type="text"
                        value={tagId}
                        onChange={(e) => setTagId(e.target.value)}
                        placeholder="e.g. IN-MH-12-8491"
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink font-mono outline-none focus:border-forest transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CustomizableSelect
                      label="Sacred Breed"
                      value={breed}
                      onChange={setBreed}
                      options={CATTLE_BREEDS}
                      customPlaceholder="Enter custom sacred breed (e.g. Malvi, Kankrej)..."
                      actionLabel="+ Customize / Other Breed..."
                    />

                    <CustomizableSelect
                      label="Lactation / Life Stage Status"
                      value={lactationStatus}
                      onChange={setLactationStatus}
                      options={LACTATION_STATUSES}
                      customPlaceholder="Enter custom milking / lactation status..."
                      actionLabel="+ Customize Milking Status..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Cattle Classification / Type
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as AnimalType)}
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition font-medium"
                      >
                        <option value="Cow">Cow (Gau Mata)</option>
                        <option value="Cow & Calf">Cow & Calf Pair (Gau-Vatsa Jodi)</option>
                        <option value="Calf">Calf (Vatsa)</option>
                        <option value="Bull">Bull (Nandi)</option>
                        <option value="Buffalo">Buffalo (Mahishi / Sacred Buffalo)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Life Stage & Age Category (Smart Preset)
                      </label>
                      <select
                        value={selectedAgePresetLabel}
                        onChange={(e) => handleSelectAgePreset(e.target.value)}
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition font-medium text-forest"
                      >
                        {AGE_PRESETS.map((p) => (
                          <option key={p.label} value={p.label}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    {currentRole === "manager" ? (
                      <div>
                        <label className="block text-[12px] font-medium text-ink mb-1">
                          Gaushala Shelter Location
                        </label>
                        <div className="w-full bg-forest-soft/40 border border-forest/20 rounded px-3 py-2 text-[13px] text-forest font-semibold flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={14} className="text-forest" />
                            <span>{assignedGosala}</span>
                          </div>
                          <span className="text-[10px] font-mono text-ink-faint font-normal">
                            (Dedicated Shelter Lock)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <CustomizableSelect
                        label="Gaushala Shelter Location"
                        value={gosala}
                        onChange={setGosala}
                        options={dynamicGosalaOptions}
                        customPlaceholder="Enter custom gaushala sanctuary..."
                        actionLabel="+ Customize / Other Gaushala..."
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink-faint mb-1">
                        Age
                      </label>
                      <input
                        type="text"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink-faint mb-1">
                        Weight
                      </label>
                      <input
                        type="text"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink-faint mb-1">
                        Height
                      </label>
                      <input
                        type="text"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CustomizableSelect
                      label="Ceremonial Category"
                      value={category}
                      onChange={setCategory}
                      options={CEREMONIAL_CATEGORIES}
                      customPlaceholder="Enter custom ceremonial seva category..."
                      actionLabel="+ Customize Category..."
                    />
                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Base Dakshina (₹)
                      </label>
                      <select
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition font-mono"
                      >
                        <option value="2800">
                          ₹2,800 (Calf / Blessing Seva)
                        </option>
                        <option value="3500">
                          ₹3,500 (Standard Puja & Griha Pravesh)
                        </option>
                        <option value="4500">
                          ₹4,500 (Special Temple & Utsav Seva)
                        </option>
                        <option value="5100">
                          ₹5,100 (Grand Vedic Havan & Mahapuja)
                        </option>
                      </select>
                    </div>
                  </div>

                  <CustomizableSelect
                    label="Assigned Gosevak Caretaker"
                    value={handler}
                    onChange={setHandler}
                    options={GOSEVAK_HANDLERS}
                    customPlaceholder="Enter custom gosevak caretaker..."
                    actionLabel="+ Customize / Assign New Gosevak..."
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CustomizableSelect
                      label="Devotee Temperament & Behavior Fit"
                      value={temperament}
                      onChange={setTemperament}
                      options={TEMPERAMENT_PRESETS}
                      customPlaceholder="Enter custom devotee temperament..."
                      actionLabel="+ Customize Temperament..."
                      selectClassName="text-[12.5px]"
                    />

                    <CustomizableSelect
                      label="Auspicious Sacred Marks"
                      value={sacredMarks}
                      onChange={setSacredMarks}
                      options={SACRED_MARKS_PRESETS}
                      customPlaceholder="Enter custom sacred mark..."
                      actionLabel="+ Customize Sacred Mark..."
                      selectClassName="text-[12.5px]"
                    />
                  </div>

                  <BovinePhotoUploader
                    currentPhoto={photo}
                    photos={addPhotos}
                    onPhotoChange={setPhoto}
                    onPhotosChange={setAddPhotos}
                    label="Sacred Cattle Photographs (Multi-Angle Gallery)"
                    helperText="Upload multiple photos (face & horns, tilak mark, grazing pasture, mother-calf) shown to devotees when booking"
                  />

                  <div className="flex justify-end gap-3 pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-[12px] border border-line rounded text-ink-soft hover:bg-paper-deep"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddStep(2)}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:opacity-95 shadow-xs"
                    >
                      <span>Next: Vet & Diet Details</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Veterinary & Diet Nutrition Setup */}
                  <div className="p-3.5 rounded bg-forest-soft/40 border border-forest/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-ink flex items-center gap-1.5 text-[13px]">
                        <Stethoscope size={15} className="text-forest" />
                        <span>Assigned Veterinary Doctor</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenAddVet()}
                        className="text-[11px] font-semibold text-forest hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>+ Empanel New Vet</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11.5px] text-ink-faint mb-1">
                        Select Certified Doctor from Empanelled Roster *
                      </label>
                      <select
                        value={selectedVetDoctorId}
                        onChange={(e) => handleSelectVetDoctor(e.target.value)}
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                      >
                        {vets.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} · {v.qualification} ({v.clinic} - Reg:{" "}
                            {v.regNo})
                          </option>
                        ))}
                        <option value="NEW_VET">
                          + Register / Empanel New Doctor...
                        </option>
                      </select>
                    </div>

                    {/* Quick Selected Doctor Preview Card */}
                    <div className="p-2.5 rounded bg-paper border border-line/60 grid grid-cols-2 gap-2 text-[11.5px]">
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Assigned Doctor
                        </span>
                        <span className="font-semibold text-ink">
                          {addVetDocName}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Council Reg No
                        </span>
                        <span className="font-mono text-forest font-semibold">
                          {addVetRegNo} (Verified ✓)
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Hospital / Clinic
                        </span>
                        <span className="truncate block text-ink">
                          {addVetClinic}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Emergency Contact
                        </span>
                        <span className="font-mono text-forest">
                          {addVetPhone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded bg-saffron-soft/30 border border-saffron/30 space-y-3">
                    <div className="font-semibold text-ink flex items-center gap-1.5 text-[13px]">
                      <Droplets size={15} className="text-saffron-deep" />
                      <span>Grass, Diet & Daily Nutrition</span>
                    </div>

                    <div>
                      <label className="block text-[11.5px] text-ink-faint mb-1">
                        Standardized Nutrition Regime Preset *
                      </label>
                      <select
                        value={selectedDietPresetId}
                        onChange={(e) => handleSelectDietPreset(e.target.value)}
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition font-medium text-saffron-deep"
                      >
                        {DIET_PRESETS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2.5 text-[12px]">
                      <div>
                        <label className="block text-[11px] text-ink-faint mb-1">
                          Green Grass & Fresh Fodder
                        </label>
                        <input
                          type="text"
                          value={addGreenGrass}
                          onChange={(e) => setAddGreenGrass(e.target.value)}
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-faint mb-1">
                          Dry Roughage & Straw
                        </label>
                        <input
                          type="text"
                          value={addDryRoughage}
                          onChange={(e) => setAddDryRoughage(e.target.value)}
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-faint mb-1">
                          Concentrate Mash & Minerals
                        </label>
                        <input
                          type="text"
                          value={addConcentrateFeed}
                          onChange={(e) =>
                            setAddConcentrateFeed(e.target.value)
                          }
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-ink-faint mb-1">
                            Daily Water Intake
                          </label>
                          <select
                            value={addWaterIntake}
                            onChange={(e) => setAddWaterIntake(e.target.value)}
                            className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                          >
                            <option value="50–60 Liters fresh filtered water daily (ad-libitum)">
                              50–60 L/day (Standard Cow)
                            </option>
                            <option value="65–75 Liters clean water daily">
                              65–75 L/day (Lactating High-Yield)
                            </option>
                            <option value="40–45 Liters clean lukewarm water with digestive seeds">
                              40–45 L/day (Senior Cattle)
                            </option>
                            <option value="15–20 Liters fresh lukewarm water">
                              15–20 L/day (Calf)
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-ink-faint mb-1">
                            Feeding Times Schedule
                          </label>
                          <select
                            value={addFeedingTimes}
                            onChange={(e) => setAddFeedingTimes(e.target.value)}
                            className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                          >
                            <option value="06:30 AM (Green Fodder), 12:30 PM (Concentrate Mash), 06:00 PM (Dry Roughage)">
                              3 Times Daily (Morning, Noon, Evening)
                            </option>
                            <option value="06:00 AM, 12:00 PM, 05:30 PM">
                              3 Times Daily (High-Yield schedule)
                            </option>
                            <option value="07:00 AM, 01:00 PM, 06:30 PM">
                              4 Times Daily (Calf schedule)
                            </option>
                            <option value="07:00 AM, 01:00 PM, 06:00 PM">
                              Gentle Senior Schedule
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setAddStep(1)}
                      className="px-4 py-2 text-[12px] border border-line rounded text-ink-soft hover:bg-paper-deep"
                    >
                      ← Back to Step 1
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-saffron text-white rounded hover:bg-saffron-deep transition-colors shadow-xs"
                    >
                      <Check size={15} /> Save & Register Cattle
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 7. Dedicated Add/Edit Vet Details Modal */}
      {showAddVetModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-ink/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-md shadow-2xl w-full max-w-lg my-0 sm:my-auto overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-line bg-card">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-forest-soft text-forest">
                  <Stethoscope size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-[17px] text-ink font-bold">
                    {editingVet
                      ? "Edit Empanelled Veterinarian"
                      : "Empanel Certified Bovine Doctor"}
                  </h3>
                  <p className="text-[11.5px] text-ink-faint">
                    Accredited veterinary surgeon for livestock welfare &
                    medical certification
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddVetModal(false)
                  setEditingVet(null)
                }}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSaveVet}
              className="p-5 space-y-3.5 text-[12.5px]"
            >
              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Doctor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={vetName}
                  onChange={(e) => setVetName(e.target.value)}
                  placeholder="e.g. Dr. Rajeshwari Shinde"
                  className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Medical Qualification
                  </label>
                  <select
                    value={vetQualification}
                    onChange={(e) => setVetQualification(e.target.value)}
                    className="w-full bg-card border border-line rounded px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-forest"
                  >
                    <option value="B.V.Sc & A.H., M.V.Sc (Bovine Medicine)">
                      B.V.Sc & A.H., M.V.Sc (Bovine Medicine)
                    </option>
                    <option value="M.V.Sc (Veterinary Surgery & Radiology)">
                      M.V.Sc (Veterinary Surgery)
                    </option>
                    <option value="B.V.Sc & A.H., Cattle Welfare Specialist">
                      B.V.Sc & A.H. (Livestock Welfare)
                    </option>
                    <option value="M.V.Sc (Animal Reproduction & Gynec)">
                      M.V.Sc (Animal Reproduction)
                    </option>
                    <option value="Ph.D. Veterinary Science & Bovine Care">
                      Ph.D. Veterinary Science
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Council Registration No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={vetRegNo}
                    onChange={(e) => setVetRegNo(e.target.value)}
                    placeholder="e.g. MH-VET-6280"
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Hospital / Polyclinic *
                  </label>
                  <input
                    type="text"
                    required
                    value={vetClinic}
                    onChange={(e) => setVetClinic(e.target.value)}
                    placeholder="e.g. Central Veterinary Hospital, Hyderabad"
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Emergency Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={vetPhone}
                    onChange={(e) => setVetPhone(e.target.value)}
                    placeholder="e.g. +91 98224 88910"
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Clinic Address / Area
                  </label>
                  <input
                    type="text"
                    value={vetAddress}
                    onChange={(e) => setVetAddress(e.target.value)}
                    placeholder="e.g. Kondapur, Hyderabad"
                    className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Assigned Gaushala
                  </label>
                  <select
                    value={vetAssignedGosala}
                    onChange={(e) => setVetAssignedGosala(e.target.value)}
                    className="w-full bg-card border border-line rounded px-2.5 py-2 text-[16px] sm:text-[12.5px] text-ink outline-none focus:border-forest"
                  >
                    {dynamicGosalaOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value="All Gaushalas">
                      All Gaushalas (Regional Panel)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">
                  Clinical Specialization Focus
                </label>
                <select
                  value={vetSpecialization}
                  onChange={(e) => setVetSpecialization(e.target.value)}
                  className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
                >
                  <option value="Bovine Health, Vaccination & Ultrasound">
                    Bovine Health, Vaccination & Ultrasound
                  </option>
                  <option value="Surgical Care & Lameness/Hoof Care">
                    Surgical Care & Lameness/Hoof Care
                  </option>
                  <option value="Lactation Welfare, Nutrition & Post-Natal Care">
                    Lactation Welfare, Nutrition & Post-Natal Care
                  </option>
                  <option value="Calf Neonatal & Pediatrics">
                    Calf Neonatal & Pediatrics
                  </option>
                  <option value="Emergency Bovine Critical Care">
                    Emergency Bovine Critical Care
                  </option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-ink select-none">
                  <input
                    type="checkbox"
                    checked={vetEmergency}
                    onChange={(e) => setVetEmergency(e.target.checked)}
                    className="rounded border-line text-forest focus:ring-forest w-4 h-4"
                  />
                  <span className="font-medium">
                    Available for 24x7 Emergency Calls & Highway Transport Holds
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddVetModal(false)
                    setEditingVet(null)
                  }}
                  className="px-4 py-2 text-[12px] border border-line rounded text-ink-soft hover:bg-paper-deep cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:opacity-95 shadow-xs cursor-pointer"
                >
                  <Check size={14} />
                  <span>{editingVet ? "Save Changes" : "Empanel Doctor"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Dedicated Edit Sacred Cattle Modal (100% Dynamic & Dropdown-First) */}
      {showEditCowModal && editingCow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-ink/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-md shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-line bg-card sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <img
                  src={editPhoto || editingCow.photo}
                  alt={editName}
                  className="w-10 h-10 rounded-full object-cover border border-line shrink-0"
                />
                <div>
                  <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                    <span>Edit Cattle: {editingCow.name}</span>
                    <span className="text-[11px] font-sans font-normal text-ink-faint">
                      ({editingCow.breed || editingCow.type})
                    </span>
                  </h3>
                  <p className="text-[12px] text-ink-faint">
                    Step {editStep} of 2 ·{" "}
                    {editStep === 1
                      ? "Sacred Identity & Biological Profile"
                      : "Veterinary Doctor, Diet & Welfare Guardrails"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditCowModal(false)
                  setEditingCow(null)
                  setEditStep(1)
                }}
                className="text-ink-faint hover:text-ink p-1 rounded transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSaveEditCow}
              className="p-5 space-y-4 text-[12.5px]"
            >
              {editStep === 1 ? (
                <>
                  {/* Step 1: Sacred Identity & Breed */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Cattle Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g. Gauri, Lakshmi, Nandi"
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Pashu Aadhaar RFID Ear Tag
                      </label>
                      <input
                        type="text"
                        value={editTagId}
                        onChange={(e) => setEditTagId(e.target.value)}
                        placeholder="e.g. IN-MH-12-8491"
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink font-mono outline-none focus:border-forest transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <CustomizableSelect
                      label="Sacred Breed"
                      value={editBreed}
                      onChange={setEditBreed}
                      options={CATTLE_BREEDS}
                      customPlaceholder="Enter custom sacred breed..."
                      actionLabel="+ Customize / Other Breed..."
                    />

                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Cattle Life Stage / Type
                      </label>
                      <select
                        value={editType}
                        onChange={(e) =>
                          setEditType(e.target.value as AnimalType)
                        }
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition"
                      >
                        <option value="Cow">Cow (Gau Mata)</option>
                        <option value="Cow & Calf">Cow & Calf Pair (Gau-Vatsa Jodi)</option>
                        <option value="Calf">Calf (Vatsa)</option>
                        <option value="Bull">Bull (Nandi)</option>
                        <option value="Buffalo">Buffalo (Mahishi / Sacred Buffalo)</option>
                      </select>
                    </div>

                    {currentRole === "manager" ? (
                      <div>
                        <label className="block text-[12px] font-medium text-ink mb-1">
                          Gaushala Location
                        </label>
                        <div className="w-full bg-forest-soft/40 border border-forest/20 rounded px-3 py-2 text-[13px] text-forest font-semibold flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={14} className="text-forest" />
                            <span>{assignedGosala}</span>
                          </div>
                          <span className="text-[10px] font-mono text-ink-faint font-normal">
                            (Dedicated Shelter Lock)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <CustomizableSelect
                        label="Gaushala Location"
                        value={editGosala}
                        onChange={setEditGosala}
                        options={dynamicGosalaOptions}
                        customPlaceholder="Enter custom gaushala..."
                        actionLabel="+ Customize / Other Gaushala..."
                      />
                    )}
                  </div>

                  {/* Physical & Biological Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink-faint mb-1">
                        Age
                      </label>
                      <input
                        type="text"
                        value={editAge}
                        onChange={(e) => setEditAge(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink-faint mb-1">
                        Weight
                      </label>
                      <input
                        type="text"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-medium text-ink-faint mb-1">
                        Height
                      </label>
                      <input
                        type="text"
                        value={editHeight}
                        onChange={(e) => setEditHeight(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                      />
                    </div>
                  </div>

                  {/* Lactation & Devotee Temperament */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CustomizableSelect
                      label="Lactation / Milking Status"
                      value={editLactation}
                      onChange={setEditLactation}
                      options={LACTATION_STATUSES}
                      customPlaceholder="Enter custom milking / lactation status..."
                      actionLabel="+ Customize Milking Status..."
                    />

                    <CustomizableSelect
                      label="Devotee Temperament & Behavior"
                      value={editTemperament}
                      onChange={setEditTemperament}
                      options={TEMPERAMENT_PRESETS}
                      customPlaceholder="Enter custom devotee temperament..."
                      actionLabel="+ Customize Temperament..."
                      selectClassName="text-[12.5px]"
                    />
                  </div>

                  {/* Auspicious Sacred Marks */}
                  <CustomizableSelect
                    label="Auspicious Sacred Marks & Vedic Traits"
                    value={editSacredMarks}
                    onChange={setEditSacredMarks}
                    options={SACRED_MARKS_PRESETS}
                    customPlaceholder="Enter custom sacred mark..."
                    actionLabel="+ Customize Sacred Mark..."
                    selectClassName="text-[12.5px]"
                  />

                  {/* Ceremonial Category & Pricing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CustomizableSelect
                      label="Ceremonial Category"
                      value={editCategory}
                      onChange={setEditCategory}
                      options={CEREMONIAL_CATEGORIES}
                      customPlaceholder="Enter custom ceremonial seva category..."
                      actionLabel="+ Customize Category..."
                    />

                    <div>
                      <label className="block text-[12px] font-medium text-ink mb-1">
                        Base Dakshina (₹)
                      </label>
                      <select
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[13px] text-ink outline-none focus:border-forest transition font-mono"
                      >
                        <option value="2800">
                          ₹2,800 (Calf / Blessing Seva)
                        </option>
                        <option value="3500">
                          ₹3,500 (Standard Puja & Griha Pravesh)
                        </option>
                        <option value="4500">
                          ₹4,500 (Special Temple & Utsav Seva)
                        </option>
                        <option value="5100">
                          ₹5,100 (Grand Vedic Havan & Mahapuja)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Assigned Gosevak Caretaker */}
                  <CustomizableSelect
                    label="Assigned Gosevak Caretaker"
                    value={editHandler}
                    onChange={setEditHandler}
                    options={GOSEVAK_HANDLERS}
                    customPlaceholder="Enter custom gosevak caretaker..."
                    actionLabel="+ Customize / Assign New Gosevak..."
                  />

                  {/* Bovine Photo Uploader */}
                  <BovinePhotoUploader
                    currentPhoto={editPhoto}
                    photos={editPhotos}
                    onPhotoChange={setEditPhoto}
                    onPhotosChange={setEditPhotos}
                    label="Sacred Cattle Photographs (Multi-Angle Gallery)"
                    helperText="Upload multiple photos (face & horns, tilak mark, grazing pasture, mother-calf) shown to devotees when booking"
                  />

                  <div className="flex justify-end gap-3 pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditCowModal(false)
                        setEditingCow(null)
                      }}
                      className="px-4 py-2 text-[12px] border border-line rounded text-ink-soft hover:bg-paper-deep cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditStep(2)}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:opacity-95 shadow-xs cursor-pointer"
                    >
                      <span>Next: Vet, Diet & Rules</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Operational Status & Welfare Rules */}
                  <div className="p-3.5 rounded bg-card border border-line space-y-3">
                    <div className="font-semibold text-ink flex items-center gap-1.5 text-[13px]">
                      <ShieldCheck size={15} className="text-forest" />
                      <span>Operational Status & Welfare Guardrails</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11.5px] text-ink-faint mb-1">
                          Operational Status
                        </label>
                        <select
                          value={editStatus}
                          onChange={(e) =>
                            setEditStatus(
                              e.target.value as AnimalOperationalStatus,
                            )
                          }
                          className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                        >
                          <option value="Available">Available for Seva</option>
                          <option value="Resting Buffer">
                            Resting Buffer (90m Post-Trip)
                          </option>
                          <option value="In Transit">In Transit</option>
                          <option value="In Seva">In Seva Ritual</option>
                          <option value="Vet Care">
                            Vet Care (Medical Hold)
                          </option>
                          <option value="Heat Hold">
                            Heat Hold (Weather / High Temp)
                          </option>
                          <option value="Recovering">
                            Recovering / Sanitarium
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11.5px] text-ink-faint mb-1">
                          Max Daily Seva Limit
                        </label>
                        <select
                          value={editMaxDailyTrips}
                          onChange={(e) =>
                            setEditMaxDailyTrips(Number(e.target.value))
                          }
                          className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                        >
                          <option value={1}>
                            1 Seva / Day (Calf / Gentle Mode)
                          </option>
                          <option value={2}>
                            2 Sevas / Day (Maximum Standard)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11.5px] text-ink-faint mb-1">
                          Transit Radius (km)
                        </label>
                        <select
                          value={editMaxRadiusKm}
                          onChange={(e) =>
                            setEditMaxRadiusKm(Number(e.target.value))
                          }
                          className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                        >
                          <option value={8}>≤ 8 km (Calf / Short range)</option>
                          <option value={15}>≤ 15 km (Moderate)</option>
                          <option value={20}>≤ 20 km (Standard City)</option>
                          <option value={25}>≤ 25 km (Extended)</option>
                          <option value={30}>≤ 30 km (Maximum limit)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11.5px] text-ink-faint mb-1">
                          Post-Trip Cooldown
                        </label>
                        <select
                          value={editCooldownMinutes}
                          onChange={(e) =>
                            setEditCooldownMinutes(Number(e.target.value))
                          }
                          className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest"
                        >
                          <option value={60}>60 Minutes</option>
                          <option value={90}>90 Minutes (Standard)</option>
                          <option value={120}>120 Minutes (Extended)</option>
                          <option value={150}>150 Minutes</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Assigned Veterinary Doctor */}
                  <div className="p-3.5 rounded bg-forest-soft/40 border border-forest/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-ink flex items-center gap-1.5 text-[13px]">
                        <Stethoscope size={15} className="text-forest" />
                        <span>Assigned Veterinary Doctor</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenAddVet()}
                        className="text-[11px] font-semibold text-forest hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>+ Empanel New Vet</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11.5px] text-ink-faint mb-1">
                        Select Certified Doctor from Empanelled Roster *
                      </label>
                      <select
                        value={editVetDoctorId}
                        onChange={(e) =>
                          handleSelectEditVetDoctor(e.target.value)
                        }
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition"
                      >
                        {vets.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} · {v.qualification} ({v.clinic} - Reg:{" "}
                            {v.regNo})
                          </option>
                        ))}
                        <option value="NEW_VET">
                          + Register / Empanel New Doctor...
                        </option>
                      </select>
                    </div>

                    {/* Quick Selected Doctor Preview Card */}
                    <div className="p-2.5 rounded bg-paper border border-line/60 grid grid-cols-2 gap-2 text-[11.5px]">
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Assigned Doctor
                        </span>
                        <span className="font-semibold text-ink">
                          {editVetDocName}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Council Reg No
                        </span>
                        <span className="font-mono text-forest font-semibold">
                          {editVetRegNo} (Verified ✓)
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Hospital / Clinic
                        </span>
                        <span className="truncate block text-ink">
                          {editVetClinic}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-faint block text-[10px] uppercase font-mono">
                          Emergency Contact
                        </span>
                        <span className="font-mono text-forest">
                          {editVetPhone}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Grass, Diet & Daily Nutrition */}
                  <div className="p-3.5 rounded bg-saffron-soft/30 border border-saffron/30 space-y-3">
                    <div className="font-semibold text-ink flex items-center gap-1.5 text-[13px]">
                      <Droplets size={15} className="text-saffron-deep" />
                      <span>Grass, Diet & Daily Nutrition</span>
                    </div>

                    <div>
                      <label className="block text-[11.5px] text-ink-faint mb-1">
                        Standardized Nutrition Regime Preset *
                      </label>
                      <select
                        value={editDietPresetId}
                        onChange={(e) =>
                          handleSelectEditDietPreset(e.target.value)
                        }
                        className="w-full bg-card border border-line rounded px-3 py-2 text-[12.5px] text-ink outline-none focus:border-forest transition font-medium text-saffron-deep"
                      >
                        {DIET_PRESETS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2.5 text-[12px]">
                      <div>
                        <label className="block text-[11px] text-ink-faint mb-1">
                          Green Grass & Fresh Fodder
                        </label>
                        <input
                          type="text"
                          value={editGreenGrass}
                          onChange={(e) => setEditGreenGrass(e.target.value)}
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-faint mb-1">
                          Dry Roughage & Straw
                        </label>
                        <input
                          type="text"
                          value={editDryRoughage}
                          onChange={(e) => setEditDryRoughage(e.target.value)}
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-faint mb-1">
                          Concentrate Mash & Minerals
                        </label>
                        <input
                          type="text"
                          value={editConcentrateFeed}
                          onChange={(e) =>
                            setEditConcentrateFeed(e.target.value)
                          }
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-ink-faint mb-1">
                            Daily Water Intake
                          </label>
                          <select
                            value={editWaterIntake}
                            onChange={(e) => setEditWaterIntake(e.target.value)}
                            className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                          >
                            <option value="50–60 Liters fresh filtered water daily (ad-libitum)">
                              50–60 L/day (Standard Cow)
                            </option>
                            <option value="65–75 Liters clean water daily">
                              65–75 L/day (Lactating High-Yield)
                            </option>
                            <option value="40–45 Liters clean lukewarm water with digestive seeds">
                              40–45 L/day (Senior Cattle)
                            </option>
                            <option value="15–20 Liters fresh lukewarm water">
                              15–20 L/day (Calf)
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-ink-faint mb-1">
                            Feeding Times Schedule
                          </label>
                          <select
                            value={editFeedingTimes}
                            onChange={(e) =>
                              setEditFeedingTimes(e.target.value)
                            }
                            className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                          >
                            <option value="06:30 AM (Green Fodder), 12:30 PM (Concentrate Mash), 06:00 PM (Dry Roughage)">
                              3 Times Daily (Morning, Noon, Evening)
                            </option>
                            <option value="06:00 AM, 12:00 PM, 05:30 PM">
                              3 Times Daily (High-Yield schedule)
                            </option>
                            <option value="07:00 AM, 01:00 PM, 06:30 PM">
                              4 Times Daily (Calf schedule)
                            </option>
                            <option value="07:00 AM, 01:00 PM, 06:00 PM">
                              Gentle Senior Schedule
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-ink-faint mb-1">
                        Clinical Health & Demeanor Notes
                      </label>
                      <textarea
                        rows={2}
                        value={editHealthNotes}
                        onChange={(e) => setEditHealthNotes(e.target.value)}
                        placeholder="Vitals normal, alert demeanor, clear hooves..."
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-ink outline-none focus:border-forest text-[12px]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setEditStep(1)}
                      className="px-4 py-2 text-[12px] border border-line rounded text-ink-soft hover:bg-paper-deep cursor-pointer"
                    >
                      ← Back to Step 1
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-saffron text-white rounded hover:bg-saffron-deep transition-colors shadow-xs cursor-pointer"
                    >
                      <Save size={14} />
                      <span>Save & Update Cattle Details</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
