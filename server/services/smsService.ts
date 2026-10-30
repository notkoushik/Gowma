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
  /** WITHDRAWAL uses its own approved MSG91 template (MSG91_TEMPLATE_WITHDRAWAL_OTP). */
  purpose?: "PASSWORD_RESET" | "WITHDRAWAL"
}

/** Indian mobile number as 10 digits, or "" when it is not one. */
export function indianMobile(toPhone: string): string {
  const d = String(toPhone || "").replace(/\D/g, "")
  if (d.length === 12 && d.startsWith("91")) return d.slice(2)
  if (d.length === 10) return d
  return ""
}

/**
 * Sends a notification SMS through MSG91's template (Flow) API. Indian rules require every
 * message to use a DLT-approved template, so this needs a template id from MSG91 and sends
 * the values for the template's variables (var1, var2, ...). With no key or template it does nothing.
 */
export async function sendTemplateSms({
  toPhone,
  templateId,
  vars = {},
}: {
  toPhone: string
  templateId: string
  vars?: Record<string, string>
}): Promise<SmsResult> {
  const authKey = (process.env.MSG91_AUTH_KEY || "").trim()
  const mobile = indianMobile(toPhone)
  if (!authKey || !templateId) return { success: false, error: "MSG91 is not configured for this message" }
  if (!mobile) return { success: false, error: "No valid Indian mobile number on this account" }
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: authKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: `91${mobile}`, ...vars }],
      }),
    })
    const data: any = await res.json().catch(() => ({}))
    if (res.ok && data?.type === "success") return { success: true, provider: "msg91" as any, messageId: data.message }
    return { success: false, error: data?.message || `MSG91 HTTP ${res.status}` }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/** True when MSG91 WhatsApp is set up (number, namespace and auth key all present). */
export function whatsappConfigured(): boolean {
  return Boolean(
    (process.env.MSG91_AUTH_KEY || "").trim() &&
      (process.env.MSG91_WHATSAPP_NUMBER || "").trim() &&
      (process.env.MSG91_WHATSAPP_NAMESPACE || "").trim(),
  )
}

/**
 * Sends a WhatsApp message through an approved MSG91 template. `vars` fill {{1}}, {{2}}, ... in order.
 * Meta rejects variables containing line breaks, tabs or long runs of spaces, so those are flattened.
 */
export async function sendWhatsAppTemplate({
  toPhone,
  template,
  vars,
  language = "en",
  urlButtonValue,
}: {
  toPhone: string
  template: string
  vars: string[]
  language?: string
  /** Authentication templates carry a "copy code" button that must be given the same code again. */
  urlButtonValue?: string
}): Promise<SmsResult> {
  if (!whatsappConfigured()) return { success: false, error: "MSG91 WhatsApp is not configured" }
  const mobile = indianMobile(toPhone)
  if (!mobile) return { success: false, error: "No valid Indian mobile number on this account" }
  const components: Record<string, { type: "text"; value: string }> = {}
  vars.forEach((v, i) => {
    components[`body_${i + 1}`] = { type: "text", value: String(v).replace(/\s+/g, " ").trim().slice(0, 60) || "-" }
  })
  const allComponents: Record<string, any> = { ...components }
  if (urlButtonValue) allComponents.button_1 = { subtype: "url", type: "text", value: urlButtonValue }
  try {
    const res = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: { authkey: (process.env.MSG91_AUTH_KEY || "").trim(), "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        integrated_number: (process.env.MSG91_WHATSAPP_NUMBER || "").trim(),
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: template,
            language: { code: language, policy: "deterministic" },
            namespace: (process.env.MSG91_WHATSAPP_NAMESPACE || "").trim(),
            to_and_components: [{ to: [`91${mobile}`], components: allComponents }],
          },
        },
      }),
    })
    const data: any = await res.json().catch(() => ({}))
    if (res.ok && data?.status !== "fail" && data?.hasError !== true) {
      return { success: true, provider: "msg91" as any, messageId: data?.request_id || data?.data?.request_id || data?.message }
    }
    return { success: false, error: String(data?.errors || data?.message || `MSG91 WhatsApp HTTP ${res.status}`) }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
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
  purpose = "PASSWORD_RESET",
}: SendSmsOptions): Promise<SmsResult> {
  // Clean phone number (e.g. +91 98490 12345 -> 9849012345 for Indian domestic or E.164)
  const rawDigits = toPhone.replace(/\D/g, "")
  const indian10Digits = rawDigits.length === 12 && rawDigits.startsWith("91")
    ? rawDigits.slice(2)
    : rawDigits.length === 10
    ? rawDigits
    : ""
  const e164Phone = toPhone.startsWith("+") ? toPhone.replace(/\s+/g, "") : `+${rawDigits}`

  // Automated tests must never text a real number
  if (process.env.NODE_ENV === "test") return { success: true, provider: "simulated" }

  const msg91AuthKey = (process.env.MSG91_AUTH_KEY || "").trim()
  const msg91TemplateId =
    (purpose === "WITHDRAWAL" ? (process.env.MSG91_TEMPLATE_WITHDRAWAL_OTP || "").trim() : "") ||
    (process.env.MSG91_TEMPLATE_ID || "").trim()
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

  // 4. Fallback: Log for developer inspection and return status. Never log a code in production.
  if (process.env.NODE_ENV === "production") {
    console.error("[SMS] No SMS gateway accepted the message; the code was NOT sent.")
    return { success: false, error: "No SMS gateway available" }
  }
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
