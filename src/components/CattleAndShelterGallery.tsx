import React, { useState, useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Building2,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Phone,
  Camera,
  Layers,
} from "lucide-react"
import type { Animal } from "../data/animals"
import { useStore, type Gosala } from "../store/store"
import { GOSALA_PHOTO_PRESETS } from "../data/gosalas"
import { gosalas as customerGosalas, gosalaDetails } from "../data/customer"

interface CattleAndShelterGalleryProps {
  animal: Animal
  gosalaName?: string
  initialCategory?: "animal" | "shelter"
  className?: string
  onSelectPhoto?: (url: string) => void
  onBack?: () => void
}

export default function CattleAndShelterGallery({
  animal,
  gosalaName,
  initialCategory = "animal",
  className = "",
  onSelectPhoto,
  onBack,
}: CattleAndShelterGalleryProps) {
  const { gosalas: storeGosalas } = useStore()
  const [activeCategory, setActiveCategory] = useState<"animal" | "shelter">(
    initialCategory,
  )
  const [animalIdx, setAnimalIdx] = useState(0)
  const [shelterIdx, setShelterIdx] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // 1. Resolve Sacred Animal Photos
  const animalPhotos = useMemo(() => {
    if (animal.photos && animal.photos.length > 0) {
      return animal.photos
    }
    return [animal.photo]
  }, [animal])

  // 2. Resolve Gaushala Shelter & Photos
  const effectiveGosalaName = gosalaName || animal.gosala
  const matchedStoreGosala = useMemo(() => {
    return storeGosalas.find(
      (g) => g.name.toLowerCase() === effectiveGosalaName.toLowerCase(),
    )
  }, [storeGosalas, effectiveGosalaName])

  const matchedCustomerGosala = useMemo(() => {
    return (
      customerGosalas.find(
        (cg) => cg.name.toLowerCase() === effectiveGosalaName.toLowerCase(),
      ) ?? customerGosalas[0]
    )
  }, [effectiveGosalaName])

  const shelterPhotos = useMemo(() => {
    if (
      matchedStoreGosala?.photos &&
      matchedStoreGosala.photos.length > 0
    ) {
      return matchedStoreGosala.photos
    }
    if (matchedStoreGosala?.photo) {
      return [matchedStoreGosala.photo]
    }
    const custDetail = matchedCustomerGosala?.id ? gosalaDetails[matchedCustomerGosala.id] : undefined
    if (custDetail?.gallery && custDetail.gallery.length > 0) {
      return custDetail.gallery
    }
    if (matchedCustomerGosala?.photo) {
      return [matchedCustomerGosala.photo]
    }
    return [GOSALA_PHOTO_PRESETS[0].url]
  }, [matchedStoreGosala, matchedCustomerGosala])

  // Current active photos list & index
  const activePhotos =
    activeCategory === "animal" ? animalPhotos : shelterPhotos
  const activeIdx = activeCategory === "animal" ? animalIdx : shelterIdx
  const setActiveIdx =
    activeCategory === "animal" ? setAnimalIdx : setShelterIdx

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setActiveIdx((prev) => (prev > 0 ? prev - 1 : activePhotos.length - 1))
  }

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setActiveIdx((prev) => (prev < activePhotos.length - 1 ? prev + 1 : 0))
  }

  const handleThumbnailClick = (idx: number) => {
    setActiveIdx(idx)
    if (onSelectPhoto) {
      onSelectPhoto(activePhotos[idx])
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. Category Switcher Tabs */}
      <div className="flex items-center justify-between gap-2 p-1 bg-paper-deep border border-line rounded-md text-[12px]">
        <div className="flex items-center gap-1 flex-1">
          <button
            type="button"
            onClick={() => {
              setActiveCategory("animal")
              if (onSelectPhoto) onSelectPhoto(animalPhotos[animalIdx])
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded transition cursor-pointer font-medium ${
              activeCategory === "animal"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Sparkles size={13} className="text-saffron-deep shrink-0" />
            <span className="truncate">
              Sacred Cow ({animalPhotos.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory("shelter")
              if (onSelectPhoto) onSelectPhoto(shelterPhotos[shelterIdx])
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded transition cursor-pointer font-medium ${
              activeCategory === "shelter"
                ? "bg-card text-forest shadow-xs font-semibold"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Building2 size={13} className="text-forest shrink-0" />
            <span className="truncate">
              Shelter Premises ({shelterPhotos.length})
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          className="p-1.5 text-ink-soft hover:text-ink rounded bg-card/60 border border-line transition cursor-pointer shrink-0"
          title="Full-screen Lightbox"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* 2. Main Photo Showcase with Chevrons & Overlay */}
      <div
        onClick={() => setIsLightboxOpen(true)}
        className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-lg overflow-hidden bg-paper-deep border border-line shadow-xs group cursor-zoom-in"
      >
        <img
          src={activePhotos[activeIdx] || animal.photo}
          alt={
            activeCategory === "animal"
              ? `${animal.name} - Photo ${activeIdx + 1}`
              : `${effectiveGosalaName} - Facility Photo ${activeIdx + 1}`
          }
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between text-white text-[11px] pointer-events-none">
          <div className="flex items-center gap-1.5">
            {onBack && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onBack()
                }}
                className="pointer-events-auto p-1.5 rounded-full bg-black/65 hover:bg-black/90 backdrop-blur-md border border-white/30 text-white transition cursor-pointer shadow-md"
                title="Go back"
                aria-label="Back"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <span className="font-mono px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20">
              {activeCategory === "animal"
                ? `${animal.breed || animal.type} · ${animal.name}`
                : `${effectiveGosalaName} Sanctuary`}
            </span>
          </div>

          <span className="font-mono px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20">
            {activeIdx + 1} / {activePhotos.length}
          </span>
        </div>

        {/* Navigation Arrows */}
        {activePhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition cursor-pointer border border-white/20 shadow-md opacity-80 sm:opacity-0 group-hover:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition cursor-pointer border border-white/20 shadow-md opacity-80 sm:opacity-0 group-hover:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Bottom Caption & Tap hint */}
        <div className="absolute bottom-2.5 inset-x-3 flex items-end justify-between gap-2 text-white text-[11.5px] pointer-events-none">
          <div className="drop-shadow-sm font-medium truncate">
            {activeCategory === "animal" ? (
              <span>
                {animal.temperament || "Gentle & Auspicious Ceremonial Demeanour"}
              </span>
            ) : (
              <span>
                AWBI Registered Facility · Approved Pasture &amp; Sheds
              </span>
            )}
          </div>
          <span className="hidden sm:inline text-[10.5px] text-white/80 drop-shadow-xs shrink-0">
            Tap to zoom
          </span>
        </div>
      </div>

      {/* 3. Horizontal Thumbnails Row */}
      {activePhotos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {activePhotos.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => handleThumbnailClick(i)}
              className={`relative h-14 w-18 sm:h-16 sm:w-20 rounded-md overflow-hidden border-2 transition cursor-pointer shrink-0 ${
                i === activeIdx
                  ? activeCategory === "animal"
                    ? "border-saffron ring-2 ring-saffron/30 scale-102"
                    : "border-forest ring-2 ring-forest/30 scale-102"
                  : "border-line opacity-65 hover:opacity-100"
              }`}
            >
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <span className="absolute bottom-0.5 right-1 font-mono text-[9px] text-white drop-shadow-md">
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 4. Gaushala Quick Information & Transparency Strip */}
      <div className="p-3 bg-card border border-line rounded-lg flex items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded bg-forest-soft text-forest flex items-center justify-center shrink-0">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-[13.5px] font-semibold text-ink truncate">
                {effectiveGosalaName}
              </span>
              <span className="text-[9.5px] font-mono font-medium text-forest bg-forest-soft px-1.5 py-0.2 rounded border border-forest/20 shrink-0">
                AWBI Verified
              </span>
            </div>
            <p className="text-[11px] text-ink-faint truncate">
              Resident shelter for {animal.name} ·{" "}
              {shelterPhotos.length} facility photos available
            </p>
          </div>
        </div>

        {activeCategory !== "shelter" && (
          <button
            type="button"
            onClick={() => setActiveCategory("shelter")}
            className="text-[11px] font-medium text-forest hover:text-forest-deep px-2.5 py-1 rounded bg-forest-soft border border-forest/20 transition cursor-pointer shrink-0"
          >
            View Shelter Photos
          </button>
        )}
      </div>

      {/* 5. Full-Screen Devotee Lightbox Modal */}
      {isLightboxOpen && (
        <div
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-fade-in"
        >
          {/* Lightbox Header */}
          <div className="flex items-center justify-between text-white text-[13px] z-10">
            <div>
              <div className="font-serif text-[18px] font-semibold">
                {activeCategory === "animal"
                  ? `${animal.name} (${animal.breed || animal.type})`
                  : effectiveGosalaName}
              </div>
              <p className="text-[11.5px] text-white/70">
                {activeCategory === "animal"
                  ? "Devotee Darshan Gallery"
                  : "Verified Sanctuary Living Conditions & Sheds"}
              </p>
            </div>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Close lightbox"
            >
              <X size={20} />
            </button>
          </div>

          {/* Lightbox Main Image Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex-1 max-h-[78vh] flex items-center justify-center my-auto"
          >
            <img
              src={activePhotos[activeIdx] || animal.photo}
              alt=""
              className="max-h-full max-w-full object-contain rounded-md shadow-2xl"
            />

            {activePhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
                  aria-label="Previous"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
                  aria-label="Next"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>

          {/* Lightbox Footer Thumbnails & Selector */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="space-y-3 z-10"
          >
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("animal")}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition cursor-pointer ${
                  activeCategory === "animal"
                    ? "bg-saffron text-white shadow-sm font-semibold"
                    : "bg-white/15 text-white/80 hover:bg-white/25"
                }`}
              >
                🐄 Cow Photos ({animalPhotos.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("shelter")}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition cursor-pointer ${
                  activeCategory === "shelter"
                    ? "bg-forest text-white shadow-sm font-semibold"
                    : "bg-white/15 text-white/80 hover:bg-white/25"
                }`}
              >
                🏛️ Shelter Photos ({shelterPhotos.length})
              </button>
            </div>

            <div className="flex justify-center gap-2 overflow-x-auto py-1">
              {activePhotos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  onClick={() => setActiveIdx(i)}
                  className={`h-12 w-16 rounded overflow-hidden border-2 transition cursor-pointer ${
                    i === activeIdx
                      ? "border-white scale-105"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
