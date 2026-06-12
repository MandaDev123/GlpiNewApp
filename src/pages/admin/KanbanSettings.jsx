import React, { useState, useEffect } from 'react';

const KanbanSettings = () => {
  const [settings, setSettings] = useState({
    New: { color: '#fee2e2', labelMalgache: 'Vaovao' },
    In_Progress: { color: '#fef3c7', labelMalgache: 'Efa manao' },
    Closed: { color: '#dcfce7', labelMalgache: 'Vita' }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const API_URL = 'http://localhost:5000/api/kanban-settings';

  // Charger les configurations depuis SQLite au chargement de la page
  useEffect(() => {
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error('Erreur réseau');
        return res.json();
      })
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          setSettings(data);
        }
      })
      .catch(err => console.error("Erreur de récupération des paramètres:", err));
  }, []);

  const handleChange = (status, field, value) => {
    setSettings(prev => ({
      ...prev,
      [status]: {
        ...prev[status],
        [field]: value
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        setMessage('Configurations enregistrées avec succès dans SQLite !');
      } else {
        setMessage('Erreur lors de l\'enregistrement sur le serveur.');
      }
    } catch (error) {
      setMessage('Erreur lors de l\'enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px' }}>Personnalisation du Kanban</h1>
      
      {message && (
        <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Configuration Statut : NEW */}
        <div style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px' }}>
          <h3>Statut : Nouveau (New)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
            <div className="form-group">
              <label className="form-label">Couleur de fond de la colonne</label>
              <input 
                type="color" 
                className="form-control" 
                style={{ height: '40px', padding: '2px', width: '100%' }}
                value={settings.New.color}
                onChange={(e) => handleChange('New', 'color', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nom en Malgache</label>
              <input 
                type="text" 
                className="form-control" 
                value={settings.New.labelMalgache}
                onChange={(e) => handleChange('New', 'labelMalgache', e.target.value)}
                placeholder="ex: Vaovao"
              />
            </div>
          </div>
        </div>

        {/* Configuration Statut : IN PROGRESS */}
        <div style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px' }}>
          <h3>Statut : En cours (In Progress)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
            <div className="form-group">
              <label className="form-label">Couleur de fond de la colonne</label>
              <input 
                type="color" 
                className="form-control" 
                style={{ height: '40px', padding: '2px', width: '100%' }}
                value={settings.In_Progress.color}
                onChange={(e) => handleChange('In_Progress', 'color', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nom en Malgache</label>
              <input 
                type="text" 
                className="form-control" 
                value={settings.In_Progress.labelMalgache}
                onChange={(e) => handleChange('In_Progress', 'labelMalgache', e.target.value)}
                placeholder="ex: Efa manao"
              />
            </div>
          </div>
        </div>

        {/* Configuration Statut : CLOSED */}
        <div>
          <h3>Statut : Résolu (Closed)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
            <div className="form-group">
              <label className="form-label">Couleur de fond de la colonne</label>
              <input 
                type="color" 
                className="form-control" 
                style={{ height: '40px', padding: '2px', width: '100%' }}
                value={settings.Closed.color}
                onChange={(e) => handleChange('Closed', 'color', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nom en Malgache</label>
              <input 
                type="text" 
                className="form-control" 
                value={settings.Closed.labelMalgache}
                onChange={(e) => handleChange('Closed', 'labelMalgache', e.target.value)}
                placeholder="ex: Vita"
              />
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: '16px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer la configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default KanbanSettings;