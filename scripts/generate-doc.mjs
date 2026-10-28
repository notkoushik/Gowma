import fs from "node:fs"
import path from "node:path"
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  PageBreak,
} from "docx"

const OUT_DOCX = path.resolve(process.cwd(), "docs", "GOMAA_Platform_User_Manual.docx")
const OUT_HTML = path.resolve(process.cwd(), "docs", "GOMAA_Platform_User_Manual.html")
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs", "screenshots")

function loadImg(filename) {
  const p = path.join(SCREENSHOTS_DIR, filename)
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p)
}

function createImageParagraph(filename, captionText) {
  const data = loadImg(filename)
  if (!data) return [new Paragraph({ children: [new TextRun({ text: `[Screenshot: ${captionText}]`, italics: true, color: "666666" })] })]

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120 },
      children: [
        new ImageRun({
          data,
          transformation: { width: 550, height: 343 },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Figure: ${captionText}`,
          italics: true,
          size: 19, // 9.5pt
          color: "6B7280",
        }),
      ],
    }),
  ]
}

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
  })
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
  })
}

function heading3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
  })
}

function bodyParagraph(text) {
  return new Paragraph({
    spacing: { after: 140, line: 276 },
    children: [new TextRun({ text, size: 22 })], // 11pt
  })
}

function bullet(boldPrefix, normalText) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 100, line: 260 },
    children: [
      new TextRun({ text: boldPrefix + " ", bold: true, size: 22, color: "111827" }),
      new TextRun({ text: normalText, size: 22, color: "374151" }),
    ],
  })
}

function callout(title, body) {
  const border = { style: BorderStyle.SINGLE, size: 12, color: "E28825" }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              left: border,
            },
            shading: { fill: "FFFBEB", type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: title, bold: true, size: 22, color: "B45309" })],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text: body, size: 20, color: "78350F" })],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

function createTable(headers, rows) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" }
  const tableRows = []

  // Header row
  tableRows.push(
    new TableRow({
      children: headers.map(
        (h) =>
          new TableCell({
            borders: { top: border, bottom: border, left: border, right: border },
            shading: { fill: "F97316", type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true, size: 20, color: "FFFFFF" })],
              }),
            ],
          })
      ),
    })
  )

  // Body rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const bg = i % 2 === 0 ? "FFFFFF" : "F9FAFB"
    tableRows.push(
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders: { top: border, bottom: border, left: border, right: border },
              shading: { fill: bg, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cell, size: 19, color: "1F2937" })],
                }),
              ],
            })
        ),
      })
    )
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  })
}

async function buildDocx() {
  console.log("Generating GOMAA Platform User Manual (.docx)...")

  const doc = new Document({
    creator: "GOMAA Platform Engineering",
    title: "GOMAA Platform User Manual & Role Operations Guide",
    description: "Comprehensive step-by-step documentation for all platform personas",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", color: "1F2937" },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          // Cover / Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 720, after: 120 },
            children: [
              new TextRun({
                text: "GOMAA PLATFORM",
                bold: true,
                size: 52, // 26pt
                color: "EA580C", // Saffron
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Comprehensive User Manual & Role Operations Guide",
                bold: true,
                size: 32, // 16pt
                color: "1F2937",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
            children: [
              new TextRun({
                text: "Sacred Operations, Cattle Welfare & Vedic Ceremony Logistics Platform\nProduction URL: https://gowma.vercel.app | Version 2.4.0 (Production Release)",
                size: 20,
                color: "4B5563",
              }),
            ],
          }),

          // Section 1
          heading1("1. Platform Overview & Core Architectural Philosophy"),
          bodyParagraph(
            "The GOMAA Platform is India's dedicated digital network orchestrating sacred cattle welfare, traditional Vedic home ceremonies (Kamadhenu Puja, Griha Pravesh, and Go-Daan), and certified rural bovine sanctuaries. It eliminates intermediaries and ensures that every ceremony strictly prioritizes cattle comfort, proper hydration, and sustainable sanctuary funding."
          ),
          bullet(
            "The 80/20 Revenue Invariant:",
            "80% of all ceremony booking dakshina is disbursed directly to the Gaushala responsible for the cow and calf. 100% of transport charges are passed through directly to specialized bovine transport drivers. The remaining 20% covers platform escrow, real-time GPS telemetry, and logistics orchestration."
          ),
          bullet(
            "The 1:1 Single-Custodian Invariant:",
            "Every registered Gaushala is under the direct, verified stewardship of exactly one primary custodian manager. If a custodian is reassigned, the platform enforces automated reciprocal relief, ensuring no sanctuary is ever neglected or double-booked."
          ),
          bullet(
            "Bovine Welfare First Protocol:",
            "Every cow and calf pair must have a mandatory rest buffer (minimum 4 hours) between ceremonies. Cattle with health holds are automatically blocked from booking until cleared by an empanelled veterinarian."
          ),

          callout(
            "Key Principle: Non-Exploitative Sacred Seva",
            "Cows are never treated as commercial cargo. They travel in custom-retrofitted, open-bed agricultural vehicles with non-slip rubber mats, fresh hay bedding, and protective padded railings, accompanied by trained gosevaks."
          ),

          new Paragraph({ children: [new PageBreak()] }),

          // Section 2
          heading1("2. Accessing the Application & Authentication Gateway"),
          bodyParagraph(
            "The GOMAA Platform features a secure, multi-tenant authentication portal. Users can sign in using their registered Email Address or 10-digit Indian Mobile Number (+91)."
          ),
          ...createImageParagraph("02_login_gateway.png", "Multi-Tenant Authentication Gateway (Email, Phone OTP & Password)"),
          heading2("Authentication Methods:"),
          bullet("Password Sign-In:", "Enter your registered email/phone and secure password to immediately access your dedicated workspace."),
          bullet("SMS & Email OTP:", "Request an instant 6-digit cryptographic verification code delivered via carrier SMS (MSG91) or branded email."),
          bullet("Automatic Role Detection:", "The system automatically resolves whether the account is a Customer, Gaushala Manager, Operations Admin, Driver, or Super Admin, routing the user to the correct operational portal."),

          new Paragraph({ children: [new PageBreak()] }),

          // Section 3
          heading1("3. Devotee & Customer Operations Guide"),
          bodyParagraph(
            "The Devotee Portal enables families and temple committees to arrange sacred cow ceremonies at their residential portico or temple entrance with complete transparency and reverence."
          ),
          ...createImageParagraph("01_devotee_landing.png", "Devotee Ceremony Booking Portal with Auspicious Panchang Calendar"),
          heading2("Step-by-Step Ceremony Booking Workflow:"),
          bullet("Step 1 — Ritual Selection:", "Browse curated Vedic ceremonies including Kamadhenu Puja & Gau Seva, Griha Pravesh (Housewarming Blessing), and sacred Go-Daan."),
          bullet("Step 2 — Auspicious Muhurat:", "Choose an auspicious date using the integrated Panchang calendar. Select your preferred morning (06:00 AM - 10:00 AM) or evening (04:30 PM - 07:30 PM) muhurat."),
          bullet("Step 3 — Location & Nearest Gaushala:", "Enter your destination address or click 'Detect My Location'. The platform computes the road distance and matches the closest authorized Gaushala."),
          bullet("Step 4 — Transparent Escrow Payment:", "Review the detailed quote (Base dakshina + distance slab transport + duration). Pay securely via Razorpay (UPI, GPay, PhonePe, Cards, NetBanking)."),
          bullet("Step 5 — Live Ceremony Day Tracking:", "Track the transport vehicle in real-time on ceremony day. Follow the driver's progress through Dispatched, En Route, Arrived, and Ceremony in Progress."),

          new Paragraph({ children: [new PageBreak()] }),

          // Section 4
          heading1("4. Gaushala Manager (Facility Custodian) Guide"),
          bodyParagraph(
            "Gaushala Managers are the on-premise custodians responsible for bovine healthcare, feeding schedules, facility maintenance, and ceremony dispatch staging."
          ),
          ...createImageParagraph("12_manager_facility_dashboard.png", "Gaushala Custodian Portal for Gaushala_01"),
          heading2("Manager Daily Responsibilities:"),
          bullet("Sanctuary Headcount & Roster:", "Monitor herd headcount, active bookings, and daily seva verification logs."),
          bullet("Bovine Healthcare & Health Holds:", "Log vaccination records, medical checkups, and toggle health hold status if an animal requires medical rest."),
          bullet("Resting Buffer Verification:", "Ensure that cattle returning from a ceremony receive mandatory hydration and 4-hour rest periods before any subsequent journey."),
          bullet("Ceremony Availability Confirmation:", "Review incoming ceremony requests and click 'Confirm Availability' to authorize vehicle dispatch."),

          new Paragraph({ children: [new PageBreak()] }),

          // Section 5
          heading1("5. Operations Admin (Regional Management) Guide"),
          bodyParagraph(
            "Operations Admins manage regional clusters of Gaushalas (e.g., Hyderabad Central, Cyberabad, Secunderabad), overseeing compliance, custodian staffing, and ceremony logistics."
          ),
          ...createImageParagraph("13_operations_admin_portal.png", "Operations Admin Regional Governance Suite"),

          heading2("5.1 Gaushalas Network Directory"),
          bodyParagraph(
            "Review verified AWBI trust registrations, shelter capacities, physical premises, contact information, and GPS coordinates for all regional sanctuaries."
          ),
          ...createImageParagraph("05_admin_gaushalas_network.png", "Regional Gaushalas Network Directory & AWBI Compliance"),

          heading2("5.2 Custodians & Acting Matrix (1:1 Rule)"),
          bodyParagraph(
            "Every Gaushala must have exactly one primary custodian manager. If a facility becomes vacant, the Operations Admin can step in as Acting Custodian or reassign a verified manager."
          ),
          ...createImageParagraph("06_admin_custodians_matrix.png", "Custodians & Acting Matrix"),
          ...createImageParagraph("07_reassign_custodian_modal.png", "Custodian Reassignment Modal with Reciprocal Relief"),

          heading2("5.3 Regional Bookings Audit & Override Triage"),
          bodyParagraph(
            "Inspect all incoming and confirmed bookings across regional sanctuaries. In emergency circumstances (such as sudden road closures or weather issues), re-route bookings to alternative sanctuaries."
          ),
          ...createImageParagraph("08_admin_bookings_audit.png", "Regional Bookings Audit & Triage Pipeline"),

          heading2("5.4 Sacred Herd Welfare & Empanelled Vets"),
          bodyParagraph(
            "Coordinate regular health camps and emergency veterinary interventions with empanelled veterinary doctors."
          ),
          ...createImageParagraph("09_admin_animals_welfare.png", "Sacred Herd Health, Resting Buffers & Empanelled Veterinarians"),

          new Paragraph({ children: [new PageBreak()] }),

          // Section 6
          heading1("6. Super Admin (Platform Governance & Treasury) Guide"),
          bodyParagraph(
            "The Super Admin console provides overarching platform oversight across all Operations Admins, regional clusters, master financial arrangements, and banking disbursements."
          ),
          ...createImageParagraph("04_superadmin_overview.png", "Super Admin Master Platform Overview & Context Switching"),

          heading2("6.1 One-Click Context Switching"),
          bodyParagraph(
            "Super Admins can switch context with a single click into any Operations Admin's regional portfolio to audit operations, inspect local queues, or triage issues without logging out."
          ),

          heading2("6.2 Master Pricing & Cost Arranger"),
          bodyParagraph(
            "Configure baseline ceremony fees, duration tiers, distance slabs, free travel radii, and platform commission percentages across the entire network."
          ),
          ...createImageParagraph("10_superadmin_pricing_arranger.png", "Master Pricing Arranger & Transport Distance Slabs"),

          heading2("6.3 Gaushala Settlements & 80/20 Treasury Ledger"),
          bodyParagraph(
            "Track all escrow collections and automate the generation of 80% Gaushala disbursement batches and driver transit settlements via RazorpayX."
          ),
          ...createImageParagraph("11_superadmin_settlements_ledger.png", "80/20 Treasury Ledger & Gaushala Payout Batches"),

          new Paragraph({ children: [new PageBreak()] }),

          // Section 7
          heading1("7. Bovine Logistics Driver Guide"),
          bodyParagraph(
            "Certified drivers transport sacred cows and calves in customized vehicles. The Driver Console provides turnkey navigation, stage progression, and real-time telemetry."
          ),
          ...createImageParagraph("03_driver_console.png", "Bovine Logistics Driver Console & Live GPS Telemetry"),
          heading2("Driver Stage Progression:"),
          bullet("1. Dispatched:", "Driver confirms animal is onboarded with fresh fodder and water."),
          bullet("2. En Route:", "High-frequency GPS updates are broadcast to devotee's live tracking view."),
          bullet("3. Arrived at Premise:", "Driver confirms safe arrival and coordinates ground-floor portico placement."),
          bullet("4. Puja in Progress:", "Assisting devotees with sacred cow feeding and ritual pradakshina."),
          bullet("5. Safely Returned:", "Animal returned to shelter, triggering automated payout to driver's account."),

          new Paragraph({ children: [new PageBreak()] }),

          // Section 8
          heading1("8. Role Permissions & Access Matrix"),
          bodyParagraph("Summary of system capabilities by authenticated user role:"),
          createTable(
            ["Feature / Module", "Customer", "Driver", "Manager", "Ops Admin", "Super Admin"],
            [
              ["Book Vedic Ceremony", "YES", "NO", "NO", "NO", "YES"],
              ["Track Cow Fleet GPS", "YES", "YES", "YES", "YES", "YES"],
              ["Manage Herd Health Roster", "NO", "NO", "YES (Own)", "YES (Region)", "YES (All)"],
              ["Confirm Cow Availability", "NO", "NO", "YES", "YES (Override)", "YES (Override)"],
              ["Appoint Custodians", "NO", "NO", "NO", "YES (Region)", "YES (All)"],
              ["Configure Master Pricing", "NO", "NO", "NO", "NO", "YES"],
              ["Disburse 80/20 Settlements", "NO", "NO", "NO", "NO", "YES"],
              ["Context Switch Portfolios", "NO", "NO", "NO", "NO", "YES"],
            ]
          ),

          new Paragraph({ spacing: { before: 240 } }),

          // Section 9
          heading1("9. Pre-Configured System Credentials"),
          bodyParagraph("Standard verified accounts for testing and verification:"),
          createTable(
            ["Role", "Name", "Email Address", "Mobile Phone", "Password", "Assigned Scope"],
            [
              ["Super Admin", "Super Admin", "superadmin@gomaa.in", "+91 98000 00000", "SuperAdmin@2026!", "All Platform Sanctuaries"],
              ["Operations Admin", "Admin_1", "alt.yq-fs88dj2@yopmail.com", "+91 98222 33344", "GomaaAdmin@2026!", "Gaushala_01, 02, 03"],
              ["Gaushala Manager", "Manager 1", "manager1@gomaa.in", "+91 98111 22233", "GomaaAdmin@2026!", "Gaushala_01 (Custodian)"],
              ["Gaushala Manager", "Manager 2", "manager2@gomaa.in", "+91 98444 55566", "GomaaAdmin@2026!", "Gaushala_03 (Custodian)"],
            ]
          ),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 480 },
            children: [
              new TextRun({
                text: "Document Version: 2.4.0 (Production Release) | GOMAA Platform © 2026",
                italics: true,
                size: 18,
                color: "9CA3AF",
              }),
            ],
          }),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(OUT_DOCX, buffer)
  console.log(`✓ Microsoft Word Document (.docx) generated: ${OUT_DOCX} (${buffer.length} bytes)`)
}

buildDocx().catch((e) => console.error(e))
