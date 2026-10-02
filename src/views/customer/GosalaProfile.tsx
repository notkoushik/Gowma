import { useState, useMemo } from "react"
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  Heart,
  Leaf,
  MapPin,
  Phone,
  Shield,
  Sprout,
  Star,
  TreeDeciduous,
  Navigation,
  Calendar,
  Users,
  Mail,
  CheckCircle2,
  Stethoscope,
  Syringe,
  UtensilsCrossed,
} from "lucide-react"
import { gosalaDetails, type GosalaDetail } from "../../data/customer"
import { type Animal } from "../../data/animals"
import { inr } from "../../data/mock"
import { useStore } from "../../store/store"

export function resolveGosalaDetail(
  gosalaId: string,
  storeGosalas: any[],
): GosalaDetail | null {
  if (gosalaDetails[gosalaId]) {
    return gosalaDetails[gosalaId]
  }
  const found = storeGosalas.find(
    (sg) =>
      sg.id === gosalaId ||
      sg.name.toLowerCase() === gosalaId.toLowerCase() ||
      sg.name.toLowerCase().includes(gosalaId.toLowerCase()),
  )
  if (!found) {
    const firstKey = Object.keys(gosalaDetails)[0]
    return gosalaDetails[firstKey] || null
  }

  const name = found.name
  const initials =
    name
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "GS"

  const photo =
    found.photo ||
    "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"
  const gallery =
    found.photos && found.photos.length > 0
      ? found.photos
      : [
          photo,
          "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=600&h=400&fit=crop&auto=format",
        ]

  return {
    id: found.id,
    name: found.name,
    area: found.address || found.region || "Operational Vedic Sanctuary",
    distanceKm: found.distanceKm ?? 6.5,
    rating: found.rating ?? 4.9,
    animals: found.capacity ?? 40,
    photo,
    gallery,
    tagline: "Vedic Cattle Sanctuary · AWBI Registered",
    about: `${found.name} is a dedicated sacred sanctuary committed to traditional Go-seva, welfare ethics, and organic maintenance across ${found.region || "India"}. Every animal is nurtured under Vedic principles with veterinary supervision.`,
    address: found.address || found.region || "Sanctuary Premises",
    phone: found.contactPhone || "+91 98230 44910",
    email: found.email || "trust@gomaa.in",
    managerName: found.managerName || "Rahul Kamble",
    managerInitials: initials,
    yearEstablished: Number(found.establishedYear) || 2024,
    registrationNo: found.trustRegistrationNo || "AWBI/TRUST/IN",
    totalAnimals: found.capacity || 40,
    cowCount: Math.round((found.capacity || 40) * 0.6),
    calfCount: Math.round((found.capacity || 40) * 0.25),
    bullCount: Math.round((found.capacity || 40) * 0.15),
    areaAcres: 5.5,
    serviceHours: "6:00 AM – 7:30 PM (All 7 Days)",
    certifications: [
      {
        label: "AWBI Registered Shelter",
        issuer: "Animal Welfare Board of India",
      },
      {
        label: "Empanelled Veterinary Care",
        issuer: "State Veterinary Council",
      },
    ],
    animalCare: {
      feedSchedule: "6:00 AM & 4:30 PM organic forage & dry straw",
      feedType: "Hydroponic maize, green grass, jaggery & mineral cakes",
      vetVisits: "Twice weekly scheduled inspections + 24/7 on-call triage",
      vaccination: "FMD, Brucellosis, and Hemorrhagic Septicemia certified",
      restPeriod: "Mandatory 90-min cooldown after any sacred darshan or transit",
      grooming: "Daily dawn brush down, neem water bath, and hoof inspection",
    },
    facilities:
      found.facilities && found.facilities.length > 0
        ? found.facilities.map((f: string) => ({
            label: f,
            detail: "Maintained to the highest Gaushala welfare standards",
          }))
        : [
            {
              label: "Padded Cattle Van",
              detail: "Air-ventilated hydraulic lift carrier",
            },
            {
              label: "24/7 Clean Water",
              detail: "Fresh borewell trough",
            },
          ],
    maintenancePractices: [
      "Pure organic feed with ayurvedic herbal mix",
      "Padded bedding with rubber safety matting",
      "Regular hoof cleaning and vet checkups",
    ],
    totalReviews: 24,
    reviews: [
      {
        name: "Suresh Kulkarni",
        initials: "SK",
        rating: 5,
        comment:
          "Exceptional care of sacred cows. Highly recommend for Griha Pravesh sevas.",
        date: "Last week",
      },
    ],
    lat: found.lat,
    lng: found.lng,
  }
}

