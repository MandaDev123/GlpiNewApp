import React, { useState } from 'react';
import { AlertTriangle, Trash2, Shield, CheckCircle } from 'lucide-react';
import { initSession, getAllItemIds, bulkDeleteItems } from '../../services/glpiApi';

// Tous les types à purger — inclut Phone et sera automatiquement
// étendu si vous ajoutez d'autres types dans ITEM_TYPE_MAP de glpiApi.js
const ITEM_TYPES_TO_PURGE = [
  { type: 'Ticket',   label: 'Tickets',      icon: '🎫' },
  { type: 'Computer', label: 'Ordinateurs',  icon: '💻' },
  { type: 'Monitor',  label: 'Moniteurs',    icon: '🖥️' },
  { type: 'Phone',    label: 'Téléphones',   icon: '📱' },
];

const Reset = () => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting]   = useState(false);
  const [logs, setLogs]               = useState([]);
  const [isDone, setIsDone]           = useState(false);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleReset = async () => {
    if (confirmText !== 'CONFIRMER') {
      alert("Veuillez taper CONFIRMER (en majuscules) pour valider la suppression.");
      return;
    }

    setIsDeleting(true);
    setLogs([]);
    setIsDone(false);

    try {
      addLog("Connexion à l'API GLPI...", 'info');
      await initSession();
      addLog("Session GLPI authentifiée.", 'success');

      for (const { type, label, icon } of ITEM_TYPES_TO_PURGE) {
        addLog(`${icon} Recherche de tous les ${label}...`, 'info');
        const ids = await getAllItemIds(type);

        if (ids.length === 0) {
          addLog(`${icon} Aucun ${label.toLowerCase()} trouvé. Table déjà vide.`, 'info');
          continue;
        }

        addLog(`${icon} ${ids.length} ${label.toLowerCase()} trouvé(s). Suppression en cours...`, 'warning');

        const deleted = await bulkDeleteItems(type, ids, () => {});

        addLog(`✅ ${deleted} ${label.toLowerCase()} supprimé(s) définitivement (force_purge).`, 'success');
      }

      addLog("🎉 Réinitialisation terminée ! La base GLPI a été nettoyée.", 'success');
      setIsDone(true);
    } catch (err) {
      addLog(`🚨 Erreur critique : ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
      setConfirmText('');
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Shield size={28} color="var(--danger)" /> Zone de Danger
      </h1>

      {/* Warning Panel */}
      <div className="glass-panel" style={{
        border: '1px solid rgba(239, 68, 68, 0.4)',
        background: 'rgba(239, 68, 68, 0.05)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <AlertTriangle size={32} color="var(--danger)" style={{ flexShrink: 0 }} />
          <div>
            <h2 style={{ margin: '0 0 8px 0', color: 'var(--danger)', fontSize: '18px' }}>
              Réinitialiser toutes les données GLPI
            </h2>
            <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
              Cette action va <strong style={{ color: '#ef4444' }}>supprimer définitivement</strong> (sans
              passage par la corbeille) tous les éléments suivants directement dans la base de données
              de GLPI via l'API REST :
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: '2' }}>
              {ITEM_TYPES_TO_PURGE.map(({ label, icon }) => (
                <li key={label}>{icon} Tous les <strong>{label}</strong></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Confirmation Input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Tapez <strong style={{ color: '#ef4444' }}>CONFIRMER</strong> pour valider :
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="CONFIRMER"
            disabled={isDeleting}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: confirmText === 'CONFIRMER'
                ? '2px solid var(--danger)'
                : '1px solid var(--panel-border)',
              background: 'var(--bg-dark)',
              color: 'var(--text-main)',
              fontSize: '16px',
              fontWeight: 'bold',
              textAlign: 'center',
              letterSpacing: '3px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          className="btn btn-danger"
          onClick={handleReset}
          disabled={isDeleting || confirmText !== 'CONFIRMER'}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            opacity: confirmText !== 'CONFIRMER' ? 0.4 : 1,
            cursor: confirmText !== 'CONFIRMER' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {isDeleting ? (
            <><Trash2 size={18} className="spin" /> Suppression en cours...</>
          ) : isDone ? (
            <><CheckCircle size={18} /> Réinitialisation terminée</>
          ) : (
            <><Trash2 size={18} /> Purger définitivement toutes les données</>
          )}
        </button>
      </div>

      {/* Logs Console */}
      {logs.length > 0 && (
        <div className="glass-panel" style={{
          background: '#000',
          fontFamily: 'monospace',
          maxHeight: '350px',
          overflowY: 'auto',
          textAlign: 'left'
        }}>
          <h4 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #333', paddingBottom: '8px', color: '#fff' }}>
            Terminal de Réinitialisation GLPI
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
            {logs.map((log, idx) => {
              let color = '#ccc';
              if (log.type === 'error')   color = '#ef4444';
              if (log.type === 'success') color = '#10b981';
              if (log.type === 'warning') color = '#f59e0b';

              return (
                <li key={idx} style={{ marginBottom: '6px', color, display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#666', minWidth: '70px' }}>[{log.time}]</span>
                  <span>{log.message}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Reset;