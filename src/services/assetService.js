// src/services/assetService.js
import api from './glpiApi.js';

export const assetService = {
  getAllAssets: async () => {
    try {
      // 1. Lancement des requêtes en parallèle pour gagner du temps
      const [computersRes, monitorsRes, phonesRes] = await Promise.all([
        api.get('/Computer/', { params: { expand_dropdowns: true, range: '0-50' } }).catch(() => ({ data: [] })),
        api.get('/Monitor/', { params: { expand_dropdowns: true, range: '0-50' } }).catch(() => ({ data: [] })),
        api.get('/Phone/', { params: { expand_dropdowns: true, range: '0-50' } }).catch(() => ({ data: [] }))
      ]);

      // 2. Normalisation et injection de 'glpiType' pour chaque catégorie
      const computers = (computersRes.data || []).map(item => ({
        id: item.id,
        Name: item.name || 'Ordinateur sans nom',
        Inventory_Number: item.itemtype_item_inventory_number || item.otherserial || 'N/A',
        Location: item.locations_id || 'Non spécifié',
        glpiType: 'Computer'
      }));

      const monitors = (monitorsRes.data || []).map(item => ({
        id: item.id,
        Name: item.name || 'Moniteur sans nom',
        Inventory_Number: item.otherserial || 'N/A',
        Location: item.locations_id || 'Non spécifié',
        glpiType: 'Monitor'
      }));

      const phones = (phonesRes.data || []).map(item => ({
        id: item.id,
        Name: item.name || 'Téléphone sans nom',
        Inventory_Number: item.otherserial || 'N/A',
        Location: item.locations_id || 'Non spécifié',
        glpiType: 'Phone'
      }));

      // 3. Fusion de tous les équipements dans un seul tableau
      return [...computers, ...monitors, ...phones];
    } catch (error) {
      console.error("Erreur lors de la récupération des équipements GLPI :", error);
      return [];
    }
  }
};