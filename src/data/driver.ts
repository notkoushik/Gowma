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
  handoverOtp?: string
  handoverOtpVerified?: boolean
  handoverOtpVerifiedAt?: string | null
}

// 0 hardcoded trips - dynamically populated from bookings
export const trips: Trip[] = []

