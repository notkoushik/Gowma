import { useState, useRef, useMemo, useEffect } from "react"
import {
  Search,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Play,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Sparkles,
  Clock,
  ArrowRight,
  X,
  Calendar,
  Leaf,
  BookOpen,
  Users,
  Award,
  Phone,
  Share2,
  Check,
  CheckCircle,
  Flame,
  Truck,
  Info,
  Menu,
} from "lucide-react"

import { useStore, useToast } from "../../store/store"
import LocationPickerModal from "../../components/LocationPickerModal"
import type { OperationalRegionHub } from "../../data/regions"
import { INDIAN_REGIONAL_HUBS } from "../../data/regions"

// Direct Base64 high-resolution landing assets matching gomaa_intro.jpg (zero Git LFS / 404 risk)
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
} from "../../assets/landing/imagesData"

export interface GomaaLandingPageProps {
  onSignIn: () => void
  onStartBooking?: (animalName: string) => void
  selectedRegion?: string
  onSelectRegion?: (hub: OperationalRegionHub) => void
}

interface CattleItem {
  id: string
  name: string
  category: "COW" | "CALF" | "BULL"
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

const DEFAULT_FEATURED_CATTLE: CattleItem[] = [
  {
    id: "lakshmi",
    name: "Lakshmi",
    category: "COW",
    breed: "Gir Indigenous",
    age: "5 years",
    gender: "Female",
    gosala: "Sri Sathya Gaushala",
    location: "Visakhapatnam, AP",
    pricePerDay: 500,
    image: cattleLakshmi,
    description: "Gentle mother cow with calm temperament, suited for Griha Pravesh & Go Puja rituals.",
    temperament: "Exceptionally calm, accustomed to devotees and Vedic chanting",
    sacredMarks: "Natural Swastika crescent mark on forehead",
  },
  {
    id: "kamadhenu",
    name: "Kamadhenu",
    category: "COW",
    breed: "Sahiwal Desi",
    age: "4 years",
    gender: "Female",
    gosala: "Annapurna Gaushala",
    location: "Visakhapatnam, AP",
    pricePerDay: 500,
    image: cattleKamadhenu,
    description: "Auspicious brown Sahiwal with high spiritual presence, gentle with elders and children.",
    temperament: "Serene, receptive to flower garlands and holy offerings",
    sacredMarks: "Golden aura horn curvature, distinct Vedic hump",
  },
  {
    id: "nandini",
    name: "Nandini",
    category: "CALF",
    breed: "Punganur Dwarf / Gir",
    age: "1 year",
    gender: "Female",
    gosala: "Gomata Seva Kendra",
    location: "Visakhapatnam, AP",
    pricePerDay: 300,
    image: cattleNandini,
    description: "Playful, loving holy calf. Brings peace, happiness, and innocence to sacred ceremonies.",
    temperament: "Energetic and affectionate, loves eating fresh grass by hand",
    sacredMarks: "Pure white forehead spot",
  },
  {
    id: "mahabala",
    name: "Mahabala",
    category: "BULL",
    breed: "Ongole Majestic Bull",
    age: "6 years",
    gender: "Male",
    gosala: "Sri Hari Gaushala",
    location: "Visakhapatnam, AP",
    pricePerDay: 700,
    image: cattleMahabala,
    description: "Stately, noble sacred Nandi bull representing dharma, endurance, and divine strength.",
    temperament: "Majestic, steady, well-trained with certified handler",
    sacredMarks: "Deep classical Shiva-Nandi stature, broad crest",
  },
  {
    id: "savitri",
    name: "Savitri",
    category: "COW",
    breed: "Tharparkar White",
    age: "3 years",
    gender: "Female",
    gosala: "Gau Seva Trust",
    location: "Visakhapatnam, AP",
    pricePerDay: 500,
    image: cattleSavitri,
    description: "Pristine white sacred cow embodying purity and divine motherly benevolence.",
    temperament: "Quiet and gentle, stays calmly at the home mandir entrance",
    sacredMarks: "Kailash white coat, graceful eyes",
  },
  {
    id: "chaitra",
    name: "Chaitra",
    category: "CALF",
    breed: "Kankrej Young Calf",
    age: "1 year",
    gender: "Female",
    gosala: "Veda Gaushala",
    location: "Visakhapatnam, AP",
    pricePerDay: 300,
    image: cattleChaitra,
    description: "Graceful young calf from ancient Kankrej lineage, tender and blessing-filled.",
    temperament: "Gentle and inquisitive, loves children feeding her tender jaggery",
    sacredMarks: "Velvety coat, auspicious gait",
  },
]

interface BlogArticle {
  id: string
  title: string
  date: string
  readTime: string
  image: string
  snippet: string
  content: string[]
}

const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: "gau-seva-modern-times",
    title: "The Importance of Gau Seva in Modern Times",
    date: "Oct 10, 2026",
    readTime: "5 min read",
    image: blogGauSeva,
    snippet: "Exploring the timeless spiritual, ecological, and psychological benefits of serving indigenous cows in today's fast-paced urban world.",
    content: [
      "In the Vedic tradition, the sacred cow (Gomata) is revered as Kamadhenu — the mother who fulfills all righteous prayers and bestows auspicious energy upon the home.",
      "Modern scientific research confirms that interacting with indigenous cows lowers cortisol, stabilizes blood pressure, and induces profound parasympathetic calm.",
      "By establishing direct digital bridges between urban households and rural gaushalas, GOMAA makes authentic Gau Seva accessible, transparent, and ethically governed under strict animal welfare standards.",
    ],
  },
  {
    id: "festivals-and-traditions",
    title: "Festivals and Traditions with Gomata",
    date: "Oct 5, 2026",
    readTime: "4 min read",
    image: blogFestivals,
    snippet: "From Gopashtami and Pongal to Griha Pravesh, discover how sacred cattle rituals bring harmony, abundance, and positive vibrations.",
    content: [
      "Festivals in Sanatana Dharma have always honored the bond between humanity and the bovine kingdom. During Gopashtami, Lord Krishna himself was initiated as an official cow protector in Vrindavan.",
      "When welcoming Gomata into a new home during Griha Pravesh, her holy footsteps are believed to sanctify the vastu of the residence and dispel negative energies.",
      "GOMAA provides specialized ceremonial packages with verified handlers, hydraulic non-slip ambulance transit, and consecrated puja offerings.",
    ],
  },
  {
    id: "better-tomorrow-gaushalas",
    title: "How Gaushalas Are Creating a Better Tomorrow",
    date: "Sep 28, 2026",
    readTime: "6 min read",
    image: blogGaushalas,
    snippet: "A deep dive into regenerative agriculture, indigenous breed preservation, biogas energy, and sustainable sanctuary self-reliance.",
    content: [
      "Gaushalas are not merely retirement shelters for aged cattle; they are living laboratories of sustainable green ecology and Vedic circular economy.",
      "Panchagavya organic fertilizers revitalize depleted topsoil, eliminating harmful chemical pesticides while indigenous Gir and Sahiwal genetics are preserved for future generations.",
      "With 250+ partner sanctuaries nationwide, the GOMAA platform ensures transparent escrow funding so that every rupee donated goes directly to cattle nutrition, medical care, and pasture expansion.",
    ],
  },
]

