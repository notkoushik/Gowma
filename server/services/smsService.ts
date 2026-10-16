/**
 * SMS & Mobile OTP Dispatch Gateway for GOMAA
 * Supports Indian Phone Numbers (+91) via:
 * 1. Fast2SMS (Instant Indian OTP route, zero DLT required for testing)
 * 2. Twilio (Global & Indian SMS / WhatsApp)
 * 3. Out-of-band console simulation for local development & staging
 */

import nodemailer from "nodemailer"

interface SendSmsOptions {
  toPhone: string
  otp: string
  expiryMinutes?: number
}

interface SmsResult {
  success: boolean
  provider?: "fast2sms" | "twilio" | "simulated"
  messageId?: string
  error?: string
  simulated?: boolean
}

export async function sendOtpSms({
  toPhone,
  otp,
  expiryMinutes = 10,
}: SendSmsOptions): Promise<SmsResult> {
  // Clean phone number (e.g. +91 98490 12345 -> 9849012345 for Indian domestic or E.164)
  const rawDigits = toPhone.replace(/\D/g, "")
  const indian10Digits = rawDigits.length === 12 && rawDigits.startsWith("91")
    ? rawDigits.slice(2)
    : rawDigits.length === 10
    ? rawDigits
    : ""
  const e164Phone = toPhone.startsWith("+") ? toPhone.replace(/\s+/g, "") : `+${rawDigits}`

  const msg91AuthKey = (process.env.MSG91_AUTH_KEY || "").trim()
  const msg91TemplateId = (process.env.MSG91_TEMPLATE_ID || "").trim()
  const fast2smsKey = (process.env.FAST2SMS_API_KEY || "").trim()
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || "").trim()
  const twilioAuth = (process.env.TWILIO_AUTH_TOKEN || "").trim()
  const twilioFrom = (process.env.TWILIO_PHONE_NUMBER || "").trim()

  // 1. MSG91 (Enterprise Indian OTP Gateway)
  if (msg91AuthKey && indian10Digits) {
    try {
      const templateParam = msg91TemplateId ? `&template_id=${encodeURIComponent(msg91TemplateId)}` : ""
      const url = `https://control.msg91.com/api/v5/otp?mobile=91${indian10Digits}&authkey=${encodeURIComponent(msg91AuthKey)}&otp=${encodeURIComponent(otp)}${templateParam}`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await res.json().catch(() => ({}))
      if (data?.type === "success" || res.ok) {
        return { success: true, provider: "msg91" as any, messageId: data.message }
      }
      console.warn("[MSG91 Notice]:", data)
    } catch (err: any) {
      console.error("[MSG91 Error]:", err.message)
    }
  }

  // 2. Fast2SMS (India domestic OTP route)
  if (fast2smsKey && indian10Digits) {
    try {
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: otp,
          numbers: indian10Digits,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (data?.return === true) {
        return { success: true, provider: "fast2sms", messageId: data.request_id }
      }
      console.warn("[Fast2SMS Notice]:", data)
    } catch (err: any) {
      console.error("[Fast2SMS Error]:", err.message)
    }
  }

  // 3. Twilio SMS (Global & Indian carrier gateway)
  if (twilioSid && twilioAuth && twilioFrom) {
    try {
      const basicAuth = Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")
      const params = new URLSearchParams()
      params.append("To", e164Phone)
      params.append("From", twilioFrom)
      params.append("Body", `Your GOMAA verification code is: ${otp}. Valid for ${expiryMinutes} minutes. Never share this code.`)

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      )

      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.sid) {
        return { success: true, provider: "twilio", messageId: data.sid }
      }
      console.warn("[Twilio SMS Notice]:", data)
    } catch (err: any) {
      console.error("[Twilio Error]:", err.message)
    }
  }

  // 4. Fallback: Out-of-band delivery + Gmail notification
  console.log(`\n========================================================================`)
  console.log(`[MOBILE SMS OTP DISPATCH] Out-of-band delivery to: ${toPhone}`)
  console.log(`[VERIFICATION CODE] ${otp}`)
  console.log(`[EXPIRY] Valid for ${expiryMinutes} minutes.`)
  console.log(`[LIVE DISPATCH NOTE] Configure MSG91_AUTH_KEY, FAST2SMS_API_KEY, or TWILIO credentials in Vercel to dispatch live SMS to carrier handsets.`)
  console.log(`========================================================================\n`)

  const gmailUser = (process.env.GMAIL_USER || "").trim()
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "")

  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      })
      await transporter.sendMail({
        from: `"GOMAA Operations" <${gmailUser}>`,
        to: gmailUser,
        subject: `[GOMAA Mobile SMS OTP for ${toPhone}]: ${otp}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e6e0d4; border-radius: 8px; padding: 28px;">
            <div style="font-size: 18px; font-weight: bold; color: #d97706; margin-bottom: 8px;">GOMAA Mobile SMS Verification</div>
            <p style="font-size: 13.5px; color: #444; line-height: 1.5;">
              A mobile verification code was requested for phone number: <strong>${toPhone}</strong>.
            </p>
            <div style="background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0;">
              <div style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 0.25em; color: #b45309;">${otp}</div>
              <div style="font-size: 11.5px; color: #78716c; margin-top: 6px;">Expires in ${expiryMinutes} minutes</div>
            </div>
            <p style="font-size: 12px; color: #666; background: #f5f5f4; border-radius: 4px; padding: 10px;">
              <strong>Developer Notice:</strong> Delivered to your verified developer email (${gmailUser}) via Gmail SMTP for instant zero-cost testing.
            </p>
          </div>
        `,
      })
      console.log(`[SMS Gmail Backup Success]: Delivered OTP for ${toPhone} to ${gmailUser} via Gmail SMTP`)
    } catch (e: any) {
      console.warn("[SMS Gmail Backup Notice]:", e.message)
    }
  }

  return { success: true, provider: "simulated", simulated: true }
}
