import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Invoice Suite 1: SevaTaxInvoiceModal component integrity & compliance", () => {
  const code = fs.readFileSync("src/components/SevaTaxInvoiceModal.tsx", "utf8");

  // 1. Print isolation CSS
  assert.ok(code.includes("@media print"), "Must include strict @media print styling");
  assert.ok(code.includes("gomaa-tax-invoice-portal"), "Must use isolated portal id");
  assert.ok(code.includes("A4 portrait"), "Must enforce standard A4 portrait dimensions");

  // 2. Devotee and Sanctuary credentials
  assert.ok(code.includes("Devotee Dossier (Billed To)"), "Must display billed-to devotee details");
  assert.ok(code.includes("Providing Sanctuary Base"), "Must display providing sanctuary details");
  assert.ok(code.includes("Altar Delivery Venue"), "Must display delivery venue with GPS coordinates");

  // 3. Itemized Seva Dakshina table & calculations
  assert.ok(code.includes("Itemized Seva Dakshina"), "Must include itemized table");
  assert.ok(code.includes("Sacred Bovine Seva"), "Must itemize base bovine puja");
  assert.ok(code.includes("Safe Cattle Ambulance Transit"), "Must itemize transit ambulance");
  assert.ok(code.includes("selectedAddons"), "Must dynamically itemize consecrated offerings/addons");

  // 4. Gaushala Trust Payout & Operations Governance section
  assert.ok(code.includes("Gaushala Trust Payout"), "Must display gaushala payout and governance section");
  assert.ok(code.includes("Gaushala Trust Net Share"), "Must display gaushala net share");
  assert.ok(code.includes("Platform Escrow Reserve"), "Must display platform reserve");
  assert.ok(code.includes("Transit Logistics Dispatch"), "Must display logistics dispatch details");

  // 5. Payment & Security OTP
  assert.ok(code.includes("Payment &amp; Escrow Verification") || code.includes("Payment & Escrow Verification"), "Must show payment escrow proof");
  assert.ok(code.includes("Sacred Altar Handover OTP"), "Must display handover OTP security box");
  assert.ok(code.includes("Section 80G"), "Must include 80G tax exemption and PCA 1960 compliance notice");
});

test("Invoice Suite 2: Admin Bookings integration", () => {
  const code = fs.readFileSync("src/views/Bookings.tsx", "utf8");

  assert.ok(code.includes("import SevaTaxInvoiceModal"), "Bookings.tsx must import SevaTaxInvoiceModal");
  assert.ok(code.includes("<SevaTaxInvoiceModal"), "Bookings.tsx must render SevaTaxInvoiceModal");
  assert.ok(code.includes("selectedInvoiceBooking"), "Bookings.tsx must maintain selectedInvoiceBooking state");
  assert.ok(code.includes("Tax Invoice"), "Drawer must include Tax Invoice action button");
  assert.ok(code.includes("setSelectedInvoiceBooking(b)"), "Table rows must wire setSelectedInvoiceBooking");
});

test("Invoice Suite 3: Gaushala Manager Queue integration", () => {
  const code = fs.readFileSync("src/views/manager/Queue.tsx", "utf8");

  assert.ok(code.includes("import SevaTaxInvoiceModal"), "Queue.tsx must import SevaTaxInvoiceModal");
  assert.ok(code.includes("<SevaTaxInvoiceModal"), "Queue.tsx must render SevaTaxInvoiceModal");
  assert.ok(code.includes("invoiceModalBooking"), "Queue.tsx must track invoiceModalBooking state");
  assert.ok(code.includes("onOpenInvoiceModal"), "ReviewCard must receive onOpenInvoiceModal callback");
});

test("Invoice Suite 4: Gaushala Manager Schedule integration", () => {
  const code = fs.readFileSync("src/views/manager/Schedule.tsx", "utf8");

  assert.ok(code.includes("import SevaTaxInvoiceModal"), "Schedule.tsx must import SevaTaxInvoiceModal");
  assert.ok(code.includes("<SevaTaxInvoiceModal"), "Schedule.tsx must render SevaTaxInvoiceModal");
  assert.ok(code.includes("invoiceModalBooking"), "Schedule.tsx must track invoiceModalBooking state");
  assert.ok(code.includes("Tax Invoice"), "Schedule cards must include Tax Invoice button");
});

test("Invoice Suite 5: Gaushala Manager Ledger integration", () => {
  const code = fs.readFileSync("src/views/manager/ManagerLedger.tsx", "utf8");

  assert.ok(code.includes("import SevaTaxInvoiceModal"), "ManagerLedger.tsx must import SevaTaxInvoiceModal");
  assert.ok(code.includes("<SevaTaxInvoiceModal"), "ManagerLedger.tsx must render SevaTaxInvoiceModal");
  assert.ok(code.includes("taxInvoiceBooking"), "ManagerLedger.tsx must track taxInvoiceBooking state");
  assert.ok(code.includes("Official Tax Invoice"), "ManagerLedger.tsx must include Official Tax Invoice button");
});

test("Invoice Suite 6: Customer Details Modal invoice action", () => {
  const code = fs.readFileSync("src/components/CustomerDetailsModal.tsx", "utf8");

  assert.ok(code.includes("onOpenInvoice?:"), "CustomerDetailsModalProps must accept onOpenInvoice");
  assert.ok(code.includes("View Tax Invoice"), "CustomerDetailsModal must feature View Tax Invoice button");
});
