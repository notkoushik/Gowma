import fs from "node:fs"
import path from "node:path"

const OUT_HTML = path.resolve(process.cwd(), "docs", "GOMAA_Platform_User_Manual.html")
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs", "screenshots")

function getBase64Img(filename) {
  const p = path.join(SCREENSHOTS_DIR, filename)
  if (!fs.existsSync(p)) return ""
  const buf = fs.readFileSync(p)
  return `data:image/png;base64,${buf.toString("base64")}`
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GOMAA Platform — Complete User Guide & Role Operations Manual</title>
  <style>
    @media print {
      body { margin: 0; padding: 16mm; background: #fff; }
      .page-break { page-break-before: always; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f8fafc;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 48px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    h1 {
      color: #ea580c;
      font-size: 2.2rem;
      border-bottom: 2px solid #fdba74;
      padding-bottom: 8px;
      margin-top: 36px;
    }
    .cover-title {
      text-align: center;
      margin-top: 20px;
      margin-bottom: 40px;
    }
    .cover-title h1 {
      font-size: 2.6rem;
      border-bottom: none;
      margin-bottom: 8px;
    }
    .cover-title .subtitle {
      font-size: 1.25rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
    }
    .cover-title .meta {
      font-size: 0.95rem;
      color: #6b7280;
    }
    h2 {
      color: #c2410c;
      font-size: 1.5rem;
      margin-top: 28px;
    }
    h3 {
      color: #9a3412;
      font-size: 1.2rem;
      margin-top: 20px;
    }
    p, li {
      font-size: 1.02rem;
      color: #374151;
    }
    ul {
      padding-left: 24px;
    }
    li {
      margin-bottom: 8px;
    }
    strong {
      color: #111827;
    }
    .figure-container {
      margin: 28px 0;
      text-align: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .figure-container img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: 1px solid #cbd5e1;
    }
    .figure-caption {
      margin-top: 10px;
      font-size: 0.88rem;
      color: #64748b;
      font-style: italic;
    }
    .callout {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px 20px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .callout-title {
      font-weight: 700;
      color: #b45309;
      margin-bottom: 4px;
      font-size: 1.05rem;
    }
    .callout-body {
      color: #78350f;
      font-size: 0.98rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 0.95rem;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 12px 14px;
      text-align: left;
    }
    th {
      background: #ea580c;
      color: #ffffff;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .btn-print {
      display: inline-block;
      background: #ea580c;
      color: white;
      padding: 10px 18px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      border: none;
      margin-bottom: 24px;
    }
    .btn-print:hover {
      background: #c2410c;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="no-print" style="text-align: right;">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <div class="cover-title">
      <h1>GOMAA PLATFORM</h1>
      <div class="subtitle">Comprehensive User Manual & Role Operations Guide</div>
      <div class="meta">
        Sacred Operations, Cattle Welfare & Vedic Ceremony Logistics Platform<br>
        <strong>Production URL:</strong> <a href="https://gowma.vercel.app" target="_blank">https://gowma.vercel.app</a> | <strong>Version:</strong> 2.4.0 (Production Release)
      </div>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <h1>1. Platform Overview & Core Architectural Philosophy</h1>
    <p>The GOMAA Platform is India's premier digital network orchestrating sacred cattle welfare, traditional Vedic home ceremonies (Kamadhenu Puja, Griha Pravesh, and Go-Daan), and certified rural bovine sanctuaries. It eliminates commercial exploitation and ensures that every ceremony strictly prioritizes cattle comfort, proper hydration, and sustainable sanctuary funding.</p>
    
    <ul>
      <li><strong>The 80/20 Revenue Invariant:</strong> 80% of all ceremony booking dakshina is disbursed directly to the Gaushala responsible for the cow and calf. 100% of transport charges are passed through directly to specialized bovine transport drivers. The remaining 20% covers platform escrow, real-time GPS telemetry, and logistics orchestration.</li>
      <li><strong>The 1:1 Single-Custodian Invariant:</strong> Every registered Gaushala is under the direct, verified stewardship of exactly one primary custodian manager. If a custodian is reassigned, the platform enforces automated reciprocal relief, ensuring no sanctuary is ever neglected or double-booked.</li>
      <li><strong>Bovine Welfare First Protocol:</strong> Every cow and calf pair must have a mandatory rest buffer (minimum 4 hours) between ceremonies. Cattle with health holds are automatically blocked from booking until cleared by an empanelled veterinarian.</li>
    </ul>

    <div class="callout">
      <div class="callout-title">Key Principle: Non-Exploitative Sacred Seva</div>
      <div class="callout-body">Cows are never treated as commercial cargo. They travel in custom-retrofitted, open-bed agricultural vehicles with non-slip rubber mats, fresh hay bedding, and protective padded railings, accompanied by trained gosevaks.</div>
    </div>

    <div class="page-break"></div>

    <h1>2. Accessing the Application & Authentication Gateway</h1>
    <p>The GOMAA Platform features a secure, multi-tenant authentication portal. Users can sign in using their registered Email Address or 10-digit Indian Mobile Number (+91).</p>
    
    <div class="figure-container">
      <img src="${getBase64Img("02_login_gateway.png")}" alt="Authentication Gateway">
      <div class="figure-caption">Figure: Multi-Tenant Authentication Gateway (Email, Phone OTP & Password)</div>
    </div>

    <h2>Authentication Methods:</h2>
    <ul>
      <li><strong>Password Sign-In:</strong> Enter your registered email/phone and secure password to immediately access your dedicated workspace.</li>
      <li><strong>SMS & Email OTP:</strong> Request an instant 6-digit cryptographic verification code delivered via carrier SMS (MSG91) or branded email.</li>
      <li><strong>Automatic Role Detection:</strong> The system automatically resolves whether the account is a Customer, Gaushala Manager, Operations Admin, Driver, or Super Admin, routing the user to the correct operational portal.</li>
    </ul>

    <div class="page-break"></div>

    <h1>3. Devotee & Customer Operations Guide</h1>
    <p>The Devotee Portal enables families and temple committees to arrange sacred cow ceremonies at their residential portico or temple entrance with complete transparency and reverence.</p>

    <div class="figure-container">
      <img src="${getBase64Img("01_devotee_landing.png")}" alt="Devotee Portal">
      <div class="figure-caption">Figure: Devotee Ceremony Booking Portal with Auspicious Panchang Calendar</div>
    </div>

    <h2>Step-by-Step Ceremony Booking Workflow:</h2>
    <ul>
      <li><strong>Step 1 — Ritual Selection:</strong> Browse curated Vedic ceremonies including Kamadhenu Puja & Gau Seva, Griha Pravesh (Housewarming Blessing), and sacred Go-Daan.</li>
      <li><strong>Step 2 — Auspicious Muhurat:</strong> Choose an auspicious date using the integrated Panchang calendar. Select your preferred morning (06:00 AM - 10:00 AM) or evening (04:30 PM - 07:30 PM) muhurat.</li>
      <li><strong>Step 3 — Location & Nearest Gaushala:</strong> Enter your destination address or click 'Detect My Location'. The platform computes the road distance and matches the closest authorized Gaushala.</li>
      <li><strong>Step 4 — Transparent Escrow Payment:</strong> Review the detailed quote (Base dakshina + distance slab transport + duration). Pay securely via Razorpay (UPI, GPay, PhonePe, Cards, NetBanking).</li>
      <li><strong>Step 5 — Live Ceremony Day Tracking:</strong> Track the transport vehicle in real-time on ceremony day. Follow the driver's progress through Dispatched, En Route, Arrived, and Ceremony in Progress.</li>
    </ul>

    <div class="page-break"></div>

    <h1>4. Gaushala Manager (Facility Custodian) Guide</h1>
    <p>Gaushala Managers are the on-premise custodians responsible for bovine healthcare, feeding schedules, facility maintenance, and ceremony dispatch staging.</p>

    <div class="figure-container">
      <img src="${getBase64Img("12_manager_facility_dashboard.png")}" alt="Manager Facility Dashboard">
      <div class="figure-caption">Figure: Gaushala Custodian Portal for Gaushala_01</div>
    </div>

    <h2>Manager Daily Responsibilities:</h2>
    <ul>
      <li><strong>Sanctuary Headcount & Roster:</strong> Monitor herd headcount, active bookings, and daily seva verification logs.</li>
      <li><strong>Bovine Healthcare & Health Holds:</strong> Log vaccination records, medical checkups, and toggle health hold status if an animal requires medical rest.</li>
      <li><strong>Resting Buffer Verification:</strong> Ensure that cattle returning from a ceremony receive mandatory hydration and 4-hour rest periods before any subsequent journey.</li>
      <li><strong>Ceremony Availability Confirmation:</strong> Review incoming ceremony requests and click 'Confirm Availability' to authorize vehicle dispatch.</li>
    </ul>

    <div class="page-break"></div>

    <h1>5. Operations Admin (Regional Management) Guide</h1>
    <p>Operations Admins manage regional clusters of Gaushalas (e.g., Hyderabad Central, Cyberabad, Secunderabad), overseeing compliance, custodian staffing, and ceremony logistics.</p>

    <div class="figure-container">
      <img src="${getBase64Img("13_operations_admin_portal.png")}" alt="Operations Admin Portal">
      <div class="figure-caption">Figure: Operations Admin Regional Governance Suite</div>
    </div>

    <h2>5.1 Gaushalas Network Directory</h2>
    <p>Review verified AWBI trust registrations, shelter capacities, physical premises, contact information, and GPS coordinates for all regional sanctuaries.</p>

    <div class="figure-container">
      <img src="${getBase64Img("05_admin_gaushalas_network.png")}" alt="Gaushalas Network">
      <div class="figure-caption">Figure: Regional Gaushalas Network Directory & AWBI Compliance</div>
    </div>

    <h2>5.2 Custodians & Acting Matrix (1:1 Rule)</h2>
    <p>Every Gaushala must have exactly one primary custodian manager. If a facility becomes vacant, the Operations Admin can step in as Acting Custodian or reassign a verified manager with automated reciprocal relief.</p>

    <div class="figure-container">
      <img src="${getBase64Img("06_admin_custodians_matrix.png")}" alt="Custodians Matrix">
      <div class="figure-caption">Figure: Custodians & Acting Matrix</div>
    </div>

    <div class="figure-container">
      <img src="${getBase64Img("07_reassign_custodian_modal.png")}" alt="Reassign Modal">
      <div class="figure-caption">Figure: Custodian Reassignment Modal with Reciprocal Relief</div>
    </div>

    <h2>5.3 Regional Bookings Audit & Override Triage</h2>
    <p>Inspect all incoming and confirmed bookings across regional sanctuaries. In emergency circumstances (such as sudden road closures or weather issues), re-route bookings to alternative sanctuaries.</p>

    <div class="figure-container">
      <img src="${getBase64Img("08_admin_bookings_audit.png")}" alt="Bookings Audit">
      <div class="figure-caption">Figure: Regional Bookings Audit & Triage Pipeline</div>
    </div>

    <h2>5.4 Sacred Herd Welfare & Empanelled Vets</h2>
    <p>Coordinate regular health camps and emergency veterinary interventions with empanelled veterinary doctors.</p>

    <div class="figure-container">
      <img src="${getBase64Img("09_admin_animals_welfare.png")}" alt="Animals Welfare">
      <div class="figure-caption">Figure: Sacred Herd Health, Resting Buffers & Empanelled Veterinarians</div>
    </div>

    <div class="page-break"></div>

    <h1>6. Super Admin (Platform Governance & Treasury) Guide</h1>
    <p>The Super Admin console provides overarching platform oversight across all Operations Admins, regional clusters, master financial arrangements, and banking disbursements.</p>

    <div class="figure-container">
      <img src="${getBase64Img("04_superadmin_overview.png")}" alt="Super Admin Overview">
      <div class="figure-caption">Figure: Super Admin Master Platform Overview & Context Switching</div>
    </div>

    <h2>6.1 Master Pricing & Cost Arranger</h2>
    <p>Configure baseline ceremony fees, duration tiers, distance slabs, free travel radii, and platform commission percentages across the entire network.</p>

    <div class="figure-container">
      <img src="${getBase64Img("10_superadmin_pricing_arranger.png")}" alt="Pricing Arranger">
      <div class="figure-caption">Figure: Master Pricing Arranger & Transport Distance Slabs</div>
    </div>

    <h2>6.2 Gaushala Settlements & 80/20 Treasury Ledger</h2>
    <p>Track all escrow collections and automate the generation of 80% Gaushala disbursement batches and driver transit settlements via RazorpayX.</p>

    <div class="figure-container">
      <img src="${getBase64Img("11_superadmin_settlements_ledger.png")}" alt="Settlements Ledger">
      <div class="figure-caption">Figure: 80/20 Treasury Ledger & Gaushala Payout Batches</div>
    </div>

    <div class="page-break"></div>

    <h1>7. Bovine Logistics Driver Guide</h1>
    <p>Certified drivers transport sacred cows and calves in customized vehicles. The Driver Console provides turnkey navigation, stage progression, and real-time telemetry.</p>

    <div class="figure-container">
      <img src="${getBase64Img("03_driver_console.png")}" alt="Driver Console">
      <div class="figure-caption">Figure: Bovine Logistics Driver Console & Live GPS Telemetry</div>
    </div>

    <h2>Driver Stage Progression:</h2>
    <ul>
      <li><strong>1. Dispatched:</strong> Driver confirms animal is onboarded with fresh fodder and water.</li>
      <li><strong>2. En Route:</strong> High-frequency GPS updates are broadcast to devotee's live tracking view.</li>
      <li><strong>3. Arrived at Premise:</strong> Driver confirms safe arrival and coordinates ground-floor portico placement.</li>
      <li><strong>4. Puja in Progress:</strong> Assisting devotees with sacred cow feeding and ritual pradakshina.</li>
      <li><strong>5. Safely Returned:</strong> Animal returned to shelter, triggering automated payout to driver's account.</li>
    </ul>

    <div class="page-break"></div>

    <h1>8. Role Permissions & Access Matrix</h1>
    <table>
      <thead>
        <tr>
          <th>Feature / Module</th>
          <th>Customer</th>
          <th>Driver</th>
          <th>Manager</th>
          <th>Ops Admin</th>
          <th>Super Admin</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Book Vedic Ceremony</strong></td>
          <td>YES</td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>YES</td>
        </tr>
        <tr>
          <td><strong>Track Cow Fleet GPS</strong></td>
          <td>YES</td>
          <td>YES</td>
          <td>YES</td>
          <td>YES</td>
          <td>YES</td>
        </tr>
        <tr>
          <td><strong>Manage Herd Health Roster</strong></td>
          <td>NO</td>
          <td>NO</td>
          <td>YES (Own)</td>
          <td>YES (Region)</td>
          <td>YES (All)</td>
        </tr>
        <tr>
          <td><strong>Confirm Cow Availability</strong></td>
          <td>NO</td>
          <td>NO</td>
          <td>YES</td>
          <td>YES (Override)</td>
          <td>YES (Override)</td>
        </tr>
        <tr>
          <td><strong>Appoint Custodians</strong></td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>YES (Region)</td>
          <td>YES (All)</td>
        </tr>
        <tr>
          <td><strong>Configure Master Pricing</strong></td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>YES</td>
        </tr>
        <tr>
          <td><strong>Disburse 80/20 Settlements</strong></td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>YES</td>
        </tr>
        <tr>
          <td><strong>Context Switch Portfolios</strong></td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>NO</td>
          <td>YES</td>
        </tr>
      </tbody>
    </table>

    <div class="page-break"></div>

    <h1>9. Pre-Configured System Credentials</h1>
    <table>
      <thead>
        <tr>
          <th>Role</th>
          <th>Name</th>
          <th>Email Address</th>
          <th>Mobile Phone</th>
          <th>Password</th>
          <th>Assigned Scope</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Super Admin</strong></td>
          <td>Koushik</td>
          <td>koushik@gmail.com</td>
          <td>+91 98000 00000</td>
          <td>Koushik.git</td>
          <td>All Platform Sanctuaries</td>
        </tr>
        <tr>
          <td><strong>Super Admin (Alt)</strong></td>
          <td>Koushik</td>
          <td>nanikoushik96@gmail.com</td>
          <td>+91 98000 00000</td>
          <td>Koushik.git</td>
          <td>All Platform Sanctuaries</td>
        </tr>
        <tr>
          <td><strong>Operations Admin</strong></td>
          <td>Admin_1</td>
          <td>alt.yq-fs88dj2@yopmail.com</td>
          <td>+91 98222 33344</td>
          <td>Koushik.git</td>
          <td>Gaushala_01, 02, 03</td>
        </tr>
        <tr>
          <td><strong>Gaushala Manager</strong></td>
          <td>Manager 1</td>
          <td>manager1@gomaa.in</td>
          <td>+91 98111 22233</td>
          <td>Koushik.git</td>
          <td>Gaushala_01 (Custodian)</td>
        </tr>
        <tr>
          <td><strong>Gaushala Manager</strong></td>
          <td>Manager 2</td>
          <td>manager2@gomaa.in</td>
          <td>+91 98444 55566</td>
          <td>Koushik.git</td>
          <td>Gaushala_03 (Custodian)</td>
        </tr>
      </tbody>
    </table>

    <p style="text-align: center; margin-top: 40px; color: #9ca3af; font-size: 0.85rem; font-style: italic;">
      Document Version: 2.4.0 (Production Release) | GOMAA Platform © 2026. All Rights Reserved.
    </p>
  </div>
</body>
</html>
`

fs.writeFileSync(OUT_HTML, html)
console.log(`✓ Standalone HTML Document generated: ${OUT_HTML} (${html.length} bytes)`)
