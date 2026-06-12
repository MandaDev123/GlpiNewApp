import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, Loader } from 'lucide-react';
import { ticketService } from '../../services/ticketService';

const TYPE_LABEL   = { 1: 'Incident', 2: 'Demande' };
const PRIORITY_LABEL = { 1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute' };
const STATUSES = ['New', 'In_Progress', 'Closed'];

const TicketKanban = () => {
  const { tickets, updateTicketStatus, loadingTickets } = useData();
  const navigate = useNavigate();

  // Configuration dynamique des colonnes
  const [kanbanConfig, setKanbanConfig] = useState({
    New:         { color: '#fee2e2', border: '#fca5a5', label: 'Vaovao',    sub: 'New'         },
    In_Progress: { color: '#fef3c7', border: '#fcd34d', label: 'Efa manao', sub: 'In Progress' },
    Closed:      { color: '#dcfce7', border: '#86efac', label: 'Vita',      sub: 'Closed'      },
  });

  const [dragOverStatus, setDragOverStatus]     = useState(null);
  
  // États pour la consultation des détails complets
  const [selectedTicket, setSelectedTicket]     = useState(null);
  const [loadingDetails, setLoadingDetails]     = useState(false);
  const [ticketDetails, setTicketDetails]       = useState(null);

  // États pour les changements de statut nécessitant une action / boîte de dialogue
  const [transitioningTicket, setTransitioningTicket] = useState(null);
  const [comment, setComment]                   = useState('');

  // Charger les configurations d'affichage au montage
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
      })
      .catch(err => console.error("Impossible de charger les styles personnalisés", err));
  }, []);

  // Déclenche la boîte de dialogue si on transite vers "Closed"
  const needsAdditionalInfo = (fromStatus, toStatus) => toStatus === 'Closed';

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e, ticket) => {
    // Utilisation stricte de l'ID GLPI unique (id ou id du ticket normalisé)
    e.dataTransfer.setData('ticketId', String(ticket.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOverStatus(status);
  };

  const handleDragLeave = () => setDragOverStatus(null);

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    
    const id = e.dataTransfer.getData('ticketId');
    const ticket = tickets.find(t => String(t.id) === id);
    if (!ticket || ticket.Status === targetStatus) return;

    if (needsAdditionalInfo(ticket.Status, targetStatus)) {
      setTransitioningTicket({ ticket, targetStatus });
      setComment('');
    } else {
      // Modifie le statut directement via l'API pour les autres colonnes
      updateTicketStatus(ticket.id, targetStatus);
    }
  };

  const confirmTransition = () => {
    if (!transitioningTicket) return;
    updateTicketStatus(transitioningTicket.ticket.id, transitioningTicket.targetStatus, comment);
    setTransitioningTicket(null);
    setComment('');
  };

  // ── Chargement des détails complets au clic ──────────────────────────────
  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);
    setLoadingDetails(true);
    setTicketDetails(null);

    try {
      // Appels simultanés via le ticketService pour récupérer TOUTES les infos correctes
      const [fullTicket, costs, items] = await Promise.all([
        ticketService.getTicketById(ticket.id),
        ticketService.getTicketCosts(ticket.id),
        ticketService.getTicketItems(ticket.id)
      ]);

      setTicketDetails({
        ...fullTicket,
        costs: Array.isArray(costs) ? costs : [],
        items: Array.isArray(items) ? items : []
      });
    } catch (error) {
      console.error("Erreur lors de la récupération du détail complet du ticket", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>
          Tableau Kanban des Tickets {loadingTickets && <Loader size={18} className="animate-spin" style={{ display: 'inline', marginLeft: 10 }} />}
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn"
            onClick={() => navigate('/admin/kanban-settings')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e5e7eb', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            <Settings size={18} /> Personnaliser
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/create-ticket')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Ajouter 1 ticket
          </button>
        </div>
      </div>

      {/* Colonnes Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'start' }}>
        {STATUSES.map(status => {
          const columnTickets = tickets.filter(t => t.Status === status);
          const cfg           = kanbanConfig[status];
          const isOver        = dragOverStatus === status;

          return (
            <div
              key={status}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
              className="glass-panel"
              style={{
                backgroundColor: isOver ? 'rgba(0,0,0,0.05)' : cfg.color,
                border: `2px solid ${isOver ? '#1f2937' : 'transparent'}`,
                minHeight: '520px',
                padding: '16px',
                borderRadius: '12px',
                transition: 'background-color 0.2s, border-color 0.2s',
              }}
            >
              {/* Titre Colonne */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: `2px solid rgba(0,0,0,0.1)`, paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>{cfg.label}</h3>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{cfg.sub}</span>
                </div>
                <span style={{ background: '#1f2937', color: 'white', borderRadius: '999px', padding: '2px 10px', fontSize: '13px', fontWeight: '700' }}>
                  {columnTickets.length}
                </span>
              </div>

              {/* Conteneur des cartes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {columnTickets.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '40px', fontStyle: 'italic' }}>Aucun ticket</p>
                ) : (
                  columnTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket)}
                      onClick={() => handleTicketClick(ticket)}
                      style={{
                        background: 'white',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        cursor: 'grab',
                        color: '#1f2937',
                        borderLeft: `4px solid ${Number(ticket.type) === 2 ? '#3b82f6' : '#ef4444'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', marginBottom: '5px' }}>
                        <span style={{ fontWeight: 600 }}>#{ticket.id}</span>
                        <span style={{
                          background: Number(ticket.type) === 2 ? '#eff6ff' : '#fef2f2',
                          color:      Number(ticket.type) === 2 ? '#2563eb' : '#dc2626',
                          padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600
                        }}>
                          {TYPE_LABEL[ticket.type] || 'N/A'}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', lineHeight: 1.3 }}>
                        {ticket.name || '(Sans titre)'}
                      </h4>

                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ticket.content ? ticket.content.replace(/<[^>]*>/g, '') : '—'} {/* Nettoyage HTML basique de GLPI */}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#9ca3af' }}>
                        <span>Priorité : {PRIORITY_LABEL[ticket.priority] || ticket.priority || 'Moyenne'}</span>
                        <span>{ticket.date ? ticket.date.substring(0, 10) : ''}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL COMPLET : Détails du ticket récupérés de l'API */}
      {selectedTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setSelectedTicket(null)}>
          <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ background: 'white', padding: '28px', borderRadius: '14px', maxWidth: '650px', width: '100%', maxHeight: '85vh', overflowY: 'auto', color: '#1f2937' }}>
            
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px' }}>
              Détails du Ticket #{selectedTicket.id}
            </h2>

            {loadingDetails ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <p>Chargement des informations en temps réel depuis GLPI...</p>
              </div>
            ) : ticketDetails ? (
              <div>
                {/* Infos principales */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div><strong>Titre :</strong> {ticketDetails.name || '—'}</div>
                  <div><strong>Description :</strong> 
                    <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '6px', marginTop: '5px', fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: ticketDetails.content }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div><strong>Type :</strong> {TYPE_LABEL[ticketDetails.type] || 'Inconnu'}</div>
                    <div><strong>Priorité :</strong> {PRIORITY_LABEL[ticketDetails.priority] || ticketDetails.priority}</div>
                    <div><strong>Date de création :</strong> {ticketDetails.date}</div>
                    <div><strong>Dernière modification :</strong> {ticketDetails.date_mod}</div>
                  </div>
                </div>

                {/* Équipements liés (Item_Ticket) */}
                <h3 style={{ fontSize: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '15px', marginTop: '15px' }}>Matériels & Équipements associés</h3>
                {ticketDetails.items.length === 0 ? <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Aucun équipement lié à ce ticket.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '5px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                        <th style={{ padding: '6px' }}>Type</th>
                        <th style={{ padding: '6px' }}>ID Équipement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketDetails.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px' }}>{item.itemtype}</td>
                          <td style={{ padding: '6px' }}>{item.items_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Coûts associés (TicketCost) */}
                <h3 style={{ fontSize: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '15px', marginTop: '15px' }}>Coûts financiers</h3>
                {ticketDetails.costs.length === 0 ? <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Aucun coût enregistré.</p> : (
                  <ul style={{ fontSize: '13px', paddingLeft: '20px' }}>
                    {ticketDetails.costs.map((cost, idx) => (
                      <li key={idx}>
                        <strong>{cost.name || 'Coût'} :</strong> {cost.cost} € (Matériel : {cost.itemcost || '0'} €)
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p style={{ color: '#ef4444' }}>Erreur lors du chargement des détails.</p>
            )}

            <div style={{ textAlign: 'right', marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
              <button className="btn" style={{ background: '#4b5563', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setSelectedTicket(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : Boîte de dialogue pour clôture obligatoire avec commentaire */}
      {transitioningTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ background: 'white', padding: '28px', borderRadius: '14px', maxWidth: '420px', width: '100%', color: '#1f2937' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Clôturer le ticket ?</h3>
            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
              Ticket <strong>#{transitioningTicket.ticket.id}</strong> → <strong>{kanbanConfig.Closed.label} (Closed)</strong>.<br/>
              Veuillez saisir un commentaire de résolution pour GLPI :
            </p>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Décrivez la solution apportée..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn" style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setTransitioningTicket(null)}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={confirmTransition}
                disabled={!comment.trim()}
                style={{ padding: '8px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: comment.trim() ? 'pointer' : 'not-allowed', opacity: comment.trim() ? 1 : 0.5 }}
              >
                Valider la clôture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketKanban;