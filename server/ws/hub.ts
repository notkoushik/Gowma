import type { WebSocket } from "ws"
import type { ClientMessage, ServerMessage, ServerEventType } from "./types.ts"

class WebSocketHub {
  private clients = new Map<WebSocket, Set<string>>()
  private channels = new Map<string, Set<WebSocket>>()
  private isAliveMap = new WeakMap<WebSocket, boolean>()

  register(ws: WebSocket) {
    this.clients.set(ws, new Set<string>())
    this.isAliveMap.set(ws, true)

    ws.on("pong", () => {
      this.isAliveMap.set(ws, true)
    })

    ws.on("message", (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString("utf-8"))
        this.handleMessage(ws, msg)
      } catch (err: any) {
        this.send(ws, {
          event: "ERROR",
          data: { message: "Invalid JSON frame received", error: err.message },
        })
      }
    })

    ws.on("close", () => {
      this.unregister(ws)
    })

    ws.on("error", () => {
      this.unregister(ws)
    })
  }

  unregister(ws: WebSocket) {
    const subs = this.clients.get(ws)
    if (subs) {
      for (const ch of subs) {
        const set = this.channels.get(ch)
        if (set) {
          set.delete(ws)
          if (set.size === 0) this.channels.delete(ch)
        }
      }
    }
    this.clients.delete(ws)
  }

  subscribe(ws: WebSocket, channel: string) {
    if (!channel || typeof channel !== "string") return

    let clientSubs = this.clients.get(ws)
    if (!clientSubs) {
      clientSubs = new Set<string>()
      this.clients.set(ws, clientSubs)
    }
    clientSubs.add(channel)

    let chSet = this.channels.get(channel)
    if (!chSet) {
      chSet = new Set<WebSocket>()
      this.channels.set(channel, chSet)
    }
    chSet.add(ws)

    this.send(ws, {
      event: "SUBSCRIBED",
      channel,
      data: { channel, activeSubscribers: chSet.size },
    })
  }

  unsubscribe(ws: WebSocket, channel: string) {
    const clientSubs = this.clients.get(ws)
    if (clientSubs) clientSubs.delete(channel)

    const chSet = this.channels.get(channel)
    if (chSet) {
      chSet.delete(ws)
      if (chSet.size === 0) this.channels.delete(channel)
    }

    this.send(ws, {
      event: "UNSUBSCRIBED",
      channel,
      data: { channel },
    })
  }

  broadcastToChannel(channel: string, event: ServerEventType, data: any) {
    const chSet = this.channels.get(channel)
    if (!chSet || chSet.size === 0) return

    const payload = JSON.stringify({ event, channel, data })
    for (const ws of chSet) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload)
      }
    }
  }

  broadcastToAll(event: ServerEventType, data: any) {
    const payload = JSON.stringify({ event, data })
    for (const [ws] of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload)
      }
    }
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage) {
    switch (msg.action) {
      case "PING":
        this.send(ws, { event: "PONG", data: { timestamp: Date.now() } })
        break

      case "SUBSCRIBE":
        if (msg.channel) this.subscribe(ws, msg.channel)
        break

      case "UNSUBSCRIBE":
        if (msg.channel) this.unsubscribe(ws, msg.channel)
        break

      case "DRIVER_TELEMETRY":
        if (msg.channel && msg.payload) {
          this.broadcastToChannel(msg.channel, "GPS_TICK", msg.payload)
        }
        break

      default:
        this.send(ws, {
          event: "ERROR",
          data: { message: `Unknown client action: ${(msg as any).action}` },
        })
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  startHeartbeat(intervalMs = 25000) {
    const interval = setInterval(() => {
      for (const [ws] of this.clients) {
        if (!this.isAliveMap.get(ws)) {
          ws.terminate()
          this.unregister(ws)
          continue
        }
        this.isAliveMap.set(ws, false)
        ws.ping()
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      activeChannels: this.channels.size,
      channelNames: Array.from(this.channels.keys()),
    }
  }
}

export const wsHub = new WebSocketHub()
