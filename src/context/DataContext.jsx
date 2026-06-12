import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api, { initSession } from '../services/glpiApi';
import { ticketService } from '../services/ticketService';

const DataContext = createContext(null);

const ensureSession = async () => {
  if (!api.defaults.headers.common['Session-Token']) {
    console.log("Context : Initialisation de la session GLPI...");
    await initSession();
  }
};

// Convertit le statut GLPI (entier 1-6) en statut Kanban
// 1=New, 2=In_Progress, 3=In_Progress, 4=In_Progress, 5=Closed, 6=Closed
export const glpiStatusToKanban = (glpiStatus) => {
  const s = Number(glpiStatus);
  if (s === 1) return 'New';
  if (s === 5 || s === 6) return 'Closed';
  if (s >= 2 && s <= 4) return 'In_Progress';
  return 'New'; // fallback
};

export const DataProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketCosts, setTicketCosts] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const refreshAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      await ensureSession();
      const [computersRes, monitorsRes, phonesRes] = await Promise.all([
        api.get('/Computer/', { params: { expand_dropdowns: true, range: '0-100' } }).catch(() => ({ data: [] })),
        api.get('/Monitor/', { params: { expand_dropdowns: true, range: '0-100' } }).catch(() => ({ data: [] })),
        api.get('/Phone/', { params: { expand_dropdowns: true, range: '0-100' } }).catch(() => ({ data: [] }))
      ]);
      const computers = (computersRes.data || []).map(item => ({ id: item.id, Name: item.name || 'Ordinateur sans nom', Inventory_Number: item.otherserial || 'N/A', Location: item.locations_id || 'Non spécifié', glpiType: 'Computer' }));
      const monitors = (monitorsRes.data || []).map(item => ({ id: item.id, Name: item.name || 'Moniteur sans nom', Inventory_Number: item.otherserial || 'N/A', Location: item.locations_id || 'Non spécifié', glpiType: 'Monitor' }));
      const phones = (phonesRes.data || []).map(item => ({ id: item.id, Name: item.name || 'Téléphone sans nom', Inventory_Number: item.otherserial || 'N/A', Location: item.locations_id || 'Non spécifié', glpiType: 'Phone' }));
      const allAssets = [...computers, ...monitors, ...phones];
      setItems(allAssets);
      localStorage.setItem('glpi_items', JSON.stringify(allAssets));
    } catch (error) {
      console.error("Erreur équipements GLPI :", error);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  const refreshTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const data = await ticketService.getAllTickets();
      const ticketsList = Array.isArray(data) ? data : [];
      const normalizedTickets = ticketsList.map(ticket => ({
        ...ticket,
        Type: Number(ticket.type ?? ticket.Type ?? 0),
        // Normalise le statut GLPI (1-6) vers nos 3 colonnes Kanban
        Status: ticket.Status && ['New', 'In_Progress', 'Closed'].includes(ticket.Status)
          ? ticket.Status
          : glpiStatusToKanban(ticket.status ?? ticket.Status),
      }));
      setTickets(normalizedTickets);
      localStorage.setItem('glpi_tickets', JSON.stringify(normalizedTickets));
    } catch (error) {
      console.error("Erreur tickets GLPI :", error);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    const savedItems = localStorage.getItem('glpi_items');
    const savedTickets = localStorage.getItem('glpi_tickets');
    const savedCosts = localStorage.getItem('glpi_costs');
    if (savedItems) setItems(JSON.parse(savedItems));
    if (savedTickets) setTickets(JSON.parse(savedTickets));
    if (savedCosts) setTicketCosts(JSON.parse(savedCosts));
    refreshAssets();
    refreshTickets();
  }, [refreshAssets, refreshTickets]);

  const addTicket = (ticket) => {
    setTickets(prev => {
      const updated = [...prev, {
        ...ticket,
        Type: Number(ticket.type ?? ticket.Type ?? 0),
        Status: ticket.Status || 'New',
        Ref_Ticket: `local-${Date.now()}`,
        Date: new Date().toLocaleDateString('fr-FR'),
        Heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }];
      localStorage.setItem('glpi_tickets', JSON.stringify(updated));
      return updated;
    });
  };

  // Met à jour le statut Kanban d'un ticket (local + localStorage)
  // Met à jour le statut sur GLPI puis rafraîchit la liste
  const updateTicketStatus = useCallback(async (ticketId, newKanbanStatus, comment = '') => {
    setLoadingTickets(true);
    try {
      // 1. Correspondance inverse : Statut Kanban -> ID Statut GLPI
      let glpiStatus = 1; // New
      if (newKanbanStatus === 'In_Progress') glpiStatus = 2; // En cours
      if (newKanbanStatus === 'Closed') glpiStatus = 6;      // Clos

      // 2. Préparation du payload pour GLPI
      const payload = {
        status: glpiStatus
      };

      // Si un commentaire de clôture est fourni, on l'ajoute comme contenu de solution ou dans le content
      if (comment && newKanbanStatus === 'Closed') {
        // Optionnel selon ta conf GLPI : tu peux aussi choisir de créer un ITILSolution,
        // mais pour faire simple et robuste, on peut l'ajouter aux remarques ou le passer au payload
        payload.comment = comment;
      }

      // 3. Appel de l'API via le service
      await ticketService.updateTicket(ticketId, payload);

      // 4. Re-clonage/Rafraîchissement depuis le serveur pour être sûr d'avoir les données à jour
      await refreshTickets();

    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut sur GLPI:", error);
      // Optionnel : tu peux lever une alerte UI ici
    } finally {
      setLoadingTickets(false);
    }
  }, [refreshTickets]);


  const importData = (newItems, newTickets, newCosts) => {
    if (newItems) { setItems(newItems); localStorage.setItem('glpi_items', JSON.stringify(newItems)); }
    if (newTickets) { setTickets(newTickets); localStorage.setItem('glpi_tickets', JSON.stringify(newTickets)); }
    if (newCosts) { setTicketCosts(newCosts); localStorage.setItem('glpi_costs', JSON.stringify(newCosts)); }
  };

  const resetData = () => {
    setItems([]); setTickets([]); setTicketCosts([]);
    localStorage.removeItem('glpi_items');
    localStorage.removeItem('glpi_tickets');
    localStorage.removeItem('glpi_costs');
  };

  return (
    <DataContext.Provider value={{
      items, tickets, ticketCosts,
      loadingAssets, loadingTickets,
      refreshAssets, refreshTickets,
      addTicket, updateTicketStatus,
      importData, resetData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);