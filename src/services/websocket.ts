export type ServerEventType = "SUBSCRIBED" | "UNSUBSCRIBED" | "PONG" | "ERROR" | "ROLE_ALERT" | "BOOKING_UPDATED" | "GPS_TICK" | "STAGE_CHANGED"

export type GpsTickPayload = {
  bookingId: string
  lat: number
  lng: number
  bearing: number
  speedKmh: number
  etaMinutes: number
  distanceRemainingKm: number
  stage: number
  stageLabel: string
  timestamp: number
}

export type RoleAlertPayload = {
  targetRole: string
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

type MessageHandler = (data: any, channel?: string) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private channels = new Set<string>()
  private listeners = new Map<string, Set<MessageHandler>>()
  private reconnectTimeout: any = null
  private pingInterval: any = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private isExplicitlyClosed = false
  public isConnected = false

  constructor() {
    // Lazy connect on demand or on first subscription
  }

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    this.isExplicitlyClosed = false
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${window.location.host}/ws`

    try {
      this.ws = new WebSocket(wsUrl)
    } catch (e) {
      console.warn("[WS] Failed to instantiate WebSocket:", e)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emitInternal("connection_status", { connected: true })

      // Resubscribe to all active channels
      for (const channel of this.channels) {
        this.send({ action: "SUBSCRIBE", channel })
      }

      // Start ping heartbeat
      this.startPing()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        this.handleServerMessage(msg)
      } catch (err) {
        console.error("[WS] Failed to parse message:", err, event.data)
      }
    }

    this.ws.onclose = () => {
      this.isConnected = false
      this.stopPing()
      this.emitInternal("connection_status", { connected: false })
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (err) => {
      console.warn("[WS] Socket error:", err)
      this.ws?.close()
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    if (msg.event === "PONG") return

    // Emit event by event type (e.g. "GPS_TICK", "BOOKING_UPDATED")
    const eventListeners = this.listeners.get(msg.event)
    if (eventListeners) {
      eventListeners.forEach((fn) => fn(msg.data, msg.channel))
    }

    // Emit event by channel (e.g. "channel:booking:BK-001")
    if (msg.channel) {
      const channelListeners = this.listeners.get(msg.channel)
      if (channelListeners) {
        channelListeners.forEach((fn) => fn(msg.data, msg.channel))
      }
    }

    // Wildcard listeners
    const wildcardListeners = this.listeners.get("*")
    if (wildcardListeners) {
      wildcardListeners.forEach((fn) => fn(msg.data, msg.channel))
    }
  }

  subscribe(channel: string) {
    if (!channel) return
    this.channels.add(channel)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ action: "SUBSCRIBE", channel })
    } else {
      this.connect()
    }
  }

  unsubscribe(channel: string) {
    if (!channel) return
    this.channels.delete(channel)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ action: "UNSUBSCRIBE", channel })
    }
  }

  on(eventOrChannel: string, handler: MessageHandler) {
    let set = this.listeners.get(eventOrChannel)
    if (!set) {
      set = new Set()
      this.listeners.set(eventOrChannel, set)
    }
    set.add(handler)
    return () => this.off(eventOrChannel, handler)
  }

  off(eventOrChannel: string, handler: MessageHandler) {
    const set = this.listeners.get(eventOrChannel)
    if (set) {
      set.delete(handler)
      if (set.size === 0) {
        this.listeners.delete(eventOrChannel)
      }
    }
  }

  send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  private emitInternal(event: string, data: any) {
    const set = this.listeners.get(event)
    if (set) {
      set.forEach((fn) => fn(data))
    }
  }

  private startPing() {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      this.send({ action: "PING" })
    }, 20000)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || this.isExplicitlyClosed) return
    this.reconnectAttempts++
    const delay = Math.min(
      1000 * Math.pow(1.5, this.reconnectAttempts - 1),
      10000,
    )
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.connect()
    }, delay)
  }

  close() {
    this.isExplicitlyClosed = true
    this.stopPing()
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }
}

export const wsClient = new WebSocketClient()
