import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Settings, LogOut, Ticket, Home, Database } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="glass-nav" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', alignItems: 'center', marginBottom: '24px' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '20px' }}>GLPI React</h2>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link to="/" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <Home size={18} /> Accueil
          </Link>
          <Link to="/create-ticket" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <Ticket size={18} /> Nouveau Ticket
          </Link>
          <Link to="/kanban" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <Ticket size={18} /> Kanban
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {isAuthenticated ? (
          <>
            <Link to="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
              <Settings size={18} /> Dashboard
            </Link>
            <Link to="/admin/import" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
              <Database size={18} /> Import Data
            </Link>
            <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }}>
              <LogOut size={14} /> Déconnexion
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Accès Backoffice
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
