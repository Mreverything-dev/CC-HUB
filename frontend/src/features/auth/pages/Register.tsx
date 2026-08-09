// frontend/src/pages/Register.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface RegisterFormData {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
  role: 'student' | 'professor';
  invitation_code: string;
}

export function Register() {
  const { register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    username: '',
    password: '',
    confirm_password: '',
    role: 'student',
    invitation_code: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate invitation code for professor
    if (formData.role === 'professor' && !formData.invitation_code) {
      setError('Invitation code required for professor registration');
      return;
    }

    try {
      await registerUser(formData);
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Create Account</h1>
      
      {success && (
        <div style={{ 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          padding: '12px', 
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          ✅ Registration successful! Redirecting...
        </div>
      )}
      
      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '12px', 
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          ❌ {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Email */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="register-email" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email *</label>
          <input
            id="register-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
          />
        </div>

        {/* Username */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="register-username" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Username *</label>
          <input
            id="register-username"
            name="username"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="register-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password *</label>
          <input
            id="register-password"
            name="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
          />
          <small style={{ color: '#666' }}>At least 6 characters with uppercase, lowercase and number</small>
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="register-confirm-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Confirm Password *</label>
          <input
            id="register-confirm-password"
            name="confirm_password"
            type="password"
            value={formData.confirm_password}
            onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
          />
        </div>

        {/* Role */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="register-role" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Role *</label>
          <select
            id="register-role"
            name="role"
            value={formData.role}
            onChange={(e) => {
              const newRole = e.target.value as 'student' | 'professor';
              setFormData({...formData, role: newRole, invitation_code: ''});
            }}
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
          >
            <option value="student">Student</option>
            <option value="professor">Professor (Requires Invitation Code)</option>
          </select>
        </div>

        {/* Invitation Code (Professor Only) */}
        {formData.role === 'professor' && (
          <div style={{
            backgroundColor: '#fff3cd',
            padding: '15px',
            borderRadius: '5px',
            marginBottom: '15px',
            border: '1px solid #ffc107'
          }}>
            <label htmlFor="register-invitation-code" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Invitation Code *
            </label>
            <input
              id="register-invitation-code"
              name="invitation_code"
              type="text"
              value={formData.invitation_code}
              onChange={(e) => setFormData({...formData, invitation_code: e.target.value.toUpperCase()})}
              placeholder="Enter invitation code (e.g. ABCD1234)"
              required
              style={{
                width: '100%', 
                padding: '10px', 
                border: '1px solid #ffc107', 
                borderRadius: '5px',
                backgroundColor: '#fff8e1',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontFamily: 'monospace'
              }}
            />
            <small style={{ color: '#856404' }}>
              Contact administrator to get an invitation code
            </small>
          </div>
        )}

        <button 
          type="submit" 
          disabled={isLoading || success}
          style={{ 
            width: '100%', 
            padding: '12px', 
            backgroundColor: success ? '#28a745' : '#2563eb', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: (isLoading || success) ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginTop: '10px'
          }}
        >
          {isLoading ? 'Creating account...' : success ? '✅ Registered!' : 'Register'}
        </button>
      </form>
      
      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
}