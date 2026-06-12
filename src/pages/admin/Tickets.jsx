import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ChevronRight, Loader, Calendar, RefreshCw } from 'lucide-react';
import { ticketService } from '../../services/ticketService'; // Ajustez le chemin d'import

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        const data = await ticketService.getAllTickets();
        // L'API GLPI peut renvoyer un tableau ou un objet de données
        const ticketsArray = Array.isArray(data) ? data : Object.values(data || {});
        setTickets(ticketsArray);
      } catch (err) {
        setError("Impossible de charger les tickets depuis GLPI.");
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  const getStatusBadge = (statusId) => {
    // Les statuts GLPI standards (1=Nouveau, 2=En cours, 3=En attente, 4=Résolu, 5=Clos)
    const statusMap = {
      1: { label: 'Nouveau', className: 'badge badge-info' },
      2: { label: 'En cours (Attribué)', className: 'badge badge-warning' },
      3: { label: 'En attente', className: 'badge badge-warning' },
      4: { label: 'Résolu', className: 'badge badge-success' },
      5: { label: 'Clos', className: 'badge badge-success' },
      6: { label: 'Clos', className: 'badge badge-success' }
    };
    const status = statusMap[statusId] || { label: statusId, className: 'badge' };
    return <span className={status.className}>{status.label}</span>;
  };

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

  if (loading) return <div style={{ padding: '20px' }}><Loader className="animate-spin" /> Chargement des tickets GLPI...</div>;
  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>Gestion des Tickets (GLPI)</h1>
      
      {tickets.length === 0 ? (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Aucun ticket trouvé.</p>
        </div>
      ) : (
        /* Grille adaptative pour l'affichage des cartes */
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '20px' 
        }}>
          {tickets.map((ticket) => (
            <div 
              key={ticket.id} 
              className="glass-panel" 
              style={{ 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                transition: 'transform 0.2s',
                height: '100%'
              }}
            >
              {/* En-tête de la carte : ID + Badges */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    #{ticket.id}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {getStatusBadge(ticket.status)}
                    {afficherPriorite(ticket.priority)}
                  </div>
                </div>

                {/* Titre du Ticket */}
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  marginBottom: '16px',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }} title={ticket.name}>
                  {ticket.name}
                </h3>
              </div>

              {/* Pied de la carte : Dates et Bouton d'action */}
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '14px', marginTop: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={12} />
                    <span><strong>Ouvert le :</strong> {new Date(ticket.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={12} />
                    <span><strong>Modifié le :</strong> {new Date(ticket.date_mod).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>

                <Link 
                  to={`/admin/tickets/${ticket.id}`} 
                  className="btn" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    background: 'rgba(59, 130, 246, 0.1)', 
                    color: 'var(--primary)', 
                    padding: '8px 12px',
                    width: '100%',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  <FileText size={14} /> Détails <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tickets;