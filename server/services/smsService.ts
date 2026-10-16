/**
 * SMS & Mobile OTP Dispatch Gateway for GOMAA
 * Supports Indian Phone Numbers (+91) via:
 * 1. Fast2SMS (Instant Indian OTP route, zero DLT required for testing)
 * 2. Twilio (Global & Indian SMS / WhatsApp)
 * 3. Out-of-band console simulation for local development & staging
 */

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

  // 4. Fallback: Log for developer inspection and return status
  console.log(`\n========================================================================`)
  console.log(`[MOBILE SMS OTP DISPATCH] Out-of-band delivery to: ${toPhone}`)
  console.log(`[VERIFICATION CODE] ${otp}`)
  console.log(`[EXPIRY] Valid for ${expiryMinutes} minutes.`)
  console.log(`========================================================================\n`)

  if (!msg91AuthKey && !fast2smsKey && !twilioSid) {
    return {
      success: false,
      error: "No SMS gateway configured. Please use 'Email Address' verification to receive your code, or configure MSG91 in environment settings.",
    }
  }

  return {
    success: false,
    error: "Carrier SMS failed (Indian Telecom DLT website verification required on Fast2SMS). Please use 'Email Address' verification to receive your 6-digit code.",
  }
}
