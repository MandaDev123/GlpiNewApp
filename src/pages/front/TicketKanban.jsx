import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, Loader, DollarSign } from 'lucide-react';
import { ticketService, computeGlpiCostTotal } from '../../services/ticketService';

const TYPE_LABEL = { 1: 'Incident', 2: 'Demande' };
const PRIORITY_LABEL = { 1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute' };
const STATUSES = ['New', 'In_Progress', 'Closed'];

const TicketKanban = () => {
  const { tickets, updateTicketStatus, loadingTickets } = useData();
  const navigate = useNavigate();

  // Configuration dynamique des colonnes
  const [kanbanConfig, setKanbanConfig] = useState({
    New: { color: '#fee2e2', border: '#fca5a5', label: 'Vaovao', sub: 'New' },
    In_Progress: { color: '#fef3c7', border: '#fcd34d', label: 'Efa manao', sub: 'In Progress' },
    Closed: { color: '#dcfce7', border: '#86efac', label: 'Vita', sub: 'Closed' },
  });

  const [dragOverStatus, setDragOverStatus] = useState(null);

  // États pour la consultation des détails complets
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [ticketDetails, setTicketDetails] = useState(null);

  // États pour les changements de statut nécessitant une action / boîte de dialogue
  const [transitioningTicket, setTransitioningTicket] = useState(null);
  const [comment, setComment] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [savingTransition, setSavingTransition] = useState(false);
  const [reopenPercentage, setReopenPercentage] = useState('');
  const [lastCostAmount, setLastCostAmount] = useState(0);

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

  const needsAdditionalInfoinprogress = (fromStatus, toStatus) => toStatus === 'In_Progress';

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

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    const id = e.dataTransfer.getData('ticketId');
    const ticket = tickets.find(t => String(t.id) === id);
    if (!ticket || ticket.Status === targetStatus) return;

    // Closed → In_Progress : boîte de réouverture
    if (ticket.Status === 'Closed' && targetStatus === 'In_Progress') {
      // Charger le dernier coût enregistré pour pré-remplir le pourcentage
      const localCosts = await ticketService.getLocalTicketCosts(ticket.id);
      const lastAmount = localCosts.items?.[0]?.amount || 0; // trié DESC, donc [0] = le plus récent
      setLastCostAmount(parseFloat(lastAmount));
      setReopenPercentage('20'); // valeur par défaut 20%
      setTransitioningTicket({ ticket, targetStatus, mode: 'reopen' });
      setComment('');
      setNewCostAmount('');
      return;
    }

    // * → Closed : boîte de clôture
    if (targetStatus === 'Closed') {
      setTransitioningTicket({ ticket, targetStatus, mode: 'close' });
      setComment('');
      setNewCostAmount('');
      return;
    }

    // Tous les autres cas : transition directe
    updateTicketStatus(ticket.id, targetStatus);
  };


  const confirmTransition = async () => {
    if (!transitioningTicket) return;
    setSavingTransition(true);

    try {
      const { ticket, targetStatus, mode } = transitioningTicket;

      if (mode === 'close') {
        await updateTicketStatus(ticket.id, targetStatus, comment);
        const amount = parseFloat(newCostAmount);
        if (!isNaN(amount) && amount > 0) {
          await ticketService.addTicketCost(ticket.id, amount);
        }
      }

      if (mode === 'reopen') {
        await updateTicketStatus(ticket.id, targetStatus, comment);
        const pct = parseFloat(reopenPercentage);
        if (!isNaN(pct) && pct > 0 && lastCostAmount > 0) {
          const fraisAmount = (lastCostAmount * pct) / 100;
          await ticketService.addTicketFrais(ticket.id, fraisAmount);
        }
      }
    } catch (error) {
      console.error('Erreur transition :', error);
      alert('Une erreur est survenue lors de la transition.');
    } finally {
      setSavingTransition(false);
      setTransitioningTicket(null);
      setComment('');
      setNewCostAmount('');
      setReopenPercentage('');
      setLastCostAmount(0);
    }
  };

  // ── Chargement des détails complets au clic ──────────────────────────────
  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);
    setLoadingDetails(true);
    setTicketDetails(null);

    try {
      // Appels simultanés via le ticketService pour récupérer TOUTES les infos correctes
      const [fullTicket, costs, items, localCosts] = await Promise.all([
        ticketService.getTicketById(ticket.id),
        ticketService.getTicketCosts(ticket.id),
        ticketService.getTicketItems(ticket.id),
        ticketService.getLocalTicketCosts(ticket.id)
      ]);

      setTicketDetails({
        ...fullTicket,
        costs: Array.isArray(costs) ? costs : [],
        items: Array.isArray(items) ? items : [],
        localCosts: localCosts.items || [],
        localCostsTotal: localCosts.total || 0
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
            onClick={() => navigate('/cout')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e5e7eb', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            <DollarSign size={18} /> Récapitulatif des coûts
          </button>
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
          const cfg = kanbanConfig[status];
          const isOver = dragOverStatus === status;

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
                          color: Number(ticket.type) === 2 ? '#2563eb' : '#dc2626',
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

                {/* Coûts associés (TicketCost GLPI + nouveaux coûts locaux) */}
                <h3 style={{ fontSize: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '15px', marginTop: '15px' }}>Coûts financiers</h3>

                {(() => {
                  const glpiTotal = computeGlpiCostTotal(ticketDetails.costs);
                  const localTotal = ticketDetails.localCostsTotal || 0;
                  const grandTotal = glpiTotal + localTotal;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Coûts GLPI existants (temps + fixe + matériel) :</span>
                        <strong>{glpiTotal.toFixed(2)} €</strong>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Nouveaux coûts ajoutés :</span>
                          <strong>{localTotal.toFixed(2)} €</strong>
                        </div>
                        {ticketDetails.localCosts.length > 0 && (
                          <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', color: '#6b7280' }}>
                            {ticketDetails.localCosts.map((c) => (
                              <li key={c.id}>
                                {parseFloat(c.amount).toFixed(2)} € {c.comment ? `— ${c.comment}` : ''}
                                {' '}
                                <span style={{ fontSize: '11px' }}>
                                  ({new Date(c.created_at).toLocaleString('fr-FR')})
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '8px', fontSize: '15px' }}>
                        <strong>Coût total :</strong>
                        <strong style={{ color: 'var(--accent, #10b981)' }}>{grandTotal.toFixed(2)} €</strong>
                      </div>
                    </div>
                  );
                })()}
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
      {/* MODAL : Clôture (Closed) et Réouverture (In_Progress) */}
      {transitioningTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ background: 'white', padding: '28px', borderRadius: '14px', maxWidth: '420px', width: '100%', color: '#1f2937' }}>

            {/* ── MODE CLÔTURE ── */}
            {transitioningTicket.mode === 'close' && (<>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Clôturer le ticket ?</h3>
              <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
                Ticket <strong>#{transitioningTicket.ticket.id}</strong> → <strong>Closed</strong>.<br />
                Veuillez saisir un commentaire de résolution pour GLPI :
              </p>
              <textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Décrivez la solution apportée..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', resize: 'vertical' }}
              />
              <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '14px' }}>
                <p style={{ fontSize: '14px', color: '#4b5563', margin: '0 0 8px 0' }}>Ajouter un coût pour ce ticket (optionnel) :</p>
                <input
                  type="number" min="0" step="0.01"
                  value={newCostAmount}
                  onChange={e => setNewCostAmount(e.target.value)}
                  placeholder="Montant (€)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setTransitioningTicket(null)}>Annuler</button>
                <button
                  onClick={confirmTransition}
                  disabled={!comment.trim() || savingTransition}
                  style={{ padding: '8px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: (comment.trim() && !savingTransition) ? 'pointer' : 'not-allowed', opacity: (comment.trim() && !savingTransition) ? 1 : 0.5 }}
                >
                  {savingTransition ? 'Enregistrement...' : 'Valider la clôture'}
                </button>
              </div>
            </>)}

            {/* ── MODE RÉOUVERTURE ── */}
            {transitioningTicket.mode === 'reopen' && (<>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Réouvrir le ticket ?</h3>
              <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
                Ticket <strong>#{transitioningTicket.ticket.id}</strong> → <strong>En cours</strong>.<br />
                Dernier coût enregistré : <strong>{lastCostAmount.toFixed(2)} €</strong>
              </p>
              <div>
                <p style={{ fontSize: '14px', color: '#4b5563', margin: '0 0 8px 0' }}>Frais de réouverture (% du dernier coût) :</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number" min="0" max="100" step="1"
                    value={reopenPercentage}
                    onChange={e => setReopenPercentage(e.target.value)}
                    placeholder="% ex: 20"
                    style={{ flex: '0 0 100px', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    = {(lastCostAmount * (parseFloat(reopenPercentage) || 0) / 100).toFixed(2)} €
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setTransitioningTicket(null)}>Annuler</button>
                <button
                  onClick={async () => {
                    setSavingTransition(true);
                    try {
                      const ticketId = transitioningTicket.ticket.id;
                      const targetStatus = transitioningTicket.targetStatus;

                      // 1. Récupérer les coûts locaux associés à ce ticket GLPI
                      const responseCosts = await fetch(`http://localhost:5000/api/ticket-costs/${ticketId}`);
                      if (!responseCosts.ok) throw new Error("Impossible de vérifier les coûts locaux.");

                      const localCosts = await responseCosts.json(); // Renvoie { items: [...], total: X }

                      // 2. Vérification STRICTE : Y a-t-il un élément dans le tableau ?
                      if (localCosts && Array.isArray(localCosts.items) && localCosts.items.length > 0) {
                        const trueRows = localCosts.items;
                        const lastRow = trueRows[0]; // Le plus récent (trié par DESC sur le serveur)

                        // Sécurité ultime : on s'assure que la ligne SQLite a bien un ID et qu'il est différent de l'ID du ticket
                        if (lastRow && lastRow.id) {
                          console.log(`Tentative de suppression de la ligne de coût SQLite n°${lastRow.id} (pour le ticket GLPI #${ticketId})`);

                          const deleteResponse = await fetch(`http://localhost:5000/api/ticket-costs/${lastRow.id}`, {
                            method: 'DELETE'
                          });

                          if (!deleteResponse.ok) {
                            throw new Error("Le serveur local a refusé la suppression de la ligne.");
                          }
                          console.log("Coût local supprimé avec succès.");
                        }
                      } else {
                        // Le tableau est vide (comme pour votre ticket 11) : on ne fait AUCUN DELETE
                        console.log(`Aucun coût local trouvé dans SQLite pour le ticket #${ticketId}. Passage direct à la réouverture.`);
                      }

                      // 3. Changement de statut dans GLPI (s'exécute dans tous les cas)
                      await updateTicketStatus(ticketId, targetStatus);

                    } catch (err) {
                      console.error('Erreur lors du processus de réouverture :', err);
                      alert(`Erreur : ${err.message}`);
                    } finally {
                      setSavingTransition(false);
                      setTransitioningTicket(null);
                      setReopenPercentage('');
                      setLastCostAmount(0);
                    }
                  }}
                  disabled={savingTransition}
                  style={{
                    padding: '8px 12px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: savingTransition ? 'not-allowed' : 'pointer',
                    opacity: savingTransition ? 0.5 : 1
                  }}
                >
                  {savingTransition ? '...' : 'Annuler le dernier coût'}
                </button>

                <button
                  onClick={confirmTransition}
                  disabled={savingTransition}
                  style={{ padding: '8px 12px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: savingTransition ? 'not-allowed' : 'pointer', opacity: savingTransition ? 0.5 : 1 }}
                >
                  {savingTransition ? 'Enregistrement...' : 'Confirmer la réouverture'}
                </button>
              </div>
            </>)}

          </div>
        </div>
      )}
    </div>
  );
};

export default TicketKanban;