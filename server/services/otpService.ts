import { prisma } from "../prisma.ts"
import { hashPassword, verifyPassword } from "../auth/password.ts"
import { signResetToken, verifyResetToken } from "../auth/jwt.ts"
import { sendOtpEmail } from "./resendService.ts"
import { sendOtpSms } from "./smsService.ts"
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

let otpTableVerified = false
export async function ensureOtpTable() {
  if (otpTableVerified) return
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "verification_otps" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "identifier" TEXT NOT NULL,
        "otpHash" TEXT NOT NULL,
        "channel" TEXT NOT NULL DEFAULT 'EMAIL',
        "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "maxAttempts" INTEGER NOT NULL DEFAULT 5,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "used" BOOLEAN NOT NULL DEFAULT false,
        "usedAt" TIMESTAMP(3),
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "verification_otps_identifier_purpose_used_idx" 
          ON "verification_otps"("identifier", "purpose", "used");
      `)
    } catch {}
    otpTableVerified = true
  } catch (err: any) {
    console.warn("[OTP Schema Self-Heal Notice]:", err.message)
  }
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

  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10)

  // Ensure table exists in database
  await ensureOtpTable()

  // 1. Verify that user exists in PostgreSQL database
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, phone: true, name: true },
  })

  const user = activeUsers.find((u) => {
    if (u.email.toLowerCase() === norm) return true
    if (rawDigits.length === 10) {
      const uDigits = (u.phone || "").replace(/\D/g, "").slice(-10)
      if (uDigits && uDigits === rawDigits) return true
    }
    return false
  })

  if (!user) {
    if (channel === "PHONE") {
      throw new Error(`No registered account found with mobile number "${emailOrPhone}". Please verify your 10-digit number or use your registered email address.`)
    } else {
      throw new Error(`No registered account found with email "${norm}". Please check for typos or sign in with your registered account.`)
    }
  }

  // 2. Rate Limiting: Max 5 OTP requests per 15 minutes per identifier
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const recentCountRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM "verification_otps" 
     WHERE "identifier" = $1 AND "purpose" = 'PASSWORD_RESET' AND "createdAt" > $2`,
    user.email.toLowerCase(),
    fifteenMinutesAgo
  )
  const recentCount = recentCountRows[0]?.count || 0
  if (recentCount >= 5) {
    throw new Error("Too many verification requests. Please wait 15 minutes before requesting another code.")
  }

  // 3. Generate high-entropy 6-digit numeric OTP
  const rawOtp = crypto.randomInt(100000, 999999).toString()
  const otpHash = hashOtp(rawOtp)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes TTL
  const otpId = crypto.randomUUID()

  // 4. Save to PostgreSQL database under user email and raw phone digits (if phone)
  const primaryId = channel === "PHONE" && rawDigits.length === 10 ? rawDigits : user.email.toLowerCase()

  await prisma.$executeRawUnsafe(
    `INSERT INTO "verification_otps" 
     ("id", "identifier", "otpHash", "channel", "purpose", "attempts", "maxAttempts", "expiresAt", "used", "ipAddress", "createdAt") 
     VALUES ($1, $2, $3, $4, 'PASSWORD_RESET', 0, 5, $5, false, $6, NOW())`,
    otpId,
    primaryId,
    otpHash,
    channel,
    expiresAt,
    ipAddress || null
  )

  // Also record with user.email if primary was phone digits, ensuring cross-search
  if (primaryId !== user.email.toLowerCase()) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "verification_otps" 
         ("id", "identifier", "otpHash", "channel", "purpose", "attempts", "maxAttempts", "expiresAt", "used", "ipAddress", "createdAt") 
         VALUES ($1, $2, $3, $4, 'PASSWORD_RESET', 0, 5, $5, false, $6, NOW())`,
        crypto.randomUUID(),
        user.email.toLowerCase(),
        otpHash,
        channel,
        expiresAt,
        ipAddress || null
      )
    } catch {}
  }

  // 5. Out-of-band delivery
  if (channel === "EMAIL") {
    const emailResult = await sendOtpEmail({
      toEmail: user.email,
      userName: user.name,
      otp: rawOtp,
      expiryMinutes: 10,
    })
    if (!emailResult.success) {
      console.warn("[Email OTP Dispatch Notice]:", emailResult.error)
    }
  } else {
    // Phone channel (for SMS delivery via Fast2SMS / Twilio / MSG91)
    const smsResult = await sendOtpSms({
      toPhone: user.phone || emailOrPhone,
      otp: rawOtp,
      expiryMinutes: 10,
    })
    if (!smsResult.success) {
      throw new Error(
        smsResult.error ||
        "Carrier SMS dispatch is currently unavailable. Please use 'Email Address' verification to receive your 6-digit code."
      )
    }
  }

  const targetIdentifier = channel === "PHONE" ? (user.phone || emailOrPhone) : user.email

  return {
    ok: true,
    message: `A 6-digit verification code has been dispatched to ${maskIdentifier(targetIdentifier, channel)}.`,
    channel,
    maskedTarget: maskIdentifier(targetIdentifier, channel),
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

  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10)

  await ensureOtpTable()

  // Find user to gather all possible identifiers (email, phone, rawDigits)
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, phone: true, name: true },
  })
  const user = allUsers.find((u) => {
    if (u.email.toLowerCase() === norm) return true
    if (rawDigits.length === 10) {
      const uDigits = (u.phone || "").replace(/\D/g, "").slice(-10)
      if (uDigits && uDigits === rawDigits) return true
    }
    return false
  })

  const lookupIds: string[] = [norm]
  if (rawDigits.length === 10) lookupIds.push(rawDigits)
  if (user) {
    if (user.email) lookupIds.push(user.email.toLowerCase())
    if (user.phone) {
      lookupIds.push(user.phone.toLowerCase())
      const userDigits = user.phone.replace(/\D/g, "").slice(-10)
      if (userDigits.length === 10) lookupIds.push(userDigits)
    }
  }
  const uniqueIds = Array.from(new Set(lookupIds))

  // Find latest active, unused OTP for any of these identifiers
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "verification_otps" 
     WHERE "identifier" = ANY($1::text[]) AND "purpose" = 'PASSWORD_RESET' AND "used" = false AND "expiresAt" > NOW() 
     ORDER BY "createdAt" DESC LIMIT 1`,
    uniqueIds
  )

  const record = rows[0]
  if (!record) {
    throw new Error("No active verification code found for this account. Please click 'Resend Code' to receive a new 6-digit OTP.")
  }

  if (record.attempts >= record.maxAttempts) {
    throw new Error("Maximum incorrect attempts exceeded. This code has been invalidated for security. Please click 'Resend Code'.")
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
    throw new Error(`Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Code locked. Please click 'Resend Code'."}`)
  }

  // Issue scoped JWT reset token valid for 10 minutes
  const resetToken = signResetToken({
    purpose: "PASSWORD_RESET",
    identifier: user ? user.email.toLowerCase() : norm,
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

  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10)

  // Find user
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: norm, mode: "insensitive" } },
        { phone: { equals: norm, mode: "insensitive" } },
        ...(rawDigits.length === 10 ? [{ phone: { contains: rawDigits } }] : []),
      ],
      isActive: true,
    },
  })

  if (!user) {
    throw new Error("Account not found")
  }

  const tokenIdent = (verified.payload.identifier || "").toLowerCase()
  const userEmail = (user.email || "").toLowerCase()
  const userPhone = (user.phone || "").toLowerCase()
  const userPhoneDigits = user.phone ? user.phone.replace(/\D/g, "").slice(-10) : ""

  const matches =
    tokenIdent === norm ||
    tokenIdent === userEmail ||
    tokenIdent === userPhone ||
    (rawDigits.length === 10 && tokenIdent === rawDigits) ||
    (userPhoneDigits && tokenIdent === userPhoneDigits)

  if (!matches) {
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
