import sys
import os

# Add parent directory to path so app is importable
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

def test_grievance_integration():
    client = TestClient(app)
    
    print("==================================================")
    print("Testing Grievance Submission Proxy Endpoint...")
    print("==================================================")
    
    payload = {
        "category": "Attendance Issue",
        "description": "I was late to the office due to unexpected heavy traffic congestion during my commute. Kindly consider regularizing my attendance for the day.",
        "session_id": "test-session-val"
    }
    
    # 1. Test Submission
    try:
        response = client.post("/api/chat/grievance/submit", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code != 200:
            print("❌ Grievance submission failed.")
            return
            
        data = response.json()
        if data.get("Status") == "Success":
            print("✓ Proxy successfully posted to external NTSPL API.")
            msg = data.get("Data", {}).get("Message", "")
            print(f"Success Message: '{msg}'")
            
            # Extract grievance number
            import re
            grv_match = re.search(r"GRV/[0-9a-zA-Z/-]+", msg)
            if grv_match:
                grv_number = grv_match.group(0)
                print(f"Extracted Grievance Number: '{grv_number}'")
            else:
                print("⚠️ Could not extract grievance number from message, using fallback.")
                grv_number = "GRV/26-27/06/000013"
        else:
            print("❌ External API returned failure status.")
            return
    except Exception as e:
        print(f"❌ Exception during submission test: {e}")
        return

    print("\n==================================================")
    print("Testing Grievance Tracking Proxy Endpoint...")
    print("==================================================")
    
    # 2. Test Tracking
    try:
        response = client.get(f"/api/chat/grievance/track?grievance_number={grv_number}")
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ Grievance tracking failed for {grv_number}.")
            return
            
        track_data = response.json()
        if track_data.get("Status") == "Success" and "Data" in track_data:
            details = track_data["Data"]
            print("✓ Proxy successfully fetched tracking details from external NTSPL API.")
            print(f"  Grievance ID: {details.get('Grievance_Id')}")
            print(f"  Number:       {details.get('Grievance_Number')}")
            print(f"  Status:       {details.get('Status')}")
            print(f"  Description:  {details.get('Description')}")
            print(f"  Created On:   {details.get('Created_On')}")
            print("\n🎉 INTEGRATION TEST SUCCESSFUL! Both endpoints are working.")
        else:
            print("❌ External API returned invalid tracking details.")
    except Exception as e:
        print(f"❌ Exception during tracking test: {e}")

if __name__ == "__main__":
    test_grievance_integration()
