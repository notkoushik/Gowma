export type ClientActionType = "SUBSCRIBE" | "UNSUBSCRIBE" | "PING" | "DRIVER_TELEMETRY"

export type ClientMessage = {
  action: ClientActionType
  channel?: string
  payload?: any
}

export type ServerEventType =
  | "SUBSCRIBED"
  | "UNSUBSCRIBED"
  | "PONG"
  | "ERROR"
  | "ROLE_ALERT"
  | "BOOKING_UPDATED"
  | "GPS_TICK"
  | "STAGE_CHANGED"
  | "ANIMAL_STATUS_CHANGED"
  | "ANIMAL_REGISTERED"
  | "ANIMAL_UPDATED"
  | "ANIMAL_DELETED"
  | "VET_UPDATED"
  | "GOSALA_REGISTERED"
  | "GOSALA_UPDATED"
  | "GOSALA_DELETED"
  | "HANDOVER_VERIFIED"
  | "SETTLEMENT_SWEEP_EXECUTED"

export type GpsTickPayload = {
  bookingId: string
  lat: number
  lng: number
  bearing: number // 0-360 degrees
  speedKmh: number
  etaMinutes: number
  distanceRemainingKm: number
  stage: number
  stageLabel: string
  timestamp: number
}

export type RoleAlertPayload = {
  targetRole: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "GOSALA_MANAGER" | "DRIVER" | "CUSTOMER"
  title: string
  message: string
  bookingId?: string
  gosalaId?: string
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  timestamp: string
}

export type ServerMessage = {
  event: ServerEventType
  channel?: string
  data: any
}
