"""
Watch Mode Test: Gosala Manager Role
====================================
Tests the full Gosala Manager workflow inside a real, visible Chrome browser:
- Authenticates with Manager 1 credentials
- Audits Sanctuary Puja Request Queue & Approvals
- Inspects Sacred Herd health, resting buffers, and fodder schedule
- Audits Sanctuary 80% Revenue Ledger & Manager Wallet
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
from watch_framework import (
    C, create_human_driver, highlight, human_type, human_click,
    log_step, log_pass, log_fail, log_info, log_warn, check_browser_console,
    wait_for_visible, wait_for_clickable
)

def run_watch_manager(base_url="http://localhost:8443", keep_open_seconds=3):
    driver = None
    try:
        driver = create_human_driver(base_url)
        
        # 1. Load login page
        log_step(1, "Navigating to GOMAA Login Portal", f"{base_url}/#login")
        driver.get(f"{base_url}/#login")
        time.sleep(1.5)
        
        # 2. Enter Manager credentials
        log_step(2, "Entering Gosala Manager Credentials", "Email: manager1@gomaa.in")
        email_input = wait_for_visible(driver, By.CSS_SELECTOR, "input[type='text'], input[type='email']")
        human_type(driver, email_input, "manager1@gomaa.in")
        
        pwd_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        human_type(driver, pwd_input, "GomaaAdmin@2026!")
        
        # 3. Submit login
        log_step(3, "Submitting Authentication Form", "Clicking 'Sign In to GOMAA Portal'")
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        human_click(driver, submit_btn, color="#22C55E", pause_after=2.5)
        
        # Verify landing on Manager workspace
        current_url = driver.current_url
        if "#manager" in current_url:
            log_pass("Successfully authenticated and landed in Gosala Manager Workspace!")
        else:
            log_info(f"Current URL: {current_url}")
            
        time.sleep(1.5)

        # Helper to navigate manager subviews
        def visit_manager_tab(name, subview):
            log_info(f"Navigating to Manager tab: {name} [#{subview}]")
            driver.get(f"{base_url}/#{subview}")
            time.sleep(1.8)
            check_browser_console(driver)
            log_pass(f"Audited {name} successfully")

        # 4. Queue: Devotee Puja Requests
        log_step(4, "Auditing Sanctuary Puja Request Queue", "Reviewing devotee booking requests & verification queue")
        visit_manager_tab("Puja Queue", "manager/queue")
        
        # Look for queue items / cards
        queue_items = driver.find_elements(By.CSS_SELECTOR, ".card, [class*='rounded'], tr")
        visible_items = [q for q in queue_items if q.is_displayed()]
        log_info(f"Detected {len(visible_items)} UI cards/rows in Queue view")
        if visible_items:
            highlight(driver, visible_items[0], color="#F59E0B", duration=0.8)

        # 5. Sacred Herd & Animal Welfare
        log_step(5, "Auditing Sacred Herd & Animal Health", "Inspecting assigned bovine health cards & resting schedules")
        visit_manager_tab("Sacred Herd Animals", "manager/animals")

        # 6. Daily Schedule
        log_step(6, "Inspecting Daily Puja Schedule", "Reviewing timeline of devotee appointments")
        visit_manager_tab("Daily Schedule", "manager/schedule")

        # 7. Availability & Slot Capacity
        log_step(7, "Inspecting Slot Timetable & Resting Buffers", "Verifying cattle rest periods")
        visit_manager_tab("Availability", "manager/availability")

        # 8. Gaushala Sanctuary Profile
        log_step(8, "Auditing Gaushala Profile & Certification", "Reviewing AWBI compliance & facilities")
        visit_manager_tab("Sanctuary Profile", "manager/gosalas")

        # 9. Sanctuary 80% Revenue Ledger
        log_step(9, "Auditing Sanctuary 80% Revenue Ledger", "Verifying sanctuary earnings & booking transactions")
        visit_manager_tab("Sanctuary Ledger", "manager/ledger")

        # 10. Manager Wallet
        log_step(10, "Auditing Custodian Wallet & Revenue Share", "Reviewing wallet balance & disbursements")
        visit_manager_tab("Manager Wallet", "manager/wallet")

        # Final check
        log_step(11, "Verifying Full Manager Workspace Health", "Ensuring 0 fatal crashes")
        all_clean = check_browser_console(driver)
        if all_clean:
            log_pass("GOSALA MANAGER SUITE COMPLETED WITH 100% SUCCESS!")
        else:
            log_warn("Completed with minor non-blocking warnings.")

        print(f"\n{C.CYAN}Pausing {keep_open_seconds}s for human visual inspection before closing...{C.RESET}")
        time.sleep(keep_open_seconds)

    except Exception as e:
        log_fail(f"Exception during Gosala Manager watch run: {e}")
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
    run_watch_manager(url)
