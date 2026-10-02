import { WebSocketServer } from "ws"
import type { Server } from "node:http"
import { wsHub } from "./hub.ts"

export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true })

  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url || ""
    if (url === "/ws" || url.startsWith("/ws")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req)
      })
    }
  })

  wss.on("connection", (ws) => {
    wsHub.register(ws)
  })

  wsHub.startHeartbeat()
  return wss
}
