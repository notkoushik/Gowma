import { prisma } from "../prisma.ts"
import { hashPassword, verifyPassword } from "../auth/password.ts"
import { signResetToken, verifyResetToken } from "../auth/jwt.ts"
import { sendOtpEmail } from "./resendService.ts"
import crypto from "node:crypto"

export interface OtpRequestResult {
  ok: boolean
  message: string
  channel: "EMAIL" | "PHONE"
  maskedTarget: string
}

export interface VerifyOtpResult {
  ok: boolean
  resetToken: string
  message: string
}

export interface ResetPasswordResult {
  ok: boolean
  message: string
  user: {
    id: string
    name: string
    email: string
  }
}

function maskIdentifier(id: string, channel: "EMAIL" | "PHONE"): string {
  if (channel === "EMAIL" || id.includes("@")) {
    const [local, domain] = id.split("@")
    if (!domain) return id
    const visible = local.length > 2 ? local[0] + "***" + local[local.length - 1] : local[0] + "***"
    return `${visible}@${domain}`
  } else {
    // Phone mask e.g. +91 98****1234
    const clean = id.replace(/\s+/g, "")
    if (clean.length > 6) {
      return clean.slice(0, 4) + "******" + clean.slice(-2)
    }
    return id
  }
}

export function hashOtp(otp: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = crypto.scryptSync(otp, salt, 32)
  return `scrypt$${salt}$${derived.toString("hex")}`
}

export function verifyOtpHash(otp: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith("scrypt$")) return false
  const parts = storedHash.split("$")
  if (parts.length !== 3) return false
  const [, salt, digest] = parts
  if (!salt || !digest) return false
  const derived = crypto.scryptSync(otp, salt, 32).toString("hex")
  const bufExpected = Buffer.from(digest)
  const bufActual = Buffer.from(derived)
  return bufExpected.length === bufActual.length && crypto.timingSafeEqual(bufExpected, bufActual)
}

/**
 * Request a One-Time Password for password recovery
 */
