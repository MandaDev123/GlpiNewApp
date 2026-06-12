// src/services/ticketService.js
import api, { initSession } from './glpiApi.js';

/**
 * Fonction utilitaire qui vérifie si un Session-Token est présent.
 * Si ce n'est pas le cas, elle initialise la session automatiquement.
 */
const ensureSession = async () => {
  if (!api.defaults.headers.common['Session-Token']) {
    console.log("Aucun token de session trouvé, initialisation en cours...");
    await initSession();
  }
};

/**
 * Convertisseur pour que les priorités de ton UI correspondent aux IDs de GLPI
 */
const parsePriority = (priorityStr) => {
  switch (priorityStr?.toLowerCase()) {
    case 'low': return 2;
    case 'medium': return 3;
    case 'high': return 4;
    case 'urgent': return 5;
    default: return 3;
  }
};

const parseStatus = (statusStr) => {
  switch (statusStr?.toLowerCase().trim()) {
    case 'nouveau':  return 1; // Nouveau
    case 'en cours': return 2; // En cours (Assigné)
    case 'clos':     return 6; // Clos
    default:         return 1;
  }
};

export const ticketService = {
  /**
   * Récupère tous les tickets avec les valeurs lisibles (expand_dropdowns)
   */
  getAllTickets: async () => {
    await ensureSession();
    
    try {
      const response = await api.get('/Ticket/', {
        params: {
          expand_dropdowns: true,
          range: '0-100'
          // On retire sort: 19 et order: 'DESC' pour le test
        }
      });
      return response.data;
    } catch (error) {
      // Afficher le VRAI message d'erreur caché renvoyé par GLPI
      if (error.response && error.response.data) {
        console.error("Détail de l'erreur renvoyée par GLPI :", error.response.data);
      } else {
        console.error("Erreur lors de la récupération des tickets :", error);
      }
      return [];
    }
  },

  /**
   * Récupère un ticket spécifique par son ID
   */
  getTicketById: async (id) => {
    await ensureSession();
    
    try {
      const response = await api.get(`/Ticket/${id}`, {
        params: { expand_dropdowns: true }
      });
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la récupération du ticket ${id}`, error);
      throw error;
    }
  },

  /**
   * Récupère les coûts associés à un ticket
   */
  getTicketCosts: async (ticketId) => {
    await ensureSession();
    
    try {
      const response = await api.get('/TicketCost/', {
        params: { searchText: { tickets_id: ticketId } }
      });
      return response.data;
    } catch (error) {
      // Tolérance : Si aucun coût n'existe, GLPI peut renvoyer 400
      if (error.response && error.response.status === 400) return [];
      console.error(`Erreur lors de la récupération des coûts du ticket ${ticketId}`, error);
      return [];
    }
  },

  /**
   * Récupère les équipements liés (Item_Ticket)
   */
  getTicketItems: async (ticketId) => {
    await ensureSession();
    
    try {
      const response = await api.get('/Item_Ticket/', {
        params: { 
          searchText: { tickets_id: ticketId },
          expand_dropdowns: true
        }
      });
      return response.data;
    } catch (error) {
      // Tolérance : Si aucun équipement lié n'existe
      if (error.response && error.response.status === 400) return [];
      console.error(`Erreur lors de la récupération des équipements du ticket ${ticketId}`, error);
      return [];
    }
  },

  

  /**
   * Crée un nouveau ticket et y associe des équipements (optionnel)
   */
createTicket: async (formData, selectedItems) => {
    await ensureSession();

    try {
      // Formatage de la date : conversion de "YYYY-MM-DDTHH:MM" vers "YYYY-MM-DD HH:MM:SS"
      let formattedDate = undefined;
      if (formData.Date) {
        formattedDate = formData.Date.replace('T', ' ');
        if (formattedDate.length === 16) {
          formattedDate += ':00'; 
        }
      }

      // 1. Préparation du payload pour le Ticket
      const ticketPayload = {
        input: {
          name: formData.Titre,
          content: formData.Description,
          status: parseStatus(formData.Status),
          type: formData.Type === 'Incident' ? 1 : 2,
          priority: parsePriority(formData.Priority),
          date: formattedDate
        }
      };

      console.log("Envoi du payload Ticket à GLPI :", ticketPayload);
      const ticketResponse = await api.post('/Ticket/', ticketPayload);
      const ticketId = ticketResponse.data.id;

      // 2. Association groupée de TOUS les équipements (Bulk insert)
      if (selectedItems && selectedItems.length > 0) {
        // GLPI accepte un tableau d'objets directement dans 'input'
        const itemsPayload = {
          input: selectedItems
            .filter(item => item.id && item.glpiType) // Sécurité
            .map(item => ({
              tickets_id: ticketId,
              itemtype: item.glpiType, // Doit être 'Computer', 'Monitor', 'Phone', etc.
              items_id: item.id
            }))
        };

        console.log("Envoi de l'association des équipements à GLPI :", itemsPayload);
        await api.post('/Item_Ticket/', itemsPayload);
      }

      return ticketId;
    } catch (error) {
      console.error("Erreur lors de la création du ticket ou de la liaison :", error);
      throw error;
    }
  },
  /**
   * Met à jour un ticket existant (ex: changement de statut ou ajout de solution)
   */
  updateTicket: async (ticketId, payload) => {
    await ensureSession();
    
    try {
      // GLPI utilise généralement un POST sur l'endpoint avec l'id dans le body input pour les updates,
      // ou un PUT selon la configuration. La norme GLPI REST officielle est un PUT /Ticket/:id
      const response = await api.put(`/Ticket/${ticketId}`, {
        input: {
          id: ticketId,
          ...payload
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du ticket ${ticketId} :`, error);
      throw error;
    }
  }
  
};