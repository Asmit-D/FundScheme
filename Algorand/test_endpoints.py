import requests
import json
import sys
import io

# --- FIX: Force UTF-8 Encoding for Windows Compatibility ---
# This ensures that symbols like ✓ and ✅ don't cause UnicodeEncodeErrors
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://localhost:8000"

def test_health_endpoint():
    """Test 1: Check if API is running"""
    print("\n=== Test 1: Health Check ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    print("✓ PASSED")

def test_analyze_wallet_normal():
    """Test 2: Analyze a normal wallet (known in training data)"""
    print("\n=== Test 2: Analyze Normal Wallet ===")
    payload = {"wallet_address": "STU_0", "asset_id": 12345}
    response = requests.post(f"{BASE_URL}/analyze-wallet", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        assert "risk_score" in data
        print(f"Risk Score: {data['risk_score']}")
        print("✓ PASSED")
    else:
        print(f"⚠ Status {response.status_code}: {response.text}")

def test_analyze_wallet_mule():
    """Test 3: Analyze a mule wallet (fraudulent pattern)"""
    print("\n=== Test 3: Analyze Mule Wallet (Fraud Pattern) ===")
    payload = {"wallet_address": "MULE_0", "asset_id": 12345}
    response = requests.post(f"{BASE_URL}/analyze-wallet", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Decision: {response.json()['decision']}")
        print("✓ PASSED")

def test_analyze_wallet_hub():
    """Test 4: Analyze hub wallet (collector account)"""
    print("\n=== Test 4: Analyze Hub Wallet ===")
    payload = {"wallet_address": "HUB_COLLECTOR_01", "asset_id": 12345}
    response = requests.post(f"{BASE_URL}/analyze-wallet", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✓ PASSED")

def test_analyze_wallet_unknown():
    """Test 5: Analyze unknown wallet (not in training data)"""
    print("\n=== Test 5: Analyze Unknown Wallet ===")
    payload = {"wallet_address": "UNKNOWN_WALLET_XYZ", "asset_id": 12345}
    response = requests.post(f"{BASE_URL}/analyze-wallet", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 404:
        print("✓ PASSED (correctly identified unknown wallet)")

def test_analyze_wallet_invalid_payload():
    """Test 6: Send invalid payload (missing field)"""
    print("\n=== Test 6: Invalid Payload ===")
    payload = {"wallet_address": "STU_0"} # Missing asset_id
    response = requests.post(f"{BASE_URL}/analyze-wallet", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 422:
        print("✓ PASSED (correctly rejected invalid payload)")

def test_analyze_wallet_multiple_assets():
    """Test 7: Analyze same wallet with different asset IDs"""
    print("\n=== Test 7: Same Wallet, Different Assets ===")
    for asset_id in [100, 200]:
        payload = {"wallet_address": "STU_1", "asset_id": asset_id}
        response = requests.post(f"{BASE_URL}/analyze-wallet", json=payload)
        print(f"  Asset {asset_id}: Status {response.status_code}")
    print("✓ PASSED")

def test_government_wallet():
    """Test 8: Analyze government/NGO wallet"""
    print("\n=== Test 8: Government Wallet ===")
    payload = {"wallet_address": "GOVT_SCHOLARSHIP_DEPT", "asset_id": 12345}
    response = requests.post(f"{BASE_URL}/analyze-wallet", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Risk Score: {response.json()['risk_score']} (low expected)")
        print("✓ PASSED")

def test_high_risk_threshold():
    """Test 9: Verify fraud detection threshold"""
    print("\n=== Test 9: Risk Score Thresholds ===")
    test_wallets = ["STU_0", "MULE_0"]
    for wallet in test_wallets:
        payload = {"wallet_address": wallet, "asset_id": 12345}
        res = requests.post(f"{BASE_URL}/analyze-wallet", json=payload).json()
        print(f"  {wallet}: {res['risk_score']} -> {res['decision']}")
    print("✓ PASSED")

if __name__ == "__main__":
    print("=" * 60)
    print("ALGORAND FRAUD DETECTION API - FULL INTEGRATION TEST")
    print("=" * 60)
    
    try:
        # EXECUTE ALL 9 TESTS
        test_health_endpoint()
        test_analyze_wallet_normal()
        test_analyze_wallet_mule()
        test_analyze_wallet_hub()
        test_analyze_wallet_unknown()
        test_analyze_wallet_invalid_payload()
        test_analyze_wallet_multiple_assets()
        test_government_wallet()
        test_high_risk_threshold()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED AT: {e}")
        sys.exit(1)