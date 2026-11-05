import { useState, useRef, useMemo, useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  X,
  Leaf,
  BookOpen,
  Users,
  Award,
  Phone,
  Mail,
  MapPin,
  Check,
  CheckCircle,
  Truck,
  Menu,
  HeartHandshake,
  Stethoscope,
  Eye,
  Download,
} from "lucide-react"

import { useToast } from "../../store/store"

// High-resolution authentic Indian cattle photography assets
import {
  bannerCorporate,
  bannerFeed,
  bannerSevaPackages,
  blogFestivals,
  blogGauSeva,
  blogGaushalas,
  cattleChaitra,
  cattleKamadhenu,
  cattleLakshmi,
  cattleMahabala,
  cattleNandini,
  cattleSavitri,
  gomaaLogoEmblem,
  heroSacredCow,
  impactCowPortrait,
  logoFull,
  logoMini,
} from "../../assets/landing/imagesData"

export interface GomaaLandingPageProps {
  onSignIn: () => void
  onStartBooking?: (animalName: string) => void
  selectedRegion?: string
}

export interface CattleItem {
  id: string
  name: string
  category: "COW" | "CALF" | "BULL" | "COW_AND_CALF" | "BUFFALO"
  breed: string
  age: string
  gender: string
  gosala: string
  location: string
  pricePerDay: number
  image: string
  description: string
  temperament: string
  sacredMarks: string
}

export interface GaushalaInfo {
  id: string
  name: string
  region: string
  address: string
  contactPhone: string
  contactEmail: string
  caretaker?: string
  managerName?: string
  governingAdminName?: string
  cowsCount: number
  image?: string
  description?: string
}

// Fallback high-fidelity cattle if network is unavailable
const DEFAULT_FEATURED_CATTLE: CattleItem[] = [
  {
    id: "surabhi-gir",
    name: "Surabhi",
    category: "COW",
    breed: "Indigenous Gir Cow",
    age: "4 Years",
    gender: "Female",
    gosala: "Gaushala_01",
    location: "Hyderabad Central (Banjara Hills)",
    pricePerDay: 3500,
    image: cattleLakshmi,
    description: "Gentle mother cow with calm temperament, suited for Griha Pravesh & Go Puja rituals.",
    temperament: "Exceptionally calm, accustomed to devotees and Vedic chanting",
    sacredMarks: "Natural Swastika crescent mark on forehead",
  },
  {
    id: "nandini-sahiwal",
    name: "Nandini",
    category: "COW",
    breed: "Sahiwal Sacred Cow",
    age: "5 Years",
    gender: "Female",
    gosala: "Gaushala_01",
    location: "Hyderabad Central (Banjara Hills)",
    pricePerDay: 3500,
    image: cattleKamadhenu,
    description: "Auspicious brown Sahiwal with high spiritual presence, gentle with elders and children.",
    temperament: "Serene, receptive to flower garlands and holy offerings",
    sacredMarks: "Golden aura horn curvature, distinct Vedic hump",
  },
  {
    id: "keshav-punganur",
    name: "Keshav",
    category: "CALF",
    breed: "Punganur Dwarf Calf",
    age: "1 Year",
    gender: "Male",
    gosala: "Gaushala_03",
    location: "Secunderabad & Cantonment",
    pricePerDay: 2500,
    image: cattleNandini,
    description: "Playful, loving sacred dwarf calf. Brings peace, happiness, and divine joy to ceremonies.",
    temperament: "Affectionate, loves eating fresh grass and tender affection",
    sacredMarks: "Pure white forehead spot and bright sacred eyes",
  },
  {
    id: "balarama-nandi",
    name: "Balarama",
    category: "BULL",
    breed: "Hallikar Nandi Bull",
    age: "6 Years",
    gender: "Male",
    gosala: "Gaushala_01",
    location: "Hyderabad Central (Banjara Hills)",
    pricePerDay: 4000,
    image: cattleMahabala,
    description: "Stately, noble sacred Nandi bull representing dharma, endurance, and divine strength.",
    temperament: "Majestic, steady, well-trained with certified handler",
    sacredMarks: "Deep classical Shiva-Nandi stature, broad crest",
  },
  {
    id: "gauri-ganga-pair",
    name: "Gauri & Ganga",
    category: "COW_AND_CALF",
    breed: "Gir Mother Cow & Calf Pair",
    age: "4 Years",
    gender: "Mother & Calf",
    gosala: "Gaushala_01",
    location: "Hyderabad Central (Banjara Hills)",
    pricePerDay: 4800,
    image: heroSacredCow,
    description: "Consecrated mother and suckling calf pair for paramount Griha Pravesh blessings.",
    temperament: "Deeply maternal, peaceful aura and gentle stride",
    sacredMarks: "Sacred mother-calf bond, auspicious Vedic markings",
  },
  {
    id: "kapila-tharparkar",
    name: "Kapila",
    category: "COW",
    breed: "Indigenous Tharparkar",
    age: "5 Years",
    gender: "Female",
    gosala: "Gaushala_02",
    location: "Cyberabad / Gachibowli",
    pricePerDay: 3500,
    image: cattleSavitri,
    description: "Revered drought-hardy white indigenous cow known as the wish-fulfilling Kamadhenu.",
    temperament: "Gentle demeanor, calm amid temple bells and family gatherings",
    sacredMarks: "Pure silver-white coat with deep black hooves",
  },
]

interface BlogArticle {
  id: string
  title: string
  date: string
  readTime: string
  image: string
  summary: string
  content: string[]
}

const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: "importance-gau-seva",
    title: "The Importance of Gau Seva in Modern Times",
    date: "Oct 10, 2026",
    readTime: "5 min read",
    image: blogGauSeva,
    summary: "Exploring the profound spiritual, ecological, and emotional benefits of honoring and caring for indigenous mother cows in modern cities.",
    content: [
      "In the Vedic tradition, the sacred cow (Gomata) is regarded as the mother of the universe, representing selflessness, nurturing warmth, and cosmic peace.",
      "As urban lifestyle separates modern families from nature, participating in genuine Gau Seva brings a serene reconnect with our dharmic roots.",
      "Through GOMAA's transparent platform, devotees can directly support verified rural and peri-urban gaushalas with real-time veterinary care and ethical upkeep.",
    ],
  },
  {
    id: "festivals-gomata",
    title: "Festivals and Traditions with Gomata",
    date: "Oct 5, 2026",
    readTime: "4 min read",
    image: blogFestivals,
    summary: "From Gopashtami to Pongal, Deepavali to Griha Pravesh, how sacred bovine rituals sanctify homes and communities.",
    content: [
      "Across Sanatana Dharma, holy milestones begin with Gomata Puja. In Griha Pravesh, the first step of a cow into a new home is celebrated as the entrance of Lakshmi.",
      "During Gopashtami, Lord Krishna's first day as a cowherd is commemorated with fragrant garlands, turmeric, and fresh green grass offerings.",
      "GOMAA ensures that every ceremonial event is conducted under strict animal welfare regulations, with hydraulic ramps and rest buffers.",
    ],
  },
  {
    id: "gaushalas-better-tomorrow",
    title: "How Gaushalas Are Creating a Better Tomorrow",
    date: "Sep 28, 2026",
    readTime: "6 min read",
    image: blogGaushalas,
    summary: "How modern gaushalas blend age-old indigenous wisdom with solar power, zero-waste organic compost, and humane veterinary science.",
    content: [
      "Gaushalas today are more than shelters; they are epicenters of ecological resilience and organic indigenous biodiversity.",
      "By utilizing cow dung and urine for Jeevamrutha and biogas, verified sanctuaries eliminate synthetic fertilizers and generate sustainable green energy.",
      "GOMAA's governance tools empower gaushala managers with digital health dossiers, fair escrow disbursements, and nationwide devotee connectivity.",
    ],
  },
]

