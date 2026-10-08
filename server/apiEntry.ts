import { handleApiRequest } from "./router.ts"

function resolveRequestUrl(req: any): string {
  const rawUrl = req.url || ""
  let parsed: URL
  try {
    parsed = new URL(rawUrl, "http://localhost")
  } catch {
    parsed = new URL("/api", "http://localhost")
  }

  // 1. If rewritten by vercel.json with __api_path
  if (parsed.searchParams.has("__api_path")) {
    const apiPath = parsed.searchParams.get("__api_path") || ""
    parsed.searchParams.delete("__api_path")
    const cleanSubpath = apiPath.replace(/^\/+|\/+$/g, "")
    const reconstructedPath = cleanSubpath ? `/api/${cleanSubpath}` : "/api"
    const remainingQuery = parsed.searchParams.toString()
    return remainingQuery ? `${reconstructedPath}?${remainingQuery}` : reconstructedPath
  }

  // 2. Check headers
  const matchedPath = (req.headers?.["x-matched-path"] as string) || ""
  if (matchedPath.startsWith("/api") && !matchedPath.includes("index.js")) {
    const remainingQuery = parsed.searchParams.toString()
    return remainingQuery ? `${matchedPath}?${remainingQuery}` : matchedPath
  }

  const fwdUri = (req.headers?.["x-forwarded-uri"] as string) || ""
  if (fwdUri.startsWith("/api")) {
    return fwdUri
  }

  // 3. Fallback normalization
  let pathname = parsed.pathname
  if (!pathname.startsWith("/api")) {
    pathname = "/api" + (pathname.startsWith("/") ? "" : "/") + pathname
  }

  const query = parsed.searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

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

  const requestUrl = resolveRequestUrl(req)

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
