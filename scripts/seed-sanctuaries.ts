import { prisma } from "../server/prisma"

export const INITIAL_SANCTUARIES = [
  {
    name: "Govardhan Goseva Trust",
    region: "Cyberabad / Gachibowli (HITEC City)",
    address: "Survey 44, Near Financial District, Gachibowli, Hyderabad, Telangana 500032",
    contactPhone: "+91 98490 12345",
    contactEmail: "govardhan.trust@gomaa.in",
    latitude: 17.4401,
    longitude: 78.3489,
    isActive: true,
  },
  {
    name: "Sri Radha Krishna Gaushala",
    region: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
    address: "Road No. 12, Near Lotus Pond, Banjara Hills, Hyderabad, Telangana 500034",
    contactPhone: "+91 98491 67890",
    contactEmail: "radhakrishna.hyd@gomaa.in",
    latitude: 17.4156,
    longitude: 78.4358,
    isActive: true,
  },
  {
    name: "Shri Krishna Gaushala",
    region: "Pune West (Kothrud)",
    address: "Survey No 48, Paud Road, Near Chandani Chowk, Kothrud, Pune, Maharashtra 411038",
    contactPhone: "+91 98220 12345",
    contactEmail: "shrikrishna.pune@gomaa.in",
    latitude: 18.5074,
    longitude: 73.8077,
    isActive: true,
  },
  {
    name: "Nandini Goseva Sadan",
    region: "Pune North (Baner / Pashan)",
    address: "Plot 12, Baner-Pashan Link Road, Baner, Pune, Maharashtra 411045",
    contactPhone: "+91 98221 54321",
    contactEmail: "nandini.sadan@gomaa.in",
    latitude: 18.559,
    longitude: 73.7868,
    isActive: true,
  },
  {
    name: "Gopal Gaushala Trust",
    region: "Pune East (Hadapsar)",
    address: "Saswad Road, Near Handewadi Chowk, Hadapsar, Pune, Maharashtra 411028",
    contactPhone: "+91 98222 99887",
    contactEmail: "gopal.trust@gomaa.in",
    latitude: 18.4967,
    longitude: 73.9417,
    isActive: true,
  },
]

export const INITIAL_ANIMALS = [
  {
    name: "Surabhi",
    type: "COW",
    breed: "Gir",
    gosalaName: "Sri Radha Krishna Gaushala",
    photo: "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800&auto=format&fit=crop",
    healthStatus: "HEALTHY",
    age: "5 years",
    temperament: "Very Gentle, Devotional, Child-friendly",
    sacredMarkings: "Shrivatsa curl on forehead, Auspicious golden hue coat",
    lactationStatus: "In Milk (2nd Lactation)",
    dietRequirements: "Organic green fodder, soaked chana, jaggery water",
    baseRate: 3800,
  },
  {
    name: "Gopala",
    type: "BULL",
    breed: "Sahiwal",
    gosalaName: "Govardhan Goseva Trust",
    photo: "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=800&auto=format&fit=crop",
    healthStatus: "HEALTHY",
    age: "4 years",
    temperament: "Majestic, Calm, Accustomed to temple pradakshina",
    sacredMarkings: "White crescent tilak mark on forehead, Prominent dewlap",
    lactationStatus: "Not Applicable",
    dietRequirements: "Dry wheat straw, dry fruits, fresh barseem",
    baseRate: 4000,
  },
  {
    name: "Kamadhenu",
    type: "COW_AND_CALF",
    breed: "Gir",
    gosalaName: "Shri Krishna Gaushala",
    photo: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=800&auto=format&fit=crop",
    healthStatus: "HEALTHY",
    age: "6 years (with 4-month calf)",
    temperament: "Motherly, Extremely Affectionate, Ideal for Griha Pravesh",
    sacredMarkings: "Panchagavya golden sheen coat with white switch tail",
    lactationStatus: "Mother in active nursing",
    dietRequirements: "Green Napier grass, groundnut cake, mineral mixture",
    baseRate: 4800,
  },
  {
    name: "Nandini",
    type: "COW",
    breed: "Kapila",
    gosalaName: "Shri Krishna Gaushala",
    photo: "https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800&auto=format&fit=crop",
    healthStatus: "HEALTHY",
    age: "4.5 years",
    temperament: "Serene, Peaceful, Temple-trained",
    sacredMarkings: "Pure unblemished Kapila brown coat, Auspicious ears",
    lactationStatus: "Dry Period (Resting Mother)",
    dietRequirements: "Sweet sudan grass, jaggery cubes, turmeric water",
    baseRate: 3500,
  },
  {
    name: "Balarama",
    type: "BULL",
    breed: "Khillari",
    gosalaName: "Nandini Goseva Sadan",
    photo: "https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=800&auto=format&fit=crop",
    healthStatus: "HEALTHY",
    age: "5 years",
    temperament: "Sturdy, Traditional, Auspicious for Gho-Pooja",
    sacredMarkings: "Sharp backward curved horns, White forehead star",
    lactationStatus: "Not Applicable",
    dietRequirements: "Maize fodder, cotton seed cake, fresh clean well water",
    baseRate: 3800,
  },
  {
    name: "Radha",
    type: "COW",
    breed: "Rathi",
    gosalaName: "Gopal Gaushala Trust",
    photo: "https://images.unsplash.com/photo-1596733430284-f7437764b14d?w=800&auto=format&fit=crop",
    healthStatus: "HEALTHY",
    age: "3.5 years",
    temperament: "Playful, Loving, Highly responsive to Vedic chanting",
    sacredMarkings: "Brown and white spotted coat, Gentle eyes",
    lactationStatus: "1st Lactation",
    dietRequirements: "Leguminous fodder, wheat bran mash, rock salt lick",
    baseRate: 3400,
  },
]

export async function seedSanctuaries() {
  console.log("🌱 Starting Seeding of Real Gaushalas & Bovines...")
  try {
    for (const g of INITIAL_SANCTUARIES) {
      const created = await prisma.gosala.upsert({
        where: { name: g.name },
        create: g,
        update: g,
      })
      console.log(`✅ Gaushala upserted: ${created.name} (${created.region})`)
    }

    const allGosalas = await prisma.gosala.findMany()
    const gosalaMap = new Map(allGosalas.map((g) => [g.name, g.id]))

    for (const a of INITIAL_ANIMALS) {
      const gosalaId = gosalaMap.get(a.gosalaName)
      if (!gosalaId) continue

      await prisma.animal.upsert({
        where: {
          gosalaId_name: {
            gosalaId,
            name: a.name,
          },
        },
        create: {
          name: a.name,
          type: (a.type === "COW_AND_CALF" ? "COW" : a.type) as any,
          breed: a.breed,
          ageYears: parseInt(a.age) || 5,
          healthStatus: a.healthStatus as any,
          gosalaId,
          isActive: true,
        },
        update: {
          type: (a.type === "COW_AND_CALF" ? "COW" : a.type) as any,
          breed: a.breed,
          ageYears: parseInt(a.age) || 5,
          healthStatus: a.healthStatus as any,
          gosalaId,
          isActive: true,
        },
      })
      console.log(`🐄 Bovine upserted: ${a.name} (${a.breed}) -> ${a.gosalaName}`)
    }

    console.log("🎉 Seeding completed successfully!")
  } catch (err: any) {
    console.error("❌ Seeding failed:", err.message)
  }
}

if (process.argv[1]?.includes("seed-sanctuaries")) {
  seedSanctuaries().then(() => process.exit(0))
}
