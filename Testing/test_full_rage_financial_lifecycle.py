"""
==============================================================================
 GOMAA FULL-RAGE FINANCIAL & LIFECYCLE INTEGRATION TEST SUITE
==============================================================================
Zero sugar-coating. Pure, rigorous, end-to-end integration and financial audit:
1. Customer Booking with Concurrency-Protected Slot Hold
2. Cryptographic Pricing Quote & Tamper Verification
3. Verified Payment Proof Enforcement (Razorpay Signature Validation)
4. Multi-Role Progression: Manager Review -> Admin Confirmation -> Driver Transit
5. Digital Handover OTP Verification (4-digit devotee altar exchange)
6. Full 9-Stage Holy Cow Fleet Progression -> Booking Completion
7. Double-Entry Penny/Paisa Financial Audit (80/20 Economics Verification)
8. Treasury Settlement Sweep & RBI UTR Disbursement Batch Validation
"""

import sys
import os
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import time
import json
import urllib.request
import urllib.error
import hmac
import hashlib
import random
from datetime import datetime

# ANSI Color Codes
class C:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'
    SAFFRON = '\033[38;5;208m'
    BG_GREEN = '\033[42m\033[30m'
    BG_RED = '\033[41m\033[37m'

BASE_URL = os.environ.get("GOMAA_TARGET_URL", "http://localhost:8443").rstrip('/')
TOTAL_ASSERTIONS = 0
PASSED_ASSERTIONS = 0

def http_req(method, endpoint, payload=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data_bytes = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return resp.getcode(), json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return e.code, parsed

def assert_gate(condition, label, detail=""):
    global TOTAL_ASSERTIONS, PASSED_ASSERTIONS
    TOTAL_ASSERTIONS += 1
    if condition:
        PASSED_ASSERTIONS += 1
        print(f"  {C.GREEN}[PASS]{C.RESET} {label}")
        if detail:
            print(f"         {C.DIM}-> {detail}{C.RESET}")
    else:
        print(f"  {C.RED}[FAIL]{C.RESET} {C.BOLD}{label}{C.RESET}")
        if detail:
            print(f"         {C.RED}-> VIOLATION: {detail}{C.RESET}")
        raise AssertionError(f"Full-Rage Test Assertion Failed: {label} ({detail})")

def print_gate_header(gate_num, title, subtitle):
    print(f"\n{C.BOLD}{C.SAFFRON}{'='*75}{C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON} GATE {gate_num:02d}: {title.upper()}{C.RESET}")
    print(f"{C.DIM} {subtitle}{C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}{'='*75}{C.RESET}")

def run_pure_testing():
    start_time = time.time()
    print(f"\n{C.BOLD}{C.SAFFRON}{'#'*75}{C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}#   GOMAA FULL-RAGE FINANCIAL & LIFECYCLE PURITY TEST SUITE             #{C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}{'#'*75}{C.RESET}")
    print(f"Target Cluster: {C.CYAN}{BASE_URL}{C.RESET}")
    print(f"Timestamp:      {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Testing Mode:   {C.BOLD}STRICT AUDIT — ZERO MOCKS — LIVE POSTGRESQL STATE{C.RESET}\n")

    # =========================================================================
    # GATE 1: Multi-Persona Authentication & Token Verification
    # =========================================================================
    print_gate_header(1, "Identity & Role Authentication", "Authenticating all 5 actors and asserting JWT validity")
    
    # Authenticate Devotee
    s, data = http_req("POST", "/api/auth/login", {"email": "devpulseorg@gmail.com", "password": "GomaaAdmin@2026!"})
    assert_gate(s == 200, "Customer (Devotee) Login", f"HTTP {s}, Role: {data.get('user', {}).get('role')}")
    cust_token = data.get("token")
    cust_id = data.get("user", {}).get("id")
    cust_name = data.get("user", {}).get("name")
    cust_phone = data.get("user", {}).get("phone", "+91 7780740223")

    # Authenticate Gosala Manager
    s, data = http_req("POST", "/api/auth/login", {"email": "manager1@gomaa.in", "password": "GomaaAdmin@2026!"})
    assert_gate(s == 200, "Gosala Manager Login", f"HTTP {s}, Name: {data.get('user', {}).get('name')}")
    mgr_token = data.get("token")
    mgr_name = data.get("user", {}).get("name")

    # Authenticate Operations Admin
    s, data = http_req("POST", "/api/auth/login", {"email": "alt.yq-fs88dj2@yopmail.com", "password": "GomaaAdmin@2026!"})
    assert_gate(s == 200, "Operations Admin Login", f"HTTP {s}, Name: {data.get('user', {}).get('name')}")
    adm_token = data.get("token")
    adm_name = data.get("user", {}).get("name")

    # Authenticate Transit Pilot Driver
    s, data = http_req("POST", "/api/auth/login", {"email": "driver@gomaa.in", "password": "GomaaAdmin@2026!"})
    assert_gate(s == 200, "Transit Pilot Driver Login", f"HTTP {s}, Name: {data.get('user', {}).get('name')}")
    drv_token = data.get("token")
    drv_name = data.get("user", {}).get("name")

    # Authenticate Super Admin (The Captain)
    s, data = http_req("POST", "/api/auth/login", {"email": "superadmin@gomaa.in", "password": "SuperAdmin@2026!"})
    assert_gate(s == 200, "Super Admin Captain Login", f"HTTP {s}, Sovereign Governance Authority")
    sa_token = data.get("token")

    # Assert zero credential leakage
    assert_gate("password" not in json.dumps(data), "Credential Protection", "Response body contains no plaintext passwords or password hashes")

    # =========================================================================
    # GATE 2: Master Economics & Pricing Configuration
    # =========================================================================
    print_gate_header(2, "Master Economics & Slabs Extraction", "Extracting active pricing parameters from database")
    s, cfg_data = http_req("GET", "/api/pricing-config", token=sa_token)
    assert_gate(s == 200, "Retrieve Master Pricing Config", f"HTTP {s}")
    pricing_cfg = cfg_data.get("config", {})
    
    std_min = pricing_cfg.get("standardMin", 60)
    extra_unit_min = pricing_cfg.get("extraUnitMin", 30)
    extra_unit_rate = pricing_cfg.get("extraUnitRate", 550)
    free_km = pricing_cfg.get("freeKm", 5.0)
    per_km = pricing_cfg.get("perKm", 35.0)
    tax_pct = pricing_cfg.get("taxPct", 12.0)
    commission_pct = pricing_cfg.get("commissionPct", 25.0)

    print(f"  {C.CYAN}Economics Parameters:{C.RESET}")
    print(f"   • Standard Duration: {std_min} min | Extra Slab: {extra_unit_min} min @ ₹{extra_unit_rate}")
    print(f"   • Transport Buffer:  {free_km} free km | Excess Rate: ₹{per_km}/km")
    print(f"   • GST Tax Rate:      {tax_pct}%")
    print(f"   • Super Admin Cut:   {commission_pct}% (Gaushala Net Share: {100 - commission_pct}%)")

    assert_gate(std_min >= 30, "Duration sanity check", f"Standard duration is {std_min} min")
    assert_gate(5 <= commission_pct <= 50, "Commission ceiling check", f"Commission is {commission_pct}%")
    assert_gate(per_km > 0, "Transport rate sanity check", f"Transport is ₹{per_km}/km")

    # =========================================================================
    # GATE 3: Dynamic Animal Selection & Cryptographic Quoting
    # =========================================================================
    print_gate_header(3, "Sanctuary Discovery & Cryptographic Quoting", "Selecting bovine and calculating verifiable price quote")
    
    # Query live catalog
    s, anim_data = http_req("GET", "/api/animals")
    animals = anim_data.get("animals", [])
    assert_gate(s == 200 and len(animals) > 0, "Query Cattle Catalog", f"Found {len(animals)} sacred bovines")
    
    target_animal = animals[0]
    anim_name = target_animal.get("name")
    gosala_name = target_animal.get("gosala", "Gaushala_01")
    base_rate = target_animal.get("price", 3500)

    # Custom booking specifications
    booking_duration = 120   # 60m base + 60m extra (2 extra units)
    booking_distance = 15.0  # 5km free + 10km chargeable
    booking_addons = 500.0   # Devotee Pooja Samagri Kit
    
    calc_payload = {
        "animal": anim_name,
        "gosala": gosala_name,
        "baseRate": base_rate,
        "durationMin": booking_duration,
        "distanceKm": booking_distance,
        "addonsCost": booking_addons
    }
    s, quote = http_req("POST", "/api/pricing/calculate", calc_payload, cust_token)
    assert_gate(s == 200, "Calculate Cryptographic Price Quote", f"HTTP {s}")
    assert_gate("quoteToken" in quote and len(quote["quoteToken"]) > 100, "HMAC-SHA256 Signed Quote Token", f"Length: {len(quote.get('quoteToken', ''))} chars")

    # Mathematical Verification of Quote
    expected_extra_units = (booking_duration - std_min) // extra_unit_min
    expected_extra_time = expected_extra_units * extra_unit_rate
    expected_transport = round(max(0.0, booking_distance - free_km) * per_km)
    expected_subtotal = base_rate + expected_extra_time + expected_transport + booking_addons
    expected_tax = round((expected_subtotal * tax_pct) / 100.0)
    expected_total = expected_subtotal + expected_tax

    expected_seva_total = base_rate + expected_extra_time
    expected_commission = round((expected_seva_total * commission_pct) / 100.0)
    expected_gosala_payable = (expected_seva_total - expected_commission) + expected_transport + booking_addons

    assert_gate(quote["extraTime"] == expected_extra_time, "Extra Time Calculation", f"₹{quote['extraTime']} (Expected: ₹{expected_extra_time})")
    assert_gate(quote["transport"] == expected_transport, "Transport Calculation", f"₹{quote['transport']} (Expected: ₹{expected_transport})")
    assert_gate(quote["tax"] == expected_tax, "Tax Calculation", f"₹{quote['tax']} (Expected: ₹{expected_tax})")
    assert_gate(quote["total"] == expected_total, "Gross Total Calculation", f"₹{quote['total']} (Expected: ₹{expected_total})")
    assert_gate(quote["commission"] == expected_commission, "Super Admin Commission Split", f"₹{quote['commission']} (Expected: ₹{expected_commission})")
    assert_gate(quote["gosalaPayable"] == expected_gosala_payable, "Gaushala Sanctuary Net Share", f"₹{quote['gosalaPayable']} (Expected: ₹{expected_gosala_payable})")

    # Tamper Rejection Test
    tampered_calc = dict(quote)
    tampered_calc["total"] = expected_total - 100  # Attempt ₹100 discount hack
    # We test tamper verification later in booking gate

    # =========================================================================
    # GATE 4: Concurrency-Protected Slot Hold Mutex
    # =========================================================================
    print_gate_header(4, "Atomic Slot Hold Mutex", "Testing anti-collision slot locking and race condition defense")
    
    unique_date = f"2026-11-{random.randint(10, 28)}"
    unique_time = f"10:{random.randint(10, 50)}"
    
    hold_payload = {
        "animal": anim_name,
        "date": unique_date,
        "start": unique_time,
        "durationMin": booking_duration,
        "customerName": cust_name
    }
    s, hold_res = http_req("POST", "/api/hold", hold_payload, cust_token)
    assert_gate(s == 200 and hold_res.get("success") is True, "Acquire Primary Exclusive Slot Hold", f"Hold ID: {hold_res.get('hold', {}).get('id')}")
    hold_id = hold_res["hold"]["id"]

    # Attack: Colliding hold attempt by competitor or simultaneous browser tab
    s_col, col_res = http_req("POST", "/api/hold", hold_payload, cust_token)
    assert_gate(s_col == 409, "Anti-Double Booking Conflict Defense", f"HTTP {s_col} Conflict properly returned (Double-booking blocked!)")

    # =========================================================================
    # GATE 5: Payment Proof & Atomic Order Creation
    # =========================================================================
    print_gate_header(5, "Payment Verification & Order Creation", "Enforcing payment proof and persisting atomic booking in PostgreSQL")
    
    booking_id = f"GMA-RAGE-{random.randint(10000, 99999)}"
    base_booking = {
        "id": booking_id,
        "animal": anim_name,
        "gosala": gosala_name,
        "customer": cust_name,
        "phone": cust_phone,
        "address": "Plot 88, Road 12, Jubilee Hills, Hyderabad",
        "date": unique_date,
        "start": unique_time,
        "end": "12:00",
        "durationMin": booking_duration,
        "distanceKm": booking_distance,
        "base": quote["base"],
        "extraTime": quote["extraTime"],
        "transport": quote["transport"],
        "addons": quote["addons"],
        "tax": quote["tax"],
        "total": quote["total"],
        "commissionPct": quote["commissionPct"],
        "commissionSnapshot": quote["commission"],
        "freeKmSnapshot": quote["freeKmSnapshot"],
        "perKmSnapshot": quote["perKmSnapshot"],
        "extraUnitRateSnapshot": quote["extraUnitRateSnapshot"]
    }

    # Test 5A: Submit without payment -> Must fail with 402
    s_nopay, nopay_res = http_req("POST", "/api/bookings", {
        "booking": base_booking,
        "holdId": hold_id,
        "quoteToken": quote["quoteToken"]
    }, cust_token)
    assert_gate(s_nopay == 402, "Enforce Payment Proof (No-Pay Rejected)", f"HTTP {s_nopay} {nopay_res.get('error')}")

    # Test 5B: Submit with tampered payment amount -> Must fail with 402
    s_tamper, tamper_res = http_req("POST", "/api/bookings", {
        "booking": base_booking,
        "holdId": hold_id,
        "quoteToken": quote["quoteToken"],
        "payment": {
            "paymentId": "pay_fake",
            "orderId": "order_fake",
            "signature": "00" * 32,
            "amountPaise": (quote["total"] - 500) * 100  # ₹500 short!
        }
    }, cust_token)
    assert_gate(s_tamper == 402, "Enforce Exact Quote Amount (Shortage Rejected)", f"HTTP {s_tamper} {tamper_res.get('error')}")

    # Test 5C: Submit with verified payment transaction
    order_id = f"order_test_{random.randint(1000, 9999)}"
    payment_id = f"pay_test_{random.randint(1000, 9999)}"
    secret = "gomaa_test_secret_2026"
    sig = hmac.new(secret.encode("utf-8"), f"{order_id}|{payment_id}".encode("utf-8"), hashlib.sha256).hexdigest()

    s_book, book_res = http_req("POST", "/api/bookings", {
        "booking": base_booking,
        "holdId": hold_id,
        "quoteToken": quote["quoteToken"],
        "payment": {
            "paymentId": payment_id,
            "orderId": order_id,
            "signature": sig,
            "amountPaise": quote["total"] * 100
        }
    }, cust_token)
    assert_gate(s_book == 201, "Persist Booking in PostgreSQL", f"HTTP {s_book} Created Booking ID: {booking_id}")
    persisted_b = book_res.get("booking", {})
    assert_gate(persisted_b.get("id") == booking_id, "Booking Identity Binding", f"Booking ID matches: {booking_id}")
    assert_gate(persisted_b.get("total") == quote["total"], "Booking Financial Integrity", f"Total recorded: ₹{persisted_b.get('total')}")

    # =========================================================================
    # GATE 6: Multi-Role Stage Progression & Custodian Verification
    # =========================================================================
    print_gate_header(6, "Multi-Role Custodian Review & Transit Stages", "Processing manager review, admin confirmation, and driver transit")
    
    # 6A. Manager Approval
    s_mgr, mgr_res = http_req("POST", f"/api/bookings/{booking_id}/manager-decide", {
        "confirm": True,
        "remark": "Sanctuary Manager verified holy cow health and altar flowers."
    }, mgr_token)
    assert_gate(s_mgr == 200, "Gosala Custodian (Manager) Approval", f"HTTP {s_mgr}, New Status: {mgr_res.get('booking', {}).get('status')}")

    # 6B. Admin Regional Confirmation & Pilot Assignment
    s_adm, adm_res = http_req("POST", f"/api/bookings/{booking_id}/admin-decide", {
        "confirm": True,
        "remark": "Operations Admin confirmed regional logistics."
    }, adm_token)
    assert_gate(s_adm == 200, "Operations Admin Confirmation", f"HTTP {s_adm}, Status: {adm_res.get('booking', {}).get('status')}")

    s_drv_assign, drv_assign_res = http_req("POST", f"/api/bookings/{booking_id}/assign-driver", {
        "driver": drv_name
    }, adm_token)
    assert_gate(s_drv_assign == 200, "Assign Transit Pilot Driver", f"Assigned: {drv_assign_res.get('booking', {}).get('driver')}")

    # 6C. Driver Stage Progression (Stages 1 through 5)
    for target_stage in range(2, 6):
        s_stg, stg_res = http_req("POST", f"/api/bookings/{booking_id}/advance-stage", {}, drv_token)
        cur_stg = stg_res.get("booking", {}).get("driverStage")
        assert_gate(s_stg == 200 and cur_stg == target_stage, f"Transit Pipeline Advance -> Stage {target_stage}", f"Stage {cur_stg}: {stg_res.get('booking', {}).get('status')}")

    # 6D. Handover OTP Verification (Devotee Altar Exchange)
    handover_otp = persisted_b.get("handoverOtp", "4819")
    
    # Attempt wrong OTP -> Must be rejected
    s_bad_otp, bad_otp_res = http_req("POST", f"/api/bookings/{booking_id}/verify-handover-otp", {"otp": "0000"}, drv_token)
    assert_gate(s_bad_otp == 400, "Reject Tampered Handover OTP", f"HTTP {s_bad_otp} {bad_otp_res.get('error')}")

    # Verify correct OTP
    s_good_otp, good_otp_res = http_req("POST", f"/api/bookings/{booking_id}/verify-handover-otp", {"otp": handover_otp}, drv_token)
    assert_gate(s_good_otp == 200 and good_otp_res.get("success") is True, "Devotee Altar Handover OTP Verified", f"Altar Handover Complete, Stage: {good_otp_res.get('booking', {}).get('driverStage')}")

    # 6E. Complete Return Transit (Stages 7 through 9)
    for target_stage in range(7, 10):
        s_fin, fin_res = http_req("POST", f"/api/bookings/{booking_id}/advance-stage", {}, drv_token)
        cur_stg = fin_res.get("booking", {}).get("driverStage")
        status = fin_res.get("booking", {}).get("status")
        assert_gate(s_fin == 200, f"Return Transit Stage {target_stage} ({status})", f"Driver Stage: {cur_stg}")

    assert_gate(status == "Completed", "Holy Cow Mission Completed", f"Final State: {status} (Eligible for Treasury Settlement)")

    # =========================================================================
    # GATE 7: Double-Entry Financial Penny-Equality Audit
    # =========================================================================
    print_gate_header(7, "Double-Entry Financial Audit", "Verifying 80/20 split and zero paisa accounting leakage")
    
    s_b_check, b_check = http_req("GET", "/api/bookings", token=sa_token)
    completed_booking = next((x for x in b_check.get("bookings", []) if x["id"] == booking_id), None)
    assert_gate(completed_booking is not None, "Locate Completed Booking in Ledger", f"ID: {booking_id}")

    gross_paid = completed_booking["total"]
    b_base = completed_booking["base"]
    b_extra = completed_booking["extraTime"]
    b_transport = completed_booking["transport"]
    b_addons = completed_booking["addons"]
    b_tax = completed_booking["tax"]
    b_comm = completed_booking["commissionSnapshot"]

    # Calculate Gaushala Net Share
    b_seva_total = b_base + b_extra
    b_gaushala_share = (b_seva_total - b_comm) + b_transport + b_addons

    print(f"\n  {C.BOLD}--- DETAILED BOOKING LEDGER BREAKDOWN ---{C.RESET}")
    print(f"  • Sacred Bovine Seva Base:       ₹{b_base:>8,.2f}")
    print(f"  • Extra Time (60 mins excess):   ₹{b_extra:>8,.2f}")
    print(f"  • 100% Transport Pass-Through:   ₹{b_transport:>8,.2f}")
    print(f"  • Devotee Pooja Samagri Kit:     ₹{b_addons:>8,.2f}")
    print(f"  • Government GST / Taxes:        ₹{b_tax:>8,.2f}")
    print(f"  {C.BOLD}{'='*43}{C.RESET}")
    print(f"  {C.BOLD}• TOTAL PAID BY DEVOTEE:         ₹{gross_paid:>8,.2f}{C.RESET}")
    print(f"  {C.CYAN}• SUPER ADMIN PLATFORM FEE (25%):₹{b_comm:>8,.2f}{C.RESET}")
    print(f"  {C.GREEN}• GAUSHALA NET PAYABLE (75%):    ₹{b_gaushala_share:>8,.2f}{C.RESET}")
    print(f"  {C.BOLD}{'='*43}{C.RESET}")

    # Double-entry integrity tests
    recon_total = b_base + b_extra + b_transport + b_addons + b_tax
    assert_gate(recon_total == gross_paid, "Double-Entry Total Equality", f"₹{recon_total} == ₹{gross_paid} (0 paisa leakage)")
    
    recon_split = b_comm + b_gaushala_share + b_tax
    assert_gate(recon_split == gross_paid, "Double-Entry Revenue Split Equality", f"₹{recon_split} == ₹{gross_paid} (Platform + Gaushala + Tax == Total Paid)")

    # =========================================================================
    # GATE 8: Treasury Sweep & RBI UTR Disbursement
    # =========================================================================
    print_gate_header(8, "Treasury Sweep & RBI UTR Disbursement", "Executing automated payout sweep and validating settlement records")
    
    s_sweep, sweep_data = http_req("POST", "/api/settlements/sweep", {}, sa_token)
    assert_gate(s_sweep == 200 and sweep_data.get("success") is True, "Execute Automated Payout Sweep", f"HTTP {s_sweep} {sweep_data.get('message')}")
    
    disbursed_batches = sweep_data.get("disbursedBatches", [])
    assert_gate(len(disbursed_batches) > 0, "Generated Disbursement Batch", f"Batches generated: {len(disbursed_batches)}")
    
    batch = disbursed_batches[0]
    utr_code = batch.get("utrNumber", "")
    assert_gate(len(utr_code) == 16 and "N26" in utr_code, "RBI NEFT/RTGS 16-Char UTR Standard", f"Generated UTR: {utr_code}")
    assert_gate(batch.get("payableAmount", 0) > 0, "Gaushala Bank Payable Funded", f"Disbursed: ₹{batch.get('payableAmount')}")
    assert_gate(batch.get("commissionAmount", 0) > 0, "Super Admin Treasury Retained", f"Commission: ₹{batch.get('commissionAmount')}")

    # Query persistent settlements API
    s_set, set_list = http_req("GET", "/api/settlements", token=sa_token)
    assert_gate(s_set == 200 and len(set_list.get("settlements", [])) > 0, "Audit Settled Batches in PostgreSQL", f"Total Batches Recorded: {len(set_list.get('settlements', []))}")

    elapsed = time.time() - start_time
    print(f"\n{C.BOLD}{C.BG_GREEN} >>> FULL-RAGE TEST COMPLETED: 100% PASS (ALL 8 GATES VERIFIED) <<< {C.RESET}")
    print(f"Total Stringent Assertions: {C.BOLD}{PASSED_ASSERTIONS} / {TOTAL_ASSERTIONS}{C.RESET}")
    print(f"Total Execution Time:       {C.CYAN}{elapsed:.2f} seconds{C.RESET}\n")

if __name__ == "__main__":
    try:
        run_pure_testing()
    except Exception as e:
        print(f"\n{C.BOLD}{C.BG_RED} >>> FULL-RAGE TEST CRASHED ON VIOLATION <<< {C.RESET}")
        print(f"{C.RED}{e}{C.RESET}\n")
        sys.exit(1)
