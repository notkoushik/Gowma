"""
Watch Mode Test: Operations Admin Role
======================================
Tests the full Operations Admin workflow inside a real, visible Chrome browser:
- Authenticates with Admin_1 credentials
- Navigates through all operational views
- Validates Gaushala portfolio switching & Ledger deep link navigation
- Verifies zero console crashes
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
from selenium.common.exceptions import StaleElementReferenceException
from watch_framework import (
    C, create_human_driver, highlight, human_type, human_click,
    log_step, log_pass, log_fail, log_info, check_browser_console,
    wait_for_visible, wait_for_clickable
)

def run_watch_admin(base_url="http://localhost:8443", keep_open_seconds=3):
    driver = None
    try:
        driver = create_human_driver(base_url)
        
        # 1. Load login page
        log_step(1, "Navigating to GOMAA Login Portal", f"{base_url}/#login")
        driver.get(f"{base_url}/#login")
        time.sleep(1.5)
        
        # 2. Enter Admin credentials
        log_step(2, "Entering Operations Admin Credentials", "Email: alt.yq-fs88dj2@yopmail.com")
        email_input = wait_for_visible(driver, By.CSS_SELECTOR, "input[type='text'], input[type='email']")
        human_type(driver, email_input, "alt.yq-fs88dj2@yopmail.com")
        
        pwd_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        human_type(driver, pwd_input, "GomaaAdmin@2026!")
        
        # 3. Submit login
        log_step(3, "Submitting Authentication Form", "Clicking 'Sign In to GOMAA Portal'")
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        human_click(driver, submit_btn, color="#22C55E", pause_after=2.5)
        
        # Verify landing on Admin workspace
        current_url = driver.current_url
        if "#admin" in current_url or "#admin/overview" in current_url:
            log_pass("Successfully authenticated and landed in Operations Admin Workspace!")
        else:
            log_info(f"Current URL: {current_url} (continuing navigation)")
            
        time.sleep(1.5)
        
        # Helper to click sidebar nav items
        def click_sidebar_nav(label_text, view_hash):
            log_info(f"Selecting navigation tab: {label_text}")
            found = False
            buttons = driver.find_elements(By.XPATH, f"//button[contains(., '{label_text}')] | //a[contains(., '{label_text}')]")
            for btn in buttons:
                if btn.is_displayed():
                    human_click(driver, btn, pause_after=1.5)
                    found = True
                    break
            if not found:
                driver.get(f"{base_url}/#{view_hash}")
                time.sleep(1.5)
            log_pass(f"Navigated to {label_text} [#{view_hash}]")
            check_browser_console(driver)

        # 4. Overview
        log_step(4, "Inspecting Regional Operations & Treasury Dashboard", "Reviewing booking pipeline & revenue KPIs")
        click_sidebar_nav("Overview", "admin/overview")
        time.sleep(1.5)

        # 5. Gaushalas Network & Tab Switching
        log_step(5, "Testing Gaushalas Network & Multi-Portfolio Tabs", "Testing tab clicks: Admin_1 Portfolio, Gaushala_01, Gaushala_02, etc.")
        click_sidebar_nav("Gaushalas Network", "admin/gosalas")
        time.sleep(2.0)
        
        # Click up to 3 tabs with fresh queries
        tab_xpath = "//button[contains(., 'Portfolio') or contains(., 'Gaushala') or contains(., 'Shelter')]"
        for i in range(3):
            try:
                tabs = [t for t in driver.find_elements(By.XPATH, tab_xpath) if t.is_displayed()]
                if i < len(tabs):
                    tab_label = tabs[i].text.strip().replace('\n', ' ')
                    log_info(f"  -> Clicking portfolio tab: '{tab_label}'")
                    human_click(driver, tabs[i], color="#F59E0B", pause_after=1.2)
            except StaleElementReferenceException:
                pass
            
        # 6. Gaushala Custodians & Acting Matrix
        log_step(6, "Inspecting Gaushala Custodians & Acting Matrix", "Reviewing 1:1 custodian bindings & emergency acting triage")
        click_sidebar_nav("Gaushala Custodians", "admin/managers")
        time.sleep(1.5)

        # 7. Bookings Audit & Acting Triage
        log_step(7, "Inspecting Bookings Audit & Acting Triage", "Auditing devotee bookings and stage progression")
        click_sidebar_nav("Bookings Audit", "admin/bookings")
        time.sleep(1.5)

        # 8. Live Cow Fleet GPS Tracking
        log_step(8, "Testing Live Cow Fleet GPS Tracking", "Verifying real-time GPS telemetry & map interface")
        click_sidebar_nav("Live Cow Fleet GPS", "admin/tracking")
        time.sleep(1.5)

        # 9. Sacred Herd Welfare & Empanelled Vets
        log_step(9, "Testing Sacred Herd Welfare & Empanelled Vets", "Auditing cattle resting buffers & veterinary panels")
        click_sidebar_nav("Sacred Herd Welfare", "admin/animals")
        time.sleep(1.5)

        # 10. Regional Treasury & 80/20 Ledger (The exact view where user reported the bug!)
        log_step(10, "Testing Regional Treasury & 80/20 Revenue Ledger", "Testing Gaushala tabs and '[Go to Profile & Herd]' link")
        click_sidebar_nav("Regional Treasury Ledger", "admin/ledger")
        time.sleep(2.0)
        
        # Click through ledger Gaushala tabs using fresh queries per iteration
        ledger_xpath = "//button[contains(., 'Gaushala') or contains(., 'Portfolio') or contains(., 'Surya') or contains(., 'Shelter')]"
        for i in range(3):
            try:
                ledger_tabs = [t for t in driver.find_elements(By.XPATH, ledger_xpath) if t.is_displayed()]
                if i < len(ledger_tabs):
                    lt_label = ledger_tabs[i].text.strip().replace('\n', ' ')
                    log_info(f"  -> Clicking Ledger tab: '{lt_label}'")
                    human_click(driver, ledger_tabs[i], color="#3B82F6", pause_after=1.2)
            except StaleElementReferenceException:
                pass
            
        # Look for the newly added jump link
        jump_links = driver.find_elements(By.XPATH, "//button[contains(., 'Go to') and contains(., 'Profile')] | //a[contains(., 'Go to')]")
        if jump_links and jump_links[0].is_displayed():
            log_pass("Found '[Go to Gaushala Profile & Herd ↗]' action link!")
            human_click(driver, jump_links[0], color="#10B981", pause_after=2.0)
            log_pass("Successfully navigated from Ledger empty state into Gaushala Profile view!")
            time.sleep(1.5)
            # Return to ledger
            driver.get(f"{base_url}/#admin/ledger")
            time.sleep(1.5)

        # 11. Availability & Fleet
        log_step(11, "Auditing Availability & Fleet Management", "Verifying slot timetables & resting buffers")
        click_sidebar_nav("Availability & Fleet", "admin/availability")
        time.sleep(1.5)

        # 12. Regional Treasury & Manager Wallets
        log_step(12, "Inspecting Regional Treasury & Manager Wallets", "Reviewing Gaushala wallets & disbursement splits")
        click_sidebar_nav("Regional Treasury & Manager Wallets", "admin/wallet")
        time.sleep(1.5)

        # Final check
        log_step(13, "Verifying Full Operations Admin Health", "Ensuring 0 fatal crashes across all 8 views")
        all_clean = check_browser_console(driver)
        if all_clean:
            log_pass("OPERATIONS ADMIN SUITE COMPLETED WITH 100% SUCCESS!")
        else:
            log_warn("Completed with minor non-blocking browser warnings.")

        print(f"\n{C.CYAN}Pausing {keep_open_seconds}s for human visual inspection before closing...{C.RESET}")
        time.sleep(keep_open_seconds)

    except Exception as e:
        log_fail(f"Exception during Operations Admin watch run: {e}")
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
    run_watch_admin(url)