export default function GomaaLandingPage({
  onSignIn,
  onStartBooking,
  selectedRegion = "Visakhapatnam",
  onSelectRegion,
}: GomaaLandingPageProps) {
  const { animals, gosalas } = useStore()
  const { addToast } = useToast()

  // UI state
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "COW" | "CALF" | "BULL">("ALL")
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentCity, setCurrentCity] = useState("Visakhapatnam")
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  // Interactive Modals
  const [selectedCattleForModal, setSelectedCattleForModal] = useState<CattleItem | null>(null)
  const [showGaushalaModal, setShowGaushalaModal] = useState(false)
  const [showFeedModal, setShowFeedModal] = useState(false)
  const [showSevaPackagesModal, setShowSevaPackagesModal] = useState(false)
  const [showCorporateModal, setShowCorporateModal] = useState(false)
  const [selectedBlogArticle, setSelectedBlogArticle] = useState<BlogArticle | null>(null)
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false)

  // Carousel ref
  const cattleCarouselRef = useRef<HTMLDivElement>(null)

  // Default to Visakhapatnam to match reference design, only changing when explicitly chosen
  useEffect(() => {
    if (selectedRegion && selectedRegion !== "Regional" && selectedRegion !== "Cyberabad / Gachibowli") {
      setCurrentCity(selectedRegion)
    }
  }, [selectedRegion])

  // Filter cattle by category and search (strictly defaults to the verified design showcase)
  const filteredCattle = useMemo(() => {
    let list = DEFAULT_FEATURED_CATTLE

    if (selectedCategory !== "ALL") {
      list = list.filter((c) => c.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.breed.toLowerCase().includes(q) ||
          c.gosala.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      )
    }

    return list
  }, [selectedCategory, searchQuery])

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

  const handleSelectHub = (hub: OperationalRegionHub) => {
    setCurrentCity(hub.city)
    setShowLocationPicker(false)
    if (onSelectRegion) onSelectRegion(hub)
    addToast(`📍 Operational region updated to ${hub.city} (${hub.name})`, "success")
  }

  const handleBookCattle = (cattle: CattleItem) => {
    if (onStartBooking) {
      onStartBooking(cattle.name)
    } else {
      setSelectedCattleForModal(cattle)
    }
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1b1c1b] font-sans antialiased selection:bg-[#c2611b] selection:text-white">
      {/* ----------------- Top Header / Navbar ----------------- */}
      <header className="sticky top-0 z-40 bg-[#faf7f2]/95 backdrop-blur-md border-b border-[#ece6da]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Left: GOMAA Logo & Subtitle */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="h-11 w-11 rounded-full overflow-hidden shadow-xs border border-[#d8cfbe] bg-[#f2ecdf] flex-shrink-0 grid place-items-center">
              <img src={gomaaLogoEmblem} alt="GOMAA Seal" className="h-full w-full object-cover scale-105" />
            </div>
            <div>
              <div className="font-serif text-2xl font-bold tracking-tight text-[#1b1c1b] leading-none flex items-center gap-1.5">
                GOMAA
              </div>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.24em] text-[#716b5f] font-semibold mt-1">
                Sacred Operations &amp; Welfare Platform
              </div>
            </div>
          </div>

          {/* Center: Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-[#4a463e]">
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
              href="#cattle"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Cattle
            </a>
            <a
              href="#gaushalas"
              onClick={(e) => {
                e.preventDefault()
                setShowGaushalaModal(true)
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Gaushalas
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault()
                setShowHowItWorksModal(true)
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              How it works
            </a>
            <a
              href="#impact"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("impact-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Impact
            </a>
            <a
              href="#blogs"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("blogs-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="hover:text-[#132a13] transition-colors"
            >
              Blogs
            </a>
          </nav>

          {/* Right: Search + Location Pill + Sign In Button */}
          <div className="flex items-center gap-3">
            {/* Search Trigger */}
            <button
              onClick={() => setShowSearchModal(true)}
              title="Search Cattle & Sanctuaries"
              className="h-10 w-10 rounded-full border border-[#d8cfbe] bg-[#fbf9f4] hover:bg-white text-[#5f5b52] hover:text-[#132a13] grid place-items-center transition-all cursor-pointer shadow-2xs"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Location Selector Pill */}
            <button
              onClick={() => setShowLocationPicker(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#d8cfbe] bg-[#fbf9f4] hover:bg-white text-xs font-medium text-[#2d2a24] transition-all cursor-pointer shadow-2xs group"
            >
              <MapPin className="h-3.5 w-3.5 text-[#c2611b] group-hover:scale-110 transition-transform" />
              <span>{currentCity}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#888173]" />
            </button>

            {/* Sign In Button */}
            <button
              onClick={onSignIn}
              className="bg-[#132a13] hover:bg-[#1b3b1b] active:scale-98 text-white px-5 sm:px-6 py-2.5 rounded-full text-sm font-medium transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>Sign In</span>
            </button>

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden h-10 w-10 rounded-full border border-[#d8cfbe] bg-[#fbf9f4] grid place-items-center text-[#2d2a24]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#faf7f2] border-b border-[#ece6da] px-6 py-4 space-y-3">
            <button
              onClick={() => {
                setShowLocationPicker(true)
                setMobileMenuOpen(false)
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[#d8cfbe] bg-white text-xs font-medium text-[#2d2a24]"
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#c2611b]" />
                Region: {currentCity}
              </span>
              <ChevronDown className="h-4 w-4 text-[#888173]" />
            </button>
            <div className="flex flex-col gap-2 pt-2 text-sm font-medium text-[#4a463e]">
              <a
                href="#cattle"
                onClick={() => {
                  document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
                  setMobileMenuOpen(false)
                }}
                className="py-1.5 hover:text-[#132a13]"
              >
                Cattle Directory
              </a>
              <a
                href="#gaushalas"
                onClick={() => {
                  setShowGaushalaModal(true)
                  setMobileMenuOpen(false)
                }}
                className="py-1.5 hover:text-[#132a13]"
              >
                Verified Gaushalas
              </a>
              <a
                href="#how-it-works"
                onClick={() => {
                  setShowHowItWorksModal(true)
                  setMobileMenuOpen(false)
                }}
                className="py-1.5 hover:text-[#132a13]"
              >
                How It Works &amp; Protocols
              </a>
              <a
                href="#impact"
                onClick={() => {
                  document.getElementById("impact-section")?.scrollIntoView({ behavior: "smooth" })
                  setMobileMenuOpen(false)
                }}
                className="py-1.5 hover:text-[#132a13]"
              >
                Real Impact
              </a>
              <a
                href="#blogs"
                onClick={() => {
                  document.getElementById("blogs-section")?.scrollIntoView({ behavior: "smooth" })
                  setMobileMenuOpen(false)
                }}
                className="py-1.5 hover:text-[#132a13]"
              >
                Vedic Wisdom Blogs
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ----------------- Hero Section ----------------- */}
      <section id="home" className="relative overflow-hidden pt-8 pb-14 lg:pt-12 lg:pb-16 bg-[#faf7f2]">
        {/* Lush Green Botanical Foliage Branch Top-Left (matching gomaa_intro.jpg) */}
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
            {/* Main stem branch */}
            <path d="M-10,-10 Q50,45 105,100" stroke="#4e3620" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M40,35 Q75,40 120,60" stroke="#4e3620" strokeWidth="3" strokeLinecap="round" />
            <path d="M70,65 Q115,80 150,115" stroke="#4e3620" strokeWidth="2.5" strokeLinecap="round" />
            {/* Leaves */}
            <path d="M25,20 C10,50 45,75 75,55 C70,35 45,15 25,20 Z" fill="url(#leafGrad1)" />
            <path d="M25,20 Q50,42 75,55" stroke="#b4e64f" strokeWidth="1.2" opacity="0.7" />
            <path d="M60,30 C65,60 110,65 125,40 C115,20 85,15 60,30 Z" fill="url(#leafGrad2)" />
            <path d="M60,30 Q90,38 125,40" stroke="#d4ff78" strokeWidth="1.2" opacity="0.7" />
            <path d="M80,65 C85,95 130,100 145,75 C135,55 105,50 80,65 Z" fill="url(#leafGrad3)" />
            <path d="M80,65 Q110,75 145,75" stroke="#aed581" strokeWidth="1" opacity="0.7" />
            <path d="M45,45 C35,80 80,95 95,70 C85,50 60,40 45,45 Z" fill="url(#leafGrad2)" />
            <path d="M100,95 C110,130 155,130 165,105 C150,85 125,85 100,95 Z" fill="url(#leafGrad1)" />
            <path d="M100,95 Q130,105 165,105" stroke="#c5e1a5" strokeWidth="1" opacity="0.7" />
          </svg>
        </div>

        {/* Subtle golden leaf line art left */}
        <div className="absolute top-16 left-6 w-28 h-28 opacity-35 pointer-events-none select-none">
          <svg viewBox="0 0 100 100" fill="none" stroke="#a34e12" strokeWidth="1.4">
            <path d="M10,90 Q40,30 90,10 Q60,70 10,90 Z" />
            <path d="M10,90 Q50,50 90,10" />
            <path d="M30,70 Q45,65 50,50" />
            <path d="M50,50 Q65,45 70,30" />
          </svg>
        </div>

        {/* Golden leaf line art behind heading */}
        <div className="absolute top-8 left-[38%] w-36 h-36 opacity-30 pointer-events-none select-none hidden lg:block">
          <svg viewBox="0 0 100 100" fill="none" stroke="#b86a1a" strokeWidth="1">
            <path d="M50,95 C30,70 20,40 50,5 C80,40 70,70 50,95 Z" />
            <path d="M50,95 L50,5" />
            <path d="M50,75 Q35,65 30,55" />
            <path d="M50,60 Q35,50 32,40" />
            <path d="M50,45 Q38,35 36,25" />
            <path d="M50,75 Q65,65 70,55" />
            <path d="M50,60 Q65,50 68,40" />
            <path d="M50,45 Q62,35 64,25" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Headline, Subtitle, CTAs, 4 Value Badges */}
            <div className="lg:col-span-6 space-y-6 lg:pr-4">
              {/* Tagline Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#dec9b4] bg-[#f5ecde]/70 text-[#964710] text-[11px] font-semibold tracking-wider uppercase">
                <Sparkles className="h-3.5 w-3.5 text-[#c2611b]" />
                <span>SEVA • WELFARE • TRANSPARENT OPERATIONS</span>
              </div>

              {/* Stately Serif Title */}
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[56px] font-normal tracking-tight text-[#171717] leading-[1.12]">
                Serve with Devotion.
                <br />
                Care with Purpose.
              </h1>

              {/* Subtext */}
              <p className="text-[#5b564c] text-base sm:text-lg leading-relaxed max-w-xl font-normal">
                Book verified cattle from trusted gaushalas for seva, events, and sacred occasions. Transparent booking, safe transport, and guided support — every step, on one platform.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => {
                    document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
                  }}
                  className="bg-[#132a13] hover:bg-[#1a3a1a] active:scale-98 text-white px-7 py-3.5 rounded-full font-medium text-sm sm:text-base flex items-center gap-2 transition-all shadow-sm cursor-pointer group"
                >
                  <span>Browse Cattle</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => setShowHowItWorksModal(true)}
                  className="border border-[#cfc6b7] hover:border-[#132a13] bg-transparent text-[#262420] px-6 py-3.5 rounded-full font-medium text-sm sm:text-base flex items-center gap-2.5 transition-all cursor-pointer hover:bg-white/60"
                >
                  <Play className="h-4 w-4 fill-[#262420] text-[#262420]" />
                  <span>How it works</span>
                </button>
              </div>

              {/* 4 Trust Metrics Row */}
              <div className="pt-6 border-t border-[#ece4d6] grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#efe7da] text-[#132a13] flex-shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1b1c1b] text-sm">250+</div>
                    <div className="text-[#6e685c] leading-tight">Verified Gaushalas</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#efe7da] text-[#132a13] flex-shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1b1c1b] text-sm">Safe &amp;</div>
                    <div className="text-[#6e685c] leading-tight">Secure Transport</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#efe7da] text-[#132a13] flex-shrink-0">
                    <Leaf className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1b1c1b] text-sm">Transparent</div>
                    <div className="text-[#6e685c] leading-tight">Pricing</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#efe7da] text-[#132a13] flex-shrink-0">
                    <Heart className="h-4 w-4 text-[#c2611b]" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1b1c1b] text-sm">Trusted by</div>
                    <div className="text-[#6e685c] leading-tight">Thousands</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual with Sacred Cow & Temple and Floating Sanctuary Card */}
            <div className="lg:col-span-6 relative mt-4 lg:mt-0">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#e2d7c5] bg-[#ece4d6]">
                <img
                  src={heroSacredCow}
                  alt="Sacred Mother Cow and cuddled calf with ancient temple background"
                  className="w-full h-[380px] sm:h-[430px] lg:h-[460px] object-cover object-center scale-[1.02] hover:scale-105 transition-transform duration-700"
                />

                

                {/* Floating Sanctuary Card (Bottom Right of visual) */}
                <div
                  onClick={() => setShowGaushalaModal(true)}
                  className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-xl border border-white/80 max-w-[260px] sm:max-w-[280px] cursor-pointer hover:bg-white hover:scale-102 transition-all duration-300 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-[#faf7f2] flex-shrink-0 border border-[#e5dccf]">
                      <img src={cattleLakshmi} alt="Gaushala thumbnail" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs sm:text-sm text-[#1b1c1b] truncate">
                          Sri Venkateswara Gaushala
                        </h4>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#716b5f] mt-0.5">
                        <MapPin className="h-3 w-3 text-[#c2611b]" />
                        <span>Visakhapatnam, AP</span>
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
                      +24
                    </span>

                    <span className="ml-auto text-[11px] font-semibold text-[#132a13] group-hover:underline flex items-center gap-0.5">
                      View Gaushala <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- Spotlight Action Banners (3 Cards Grid) ----------------- */}
      <section className="py-6 bg-[#faf7f2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-12 gap-5">
            {/* Card 1: Sponsor Cattle Feed */}
            <div
              onClick={() => setShowFeedModal(true)}
              className="md:col-span-5 relative rounded-2xl overflow-hidden bg-[#0a261c] text-white p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex items-center justify-between min-h-[145px] group border border-[#16382a]"
            >
              {/* Left visual: Authentic brass pot with sprouts and grains bowl */}
              <div className="absolute left-0 top-0 bottom-0 w-[42%] overflow-hidden pointer-events-none">
                <img src={bannerFeed} alt="Cattle Feed" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0a261c]/40 to-[#0a261c]" />
              </div>

              <div className="relative z-10 ml-auto w-[62%] pl-2">
                <span className="inline-block px-3 py-1 rounded-full bg-[#fbf8f2] text-[#0a261c] text-[10px] font-bold uppercase tracking-wider mb-2 shadow-2xs">
                  Support Nutrition
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight">
                  Sponsor Cattle Feed
                </h3>
                <p className="text-white/85 text-xs mt-1 leading-snug">
                  Help us provide nutritious feed to gaushalas in need.
                </p>
              </div>

              <div className="relative z-10 self-center ml-2 flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-white text-[#0a261c] grid place-items-center group-hover:scale-110 transition-transform shadow-md">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Card 2: Special Seva Packages */}
            <div
              onClick={() => setShowSevaPackagesModal(true)}
              className="md:col-span-4 relative rounded-2xl overflow-hidden bg-[#181e1c] text-white p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex items-center justify-between min-h-[145px] group border border-[#2b3531]"
            >
              <div className="relative z-10 max-w-[58%]">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight">
                  Special Seva Packages
                </h3>
                <p className="text-[#d8cfbe] text-xs mt-1.5 leading-snug font-serif italic">
                  for festivals &amp; auspicious occasions
                </p>
              </div>

              {/* Center/Right temple & cow visual */}
              <div className="absolute right-12 top-0 bottom-0 w-[46%] pointer-events-none overflow-hidden opacity-95">
                <img src={bannerSevaPackages} alt="Special Seva Packages" className="w-full h-full object-cover object-left group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#181e1c] via-transparent to-transparent" />
              </div>

              <div className="relative z-10 self-center flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-white text-[#181e1c] grid place-items-center group-hover:scale-110 transition-transform shadow-md">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Card 3: Corporate Partnerships */}
            <div
              onClick={() => setShowCorporateModal(true)}
              className="md:col-span-3 relative rounded-2xl overflow-hidden bg-[#eee5d8] text-[#1b1c1b] p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex items-center justify-between min-h-[145px] group border border-[#dfd4c4]"
            >
              <div className="relative z-10 max-w-[70%]">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1b1c1b] leading-tight">
                  Corporate Partnerships
                </h3>
                <p className="text-[#645e52] text-xs mt-1.5 font-medium leading-snug">
                  Support gaushalas with your organization
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

      {/* ----------------- Featured Cattle Section ----------------- */}
      <section id="featured-cattle-section" className="py-12 bg-[#faf7f2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <Leaf className="h-5 w-5 text-emerald-700" />
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1b1c1b]">
                  Featured Cattle
                </h2>
              </div>
              <p className="text-[#656054] text-sm sm:text-base mt-1">
                Book cattle for seva, puja, events, and special occasions from verified gaushalas.
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
                <button
                  onClick={() => {
                    if (onStartBooking) onStartBooking("Lakshmi")
                    else setShowSearchModal(true)
                  }}
                  className="px-4 py-2 rounded-full border border-[#d4cbbe] bg-white text-xs font-medium text-[#2d2b26] hover:bg-[#132a13] hover:text-white transition-all shadow-2xs"
                >
                  View All &rarr;
                </button>
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

                    {/* Category Badge matching authentic reference */}
                    <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-md text-white font-mono text-[9px] font-bold uppercase tracking-wider shadow-xs ${
                      cow.category === 'COW'
                        ? 'bg-[#7a4820]'
                        : cow.category === 'CALF'
                        ? 'bg-[#254a23]'
                        : 'bg-[#272b2e]'
                    }`}>
                      {cow.category}
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
                        {cow.age} &bull; {cow.gender}
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

      {/* ----------------- Latest from Our Blog & Real Impact Section ----------------- */}
      <section id="blogs-section" className="py-12 bg-[#faf7f2] relative overflow-hidden">
        {/* Decorative Green Leaf Branch on bottom-right of blogs/impact section (matching gomaa_intro.jpg) */}
        <div className="absolute -bottom-8 -right-8 w-48 h-48 pointer-events-none select-none opacity-85 hidden lg:block z-10">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full drop-shadow-md">
            <path d="M210,210 Q140,140 80,90" stroke="#4e3620" strokeWidth="4" strokeLinecap="round" />
            <path d="M150,150 Q120,110 70,80" stroke="#4e3620" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M120,120 C100,90 70,100 60,130 C75,145 105,140 120,120 Z" fill="url(#leafGrad1)" />
            <path d="M160,160 C140,120 100,120 90,150 C110,180 145,175 160,160 Z" fill="url(#leafGrad2)" />
            <path d="M80,90 C60,60 30,75 30,105 C50,120 75,110 80,90 Z" fill="url(#leafGrad3)" />
          </svg>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Latest from Our Blog */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#c2611b]" />
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1b1c1b]">
                    Latest from Our Blog
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedBlogArticle(BLOG_ARTICLES[0])}
                  className="text-xs font-semibold text-[#132a13] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View All Articles &rarr;
                </button>
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
                    Be a part of our mission to support cattle welfare across India.
                  </p>
                  <div>
                    <button
                      onClick={onSignIn}
                      className="bg-[#fbf8f2] hover:bg-white active:scale-98 text-[#132a13] px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Join the Movement</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Impact Stats Grid */}
              <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-amber-300">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">250+</div>
                    <div className="text-white/70 text-[11px]">Verified Gaushalas</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-emerald-300">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">12,000+</div>
                    <div className="text-white/70 text-[11px]">Cattle Supported</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-sky-300">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">30+</div>
                    <div className="text-white/70 text-[11px]">Cities</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-rose-300">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-serif text-lg font-bold text-white">5,000+</div>
                    <div className="text-white/70 text-[11px]">Devotees Joined</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- Footer ----------------- */}
      <footer className="mt-12 bg-[#201c16] text-[#c7beaf] py-14 border-t border-[#383228]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#383228]">
            {/* Brand column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full overflow-hidden border border-[#d8cfbe] bg-[#f2ecdf]">
                  <img src={gomaaLogoEmblem} alt="GOMAA" className="h-full w-full object-cover" />
                </div>
                <div>
                  <span className="font-serif text-xl font-bold text-white">GOMAA</span>
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#9c9384]">
                    Sacred Welfare Platform
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#a09787] leading-relaxed">
                Empowering ethical bovine care, temple darshan, and transparent cow seva nationwide with verified gaushalas and hydraulic transit.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-[#decab2]">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>AWBI &amp; PCA Act 1960 Compliant</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-white tracking-wider uppercase text-[11px]">Sacred Portals</h5>
              <ul className="space-y-2 text-[#b0a797]">
                <li><button onClick={() => document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">Browse Verified Cattle</button></li>
                <li><button onClick={() => setShowGaushalaModal(true)} className="hover:text-white transition-colors">Sanctuary Network</button></li>
                <li><button onClick={() => setShowFeedModal(true)} className="hover:text-white transition-colors">Sponsor Cattle Feed</button></li>
                <li><button onClick={() => setShowSevaPackagesModal(true)} className="hover:text-white transition-colors">Festival Seva Packages</button></li>
                <li><button onClick={() => setShowCorporateModal(true)} className="hover:text-white transition-colors">Corporate CSR Gaushala Adoption</button></li>
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

            {/* Contact & Regions */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-white tracking-wider uppercase text-[11px]">Regional Hubs</h5>
              <p className="text-[#a09787] text-xs">
                Active in Visakhapatnam, Tirupati, Hyderabad, Vijayawada, Bangalore, Pune, Ahmedabad &amp; Delhi-NCR.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setShowLocationPicker(true)}
                  className="px-3 py-1.5 rounded-full border border-[#52493d] hover:border-white text-xs text-white transition-all flex items-center gap-1.5"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#c2611b]" />
                  <span>Change Region ({currentCity})</span>
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

      {/* ----------------- MODAL 1: Search Cattle & Sanctuaries ----------------- */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-[#c2611b]" />
                <h3 className="font-serif text-xl font-bold text-[#1b1c1b]">Search Sacred Cattle &amp; Gaushalas</h3>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-[#716b5f]" />
              <input
                type="text"
                placeholder="Search by cow name, breed (Gir, Sahiwal), or sanctuary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#d8cfbe] bg-white text-sm text-[#1b1c1b] focus:outline-hidden focus:border-[#132a13]"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
              {filteredCattle.slice(0, 5).map((cow) => (
                <div
                  key={cow.id}
                  onClick={() => {
                    setShowSearchModal(false)
                    handleBookCattle(cow)
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-[#ded5c6] transition-all cursor-pointer"
                >
                  <img src={cow.image} alt={cow.name} className="h-12 w-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[#1b1c1b]">{cow.name}</h4>
                      <span className="text-xs font-semibold text-[#132a13]">&#8377; {cow.pricePerDay}</span>
                    </div>
                    <div className="text-xs text-[#716b5f]">{cow.breed} &bull; {cow.gosala}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-2 rounded-xl bg-[#132a13] text-white text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 2: Cattle Seva Booking Dossier ----------------- */}
      {selectedCattleForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#132a13] text-white text-[10px] font-bold uppercase tracking-wider">
                  {selectedCattleForModal.category} SEVA DOSSIER
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

            {/* Itemized Pricing Summary */}
            <div className="border border-[#ded5c6] rounded-xl p-4 bg-white space-y-2 text-xs">
              <div className="font-bold text-[#1b1c1b] flex items-center justify-between pb-2 border-b border-[#f0e8dc]">
                <span>Seva Dakshina &amp; Hydraulic Transit Breakdown</span>
                <span className="text-emerald-700 font-semibold">Verified Escrow</span>
              </div>
              <div className="flex justify-between text-[#686255]">
                <span>Base Seva Dakshina (60 min auspicious muhurat)</span>
                <span>&#8377; {selectedCattleForModal.pricePerDay}</span>
              </div>
              <div className="flex justify-between text-[#686255]">
                <span>Hydraulic Ambulance Transit &amp; Gosevak Handler</span>
                <span>Included</span>
              </div>
              <div className="flex justify-between text-[#686255]">
                <span>Organic Grass Fodder Offering</span>
                <span>Included</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#1b1c1b] pt-2 border-t border-[#f0e8dc]">
                <span>Total Seva Contribution</span>
                <span>&#8377; {selectedCattleForModal.pricePerDay}</span>
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
                <span>Proceed to Schedule &amp; Reserve</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 3: Sri Venkateswara Gaushala Profile ----------------- */}
      {showGaushalaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-800 text-white text-[10px] font-bold uppercase tracking-wider">
                  Verified A+ Vedic Sanctuary
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  Sri Venkateswara Gaushala
                </h3>
                <p className="text-xs text-[#716b5f] flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-[#c2611b]" />
                  <span>Simhachalam Foothills, Visakhapatnam, Andhra Pradesh</span>
                </p>
              </div>
              <button
                onClick={() => setShowGaushalaModal(false)}
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
                <div className="font-serif text-lg font-bold text-[#132a13]">450+</div>
                <div className="text-[11px] text-[#716b5f]">Sacred Cattle</div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#ded5c6]">
                <div className="font-serif text-lg font-bold text-[#132a13]">18 Acres</div>
                <div className="text-[11px] text-[#716b5f]">Organic Pasture</div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#ded5c6]">
                <div className="font-serif text-lg font-bold text-[#132a13]">24x7</div>
                <div className="text-[11px] text-[#716b5f]">Resident Vet Bay</div>
              </div>
            </div>

            <p className="text-xs text-[#555045] leading-relaxed">
              Nestled near the sacred Simhachalam temple hills, Sri Venkateswara Gaushala is dedicated to nurturing indigenous breeds (Gir, Sahiwal, Ongole, and Punganur). Supported by full solar facilities, automated fresh water troughs, and daily Vedic prayers.
            </p>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowGaushalaModal(false)
                  document.getElementById("featured-cattle-section")?.scrollIntoView({ behavior: "smooth" })
                }}
                className="px-5 py-2.5 rounded-full bg-[#132a13] text-white text-xs font-semibold cursor-pointer"
              >
                Explore Sanctuary Cattle &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 4: Sponsor Cattle Feed ----------------- */}
      {showFeedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#132a13] text-white text-[10px] font-bold uppercase tracking-wider">
                  Gau Grass Seva
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  Sponsor Nutritious Cattle Feed
                </h3>
              </div>
              <button
                onClick={() => setShowFeedModal(false)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#635d51]">
              Select a nutrition contribution for verified gaushalas. All proceeds are directly disbursed into escrow and certified with 80G tax receipts.
            </p>

            <div className="space-y-2 text-xs">
              {[
                { label: "Fresh Green Grass Fodder (25 kg)", price: 250 },
                { label: "Sacred Grain & Mineral Nutrition Mix (15 kg)", price: 500 },
                { label: "Full Gaushala Daily Feast (100 kg feed)", price: 1500 },
                { label: "1-Month Gau Seva Nutrition Patron", price: 5000 },
              ].map((tier, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    addToast(`Sponsored ${tier.label} (₹ ${tier.price})! Thank you for your devotion.`, "success")
                    setShowFeedModal(false)
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#ded5c6] hover:border-[#132a13] transition-all cursor-pointer group"
                >
                  <span className="font-medium text-[#2d2a24]">{tier.label}</span>
                  <span className="font-bold text-[#132a13] group-hover:underline">&#8377; {tier.price}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-[#7e7769] flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Includes digital proof of feeding from the sanctuary manager.</span>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 5: Special Seva Packages ----------------- */}
      {showSevaPackagesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#c2611b] text-white text-[10px] font-bold uppercase tracking-wider">
                  Ceremonial Seva
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  Special Seva Packages
                </h3>
              </div>
              <button
                onClick={() => setShowSevaPackagesModal(false)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { title: "Griha Pravesh & Vastu Blessing", desc: "Auspicious holy cow & calf at your doorstep", price: 2500 },
                { title: "Birthday & Wedding Anniversary Seva", desc: "Consecrated puja, feeding ritual & blessings", price: 1800 },
                { title: "Gopashtami & Deepavali Maha Seva", desc: "Traditional flower adornment, havan & prasad", price: 3500 },
                { title: "Navagraha Shanti & Kamadhenu Aradhana", desc: "Vedic ritual with certified purohit & cow", price: 2100 },
              ].map((pkg, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setShowSevaPackagesModal(false)
                    onSignIn()
                  }}
                  className="p-3 rounded-xl bg-white border border-[#ded5c6] hover:border-[#c2611b] transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-bold text-[#1b1c1b]">{pkg.title}</h4>
                    <span className="font-bold text-[#c2611b]">&#8377; {pkg.price}</span>
                  </div>
                  <p className="text-[11px] text-[#716b5f] mt-1">{pkg.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 6: Corporate Partnerships ----------------- */}
      {showCorporateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#132a13] text-white text-[10px] font-bold uppercase tracking-wider">
                  CSR &amp; ESG Partnerships
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  Corporate Gaushala Adoption
                </h3>
              </div>
              <button
                onClick={() => setShowCorporateModal(false)}
                className="h-8 w-8 rounded-full bg-[#eee7db] hover:bg-[#ded4c4] grid place-items-center text-[#5f5b52]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#555045]">
              Partner with GOMAA for certified corporate ESG initiatives: gaushala solarization, organic compost plants, and employee team seva retreats.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                addToast("Corporate inquiry submitted! Our partnership director will contact you within 24 hours.", "success")
                setShowCorporateModal(false)
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-[#1b1c1b] mb-1">Company / Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Consultancy Services / Infosys Foundation"
                  className="w-full px-3 py-2 rounded-lg border border-[#d8cfbe] bg-white text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1b1c1b] mb-1">Official Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="csr@organization.com"
                  className="w-full px-3 py-2 rounded-lg border border-[#d8cfbe] bg-white text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-[#132a13] text-white font-semibold cursor-pointer mt-2"
              >
                Submit CSR Proposal Request &rarr;
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 7: Blog Article Reader ----------------- */}
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

      {/* ----------------- MODAL 8: How It Works ----------------- */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fbf9f4] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d8cfbe] space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#132a13] text-white text-[10px] font-bold uppercase tracking-wider">
                  Ethical Operations Protocol
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1b1c1b] mt-1">
                  How GOMAA Works End-to-End
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
                { step: "1", title: "Select Verified Cattle & Muhurat", desc: "Choose an indigenous mother cow, calf, or bull from your regional sanctuary with transparent per-day dakshina." },
                { step: "2", title: "Escrow-Protected Booking", desc: "Your seva contribution is held securely in escrow until seva is fulfilled under AWBI guidelines." },
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

      {/* ----------------- Location Picker Modal ----------------- */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        currentCity={currentCity}
        currentAddress={`Hub: ${currentCity}`}
        onSelectHub={handleSelectHub}
        onDetectGPS={async () => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                addToast(`GPS Detected (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`, "success")
              },
              () => addToast("GPS access unavailable, selected Visakhapatnam by default", "warn")
            )
          }
        }}
        isDetectingGPS={false}
      />
    </div>
  )
}
