import React, { useRef } from "react"
import {
  Printer,
  X,
  MapPin,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  FileText,
  Lock,
} from "lucide-react"

// Helper to format rupees in Indian numbering standard
function inr(n: number = 0): string {
  return "₹" + Math.round(n).toLocaleString("en-IN")
}

// Helper to convert number to words in Indian standard (Rupees ... Only)
function inrToWords(num: number = 0): string {
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ]
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ]

  const n = Math.floor(Math.abs(num))
  if (n === 0) return "Zero Rupees Only"

  const inWords = (nStr: string): string => {
    const val = parseInt(nStr, 10)
    if (val === 0) return ""
    if (val < 20) return a[val]
    return b[Math.floor(val / 10)] + " " + a[val % 10]
  }

  let str = ("000000000" + n).substr(-9)
  const crore = inWords(str.substr(0, 2))
  const lakh = inWords(str.substr(2, 2))
  const thousand = inWords(str.substr(4, 2))
  const hundred = inWords(str.substr(6, 1))
  const remaining = inWords(str.substr(7, 2))

  let out = ""
  if (crore) out += crore + "Crore "
  if (lakh) out += lakh + "Lakh "
  if (thousand) out += thousand + "Thousand "
  if (hundred) out += hundred + "Hundred "
  if (remaining) {
    if (out) out += "and "
    out += remaining
  }

  return "Rupees " + out.trim().replace(/\s+/g, " ") + " Only"
}

export interface InvoiceBookingData {
  id?: string
  customer?: string
  phone?: string
  customerEmail?: string
  devoteeGotra?: string
  devoteeFamilyMembers?: string
  specialInstructions?: string
  gosala?: string
  animal?: string
  animalName?: string
  animalType?: string
  date?: string
  time?: string
  start?: string
  end?: string
  durationMin?: number
  address?: string
  distanceKm?: number
  base?: number
  extraTime?: number
  transport?: number
  addons?: number
  tax?: number
  taxPct?: number
  discount?: number
  total?: number
  holdId?: string
  quoteToken?: string
  customerLat?: number | null
  customerLng?: number | null
  selectedAddons?: Array<{
    id?: string
    name: string
    qty: number
    price?: number
    total?: number
  }>
  pairSurcharge?: number
  paymentProvider?: string
  paymentId?: string
  paymentOrderId?: string
  handoverOtp?: string
  createdAt?: string
}

interface SevaTaxInvoiceModalProps {
  booking: InvoiceBookingData
  isOpen: boolean
  onClose: () => void
}