export default function GomaaLandingPage({
  onSignIn,
  onStartBooking,
}: GomaaLandingPageProps) {
  const { addToast } = useToast()

  // Dynamic backend data
  const [dynamicGosalas, setDynamicGosalas] = useState<GaushalaInfo[]>([])
  const [dynamicAnimals, setDynamicAnimals] = useState<CattleItem[]>(DEFAULT_FEATURED_CATTLE)
  const [selectedGosalaFilter, setSelectedGosalaFilter] = useState<string>("ALL")
  const [isLoadingBackend, setIsLoadingBackend] = useState(true)

  // UI state
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "COW" | "CALF" | "BULL" | "COW_AND_CALF">("ALL")
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Interactive Modals
  const [selectedCattleForModal, setSelectedCattleForModal] = useState<CattleItem | null>(null)
  const [selectedGosalaForModal, setSelectedGosalaForModal] = useState<GaushalaInfo | null>(null)
  const [selectedBlogArticle, setSelectedBlogArticle] = useState<BlogArticle | null>(null)
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false)
  const [showBrandModal, setShowBrandModal] = useState(false)

  // Carousel ref
  const cattleCarouselRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------
  // Dynamic Backend Data Binding
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    async function fetchPlatformData() {
      try {
        setIsLoadingBackend(true)
        const [gosalasRes, animalsRes] = await Promise.all([
          fetch("/api/gosalas").catch(() => null),
          fetch("/api/animals").catch(() => null),
        ])

        if (gosalasRes && gosalasRes.ok) {
          const gData = await gosalasRes.json()
          const rawGosalas: any[] = Array.isArray(gData) ? gData : gData?.gosalas || []
          if (isMounted && rawGosalas.length > 0) {
            const parsedGosalas: GaushalaInfo[] = rawGosalas.map((g, idx) => ({
              id: g.id || `g-${idx}`,
              name: g.name || `Gaushala_${idx + 1}`,
              region: g.region || "Telangana Central",
              address: g.address || "Vedic Sanctuary Road",
              contactPhone: g.contactPhone || "+91 98230 44910",
              contactEmail: g.contactEmail || "sanctuary@gomaa.in",
              caretaker: g.caretaker || g.managerName || "Resident Gosevak",
              managerName: g.managerName || "Gomaa Manager",
              governingAdminName: g.governingAdminName || g.adminName || "Regional Admin",
              cowsCount: Array.isArray(g.animals) ? g.animals.length : (g.totalCows || 5),
              description: g.partnershipNotes || "Verified Vedic sanctuary adhering to Animal Welfare Board of India guidelines.",
            }))
            setDynamicGosalas(parsedGosalas)
          }
        }

        if (animalsRes && animalsRes.ok) {
          const aData = await animalsRes.json()
          const rawAnimals: any[] = Array.isArray(aData) ? aData : aData?.animals || []
          if (isMounted && rawAnimals.length > 0) {
            const parsedAnimals: CattleItem[] = rawAnimals.map((a: any, idx: number) => {
              const rawType = (a.type || "").toUpperCase()
              let cat: "COW" | "CALF" | "BULL" | "COW_AND_CALF" | "BUFFALO" = "COW"
              let defaultImg = cattleLakshmi

              if (rawType.includes("CALF")) {
                cat = "CALF"
                defaultImg = idx % 2 === 0 ? cattleNandini : cattleChaitra
              } else if (rawType.includes("BULL") || rawType.includes("NANDI")) {
                cat = "BULL"
                defaultImg = cattleMahabala
              } else if (rawType.includes("PAIR") || rawType.includes("COW_AND_CALF")) {
                cat = "COW_AND_CALF"
                defaultImg = heroSacredCow
              } else if (rawType.includes("BUFFALO")) {
                cat = "BUFFALO"
                defaultImg = cattleKamadhenu
              } else {
                cat = "COW"
                defaultImg = (idx % 2 === 0) ? cattleLakshmi : cattleKamadhenu
              }

              const breedText = a.breed || (cat === "BULL" ? "Hallikar Nandi" : cat === "CALF" ? "Punganur Dwarf" : "Indigenous Gir")
              const price = Number(a.price) || Number(a.dailyRate) || 3500

              return {
                id: a.id || `animal-${idx}`,
                name: a.name,
                category: cat,
                breed: breedText,
                age: a.ageYears ? `${a.ageYears} Years` : (a.age || "4 Years"),
                gender: cat === "BULL" ? "Male" : "Female",
                gosala: a.gosala?.name || a.gosala || "Gaushala_01",
                location: a.gosala?.region || "Telangana Central",
                pricePerDay: price,
                image: a.imageUrl || a.photo || defaultImg,
                description: a.description || `${a.name} is an indigenous sacred bovine in prime health, gentle nature, and certified under strict veterinary protocols.`,
                temperament: a.temperament || "Gentle, accustomed to Vedic chanting and family rituals",
                sacredMarks: a.sacredMarks || "Natural Vedic crest, holy tilak imprint",
              }
            })
            setDynamicAnimals(parsedAnimals)
          }
        }
      } catch (err) {
        console.warn("[GomaaLandingPage] API error fallback:", err)
      } finally {
        if (isMounted) setIsLoadingBackend(false)
      }
    }

    fetchPlatformData()
    return () => { isMounted = false }
  }, [])

  // Dynamic cattle filtering
  const filteredCattle = useMemo(() => {
    let list = dynamicAnimals.length > 0 ? dynamicAnimals : DEFAULT_FEATURED_CATTLE

    if (selectedCategory !== "ALL") {
      list = list.filter((c) => c.category === selectedCategory)
    }

    if (selectedGosalaFilter !== "ALL") {
      list = list.filter((c) => c.gosala.toLowerCase() === selectedGosalaFilter.toLowerCase())
    }

    return list
  }, [dynamicAnimals, selectedCategory, selectedGosalaFilter])

  const toggleFavorite = (id: string, name: string) => {
    setFavorites((prev) => {
      const next = !prev[id]
      if (next) {
        addToast(`❤️ ${name} added to your Sacred Favorites!`, "success")
      } else {
        addToast(`Removed ${name} from favorites`, "info")
      }
      return { ...prev, [id]: next }
    })
  }

  const scrollCarousel = (direction: "left" | "right") => {
    if (cattleCarouselRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320
      cattleCarouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }

  const handleBookCattle = (cattle: CattleItem) => {
    if (onStartBooking) {
      onStartBooking(cattle.name)
    } else {
      setSelectedCattleForModal(cattle)
    }
  }

  // Active showcase gaushala for floating badge
  const activeFeaturedGaushala = dynamicGosalas[0] || {
    id: "g1",
    name: "Gaushala_01",
    region: "Banjara Hills / Jubilee Hills, Hyderabad",
    cowsCount: 16,
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1b1c1b] font-sans antialiased selection:bg-[#c2611b] selection:text-white">
      {/* ----------------- Top Header / Navbar ----------------- */}
      <header className="sticky top-0 z-40 bg-[#faf7f2]/95 backdrop-blur-md border-b border-[#ece6da]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Left: GOMAA Logo & Subtitle */}
          <div className="flex items-center gap-3.5 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="h-14 w-14 sm:h-15 sm:w-15 rounded-2xl overflow-hidden shadow-sm border-2 border-[#132a13]/20 bg-white flex-shrink-0 p-1 flex items-center justify-center group-hover:scale-105 group-hover:border-[#c2611b]/40 transition-all duration-300">
              <img src={logoMini} alt="GOMAA Official Emblem" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-2xl sm:text-[26px] font-bold tracking-tight text-[#1b1c1b] leading-none">
                  GOMAA
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#faeed9] border border-[#f0dac0] text-[#a64a0e] text-[9.5px] font-bold tracking-wider uppercase">
                  Care for a Kinder Tomorrow
                </span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#716b5f] font-semibold mt-1">
                Cows • Culture • Community
              </div>
            </div>
          </div>

          {/* Center: Navigation Anchor Links */}
          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-medium text-[#4a463e]">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
              className="text-[#132a13] font-semibold relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-[#132a13] after:rounded-full"
            >
              Home
            </a>
            <a
              href="#gaushalas-section"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("gaushalas-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Gaushalas
            </a>
            <a
              href="#featured-cattle-section"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Sacred Cattle
            </a>
            <a
              href="#welfare-protocols-section"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("welfare-protocols-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Welfare Protocols
            </a>
            <a
              href="#impact-section"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("impact-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Impact
            </a>
            <a
              href="#brand-identity-section"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("brand-identity-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Our Brand
            </a>
            <a
              href="#blogs-section"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("blogs-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Wisdom Articles
            </a>
          </nav>

          {/* Right: Brand Kit & Sign In Button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowBrandModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#d8cfbe] bg-[#fdfbf7] hover:bg-white text-xs font-semibold text-[#132a13] transition-colors shadow-2xs cursor-pointer"
              title="View Official High-Resolution Brand Kit"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#c2611b]" />
              <span>Brand Kit</span>
            </button>

            <button
              onClick={onSignIn}
              className="bg-[#132a13] hover:bg-[#1b3b1b] active:scale-98 text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-2 group"
            >
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden h-10 w-10 rounded-full border border-[#d8cfbe] bg-[#fbf9f4] grid place-items-center text-[#2d2a24]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#faf7f2] border-b border-[#ece6da] px-6 py-4 space-y-2">
            <a
              href="#home"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block py-2 text-sm font-medium text-[#132a13]"
            >
              Home
            </a>
            <a
              href="#gaushalas-section"
              onClick={() => {
                document.getElementById("gaushalas-section")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block py-2 text-sm font-medium text-[#4a463e] hover:text-[#132a13]"
            >
              Verified Gaushalas
            </a>
            <a
              href="#featured-cattle-section"
              onClick={() => {
                document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block py-2 text-sm font-medium text-[#4a463e] hover:text-[#132a13]"
            >
              Sacred Cattle Directory
            </a>
            <a
              href="#welfare-protocols-section"
              onClick={() => {
                document.getElementById("welfare-protocols-section")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block py-2 text-sm font-medium text-[#4a463e] hover:text-[#132a13]"
            >
              Welfare &amp; Transit Protocols
            </a>
            <a
              href="#impact-section"
              onClick={() => {
                document.getElementById("impact-section")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block py-2 text-sm font-medium text-[#4a463e] hover:text-[#132a13]"
            >
              Platform Impact
            </a>
            <a
              href="#brand-identity-section"
              onClick={() => {
                document.getElementById("brand-identity-section")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block py-2 text-sm font-medium text-[#4a463e] hover:text-[#132a13]"
            >
              Our Sacred Brand &amp; Pillars
            </a>
            <a
              href="#blogs-section"
              onClick={() => {
                document.getElementById("blogs-section")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block py-2 text-sm font-medium text-[#4a463e] hover:text-[#132a13]"
            >
              Wisdom Articles
            </a>
            <div className="pt-2 border-t border-[#e2d8c9] space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  setShowBrandModal(true)
                }}
                className="w-full py-2.5 rounded-full border border-[#d8cfbe] bg-white text-[#132a13] text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#c2611b]" />
                <span>View Official Brand Kit</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  onSignIn()
                }}
                className="w-full py-2.5 rounded-full bg-[#132a13] text-white text-xs font-semibold"
              >
                Sign In to Workspace &rarr;
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ----------------- Hero Section ----------------- */}
      <section id="home" className="relative overflow-hidden pt-8 pb-12 lg:pt-12 lg:pb-16 bg-[#faf7f2]">
        {/* Lush Green Botanical Foliage Branch Top-Left */}
        <div className="absolute -top-4 -left-4 w-40 h-40 sm:w-56 sm:h-56 pointer-events-none select-none z-10 opacity-95">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="leafGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#99c93c" />
                <stop offset="50%" stopColor="#558b2f" />
                <stop offset="100%" stopColor="#2e5418" />
              </linearGradient>
              <linearGradient id="leafGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#b4e64f" />
                <stop offset="60%" stopColor="#689f38" />
                <stop offset="100%" stopColor="#1b3c0e" />
              </linearGradient>
              <linearGradient id="leafGrad3" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#8bc34a" />
                <stop offset="70%" stopColor="#33691e" />
                <stop offset="100%" stopColor="#143209" />
              </linearGradient>
            </defs>
            <path d="M-10,-10 Q50,45 105,100" stroke="#4e3620" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M40,35 Q75,40 120,60" stroke="#4e3620" strokeWidth="3" strokeLinecap="round" />
            <path d="M70,65 Q115,80 150,115" stroke="#4e3620" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M25,20 C10,50 45,75 75,55 C70,35 45,15 25,20 Z" fill="url(#leafGrad1)" />
            <path d="M25,20 Q50,42 75,55" stroke="#b4e64f" strokeWidth="1.2" opacity="0.7" />
            <path d="M60,30 C65,60 110,65 125,40 C115,20 85,15 60,30 Z" fill="url(#leafGrad2)" />
            <path d="M60,30 Q90,38 125,40" stroke="#d4ff78" strokeWidth="1.2" opacity="0.7" />
            <path d="M80,65 C85,95 130,100 145,75 C135,55 105,50 80,65 Z" fill="url(#leafGrad3)" />
            <path d="M80,65 Q110,75 145,75" stroke="#aed581" strokeWidth="1" opacity="0.7" />
            <path d="M45,45 C35,80 80,95 95,70 C85,50 60,40 45,45 Z" fill="url(#leafGrad2)" />
            <path d="M100,95 C110,130 155,130 165,105 C150,85 125,85 100,95 Z" fill="url(#leafGrad1)" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Headline, Subtitle, CTAs, 4 Value Badges */}
            <div className="lg:col-span-6 space-y-6 lg:pr-4">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-[#dec9b4] bg-[#fbf8f2] shadow-2xs">
                <div className="h-6 w-6 rounded-full overflow-hidden bg-white border border-[#c2611b]/30 flex-shrink-0 p-0.5">
                  <img src={logoMini} alt="Gomaa Emblem" className="h-full w-full object-contain" />
                </div>
                <span className="text-[#964710] text-[11px] font-bold tracking-wider uppercase">
                  GOMAA • Care for a Kinder Tomorrow
                </span>
                <span className="hidden sm:inline text-[#716b5f] text-[11px] font-medium border-l border-[#dec9b4] pl-2">
                  Cows • Culture • Community
                </span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[56px] font-normal tracking-tight text-[#171717] leading-[1.12]">
                Serve with Devotion.
                <br />
                Care with Purpose.
              </h1>

              <p className="text-[#5b564c] text-base sm:text-lg leading-relaxed max-w-xl font-normal">
                Connecting genuine devotees with audited, registered Vedic gaushalas. Transparent bovine care, certified veterinary welfare, and hydraulic ambulance transit nationwide.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })}
                  className="bg-[#132a13] hover:bg-[#1a381a] active:scale-98 text-white px-7 py-3 rounded-full font-medium text-sm transition-all shadow-md cursor-pointer flex items-center gap-2 group"
                >
                  <span>Browse Sacred Cattle</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => setShowHowItWorksModal(true)}
                  className="border border-[#c8beaf] bg-transparent hover:bg-white/80 active:scale-98 text-[#25231f] px-6 py-3 rounded-full font-medium text-sm transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
                >
                  <span className="h-5 w-5 rounded-full bg-[#eee5d8] grid place-items-center text-[#132a13]">
                    &#9658;
                  </span>
                  <span>How it works</span>
                </button>
              </div>

              {/* Official Brand Identity Plaque (Directly visible above the fold) */}
              <div className="p-3 sm:p-4 rounded-2xl bg-white/85 backdrop-blur-xs border border-[#ded4c4] shadow-xs flex items-center gap-3.5 hover:border-[#132a13]/30 transition-all">
                <div
                  onClick={() => setShowBrandModal(true)}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden bg-white p-1.5 border border-[#cfc1ac] shadow-xs flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                  title="Click to view full-resolution official Gomaa brand logo"
                >
                  <img src={logoFull} alt="Gomaa - Care for a Kinder Tomorrow" className="h-full w-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-sm sm:text-base text-[#1b1c1b] truncate">
                      Care for a Kinder Tomorrow™
                    </span>
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#132a13]/10 text-[#132a13] text-[9px] font-bold uppercase tracking-wider">
                      Official Platform
                    </span>
                  </div>
                  <p className="text-xs text-[#6e685c] mt-0.5 line-clamp-2 leading-relaxed">
                    Dedicated to sacred bovine welfare across India — uniting <strong>Cows</strong>, <strong>Culture</strong>, and <strong>Community</strong> through verified gaushalas and humane transit.
                  </p>
                </div>
                <button
                  onClick={() => setShowBrandModal(true)}
                  className="hidden md:flex px-3 py-1.5 rounded-xl border border-[#c8beaf] bg-[#faf7f2] hover:bg-white text-xs font-semibold text-[#132a13] transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  View Brand
                </button>
              </div>

              {/* 4 Value Proposition Badges */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#e8ded0]">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[#f2ece2] grid place-items-center text-[#132a13] flex-shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-sm font-bold text-[#1b1c1b]">
                      {dynamicGosalas.length || "7+"} Registered
                    </div>
                    <div className="text-[11px] text-[#716b5f]">Verified Gaushalas</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[#f2ece2] grid place-items-center text-[#132a13] flex-shrink-0">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-sm font-bold text-[#1b1c1b]">Safe &amp; Hydraulic</div>
                    <div className="text-[11px] text-[#716b5f]">Ambulance Transit</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[#f2ece2] grid place-items-center text-[#132a13] flex-shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-sm font-bold text-[#1b1c1b]">Transparent</div>
                    <div className="text-[11px] text-[#716b5f]">Escrow Governance</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[#f2ece2] grid place-items-center text-[#132a13] flex-shrink-0">
                    <HeartHandshake className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-sm font-bold text-[#1b1c1b]">Trusted By</div>
                    <div className="text-[11px] text-[#716b5f]">Vedic Communities</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Authentic Sacred Cow & Cuddled Calf Visual */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/60 bg-[#eee5d8] aspect-[4/3] sm:aspect-[16/11]">
                <img
                  src={heroSacredCow}
                  alt="Sacred Mother Cow and cuddled calf with temple background"
                  className="w-full h-full object-cover object-center"
                />

                {/* Floating Official GOMAA Verified Platform Seal (Top Left) */}
                <div
                  onClick={() => setShowBrandModal(true)}
                  className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/80 cursor-pointer hover:scale-105 transition-transform"
                >
                  <div className="h-6 w-6 rounded-full overflow-hidden bg-white border border-[#132a13]/20 flex-shrink-0 p-0.5">
                    <img src={logoMini} alt="Gomaa Emblem" className="h-full w-full object-contain" />
                  </div>
                  <span className="text-[11px] font-bold text-[#132a13] tracking-wide">
                    GOMAA Verified
                  </span>
                </div>

                {/* Calligraphic Vedic Blessing Script Top-Right */}
                <div className="absolute top-5 right-6 text-right pointer-events-none select-none">
                  <div className="font-serif italic text-white/90 text-sm sm:text-base font-semibold drop-shadow-md">
                    Gau Seva Gaurav Dharma
                  </div>
                </div>

                {/* Floating Dynamic Sanctuary Card (Bottom Right of visual) */}
                <div
                  onClick={() => {
                    if (dynamicGosalas[0]) setSelectedGosalaForModal(dynamicGosalas[0])
                  }}
                  className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-xl border border-white/80 max-w-[270px] sm:max-w-[290px] cursor-pointer hover:bg-white hover:scale-102 transition-all duration-300 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl overflow-hidden bg-[#faf7f2] flex-shrink-0 border border-[#e5dccf]">
                      <img src={cattleLakshmi} alt="Gaushala thumbnail" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs sm:text-sm text-[#1b1c1b] truncate">
                          {activeFeaturedGaushala.name}
                        </h4>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#716b5f] mt-0.5 truncate">
                        <MapPin className="h-3 w-3 text-[#c2611b] flex-shrink-0" />
                        <span className="truncate">{activeFeaturedGaushala.region}</span>
                      </div>
                    </div>
                  </div>

                  {/* Thumbnail Row */}
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-[#f0e9df]">
                    <div className="h-7 w-7 rounded-lg overflow-hidden border border-[#e0d6c8]">
                      <img src={cattleKamadhenu} alt="Cow" className="h-full w-full object-cover" />
                    </div>
                    <div className="h-7 w-7 rounded-lg overflow-hidden border border-[#e0d6c8]">
                      <img src={cattleNandini} alt="Calf" className="h-full w-full object-cover" />
                    </div>
                    <div className="h-7 w-7 rounded-lg overflow-hidden border border-[#e0d6c8]">
                      <img src={cattleMahabala} alt="Bull" className="h-full w-full object-cover" />
                    </div>
                    <span className="text-[10px] font-semibold text-[#6e685c] px-1.5 py-0.5 rounded-md bg-[#f2ecdf]">
                      +{dynamicAnimals.length || 16}
                    </span>

                    <span className="ml-auto text-[11px] font-semibold text-[#132a13] group-hover:underline flex items-center gap-0.5">
                      View Sanctuary <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- 3 Informational Spotlight Action Cards ----------------- */}
      <section className="py-6 bg-[#faf7f2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-12 gap-5">
            {/* Card 1: Verified Gaushala Network */}
            <div
              onClick={() => document.getElementById("gaushalas-section")?.scrollIntoView({ behavior: "smooth" })}
              className="md:col-span-5 relative rounded-2xl overflow-hidden bg-[#0a261c] text-white p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex items-center justify-between min-h-[145px] group border border-[#16382a]"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[42%] overflow-hidden pointer-events-none">
                <img src={bannerFeed} alt="Cattle Feed and Pasture" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0a261c]/40 to-[#0a261c]" />
              </div>

              <div className="relative z-10 ml-auto w-[62%] pl-2">
                <span className="inline-block px-3 py-1 rounded-full bg-[#fbf8f2] text-[#0a261c] text-[10px] font-bold uppercase tracking-wider mb-2 shadow-2xs">
                  Sanctuary Network
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight">
                  Verified Gaushala Network
                </h3>
                <p className="text-white/85 text-xs mt-1 leading-snug">
                  Audited Vedic shelters with resident caretakers, pasture facilities &amp; live bovine census.
                </p>
              </div>

              <div className="relative z-10 self-center ml-2 flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-white text-[#0a261c] grid place-items-center group-hover:scale-110 transition-transform shadow-md">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Card 2: Indigenous Heritage Breeds */}
            <div
              onClick={() => document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })}
              className="md:col-span-4 relative rounded-2xl overflow-hidden bg-[#181e1c] text-white p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex items-center justify-between min-h-[145px] group border border-[#2b3531]"
            >
              <div className="relative z-10 max-w-[58%]">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#c2611b]/25 border border-[#c2611b]/50 text-[#f5a769] text-[9.5px] font-bold uppercase tracking-wider mb-2">
                  Heritage Conservation
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight">
                  Sacred Bovine Breeds
                </h3>
                <p className="text-[#d8cfbe] text-xs mt-1.5 leading-snug font-serif italic">
                  Preserving Gir, Sahiwal, Kankrej, Tharparkar &amp; Punganur
                </p>
              </div>

              <div className="absolute right-12 top-0 bottom-0 w-[46%] pointer-events-none overflow-hidden opacity-95">
                <img src={bannerSevaPackages} alt="Sacred Bovine Breeds" className="w-full h-full object-cover object-left group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#181e1c] via-transparent to-transparent" />
              </div>

              <div className="relative z-10 self-center flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-white text-[#181e1c] grid place-items-center group-hover:scale-110 transition-transform shadow-md">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Card 3: Veterinary & Humane Transit Protocols */}
            <div
              onClick={() => document.getElementById("welfare-protocols-section")?.scrollIntoView({ behavior: "smooth" })}
              className="md:col-span-3 relative rounded-2xl overflow-hidden bg-[#eee5d8] text-[#1b1c1b] p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex items-center justify-between min-h-[145px] group border border-[#dfd4c4]"
            >
              <div className="relative z-10 max-w-[70%]">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#132a13]/10 text-[#132a13] text-[9.5px] font-bold uppercase tracking-wider mb-2">
                  PCA Act 1960
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1b1c1b] leading-tight">
                  Ethical Care &amp; Transit
                </h3>
                <p className="text-[#645e52] text-xs mt-1.5 font-medium leading-snug">
                  Hydraulic ambulance transit &amp; daily pre-dispatch health checks
                </p>
              </div>

              <div className="absolute right-8 top-1 bottom-1 w-24 opacity-35 pointer-events-none">
                <img src={bannerCorporate} alt="" className="w-full h-full object-contain" />
              </div>

              <div className="relative z-10 self-center flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-white text-[#1b1c1b] grid place-items-center group-hover:scale-110 transition-transform shadow-sm">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- Official Brand Identity & Core Pillars Section ----------------- */}
      <section id="brand-identity-section" className="py-14 bg-gradient-to-b from-[#fbf8f2] via-[#f5ece0] to-[#fbf8f2] border-y border-[#e7dcce]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#dec9b4] text-[#964710] text-xs font-bold tracking-wider uppercase mb-3 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-[#c2611b]" />
              <span>Sacred Brand Identity &amp; Mission</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1b1c1b] tracking-tight">
              Care for a Kinder Tomorrow
            </h2>
            <p className="text-[#645e52] text-sm sm:text-base mt-2 leading-relaxed">
              GOMAA is guided by sacred Vedic reverence, ethical bovine welfare, and community stewardship. Here are the two official brand logos that define our national commitment.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Brand Card 1: Official App Icon & Sacred Emblem */}
            <div className="rounded-3xl bg-white p-6 sm:p-8 border-2 border-[#dfd4c3] shadow-md flex flex-col items-center text-center hover:shadow-xl hover:border-[#132a13]/30 transition-all duration-300 group">
              <div className="inline-block px-3 py-1 rounded-full bg-[#faeed9] border border-[#f0dac0] text-[#a64a0e] text-[10px] font-bold uppercase tracking-wider mb-4">
                Official App Icon &amp; Sacred Emblem
              </div>

              {/* High-Resolution Logo Mini Viewport */}
              <div
                onClick={() => setShowBrandModal(true)}
                className="relative h-48 w-48 sm:h-56 sm:w-56 rounded-3xl overflow-hidden bg-white p-2 border-2 border-[#cebfa8] shadow-md mb-5 flex items-center justify-center cursor-pointer group-hover:scale-103 group-hover:border-[#132a13]/40 transition-all duration-300"
                title="Click to view full-resolution emblem"
              >
                <img
                  src={logoMini}
                  alt="GOMAA Official Sacred Emblem"
                  className="w-full h-full object-contain"
                />
              </div>

              <h3 className="font-serif text-2xl font-bold text-[#1b1c1b]">
                The Sacred GOMAA Emblem
              </h3>
              <p className="text-sm text-[#645e52] mt-2 leading-relaxed max-w-md">
                The protective green arc embraces the sacred mother cow adorned with holy saffron tilak, illuminated by the golden dawn of Vedic dharma, accompanied by GPS-tracked hydraulic safe transport.
              </p>

              <div className="grid grid-cols-2 gap-2.5 w-full mt-6 pt-5 border-t border-[#f0e8db] text-left text-xs text-[#524c42]">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#faf7f2]">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 flex-shrink-0"></span>
                  <span>Ahimsa &amp; Sacred Cow Care</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#faf7f2]">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                  <span>Vedic Rituals &amp; Darshan</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#faf7f2]">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-700 flex-shrink-0"></span>
                  <span>Panchagavya &amp; Pastures</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#faf7f2]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#132a13] flex-shrink-0"></span>
                  <span>Hydraulic Humane Transit</span>
                </div>
              </div>

              <div className="mt-5 w-full">
                <button
                  onClick={() => setShowBrandModal(true)}
                  className="w-full py-2.5 rounded-xl border border-[#c8beaf] bg-[#faf7f2] hover:bg-white text-xs font-semibold text-[#132a13] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5 text-[#c2611b]" />
                  <span>Inspect High-Resolution Emblem</span>
                </button>
              </div>
            </div>

            {/* Brand Card 2: Full Official Wordmark & Core Pillars */}
            <div className="rounded-3xl bg-white p-6 sm:p-8 border-2 border-[#dfd4c3] shadow-md flex flex-col items-center text-center hover:shadow-xl hover:border-[#132a13]/30 transition-all duration-300 group">
              <div className="inline-block px-3 py-1 rounded-full bg-[#132a13]/10 border border-[#132a13]/20 text-[#132a13] text-[10px] font-bold uppercase tracking-wider mb-4">
                Full Brand Identity &amp; 3 Core Pillars
              </div>

              {/* High-Resolution Logo Full Viewport */}
              <div
                onClick={() => setShowBrandModal(true)}
                className="relative h-48 sm:h-56 w-full max-w-[320px] rounded-3xl overflow-hidden bg-white p-3 border-2 border-[#cebfa8] shadow-md mb-5 flex items-center justify-center cursor-pointer group-hover:scale-103 group-hover:border-[#132a13]/40 transition-all duration-300"
                title="Click to view full-resolution brand mark"
              >
                <img
                  src={logoFull}
                  alt="Gomaa - Care for a Kinder Tomorrow (Cows, Culture, Community)"
                  className="w-full h-full object-contain"
                />
              </div>

              <h3 className="font-serif text-2xl font-bold text-[#1b1c1b]">
                Cows • Culture • Community
              </h3>
              <p className="text-sm text-[#645e52] mt-2 leading-relaxed max-w-md">
                The tri-pillar foundation uniting genuine devotees, regional gaushalas, and veterinary specialists to protect sacred bovine lineage with complete financial and transit transparency.
              </p>

              <div className="grid grid-cols-3 gap-2 w-full mt-6 pt-5 border-t border-[#f0e8db] text-center">
                <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e8ded0]">
                  <div className="font-serif font-bold text-sm text-[#132a13]">1. Cows</div>
                  <div className="text-[11px] text-[#716b5f] mt-0.5">Lifetime Dignity</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e8ded0]">
                  <div className="font-serif font-bold text-sm text-[#964710]">2. Culture</div>
                  <div className="text-[11px] text-[#716b5f] mt-0.5">Vedic Traditions</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e8ded0]">
                  <div className="font-serif font-bold text-sm text-[#1b1c1b]">3. Community</div>
                  <div className="text-[11px] text-[#716b5f] mt-0.5">Gaushala Stewardship</div>
                </div>
              </div>

              <div className="mt-5 w-full">
                <button
                  onClick={() => setShowBrandModal(true)}
                  className="w-full py-2.5 rounded-xl border border-[#c8beaf] bg-[#faf7f2] hover:bg-white text-xs font-semibold text-[#132a13] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5 text-[#c2611b]" />
                  <span>Inspect High-Resolution Brand Wordmark</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- Dynamic Verified Gaushalas Section ----------------- */}
      <section id="gaushalas-section" className="py-12 bg-[#faf7f2] border-t border-[#ece4d6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <Building2 className="h-5 w-5 text-emerald-700" />
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1b1c1b]">
                  Verified Gaushala Network
                </h2>
              </div>
              <p className="text-[#656054] text-sm sm:text-base mt-1">
                Audited sanctuaries with certified caretakers, resident veterinary bays, and pasture facilities.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedGosalaFilter("ALL")}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedGosalaFilter === "ALL"
                    ? "bg-[#132a13] text-white shadow-xs"
                    : "bg-[#eee7db] text-[#5e584d] hover:text-[#1b1c1b]"
                }`}
              >
                All Gaushalas ({dynamicGosalas.length || 7})
              </button>
              {dynamicGosalas.slice(0, 3).map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedGosalaFilter(g.name)
                    document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
                  }}
                  className={`px-3.5 py-2 rounded-full text-xs font-medium border border-[#dcd3c4] transition-all cursor-pointer ${
                    selectedGosalaFilter === g.name
                      ? "bg-[#132a13] text-white"
                      : "bg-white text-[#4a463e] hover:bg-[#f5ecde]"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Gaushala Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(dynamicGosalas.length > 0 ? dynamicGosalas.slice(0, 3) : [
              {
                id: "g1",
                name: "Gaushala_01",
                region: "Hyderabad Central (Banjara Hills)",
                address: "Plot 42, Road No 12, Banjara Hills, Hyderabad, Telangana",
                contactPhone: "+91 98230 44910",
                contactEmail: "gaushala1@gomaa.in",
                caretaker: "Gaushala Gosevak",
                cowsCount: 5,
              },
              {
                id: "g2",
                name: "Gaushala_02",
                region: "Cyberabad / Gachibowli Zone",
                address: "Survey 88, Financial District, Gachibowli, Hyderabad, Telangana",
                contactPhone: "+91 98230 44911",
                contactEmail: "gaushala2@gomaa.in",
                caretaker: "Gopal Krishna Murthy",
                cowsCount: 4,
              },
              {
                id: "g3",
                name: "Gaushala_03",
                region: "Secunderabad & Cantonment",
                address: "Temple Road, Trimulgherry, Secunderabad, Telangana",
                contactPhone: "+91 98230 44912",
                contactEmail: "gaushala3@gomaa.in",
                caretaker: "Raghavendra Swamy",
                cowsCount: 3,
              },
            ]).map((g, idx) => (
              <div
                key={g.id || idx}
                onClick={() => setSelectedGosalaForModal(g)}
                className="bg-white rounded-2xl p-6 border border-[#e8dfd2] shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#f0e9df]">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-[#f2ece2] text-[#132a13] grid place-items-center font-bold text-xs">
                        G{idx + 1}
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-bold text-[#1b1c1b] group-hover:text-[#c2611b] transition-colors">
                          {g.name}
                        </h3>
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> AWBI Certified
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-[#f4eee3] text-[#716b5f] text-xs font-semibold">
                      {g.cowsCount || 5} Sacred Bovines
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-[#5f594e]">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-[#c2611b] flex-shrink-0 mt-0.5" />
                      <span>{g.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-[#716b5f] flex-shrink-0" />
                      <span>Zone: {g.region}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-[#716b5f] flex-shrink-0" />
                      <span>Manager: {g.caretaker || g.managerName || "Resident Caretaker"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#f0e9df] flex items-center justify-between text-xs">
                  <span className="text-[#888173] font-mono text-[11px]">PCA 1960 Audited</span>
                  <span className="font-semibold text-[#132a13] group-hover:underline flex items-center gap-1">
                    Sanctuary Profile <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------- Dynamic Featured Cattle Section ----------------- */}
      <section id="featured-cattle-section" className="py-12 bg-[#faf7f2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <Leaf className="h-5 w-5 text-emerald-700" />
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1b1c1b]">
                  Featured Sacred Cattle
                </h2>
              </div>
              <p className="text-[#656054] text-sm sm:text-base mt-1">
                Consecrated mother cows, calves, and bulls registered from verified sanctuaries across regions.
              </p>
            </div>

            {/* Category Filter Pills & Carousel Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center p-1 rounded-full bg-[#eee7db] border border-[#dcd3c4] text-xs font-semibold">
                {(["ALL", "COW", "CALF", "BULL"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-[#132a13] text-white shadow-xs"
                        : "text-[#5e584d] hover:text-[#1b1c1b]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {selectedGosalaFilter !== "ALL" && (
                  <button
                    onClick={() => setSelectedGosalaFilter("ALL")}
                    className="px-3 py-1.5 rounded-full bg-[#dec9b4]/50 text-[#853f10] text-xs font-semibold hover:bg-[#dec9b4]"
                  >
                    Filter: {selectedGosalaFilter} &times;
                  </button>
                )}
                <button
                  onClick={() => scrollCarousel("left")}
                  title="Scroll Left"
                  className="h-9 w-9 rounded-full border border-[#d4cbbe] bg-white text-[#2d2b26] hover:bg-[#132a13] hover:text-white grid place-items-center transition-all cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollCarousel("right")}
                  title="Scroll Right"
                  className="h-9 w-9 rounded-full border border-[#d4cbbe] bg-white text-[#2d2b26] hover:bg-[#132a13] hover:text-white grid place-items-center transition-all cursor-pointer shadow-2xs"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Cattle Cards Grid / Carousel */}
          <div
            ref={cattleCarouselRef}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 overflow-x-auto pb-4 scroll-smooth"
          >
            {filteredCattle.map((cow) => {
              const isFav = !!favorites[cow.id]
              return (
                <div
                  key={cow.id}
                  className="bg-white rounded-2xl overflow-hidden border border-[#e8dfd2] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                >
                  {/* Card Image + Badge + Heart */}
                  <div className="relative h-44 w-full bg-[#f4eee3] overflow-hidden">
                    <img
                      src={cow.image}
                      alt={cow.name}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                    />

                    {/* Category Badge */}
                    <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-md text-white font-mono text-[9px] font-bold uppercase tracking-wider shadow-xs ${
                      cow.category === 'COW'
                        ? 'bg-[#7a4820]'
                        : cow.category === 'CALF'
                        ? 'bg-[#254a23]'
                        : cow.category === 'BULL'
                        ? 'bg-[#272b2e]'
                        : 'bg-[#9c4217]'
                    }`}>
                      {cow.category.replace(/_/g, " ")}
                    </span>

                    {/* Favorite Heart Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(cow.id, cow.name)
                      }}
                      className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-xs grid place-items-center transition-all cursor-pointer"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 transition-colors ${
                          isFav ? "fill-rose-500 text-rose-500" : "text-white hover:text-rose-300"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Card Info */}
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <h3 className="font-serif text-lg font-bold text-[#1b1c1b] leading-tight group-hover:text-[#c2611b] transition-colors">
                        {cow.name}
                      </h3>
                      <div className="text-[11px] text-[#716b5f] font-medium mt-0.5">
                        {cow.breed} &bull; {cow.age}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#555046] mt-1.5 truncate">
                        <MapPin className="h-3 w-3 text-[#c2611b] flex-shrink-0" />
                        <span className="truncate">{cow.gosala}</span>
                      </div>
                    </div>

                    {/* Price & Book Button */}
                    <div className="mt-4 pt-3 border-t border-[#f2ede4] flex items-center justify-between">
                      <div>
                        <div className="font-serif text-base font-bold text-[#1b1c1b]">
                          &#8377; {cow.pricePerDay.toLocaleString("en-IN")}{" "}
                          <span className="text-[10px] font-sans font-normal text-[#716b5f]">/ Day</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleBookCattle(cow)}
                        className="px-3 py-1.5 rounded-lg bg-[#132a13] hover:bg-[#1f421f] text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Book Seva
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ----------------- Humane Welfare & Transit Protocols Section ----------------- */}
      <section id="welfare-protocols-section" className="py-14 bg-[#f4ede1] border-t border-[#e2d7c5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-[#132a13]/10 text-[#132a13] text-xs font-bold uppercase tracking-wider mb-2">
              Statutory Animal Protection
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1b1c1b]">
              Four Pillars of Divine Animal Welfare
            </h2>
            <p className="text-[#656054] text-sm mt-2">
              Every booking is conducted strictly under the Prevention of Cruelty to Animals (PCA) Act, 1960 with veterinary oversight.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-[#dfd4c4] shadow-sm space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-800 grid place-items-center">
                <Truck className="h-5 w-5" />
              </div>
              <h4 className="font-serif text-lg font-bold text-[#1b1c1b]">
                Hydraulic Ramp Ambulances
              </h4>
              <p className="text-xs text-[#6e685c] leading-relaxed">
                Specially retrofitted cattle transit vehicles equipped with motorized low-angle ramps, non-slip rubber matting, and GPS tracking.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#dfd4c4] shadow-sm space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-800 grid place-items-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="font-serif text-lg font-bold text-[#1b1c1b]">
                Mandatory Rest Buffers
              </h4>
              <p className="text-xs text-[#6e685c] leading-relaxed">
                Strict limits of max 2 trips daily with mandatory 90-minute cooldown periods, fresh green pasture grazing, and water intake checks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#dfd4c4] shadow-sm space-y-3">
              <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-800 grid place-items-center">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h4 className="font-serif text-lg font-bold text-[#1b1c1b]">
                Veterinary Pre-Dispatch Pass
              </h4>
              <p className="text-xs text-[#6e685c] leading-relaxed">
                Registered veterinary doctors inspect temperature, heart rate, hydration, and hoof stability before dispatch.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#dfd4c4] shadow-sm space-y-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-800 grid place-items-center">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <h4 className="font-serif text-lg font-bold text-[#1b1c1b]">
                Escrow &amp; 4-Digit OTP
              </h4>
              <p className="text-xs text-[#6e685c] leading-relaxed">
                Contributions remain safely in escrow until the holy cow reaches your altar and you verify handover with your secure OTP.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- Latest from Our Blog & Real Impact Section ----------------- */}
      <section id="blogs-section" className="py-12 bg-[#faf7f2] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Latest from Our Blog */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#c2611b]" />
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1b1c1b]">
                    Wisdom from Our Sanctuary Journals
                  </h2>
                </div>
              </div>

              {/* 3 Blog Cards Row */}
              <div className="grid sm:grid-cols-3 gap-4">
                {BLOG_ARTICLES.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedBlogArticle(art)}
                    className="bg-white rounded-2xl overflow-hidden border border-[#e8dfd2] shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col group"
                  >
                    <div className="h-32 w-full bg-[#f4eee3] overflow-hidden">
                      <img
                        src={art.image}
                        alt={art.title}
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3.5 flex flex-col flex-1 justify-between">
                      <div>
                        <h4 className="font-serif text-sm font-bold text-[#1b1c1b] leading-snug group-hover:text-[#c2611b] transition-colors line-clamp-2">
                          {art.title}
                        </h4>
                      </div>
                      <div className="text-[10.5px] text-[#888173] font-medium mt-3">
                        {art.date} &bull; {art.readTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Real Impact Banner */}
            <div
              id="impact-section"
              className="lg:col-span-5 relative rounded-3xl overflow-hidden bg-[#132a13] text-white p-6 sm:p-8 shadow-xl border border-[#244224] flex flex-col justify-between"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                {/* Left portrait */}
                <div className="sm:col-span-5 h-44 sm:h-52 rounded-2xl overflow-hidden border border-white/20 shadow-md">
                  <img
                    src={impactCowPortrait}
                    alt="Soulful cow portrait"
                    className="w-full h-full object-cover object-center scale-105"
                  />
                </div>

                {/* Right text & CTAs */}
                <div className="sm:col-span-7 space-y-3">
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight">
                    Real Impact.
                    <br />
                    Happier Gaushalas.
                  </h3>
                  <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
                    Be a part of our sacred mission to support cattle welfare across India.
                  </p>
                  <div>
                    <button
                      onClick={onSignIn}
                      className="bg-[#fbf8f2] hover:bg-white active:scale-98 text-[#132a13] px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Enter Workspace Portal</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Impact Stats Grid */}
              <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-amber-300">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">
                      {dynamicGosalas.length || "7+"}
                    </div>
                    <div className="text-white/70 text-[11px]">Audited Sanctuaries</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-emerald-300">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">
                      {dynamicAnimals.length ? `${dynamicAnimals.length}+` : "16+"}
                    </div>
                    <div className="text-white/70 text-[11px]">Registered Bovines</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-sky-300">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">
                      {dynamicGosalas.length ? `${dynamicGosalas.length} Zones` : "3 Zones"}
                    </div>
                    <div className="text-white/70 text-[11px]">Operational Reach</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-rose-300">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">100%</div>
                    <div className="text-white/70 text-[11px]">PCA 1960 Certified</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- Clean Footer ----------------- */}
      <footer className="mt-12 bg-[#201c16] text-[#c7beaf] py-14 border-t border-[#383228]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#383228]">
            {/* Brand column */}
            <div className="space-y-3">
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setShowBrandModal(true)}
                title="Click to view official Brand Kit"
              >
                <div className="h-12 w-12 rounded-2xl overflow-hidden border border-[#52493d] bg-white p-1 shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                  <img src={logoMini} alt="GOMAA Official Emblem" className="h-full w-full object-contain" />
                </div>
                <div>
                  <span className="font-serif text-xl font-bold text-white tracking-tight">GOMAA</span>
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#9c9384]">
                    Care for a Kinder Tomorrow
                  </div>
                </div>
              </div>

              {/* Official Brand Badge: Gomaa - Care for a Kinder Tomorrow */}
              <div
                onClick={() => setShowBrandModal(true)}
                className="rounded-2xl overflow-hidden border border-[#3e362a] bg-white p-2.5 max-w-[260px] shadow-sm cursor-pointer hover:border-[#a64a0e] transition-colors"
                title="Click to inspect full resolution logo"
              >
                <img src={logoFull} alt="Gomaa - Care for a Kinder Tomorrow (Cows, Culture, Community)" className="w-full h-auto object-contain" />
              </div>
              <p className="text-xs text-[#a09787] leading-relaxed">
                Empowering ethical bovine care, temple darshan, and transparent cow seva nationwide with verified gaushalas and hydraulic ambulance transit.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-[#decab2]">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>AWBI &amp; PCA Act 1960 Compliant</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-white tracking-wider uppercase text-[11px]">Sanctuary Navigation</h5>
              <ul className="space-y-2 text-[#b0a797]">
                <li><button onClick={() => document.getElementById("gaushalas-section")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">Verified Gaushala Network</button></li>
                <li><button onClick={() => document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">Sacred Cattle Gallery</button></li>
                <li><button onClick={() => document.getElementById("welfare-protocols-section")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">Welfare &amp; Transit Protocols</button></li>
                <li><button onClick={() => setShowHowItWorksModal(true)} className="hover:text-white transition-colors">How GOMAA Works</button></li>
              </ul>
            </div>

            {/* Protocols & Ethics */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-white tracking-wider uppercase text-[11px]">Welfare Standards</h5>
              <ul className="space-y-2 text-[#b0a797]">
                <li>Hydraulic Ramp Ambulance Transit</li>
                <li>Zero-Stress Rest Buffer Windows</li>
                <li>Empanelled Veterinary Certification</li>
                <li>Escrow-Backed Transparent Payouts</li>
                <li>80G Income Tax Exemption Support</li>
              </ul>
            </div>

            {/* Access & Sign In */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-white tracking-wider uppercase text-[11px]">Platform Access</h5>
              <p className="text-[#a09787] text-xs">
                Devotees, Sanctuary Managers, Transit Drivers, and Admins can sign in to their dedicated workspaces.
              </p>
              <div className="pt-2">
                <button
                  onClick={onSignIn}
                  className="px-4 py-2 rounded-full bg-[#132a13] border border-[#445b44] hover:bg-[#1b3b1b] text-xs text-white transition-all flex items-center gap-2"
                >
                  <span>Sign In to Portal</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7d7465]">
            <p>&copy; 2026 GOMAA Sacred Operations &amp; Welfare Platform. All rights reserved.</p>
            <div className="flex items-center gap-4 mt-2 sm:mt-0">
              <span className="hover:text-white cursor-pointer" onClick={() => setShowHowItWorksModal(true)}>Terms of Seva</span>
              <span className="hover:text-white cursor-pointer" onClick={() => setShowHowItWorksModal(true)}>Privacy &amp; Safety</span>
              <span className="text-[#c2611b]">Designed with Devotion for Sanatana Dharma</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ----------------- MODAL 1: Cattle Seva Booking Dossier ----------------- */}
      {selectedCattleForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#132a13] text-white text-[10px] font-bold uppercase tracking-wider">
                  {selectedCattleForModal.category.replace(/_/g, " ")} SEVA DOSSIER
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  {selectedCattleForModal.name} ({selectedCattleForModal.breed})
                </h3>
                <p className="text-xs text-[#716b5f] flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-[#c2611b]" />
                  <span>Home Sanctuary: {selectedCattleForModal.gosala} ({selectedCattleForModal.location})</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedCattleForModal(null)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-52 w-full rounded-xl overflow-hidden border border-[#d8cfbe]">
              <img
                src={selectedCattleForModal.image}
                alt={selectedCattleForModal.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="bg-[#f2ece2] p-4 rounded-xl space-y-2 text-xs">
              <div className="font-semibold text-[#1b1c1b]">Divine Traits &amp; Health Profile:</div>
              <p className="text-[#5a5448]">{selectedCattleForModal.description}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e2d8c9] text-[11.5px]">
                <div><span className="font-semibold text-[#2d2a24]">Temperament:</span> {selectedCattleForModal.temperament}</div>
                <div><span className="font-semibold text-[#2d2a24]">Sacred Marks:</span> {selectedCattleForModal.sacredMarks}</div>
              </div>
            </div>

            {/* Pricing Info */}
            <div className="border border-[#ded5c6] rounded-xl p-4 bg-white space-y-2 text-xs">
              <div className="font-bold text-[#1b1c1b] flex items-center justify-between pb-2 border-b border-[#f0e8dc]">
                <span>Seva Dakshina &amp; Hydraulic Transit Summary</span>
                <span className="text-emerald-700 font-semibold">PCA 1960 Compliant</span>
              </div>
              <div className="flex justify-between text-[#686255]">
                <span>Base Seva Dakshina</span>
                <span>&#8377; {selectedCattleForModal.pricePerDay.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-[#686255]">
                <span>Hydraulic Ambulance Transit &amp; Gosevak Handler</span>
                <span>Certified Protocol</span>
              </div>
              <div className="flex justify-between text-[#686255]">
                <span>Organic Grass Fodder Offering</span>
                <span>Included</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#1b1c1b] pt-2 border-t border-[#f0e8dc]">
                <span>Total Seva Contribution</span>
                <span>&#8377; {selectedCattleForModal.pricePerDay.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedCattleForModal(null)
                  onSignIn()
                }}
                className="flex-1 py-3 rounded-full bg-[#132a13] hover:bg-[#1a381a] text-white font-medium text-sm text-center shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Sign In to Schedule Seva</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 2: Gaushala Profile Modal ----------------- */}
      {selectedGosalaForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-800 text-white text-[10px] font-bold uppercase tracking-wider">
                  Verified A+ Vedic Sanctuary
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  {selectedGosalaForModal.name}
                </h3>
                <p className="text-xs text-[#716b5f] flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-[#c2611b]" />
                  <span>{selectedGosalaForModal.address}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedGosalaForModal(null)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-48 w-full rounded-xl overflow-hidden border border-[#d8cfbe]">
              <img src={heroSacredCow} alt="Gaushala visual" className="w-full h-full object-cover" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#ded5c6]">
                <div className="font-serif text-lg font-bold text-[#132a13]">
                  {selectedGosalaForModal.cowsCount || 5}
                </div>
                <div className="text-[11px] text-[#716b5f]">Sacred Bovines</div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#ded5c6]">
                <div className="font-serif text-lg font-bold text-[#132a13]">24x7</div>
                <div className="text-[11px] text-[#716b5f]">Vet Care Bay</div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#ded5c6]">
                <div className="font-serif text-lg font-bold text-[#132a13]">100%</div>
                <div className="text-[11px] text-[#716b5f]">PCA 1960 Adherence</div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#555045]">
              <div className="font-semibold text-[#1b1c1b]">Sanctuary Administration:</div>
              <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-xl border border-[#ded5c6]">
                <div>
                  <span className="font-semibold text-[#2d2a24]">Caretaker:</span> {selectedGosalaForModal.caretaker || "Gosevak"}
                </div>
                <div>
                  <span className="font-semibold text-[#2d2a24]">Phone:</span> {selectedGosalaForModal.contactPhone}
                </div>
                <div>
                  <span className="font-semibold text-[#2d2a24]">Admin:</span> {selectedGosalaForModal.governingAdminName || "Regional Admin"}
                </div>
                <div>
                  <span className="font-semibold text-[#2d2a24]">Email:</span> {selectedGosalaForModal.contactEmail}
                </div>
              </div>
            </div>

            <p className="text-xs text-[#555045] leading-relaxed">
              {selectedGosalaForModal.description}
            </p>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => {
                  setSelectedGosalaFilter(selectedGosalaForModal.name)
                  setSelectedGosalaForModal(null)
                  document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
                }}
                className="px-5 py-2.5 rounded-full bg-[#132a13] text-white text-xs font-semibold cursor-pointer"
              >
                View Cattle from this Sanctuary &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 3: Blog Article Reader ----------------- */}
      {selectedBlogArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#c2611b]">
                  {selectedBlogArticle.date} &bull; {selectedBlogArticle.readTime}
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  {selectedBlogArticle.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBlogArticle(null)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-48 w-full rounded-xl overflow-hidden border border-[#d8cfbe]">
              <img
                src={selectedBlogArticle.image}
                alt={selectedBlogArticle.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-[#4b4539] leading-relaxed">
              {selectedBlogArticle.content.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            <div className="pt-4 border-t border-[#ded5c6] flex justify-between items-center text-xs">
              <span className="text-[#888173]">GOMAA Vedic Research Council</span>
              <button
                onClick={() => setSelectedBlogArticle(null)}
                className="px-4 py-2 rounded-full bg-[#132a13] text-white font-medium"
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 4: How It Works ----------------- */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#132a13] text-white text-[10px] font-bold uppercase tracking-wider">
                  Ethical Operations Protocol
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  How GOMAA Operates End-to-End
                </h3>
              </div>
              <button
                onClick={() => setShowHowItWorksModal(false)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#4b4539]">
              {[
                { step: "1", title: "Select Verified Bovine & Muhurat", desc: "Choose an indigenous mother cow, calf, or bull from your regional sanctuary with transparent per-day dakshina." },
                { step: "2", title: "Escrow-Protected Seva Contribution", desc: "Your seva contribution is held securely in escrow until seva is fulfilled under AWBI guidelines." },
                { step: "3", title: "Pre-Dispatch Veterinary Check", desc: "Empanelled doctors examine vitals, deworming status, and certify zero-stress transit readiness." },
                { step: "4", title: "Safe Hydraulic Ambulance Transit", desc: "Specially equipped ambulances with hydraulic loading ramps, non-slip flooring, and continuous monitoring." },
                { step: "5", title: "Handover with 4-Digit Altar OTP", desc: "Share the secure OTP only after the sacred bovine is safely guided into your altar courtyard." },
                { step: "6", title: "Instant Official Tax Invoice & Return", desc: "Receive automated GST/80G receipt while the cow safely returns to pasture for mandatory rest buffers." },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#ded5c6]">
                  <div className="h-7 w-7 rounded-full bg-[#132a13] text-white grid place-items-center font-bold text-xs flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h5 className="font-bold text-[#1b1c1b] text-sm">{item.title}</h5>
                    <p className="text-[#6e685c] mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHowItWorksModal(false)}
                className="px-5 py-2.5 rounded-full bg-[#132a13] text-white text-xs font-semibold cursor-pointer"
              >
                Understood &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 5: Official Brand Kit & High-Resolution Logos ----------------- */}
      {showBrandModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#d8cfbe] space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#132a13] text-white text-[10px] font-bold uppercase tracking-wider">
                  Official Brand Assets
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#1b1c1b] mt-1">
                  GOMAA Official Brand Logos
                </h3>
                <p className="text-xs text-[#716b5f] mt-0.5">
                  Care for a Kinder Tomorrow — Cows • Culture • Community
                </p>
              </div>
              <button
                onClick={() => setShowBrandModal(false)}
                className="h-9 w-9 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Asset 1: App Emblem */}
              <div className="p-4 rounded-2xl bg-white border border-[#ded5c6] flex flex-col items-center text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[#964710] mb-3">
                  App Icon / Sacred Emblem
                </span>
                <div className="h-48 w-48 rounded-2xl overflow-hidden bg-white p-2 border border-[#d8cfbe] shadow-xs flex items-center justify-center">
                  <img src={logoMini} alt="Gomaa Emblem" className="w-full h-full object-contain" />
                </div>
                <div className="mt-3 text-xs text-[#524c42] font-medium">
                  Dimensions: 1254 &times; 1254 px
                </div>
                <a
                  href={logoMini}
                  download="gomaa_logo_mini.jpg"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#132a13] text-white text-xs font-semibold hover:bg-[#1a381a] shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Emblem</span>
                </a>
              </div>

              {/* Asset 2: Full Brand Wordmark */}
              <div className="p-4 rounded-2xl bg-white border border-[#ded5c6] flex flex-col items-center text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[#132a13] mb-3">
                  Full Brand Identity
                </span>
                <div className="h-48 w-48 rounded-2xl overflow-hidden bg-white p-2 border border-[#d8cfbe] shadow-xs flex items-center justify-center">
                  <img src={logoFull} alt="Gomaa Full Logo" className="w-full h-full object-contain" />
                </div>
                <div className="mt-3 text-xs text-[#524c42] font-medium">
                  Dimensions: 1254 &times; 1254 px
                </div>
                <a
                  href={logoFull}
                  download="gomaa_logo_full.jpg"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#132a13] text-white text-xs font-semibold hover:bg-[#1a381a] shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Brand Logo</span>
                </a>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e8ded0] text-xs text-[#6e685c] leading-relaxed">
              <strong>Brand Usage Guidelines:</strong> These official high-resolution assets are dedicated to authentic Gau Seva, gaushala verification certificates, and devotee communication under the GOMAA platform.
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowBrandModal(false)}
                className="px-6 py-2.5 rounded-full bg-[#132a13] text-white text-xs font-semibold cursor-pointer"
              >
                Close Brand Kit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
