import type { Plugin } from "vite"
import { handleApiRequest } from "./router.ts"
import { setupWebSocketServer } from "./ws/server.ts"

export function gOMAABackendPlugin(): Plugin {
  return {
    name: "gomaa-backend-api",
    configureServer(server) {
      if (server.httpServer) {
        setupWebSocketServer(server.httpServer as any)
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) {
          return next()
        }

        const chunks: Buffer[] = []
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
        req.on("end", async () => {
          const rawBody = Buffer.concat(chunks).toString("utf-8")
          try {
            const result = await handleApiRequest(
              req.method || "GET",
              req.url || "",
              rawBody,
              req.headers,
            )
            if (!result) {
              res.statusCode = 404
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: "Endpoint not handled" }))
              console.log(`\x1b[33m[API 404]\x1b[0m ${req.method} ${req.url}`)
              return
            }

            res.statusCode = result.status
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify(result.body))

            // Filter out repetitive high-frequency poller logs to keep terminal clean and readable
            const isBackgroundPoll =
              req.url?.includes("/driver-location") ||
              req.url?.includes("/health")

            if (!isBackgroundPoll) {
              const methodColor =
                req.method === "POST"
                  ? "\x1b[35m" // Magenta for actions/posts
                  : req.method === "DELETE"
                    ? "\x1b[31m" // Red
                    : "\x1b[36m" // Cyan for gets

              console.log(
                `\x1b[32m[API ${result.status}]\x1b[0m ${methodColor}${req.method}\x1b[0m ${req.url}`,
              )
            }
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader("Content-Type", "application/json")
            res.end(
              JSON.stringify({ error: err.message || "Internal server error" }),
            )
            console.error(
              `\x1b[31m[API 500]\x1b[0m ${req.method} ${req.url} Error:`,
              err.message,
            )
          }
        })
      })
    },
  }
}
