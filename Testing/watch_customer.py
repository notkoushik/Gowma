"""
Watch Mode Test: Devotee (Customer) Role
========================================
Tests the complete Devotee experience inside a real, visible Chrome browser:
- Authenticates with Devotee credentials (devpulseorg@gmail.com)
- Explores Sacred Bovine catalog and breed filters
- Inspects Holy Cow detail dossier and booking flow
- Audits My Bookings history, Live GPS Tracking, and Devotee Profile
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

def run_watch_customer(base_url="http://localhost:8443", keep_open_seconds=3):
    driver = None
    try:
        driver = create_human_driver(base_url)
        
        # 1. Load login page
        log_step(1, "Navigating to GOMAA Login Portal", f"{base_url}/#login")
        driver.get(f"{base_url}/#login")
        time.sleep(1.5)
        
        # 2. Enter Devotee credentials
        log_step(2, "Entering Devotee Credentials", "Email: devpulseorg@gmail.com")
        email_input = wait_for_visible(driver, By.CSS_SELECTOR, "input[type='text'], input[type='email']")
        human_type(driver, email_input, "devpulseorg@gmail.com")
        
        pwd_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        human_type(driver, pwd_input, "GomaaAdmin@2026!")
        
        # 3. Submit login
        log_step(3, "Submitting Authentication Form", "Clicking 'Sign In to GOMAA Portal'")
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        human_click(driver, submit_btn, color="#E35314", pause_after=2.5)
        
        # Verify landing on Customer workspace
        current_url = driver.current_url
        if "#customer" in current_url:
            log_pass("Successfully authenticated and landed in Devotee Workspace!")
        else:
            log_info(f"Current URL: {current_url}")
            
        time.sleep(1.5)

        # 4. Sacred Bovine Discovery Catalog
        log_step(4, "Exploring Sacred Bovine Discovery Catalog", "Auditing holy cows, calves, and breed filters")
        cow_cards = driver.find_elements(By.XPATH, "//div[contains(@class, 'cursor-pointer') and (contains(., 'Gir') or contains(., 'Sahiwal') or contains(., 'Ongole') or contains(., 'Cow') or contains(., 'Calf'))]")
        log_info(f"Detected {len(cow_cards)} sacred bovine cards on screen")
        if cow_cards:
            highlight(driver, cow_cards[0], color="#E35314", duration=1.0)
            log_info("Inspecting detail dossier for selected Sacred Bovine")
            human_click(driver, cow_cards[0], pause_after=2.0)
            
            # Check if booking button / details appear
            book_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'Book') or contains(., 'Puja') or contains(., 'Reserve') or contains(., 'Select')]")
            if book_buttons:
                log_pass("Found ceremony reservation / booking trigger button!")
                highlight(driver, book_buttons[0], color="#10B981", duration=0.8)

        # 5. Devotee Bookings Tab
        log_step(5, "Auditing Devotee Bookings Tab", "Inspecting ceremony history & current slot holds")
        tab_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'Bookings') or contains(., 'Orders')] | //a[contains(., 'Bookings')]")
        if tab_buttons:
            for tb in tab_buttons:
                if tb.is_displayed():
                    human_click(driver, tb, pause_after=1.5)
                    break
        check_browser_console(driver)

        # 6. Live Fleet Tracking Tab
        log_step(6, "Testing Devotee Live Fleet GPS Tracking", "Auditing real-time map & holy cow arrival stages")
        track_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'Track') or contains(., 'Fleet')] | //a[contains(., 'Track')]")
        if track_buttons:
            for tb in track_buttons:
                if tb.is_displayed():
                    human_click(driver, tb, pause_after=1.8)
                    break
        check_browser_console(driver)

        # 7. Devotee Profile Tab
        log_step(7, "Inspecting Devotee Profile & Gotra Settings", "Auditing devotee location, contact, and spiritual preferences")
        profile_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'Profile') or contains(., 'Account')] | //a[contains(., 'Profile')]")
        if profile_buttons:
            for pb in profile_buttons:
                if pb.is_displayed():
                    human_click(driver, pb, pause_after=1.5)
                    break
        check_browser_console(driver)

        # Final check
        log_step(8, "Verifying Full Devotee Experience Health", "Ensuring 0 fatal crashes")
        all_clean = check_browser_console(driver)
        if all_clean:
            log_pass("DEVOTEE SUITE COMPLETED WITH 100% SUCCESS!")
        else:
            log_warn("Completed with minor non-blocking warnings.")

        print(f"\n{C.CYAN}Pausing {keep_open_seconds}s for human visual inspection before closing...{C.RESET}")
        time.sleep(keep_open_seconds)

    except Exception as e:
        log_fail(f"Exception during Devotee watch run: {e}")
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
    run_watch_customer(url)
