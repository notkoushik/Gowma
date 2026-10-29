import crypto from "crypto"

const DEV_FALLBACK_JWT_SECRET =
  "gomaa_secure_jwt_secret_shield_prod_2026_pan_india_vedic_cow_sanctuary_987654321"

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.GOMAA_JWT_SECRET || process.env.GOMAA_JWT_SECRET.length < 32)
) {
  throw new Error(
    "[FATAL SECURITY] In production, GOMAA_JWT_SECRET is mandatory and must be a high-entropy secret at least 32 characters long."
  )
}

export const JWT_SECRET =
  process.env.GOMAA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  DEV_FALLBACK_JWT_SECRET

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
  uniqueId?: string
  name: string
  email: string
  phone?: string
  role: "super_admin" | "admin" | "manager" | "customer" | "driver"
  dbRole: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "GOSALA_MANAGER" | "CUSTOMER" | "DRIVER"
  gosalaIds: string[]
  gosalaNames: string[]
  adminId?: string
  originalRole?: "super_admin" | "admin"
  isContextSwitched?: boolean
  contextSwitchedAt?: number
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

export interface ResetTokenPayload {
  purpose: "PASSWORD_RESET"
  identifier: string
  otpId: string
  iat?: number
  exp?: number
}

/**
 * Sign a single-use Password Reset Token (10 min expiry)
 */
export function signResetToken(
  payload: Omit<ResetTokenPayload, "iat" | "exp">,
  expiresInSeconds: number = 600,
): string {
  const header = { alg: "HS256", typ: "JWT" }
  const nowSec = Math.floor(Date.now() / 1000)
  const fullPayload: ResetTokenPayload = {
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

  return `${dataToSign}.${base64UrlEncode(signature)}`
}

/**
 * Verify a single-use Password Reset Token
 */
export function verifyResetToken(
  token: string,
): { valid: boolean; payload?: ResetTokenPayload; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token missing" }
  }

  const parts = token.trim().split(".")
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed token format" }
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const dataToSign = `${encodedHeader}.${encodedPayload}`

  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(dataToSign)
    .digest()
  const expectedEncoded = base64UrlEncode(expectedSignature)

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
    const payload: ResetTokenPayload = JSON.parse(payloadStr)
    const nowSec = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: "Token has expired", payload }
    }
    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, error: err.message || "Malformed payload JSON" }
  }
}
