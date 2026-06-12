import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Monitor, Ticket, Layers, Activity, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { items = [], tickets = [], loadingAssets, loadingTickets, refreshAssets, refreshTickets } = useData();

  const stats = useMemo(() => {
    const itemsByType = items.reduce((acc, item) => {
      let type = item.glpiType || item.Item_Type || 'Autre';
      if (type === 'Computer') type = 'Ordinateurs';
      if (type === 'Monitor') type = 'Moniteurs';
      if (type === 'Phone') type = 'Téléphones';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const ticketsByType = tickets.reduce((acc, ticket) => {
      // CORRECTION 2 : Le champ est normalisé en number dans le Context.
      // On utilise Number() pour absorber les éventuels strings résiduels du cache.
      const rawType = Number(ticket.Type ?? ticket.type ?? 0);
      let label;
      if (rawType === 1) label = 'Incident';
      else if (rawType === 2) label = 'Demande';
      else label = 'Inconnu';

      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    return {
      totalItems: items.length,
      itemsByType,
      totalTickets: tickets.length,
      ticketsByType,
    };
  }, [items, tickets]);

  const handleRefresh = () => {
    refreshAssets();
    refreshTickets();
  };

  const isLoading = loadingAssets || loadingTickets;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Dashboard Backoffice</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* CORRECTION 1 : Bouton de rafraîchissement manuel */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', opacity: isLoading ? 0.6 : 1 }}
          >
            <RefreshCw size={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            {isLoading ? 'Chargement...' : 'Actualiser'}
          </button>
          <Link to="/admin/tickets" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', textDecoration: 'none' }}>
            Voir les Tickets
          </Link>
          <Link to="/admin/reset" className="btn btn-danger" style={{ textDecoration: 'none' }}>
            Réinitialiser Données
          </Link>
        </div>
      </div>

      {/* COMPTEURS GÉNÉRAUX */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px', borderRadius: '12px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={28} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '700' }}>
              {loadingAssets ? '…' : stats.totalItems}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>Équipements globaux</p>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px', borderRadius: '12px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ticket size={28} color="#10b981" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '700' }}>
              {loadingTickets ? '…' : stats.totalTickets}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>Tickets enregistrés</p>
          </div>
        </div>
      </div>

      {/* RÉPARTITION PAR TYPE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color="var(--primary)" /> Répartition des Équipements
          </h3>
          {loadingAssets ? (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Chargement…</p>
          ) : Object.keys(stats.itemsByType).length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Aucun matériel détecté.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.entries(stats.itemsByType).map(([type, count]) => (
                <li key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{type}</span>
                  <span className="badge badge-primary" style={{ minWidth: '35px', textAlign: 'center', fontWeight: '700' }}>{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} color="#10b981" /> Répartition des Tickets
          </h3>
          {loadingTickets ? (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Chargement…</p>
          ) : Object.keys(stats.ticketsByType).length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Aucun ticket détecté.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.entries(stats.ticketsByType).map(([type, count]) => (
                <li key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{type}</span>
                  <span className="badge badge-warning" style={{ minWidth: '35px', textAlign: 'center', fontWeight: '700' }}>{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Animation spin pour le bouton refresh */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Dashboard;