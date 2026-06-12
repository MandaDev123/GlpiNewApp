import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, DollarSign, Monitor, Briefcase } from 'lucide-react';
import { ticketService } from '../../services/ticketService';

const TicketDetail = () => {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [costs, setCosts] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicketData = async () => {
      try {
        setLoading(true);
        const [ticketData, costsData, itemsData] = await Promise.all([
          ticketService.getTicketById(id),
          ticketService.getTicketCosts(id),
          ticketService.getTicketItems(id)
        ]);

        setTicket(ticketData);
        setCosts(Array.isArray(costsData) ? costsData : Object.values(costsData || {}));
        setItems(Array.isArray(itemsData) ? itemsData : Object.values(itemsData || {}));
      } catch (error) {
        console.error("Erreur de chargement", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketData();
  }, [id]);

  if (loading) return <div style={{ padding: '24px' }}>Chargement des détails depuis GLPI...</div>;
  if (!ticket) return <div style={{ padding: '24px' }}>Ticket introuvable.</div>;

  // --- CALCULS CORRIGÉS (CONVERSION GLPI) ---
  
  // 1. Durée totale : GLPI retourne des secondes, on convertit en minutes
  const totalDurationInMinutes = costs.reduce((sum, c) => sum + (parseInt(c.actiontime || 0) / 60), 0);

  // 2. Coût horaire réel calculé : (Durée de la ligne en minutes / 60) * Tarif horaire de la ligne
  const totalTimeCost = costs.reduce((sum, c) => {
    const durationMin = parseInt(c.actiontime || 0) / 60;
    const hourlyRate = parseFloat(c.cost_time || 0);
    const lineTimeCost = (durationMin / 60) * hourlyRate;
    return sum + lineTimeCost;
  }, 0);

  // 3. Coût fixe total
  const totalFixedCost = costs.reduce((sum, c) => sum + parseFloat(c.cost_fixed || 0), 0);

  // 4. Coût matériel total
  const totalMaterialCost = costs.reduce((sum, c) => sum + parseFloat(c.cost_material || 0), 0);
  
  // 5. Coût global final
  const totalGlobalCost = totalTimeCost + totalFixedCost + totalMaterialCost;

  const afficherPriorite = (priorityId) => {
    const priorityMap = {
      2: { label: 'Basse', className: 'badge badge-info' },
      3: { label: 'Moyenne', className: 'badge badge-warning' },
      4: { label: 'Haute', className: 'badge badge-danger' },
      5: { label: 'Urgente', className: 'badge badge-danger' }
    };
    const priority = priorityMap[priorityId] || { label: priorityId, className: 'badge' };
    return <span className={priority.className}>{priority.label}</span>;
  };

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/admin/tickets" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)' }}>
          <ArrowLeft size={18} /> Retour
        </Link>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Ticket #{ticket.id} - {ticket.name}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Colonne Principale */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel">
            <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
              Détails de la demande
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Date d'ouverture</p>
                <p style={{ margin: 0, fontSize: '14px' }}>{new Date(ticket.date).toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Type</p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  {ticket.type === 1 ? 'Incident' : 'Demande'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Priorité</p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  <span>{afficherPriorite(ticket.priority)}</span>
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Catégorie</p>
                <p style={{ margin: 0, fontSize: '14px' }}>{ticket.itilcategories_id || 'Non définie'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Lieu</p>
                <p style={{ margin: 0, fontSize: '14px' }}>{ticket.locations_id || 'Non défini'}</p>
              </div>
            </div>

            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Description :</p>
            <div 
              style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', fontSize: '14px', lineHeight: '1.6' }}
              dangerouslySetInnerHTML={{ __html: ticket.content || "Aucune description détaillée." }}
            />
          </div>

          {/* Équipements associés */}
          <div className="glass-panel">
            <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={18} color="var(--primary)" /> Équipements liés ({items.length})
            </h3>
            {items.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Aucun équipement rattaché à ce ticket.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((item, idx) => (
                  <li key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px' }}>Reference: {item.items_id}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Type: {item.itemtype}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Colonne Droite: Résumé des Coûts Réels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ alignSelf: 'start', width: '100%' }}>
            <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="var(--accent)" /> Coûts (Intervention)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Durée Totale */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '10px', borderRadius: '8px' }}>
                  <Clock size={20} color="var(--primary)" />
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Durée totale</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                    {Math.round(totalDurationInMinutes)} minutes
                  </p>
                </div>
              </div>

              {/* Coût Horaire Total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '8px' }}>
                  <DollarSign size={20} color="var(--accent)" />
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Coût horaire total</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{totalTimeCost.toFixed(2)} €</p>
                </div>
              </div>

              {/* Coût Fixe Total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '10px', borderRadius: '8px' }}>
                  <Briefcase size={20} color="#f59e0b" />
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Coût fixe total</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{totalFixedCost.toFixed(2)} €</p>
                </div>
              </div>

              {/* Coût Matériel Total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '10px', borderRadius: '8px' }}>
                  <Monitor size={20} color="#8b5cf6" />
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Coût matériel total</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{totalMaterialCost.toFixed(2)} €</p>
                </div>
              </div>

              {/* Coût Global Final */}
              <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px', marginTop: '8px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Coût Total</p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {totalGlobalCost.toFixed(2)} €
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TicketDetail;