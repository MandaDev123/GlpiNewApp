import React, { useState, useEffect } from 'react';
import { Search, Filter, Monitor, Smartphone, Printer, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import { itemService } from '../../services/itemService'; // Ajuste le chemin

// ─── Icône dynamique selon le type d'équipement ───────────────────────────────
const ItemTypeIcon = ({ type, size = 20, color = 'var(--text-muted)' }) => {
  switch (type?.toLowerCase().trim()) {
    case 'phone':
      return <Smartphone size={size} color={color} />;
    case 'monitor':
      return <Monitor size={size} color={color} />;
    case 'printer':
      return <Printer size={size} color={color} />;
    case 'computer':
    default:
      return <Monitor size={size} color={color} />;
  }
};

// Badge couleur par type
const TYPE_BADGE_STYLES = {
  computer: { background: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  monitor:  { background: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  phone:    { background: 'rgba(16,185,129,0.15)',  color: '#34d399' },
  printer:  { background: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
};

const TypeBadge = ({ type }) => {
  const style = TYPE_BADGE_STYLES[type?.toLowerCase()] || {
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-muted)'
  };
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 8px',
      borderRadius: '999px', ...style
    }}>
      {type}
    </span>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────
const ItemList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  // Chargement des données depuis GLPI
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const data = await itemService.getAllItems();
        setItems(data);
      } catch (err) {
        setError("Impossible de charger les équipements depuis l'API GLPI.");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // Filtrage multi-critères
  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Inventory_Number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.User?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'All' || item.Item_Type === filterType;

    return matchesSearch && matchesType;
  });

  const uniqueTypes = ['All', ...new Set(items.map(i => i.Item_Type).filter(Boolean))];

  if (loading) return <div style={{ padding: '24px' }}><Loader className="animate-spin" style={{ marginRight: '10px' }}/> Chargement des équipements...</div>;
  if (error) return <div style={{ color: 'red', padding: '24px' }}>{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Liste des Équipements (GLPI)</h1>
        <Link to="/create-ticket" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Déclarer un incident
        </Link>
      </div>

      {/* Filtres */}
      <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            className="form-control"
            placeholder="Rechercher par nom, numéro d'inventaire, utilisateur..."
            style={{ paddingLeft: '40px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} color="var(--text-muted)" />
          <select
            className="form-control"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: '200px' }}
          >
            {uniqueTypes.map((t, idx) => (
              <option key={idx} value={t} style={{ color: 'black' }}>
                {t === 'All' ? 'Tous les types' : t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grille d'équipements */}
      {items.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px' }}>
          <Monitor size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0' }}>Aucun équipement disponible</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>La base de données GLPI est actuellement vide pour ces types.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          Aucun résultat pour cette recherche.
        </div>
      ) : (
        <div className="dashboard-grid">
          {filteredItems.map((item, idx) => (
            <div key={idx} className="glass-panel" style={{ padding: '16px' }}>
              {/* En-tête de la carte */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.06)', padding: '8px',
                    borderRadius: '8px', lineHeight: 0
                  }}>
                    <ItemTypeIcon type={item.Item_Type} size={18} color="var(--primary)" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{item.Name}</h3>
                </div>
                <span className={item.Status === 'En production' ? 'badge badge-success' : 'badge badge-info'}>
                  {item.Status}
                </span>
              </div>

              {/* Numéro inventaire + type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  {item.Inventory_Number}
                </p>
                <TypeBadge type={item.Item_Type} />
              </div>

              {/* Détails */}
              <div style={{
                borderTop: '1px solid var(--panel-border)', paddingTop: '12px',
                display: 'flex', flexDirection: 'column', gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Marque :</span>
                  <span>{item.Manufacturer} {item.Model}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lieu :</span>
                  <span>{item.Location}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Utilisateur :</span>
                  <span>{item.User || 'N/A'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItemList;