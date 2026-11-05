// Curated sacred devotional offering photography presets and smart fallback resolver

export interface OfferingPhotoPreset {
  id: string
  label: string
  category: "puja" | "feed" | "prasadam" | "decoration"
  url: string
  hint: string
}

export const OFFERING_PHOTO_PRESETS: OfferingPhotoPreset[] = [
  {
    id: "preset-marigold",
    label: "Marigold Pooja Mala",
    category: "puja",
    url: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80",
    hint: "Fresh consecrated floral garland",
  },
  {
    id: "preset-fodder",
    label: "Green Grass Fodder",
    category: "feed",
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80",
    hint: "Lush green grass bundle (Grass Seva)",
  },
  {
    id: "preset-vastra",
    label: "Silk Chunni & Vastra",
    category: "decoration",
    url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80",
    hint: "Ceremonial silk drape with golden zari",
  },
  {
    id: "preset-jaggery",
    label: "Devotional Jaggery & Chana",
    category: "feed",
    url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
    hint: "Organic gur and roasted chana plate",
  },
  {
    id: "preset-ghee",
    label: "Pure Vedic A2 Ghee",
    category: "prasadam",
    url: "https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=600&q=80",
    hint: "Traditional bilona churned Gaushala ghee",
  },
  {
    id: "preset-dhoop",
    label: "Natural Gomaye Hawan Dhoop",
    category: "puja",
    url: "https://images.unsplash.com/photo-1606293926075-69a00dbfde81?auto=format&fit=crop&w=600&q=80",
    hint: "Herbal cow dung dhoop cones",
  },
  {
    id: "preset-kalash",
    label: "Pooja Kalash & Tilak Kit",
    category: "puja",
    url: "https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=600&q=80",
    hint: "Brass kalash, kumkum, akshata & bell",
  },
]

export const DEFAULT_OFFERING_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=600&q=80"

/**
 * Returns the offering's image or intelligently resolves to an authentic high-resolution
 * devotional photograph matching the item's name or category.
 */
export function getOfferingImage(
  offering?: {
    name?: string
    category?: string
    image?: string
    imageUrl?: string
  } | null
): string {
  if (!offering) return DEFAULT_OFFERING_FALLBACK_IMAGE

  // Direct custom image (uploaded or linked)
  const direct = (offering.image || offering.imageUrl || "").trim()
  if (direct) return direct

  const name = (offering.name || "").toLowerCase()
  const cat = (offering.category || "").toLowerCase()

  // Match by specific keywords
  if (name.includes("mala") || name.includes("garland") || name.includes("flower") || name.includes("phool") || name.includes("rose") || name.includes("marigold")) {
    return OFFERING_PHOTO_PRESETS[0].url
  }
  if (name.includes("grass") || name.includes("fodder") || name.includes("feed") || name.includes("chara") || name.includes("pasture") || cat === "feed") {
    if (name.includes("jaggery") || name.includes("gur") || name.includes("chana") || name.includes("gram")) {
      return OFFERING_PHOTO_PRESETS[3].url
    }
    return OFFERING_PHOTO_PRESETS[1].url
  }
  if (name.includes("chunni") || name.includes("vastra") || name.includes("silk") || name.includes("cloth") || name.includes("shawl") || name.includes("dupatta") || cat === "decoration") {
    return OFFERING_PHOTO_PRESETS[2].url
  }
  if (name.includes("jaggery") || name.includes("gur") || name.includes("chana") || name.includes("laddoo") || name.includes("sweet")) {
    return OFFERING_PHOTO_PRESETS[3].url
  }
  if (name.includes("ghee") || name.includes("a2") || name.includes("milk") || name.includes("curd") || name.includes("makhan") || name.includes("butter") || cat === "prasadam") {
    return OFFERING_PHOTO_PRESETS[4].url
  }
  if (name.includes("dhoop") || name.includes("agarbatti") || name.includes("incense") || name.includes("hawan") || name.includes("samagri") || name.includes("camphor")) {
    return OFFERING_PHOTO_PRESETS[5].url
  }
  if (name.includes("kalash") || name.includes("tilak") || name.includes("kit") || name.includes("bell") || name.includes("diya") || name.includes("brass") || cat === "puja") {
    return OFFERING_PHOTO_PRESETS[6].url
  }

  return DEFAULT_OFFERING_FALLBACK_IMAGE
}
