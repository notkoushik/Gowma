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
}

interface ResendSendResult {
  success: boolean
  id?: string
  error?: string
  simulated?: boolean
}

export async function sendOtpEmail({
  toEmail,
  userName = "Devotee",
  otp,
  expiryMinutes = 10,
}: SendOtpEmailOptions): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY || ""
  const fromEmail = process.env.RESEND_FROM_EMAIL || "GOMAA Operations <onboarding@resend.dev>"

  // If no API key configured (e.g. local development without credentials)
  if (!apiKey || apiKey.trim() === "") {
    console.log(`\n========================================================================`)
    console.log(`[RESEND NOTICE] No RESEND_API_KEY found in environment.`)
    console.log(`[OUT-OF-BAND DISPATCH] Password Reset OTP for ${toEmail}: ${otp}`)
    console.log(`[EXPIRY] Valid for ${expiryMinutes} minutes. Real delivery requires RESEND_API_KEY.`)
    console.log(`========================================================================\n`)
    return { success: true, simulated: true }
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
      We received a request to verify your identity and reset your account password on the GOMAA platform.
      Please use the single-use verification code below:
    </p>

    <div class="otp-container">
      <div class="otp-code">${otp}</div>
      <div class="otp-hint">Expires in ${expiryMinutes} minutes · Never share this code with anyone</div>
    </div>

    <div class="security-notice">
      <strong>Security Alert:</strong> If you did not initiate this password recovery request, your account may be secure, but someone may have typed your email address by mistake. You can safely ignore this email; no changes have been made to your credentials.
    </div>

    <div class="footer">
      GOMAA Sacred Operations Platform · Governed by Vedic Care &amp; Multi-Tenant Platform Security
    </div>
  </div>
</body>
</html>
`

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
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
      return {
        success: false,
        error: data.message || `Resend HTTP ${res.status}`,
      }
    }

    return {
      success: true,
      id: data.id,
    }
  } catch (err: any) {
    console.error("[Resend Dispatch Exception]:", err.message)
    return {
      success: false,
      error: err.message || "Failed to dispatch email via Resend",
    }
  }
}
