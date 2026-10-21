# GOMAA Platform — Complete User Guide & Role Operations Manual

> **Sacred Operations, Cattle Welfare & Vedic Ceremony Logistics Platform**  
> *Production Deployment:* [https://gowma.vercel.app](https://gowma.vercel.app)

---

## Table of Contents
1. [Platform Overview & Core Philosophy](#1-platform-overview--core-philosophy)
2. [Getting Started & Authentication Gateway](#2-getting-started--authentication-gateway)
3. [Devotee / Customer Operations Guide](#3-devotee--customer-operations-guide)
4. [Gaushala Manager (Facility Custodian) Guide](#4-gaushala-manager-facility-custodian-guide)
5. [Operations Admin (Regional Management) Guide](#5-operations-admin-regional-management-guide)
6. [Super Admin (Platform Governance & Treasury) Guide](#6-super-admin-platform-governance--treasury-guide)
7. [Bovine Logistics Driver Guide](#7-bovine-logistics-driver-guide)
8. [Role Permissions & Access Matrix](#8-role-permissions--access-matrix)
9. [Pre-configured System Credentials](#9-pre-configured-system-credentials)

---

## 1. Platform Overview & Core Philosophy

GOMAA is India’s first digitally orchestrated platform connecting sacred Gaushalas, certified animal caretakers, and Vedic devotees for home rituals (**Griha Pravesh**, **Kamadhenu Puja**, and **Go-Daan**).

### Core Architectural Pillars
- **Strict 80/20 Revenue Invariant**: 80% of ceremony booking fees are disbursed directly to the source Gaushala for cattle nutrition, shelter, and medical care; 100% of transport charges are passed to specialized bovine drivers; 20% covers platform escrow and logistics orchestration.
- **1 Gaushala = 1 Custodian Invariant**: Each sanctuary is under the direct, verified stewardship of exactly one primary custodian manager, preventing multi-facility conflicts and neglected shelters.
- **Bovine Welfare First**: Mandatory resting buffer intervals (minimum 4 hours) between ceremonies, automated health hold toggles, and empanelled veterinary doctor oversight.

---

## 2. Getting Started & Authentication Gateway

The platform provides a secure, multi-tenant authentication portal supporting **Email Address**, **Mobile Phone (+91)**, and **Instant OTP Verification**.

![Login Gateway](screenshots/02_login_gateway.png)

### How to Sign In
1. Navigate to [https://gowma.vercel.app/#/login](https://gowma.vercel.app/#/login).
2. Enter your registered **Email Address** or **10-digit Indian Mobile Number**.
3. Choose your verification method:
   - **Password Sign-In**: Enter your secure password and click **Sign In to Platform**.
   - **Mobile / Email OTP**: Receive an instant 6-digit cryptographic verification code delivered via SMS (MSG91) or secure email.
4. The system automatically detects your role (`Customer`, `Gaushala Manager`, `Operations Admin`, `Driver`, or `Super Admin`) and routes you to your dedicated console.

---

## 3. Devotee / Customer Operations Guide

The Devotee Portal allows families and organizers to arrange sacred cow ceremonies at their home or temple doorstep with complete reverence and transparent pricing.

![Devotee Portal](screenshots/01_devotee_landing.png)

### Step-by-Step Ceremony Booking Workflow

#### Step 1: Select Ritual & Auspicious Muhurat
1. On the Devotee homepage, browse the curated list of Vedic ceremonies:
   - **Kamadhenu Puja & Gau Seva**: Traditional blessing with sacred green grass feeding.
   - **Griha Pravesh (Housewarming)**: First sacred entry of Mother Cow and Calf into new residence.
   - **Go-Daan Ceremony**: Sacred cow gifting for spiritual milestones.
2. Select an auspicious date using the integrated **Panchang Auspicious Calendar**.
3. Choose your desired morning (`06:00 AM – 10:00 AM`) or evening (`04:30 PM – 07:30 PM`) muhurat slot.

#### Step 2: Choose Sanctuary & Automated Radius Verification
1. Enter your ceremony destination address or click **Detect My Location**.
2. The platform automatically computes the great-circle road distance to registered Gaushalas.
3. Select your preferred Gaushala sanctuary (e.g. `Gaushala_01 - Banjara Hills`, `Gaushala_03 - Trimulgherry`).

#### Step 3: Transparent Quote & Escrow Payment
1. View the live cost breakdown:
   - **Base Ceremony Fee**: Fixed ritual dakshina.
   - **Distance Slabs**: Standard free radius + per-km transport pass-through.
   - **Durations**: Standard 60-minute ceremony with optional extension.
2. Complete secure checkout via Razorpay (UPI, Google Pay, PhonePe, Cards, NetBanking).
3. A temporary slot hold protects your muhurat while the Gaushala Custodian confirms bovine fitness.

#### Step 4: Live Ceremony Day Tracking
1. Track the customized bovine transport vehicle in real time as the driver advances through stages:
   `Dispatched` $\rightarrow$ `En Route` $\rightarrow$ `Arrived at Devotee Premise` $\rightarrow$ `Puja in Progress` $\rightarrow$ `Completed`.
2. Access the **Ceremony Preparation Checklist** (clean water bucket, green fodder, ground-floor portico clearance).

---

## 4. Gaushala Manager (Facility Custodian) Guide

Gaushala Managers are the on-premise trustees and caretakers responsible for bovine healthcare, feeding schedules, and dispatch readiness.

![Gaushala Manager Portal](screenshots/12_manager_facility_dashboard.png)

### Key Daily Operational Duties

#### 1. Facility Overview & Cattle Roster
- View total herd headcount under your custody.
- Monitor active ceremony bookings scheduled for your facility.
- Review daily fodder allocation, organic feed inventory, and shelter maintenance logs.

#### 2. Bovine Health & Rest Buffers
- Toggle individual cattle availability based on veterinary checkups.
- Review mandatory post-ceremony rest buffers (cattle cannot be booked consecutively without requisite hydration and rest periods).

#### 3. Ceremony Confirmation & Driver Handover
- When a devotee requests a ceremony, verify that the designated cow and calf pair are rested and in optimal health.
- Click **Confirm Availability** to lock the slot.
- Upon driver arrival, conduct the pre-trip vehicle safety inspection and log the departure.

---

## 5. Operations Admin (Regional Management) Guide

Operations Admins govern regional clusters of Gaushalas (e.g. Hyderabad Central, Cyberabad, Secunderabad), overseeing compliance, financial ledgers, and custodian staffing.

![Operations Admin Portal](screenshots/13_operations_admin_portal.png)

### Core Administrative Modules

### A. Gaushalas Network Directory
Review AWBI (Animal Welfare Board of India) trust registrations, registered capacities, physical premises, contact information, and verified GPS coordinates.

![Gaushalas Network](screenshots/05_admin_gaushalas_network.png)

### B. Custodians & Acting Matrix
GOMAA enforces a **strict 1:1 single-custodian invariant**. Each facility must be actively staffed by a dedicated manager or temporarily managed under Acting Admin Custody.

![Custodians Matrix](screenshots/06_admin_custodians_matrix.png)

#### How to Reassign a Facility Custodian:
1. Navigate to **Custodians & Acting Matrix**.
2. Locate the target sanctuary (e.g. `Gaushala_01`) and click **Reassign**.
3. Select the appointed custodian from the verified roster.
4. The system automatically executes **Reciprocal Relief**:
   - The selected manager is assigned to the new facility.
   - Any previous manager is cleanly relieved with zero orphan records.
   - If an unassigned status is desired, select **Leave Unassigned (Admin Custody)**.

![Reassign Custodian Modal](screenshots/07_reassign_custodian_modal.png)

### C. Regional Bookings Audit & Triage
Inspect all incoming and confirmed bookings across your managed sanctuaries. Exercise override triage if emergency weather or road conditions require re-routing to an alternative sanctuary.

![Bookings Audit](screenshots/08_admin_bookings_audit.png)

### D. Sacred Herd Welfare & Empanelled Vets
Coordinate regular health camps, vaccination schedules, and emergency response with certified regional veterinary doctors.

![Herd Welfare](screenshots/09_admin_animals_welfare.png)

---

## 6. Super Admin (Platform Governance & Treasury) Guide

The Super Admin console provides overarching platform supervision across all Operations Admins, regional clusters, financial arrangements, and banking disbursements.

![Super Admin Overview](screenshots/04_superadmin_overview.png)

### Master Governance Capabilities

#### 1. Operations Admin Delegation & Context Switching
- Assign specific regional Gaushalas to designated Operations Admins.
- **One-Click Context Switching**: The Super Admin can seamlessly view the platform from the perspective of any Operations Admin to audit regional operations without logging out.

#### 2. Master Pricing & Cost Arranger
Configure platform-wide financial parameters:
- **Base Ceremony Fee**: Standard baseline dakshina.
- **Time Duration & Extra Slabs**: Per-hour ceremony rates.
- **Transport Distance Tiers**: Base radius (km), per-km transit surcharge, and toll provisions.
- **Platform Commission %**: Configurable network maintenance share (default 20%).

![Pricing Arranger](screenshots/10_superadmin_pricing_arranger.png)

#### 3. Gaushala Settlements & 80/20 Treasury Ledger
- Complete audit of all collected devotee funds held in escrow.
- Automated generation of Gaushala disbursement batches (80% net share).
- Driver transit pass-through settlement tracking.
- Bank account verification and RazorpayX automated payout batch processing.

![Settlements Ledger](screenshots/11_superadmin_settlements_ledger.png)

---

## 7. Bovine Logistics Driver Guide

Bovine Logistics Drivers operate specially retrofitted, open-bed agricultural transport vehicles equipped with non-slip rubber flooring, hay bedding, and protective railings.

![Driver Console](screenshots/03_driver_console.png)

### Driver Operational Workflow
1. **Receive Mission**: View assigned booking details, including devotee address, customer contact, and Gaushala pickup point.
2. **Pickup & Animal Inspection**: Arrive at sanctuary, inspect animal travel harness, and click **Animal Onboarded**.
3. **Advance Trip Stages**:
   - `Dispatched`: Leaving sanctuary grounds.
   - `In Transit`: Live GPS coordinates are broadcast every 10 seconds to the devotee.
   - `Arrived at Premise`: Parking in designated ground-floor area.
   - `Puja Completed`: Assisting devotee with holy cow pradakshina and feeding.
   - `Safely Returned`: Animal returned to sanctuary shelter.
4. **Instant Settlement**: Upon trip completion, transport payment is credited to the driver’s verified UPI / bank account.

---

## 8. Role Permissions & Access Matrix

| Feature / Portal Module | Devotee (Customer) | Driver | Gaushala Manager | Operations Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Browse Auspicious Muhurats** | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Book Sacred Ceremony** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Track Cow Transport GPS** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manage Herd Health & Roster** | ❌ | ❌ | ✅ (Own Facility) | ✅ (Regional) | ✅ (All) |
| **Confirm Ceremony Availability** | ❌ | ❌ | ✅ | ✅ (Override) | ✅ (Override) |
| **Appoint Gaushala Custodians** | ❌ | ❌ | ❌ | ✅ (Regional) | ✅ (All) |
| **Configure Slabs & Pricing** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Disburse 80/20 Settlements** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Context Switch Across Admins** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 9. Pre-configured System Credentials

All accounts can be accessed using either **Email Address** or **Mobile Phone Number**:

| Role | Name | Email | Mobile Phone | Password | Assigned Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Koushik | `koushik@gmail.com` | `+91 98000 00000` | `Koushik.git` | All Platform Sanctuaries |
| **Super Admin (Alt)** | Koushik | `nanikoushik96@gmail.com` | `+91 98000 00000` | `Koushik.git` | All Platform Sanctuaries |
| **Operations Admin** | Admin_1 | `alt.yq-fs88dj2@yopmail.com` | `+91 98222 33344` | `Koushik.git` | `Gaushala_01`, `Gaushala_02`, `Gaushala_03` |
| **Gaushala Manager** | Manager 1 | `manager1@gomaa.in` | `+91 98111 22233` | `Koushik.git` | `Gaushala_01` Custodian |
| **Gaushala Manager** | Manager 2 | `manager2@gomaa.in` | `+91 98444 55566` | `Koushik.git` | `Gaushala_03` Custodian |

---

*Document Version: 2.4.0 (Production Release)*  
*GOMAA Platform © 2026. All Rights Reserved.*
