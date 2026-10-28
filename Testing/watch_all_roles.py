"""
GOMAA Master Watch-Mode Automation Suite
========================================
Interactive & Automated Headed Chrome Test Runner across ALL 5 User Roles:
1. Operations Admin (Admin_1)
2. Super Admin (The Captain)
3. Gosala Manager (Manager 1)
4. Devotee Customer (Devotee)
5. Transit Pilot Driver (Driver)

Usage:
    python Testing/watch_all_roles.py --all
    python Testing/watch_all_roles.py --role admin
    python Testing/watch_all_roles.py --role super_admin
    python Testing/watch_all_roles.py --role manager
    python Testing/watch_all_roles.py --role customer
    python Testing/watch_all_roles.py --role driver
    python Testing/watch_all_roles.py --target https://gowma.vercel.app
"""

import sys
import os
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
import argparse
import time
from watch_framework import C
from watch_admin import run_watch_admin
from watch_super_admin import run_watch_super_admin
from watch_manager import run_watch_manager
from watch_customer import run_watch_customer
from watch_driver import run_watch_driver

def print_banner():
    print(f"\n{C.BOLD}{C.SAFFRON}======================================================================{C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}   GOMAA LIVE BROWSER AUTOMATION SUITE — HUMAN WATCH MODE            {C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}======================================================================{C.RESET}")
    print(f"{C.CYAN}Every test runs in a REAL, VISIBLE Chrome window directly on your screen.{C.RESET}")
    print(f"{C.CYAN}You can sit back and visually watch Chrome type, click, and inspect.{C.RESET}\n")

def main():
    parser = argparse.ArgumentParser(description="GOMAA Human Watch Mode Runner")
    parser.add_argument("--role", choices=["admin", "super_admin", "manager", "customer", "driver", "all"], default="admin",
                        help="Specific role to test (default: admin)")
    parser.add_argument("--all", action="store_true", help="Run all 5 roles sequentially")
    parser.add_argument("--target", default="http://localhost:8443", help="Target URL (default: http://localhost:8443)")
    parser.add_argument("--pause", type=int, default=3, help="Seconds to pause before closing browser")

    args = parser.parse_args()
    target_url = args.target.rstrip('/')

    print_banner()

    roles_to_run = []
    if args.all or args.role == "all":
        roles_to_run = ["admin", "super_admin", "manager", "customer", "driver"]
    else:
        roles_to_run = [args.role]

    print(f"{C.BOLD}Selected Roles to Test:{C.RESET} {', '.join([r.upper() for r in roles_to_run])}")
    print(f"{C.BOLD}Target App URL:{C.RESET}         {target_url}\n")

    results = {}
    for r in roles_to_run:
        print(f"\n{C.BOLD}{C.BLUE}{'#'*70}{C.RESET}")
        print(f"{C.BOLD}{C.BLUE}>>> LAUNCHING VISIBLE CHROME WATCH SUITE FOR ROLE: {r.upper()}{C.RESET}")
        print(f"{C.BOLD}{C.BLUE}{'#'*70}{C.RESET}\n")
        
        start_time = time.time()
        try:
            if r == "admin":
                run_watch_admin(target_url, keep_open_seconds=args.pause)
            elif r == "super_admin":
                run_watch_super_admin(target_url, keep_open_seconds=args.pause)
            elif r == "manager":
                run_watch_manager(target_url, keep_open_seconds=args.pause)
            elif r == "customer":
                run_watch_customer(target_url, keep_open_seconds=args.pause)
            elif r == "driver":
                run_watch_driver(target_url, keep_open_seconds=args.pause)
            
            elapsed = time.time() - start_time
            results[r] = {"status": "PASS", "time": f"{elapsed:.1f}s"}
        except Exception as e:
            elapsed = time.time() - start_time
            results[r] = {"status": "FAIL", "time": f"{elapsed:.1f}s", "error": str(e)}

    # Executive Summary Card
    print(f"\n\n{C.BOLD}{C.SAFFRON}======================================================================{C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}   EXECUTIVE WATCH TEST SCORECARD SUMMARY                            {C.RESET}")
    print(f"{C.BOLD}{C.SAFFRON}======================================================================{C.RESET}")
    for role, res in results.items():
        status_color = C.GREEN if res["status"] == "PASS" else C.RED
        print(f" {role.upper():<16} : {status_color}{res['status']:<6}{C.RESET} (Duration: {res['time']})")
        if "error" in res:
            print(f"   ↳ Error: {res['error']}")
    print(f"{C.BOLD}{C.SAFFRON}======================================================================{C.RESET}\n")

if __name__ == "__main__":
    main()
