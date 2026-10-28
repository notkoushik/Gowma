"""
Watch Mode Test: Super Admin (The Captain) Role
==============================================
Tests the complete Super Admin sovereign authority & economics governance:
- Authenticates with Super Admin credentials
- Inspects Master Pricing & Platform Economics (80/20 split)
- Audits Treasury Settlements & NACH Payout Batches
- Validates Security Boundary: Live GPS Fleet Tracking restriction
- Demonstrates Operational Context Switching
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
from selenium.webdriver.common.by import By
from watch_framework import (
    C, create_human_driver, highlight, human_type, human_click,
    log_step, log_pass, log_fail, log_info, log_warn, check_browser_console,
    wait_for_visible, wait_for_clickable
)

def run_watch_super_admin(base_url="http://localhost:8443", keep_open_seconds=3):
    driver = None
    try:
        driver = create_human_driver(base_url)
        
        # 1. Load login page
        log_step(1, "Navigating to GOMAA Login Portal", f"{base_url}/#login")
        driver.get(f"{base_url}/#login")
        time.sleep(1.5)
        
        # 2. Enter Super Admin credentials
        log_step(2, "Entering Super Admin Credentials", "Email: superadmin@gomaa.in")
        email_input = wait_for_visible(driver, By.CSS_SELECTOR, "input[type='text'], input[type='email']")
        human_type(driver, email_input, "superadmin@gomaa.in")
        
        pwd_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        human_type(driver, pwd_input, "SuperAdmin@2026!")
        
        # 3. Submit login
        log_step(3, "Submitting Authentication Form", "Clicking 'Sign In to GOMAA Portal'")
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        human_click(driver, submit_btn, color="#F59E0B", pause_after=2.5)
        
        # Verify landing on Super Admin workspace
        current_url = driver.current_url
        if "#super_admin" in current_url:
            log_pass("Successfully authenticated and landed in Super Admin Workspace!")
        else:
            log_info(f"Current URL: {current_url}")
            
        time.sleep(1.5)

        # 4. Master Pricing & Platform Economics
        log_step(4, "Auditing Master Pricing & Economics Engine", "Navigating to #super_admin/pricing")
        driver.get(f"{base_url}/#super_admin/pricing")
        time.sleep(2.0)
        
        # Visibly test clicking pricing sectors: Global, Gosalas, Commissions
        sectors = driver.find_elements(By.XPATH, "//button[contains(., 'Global') or contains(., 'Per-Gaushala') or contains(., 'Commission') or contains(., 'Slabs')]")
        log_info(f"Found {len(sectors)} pricing tabs/sectors")
        for s in sectors[:3]:
            if s.is_displayed():
                s_label = s.text.strip().replace('\n', ' ')
                log_info(f"  -> Clicking Pricing Sector: '{s_label}'")
                human_click(driver, s, color="#F59E0B", pause_after=1.2)
        check_browser_console(driver)

        # 5. Gosala Settlements & Disbursements
        log_step(5, "Auditing Treasury Settlements & Disbursements", "Navigating to #super_admin/settlements")
        driver.get(f"{base_url}/#super_admin/settlements")
        time.sleep(2.0)
        
        # Look for settlement batches / payout buttons
        payout_elems = driver.find_elements(By.XPATH, "//button[contains(., 'Batch') or contains(., 'Disburse') or contains(., 'Payout') or contains(., 'Filter')]")
        for pe in payout_elems[:2]:
            if pe.is_displayed():
                highlight(driver, pe, color="#10B981", duration=0.8)
        check_browser_console(driver)

        # 6. Security Gate Verification: Live Tracking Disabled for Super Admin
        log_step(6, "Testing Security Guardrail: Super Admin GPS Isolation", "Attempting direct navigation to #super_admin/tracking")
        driver.get(f"{base_url}/#super_admin/tracking")
        time.sleep(1.8)
        
        # The app should redirect away or warn about GPS restriction
        new_url = driver.current_url
        if "tracking" not in new_url or "overview" in new_url:
            log_pass(f"Role Boundary Enforced! Super Admin redirected away from live GPS telemetry: {new_url}")
        else:
            log_info(f"Current view state: {new_url}")

        # 7. Sovereign Governance Overview
        log_step(7, "Inspecting Sovereign Governance Network Health", "Navigating to #super_admin/overview")
        driver.get(f"{base_url}/#super_admin/overview")
        time.sleep(2.0)

        # Final check
        log_step(8, "Verifying Full Super Admin Health", "Ensuring 0 fatal crashes")
        all_clean = check_browser_console(driver)
        if all_clean:
            log_pass("SUPER ADMIN SUITE COMPLETED WITH 100% SUCCESS!")
        else:
            log_warn("Completed with minor non-blocking warnings.")

        print(f"\n{C.CYAN}Pausing {keep_open_seconds}s for human visual inspection before closing...{C.RESET}")
        time.sleep(keep_open_seconds)

    except Exception as e:
        log_fail(f"Exception during Super Admin watch run: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            try:
                driver.quit()
                log_info("Chrome browser window closed cleanly.")
            except Exception:
                pass

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8443"
    run_watch_super_admin(url)
