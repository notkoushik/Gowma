import { handleApiRequest } from "./router.ts"

export default async function handler(req: any, res: any) {
  // CORS support
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization")

  if (req.method === "OPTIONS") {
    res.statusCode = 204
    res.end()
    return
  }

  // Determine requested URL path
  let requestUrl = req.url || ""
  if (req.query?.path) {
    if (Array.isArray(req.query.path)) {
      requestUrl = `/api/${req.query.path.join("/")}`
    } else if (typeof req.query.path === "string") {
      requestUrl = `/api/${req.query.path}`
    }
  } else if (req.headers["x-matched-path"] && typeof req.headers["x-matched-path"] === "string") {
    requestUrl = req.headers["x-matched-path"]
  } else if (req.headers["x-forwarded-uri"] && typeof req.headers["x-forwarded-uri"] === "string") {
    requestUrl = req.headers["x-forwarded-uri"]
  }

  // Preserve query string if present
  const originalUrl = req.url || ""
  const qIdx = originalUrl.indexOf("?")
  if (qIdx !== -1 && !requestUrl.includes("?")) {
    requestUrl += originalUrl.slice(qIdx)
  }

  // Handle incoming body
  let rawBody = ""
  if (req.body) {
    rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body)
  } else {
    try {
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
      }
      rawBody = Buffer.concat(chunks).toString("utf-8")
    } catch {
      rawBody = ""
    }
  }

  try {
    const result = await handleApiRequest(
      req.method || "GET",
      requestUrl,
      rawBody,
      req.headers,
    )

    if (!result) {
      res.statusCode = 404
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ error: `Endpoint not found: ${req.method} ${requestUrl}` }))
      return
    }

    res.statusCode = result.status
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify(result.body))
  } catch (err: any) {
    console.error("[Vercel API Error]:", err)
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: err.message || "Internal server error" }))
  }
}
