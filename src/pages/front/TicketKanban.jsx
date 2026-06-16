import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, Loader, DollarSign, Eye, Clock, AlertCircle, ArrowLeft, X } from 'lucide-react';
import { ticketService } from '../../services/ticketService';

const TYPE_LABEL = { 1: 'Incident', 2: 'Demande' };
const PRIORITY_LABEL = { 1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute' };
const STATUSES = ['New', 'In_Progress', 'Closed'];

// Affichage des 3 types canoniques de la table unique "mouvements"
const MOUVEMENT_DISPLAY = {
  close:  { label: 'Clôture',     color: '#16a34a' },
  open:   { label: 'Réouverture', color: '#d97706' },
  cancel: { label: 'Annulation',  color: '#dc2626' },
};

const TicketKanban = () => {
  const { tickets, updateTicketStatus, loadingTickets } = useData();
  const navigate = useNavigate();

  // Configuration dynamique des couleurs des colonnes du Kanban
  const [kanbanConfig, setKanbanConfig] = useState({
    New: { color: '#fee2e2', border: '#fca5a5', label: 'Vaovao', sub: 'New' },
    In_Progress: { color: '#fef3c7', border: '#fcd34d', label: 'Efa manao', sub: 'In Progress' },
    Closed: { color: '#dcfce7', border: '#86efac', label: 'Vita', sub: 'Closed' },
  });

  const [dragOverStatus, setDragOverStatus] = useState(null);
  
  // États pour la consultation des détails complets d'un ticket
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [localMouvements, setLocalMouvements] = useState([]);
  const [totalCost, setTotalCost] = useState(0);

  // États pour les boîtes de dialogue de transition financière
  const [transitioningTicket, setTransitioningTicket] = useState(null);
  const [newCostAmount, setNewCostAmount] = useState('');
  const [reopenPercentage, setReopenPercentage] = useState('');
  const [lastCostAmount, setLastCostAmount] = useState(0);
  const [savingTransition, setSavingTransition] = useState(false);

  // Charger les configurations de couleurs depuis le serveur SQLite au démarrage
  useEffect(() => {
    fetch('http://localhost:5000/api/kanban-settings')
      .then(res => res.json())
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          setKanbanConfig({
            New: { color: data.New.color, border: data.New.color, label: data.New.labelMalgache, sub: 'New' },
            In_Progress: { color: data.In_Progress.color, border: data.In_Progress.color, label: data.In_Progress.labelMalgache, sub: 'In Progress' },
            Closed: { color: data.Closed.color, border: data.Closed.color, label: data.Closed.labelMalgache, sub: 'Closed' }
          });
        }
      }).catch(err => console.error("Erreur de chargement des paramètres Kanban:", err));
  }, []);

  // Gestion du Drag & Drop
  const handleDragStart = (e, ticket) => {
    e.dataTransfer.setData('ticketId', String(ticket.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOverStatus(status);
  };

  const handleDragLeave = () => setDragOverStatus(null);

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    const id = e.dataTransfer.getData('ticketId');
    const ticket = tickets.find(t => String(t.id) === id);
    if (!ticket || ticket.Status === targetStatus) return;

    // SCÉNARIO : Passage de "Closed" (Terminé) vers "In_Progress" (En cours)
    if (ticket.Status === 'Closed' && targetStatus === 'In_Progress') {
      const lastAmount = await ticketService.getLastCostAmount(ticket.id);
      setLastCostAmount(parseFloat(lastAmount));
      setReopenPercentage('');
      setTransitioningTicket({ ticket, targetStatus, mode: 'reopen' });
      return;
    }

    // SCÉNARIO : Changement vers "Closed" (Terminé) depuis n'importe quel statut
    if (targetStatus === 'Closed') {
      setTransitioningTicket({ ticket, targetStatus, mode: 'close' });
      setNewCostAmount('');
      return;
    }

    // Changement standard direct pour les autres colonnes
    updateTicketStatus(ticket.id, targetStatus);
  };

  // Ouvrir le panneau de détails complets d'un ticket et charger l'historique COMPLET
  // de ses mouvements (open + cancel + close) depuis la table unique.
  const handleOpenDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setLoadingDetails(true);
    try {
      const mouvements = await ticketService.getTicketMouvement(ticket.id);
      const list = Array.isArray(mouvements) ? mouvements : [];
      const total = list.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
      setLocalMouvements(list);
      setTotalCost(total);
    } catch (err) {
      console.error("Erreur de chargement des détails financiers:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      
      {/* EN-TÊTE DU TABLEAU */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>Tableau Kanban des Tickets</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => navigate('/admin/importTicket')} 
            style={{ padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', background: '#2563eb', color: 'white', border: 'none', fontWeight: '600' }}
          >
            Importer Flux Mouvements
          </button>
          <button 
            onClick={() => navigate('/cout')} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e5e7eb', color: '#1f2937', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
          >
            <DollarSign size={18} /> Récapitulatif Global
          </button>
        </div>
      </div>

      {loadingTickets ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#4b5563' }}>
          <Loader className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
          Chargement des tickets depuis GLPI...
        </div>
      ) : (
        /* COLONNES DU KANBAN */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {STATUSES.map(status => {
            const columnTickets = tickets.filter(t => t.Status === status);
            const cfg = kanbanConfig[status];
            const isOver = dragOverStatus === status;

            return (
              <div 
                key={status} 
                onDragOver={(e) => handleDragOver(e, status)} 
                onDragLeave={handleDragLeave} 
                onDrop={(e) => handleDrop(e, status)} 
                style={{ 
                  backgroundColor: cfg.color, 
                  minHeight: '600px', 
                  padding: '16px', 
                  borderRadius: '12px',
                  boxShadow: isOver ? '0 0 0 3px #3b82f6 inset' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', color: '#111827', fontSize: '18px', borderBottom: '2px solid rgba(0,0,0,0.06)', paddingBottom: '8px' }}>
                  {cfg.label} <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: 'normal' }}>({columnTickets.length})</span>
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {columnTickets.map(ticket => (
                    <div 
                      key={ticket.id} 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, ticket)} 
                      style={{ 
                        background: 'white', 
                        padding: '14px', 
                        borderRadius: '8px', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.08)', 
                        cursor: 'grab',
                        borderLeft: `5px solid ${ticket.type === 1 ? '#ef4444' : '#3b82f6'}`,
                        color: '#1f2937' // Évite le texte blanc invisible
                      }}
                    >
                      {/* En-tête de la carte */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>#{ticket.id}</span>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          background: ticket.type === 1 ? '#fee2e2' : '#dbeafe', 
                          color: ticket.type === 1 ? '#991b1b' : '#1e40af',
                          fontWeight: '600'
                        }}>
                          {TYPE_LABEL[ticket.type] || `Type ${ticket.type}`}
                        </span>
                      </div>
                      
                      {/* Titre du ticket */}
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#111827', lineHeight: '1.4' }}>
                        {ticket.name || 'Sans titre'}
                      </h4>

                      {/* Métadonnées */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', fontSize: '12px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#f3f4f6', color: '#374151', fontWeight: '500' }}>
                          Prio : {PRIORITY_LABEL[ticket.priority] || ticket.priority}
                        </span>
                        {ticket.date && (
                          <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {ticket.date.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      {/* Bouton d'accès aux détails */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                        <button 
                          onClick={() => handleOpenDetails(ticket)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#2563eb', 
                            fontSize: '12px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            fontWeight: '600',
                            padding: '4px'
                          }}
                        >
                          <Eye size={14} /> Voir les détails
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {columnTickets.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', border: '2px dashed rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '13px' }}>
                      Aucun ticket
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL 1 : PASSAGE À CLOSED (SAISIE DU NOUVEAU COÛT) ── */}
      {transitioningTicket && transitioningTicket.mode === 'close' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '10px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#111827' }}>Clôture du Ticket #{transitioningTicket.ticket.id}</h3>
            <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '16px' }}>Veuillez renseigner le nouveau coût de clôture pour valider le passage au statut <strong>Terminé</strong> :</p>
            <input 
              type="number" 
              value={newCostAmount} 
              onChange={e => setNewCostAmount(e.target.value)} 
              placeholder="Montant du coût (€)" 
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #d1d5db', color: '#111827' }} 
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setTransitioningTicket(null)} 
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  const val = parseFloat(newCostAmount);
                  if (isNaN(val) || val <= 0) {
                    alert("Veuillez entrer un montant valide supérieur à 0.");
                    return;
                  }
                  setSavingTransition(true);
                  await updateTicketStatus(transitioningTicket.ticket.id, transitioningTicket.targetStatus);
                  await ticketService.addTicketCost(transitioningTicket.ticket.id, val);
                  setSavingTransition(false);
                  setTransitioningTicket(null);
                }} 
                disabled={savingTransition}
                style={{ padding: '8px 14px', background: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
              >
                {savingTransition ? 'Sauvegarde...' : 'Confirmer Clôture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2 : DE CLOSED À IN_PROGRESS (ANNULATION OU RÉOUVERTURE PAR %) ── */}
      {transitioningTicket && transitioningTicket.mode === 'reopen' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '10px', maxWidth: '460px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 6px 0', color: '#111827' }}>Réouverture du Ticket #{transitioningTicket.ticket.id}</h3>
            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
              Dernier coût brut enregistré : <strong style={{ color: '#111827' }}>{lastCostAmount.toFixed(2)} €</strong>
            </p>
            
            <div style={{ marginBottom: '20px', background: '#f9fafb', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
                Option 1 : Appliquer un pourcentage pour frais de réouverture
              </label>
              <input 
                type="number" 
                value={reopenPercentage} 
                onChange={e => setReopenPercentage(e.target.value)} 
                placeholder="Ex: 10 pour intégrer 10% du dernier coût" 
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', color: '#111827' }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
              <button 
                onClick={() => setTransitioningTicket(null)} 
                style={{ padding: '8px 12px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Fermer
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {/* ACTION A : ANNULER LE DERNIER COÛT (ajoute un mouvement 'cancel' compensatoire, rien n'est supprimé) */}
                <button 
                  onClick={async () => {
                    if (window.confirm("Confirmez-vous l'annulation du dernier coût de clôture ? Un mouvement compensatoire sera ajouté à l'historique (rien n'est supprimé).")) {
                      setSavingTransition(true);
                      const res = await ticketService.cancelLastCost(transitioningTicket.ticket.id);
                      if (!res || !res.success) {
                        alert(res?.error || "Impossible d'annuler : aucun coût de clôture trouvé pour ce ticket.");
                        setSavingTransition(false);
                        return;
                      }
                      await updateTicketStatus(transitioningTicket.ticket.id, transitioningTicket.targetStatus);
                      setSavingTransition(false);
                      setTransitioningTicket(null);
                    }
                  }} 
                  disabled={savingTransition} 
                  style={{ padding: '8px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                >
                  Annuler le dernier coût
                </button>

                {/* ACTION B : APPLIQUER LES FRAIS PAR POURCENTAGE */}
                <button 
                  onClick={async () => {
                    const pct = parseFloat(reopenPercentage);
                    if (isNaN(pct) || pct <= 0) {
                      alert("Veuillez insérer un pourcentage valide.");
                      return;
                    }
                    setSavingTransition(true);
                    const calculatedFrais = (lastCostAmount * pct) / 100;
                    // Insertion dynamique comme frais de réouverture
                    await ticketService.addTicketFrais(transitioningTicket.ticket.id, calculatedFrais);
                    await updateTicketStatus(transitioningTicket.ticket.id, transitioningTicket.targetStatus);
                    setSavingTransition(false);
                    setTransitioningTicket(null);
                  }} 
                  disabled={savingTransition || !reopenPercentage} 
                  style={{ padding: '8px 12px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                >
                  Confirmer réouverture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3 : CONSULTATION COMPLÈTE DES DÉTAILS D'UN TICKET ── */}
      {selectedTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1900 }}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '12px', maxWidth: '650px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', color: '#1f2937' }}>
            
            {/* Entête Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'bold' }}>TICKET #{selectedTicket.id}</span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#111827' }}>{selectedTicket.name || 'Sans titre'}</h2>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)} 
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Contenu / Description GLPI */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 6px 0', color: '#4b5563', fontSize: '14px' }}>Description du ticket :</h4>
              <div 
                style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: '#111827' }}
                dangerouslySetInnerHTML={{ __html: selectedTicket.content || '<span style="color:#9ca3af;">Aucune description fournie.</span>' }}
              />
            </div>

            {/* Métadonnées en grille */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px', fontSize: '13px' }}>
              <div><strong>Type :</strong> {TYPE_LABEL[selectedTicket.type] || selectedTicket.type}</div>
              <div><strong>Priorité :</strong> {PRIORITY_LABEL[selectedTicket.priority] || selectedTicket.priority}</div>
              <div><strong>Statut Kanban :</strong> <span style={{ fontWeight: 'bold' }}>{selectedTicket.Status}</span></div>
              <div><strong>Date d'ouverture :</strong> {selectedTicket.date || 'Non renseignée'}</div>
            </div>

            {/* Historique financier issu de la Table Unique (mouvements) */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#111827', display: 'flex', justifyContent: 'space-between' }}>
                <span>Historique des mouvements financiers</span>
                <span style={{ color: '#16a34a' }}>Total Net : {totalCost.toFixed(2)} €</span>
              </h3>

              {loadingDetails ? (
                <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>Chargement des lignes budgétaires...</p>
              ) : localMouvements.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '8px' }}>Type Mouvement</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Montant</th>
                      <th style={{ padding: '8px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localMouvements.map((mvt) => {
                      const display = MOUVEMENT_DISPLAY[mvt.mouvement] || { label: mvt.mouvement, color: '#111827' };
                      const amount = parseFloat(mvt.amount) || 0;
                      return (
                        <tr key={mvt.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px', fontWeight: '500', color: display.color }}>
                            {display.label}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: display.color }}>
                            {amount >= 0 ? '+' : ''}{amount.toFixed(2)} €
                          </td>
                          <td style={{ padding: '8px', color: '#6b7280', fontSize: '12px' }}>
                            {mvt.created_at}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Aucun mouvement financier enregistré pour le moment sur la table unique.</p>
              )}
            </div>

            {/* Bouton de fermeture */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <button 
                onClick={() => setSelectedTicket(null)} 
                style={{ padding: '8px 16px', background: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Fermer les détails
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default TicketKanban;