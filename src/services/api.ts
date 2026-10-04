import type {
  Booking,
  PricingConfig,
  GosalaManager,
  Settlement,
} from "../data/mock"

const API_BASE = ""

const TOKEN_KEY = "gomaa_auth_token"

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const authHeaders: Record<string, string> = {}
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(
      errorBody.error || `API error ${res.status}: ${res.statusText}`,
    )
  }
  return res.json()
}

export const api = {
  async login(emailOrPhone: string, roleHint?: string) {
    const data = await request<{ ok: boolean; token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: emailOrPhone, roleHint }),
    })
    if (data.token) {
      setAuthToken(data.token)
    }
    return data
  },

  async getMe() {
    return request<{ ok: boolean; user: any }>("/api/auth/me")
  },

  async getAccounts() {
    return request<{ ok: boolean; accounts: any[] }>("/api/auth/accounts")
  },

  logout() {
    setAuthToken(null)
  },

  async getHealth() {
    return request<{ ok: boolean; timestamp: string }>("/api/health")
  },

  async getAvailability(
    animal: string,
    date: string,
    time: string,
    duration: number = 60,
  ) {
    const q = new URLSearchParams({
      animal,
      date,
      time,
      duration: String(duration),
    })
    return request<{
      available: boolean
      status: string
      bookingId?: string
      customer?: string
      reason?: string
    }>(`/api/availability?${q.toString()}`)
  },

  async holdSlot(params: {
    animal: string
    date: string
    start: string
    durationMin: number
    customerName: string
  }) {
    return request<{ success: boolean; hold?: any; reason?: string }>(
      "/api/hold",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    )
  },

  async releaseHold(holdId: string) {
    return request<{ released: boolean }>("/api/hold/release", {
      method: "POST",
      body: JSON.stringify({ holdId }),
    })
  },

  async calculatePrice(params: {
    baseRate?: number
    durationMin: number
    distanceKm: number
    addonsCost?: number
    discount?: number
    taxPct?: number
    commissionPct?: number
    commissionFlat?: number
    gosalaId?: string
    gosala?: string
    freeKm?: number
    perKm?: number
    extraUnitMin?: number
    extraUnitRate?: number
  }) {
    return request<any>("/api/pricing/calculate", {
      method: "POST",
      body: JSON.stringify(params),
    })
  },

  async getBookings() {
    return request<{ bookings: Booking[] }>("/api/bookings")
  },

  async createBooking(booking: Booking, holdId?: string) {
    return request<{ booking: Booking }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ booking, holdId }),
    })
  },

  async managerDecide(
    id: string,
    confirm: boolean,
    remark: string,
    managerName?: string,
    userId?: string,
  ) {
    return request<{ booking: Booking }>(`/api/bookings/${id}/manager-decide`, {
      method: "POST",
      body: JSON.stringify({ confirm, remark, managerName, userId }),
    })
  },

  async adminDecide(
    id: string,
    confirm: boolean,
    remark: string,
    adminName?: string,
    userId?: string,
  ) {
    return request<{ booking: Booking }>(`/api/bookings/${id}/admin-decide`, {
      method: "POST",
      body: JSON.stringify({ confirm, remark, adminName, userId }),
    })
  },

  async assignDriver(
    id: string,
    driver: string,
    driverDetails?: {
      driverPhone?: string
      driverVehiclePlate?: string
      driverVehicleModel?: string
      driverRating?: number
      driverTotalTrips?: number
      driverAvatar?: string | null
    },
  ) {
    return request<{ booking: Booking }>(`/api/bookings/${id}/assign-driver`, {
      method: "POST",
      body: JSON.stringify({ driver, ...driverDetails }),
    })
  },

  async advanceTripStage(id: string) {
    return request<{ booking: Booking }>(`/api/bookings/${id}/advance-stage`, {
      method: "POST",
    })
  },

  async verifyHandoverOtp(id: string, otp: string) {
    return request<{ success: boolean; message: string; booking: Booking }>(
      `/api/bookings/${id}/verify-handover-otp`,
      {
        method: "POST",
        body: JSON.stringify({ otp }),
      },
    )
  },

  async getManagers() {
    return request<{ managers: GosalaManager[] }>("/api/managers")
  },

  async addManager(mgr: Omit<GosalaManager, "id" | "assignedDate">) {
    return request<{ manager: GosalaManager }>("/api/managers", {
      method: "POST",
      body: JSON.stringify(mgr),
    })
  },

  async updateManager(id: string, patch: Partial<GosalaManager>) {
    return request<{ manager: GosalaManager }>(`/api/managers/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    })
  },

  async toggleManagerStatus(id: string) {
    return request<{ manager: GosalaManager }>(`/api/managers/${id}/toggle`, {
      method: "PATCH",
    })
  },

  async deleteManager(id: string) {
    return request<{ success: boolean }>(`/api/managers/${id}`, {
      method: "DELETE",
    })
  },

  async getPricingConfig() {
    return request<{ config: PricingConfig }>("/api/pricing-config")
  },

  async updatePricingConfig(
    config: Partial<PricingConfig>,
    role: string = "super_admin",
  ) {
    return request<{ config: PricingConfig }>("/api/pricing-config", {
      method: "PUT",
      body: JSON.stringify({ ...config, role }),
    })
  },

  async getSettlements() {
    return request<{ settlements: Settlement[] }>("/api/settlements")
  },

  async advanceSettlement(gosala: string) {
    return request<{ settlement: Settlement }>("/api/settlements/advance", {
      method: "POST",
      body: JSON.stringify({ gosala }),
    })
  },

  async approveSettlementBatch(batch: string) {
    return request<{ success: boolean; batch: string }>(
      "/api/settlements/batch-approve",
      {
        method: "POST",
        body: JSON.stringify({ batch }),
      },
    )
  },

  async toggleSlotBlock(animal: string, date: string, time: string) {
    return request<{ key: string; blocked: string[] }>(
      "/api/slots/toggle-block",
      {
        method: "POST",
        body: JSON.stringify({ animal, date, time }),
      },
    )
  },

  async setTripStage(id: string, stage: number) {
    return request<{ booking: Booking }>(`/api/bookings/${id}/set-stage`, {
      method: "POST",
      body: JSON.stringify({ stage }),
    })
  },

  async sendTelemetry(id: string, payload: any) {
    return request<{ ok: boolean }>(`/api/bookings/${id}/telemetry`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  async getDriverLocation(bookingId: string) {
    return request<{ ok: boolean; location: any }>(
      `/api/bookings/${bookingId}/driver-location`,
    )
  },

  async updateAnimalStatus(
    name: string,
    status: string,
    reason?: string,
    cooldownMinutes?: number,
  ) {
    return request<{ success: boolean; animal: string; status: string }>(
      `/api/animals/${encodeURIComponent(name)}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status, reason, cooldownMinutes }),
      },
    )
  },

  async getCustomerDetails(bookingId: string) {
    return request<{ ok: boolean; details: any }>(
      `/api/bookings/${bookingId}/customer-details`,
    )
  },

  async getProfiles() {
    return request<{ profiles: Record<string, any> }>("/api/profiles")
  },

  async getProfile(role: string) {
    return request<{ profile: any }>(`/api/profiles/${role}`)
  },

  async updateProfile(role: string, data: any) {
    return request<{ success: boolean; profile: any }>(`/api/profiles/${role}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  async getGosalas() {
    return request<{ ok: boolean; gosalas: any[] }>("/api/gosalas")
  },

  async createGosala(data: any) {
    return request<{ ok: boolean; gosala: any }>("/api/gosalas", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateGosala(id: string, data: any) {
    return request<{ ok: boolean; gosala: any }>(
      `/api/gosalas/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    )
  },

  async deleteGosala(id: string) {
    return request<{ ok: boolean; deleted: string }>(
      `/api/gosalas/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    )
  },

  async getAnimals() {
    return request<{ ok: boolean; animals: any[] }>("/api/animals")
  },

  async createAnimal(animal: any) {
    return request<{ ok: boolean; animal: any }>("/api/animals", {
      method: "POST",
      body: JSON.stringify(animal),
    })
  },

  async updateAnimal(name: string, data: any) {
    return request<{ ok: boolean; animal: any }>(
      `/api/animals/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    )
  },

  async deleteAnimal(name: string) {
    return request<{ ok: boolean; deleted: string }>(
      `/api/animals/${encodeURIComponent(name)}`,
      {
        method: "DELETE",
      },
    )
  },

  async getVets() {
    return request<{ ok: boolean; vets: any[] }>("/api/vets")
  },

  async createVet(vet: any) {
    return request<{ ok: boolean; vet: any }>("/api/vets", {
      method: "POST",
      body: JSON.stringify(vet),
    })
  },

  async updateVet(id: string, data: any) {
    return request<{ ok: boolean; vet: any }>(
      `/api/vets/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    )
  },

  async deleteVet(id: string) {
    return request<{ ok: boolean; deleted: string }>(
      `/api/vets/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    )
  },

  async executeSettlementSweep(options?: {
    gosala?: string
    cycleType?: "CONTINUOUS_T_PLUS_ONE" | "WEEKLY"
  }) {
    return request<{
      success: boolean
      disbursedBatches: any[]
      totalDisbursed: number
      totalRetained: number
      cycle: string
      message: string
    }>("/api/settlements/sweep", {
      method: "POST",
      body: JSON.stringify(options || {}),
    })
  },

  async getSettlementSchedule() {
    return request<{
      schedule: {
        autoSweepEnabled: boolean
        disbursementCycle: "CONTINUOUS_T_PLUS_ONE" | "WEEKLY"
        nextScheduledRun: string
        lastSweepAt: string | null
        totalBatchesPaid: number
        totalDisbursedAmount: number
        pendingEscrowAmount: number
        activeCustodianPool: string
      }
    }>("/api/settlements/schedule")
  },

  async configureSettlementSchedule(config: {
    autoSweepEnabled?: boolean
    disbursementCycle?: "CONTINUOUS_T_PLUS_ONE" | "WEEKLY"
  }) {
    return request<{ success: boolean; schedule: any }>(
      "/api/settlements/schedule/configure",
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    )
  },
}
