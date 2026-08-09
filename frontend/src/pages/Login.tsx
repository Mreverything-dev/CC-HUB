// frontend/src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Save tokens and user data
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('✅ Login successful!', data.user);
        
        // Redirect based on user role
        const role = data.user.role;
        if (role === 'admin') {
          navigate('/admin/dashboard');
        } else if (role === 'professor') {
          navigate('/professor/dashboard');
        } else {
          navigate('/student/dashboard');
        }
      } else {
        setError(data.detail || 'Login failed. Please check your credentials.');
        console.error('❌ Login error:', data);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('❌ Network error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '20px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#1a365d',
        marginBottom: '5px'
      }}>
        CCS HUB
      </h1>
      <p style={{ 
        textAlign: 'center', 
        color: '#666',
        marginBottom: '30px'
      }}>
        College of Computer Studies
      </p>
      
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
        <div style={{ marginBottom: '15px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '5px', 
            fontWeight: 'bold',
            color: '#333'
          }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@ccshub.edu.ph"
            required
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #ddd', 
              borderRadius: '5px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '5px', 
            fontWeight: 'bold',
            color: '#333'
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #ddd', 
              borderRadius: '5px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            backgroundColor: '#2563eb', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            transition: 'background-color 0.3s'
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#2563eb';
          }}
        >
          {loading ? (
            <span>
              <span style={{ 
                display: 'inline-block',
                animation: 'spin 1s linear infinite',
                marginRight: '8px'
              }}>⟳</span>
              Logging in...
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
      
      <div style={{ 
        marginTop: '20px', 
        textAlign: 'center',
        borderTop: '1px solid #eee',
        paddingTop: '20px'
      }}>
        <p style={{ margin: '0 0 5px 0', color: '#666' }}>
          Don't have an account?
        </p>
        <Link 
          to="/register" 
          style={{ 
            color: '#2563eb',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}