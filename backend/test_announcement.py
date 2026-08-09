# backend/test_announcement.py
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

# ============================================
# CONFIGURATION - USE YOUR EXISTING ACCOUNTS
# ============================================

PROFESSOR_EMAIL = "kingprof@gmail.com"
PROFESSOR_PASSWORD = "Nopass@21"

STUDENT_EMAIL = "meegan21@gmail.com"
STUDENT_PASSWORD = "Nopass@21"

# ============================================
# HELPER FUNCTIONS
# ============================================

def login(email, password):
    url = f"{BASE_URL}/auth/login"
    response = requests.post(url, json={"email": email, "password": password})
    if response.status_code == 200:
        return response.json()["access_token"]
    print(f"❌ Login failed: {response.text}")
    return None

def create_section(token, name, course, year_level):
    url = f"{BASE_URL}/sections/"
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "name": name,
        "course": course,
        "year_level": year_level,
        "academic_year": "2024-2025"
    }
    response = requests.post(url, json=data, headers=headers)
    return response

def add_member_to_section(token, section_id, user_id):
    url = f"{BASE_URL}/sections/{section_id}/members"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"user_id": user_id}
    response = requests.post(url, params=params, headers=headers)
    return response

def create_announcement(token, title, content, type="academic", priority="normal"):
    url = f"{BASE_URL}/announcements/"
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "title": title,
        "content": content,
        "type": type,
        "priority": priority
    }
    response = requests.post(url, json=data, headers=headers)
    return response

def get_announcements(token):
    url = f"{BASE_URL}/announcements/"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    return response

def get_user_id(token):
    url = f"{BASE_URL}/auth/me"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()["id"]
    return None

def print_response(title, response):
    """Helper to print response nicely"""
    print(f"\n{title}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200 or response.status_code == 201:
        try:
            data = response.json()
            if isinstance(data, list):
                print(f"✅ Found {len(data)} item(s)")
                for i, item in enumerate(data):
                    if isinstance(item, dict):
                        print(f"  [{i+1}] {item.get('title', 'No title')} (by: {item.get('created_by_role', 'unknown')})")
                    else:
                        print(f"  [{i+1}] {item}")
            else:
                print(f"✅ Response: {json.dumps(data, indent=2)[:500]}...")
        except:
            print(f"Response: {response.text[:500]}")
    else:
        print(f"❌ Error: {response.text}")

# ============================================
# MAIN TEST
# ============================================

def main():
    print("=" * 60)
    print("  🧪 PROFESSOR ANNOUNCEMENT TEST")
    print("=" * 60)

    # Login
    print("\n🔐 Logging in as Professor...")
    professor_token = login(PROFESSOR_EMAIL, PROFESSOR_PASSWORD)
    if not professor_token:
        return
    print(f"✅ Professor logged in")
    
    print("\n🔐 Logging in as Student...")
    student_token = login(STUDENT_EMAIL, STUDENT_PASSWORD)
    if not student_token:
        return
    print(f"✅ Student logged in")

    # Get IDs
    professor_id = get_user_id(professor_token)
    student_id = get_user_id(student_token)
    print(f"\n👤 Professor ID: {professor_id}")
    print(f"👤 Student ID: {student_id}")

    # Create section
    print("\n📚 Creating section for professor...")
    response = create_section(
        professor_token,
        "BSIT-1A",
        "BSIT",
        1
    )
    
    if response.status_code == 201:
        section = response.json()
        section_id = section["id"]
        print(f"✅ Section created: {section['name']} (ID: {section_id})")
    else:
        print(f"❌ Section creation failed: {response.text}")
        return

    # Add student to section
    print(f"\n➕ Adding student to section...")
    response = add_member_to_section(professor_token, section_id, student_id)
    
    if response.status_code == 200:
        print(f"✅ Student added to section")
    else:
        print(f"⚠️ Could not add student: {response.text}")

    # Create announcement
    print("\n📢 Creating announcement...")
    response = create_announcement(
        professor_token,
        "📝 Quiz Announcement",
        "There will be a quiz next week on Chapters 1-5. Please prepare.",
        "academic",
        "high"
    )
    
    if response.status_code == 201:
        announcement = response.json()
        print(f"✅ Announcement created: {announcement['title']}")
        print(f"   ID: {announcement['id']}")
    else:
        print(f"❌ Announcement creation failed: {response.text}")

    # View announcements
    print("\n👀 Professor viewing announcements...")
    response = get_announcements(professor_token)
    if response.status_code == 200:
        announcements = response.json()
        print(f"✅ Professor sees {len(announcements)} announcement(s)")
        if announcements:
            # Check if announcements is a list
            if isinstance(announcements, list):
                for ann in announcements:
                    if isinstance(ann, dict):
                        print(f"   - {ann.get('title', 'No title')} (by: {ann.get('created_by_role', 'unknown')})")
                    else:
                        print(f"   - {ann}")
            else:
                print(f"   Data type: {type(announcements)}")
                print(f"   Content: {announcements}")
        else:
            print("   No announcements found")
    
    print("\n👀 Student viewing announcements...")
    response = get_announcements(student_token)
    if response.status_code == 200:
        announcements = response.json()
        print(f"✅ Student sees {len(announcements)} announcement(s)")
        if announcements:
            if isinstance(announcements, list):
                for ann in announcements:
                    if isinstance(ann, dict):
                        print(f"   - {ann.get('title', 'No title')} (by: {ann.get('created_by_role', 'unknown')})")
                    else:
                        print(f"   - {ann}")
            else:
                print(f"   Data type: {type(announcements)}")
                print(f"   Content: {announcements}")
        else:
            print("   No announcements found")

    print("\n" + "=" * 60)
    print("  ✅ TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()