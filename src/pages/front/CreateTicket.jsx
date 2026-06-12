import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Send, CheckSquare, Square, Loader } from 'lucide-react';
import { ticketService } from '../../services/ticketService';

const CreateTicket = () => {
  const { items } = useData();
  const navigate = useNavigate();

  // Helper pour avoir la date et l'heure locale actuelle au format requis par l'input (YYYY-MM-DDTHH:MM)
  const getLocalDateTimeString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const [formData, setFormData] = useState({
    Type: 'Incident',
    Titre: '',
    Description: '',
    Priority: 'Medium',
    Status: 'Nouveau', // Nouveau champ statut
    Date: getLocalDateTimeString(), // Nouveau champ date d'ouverture (par défaut maintenant)
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const toggleItem = (itemObj) => {
    setSelectedItems(prev => {
      const isAlreadySelected = prev.some(i => i.id === itemObj.id && i.glpiType === itemObj.glpiType);
      if (isAlreadySelected) {
        return prev.filter(i => !(i.id === itemObj.id && i.glpiType === itemObj.glpiType));
      } else {
        return [...prev, itemObj];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.Titre.trim() === '') {
      alert("Le titre est obligatoire.");
      return;
    }

    setIsSubmitting(true);

    try {
      await ticketService.createTicket(formData, selectedItems);
      alert("Ticket créé avec succès !");
      navigate('/');
    } catch (error) {
      alert("Une erreur est survenue lors de la création du ticket. Vérifiez la console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px' }}>Nouveau Ticket</h1>

      <form onSubmit={handleSubmit} className="glass-panel">
        {/* LIGNE 1 : TYPE ET PRIORITÉ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">Type de demande</label>
            <select
              className="form-control"
              value={formData.Type}
              onChange={e => setFormData({ ...formData, Type: e.target.value })}
              style={{ color: 'black' }}
              disabled={isSubmitting}
            >
              <option value="Incident">Incident (Problème technique)</option>
              <option value="Request">Demande (Nouveau matériel, accès...)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Priorité</label>
            <select
              className="form-control"
              value={formData.Priority}
              onChange={e => setFormData({ ...formData, Priority: e.target.value })}
              style={{ color: 'black' }}
              disabled={isSubmitting}
            >
              <option value="Low">Basse</option>
              <option value="Medium">Moyenne</option>
              <option value="High">Haute</option>
              <option value="Urgent">Urgente</option>
            </select>
          </div>
        </div>

        {/* LIGNE 2 : STATUT ET DATE D'OUVERTURE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">Statut du ticket</label>
            <select
              className="form-control"
              value={formData.Status}
              onChange={e => setFormData({ ...formData, Status: e.target.value })}
              style={{ color: 'black' }}
              disabled={isSubmitting}
            >
              <option value="Nouveau">Nouveau</option>
              <option value="En Cours">En Cours (Assigné)</option>
              <option value="Clos">Clos</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date d'ouverture</label>
            <input
              type="datetime-local"
              className="form-control"
              value={formData.Date}
              onChange={e => setFormData({ ...formData, Date: e.target.value })}
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        {/* TITRE DU TICKET */}
        <div className="form-group">
          <label className="form-label">Titre du ticket</label>
          <input
            type="text"
            className="form-control"
            value={formData.Titre}
            onChange={e => setFormData({ ...formData, Titre: e.target.value })}
            placeholder="Ex: Dysfonctionnement de la messagerie"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* DESCRIPTION */}
        <div className="form-group">
          <label className="form-label">Description détaillée</label>
          <textarea
            className="form-control"
            value={formData.Description}
            onChange={e => setFormData({ ...formData, Description: e.target.value })}
            placeholder="Décrivez votre problème en détail..."
            rows={5}
            disabled={isSubmitting}
          ></textarea>
        </div>

        {/* ASSOCIATION DES ÉQUIPEMENTS */}
        <div className="form-group" style={{ marginTop: '24px' }}>
          <label className="form-label" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginBottom: '12px' }}>
            Associer des équipements ({selectedItems.length} sélectionné{selectedItems.length > 1 ? 's' : ''})
          </label>

          <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
            {items.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Aucun équipement disponible.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((item, idx) => {
                  const isSelected = selectedItems.some(i => i.id === item.id && i.glpiType === item.glpiType);

                  // Traduction visuelle du glpiType pour l'utilisateur
                  const getTypeLabel = (type) => {
                    switch (type) {
                      case 'Computer': return '💻 Ordinateur';
                      case 'Monitor': return '🖥️ Moniteur';
                      case 'Phone': return '📞 Téléphone';
                      case 'NetworkEquipment': return '🌐 Réseau';
                      default: return `📦 ${type}`;
                    }
                  };

                  return (
                    <div
                      key={`${item.glpiType}-${item.id || idx}`}
                      onClick={() => !isSubmitting && toggleItem(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px',
                        borderRadius: '6px',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                        transition: 'all 0.2s',
                        opacity: isSubmitting ? 0.6 : 1
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} color="var(--primary)" />
                      ) : (
                        <Square size={18} color="var(--text-muted)" />
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.Name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            ({item.Inventory_Number || 'Sans N°'} - {item.Location || 'Sans lieu'})
                          </span>
                        </div>

                        {/* Badge indiquant le type de matériel GLPI */}
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(255,255,255,0.1)',
                          color: 'var(--text-muted)',
                          fontWeight: '600'
                        }}>
                          {getTypeLabel(item.glpiType)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* BOUTON DE SOUMISSION */}
        <div style={{ marginTop: '32px', textAlign: 'right' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }} disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader size={18} className="animate-spin" /> Envoi...</>
            ) : (
              <><Send size={18} /> Soumettre le ticket</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTicket;