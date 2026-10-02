import {
  Wallet,
  ClipboardCheck,
  Truck,
  User,
  Landmark,
  Building2,
  type LucideIcon,
} from "lucide-react"

export type RoleId = "customer" | "super_admin" | "admin" | "manager" | "driver"

export type Role = {
  id: RoleId
  name: string
  scope: string
  demoEmail: string
  icon: LucideIcon
  summary: string
  duties: string[]
  workflow?: { label: string; steps: string[] }
}

export const roles: Role[] = [
  {
    id: "customer",
    name: "Customer",
    scope: "Booking · mobile app",
    demoEmail: "ananya@gomaa.in",
    icon: User,
    summary:
      "Discovers nearby Gosalas, books an individual animal for a chosen slot, pays, and tracks the trip live.",
    duties: [
      "Set location, discover nearby Gosalas & available animals",
      "Pick date, live time slot and 60-min or extended duration",
      "Add mala, flowers, chunni or decorations",
      "See a transparent price breakdown incl. distance transport",
      "Pay securely, then track status and live GPS",
    ],
  },
  {
    id: "super_admin",
    name: "Super Admin",
    scope: "Treasury & Master Pricing · web",
    demoEmail: "superadmin@gomaa.in",
    icon: Landmark,
    summary:
      "Master financial authority and money arranger. Controls platform pricing rules, transport distance slabs, commission splits, and approves Gosala payout settlements.",
    duties: [
      "Arrange platform-wide pricing: 60-min base, extra-time rates (₹500/30m), transport distance slabs",
      "Configure platform commission split (20% platform / 80% Gosala) and GST tax rates",
      "Monitor gross revenue collection, net margins, and payment gateway health",
      "Authorize and disburse Gosala settlement payout batches",
      "Inspect immutable pricing snapshots and financial audit logs",
    ],
  },
  {
    id: "admin",
    name: "Operations Admin",
    scope: "Regional Hub · Manager Governance",
    demoEmail: "admin@gomaa.in",
    icon: Building2,
    summary:
      "Regional operations coordinator. Adds and assigns Gosala Managers for Gosalas in the area, validates manager-approved bookings, assigns drivers, and oversees fleet availability.",
    duties: [
      "Add, assign and govern Gosala Managers for Gosalas in their area",
      "Review manager feasibility approvals and grant final Admin Confirmation",
      "Assign transport drivers and oversee live 8-stage trip progress",
      "Manage animal profiles, fleet health, and operational slot blocking",
      "Facilitate regional logistics without modifying master pricing algorithms",
    ],
  },
  {
    id: "manager",
    name: "Gosala Manager",
    scope: "Operations · web + tablet",
    demoEmail: "manager@gomaa.in",
    icon: ClipboardCheck,
    summary:
      "Reviews every paid booking for operational feasibility before it reaches admin for final confirmation.",
    duties: [
      "Receive the paid booking queue for review",
      "Verify animal availability, event details, timing & feasibility",
      "Confirm or reject bookings per the defined workflow",
      "Manage animal profiles, schedules and operational status",
      "Every approval records user ID, timestamp and remarks",
    ],
  },
  {
    id: "driver",
    name: "Transport Driver",
    scope: "Field · mobile app",
    demoEmail: "driver@gomaa.in",
    icon: Truck,
    summary:
      "Executes assigned trips with live GPS, advancing each stage from pickup at the Gosala to service completion.",
    duties: [
      "View assigned trips with navigation to Gosala & customer",
      "Broadcast live GPS during the active trip window only",
      "Advance trip status through the full field workflow",
      "Confirm animal pickup and mark service started",
      "Complete the trip and log the return",
    ],
    workflow: {
      label: "Trip status flow",
      steps: [
        "Assigned",
        "Go to Pickup",
        "Arrived",
        "Animal Picked Up",
        "Start Transport",
        "Arrived at Customer",
        "Service Started",
        "Completed / Return",
      ],
    },
  },
]