export async function requestPasswordResetOtp(
  emailOrPhone: string,
  channel: "EMAIL" | "PHONE" = "EMAIL",
  ipAddress?: string
): Promise<OtpRequestResult> {
  const norm = emailOrPhone.trim().toLowerCase()
  if (!norm) {
    throw new Error("Registered email or phone number is required")
  }

  // 1. Verify that user exists in PostgreSQL database
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: norm, mode: "insensitive" } },
        { phone: { equals: norm, mode: "insensitive" } },
      ],
      isActive: true,
    },
  })

  // To prevent user enumeration in public API, if user doesn't exist, we return success without dispatching
  if (!user) {
    return {
      ok: true,
      message: "If your account is registered, a 6-digit verification code has been dispatched.",
      channel,
      maskedTarget: maskIdentifier(norm, channel),
    }
  }

  // 2. Rate Limiting: Max 3 OTP requests per 15 minutes per identifier
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const recentCountRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM "verification_otps" 
     WHERE "identifier" = $1 AND "purpose" = 'PASSWORD_RESET' AND "createdAt" > $2`,
    user.email.toLowerCase(),
    fifteenMinutesAgo
  )
  const recentCount = recentCountRows[0]?.count || 0
  if (recentCount >= 3) {
    throw new Error("Too many verification requests. Please wait 15 minutes before requesting another code.")
  }

  // 3. Generate high-entropy 6-digit numeric OTP
  const rawOtp = crypto.randomInt(100000, 999999).toString()
  const otpHash = hashOtp(rawOtp)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes TTL
  const otpId = crypto.randomUUID()

  // 4. Save to PostgreSQL database
  await prisma.$executeRawUnsafe(
    `INSERT INTO "verification_otps" 
     ("id", "identifier", "otpHash", "channel", "purpose", "attempts", "maxAttempts", "expiresAt", "used", "ipAddress", "createdAt") 
     VALUES ($1, $2, $3, $4, 'PASSWORD_RESET', 0, 5, $5, false, $6, NOW())`,
    otpId,
    user.email.toLowerCase(),
    otpHash,
    channel,
    expiresAt,
    ipAddress || null
  )

  // 5. Out-of-band delivery
  if (channel === "EMAIL") {
    await sendOtpEmail({
      toEmail: user.email,
      userName: user.name,
      otp: rawOtp,
      expiryMinutes: 10,
    })
  } else {
    // Phone channel (for SMS delivery or Firebase integration)
    console.log(`\n[SMS OTP DISPATCH] 6-digit code for ${user.phone}: ${rawOtp}`)
  }

  return {
    ok: true,
    message: `A 6-digit verification code has been dispatched to ${maskIdentifier(user.email, channel)}.`,
    channel,
    maskedTarget: maskIdentifier(user.email, channel),
  }
}

/**
 * Verify submitted OTP and issue a scoped, single-use Reset Token
 */
export async function verifyOtpAndGenerateResetToken(
  emailOrPhone: string,
  submittedOtp: string
): Promise<VerifyOtpResult> {
  const norm = emailOrPhone.trim().toLowerCase()
  const cleanOtp = (submittedOtp || "").trim()

  if (!norm || !cleanOtp) {
    throw new Error("Email/phone and 6-digit verification code are required")
  }

  // Find latest active, unused OTP for identifier
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "verification_otps" 
     WHERE "identifier" = $1 AND "purpose" = 'PASSWORD_RESET' AND "used" = false AND "expiresAt" > NOW() 
     ORDER BY "createdAt" DESC LIMIT 1`,
    norm
  )

  const record = rows[0]
  if (!record) {
    throw new Error("Verification code has expired or was not found. Please request a new code.")
  }

  if (record.attempts >= record.maxAttempts) {
    throw new Error("Maximum incorrect attempts exceeded. This code has been invalidated for security. Please request a new code.")
  }

  // Verify scrypt hash
  const isValid = verifyOtpHash(cleanOtp, record.otpHash)
  if (!isValid) {
    // Increment attempt counter
    await prisma.$executeRawUnsafe(
      `UPDATE "verification_otps" SET "attempts" = "attempts" + 1 WHERE "id" = $1`,
      record.id
    )
    const remaining = record.maxAttempts - (record.attempts + 1)
    throw new Error(`Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Code locked."}`)
  }

  // Issue scoped JWT reset token valid for 10 minutes
  const resetToken = signResetToken({
    purpose: "PASSWORD_RESET",
    identifier: norm,
    otpId: record.id,
  }, 600)

  return {
    ok: true,
    resetToken,
    message: "Identity verified successfully. You may now set a new password.",
  }
}

/**
 * Securely reset user password using the verified Reset Token
 */
export async function resetPasswordWithToken(
  emailOrPhone: string,
  resetToken: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  const norm = emailOrPhone.trim().toLowerCase()
  if (!norm || !resetToken || !newPassword) {
    throw new Error("Email, reset token, and new password are required")
  }

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long")
  }

  // Cryptographically verify the reset token
  const verified = verifyResetToken(resetToken)
  if (!verified.valid || !verified.payload || verified.payload.purpose !== "PASSWORD_RESET") {
    throw new Error("Invalid or expired reset token. Please restart the verification process.")
  }

  if (verified.payload.identifier.toLowerCase() !== norm) {
    throw new Error("Reset token does not match the requested account identity.")
  }

  const otpId = verified.payload.otpId
  if (otpId) {
    // Ensure the OTP hasn't been already consumed
    const otpRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "used" FROM "verification_otps" WHERE "id" = $1`,
      otpId
    )
    if (otpRows[0]?.used === true) {
      throw new Error("This reset token has already been used. Please request a new code.")
    }
  }

  // Find user
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: norm, mode: "insensitive" } },
        { phone: { equals: norm, mode: "insensitive" } },
      ],
      isActive: true,
    },
  })

  if (!user) {
    throw new Error("Account not found")
  }

  // Hash new password using salted scrypt
  const newHash = hashPassword(newPassword)

  // Update password in PostgreSQL
  await prisma.user.update({
    where: { id: user.id },
    data: { password: newHash },
  })

  // Mark OTP as consumed
  if (otpId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "verification_otps" SET "used" = true, "usedAt" = NOW() WHERE "id" = $1`,
      otpId
    )
  }

  console.log(`[SECURITY AUDIT] Password successfully reset for user ${user.email} (${user.id})`)

  return {
    ok: true,
    message: "Password updated successfully. You can now sign in with your new password.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  }
}
