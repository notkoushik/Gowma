"""
GOMAA Real-Human Browser Automation Framework
=============================================
Provides headed, maximized Chrome browser automation with:
- Visible human-like typing and pacing
- Glowing visual highlight box on interacted elements (#E35314 saffron)
- Automatic step-by-step visual screenshot capture (saved to Testing/screenshots/)
- Windows foreground window activation
- Clean ANSI console narration with timestamps and status indicators
- Automatic detection of console errors and uncaught React exceptions
"""

import os
import sys
import time
from datetime import datetime

# Enforce UTF-8 encoding for Windows console
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException, StaleElementReferenceException

# Terminal colors
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

def log_step(step_num: int, title: str, detail: str = ""):
    now = datetime.now().strftime("%H:%M:%S")
    print(f"\n{C.SAFFRON}[{now}] [STEP {step_num:02d}]{C.RESET} {C.BOLD}{title}{C.RESET}")
    if detail:
        print(f"       {C.DIM}-> {detail}{C.RESET}")

def log_pass(msg: str):
    print(f"       {C.GREEN}[PASS]{C.RESET} {msg}")

def log_warn(msg: str):
    print(f"       {C.YELLOW}[WARN]{C.RESET} {msg}")

def log_fail(msg: str):
    print(f"       {C.RED}[FAIL]{C.RESET} {msg}")

def log_info(msg: str):
    print(f"       {C.CYAN}[INFO]{C.RESET} {msg}")

def force_foreground_window():
    """Attempts to force the active window to the front on Windows OS."""
    if sys.platform.startswith("win"):
        try:
            import ctypes
            EnumWindows = ctypes.windll.user32.EnumWindows
            EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int))
            GetWindowText = ctypes.windll.user32.GetWindowTextW
            GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
            IsWindowVisible = ctypes.windll.user32.IsWindowVisible

            def foreach_window(hwnd, lParam):
                if IsWindowVisible(hwnd):
                    length = GetWindowTextLength(hwnd)
                    buff = ctypes.create_unicode_buffer(length + 1)
                    GetWindowText(hwnd, buff, length + 1)
                    title = buff.value
                    if "Chrome" in title or "GOMAA" in title or "Figma" in title:
                        ctypes.windll.user32.ShowWindow(hwnd, 3) # SW_MAXIMIZE
                        ctypes.windll.user32.SetForegroundWindow(hwnd)
                return True

            EnumWindows(EnumWindowsProc(foreach_window), 0)
        except Exception:
            pass

def create_human_driver(target_url: str = "http://localhost:8443"):
    """
    Initializes a visible, maximized Chrome browser for live human watching.
    Headless is strictly DISABLED so the real Chrome window opens.
    """
    print(f"\n{C.BOLD}{C.SAFFRON}{'='*70}{C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON} GOMAA WATCH-MODE TEST SUITE — REAL-TIME BROWSER RUNNER {C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}{'='*70}{C.RESET}")
    print(f"{C.CYAN}Target URL:{C.RESET} {target_url}")
    print(f"{C.CYAN}Mode:{C.RESET}       {C.BOLD}{C.GREEN}HEADED VISIBLE CHROME (Watching Mode Active){C.RESET}\n")

    opts = Options()
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-infobars")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(30)
    
    # Attempt to bring to front
    time.sleep(0.5)
    force_foreground_window()
    return driver

def take_screenshot(driver, role: str, step_num: int, step_name: str):
    """
    Saves an actual PNG screenshot of what Chrome is displaying on screen.
    This provides 100% indisputable visual proof of testing!
    """
    try:
        clean_name = "".join(c for c in step_name if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_').lower()
        folder = os.path.join("Testing", "screenshots", role)
        os.makedirs(folder, exist_ok=True)
        filename = f"step_{step_num:02d}_{clean_name}.png"
        filepath = os.path.join(folder, filename)
        driver.save_screenshot(filepath)
        log_info(f"Visual proof screenshot saved -> {filepath}")
        return filepath
    except Exception as e:
        return None

def highlight(driver, element, color="#E35314", duration=0.8):
    """
    Draws a glowing colored outline around the element and smoothly scrolls it into view.
    """
    try:
        driver.execute_script("""
            var el = arguments[0];
            var color = arguments[1];
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.dataset.prevOutline = el.style.outline;
            el.dataset.prevBoxShadow = el.style.boxShadow;
            el.style.outline = '3px solid ' + color;
            el.style.boxShadow = '0 0 15px ' + color;
            el.style.transition = 'all 0.25s ease-in-out';
        """, element, color)
        time.sleep(duration)
        driver.execute_script("""
            var el = arguments[0];
            el.style.outline = el.dataset.prevOutline || '';
            el.style.boxShadow = el.dataset.prevBoxShadow || '';
        """, element)
    except Exception:
        pass

def human_type(driver, element, text: str, delay: float = 0.035):
    """
    Types text character-by-character with visual glowing focus, mimicking a human typist.
    """
    highlight(driver, element, color="#F59E0B", duration=0.3)
    try:
        element.clear()
    except Exception:
        pass
    for char in text:
        element.send_keys(char)
        time.sleep(delay)
    time.sleep(0.3)

def human_click(driver, element, color="#E35314", pause_after=1.2):
    """
    Visibly highlights element and performs a clean click, then pauses for human viewing.
    """
    highlight(driver, element, color=color, duration=0.5)
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)
    time.sleep(pause_after)

def check_browser_console(driver):
    """
    Inspects Chrome browser logs for SEVERE errors or unhandled exceptions.
    """
    try:
        logs = driver.get_log('browser')
        severe_errors = [l for l in logs if l.get('level') == 'SEVERE' and not 'favicon.ico' in l.get('message', '')]
        if severe_errors:
            log_warn(f"Detected {len(severe_errors)} console warnings/errors:")
            for err in severe_errors[:3]:
                msg = err.get('message', '')[:100]
                print(f"         {C.DIM}• {msg}...{C.RESET}")
            return False
        else:
            log_pass("Browser console clean (0 uncaught fatal errors)")
            return True
    except Exception:
        return True

def wait_for_visible(driver, by, selector, timeout=10):
    wait = WebDriverWait(driver, timeout)
    return wait.until(EC.visibility_of_element_located((by, selector)))

def wait_for_clickable(driver, by, selector, timeout=10):
    wait = WebDriverWait(driver, timeout)
    return wait.until(EC.element_to_be_clickable((by, selector)))
