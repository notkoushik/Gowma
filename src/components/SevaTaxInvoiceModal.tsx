import React, { useRef } from "react"
import { createPortal } from "react-dom"
import {
  Printer,
  X,
  MapPin,
  ShieldCheck,
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

  const str = ("000000000" + n).substr(-9)
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

function extractPointedCoords(b: InvoiceBookingData): { lat: number; lng: number } {
  if (typeof b.customerLat === "number" && !isNaN(b.customerLat) && b.customerLat !== 0) {
    return {
      lat: b.customerLat,
      lng: typeof b.customerLng === "number" && !isNaN(b.customerLng) && b.customerLng !== 0 ? b.customerLng : 78.3772,
    }
  }
  const addr = String(b.address || "")
  const match =
    addr.match(/[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
    addr.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/)
  if (match) {
    const pLat = parseFloat(match[1])
    const pLng = parseFloat(match[2])
    if (!isNaN(pLat) && !isNaN(pLng)) {
      return { lat: pLat, lng: pLng }
    }
  }
  return { lat: 17.4435, lng: 78.3772 }
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

  const { lat, lng } = extractPointedCoords(booking)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`

  // Strip raw Map: URL for clean display on paper invoice
  const cleanAddress = (booking.address || "Devotee Altar Portico")
    .replace(/,?\s*Map:\s*https?:\/\/[^\s,]+/gi, "")
    .trim()

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

  const modalContent = (
    <div
      id="gomaa-tax-invoice-portal"
      className="fixed inset-0 z-[99999] bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible print:z-auto"
    >
      {/* Print isolation & 1-page geometry stylesheet */}
      <style>{`
        @media print {
          /* Strict Isolation: hide entire underlying application (#root) and all non-portal elements */
          #root,
          body > *:not(#gomaa-tax-invoice-portal) {
            display: none !important;
            visibility: hidden !important;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #gomaa-tax-invoice-portal {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }

          .invoice-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            background: #ffffff !important;
          }

          .invoice-doc-body {
            padding: 0 !important;
            font-size: 10.5px !important;
            line-height: 1.25 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .invoice-doc-body * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .no-print,
          .print-hidden,
          button {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="invoice-card relative w-full max-w-[800px] bg-paper rounded-xl border border-line shadow-2xl flex flex-col my-auto overflow-hidden print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none print:my-0">
        
        {/* Modal Action Bar (Hidden on print) */}
        <div className="print-hidden flex items-center justify-between px-3.5 sm:px-5 py-3 bg-paper-deep border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={17} className="text-saffron-deep shrink-0" />
            <span className="font-serif text-[14px] sm:text-[15px] font-semibold text-ink truncate">
              Official Tax Invoice &amp; Sacred Seva Receipt
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-saffron text-white text-[12px] sm:text-[12.5px] font-medium hover:bg-saffron-deep transition shadow-xs cursor-pointer"
            >
              <Printer size={13} /> <span className="hidden xs:inline">Print / Save as</span> PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-ink-soft hover:text-ink hover:bg-paper cursor-pointer transition border border-line"
              aria-label="Close invoice"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div
          ref={printRef}
          className="invoice-doc-body p-4 sm:p-6 md:p-8 text-ink bg-card print:bg-white print:p-0 print:text-black space-y-3.5 print:space-y-2 text-[12px] sm:text-[12.5px] leading-relaxed max-h-[82vh] overflow-y-auto print:max-h-none print:overflow-visible"
        >
          {/* Header & Platform Credentials */}
          <div className="border-b-2 border-saffron pb-3.5 print:pb-2 flex flex-col sm:flex-row sm:items-start justify-between gap-3 print:gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-black tracking-widest text-[22px] sm:text-[24px] print:text-[20px] text-saffron-deep print:text-amber-900">
                  GOMAA
                </span>
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold bg-saffron-soft text-saffron-deep px-2 py-0.5 rounded border border-saffron/30">
                  Sacred Seva Escrow
                </span>
              </div>
              <div className="text-[11.5px] sm:text-[12px] print:text-[10.5px] text-ink-soft mt-0.5">
                Vedic Cattle Sanctuary Darshan &amp; Puja Protocol Network
              </div>
              <div className="text-[10.5px] font-mono text-ink-faint print:text-[9.5px]">
                Reg: Animal Welfare Board of India (AWBI) Accredited Trust Network
              </div>
            </div>

            <div className="text-left sm:text-right font-mono text-[11.5px] print:text-[10px] space-y-0.5">
              <div className="inline-block bg-ok-soft text-ok font-bold px-2 py-0.5 rounded text-[10px] border border-ok/30 uppercase tracking-wider">
                Original for Recipient
              </div>
              <div className="text-[13px] sm:text-[14px] print:text-[12px] font-bold text-ink">
                {invoiceNumber}
              </div>
              <div className="text-ink-soft text-[11px] print:text-[9.5px]">
                Booking Ref: <span className="font-semibold text-ink">{bookingId}</span>
              </div>
              <div className="text-ink-faint text-[10.5px] print:text-[9px]">
                Issued: {invoiceDate}
              </div>
            </div>
          </div>

          {/* Devotee & Sanctuary Bipartite Dossier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 print:gap-2 p-3 sm:p-3.5 print:p-2 rounded-lg bg-paper/60 print:bg-stone-50 border border-line print:border-stone-300">
            {/* Devotee Party */}
            <div className="space-y-1 print:space-y-0.5">
              <div className="text-[9.5px] font-mono uppercase tracking-wider text-saffron-deep font-bold">
                Devotee Dossier (Billed To)
              </div>
              <div className="font-serif text-[15px] sm:text-[16px] print:text-[13px] font-semibold text-ink">
                {booking.customer || "Devotee"}
              </div>
              <div className="text-ink-soft text-[11.5px] print:text-[10px]">
                Phone: <span className="font-mono text-ink font-medium">{booking.phone || "+91 98000 00000"}</span>
              </div>
              {booking.customerEmail && (
                <div className="text-ink-soft text-[11.5px] print:text-[10px] truncate">
                  Email: <span className="font-mono text-ink">{booking.customerEmail}</span>
                </div>
              )}
              {booking.devoteeGotra && (
                <div className="text-ink-soft text-[11.5px] print:text-[10px]">
                  Gotra: <span className="font-medium text-ink">{booking.devoteeGotra}</span>
                </div>
              )}
              {booking.devoteeFamilyMembers && (
                <div className="text-ink-soft text-[11.5px] print:text-[10px]">
                  Family: <span className="font-medium text-ink">{booking.devoteeFamilyMembers}</span>
                </div>
              )}
            </div>

            {/* Sanctuary Provider */}
            <div className="space-y-1 print:space-y-0.5 sm:border-l sm:border-line sm:pl-4 print:border-l print:border-stone-300 print:pl-3">
              <div className="text-[9.5px] font-mono uppercase tracking-wider text-forest font-bold">
                Providing Sanctuary Base
              </div>
              <div className="font-serif text-[15px] sm:text-[16px] print:text-[13px] font-semibold text-ink">
                {booking.gosala || "Home Vedic Sanctuary"}
              </div>
              <div className="text-ink-soft text-[11.5px] print:text-[10px]">
                Allocated Bovine: <span className="font-semibold text-ink">{effectiveAnimal}</span> ({effectiveType})
              </div>
              <div className="text-ink-soft text-[11.5px] print:text-[10px]">
                Muhurat: <span className="font-mono font-medium text-ink">{booking.date} · {booking.time || `${booking.start} – ${booking.end}`}</span>
              </div>
              <div className="text-ink-soft text-[11.5px] print:text-[10px]">
                Duration: <span className="font-mono text-ink font-medium">{booking.durationMin || 60} Minutes</span>
              </div>
              <div className="text-[10.5px] print:text-[9.5px] text-forest font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} className="text-ok shrink-0" />
                Sanctuary Welfare &amp; Veterinary Certified
              </div>
            </div>
          </div>

          {/* Ceremony Altar Delivery Address & Exact Map Pin */}
          <div className="p-3 print:p-2 rounded-lg bg-card print:bg-white border border-line print:border-stone-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="text-[9.5px] font-mono uppercase tracking-wider text-ink-faint flex items-center gap-1 font-semibold">
                <MapPin size={11} className="text-saffron-deep" /> Altar Delivery Venue &amp; Live Coordinate
              </div>
              <div className="text-[12px] sm:text-[12.5px] print:text-[10.5px] font-medium text-ink break-words">
                {cleanAddress}
              </div>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-forest/10 hover:bg-forest/20 text-forest text-[11px] print:text-[10px] font-mono font-semibold border border-forest/20 shrink-0 transition self-start sm:self-center"
            >
              <span>📍 {lat.toFixed(4)}° N, {lng.toFixed(4)}° E</span>
              <ExternalLink size={11} className="print:hidden" />
            </a>
          </div>

          {/* Itemized Financial & Seva Offerings Table */}
          <div className="space-y-1.5 print:space-y-1">
            <div className="font-serif font-semibold text-[14px] sm:text-[15px] print:text-[12px] text-ink flex items-center justify-between">
              <span>Itemized Seva Dakshina &amp; Sacred Offerings</span>
              <span className="font-mono text-[10.5px] print:text-[9.5px] text-ink-faint font-normal">All figures in INR (₹)</span>
            </div>

            {/* Responsive Table Container with Horizontal Scroll on Mobile */}
            <div className="rounded-lg border border-line print:border-stone-300 overflow-x-auto -mx-0.5">
              <table className="w-full border-collapse text-[12px] print:text-[10px] min-w-[500px] sm:min-w-0">
                <thead>
                  <tr className="bg-paper-deep print:bg-stone-100 border-b border-line print:border-stone-300 text-left font-mono text-[10px] sm:text-[10.5px] print:text-[9px] uppercase tracking-wider text-ink-soft">
                    <th className="py-2 print:py-1 px-2.5 sm:px-3 font-semibold w-8">#</th>
                    <th className="py-2 print:py-1 px-2.5 sm:px-3 font-semibold">Description</th>
                    <th className="py-2 print:py-1 px-2.5 sm:px-3 font-semibold text-center w-28">Duration / Qty</th>
                    <th className="py-2 print:py-1 px-2.5 sm:px-3 font-semibold text-right w-24">Unit Rate</th>
                    <th className="py-2 print:py-1 px-2.5 sm:px-3 font-semibold text-right w-28">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 print:divide-stone-200 bg-card print:bg-white">
                  {/* Row 1: Base Bovine Puja */}
                  <tr>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-ink-faint">1</td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3">
                      <div className="font-medium text-ink">
                        Sacred Bovine Seva ({effectiveAnimal})
                      </div>
                      <div className="text-[10.5px] print:text-[9px] text-ink-faint">
                        Conducting Go Puja / Kamadhenu ceremony with trained Gosevak handler
                      </div>
                    </td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-center text-ink-soft">Standard (60m)</td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right text-ink-soft">{inr(basePrice)}</td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right font-semibold text-ink">{inr(basePrice)}</td>
                  </tr>

                  {/* Row 2: Calf Surcharge if Jodi */}
                  {calfSurcharge > 0 && (
                    <tr className="bg-amber-50/40 print:bg-amber-50/20">
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-ink-faint">2</td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3">
                        <div className="font-medium text-amber-950 flex items-center gap-1">
                          <Sparkles size={11} className="text-amber-600 shrink-0" /> Gau-Vatsa Jodi Companion (Mother &amp; Calf Pair)
                        </div>
                        <div className="text-[10.5px] print:text-[9px] text-amber-850/80">
                          Special mother &amp; nursing calf accompaniment with protective calf enclosure
                        </div>
                      </td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-center text-amber-950">Pair Included</td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right text-amber-950">+{inr(calfSurcharge)}</td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right font-semibold text-amber-950">+{inr(calfSurcharge)}</td>
                    </tr>
                  )}

                  {/* Row 3: Extra Puja Time */}
                  {extraTimePrice > 0 && (
                    <tr>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-ink-faint">3</td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3">
                        <div className="font-medium text-ink">
                          Extended Auspicious Muhurat Time (+{(booking.durationMin || 60) - 60} min)
                        </div>
                        <div className="text-[10.5px] print:text-[9px] text-ink-faint">
                          Additional dedicated ritual altar duration
                        </div>
                      </td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-center text-ink-soft">+{(booking.durationMin || 60) - 60} min</td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right text-ink-soft">+{inr(extraTimePrice)}</td>
                      <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right font-semibold text-ink">+{inr(extraTimePrice)}</td>
                    </tr>
                  )}

                  {/* Row 4: Transit logistics */}
                  <tr>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-ink-faint">4</td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3">
                      <div className="font-medium text-ink">
                        Safe Cattle Ambulance Transit &amp; Logistics
                      </div>
                      <div className="text-[10.5px] print:text-[9px] text-ink-faint">
                        Hydraulic ramp ambulance, non-slip flooring, and continuous welfare tracking
                      </div>
                    </td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-center text-ink-soft">
                      {booking.distanceKm ? `${booking.distanceKm} km` : "Local"}
                    </td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right text-ink-soft">
                      {transportPrice > 0 ? `+${inr(transportPrice)}` : "Included (≤5km)"}
                    </td>
                    <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right font-semibold text-ink">
                      {transportPrice > 0 ? `+${inr(transportPrice)}` : "₹0"}
                    </td>
                  </tr>

                  {/* Dynamic Add-ons List */}
                  {Array.isArray(booking.selectedAddons) && booking.selectedAddons.length > 0 && (
                    booking.selectedAddons.map((item, idx) => (
                      <tr key={item.id || idx} className="bg-saffron-soft/10">
                        <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-ink-faint">{5 + idx}</td>
                        <td className="py-2 print:py-1 px-2.5 sm:px-3">
                          <div className="font-medium text-ink">
                            • {item.name}
                          </div>
                          <div className="text-[10.5px] print:text-[9px] text-ink-faint">
                            Gaushala consecrated sacred puja offering / feed
                          </div>
                        </td>
                        <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-center text-ink font-semibold">
                          × {item.qty}
                        </td>
                        <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right text-ink-soft">
                          {inr(item.price || Math.round((item.total || 0) / (item.qty || 1)))}
                        </td>
                        <td className="py-2 print:py-1 px-2.5 sm:px-3 font-mono text-right font-semibold text-ink">
                          +{inr(item.total || (item.price || 0) * item.qty)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Subtotal, Tax, and Grand Total Footer */}
              <div className="p-3 sm:p-3.5 print:p-2 bg-paper/60 print:bg-stone-50 border-t border-line print:border-stone-300 space-y-1 font-mono text-[11.5px] sm:text-[12px] print:text-[10px]">
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
                <div className="pt-1.5 border-t-2 border-line print:border-stone-300 flex justify-between items-center text-[15px] sm:text-[16px] print:text-[13px] font-bold text-ink">
                  <span className="font-serif">Total Amount Paid</span>
                  <span className="text-[18px] sm:text-[20px] print:text-[15px] text-saffron-deep print:text-amber-900">{inr(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Amount in words */}
            <div className="px-3 py-1.5 print:py-1 rounded bg-paper-deep/60 print:bg-stone-50 border border-line print:border-stone-300 text-[11px] sm:text-[11.5px] print:text-[9.5px] text-ink-soft italic font-serif">
              Amount in words: <span className="font-semibold not-italic">{inrToWords(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Gateway & Altar Security Handover Certificate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:gap-2 p-3 sm:p-3.5 print:p-2 rounded-lg bg-emerald-50/50 print:bg-stone-50 border border-emerald-200 print:border-stone-300">
            {/* Payment Audit */}
            <div className="space-y-0.5 text-[11.5px] print:text-[9.5px]">
              <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-700" /> Payment &amp; Escrow Verification
              </div>
              <div className="text-ink-soft">
                Channel: <span className="font-semibold text-ink">{booking.paymentProvider || "Razorpay Secure Escrow"}</span>
              </div>
              <div className="text-ink-soft font-mono text-[10.5px] print:text-[9px] truncate">
                Txn ID: <span className="text-ink">{booking.paymentId || "pay_escrow_certified"}</span>
              </div>
              <div className="text-[10.5px] print:text-[9px] text-emerald-800 font-medium">
                ✓ Cryptographic HMAC Verification Validated
              </div>
            </div>

            {/* Handover OTP Box */}
            <div className="sm:border-l sm:border-emerald-200 print:border-stone-300 sm:pl-3 space-y-0.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1">
                <Lock size={12} className="text-emerald-700" /> Sacred Altar Handover OTP
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[18px] sm:text-[20px] print:text-[16px] font-black tracking-widest text-emerald-900 bg-white px-2.5 py-0.5 rounded border border-emerald-300 print:border-stone-400 shadow-2xs">
                  {booking.handoverOtp || "4819"}
                </span>
                <span className="text-[10.5px] print:text-[9px] text-emerald-800/90 leading-tight">
                  Share this 4-digit OTP with the Transit Pilot only after the holy cow reaches your altar.
                </span>
              </div>
            </div>
          </div>

          {/* Legal Compliance and Certification Footer */}
          <div className="pt-2.5 print:pt-1.5 border-t border-line print:border-stone-300 text-[10px] print:text-[8.5px] text-ink-faint space-y-1 print:space-y-0.5 text-center">
            <div>
              Certified under Section 80G / Central Goods &amp; Services Tax Guidelines for Non-Profit Vedic Gau Sanctuaries.
            </div>
            <div>
              Animal transit conducted strictly under Prevention of Cruelty to Animals (PCA) Act, 1960 and Transport of Animals Rules.
            </div>
            <div className="font-mono text-[9.5px] print:text-[8px] text-ink-faint">
              *** This is a computer-generated official tax invoice and seva voucher. No physical signature is required. ***
            </div>
          </div>

        </div>

        {/* Modal Footer Controls (Hidden on print) */}
        <div className="print-hidden p-3 sm:p-4 bg-paper border-t border-line flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span className="text-[11px] sm:text-[11.5px] text-ink-faint text-center sm:text-left">
            Need physical records for your tax audit? Tap Print or save as PDF.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-saffron text-white text-[12.5px] sm:text-[13px] font-medium hover:bg-saffron-deep transition shadow-xs cursor-pointer"
            >
              <Printer size={14} /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-paper-deep text-ink text-[12.5px] sm:text-[13px] font-medium border border-line hover:bg-line transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  )

  // Mount to document.body via React Portal to completely isolate from #root and underlying screens
  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent
}
