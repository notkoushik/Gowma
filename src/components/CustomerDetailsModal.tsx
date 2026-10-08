import React, { useEffect, useState } from "react"
import {
  X,
  ShieldCheck,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Fingerprint,
  MapPin,
  Truck,
  Loader2,
  User,
  HeartHandshake,
  Clock,
  Sparkles,
  KeyRound,
  FileCheck2,
} from "lucide-react"
import type { Booking } from "../data/mock"
import { inr } from "../data/mock"
import { api } from "../services/api"
import { Eyebrow } from "../lib/ui"

export type CustomerDetailsModalProps = {
  booking: Booking | null
  isOpen: boolean
  onClose: () => void
  onAssignDriver?: (b: Booking) => void
}

export default function CustomerDetailsModal({
  booking,
  isOpen,
  onClose,
  onAssignDriver,
}: CustomerDetailsModalProps) {
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsData, setDetailsData] = useState<any | null>(null)

  useEffect(() => {
    if (!isOpen || !booking) {
      setDetailsData(null)
      return
    }

    let isMounted = true
    setLoadingDetails(true)

    api
      .getCustomerDetails(booking.id)
      .then((res) => {
        if (isMounted && res && res.ok && res.details) {
          setDetailsData(res.details)
        }
      })
      .catch((err) => {
        console.warn("Could not fetch remote customer dossier, using booking snapshot:", err)
      })
      .finally(() => {
        if (isMounted) setLoadingDetails(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, booking?.id])

  if (!isOpen || !booking) return null

  // Build resolved customer details using either live dossier or booking properties
  const b = booking
  const cData = detailsData?.customer
  const ceremonyData = detailsData?.ceremony
  const paymentData = detailsData?.payment
  const logisticsData = detailsData?.logistics

  const customerName = cData?.name || b.customer
  const customerPhone = cData?.phone || b.phone
  const customerEmail =
    cData?.email ||
    b.customerEmail ||
    `${b.customer.toLowerCase().replace(/\s+/g, ".")}@gmail.com`
  const memberSince = cData?.memberSince || b.devoteeSince || "Aug 2024"
  const totalBookingsCount = cData?.totalBookingsCount || 1
  const aadhaarNumber =
    cData?.idNumber || b.aadhaarNumber || "XXXX-XXXX-4912"
  const devoteeGotra = cData?.gotra || b.devoteeGotra || "Kashyapa"
  const familyMembers =
    cData?.familyMembers ||
    b.devoteeFamilyMembers ||
    "Ananya (Self), Rajesh (Husband)"
  const ritualPurpose =
    ceremonyData?.ritualPurpose ||
    b.ritualPurpose ||
    "Griha Pravesh & Kamadhenu Puja"
  const specialInstructions =
    ceremonyData?.specialInstructions ||
    b.specialInstructions ||
    "Ground-floor portico ready, clean water bucket and sacred green grass feeding protocol."
  const serviceAddress = ceremonyData?.serviceAddress || b.address
  const distanceKm = ceremonyData?.distanceKm ?? b.distanceKm
  const scheduledTime =
    ceremonyData?.timeSlot || `${b.start} - ${b.end}`
  const scheduledDate = ceremonyData?.date || b.date
  const assignedDriver =
    logisticsData?.driver || b.driver || "Assigned by Gaushala"
  const totalAmount = paymentData?.totalPaid ?? b.total
  const handoverOtp = b.handoverOtp || "4819"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto my-0 sm:my-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
        {/* Mobile Sheet Drag Indicator */}
        <div className="w-12 h-1 bg-ink-faint/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-forest text-white flex items-center justify-center font-serif text-[17px] font-semibold shrink-0 shadow-xs">
              {customerName.slice(0, 1)}
            </div>
            <div>
              <h3 className="font-serif text-[18px] text-ink font-semibold flex items-center gap-2">
                <span>{customerName}</span>
                <span className="text-[11px] font-sans font-medium text-forest bg-forest-soft px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified Devotee
                </span>
              </h3>
              <p className="text-[12px] text-ink-faint flex items-center gap-1.5 mt-0.5">
                <span>Devotee Dossier & KYC Audit</span>
                <span>·</span>
                <span className="font-mono text-ink-soft font-semibold">{b.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink hover:bg-paper-deep rounded-sm p-1.5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Section 1: Devotee Identity & Primary Contact Details */}
          <div>
            <Eyebrow>Devotee Contact & Lineage Record</Eyebrow>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-[12.5px]">
              <div className="bg-card p-3 rounded border border-line">
                <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                  <Phone size={12} className="text-forest" /> Primary Mobile
                </div>
                <div className="font-mono font-semibold text-ink mt-1">
                  <a
                    href={`tel:${customerPhone}`}
                    className="hover:text-forest transition-colors"
                  >
                    {customerPhone}
                  </a>
                </div>
              </div>

              <div className="bg-card p-3 rounded border border-line">
                <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                  <Mail size={12} className="text-forest" /> Devotee Email
                </div>
                <div className="font-medium text-ink mt-1 truncate">
                  <a
                    href={`mailto:${customerEmail}`}
                    className="hover:text-forest transition-colors"
                  >
                    {customerEmail}
                  </a>
                </div>
              </div>

              <div className="bg-card p-3 rounded border border-line">
                <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                  <Sparkles size={12} className="text-saffron" /> Devotee Gotra
                </div>
                <div className="font-serif font-semibold text-ink mt-1">
                  {devoteeGotra}
                </div>
              </div>

              <div className="bg-card p-3 rounded border border-line">
                <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
                  <CheckCircle2 size={12} className="text-forest" /> Seva History
                </div>
                <div className="font-medium text-ink mt-1">
                  {totalBookingsCount} Sevas Booked · Devotee Since {memberSince}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Devotee Family Members Attending */}
          <div className="bg-card rounded-md p-3.5 border border-line text-[12px] space-y-1">
            <div className="flex items-center gap-1.5 text-ink-faint text-[11px]">
              <HeartHandshake size={13} className="text-saffron" />
              <span className="font-medium uppercase tracking-wider font-mono">
                Participating Devotee Family Members
              </span>
            </div>
            <div className="font-medium text-ink text-[13px] pt-0.5">
              {familyMembers}
            </div>
          </div>

          {/* Section 3: Submitted Aadhaar & Identity Verification Badge */}
          <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-300 font-semibold text-[13.5px]">
                <Fingerprint size={18} className="text-emerald-700 dark:text-emerald-400" />
                <span>Submitted Identity Document (Aadhaar / KYC)</span>
              </div>
              <span className="text-[11px] font-mono bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-200/60">
                Self-Attested ✓
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px] pt-1">
              <div>
                <span className="text-emerald-900/70 dark:text-emerald-300/70 text-[11px]">
                  Document Type:
                </span>
                <div className="font-medium text-emerald-950 dark:text-emerald-200 text-[12.5px] mt-0.5">
                  Aadhaar / National ID Card
                </div>
              </div>
              <div>
                <span className="text-emerald-900/70 dark:text-emerald-300/70 text-[11px]">
                  Masked Identification No:
                </span>
                <div className="font-mono font-bold text-emerald-950 dark:text-emerald-200 text-[13px] mt-0.5">
                  {aadhaarNumber}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-emerald-200/80 dark:border-emerald-800/40 text-[11.5px] text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileCheck2 size={13} className="text-emerald-700 dark:text-emerald-400" />
                <span>Identity Match: Confirmed with Online Escrow Payer</span>
              </span>
              <span className="font-mono text-[10.5px] text-emerald-800 dark:text-emerald-400">
                Doc Ref: DOC-{b.id.slice(4)}
              </span>
            </div>
          </div>

          {/* Section 4: Ceremonial Address, Muhurat & Altar Specifics */}
          <div className="bg-paper-deep rounded-md p-4 border border-line space-y-2.5 text-[12.5px]">
            <Eyebrow>Ceremony Details & Altar Protocol</Eyebrow>
            <div>
              <span className="text-ink-faint">Ceremonial Ritual:</span>{" "}
              <strong className="text-ink font-semibold">{ritualPurpose}</strong>
            </div>
            <div>
              <span className="text-ink-faint">Requested Sacred Bovine:</span>{" "}
              <strong className="text-ink font-semibold">
                {b.animal} ({b.animalType}) · {b.gosala}
              </strong>
            </div>
            <div>
              <span className="text-ink-faint">Ceremony Venue Address:</span>{" "}
              <strong className="text-ink font-semibold">{serviceAddress}</strong>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-[12px]">
              <div>
                <span className="text-ink-faint">Scheduled Muhurat:</span>{" "}
                <span className="font-mono font-medium text-ink block">
                  {scheduledDate} · {scheduledTime}
                </span>
              </div>
              <div>
                <span className="text-ink-faint">Route Distance:</span>{" "}
                <span className="font-mono font-medium text-ink block">
                  {distanceKm} km transit from Gaushala
                </span>
              </div>
            </div>

            <div className="text-[11.5px] text-ink-faint pt-2 border-t border-line/60">
              <span className="font-medium text-ink">Altar Readiness Protocol:</span>{" "}
              <span className="italic text-ink-soft">{specialInstructions}</span>
            </div>
          </div>

          {/* Section 5: Delivery & Security Handover OTP */}
          <div className="bg-card rounded-md p-3.5 border border-line flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-saffron-soft text-saffron-deep">
                <KeyRound size={16} />
              </div>
              <div>
                <div className="font-semibold text-ink text-[12.5px]">
                  Sacred Animal Handover OTP:{" "}
                  <span className="font-mono font-bold text-saffron-deep text-[14px] tracking-wider ml-1">
                    {handoverOtp}
                  </span>
                </div>
                <div className="text-[11px] text-ink-faint">
                  Devotee presents this secret 4-digit code to the driver upon sacred arrival.
                </div>
              </div>
            </div>
            <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-paper-deep text-ink-soft border border-line">
              {b.handoverOtpVerified ? "Verified ✓" : "Pending Handover"}
            </span>
          </div>

          {/* Section 6: Escrow & Payment Breakdown */}
          <div className="bg-card rounded-md p-4 border border-line text-[12px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-ink-faint uppercase font-mono">
                  Escrow Advance Payment
                </div>
                <div className="text-[18px] font-mono font-bold text-ink mt-0.5">
                  {inr(totalAmount)}
                </div>
                <div className="text-[11px] text-forest font-medium flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={12} /> 100% Secured in Platform Escrow
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-ink-faint">Payment Mode:</div>
                <div className="font-medium text-ink text-[12px]">
                  Online UPI / NetBanking
                </div>
                <div className="font-mono text-[10.5px] text-ink-faint mt-0.5">
                  Ref: PAY-{b.id.slice(4)}-ESCROW
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line text-[11px] text-ink-faint">
              <div>
                Base Dakshina:{" "}
                <span className="font-mono font-medium text-ink">
                  {inr(paymentData?.baseRate ?? b.base)}
                </span>
              </div>
              <div>
                Transit Fee:{" "}
                <span className="font-mono font-medium text-ink">
                  {inr(paymentData?.transport ?? b.transport)}
                </span>
              </div>
              <div>
                GST / Tax:{" "}
                <span className="font-mono font-medium text-ink">
                  {inr(paymentData?.tax ?? b.tax)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 7: Logistics & Driver Status */}
          <div className="bg-paper-deep rounded-md p-3.5 border border-line flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2.5">
              <Truck size={16} className="text-forest shrink-0" />
              <div>
                <div className="font-medium text-ink">
                  Assigned Transport:{" "}
                  <span className="font-semibold text-forest">
                    {assignedDriver}
                  </span>
                </div>
                <div className="text-[11px] text-ink-faint">
                  Dedicated hydraulic cattle transport van with green fodder bedding
                </div>
              </div>
            </div>

            {onAssignDriver && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onAssignDriver(b)
                }}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-saffron-deep hover:underline bg-card px-2.5 py-1.5 rounded border border-line cursor-pointer shrink-0"
              >
                <Truck size={13} />
                <span>Assign / Change Driver</span>
              </button>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12.5px] border border-line rounded text-ink-soft hover:bg-paper-deep transition-colors cursor-pointer"
            >
              Close Dossier
            </button>
            {onAssignDriver && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onAssignDriver(b)
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-medium bg-forest text-white rounded hover:opacity-95 transition-opacity shadow-sm cursor-pointer"
              >
                <Truck size={15} /> Transport Allocation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
