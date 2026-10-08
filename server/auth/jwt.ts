import crypto from "crypto"

const JWT_SECRET =
  process.env.GOMAA_JWT_SECRET ||
  "gomaa_sacred_enterprise_jwt_secret_2026_vedic_welfare_mesh"

function base64UrlEncode(strOrBuffer: string | Buffer): string {
  const buf =
    typeof strOrBuffer === "string" ? Buffer.from(strOrBuffer, "utf-8") : strOrBuffer
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  while (base64.length % 4) {
    base64 += "="
  }
  return Buffer.from(base64, "base64").toString("utf-8")
}

export interface JwtPayload {
  userId: string
  name: string
  email: string
  phone?: string
  role: "super_admin" | "admin" | "manager" | "customer" | "driver"
  dbRole: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "GOSALA_MANAGER" | "CUSTOMER" | "DRIVER"
  gosalaIds: string[]
  gosalaNames: string[]
  adminId?: string
  driverData?: {
    driverId?: string
    vehicleNumber?: string
    vehicleType?: string
    licenseNumber?: string
    gosalaBase?: string
    status?: string
    phone?: string
  }
  customerData?: {
    address?: string
    city?: string
    aadhaarNumber?: string
    preferredCeremony?: string
    totalBookings?: number
  }
  iat?: number
  exp?: number
}

/**
 * Sign a standard RFC 7519 JSON Web Token (HS256)
 */
export function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  expiresInSeconds: number = 7 * 24 * 3600, // 7 days default
): string {
  const header = {
    alg: "HS256",
    typ: "JWT",
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const fullPayload: JwtPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + expiresInSeconds,
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))
  const dataToSign = `${encodedHeader}.${encodedPayload}`

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(dataToSign)
    .digest()
  const encodedSignature = base64UrlEncode(signature)

  return `${dataToSign}.${encodedSignature}`
}

/**
 * Verify and decode an RFC 7519 JSON Web Token
 */
export function verifyJwt(
  token: string,
): { valid: boolean; payload?: JwtPayload; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token missing" }
  }

  const parts = token.trim().split(".")
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed token format" }
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const dataToSign = `${encodedHeader}.${encodedPayload}`

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(dataToSign)
    .digest()
  const expectedEncoded = base64UrlEncode(expectedSignature)

  // Constant-time comparison to prevent timing attacks
  const bufExpected = Buffer.from(expectedEncoded)
  const bufActual = Buffer.from(encodedSignature)

  if (
    bufExpected.length !== bufActual.length ||
    !crypto.timingSafeEqual(bufExpected, bufActual)
  ) {
    return { valid: false, error: "Invalid signature" }
  }

  try {
    const payloadStr = base64UrlDecode(encodedPayload)
    const payload: JwtPayload = JSON.parse(payloadStr)

    const nowSec = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: "Token expired" }
    }

    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, error: err.message || "Invalid payload JSON" }
  }
}
