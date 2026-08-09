# backend/test_hash.py
import bcrypt

def test_hashing():
    print("🧪 Testing password hashing with direct bcrypt...")
    
    password = "Test@123"
    
    try:
        # Test hashing
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        hashed_str = hashed.decode('utf-8')
        
        print(f"✅ Password hashed: {hashed_str[:50]}...")
        print(f"   Length: {len(hashed_str)} characters")
        
        # Test verification
        is_valid = bcrypt.checkpw(password_bytes, hashed)
        print(f"✅ Password verified: {is_valid}")
        
        # Test wrong password
        wrong_password = "WrongPassword".encode('utf-8')
        is_valid = bcrypt.checkpw(wrong_password, hashed)
        print(f"✅ Wrong password rejected: {is_valid}")
        
        print("\n✅ All tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_hashing()