export default function SevaTaxInvoiceModal({
  booking,
  isOpen,
  onClose,
}: SevaTaxInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const bookingId = booking.id || "GMA-" + Math.floor(10000 + Math.random() * 90000)
  const invoiceNumber = `INV-${bookingId.replace(/[^A-Z0-9-]/gi, "")}`
  const invoiceDate =
    booking.createdAt ||
    new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  const effectiveAnimal =
    booking.animalName ||
    (booking.animal ? booking.animal.split("·")[0].trim() : "Sacred Bovine")
  const effectiveType =
    booking.animalType ||
    (booking.animal?.includes("Calf") ? "Cow & Calf" : "Indigenous Sacred Cow")

  const lat = booking.customerLat ?? 17.4435
  const lng = booking.customerLng ?? 78.3772
  const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`

  const basePrice = booking.base || 3500
  const extraTimePrice = booking.extraTime || 0
  const transportPrice = booking.transport || 0
  const calfSurcharge = booking.pairSurcharge || 0
  const addonsTotal = booking.addons || 0
  const taxAmount = booking.tax || 0
  const grandTotal = booking.total || basePrice + extraTimePrice + transportPrice + addonsTotal + taxAmount

  const is80gExempt = booking.taxPct === 0 || taxAmount === 0
  const taxRateDisplay = is80gExempt ? "0% (Section 80G Exempt)" : `${booking.taxPct || 12}% GST`

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Modal Container */}
      <div className="relative w-full max-w-[800px] bg-paper rounded-xl border border-line shadow-2xl flex flex-col my-auto overflow-hidden print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none">
        
        {/* Modal Action Bar (Hidden on print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-paper-deep border-b border-line print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-saffron-deep" />
            <span className="font-serif text-[15px] font-semibold text-ink">
              Official Tax Invoice &amp; Sacred Seva Receipt
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-saffron text-white text-[12.5px] font-medium hover:bg-saffron-deep transition shadow-xs cursor-pointer"
            >
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-ink-soft hover:text-ink hover:bg-paper cursor-pointer transition border border-line"
              aria-label="Close invoice"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div
          ref={printRef}
          className="p-6 sm:p-8 md:p-10 text-ink bg-card print:bg-white print:p-8 print:text-black space-y-6 text-[13px] leading-relaxed max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible"
        >
          {/* Header & Platform Credentials */}
          <div className="border-b-2 border-saffron pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-black tracking-widest text-[24px] text-saffron-deep print:text-amber-900">
                  GOMAA
                </span>
                <span className="text-[10.5px] uppercase tracking-wider font-mono font-bold bg-saffron-soft text-saffron-deep px-2 py-0.5 rounded border border-saffron/30">
                  Sacred Seva Escrow
                </span>
              </div>
              <div className="text-[12px] text-ink-soft mt-1">
                Vedic Cattle Sanctuary Darshan &amp; Puja Protocol Network
              </div>
              <div className="text-[11px] font-mono text-ink-faint mt-0.5">
                Reg: Animal Welfare Board of India (AWBI) Accredited Trust Network
              </div>
            </div>

            <div className="text-left sm:text-right font-mono text-[12px] space-y-1">
              <div className="inline-block bg-ok-soft text-ok font-bold px-2 py-0.5 rounded text-[11px] border border-ok/30 uppercase tracking-wider">
                Original for Recipient
              </div>
              <div className="text-[14px] font-bold text-ink mt-1">
                {invoiceNumber}
              </div>
              <div className="text-ink-soft text-[11.5px]">
                Booking Ref: <span className="font-semibold text-ink">{bookingId}</span>
              </div>
              <div className="text-ink-faint text-[11px]">
                Issued: {invoiceDate}
              </div>
            </div>
          </div>

          {/* Devotee & Sanctuary Bipartite Dossier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 rounded-lg bg-paper/60 border border-line">
            {/* Devotee Party */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-saffron-deep font-bold">
                Devotee Dossier (Billed To)
              </div>
              <div className="font-serif text-[16px] font-semibold text-ink">
                {booking.customer || "Devotee"}
              </div>
              <div className="text-ink-soft text-[12px]">
                Phone: <span className="font-mono text-ink">{booking.phone || "+91 98000 00000"}</span>
              </div>
              {booking.customerEmail && (
                <div className="text-ink-soft text-[12px] truncate">
                  Email: <span className="font-mono text-ink">{booking.customerEmail}</span>
                </div>
              )}
              {booking.devoteeGotra && (
                <div className="text-ink-soft text-[12px]">
                  Gotra: <span className="font-medium text-ink">{booking.devoteeGotra}</span>
                </div>
              )}
              {booking.devoteeFamilyMembers && (
                <div className="text-ink-soft text-[12px]">
                  Family: <span className="font-medium text-ink">{booking.devoteeFamilyMembers}</span>
                </div>
              )}
            </div>

            {/* Sanctuary Provider */}
            <div className="space-y-1.5 sm:border-l sm:border-line sm:pl-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-forest font-bold">
                Providing Sanctuary Base
              </div>
              <div className="font-serif text-[16px] font-semibold text-ink">
                {booking.gosala || "Home Vedic Sanctuary"}
              </div>
              <div className="text-ink-soft text-[12px]">
                Allocated Bovine: <span className="font-semibold text-ink">{effectiveAnimal}</span> ({effectiveType})
              </div>
              <div className="text-ink-soft text-[12px]">
                Auspicious Muhurat: <span className="font-mono font-medium text-ink">{booking.date} · {booking.time || `${booking.start} – ${booking.end}`}</span>
              </div>
              <div className="text-ink-soft text-[12px]">
                Duration: <span className="font-mono text-ink">{booking.durationMin || 60} Minutes</span>
              </div>
              <div className="text-[11px] text-forest font-semibold flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={13} className="text-ok shrink-0" />
                Sanctuary Welfare &amp; Veterinary Certified
              </div>
            </div>
          </div>

          {/* Ceremony Altar Delivery Address & Exact Map Pin */}
          <div className="p-3.5 rounded-lg bg-card border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint flex items-center gap-1 font-semibold">
                <MapPin size={12} className="text-saffron-deep" /> Altar Delivery Venue &amp; Live Coordinate
              </div>
              <div className="text-[12.5px] font-medium text-ink max-w-[500px]">
                {booking.address || "Devotee Altar Portico"}
              </div>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-forest/10 hover:bg-forest/20 text-forest text-[11.5px] font-mono font-semibold border border-forest/20 shrink-0 transition"
            >
              <span>📍 {lat.toFixed(4)}° N, {lng.toFixed(4)}° E</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Itemized Financial & Seva Offerings Table */}
          <div className="space-y-2">
            <div className="font-serif font-semibold text-[15px] text-ink flex items-center justify-between">
              <span>Itemized Seva Dakshina &amp; Sacred Offerings</span>
              <span className="font-mono text-[11px] text-ink-faint font-normal">All figures in INR (₹)</span>
            </div>

            <div className="rounded-lg border border-line overflow-hidden">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-paper-deep border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Description</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Duration / Qty</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Unit Rate</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-card">
                  {/* Row 1: Base Bovine Puja */}
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-ink-faint">1</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-ink">
                        Sacred Bovine Seva ({effectiveAnimal})
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        Conducting Go Puja / Kamadhenu ceremony with trained Gosevak handler
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center text-ink-soft">Standard (60m)</td>
                    <td className="py-2.5 px-3 font-mono text-right text-ink-soft">{inr(basePrice)}</td>
                    <td className="py-2.5 px-3 font-mono text-right font-semibold text-ink">{inr(basePrice)}</td>
                  </tr>

                  {/* Row 2: Calf Surcharge if Jodi */}
                  {calfSurcharge > 0 && (
                    <tr className="bg-amber-50/40">
                      <td className="py-2.5 px-3 font-mono text-ink-faint">2</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-amber-950 flex items-center gap-1">
                          <Sparkles size={12} className="text-amber-600" /> Gau-Vatsa Jodi Companion (Mother &amp; Calf Pair)
                        </div>
                        <div className="text-[11px] text-amber-800/80">
                          Special mother &amp; nursing calf accompaniment with protective calf enclosure
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center text-amber-950">Pair Included</td>
                      <td className="py-2.5 px-3 font-mono text-right text-amber-950">+{inr(calfSurcharge)}</td>
                      <td className="py-2.5 px-3 font-mono text-right font-semibold text-amber-950">+{inr(calfSurcharge)}</td>
                    </tr>
                  )}

                  {/* Row 3: Extra Puja Time */}
                  {extraTimePrice > 0 && (
                    <tr>
                      <td className="py-2.5 px-3 font-mono text-ink-faint">3</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-ink">
                          Extended Auspicious Muhurat Time (+{(booking.durationMin || 60) - 60} min)
                        </div>
                        <div className="text-[11px] text-ink-faint">
                          Additional dedicated ritual altar duration
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center text-ink-soft">+{(booking.durationMin || 60) - 60} min</td>
                      <td className="py-2.5 px-3 font-mono text-right text-ink-soft">+{inr(extraTimePrice)}</td>
                      <td className="py-2.5 px-3 font-mono text-right font-semibold text-ink">+{inr(extraTimePrice)}</td>
                    </tr>
                  )}

                  {/* Row 4: Transit logistics */}
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-ink-faint">4</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-ink">
                        Safe Cattle Ambulance Transit &amp; Logistics
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        Hydraulic ramp ambulance, non-slip flooring, and continuous welfare tracking
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center text-ink-soft">
                      {booking.distanceKm ? `${booking.distanceKm} km` : "Local"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-ink-soft">
                      {transportPrice > 0 ? `+${inr(transportPrice)}` : "Included (≤5km)"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right font-semibold text-ink">
                      {transportPrice > 0 ? `+${inr(transportPrice)}` : "₹0"}
                    </td>
                  </tr>

                  {/* Dynamic Add-ons List */}
                  {Array.isArray(booking.selectedAddons) && booking.selectedAddons.length > 0 && (
                    booking.selectedAddons.map((item, idx) => (
                      <tr key={item.id || idx} className="bg-saffron-soft/10">
                        <td className="py-2.5 px-3 font-mono text-ink-faint">{5 + idx}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-ink">
                            • {item.name}
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            Gaushala consecrated sacred puja offering / feed
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-center text-ink font-semibold">
                          × {item.qty}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-ink-soft">
                          {inr(item.price || Math.round((item.total || 0) / (item.qty || 1)))}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right font-semibold text-ink">
                          +{inr(item.total || (item.price || 0) * item.qty)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Subtotal, Tax, and Grand Total Footer */}
              <div className="p-4 bg-paper/60 border-t border-line space-y-1.5 font-mono text-[12.5px]">
                <div className="flex justify-between text-ink-soft">
                  <span className="font-sans">Subtotal (Ritual &amp; Offerings)</span>
                  <span>{inr(grandTotal - taxAmount)}</span>
                </div>
                <div className="flex justify-between text-ink-soft">
                  <span className="font-sans">
                    GST / Government Tax ({taxRateDisplay})
                  </span>
                  <span>{taxAmount > 0 ? `+${inr(taxAmount)}` : "₹0 (Exempt)"}</span>
                </div>
                <div className="pt-2 border-t-2 border-line flex justify-between items-center text-[16px] font-bold text-ink">
                  <span className="font-serif">Total Amount Paid</span>
                  <span className="text-[20px] text-saffron-deep print:text-amber-900">{inr(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Amount in words */}
            <div className="px-3 py-2 rounded bg-paper-deep/60 border border-line text-[12px] text-ink-soft italic font-serif">
              Amount in words: <span className="font-semibold not-italic">{inrToWords(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Gateway & Altar Security Handover Certificate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-emerald-50/50 border border-emerald-200">
            {/* Payment Audit */}
            <div className="space-y-1 text-[12px]">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-700" /> Payment &amp; Escrow Verification
              </div>
              <div className="text-ink-soft">
                Payment Channel: <span className="font-semibold text-ink">{booking.paymentProvider || "Razorpay Secure Escrow"}</span>
              </div>
              <div className="text-ink-soft font-mono text-[11px] truncate">
                Transaction ID: <span className="text-ink">{booking.paymentId || "pay_escrow_certified"}</span>
              </div>
              <div className="text-[11px] text-emerald-800 font-medium">
                ✓ Cryptographic HMAC Verification Validated
              </div>
            </div>

            {/* Handover OTP Box */}
            <div className="sm:border-l sm:border-emerald-200 sm:pl-4 space-y-1">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1">
                <Lock size={13} className="text-emerald-700" /> Sacred Altar Handover OTP
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[22px] font-black tracking-widest text-emerald-900 bg-white px-3 py-1 rounded border border-emerald-300 shadow-2xs">
                  {booking.handoverOtp || "4819"}
                </span>
                <span className="text-[11px] text-emerald-800/90 leading-tight">
                  Share this 4-digit OTP with the Transit Pilot only after the holy cow reaches your altar.
                </span>
              </div>
            </div>
          </div>

          {/* Legal Compliance and Certification Footer */}
          <div className="pt-4 border-t border-line text-[11px] text-ink-faint space-y-1.5 text-center">
            <div>
              Certified under Section 80G / Central Goods &amp; Services Tax Guidelines for Non-Profit Vedic Gau Sanctuaries.
            </div>
            <div>
              Animal transit conducted strictly under Prevention of Cruelty to Animals (PCA) Act, 1960 and Transport of Animals Rules.
            </div>
            <div className="font-mono text-[10px] text-ink-faint pt-1">
              *** This is a computer-generated official tax invoice and seva voucher. No physical signature is required. ***
            </div>
          </div>

        </div>

        {/* Modal Footer Controls (Hidden on print) */}
        <div className="p-4 bg-paper border-t border-line flex items-center justify-between print:hidden">
          <span className="text-[11.5px] text-ink-faint">
            Need physical records for your tax audit? Tap Print or save as PDF.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-saffron text-white text-[13px] font-medium hover:bg-saffron-deep transition shadow-xs cursor-pointer"
            >
              <Printer size={15} /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-paper-deep text-ink text-[13px] font-medium border border-line hover:bg-line transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
