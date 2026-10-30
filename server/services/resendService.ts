/**
 * Resend Email Gateway Service for GOMAA
 * Works over native HTTPS fetch — 100% compatible with Vercel Serverless Functions.
 * 
 * Free tier provides 3,000 emails/month (100 emails/day) with zero credit card required.
 */

interface SendOtpEmailOptions {
  toEmail: string
  userName?: string
  otp: string
  expiryMinutes?: number
  /** "WITHDRAWAL" words the email for a payout confirmation instead of a password reset. */
  purpose?: "PASSWORD_RESET" | "WITHDRAWAL"
  detail?: string
}

interface ResendSendResult {
  success: boolean
  id?: string
  error?: string
  simulated?: boolean
}

import nodemailer from "nodemailer"
import dns from "node:dns"

// Uses native getaddrinfo with Google IPv4 fallback

export async function sendOtpEmail({
  toEmail,
  userName = "Devotee",
  otp,
  expiryMinutes = 10,
  purpose = "PASSWORD_RESET",
  detail = "",
}: SendOtpEmailOptions): Promise<ResendSendResult> {
  const normEmail = toEmail.trim().toLowerCase()

  // For test harness mock domains (.test / .example)
  if (normEmail.endsWith(".test") || normEmail.endsWith(".example") || normEmail.includes("example.com")) {
    console.log(`[Test Mock Dispatch] OTP for ${normEmail}: ${otp}`)
    return { success: true, id: `<test-${Date.now()}@gomaa.test>`, simulated: true }
  }

  const subject = `Your GOMAA Verification Code: ${otp}`
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GOMAA Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f0; margin: 0; padding: 24px; color: #201c16; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e6e0d4; padding: 36px 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid #f0ebe0; padding-bottom: 16px; }
    .logo-badge { width: 36px; height: 36px; background-color: #d97706; color: #ffffff; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; }
    .brand-title { font-size: 20px; font-weight: 700; color: #201c16; margin: 0; }
    .brand-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #78716c; margin: 2px 0 0 0; }
    .greeting { font-size: 15px; font-weight: 600; color: #201c16; margin-bottom: 8px; }
    .lead-text { font-size: 13.5px; line-height: 1.5; color: #44403c; margin-bottom: 24px; }
    .otp-container { background: #fffbeb; border: 1.5px dashed #f59e0b; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #b45309; }
    .otp-hint { font-size: 11.5px; color: #78716c; margin-top: 6px; }
    .security-notice { font-size: 12px; line-height: 1.5; color: #78716c; background: #f5f5f4; border-radius: 4px; padding: 12px 14px; margin-top: 24px; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #a8a29e; border-top: 1px solid #f0ebe0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">G</div>
      <div>
        <h1 class="brand-title">GOMAA</h1>
        <p class="brand-sub">Sacred Operations &amp; Welfare Platform</p>
      </div>
    </div>
    
    <div class="greeting">Namaste ${userName},</div>
    <p class="lead-text">
      ${purpose === "WITHDRAWAL"
        ? `We received a request to withdraw money from your GOMAA wallet${detail ? ` (${detail})` : ""}. Enter the single-use code below to confirm it:`
        : "We received a request to verify your identity and reset your account password on the GOMAA platform. Please use the single-use verification code below:"}
    </p>

    <div class="otp-container">
      <div class="otp-code">${otp}</div>
      <div class="otp-hint">Expires in ${expiryMinutes} minutes · Never share this code with anyone</div>
    </div>

    <div class="security-notice">
      <strong>Security Alert:</strong> ${purpose === "WITHDRAWAL"
        ? "If you did not ask to withdraw money, do not share this code with anyone and tell the Super Admin straight away. No money moves until the code is entered."
        : "If you did not initiate this password recovery request, your account may be secure, but someone may have typed your email address by mistake. You can safely ignore this email; no changes have been made to your credentials."}
    </div>

    <div class="footer">
      GOMAA Sacred Operations Platform · Governed by Vedic Care &amp; Multi-Tenant Platform Security
    </div>
  </div>
</body>
</html>
`

  const text = `Namaste ${userName},\n\n${
    purpose === "WITHDRAWAL"
      ? `Your GOMAA code to confirm a withdrawal${detail ? ` of ${detail}` : ""} is: ${otp}`
      : `Your GOMAA verification code is: ${otp}`
  }\n\nThis single-use code expires in ${expiryMinutes} minutes.\nNever share this code with anyone.\n\n${
    purpose === "WITHDRAWAL"
      ? "If you did not ask to withdraw money, tell the Super Admin straight away. No money moves until the code is entered."
      : "If you did not request this, you can safely ignore this email."
  }\n\n— GOMAA Operations\nSacred Operations & Cattle Welfare Platform`

  // 1. Direct Gmail SMTP (Google App Password)
  const gmailUser = (process.env.GMAIL_USER || "").replace(/["']/g, "").trim()
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/["'\s]/g, "").trim()

  if (gmailUser && gmailPass) {
    try {
      const hostIp = await new Promise<string>((resolve) => {
        dns.lookup("smtp.gmail.com", { family: 4 }, (err, address) => {
          if (!err && address) {
            resolve(address)
          } else {
            resolve("192.178.211.108")
          }
        })
      })

      const transporter = nodemailer.createTransport({
        host: hostIp,
        port: 465,
        secure: true,
        tls: { servername: "smtp.gmail.com" },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      })

      const info = await transporter.sendMail({
        from: `"GOMAA Security" <${gmailUser}>`,
        to: toEmail,
        subject: purpose === "WITHDRAWAL" ? `[GOMAA] Withdrawal confirmation code: ${otp}` : `[GOMAA] Verification Code: ${otp}`,
        text,
        html,
        headers: {
          "X-Priority": "1",
          "Priority": "urgent",
          "Importance": "high",
        },
      })

      console.log(`[Gmail SMTP Success] OTP sent to ${toEmail} (MessageId: ${info.messageId})`)
      return { success: true, id: info.messageId }
    } catch (err: any) {
      console.error("[Gmail SMTP Error]:", err.message)
    }
  }

  // 2. Resend API
  const apiKey = (process.env.RESEND_API_KEY || "").trim()
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "GOMAA Operations <onboarding@resend.dev>").trim()

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error("[Resend API Error]:", data)
        if (process.env.NODE_ENV !== "production") console.log(`[FALLBACK CODE DISPATCH] OTP for ${toEmail}: ${otp}`)
        return {
          success: false,
          error: data.message || `Resend HTTP ${res.status}`,
        }
      }

      console.log(`[Resend Success] Email OTP sent to ${toEmail} (MessageId: ${data.id})`)
      return {
        success: true,
        id: data.id,
      }
    } catch (err: any) {
      console.error("[Resend Fetch Error]:", err.message)
      return {
        success: false,
        error: err.message,
      }
    }
  }

  // 3. Fallback: Out-of-band console simulation for testing & dev. Never in production: a code in a log is a leaked code,
  // and pretending an email was sent would lock people out silently.
  if (process.env.NODE_ENV === "production") {
    console.error("[EMAIL] No email gateway is configured; the code was NOT sent.")
    return { success: false, error: "No email gateway configured" }
  }
  console.log(`\n========================================================================`)
  console.log(`[EMAIL DISPATCH NOTICE] Neither GMAIL_APP_PASSWORD nor RESEND_API_KEY configured.`)
  console.log(`[OUT-OF-BAND DISPATCH] Password Reset OTP for ${toEmail}: ${otp}`)
  console.log(`[EXPIRY] Valid for ${expiryMinutes} minutes. Set GMAIL_APP_PASSWORD or RESEND_API_KEY for live emails.`)
  console.log(`========================================================================\n`)
  return { success: true, simulated: true }
}

// ---------------------------------------------------------------------------
// General notification email (not a code). Gmail first, then Resend, same as above.
// ---------------------------------------------------------------------------

interface SendNotificationEmailOptions {
  toEmail: string
  subject: string
  text: string
  /** Recipient's first name, used by the MSG91 email template's greeting */
  name?: string
}

/**
 * MSG91 email: needs a verified sending domain and one approved template using the variables
 * ##name##, ##title## and ##message##. Set MSG91_EMAIL_DOMAIN, MSG91_EMAIL_FROM and MSG91_EMAIL_TEMPLATE_ID.
 */
function msg91EmailConfigured() {
  return Boolean(
    (process.env.MSG91_AUTH_KEY || "").trim() &&
      (process.env.MSG91_EMAIL_DOMAIN || "").trim() &&
      (process.env.MSG91_EMAIL_FROM || "").trim() &&
      (process.env.MSG91_EMAIL_TEMPLATE_ID || "").trim(),
  )
}

async function sendViaMsg91Email(to: string, name: string, subject: string, text: string): Promise<ResendSendResult> {
  try {
    const res = await fetch("https://control.msg91.com/api/v5/email/send", {
      method: "POST",
      headers: { authkey: (process.env.MSG91_AUTH_KEY || "").trim(), "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        recipients: [{ to: [{ name: name || to, email: to }], variables: { name: name || "Devotee", title: subject, message: text } }],
        from: { name: "GOMAA", email: (process.env.MSG91_EMAIL_FROM || "").trim() },
        domain: (process.env.MSG91_EMAIL_DOMAIN || "").trim(),
        template_id: (process.env.MSG91_EMAIL_TEMPLATE_ID || "").trim(),
      }),
    })
    const data: any = await res.json().catch(() => ({}))
    if (res.ok && data?.status !== "fail" && data?.hasError !== true) return { success: true, id: data?.data?.unique_id || data?.message }
    return { success: false, error: String(data?.errors || data?.message || `MSG91 email HTTP ${res.status}`) }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function notificationHtml(subject: string, text: string) {
  const body = escapeHtml(text)
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.55;color:#44403c">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e0d4;border-radius:8px;padding:28px 28px 20px">
<div style="font-size:18px;font-weight:700;color:#201c16;margin-bottom:4px">GOMAA</div>
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#78716c;margin-bottom:20px">${escapeHtml(subject)}</div>
${body}
<div style="margin-top:22px;padding-top:14px;border-top:1px solid #f0ebe0;font-size:11px;color:#a8a29e">GOMAA Sacred Operations Platform. This is an automated message.</div>
</div></body></html>`
}

export async function sendNotificationEmail({ toEmail, subject, text, name }: SendNotificationEmailOptions): Promise<ResendSendResult> {
  const to = toEmail.trim().toLowerCase()
  if (!to || to.endsWith(".invalid") || to.endsWith(".test") || to.endsWith(".example") || to.includes("example.com")) {
    return { success: true, simulated: true }
  }
  const html = notificationHtml(subject, text)

  // MSG91 first when it is set up; on any failure fall through to Gmail, then Resend
  if (msg91EmailConfigured()) {
    const r = await sendViaMsg91Email(to, name || "", subject, text)
    if (r.success) return r
    console.warn(`[MSG91 email] not sent, trying fallback: ${r.error}`)
  }

  const gmailUser = (process.env.GMAIL_USER || "").replace(/["']/g, "").trim()
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/["'\s]/g, "").trim()
  if (gmailUser && gmailPass) {
    try {
      const hostIp = await new Promise<string>((resolve) => {
        dns.lookup("smtp.gmail.com", { family: 4 }, (err, address) => resolve(!err && address ? address : "192.178.211.108"))
      })
      const transporter = nodemailer.createTransport({
        host: hostIp,
        port: 465,
        secure: true,
        tls: { servername: "smtp.gmail.com" },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        auth: { user: gmailUser, pass: gmailPass },
      })
      const info = await transporter.sendMail({ from: `"GOMAA" <${gmailUser}>`, to, subject: `[GOMAA] ${subject}`, text, html })
      return { success: true, id: info.messageId }
    } catch (err: any) {
      console.error("[Gmail SMTP notification error]:", err.message)
    }
  }

  const apiKey = (process.env.RESEND_API_KEY || "").trim()
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "GOMAA Operations <onboarding@resend.dev>").trim()
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to: [to], subject: `[GOMAA] ${subject}`, html, text }),
      })
      const data: any = await res.json().catch(() => ({}))
      if (!res.ok) return { success: false, error: data.message || `Resend HTTP ${res.status}` }
      return { success: true, id: data.id }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  console.log(`[EMAIL NOT SENT: no Gmail or Resend configured] To: ${to} | ${subject}`)
  return { success: false, error: "No email gateway configured" }
}
