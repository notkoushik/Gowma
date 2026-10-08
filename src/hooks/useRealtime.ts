import { useEffect, useState, useRef } from "react"
import {
  wsClient,
  type GpsTickPayload,
  type RoleAlertPayload,
} from "../services/websocket"
import { useStore } from "../store/store"
import type { Booking } from "../data/mock"

interface UseRealtimeOptions {
  bookingId?: string
  gosalaName?: string
  channels?: string[]
  onGpsTick?: (tick: GpsTickPayload) => void
  onRoleAlert?: (alert: RoleAlertPayload) => void
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    bookingId,
    gosalaName,
    channels = [],
    onGpsTick,
    onRoleAlert,
  } = options
  const {
    currentRole,
    notify,
    patchBookingFromWs,
    refreshAnimals,
    refreshGosalas,
    activeProfile,
    authUser,
  } = useStore()
  const [isConnected, setIsConnected] = useState(wsClient.isConnected)
  const [lastGpsTick, setLastGpsTick] = useState<GpsTickPayload | null>(null)

  // Stable callback refs
  const onGpsTickRef = useRef(onGpsTick)
  onGpsTickRef.current = onGpsTick
  const onRoleAlertRef = useRef(onRoleAlert)
  onRoleAlertRef.current = onRoleAlert

  useEffect(() => {
    // Determine channels to subscribe
    const subs = new Set<string>(channels)

    if (bookingId) {
      subs.add(`channel:booking:${bookingId}`)
    }

    if (currentRole === "super_admin") {
      subs.add("channel:super_admin")
    } else if (currentRole === "admin") {
      subs.add("channel:admin")
    } else if (currentRole === "manager") {
      if (gosalaName) {
        subs.add(`channel:gosala:${gosalaName}`)
      }
    } else if (currentRole === "driver") {
      const driverName = activeProfile?.name || authUser?.name
      if (driverName) {
        subs.add(`channel:driver:${driverName}`)
      }
    }

    // Always listen to animals channel for catalog synchronization
    subs.add("channel:animals")

    // Connect WebSocket
    wsClient.connect()

    // Subscribe to each channel
    subs.forEach((ch) => wsClient.subscribe(ch))

    // Listen to connection status
    const unConn = wsClient.on("connection_status", (data) => {
      setIsConnected(data.connected)
    })

    // Listen to GPS ticks
    const unGps = wsClient.on("GPS_TICK", (data: GpsTickPayload) => {
      if (!bookingId || data.bookingId === bookingId) {
        setLastGpsTick(data)
        onGpsTickRef.current?.(data)
      }
    })

    // Listen to Role Alerts
    const unAlert = wsClient.on("ROLE_ALERT", (data: RoleAlertPayload) => {
      onRoleAlertRef.current?.(data)
      const tone =
        data.priority === "URGENT"
          ? "err"
          : data.priority === "HIGH"
            ? "warn"
            : "ok"
      notify(`${data.title}: ${data.message}`, tone)
    })

    // Listen to Booking Updates
    const unBooking = wsClient.on(
      "BOOKING_UPDATED",
      (data: { booking: Booking }) => {
        if (data.booking && patchBookingFromWs) {
          patchBookingFromWs(data.booking)
        }
      },
    )

    // Listen to Stage Changes
    const unStage = wsClient.on(
      "STAGE_CHANGED",
      (data: { bookingId: string; stage: number; status?: any }) => {
        if (data.bookingId && patchBookingFromWs) {
          patchBookingFromWs({
            id: data.bookingId,
            driverStage: data.stage,
            ...(data.status ? { status: data.status } : {}),
          } as any)
        }
      },
    )

    // Listen to Animal & Gaushala roster changes
    const unAnimal = wsClient.on("ANIMAL_REGISTERED", () => {
      refreshAnimals?.().catch(() => {})
    })
    const unAnimalUpd = wsClient.on("ANIMAL_UPDATED", () => {
      refreshAnimals?.().catch(() => {})
    })
    const unAnimalDel = wsClient.on("ANIMAL_DELETED", () => {
      refreshAnimals?.().catch(() => {})
    })
    const unGosalaUpd = wsClient.on("GOSALA_UPDATED", () => {
      refreshGosalas?.().catch(() => {})
    })

    return () => {
      unConn()
      unGps()
      unAlert()
      unBooking()
      unStage()
      unAnimal()
      unAnimalUpd()
      unAnimalDel()
      unGosalaUpd()
      subs.forEach((ch) => wsClient.unsubscribe(ch))
    }
  }, [bookingId, currentRole, gosalaName, channels.join(","), refreshAnimals, refreshGosalas])

  return {
    isConnected,
    lastGpsTick,
    sendTelemetry: (payload: any) => {
      if (bookingId) {
        wsClient.send({
          action: "DRIVER_TELEMETRY",
          channel: `channel:booking:${bookingId}`,
          payload,
        })
      }
    },
  }
}