function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.round(rating)
              ? "text-saffron fill-saffron"
              : "text-line-strong"
          }
        />
      ))}
    </span>
  )
}

function CertBadge({ label, issuer }: { label: string; issuer: string }) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-ok/30 bg-ok-soft/50 p-3">
      <CheckCircle2 size={16} className="text-ok shrink-0 mt-0.5" />
      <div>
        <div className="text-[12.5px] font-medium text-ink">{label}</div>
        <div className="text-[11px] text-ink-faint mt-0.5">{issuer}</div>
      </div>
    </div>
  )
}

/* ── Section heading ──────────────────────────────────── */
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-[17px] text-ink mb-3 mt-6 first:mt-0 flex items-center gap-2">
      {children}
    </h3>
  )
}

/* ── Animal card (within gosala profile) ─────────────── */
function AnimalCard({
  animal,
  onSelect,
}: {
  animal: Animal
  onSelect: (a: Animal) => void
}) {
  return (
    <button
      onClick={() => onSelect(animal)}
      className="w-full text-left rounded-sm border border-line bg-card overflow-hidden hover:border-line-strong transition-colors group"
    >
      <div className="h-32 bg-paper-deep overflow-hidden relative">
        <img
          src={animal.photo}
          alt={animal.name}
          className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
        />
        <span
          className={`absolute top-2 left-2 text-[10px] rounded-full px-2 py-0.5 ${
            animal.status === "Available"
              ? "bg-ok-soft text-ok"
              : animal.status === "Resting Buffer"
                ? "bg-warn-soft text-warn"
                : "bg-saffron-soft text-saffron-deep"
          }`}
        >
          {animal.status}
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[15px] text-ink">{animal.name}</span>
          <span className="font-mono text-[12px] text-ink tabular">
            {inr(animal.price)}
          </span>
        </div>
        <div className="text-[11px] text-ink-faint">
          {animal.type} · {animal.category}
        </div>
      </div>
    </button>
  )
}

/* ── Review card ──────────────────────────────────────── */
function ReviewCard({ review }: { review: GosalaDetail["reviews"][0] }) {
  return (
    <div className="rounded-sm border border-line bg-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-full bg-forest text-white grid place-items-center text-[12px] font-medium shrink-0">
          {review.initials}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-ink">{review.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <StarRow rating={review.rating} size={11} />
            <span className="font-mono text-[10px] text-ink-faint">
              {review.date}
            </span>
          </div>
        </div>
      </div>
      <p className="text-[12.5px] text-ink-soft leading-relaxed">
        {review.comment}
      </p>
    </div>
  )
}

/* ── Tab button ───────────────────────────────────────── */
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-saffron text-saffron-deep"
          : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  )
}

type ProfileTab = "about" | "animals" | "reviews"

/* ═══════════════════════════════════════════════════════
   MOBILE PROFILE
   ═══════════════════════════════════════════════════════ */
