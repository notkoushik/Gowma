export const tripStages = [
  "Assigned",
  "Go to Pickup",
  "Arrived",
  "Animal Picked Up",
  "Start Transport",
  "Arrived at Customer",
  "Service Started",
  "Completed / Return",
] as const

export type TripStage = typeof tripStages[number]

export type Trip = {
  id: string
  bookingId: string
  customer: string
  phone: string
  animal: string
  animalType: string
  gosala: string
  pickup: string
  drop: string
  date: string
  window: string
  distanceKm: number
  stageIndex: number
}

export const trips: Trip[] = [
  {
    id: "TRIP-5521",
    bookingId: "GMA-24814",
    customer: "Vikram Joshi",
    phone: "+91 90045 71230",
    animal: "Kesari",
    animalType: "Calf",
    gosala: "Gopal Gaushala Trust",
    pickup: "Gopal Gaushala Trust, Wagholi",
    drop: "Lane 5, Kalyani Nagar, Pune",
    date: "26 Sep 2026",
    window: "09:00 – 10:00",
    distanceKm: 6.8,
    stageIndex: 6,
  },
  {
    id: "TRIP-5522",
    bookingId: "GMA-24815",
    customer: "Meera Kulkarni",
    phone: "+91 98765 00921",
    animal: "Lakshmi",
    animalType: "Cow",
    gosala: "Shri Krishna Gaushala",
    pickup: "Shri Krishna Gaushala, Bavdhan",
    drop: "Sr 8, Viman Nagar, Pune",
    date: "26 Sep 2026",
    window: "11:00 – 12:30",
    distanceKm: 9.1,
    stageIndex: 1,
  },
  {
    id: "TRIP-5523",
    bookingId: "GMA-24817",
    customer: "Ananya Deshmukh",
    phone: "+91 98204 11827",
    animal: "Gauri",
    animalType: "Cow",
    gosala: "Shri Krishna Gaushala",
    pickup: "Shri Krishna Gaushala, Bavdhan",
    drop: "14 Tulsi Nagar, Kothrud, Pune",
    date: "26 Sep 2026",
    window: "14:00 – 16:00",
    distanceKm: 12.4,
    stageIndex: 0,
  },
]
