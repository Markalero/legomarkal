import subprocess
import sys
import os

def print_header(title):
    print(f"\n{'='*50}")
    print(f"RUNNING: {title}")
    print(f"{'='*50}\n")

def run_command(cmd, cwd=None):
    try:
        result = subprocess.run(cmd, cwd=cwd, shell=True, text=True)
        return result.returncode == 0
    except Exception as e:
        print(f"Error running {cmd}: {e}")
        return False

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    success = True

    # 1. Backend Tests
    print_header("Backend Unit Tests (pytest)")
    if not run_command("pytest", cwd=backend_dir):
        print("[FAIL] Backend tests failed!")
        success = False
    else:
        print("[OK] Backend tests passed!")

    # 2. Frontend Tests
    print_header("Frontend Unit Tests (vitest)")
    if not run_command("npm run test", cwd=frontend_dir):
        print("[FAIL] Frontend tests failed!")
        success = False
    else:
        print("[OK] Frontend tests passed!")

    # 3. Scraper Tests (Battery)
    print_header("Scraper Battery Tests")
    if not run_command("python test_battery.py", cwd=root_dir):
        print("[FAIL] Scraper tests failed!")
        success = False
    else:
        print("[OK] Scraper tests passed!")

    print_header("TEST SUMMARY")
    if success:
        print("[SUCCESS] ALL TESTS PASSED SUCCESSFULLY! You are clear to merge/commit.")
        sys.exit(0)
    else:
        print("[FAIL] SOME TESTS FAILED. Please review the logs above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
