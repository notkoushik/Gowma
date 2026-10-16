import { WebSocketServer } from "ws"
import type { WebSocket } from "ws"
import type { IncomingMessage } from "node:http"
import type { Server } from "node:http"
import { wsHub } from "./hub.ts"
import { getAuthUserFromHeader } from "../auth/authService.ts"
import type { JwtPayload } from "../auth/jwt.ts"

export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true })

  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url || ""
    const auth = getAuthUserFromHeader(req.headers.authorization)
    if ((url === "/ws" || url.startsWith("/ws")) && auth) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, auth)
      })
    } else if (url === "/ws" || url.startsWith("/ws")) {
      socket.destroy()
    }
  })

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, auth: JwtPayload) => {
    wsHub.register(ws, auth)
  })

  wsHub.startHeartbeat()
  return wss
}