export function MobileGosalaProfile({
  gosalaId,
  onBack,
  onSelectAnimal,
}: {
  gosalaId: string
  onBack: () => void
  onSelectAnimal: (a: Animal) => void
}) {
  const { gosalas: storeGosalas, animals: storeAnimals } = useStore()
  const g = useMemo(
    () => resolveGosalaDetail(gosalaId, storeGosalas),
    [gosalaId, storeGosalas],
  )
  const [photoIdx, setPhotoIdx] = useState(0)
  const [tab, setTab] = useState<ProfileTab>("about")

  if (!g) {
    return (
      <div className="p-8 text-center max-w-sm mx-auto my-12 rounded-xl border border-dashed border-line bg-paper-deep/30">
        <h3 className="font-serif text-lg text-ink font-semibold mb-2">Gaushala Not Found</h3>
        <p className="text-xs text-ink-soft mb-5">The selected sanctuary is not available or has not been registered yet.</p>
        <button onClick={onBack} className="px-4 py-2 bg-saffron text-white rounded text-xs font-medium">Return to Directory</button>
      </div>
    )
  }

  const allAnimals = storeAnimals || []
  const gosalaAnimals = allAnimals.filter(
    (a) =>
      a.gosala.toLowerCase() === g.name.toLowerCase() ||
      a.gosala.toLowerCase().includes(g.name.toLowerCase()) ||
      g.name.toLowerCase().includes(a.gosala.toLowerCase()),
  )

  return (
    <div className="pb-28">
      {/* Hero gallery */}
      <div className="relative h-64 bg-paper-deep">
        <img
          src={g.gallery[photoIdx]}
          alt={g.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#201c16]/70 via-transparent to-transparent" />
        <button
          onClick={onBack}
          className="absolute top-3 left-3 h-9 w-9 grid place-items-center rounded-full bg-white/90 backdrop-blur text-ink"
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        {/* Dot navigation */}
        <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5">
          {g.gallery.map((_, i) => (
            <button
              key={i}
              onClick={() => setPhotoIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === photoIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
        {/* Overlay name */}
        <div className="absolute bottom-3 left-4 right-4">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-paper/80">
            {g.tagline}
          </div>
          <h1 className="font-serif text-[24px] text-white leading-tight mt-0.5">
            {g.name}
          </h1>
        </div>
      </div>

      {/* Quick meta row */}
      <div className="px-4 py-3 flex items-center gap-4 border-b border-line">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          <Star size={13} className="text-saffron fill-saffron" />
          <span className="font-medium text-ink">{g.rating}</span>
          <span className="text-ink-faint font-mono text-[11px]">
            ({g.totalReviews})
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft font-mono tabular">
          <Navigation size={12} className="text-ink-faint" /> {g.distanceKm} km
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
          <Clock size={12} className="text-ink-faint" />
          {g.serviceHours.split(",")[0]}
        </span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 border-b border-line">
        {[
          { val: g.totalAnimals.toString(), label: "Animals" },
          { val: g.areaAcres.toString() + " ac", label: "Land" },
          { val: g.yearEstablished.toString(), label: "Est." },
          { val: g.totalReviews.toString(), label: "Reviews" },
        ].map(({ val, label }) => (
          <div
            key={label}
            className="py-3 text-center border-r border-line last:border-r-0"
          >
            <div className="font-mono text-[15px] text-ink tabular">{val}</div>
            <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint mt-0.5">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line overflow-x-auto px-2">
        <TabBtn active={tab === "about"} onClick={() => setTab("about")}>
          About
        </TabBtn>
        <TabBtn active={tab === "animals"} onClick={() => setTab("animals")}>
          Animals ({gosalaAnimals.length})
        </TabBtn>
        <TabBtn active={tab === "reviews"} onClick={() => setTab("reviews")}>
          Reviews ({g.totalReviews})
        </TabBtn>
      </div>

      {/* Tab content */}
      <div className="px-4 py-5 space-y-1">
        {tab === "about" && (
          <>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              {g.about}
            </p>

            {/* Certifications */}
            <Heading>
              <Shield size={15} className="text-ok" />
              Certifications & Trust
            </Heading>
            <div className="space-y-2">
              {g.certifications.map((c) => (
                <CertBadge key={c.label} {...c} />
              ))}
            </div>

            {/* Animal care */}
            <Heading>
              <Heart size={15} className="text-saffron" />
              Animal Care
            </Heading>
            <div className="space-y-2.5">
              {[
                {
                  icon: UtensilsCrossed,
                  label: "Feed schedule",
                  val: g.animalCare.feedSchedule,
                },
                { icon: Leaf, label: "Feed type", val: g.animalCare.feedType },
                {
                  icon: Stethoscope,
                  label: "Vet visits",
                  val: g.animalCare.vetVisits,
                },
                {
                  icon: Syringe,
                  label: "Vaccination",
                  val: g.animalCare.vaccination,
                },
                {
                  icon: Clock,
                  label: "Rest period",
                  val: g.animalCare.restPeriod,
                },
                { icon: Sprout, label: "Grooming", val: g.animalCare.grooming },
              ].map(({ icon: Icon, label, val }) => (
                <div
                  key={label}
                  className="flex gap-3 rounded-sm border border-line bg-card p-3"
                >
                  <Icon size={14} className="text-saffron shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">
                      {label}
                    </div>
                    <div className="text-[12.5px] text-ink-soft mt-0.5 leading-snug">
                      {val}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Facilities */}
            <Heading>
              <TreeDeciduous size={15} className="text-forest" />
              Facilities
            </Heading>
            <div className="grid grid-cols-2 gap-2">
              {g.facilities.map((f) => (
                <div
                  key={f.label}
                  className="rounded-sm border border-line bg-card p-3"
                >
                  <div className="text-[12.5px] font-medium text-ink">
                    {f.label}
                  </div>
                  <div className="text-[11px] text-ink-faint mt-1 leading-snug">
                    {f.detail}
                  </div>
                </div>
              ))}
            </div>

            {/* Maintenance */}
            <Heading>
              <Droplets size={15} className="text-info" />
              Maintenance Practices
            </Heading>
            <ul className="space-y-1.5">
              {g.maintenancePractices.map((p) => (
                <li key={p} className="flex gap-2 text-[12.5px] text-ink-soft">
                  <span className="text-saffron shrink-0 mt-0.5">›</span>
                  {p}
                </li>
              ))}
            </ul>

            {/* Manager */}
            <Heading>
              <Users size={15} className="text-ink-faint" />
              Management
            </Heading>
            <div className="flex items-center gap-3 rounded-sm border border-line bg-card p-4">
              <div className="h-12 w-12 rounded-full bg-forest text-white grid place-items-center font-serif text-[16px] shrink-0">
                {g.managerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-ink">{g.managerName}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mt-0.5">
                  Gosala Manager
                </div>
                <div className="font-mono text-[10.5px] text-ink-faint mt-0.5">
                  {g.registrationNo}
                </div>
              </div>
            </div>

            {/* Contact */}
            <Heading>
              <MapPin size={15} className="text-ink-faint" />
              Contact & Location
            </Heading>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-[12.5px] text-ink-soft">
                <MapPin size={14} className="text-ink-faint shrink-0 mt-0.5" />
                {g.address}
              </div>
              <a
                href={`tel:${g.phone}`}
                className="flex items-center gap-3 text-[12.5px] text-saffron-deep"
              >
                <Phone size={14} className="text-saffron shrink-0" />
                {g.phone}
              </a>
              <div className="flex items-center gap-3 text-[12.5px] text-ink-soft">
                <Mail size={14} className="text-ink-faint shrink-0" />
                {g.email}
              </div>
              <div className="flex items-center gap-3 text-[12.5px] text-ink-soft">
                <Calendar size={14} className="text-ink-faint shrink-0" />
                {g.serviceHours}
              </div>
            </div>
          </>
        )}

        {tab === "animals" && (
          <>
            <p className="text-[12px] text-ink-faint mb-3">
              {gosalaAnimals.length} animals available for booking from this
              Gosala
            </p>
            <div className="grid grid-cols-2 gap-3">
              {gosalaAnimals.map((a) => (
                <AnimalCard key={a.name} animal={a} onSelect={onSelectAnimal} />
              ))}
            </div>
            {gosalaAnimals.length === 0 && (
              <div className="text-center py-8 text-ink-faint text-[13px]">
                No animals currently listed from this Gosala.
              </div>
            )}
          </>
        )}

        {tab === "reviews" && (
          <>
            <div className="flex items-center gap-4 mb-5 rounded-sm border border-line bg-card p-4">
              <div>
                <div className="font-serif text-[40px] text-ink leading-none tabular">
                  {g.rating}
                </div>
                <StarRow rating={g.rating} size={15} />
                <div className="font-mono text-[10.5px] text-ink-faint mt-1">
                  {g.totalReviews} reviews
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {g.reviews.map((r) => (
                <ReviewCard key={r.name} review={r} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] border-t border-line bg-card p-4 flex items-center gap-3">
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">
            Service from
          </div>
          <div className="text-[13.5px] text-ink">
            {gosalaAnimals.filter((a) => a.status === "Available").length}{" "}
            animals available
          </div>
        </div>
        <button
          onClick={() => setTab("animals")}
          className="ml-auto bg-saffron text-white rounded-sm px-7 py-3 text-[14px] font-medium hover:bg-saffron-deep transition-colors"
        >
          View animals
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   DESKTOP PROFILE
   ═══════════════════════════════════════════════════════ */
export function DesktopGosalaProfile({
  gosalaId,
  onBack,
  onSelectAnimal,
}: {
  gosalaId: string
  onBack: () => void
  onSelectAnimal: (a: Animal) => void
}) {
  const { gosalas: storeGosalas, animals: storeAnimals } = useStore()
  const g = useMemo(
    () => resolveGosalaDetail(gosalaId, storeGosalas),
    [gosalaId, storeGosalas],
  )
  const [photoIdx, setPhotoIdx] = useState(0)
  const [tab, setTab] = useState<ProfileTab>("about")

  if (!g) {
    return (
      <div className="p-12 text-center max-w-md mx-auto my-16 rounded-xl border border-dashed border-line bg-paper-deep/30">
        <h3 className="font-serif text-xl text-ink font-semibold mb-2">Gaushala Not Found</h3>
        <p className="text-sm text-ink-soft mb-6">The requested Gaushala could not be located or has not been registered yet.</p>
        <button onClick={onBack} className="px-5 py-2.5 bg-saffron hover:bg-saffron-deep text-white rounded font-medium text-sm transition-colors">Return to Directory</button>
      </div>
    )
  }

  const allAnimals = storeAnimals || []
  const gosalaAnimals = allAnimals.filter(
    (a) =>
      a.gosala.toLowerCase() === g.name.toLowerCase() ||
      a.gosala.toLowerCase().includes(g.name.toLowerCase()) ||
      g.name.toLowerCase().includes(a.gosala.toLowerCase()),
  )

  return (
    <div>
      {/* Breadcrumb */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink mb-5"
      >
        <ChevronLeft size={16} /> Back to discover
      </button>

      {/* Upper: two-column */}
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 mb-8">
        {/* Gallery column */}
        <div>
          <div className="relative rounded-sm overflow-hidden bg-paper-deep aspect-[16/9]">
            <img
              src={g.gallery[photoIdx]}
              alt={g.name}
              className="h-full w-full object-cover"
            />
            {/* Prev / Next arrows */}
            {photoIdx > 0 && (
              <button
                onClick={() => setPhotoIdx((p) => p - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 backdrop-blur grid place-items-center text-ink hover:bg-white transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {photoIdx < g.gallery.length - 1 && (
              <button
                onClick={() => setPhotoIdx((p) => p + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 backdrop-blur grid place-items-center text-ink hover:bg-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
          {/* Thumbnails */}
          <div className="flex gap-2 mt-3">
            {g.gallery.map((src, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`h-16 flex-1 rounded-sm overflow-hidden border-2 transition-colors ${
                  i === photoIdx
                    ? "border-saffron"
                    : "border-transparent opacity-60 hover:opacity-90"
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info column */}
        <div className="space-y-5">
          {/* Title */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              {g.tagline}
            </div>
            <h1 className="font-serif text-[32px] text-ink leading-tight mt-1">
              {g.name}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="inline-flex items-center gap-1.5 text-[13.5px]">
                <StarRow rating={g.rating} size={14} />
                <span className="font-medium text-ink ml-0.5">{g.rating}</span>
                <span className="text-ink-faint text-[12px] font-mono">
                  ({g.totalReviews} reviews)
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-soft font-mono">
                <Navigation size={12} /> {g.distanceKm} km
              </span>
            </div>
          </div>

          {/* Quick stats grid */}
          <div className="grid grid-cols-4 rounded-sm border border-line overflow-hidden">
            {[
              { val: g.totalAnimals.toString(), label: "Animals" },
              { val: `${g.areaAcres} ac`, label: "Land" },
              { val: g.yearEstablished.toString(), label: "Est." },
              {
                val: `${g.cowCount}C/${g.calfCount}Ca/${g.bullCount}B`,
                label: "Mix",
              },
            ].map(({ val, label }, i) => (
              <div
                key={label}
                className={`py-3 text-center ${
                  i < 3 ? "border-r border-line" : ""
                }`}
              >
                <div className="font-mono text-[14px] text-ink tabular">
                  {val}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Service hours */}
          <div className="flex items-center gap-2 text-[12.5px] text-ink-soft rounded-sm border border-line bg-card px-3 py-2.5">
            <Clock size={14} className="text-ink-faint" />
            <span>{g.serviceHours}</span>
          </div>

          {/* Certs summary (top 2) */}
          <div className="space-y-2">
            {g.certifications.slice(0, 2).map((c) => (
              <CertBadge key={c.label} {...c} />
            ))}
          </div>

          {/* Manager */}
          <div className="flex items-center gap-3 rounded-sm border border-line bg-card p-4">
            <div className="h-11 w-11 rounded-full bg-forest text-white grid place-items-center font-serif text-[14px] shrink-0">
              {g.managerInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] text-ink">{g.managerName}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Gosala Manager
              </div>
            </div>
            <a
              href={`tel:${g.phone}`}
              className="h-9 px-3 grid place-items-center rounded-sm bg-forest text-white text-[12px] flex items-center gap-1.5"
            >
              <Phone size={14} />
            </a>
          </div>

          {/* CTA */}
          <button
            onClick={() => setTab("animals")}
            className="w-full bg-saffron text-white rounded-sm py-3.5 text-[15px] font-medium hover:bg-saffron-deep transition-colors"
          >
            View available animals →
          </button>

          {/* Address */}
          <div className="flex items-start gap-2 text-[12px] text-ink-soft">
            <MapPin size={14} className="text-ink-faint shrink-0 mt-0.5" />
            {g.address}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line flex mb-6">
        <TabBtn active={tab === "about"} onClick={() => setTab("about")}>
          About & Practices
        </TabBtn>
        <TabBtn active={tab === "animals"} onClick={() => setTab("animals")}>
          Animals ({gosalaAnimals.length})
        </TabBtn>
        <TabBtn active={tab === "reviews"} onClick={() => setTab("reviews")}>
          Reviews ({g.totalReviews})
        </TabBtn>
      </div>

      {/* About tab */}
      {tab === "about" && (
        <div className="space-y-8">
          {/* Mission paragraph */}
          <p className="text-[14px] text-ink-soft leading-relaxed max-w-3xl">
            {g.about}
          </p>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Animal care */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Heart size={15} className="text-saffron" />
                <h3 className="font-serif text-[16px] text-ink">Animal Care</h3>
              </div>
              <div className="space-y-2">
                {[
                  {
                    icon: UtensilsCrossed,
                    label: "Feed schedule",
                    val: g.animalCare.feedSchedule,
                  },
                  {
                    icon: Leaf,
                    label: "Feed type",
                    val: g.animalCare.feedType,
                  },
                  {
                    icon: Stethoscope,
                    label: "Vet visits",
                    val: g.animalCare.vetVisits,
                  },
                  {
                    icon: Syringe,
                    label: "Vaccination",
                    val: g.animalCare.vaccination,
                  },
                  {
                    icon: Clock,
                    label: "Rest period",
                    val: g.animalCare.restPeriod,
                  },
                  {
                    icon: Sprout,
                    label: "Grooming",
                    val: g.animalCare.grooming,
                  },
                ].map(({ icon: Icon, label, val }) => (
                  <div
                    key={label}
                    className="rounded-sm border border-line bg-card p-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} className="text-saffron" />
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">
                        {label}
                      </span>
                    </div>
                    <div className="text-[12px] text-ink-soft leading-snug">
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Facilities */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TreeDeciduous size={15} className="text-forest" />
                <h3 className="font-serif text-[16px] text-ink">Facilities</h3>
              </div>
              <div className="space-y-2">
                {g.facilities.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-sm border border-line bg-card p-3"
                  >
                    <div className="text-[12.5px] font-medium text-ink">
                      {f.label}
                    </div>
                    <div className="text-[11.5px] text-ink-faint mt-0.5 leading-snug">
                      {f.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certifications + Maintenance */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award size={15} className="text-ok" />
                  <h3 className="font-serif text-[16px] text-ink">
                    All Certifications
                  </h3>
                </div>
                <div className="space-y-2">
                  {g.certifications.map((c) => (
                    <CertBadge key={c.label} {...c} />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Droplets size={15} className="text-info" />
                  <h3 className="font-serif text-[16px] text-ink">
                    Maintenance
                  </h3>
                </div>
                <ul className="space-y-2">
                  {g.maintenancePractices.map((p) => (
                    <li
                      key={p}
                      className="flex gap-2 text-[12.5px] text-ink-soft"
                    >
                      <span className="text-saffron shrink-0">›</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Mail size={15} className="text-ink-faint" />
                  <h3 className="font-serif text-[16px] text-ink">Contact</h3>
                </div>
                <div className="space-y-2 text-[12.5px]">
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Phone size={13} className="text-ink-faint shrink-0" />
                    <a
                      href={`tel:${g.phone}`}
                      className="text-saffron-deep hover:underline"
                    >
                      {g.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Mail size={13} className="text-ink-faint shrink-0" />
                    {g.email}
                  </div>
                  <div className="flex items-start gap-2 text-ink-soft">
                    <MapPin
                      size={13}
                      className="text-ink-faint shrink-0 mt-0.5"
                    />
                    {g.address}
                  </div>
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Calendar size={13} className="text-ink-faint shrink-0" />
                    {g.serviceHours}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animals tab */}
      {tab === "animals" && (
        <div>
          <p className="text-[13px] text-ink-faint mb-5">
            {gosalaAnimals.length} animals currently available from {g.name}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {gosalaAnimals.map((a) => (
              <AnimalCard key={a.name} animal={a} onSelect={onSelectAnimal} />
            ))}
          </div>
          {gosalaAnimals.length === 0 && (
            <div className="rounded-sm border border-line bg-card p-12 text-center text-ink-faint text-[14px]">
              No animals currently listed from this Gosala.
            </div>
          )}
        </div>
      )}

      {/* Reviews tab */}
      {tab === "reviews" && (
        <div>
          <div className="flex items-end gap-6 mb-6">
            <div>
              <div className="font-serif text-[56px] text-ink leading-none">
                {g.rating}
              </div>
              <StarRow rating={g.rating} size={18} />
              <div className="font-mono text-[11px] text-ink-faint mt-1.5">
                {g.totalReviews} verified bookings
              </div>
            </div>
            <div className="text-[13px] text-ink-soft max-w-md">
              All reviews are from customers who completed a verified GOMAA
              booking from this Gosala.
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {g.reviews.map((r) => (
              <ReviewCard key={r.name} review={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
