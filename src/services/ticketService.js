import api, { initSession } from './glpiApi.js';

const ensureSession = async () => {
  if (!api.defaults.headers.common['Session-Token']) {
    console.log("Aucun token de session trouvé, initialisation en cours...");
    await initSession();
  }
};

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
    case 'nouveau':  return 1;
    case 'en cours': return 2;
    case 'clos':     return 6;
    default:         return 1;
  }
};

const LOCAL_API_BASE = 'http://localhost:5000/api';

// ── TYPES DE MOUVEMENTS (table unique côté backend) ─────────────────────────
// open   = réouverture (frais de réouverture)
// cancel = annulation (compense un mouvement 'close' précédent)
// close  = clôture (nouveau coût)
export const MOUVEMENT_TYPES = {
  OPEN: 'open',
  CANCEL: 'cancel',
  CLOSE: 'close',
};

// Table de correspondance pour normaliser des libellés "humains" (FR/Malgache/variantes)
// vers les 3 valeurs canoniques attendues par la base.
const MOUVEMENT_ALIASES = {
  open: 'open',
  ouverture: 'open',
  reouverture: 'open',

  cancel: 'cancel',
  annulation: 'cancel',
  annule: 'cancel',

  close: 'close',
  cloture: 'close',
  fermeture: 'close',
  termine: 'close',
};

// Retire les accents et met en minuscule pour faciliter le matching
const stripAccents = (str) =>
  str.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Normalise une valeur de mouvement libre (venant d'un CSV par ex.) vers 'open' | 'cancel' | 'close'.
// Retourne null si la valeur ne correspond à aucun type connu.
export const normalizeMouvement = (value) => {
  if (!value) return null;
  const key = stripAccents(value);
  return MOUVEMENT_ALIASES[key] || null;
};

export const computeGlpiCostTotal = (costs) => {
  const list = Array.isArray(costs) ? costs : [];
  const totalTimeCost = list.reduce((sum, c) => {
    const durationMin = parseInt(c.actiontime || 0) / 60;
    const hourlyRate  = parseFloat(c.cost_time || 0);
    return sum + (durationMin / 60) * hourlyRate;
  }, 0);

  const totalFixedCost    = list.reduce((sum, c) => sum + parseFloat(c.cost_fixed || 0), 0);
  const totalMaterialCost = list.reduce((sum, c) => sum + parseFloat(c.cost_material || 0), 0);

  return totalTimeCost + totalFixedCost + totalMaterialCost;
};

export const ticketService = {
  getAllTickets: async () => {
    await ensureSession();
    try {
      const response = await api.get('/Ticket/', {
        params: { expand_dropdowns: true, range: '0-100' }
      });
      return response.data;
    } catch (error) {
      return [];
    }
  },

  getTicketById: async (id) => {
    await ensureSession();
    try {
      const response = await api.get(`/Ticket/${id}`, { params: { expand_dropdowns: true } });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getTicketCosts: async (ticketId) => {
    await ensureSession();
    try {
      const response = await api.get('/TicketCost/', { params: { searchText: { tickets_id: ticketId } } });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 400) return [];
      return [];
    }
  },

  getTicketItems: async (ticketId) => {
    await ensureSession();
    try {
      const response = await api.get('/Item_Ticket/', { params: { searchText: { tickets_id: ticketId }, expand_dropdowns: true } });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 400) return [];
      return [];
    }
  },

  createTicket: async (formData, selectedItems) => {
    await ensureSession();
    try {
      let formattedDate = undefined;
      if (formData.Date) {
        formattedDate = formData.Date.replace('T', ' ');
        if (formattedDate.length === 16) formattedDate += ':00';
      }

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

      const ticketResponse = await api.post('/Ticket/', ticketPayload);
      const ticketId = ticketResponse.data.id;

      if (selectedItems && selectedItems.length > 0) {
        const itemsPayload = {
          input: selectedItems
            .filter(item => item.id && item.glpiType)
            .map(item => ({
              tickets_id: ticketId,
              itemtype: item.glpiType,
              items_id: item.id
            }))
        };
        await api.post('/Item_Ticket/', itemsPayload);
      }
      return ticketId;
    } catch (error) {
      throw error;
    }
  },

  // Ajoute un coût local lié à la clôture du ticket (mouvement = 'close')
  addTicketCost: async (ticketId, amount) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/mouvements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, mouvement: MOUVEMENT_TYPES.CLOSE, amount })
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Annule le dernier coût de clôture (ajoute un mouvement 'cancel' compensatoire, sans rien supprimer)
  cancelLastCost: async (ticketId) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/mouvements/cancel-last/${ticketId}`, {
        method: 'POST'
      });
      return await response.json();
    } catch (error) {
      console.error("Erreur annulation coût:", error);
      throw error;
    }
  },

  // Récupère le dernier montant de clôture enregistré pour le pré-calcul (ignore les annulations)
  getLastCostAmount: async (ticketId) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/mouvements/close/${ticketId}`);
      const data = await response.json();
      const lastClose = (data.items || []).find(item => item.mouvement === MOUVEMENT_TYPES.CLOSE);
      return lastClose ? lastClose.amount : 0;
    } catch {
      return 0;
    }
  },

  // Détail + total des coûts de clôture ('close' + 'cancel') pour un ticket
  getLocalTicketCosts: async (ticketId) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/mouvements/close/${ticketId}`);
      return await response.json();
    } catch (error) {
      return { items: [], total: 0 };
    }
  },

  // Ajoute des frais de réouverture (mouvement = 'open')
  addTicketFrais: async (ticketId, amount) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/mouvements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, mouvement: MOUVEMENT_TYPES.OPEN, amount })
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Totaux ('close' + 'cancel') groupés par ticket, pour tous les tickets
  getAllLocalCostTotals: async () => {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/mouvements/totals/close`);
      return await response.json();
    } catch (error) {
      return {};
    }
  },

  // Totaux ('open') groupés par ticket, pour tous les tickets
  getAllLocalFraisTotals: async () => {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/mouvements/totals/open`);
      return await response.json();
    } catch (error) {
      return {};
    }
  },

  updateTicket: async (ticketId, payload) => {
    await ensureSession();
    try {
      const response = await api.put(`/Ticket/${ticketId}`, {
        input: { id: ticketId, ...payload }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Import en masse de mouvements (ex: depuis un CSV) — chaque mouvement doit déjà être normalisé
  // vers 'open' | 'cancel' | 'close' avant l'appel (voir normalizeMouvement).
  importTicket: async (mouvement) => {
    const response = await fetch(`${LOCAL_API_BASE}/mouvements/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mouvement })
    });
    return await response.json();
  },

  // Historique complet des mouvements (tous types) pour un ticket
  getTicketMouvement: async (ticketId) => {
    const response = await fetch(`${LOCAL_API_BASE}/mouvements/${ticketId}`);
    return await response.json();
  }
};