// Sends ONE real test email, and one SMS if you give a phone and the MSG91 template id is set.
//   npm run test:notify -- you@example.com
//   npm run test:notify -- you@example.com 9876543210
import { sendNotificationEmail } from "../server/services/resendService.ts"
import { sendTemplateSms, sendWhatsAppTemplate, whatsappConfigured } from "../server/services/smsService.ts"
import { messages } from "../server/services/notifyService.ts"

const [email, phone] = process.argv.slice(2)
if (!email || !email.includes("@")) {
  console.error("Usage: npm run test:notify -- <your email> [your 10-digit mobile]")
  process.exit(2)
}

const msg = messages.earningsReleased(250000n, "GMA-TEST-1", "Test Gaushala")
console.log(`Sending a test email to ${email} ...`)
const mail = await sendNotificationEmail({ toEmail: email, subject: `TEST: ${msg.subject}`, text: `This is a test message.\n\n${msg.text}` })
console.log(mail.success ? `  email accepted (${mail.id || "ok"})` : `  email NOT sent: ${mail.error}`)

if (phone) {
  const templateId = (process.env.MSG91_TEMPLATE_EARNINGS || "").trim()
  if (!process.env.MSG91_AUTH_KEY) console.log("  SMS skipped: MSG91_AUTH_KEY is not set in .env")
  else if (!templateId) console.log("  SMS skipped: MSG91_TEMPLATE_EARNINGS is not set in .env")
  else {
    console.log(`Sending a test SMS to ${phone} ...`)
    const sms = await sendTemplateSms({ toPhone: phone, templateId, vars: { var1: "2,500.00", var2: "GMA-TEST-1" } })
    console.log(sms.success ? `  SMS accepted by MSG91 (${sms.messageId})` : `  SMS NOT sent: ${sms.error}`)
  }

  if (!whatsappConfigured()) console.log("  WhatsApp skipped: set MSG91_WHATSAPP_NUMBER and MSG91_WHATSAPP_NAMESPACE in .env")
  else {
    console.log(`Sending a test WhatsApp to ${phone} ...`)
    const wa = await sendWhatsAppTemplate({ toPhone: phone, template: "gomaa_earnings_added", vars: ["Test", "2500.00", "GMA-TEST-1"] })
    console.log(wa.success ? `  WhatsApp accepted by MSG91 (${wa.messageId})` : `  WhatsApp NOT sent: ${wa.error}`)
  }
}
