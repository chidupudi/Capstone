"""
TrainForge Colab Connection Diagnostic
Run this in Google Colab to test your ngrok connection
"""

import requests
import time

def run_diagnostics():
    API_URL = input("Enter your TrainForge API URL (from ngrok): ").strip()

    if not API_URL:
        print("❌ Please enter a valid API URL")
        return

    print(f"🔍 Running connectivity diagnostics for: {API_URL}")
    print("=" * 60)

    # Test 1: Basic ping to ngrok
    print("\n1. Testing basic ngrok response...")
    try:
        response = requests.get(API_URL, timeout=10)
        print(f"   Status: {response.status_code}")
        print(f"   Headers: {dict(response.headers)}")
        if response.status_code == 200:
            print("   ✅ ngrok tunnel is working")
        else:
            print(f"   ⚠️ Got response but status is {response.status_code}")
            print(f"   Response: {response.text[:200]}")
    except requests.exceptions.Timeout:
        print("   ❌ Timeout - ngrok tunnel might be slow or down")
    except requests.exceptions.ConnectionError:
        print("   ❌ Connection error - ngrok tunnel might be down")
    except Exception as e:
        print(f"   ❌ Failed: {e}")

    # Test 2: Test with ngrok headers
    print("\n2. Testing with ngrok bypass headers...")
    headers = {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'TrainForge-Worker/1.0'
    }

    try:
        response = requests.get(f"{API_URL}/health", headers=headers, timeout=15)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ API health endpoint working")
            data = response.json()
            print(f"   Response: {data}")
            print(f"   API Status: {data.get('status', 'unknown')}")
            print(f"   Database: {data.get('database', 'unknown')}")
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
    except requests.exceptions.Timeout:
        print("   ❌ Timeout on health endpoint")
    except requests.exceptions.ConnectionError:
        print("   ❌ Connection error on health endpoint")
    except Exception as e:
        print(f"   ❌ Failed: {e}")

    # Test 3: Test API endpoints
    print("\n3. Testing other API endpoints...")
    endpoints = ['/api/jobs/pending', '/api/workers']

    for endpoint in endpoints:
        try:
            response = requests.get(f"{API_URL}{endpoint}", headers=headers, timeout=10)
            print(f"   {endpoint}: Status {response.status_code}")
            if response.status_code == 200:
                print(f"   ✅ {endpoint} is working")
            elif response.status_code == 404:
                print(f"   ⚠️ {endpoint} not found (might be normal)")
            else:
                print(f"   ❌ {endpoint} failed")
        except Exception as e:
            print(f"   ❌ {endpoint} error: {e}")

    # Test 4: Check from browser
    print(f"\n4. Manual browser test:")
    print(f"   🌐 Visit this URL in your browser: {API_URL}/health")
    print("   📋 If you see an ngrok warning, click 'Visit Site'")
    print("   ✅ You should see: {'status': 'healthy', ...}")

    # Test 5: Connection retry test
    print(f"\n5. Testing connection stability...")
    success_count = 0
    total_tests = 5

    for i in range(total_tests):
        try:
            response = requests.get(f"{API_URL}/health", headers=headers, timeout=5)
            if response.status_code == 200:
                success_count += 1
                print(f"   Test {i+1}/5: ✅")
            else:
                print(f"   Test {i+1}/5: ❌ (Status {response.status_code})")
        except:
            print(f"   Test {i+1}/5: ❌ (Connection failed)")

        time.sleep(1)

    print(f"\n📊 Connection stability: {success_count}/{total_tests} successful")

    if success_count == total_tests:
        print("🎉 Connection is stable! You can proceed with the worker.")
    elif success_count > 0:
        print("⚠️ Connection is unstable. Try restarting ngrok or use authtoken.")
    else:
        print("❌ Connection completely failed. Check ngrok status.")

    print("\n" + "=" * 60)
    print("📋 Troubleshooting steps:")
    print("1. Check if ngrok is still running on your local machine")
    print("2. Visit http://127.0.0.1:4040 to see ngrok dashboard")
    print("3. Test locally: curl http://localhost:3000/health")
    print("4. If issues persist, restart ngrok or try localtunnel")
    print("5. Get ngrok authtoken from ngrok.com to avoid rate limits")

if __name__ == "__main__":
    run_diagnostics()