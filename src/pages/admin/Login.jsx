import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock } from 'lucide-react';

const Login = () => {
  const [code, setCode] = useState('ADMIN2026');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = login(code);
    if (success) {
      navigate('/admin');
    } else {
      setError('Code d\'accès incorrect.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <div style={{ background: 'rgba(59, 130, 246, 0.2)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
          <Lock size={32} color="var(--primary)" />
        </div>
        <h2 style={{ marginBottom: '8px' }}>Accès Backoffice</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
          Entrez le code unique pour accéder à l'administration.
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Code d'accès</label>
            <input
              type="password"
              className="form-control"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Entrez le code"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            Connexion
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
