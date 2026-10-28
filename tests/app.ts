import http from "node:http"
import { handleApiRequest } from "../server/router.ts"

/**
 * Creates an in-memory Node HTTP server wrapping the GOMAA handleApiRequest router.
 * Allows Supertest to issue real, rugged HTTP requests with full header, body,
 * query string, and status code fidelity.
 */
export function createTestServer() {
  return http.createServer(async (req, res) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", async () => {
      try {
        const response = await handleApiRequest(
          req.method || "GET",
          req.url || "/",
          body,
          req.headers,
        )
        if (!response) {
          res.statusCode = 404
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ ok: false, error: "Route not found" }))
          return
        }

        res.statusCode = response.status
        if (response.headers) {
          for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value as string)
          }
        }
        if (!res.hasHeader("Content-Type")) {
          res.setHeader("Content-Type", "application/json")
        }

        const payload =
          typeof response.body === "string"
            ? response.body
            : JSON.stringify(response.body)
        res.end(payload)
      } catch (err: any) {
        res.statusCode = 500
        res.setHeader("Content-Type", "application/json")
        res.end(
          JSON.stringify({
            ok: false,
            error: err?.message || "Internal Server Error",
          }),
        )
      }
    })
  })
}
