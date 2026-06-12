// src/services/itemService.js
import api, { initSession } from './glpiApi.js';

/**
 * Vérifie si un Session-Token est présent, sinon l'initialise.
 */
const ensureSession = async () => {
  if (!api.defaults.headers.common['Session-Token']) {
    console.log("Aucun token de session trouvé, initialisation en cours...");
    await initSession();
  }
};

export const itemService = {
  /**
   * Récupère tous les ordinateurs, moniteurs et téléphones
   * et les fusionne dans un seul tableau formaté pour l'UI.
   */
  getAllItems: async () => {
    await ensureSession();

    // Définition des endpoints à interroger
    const endpoints = [
      { type: 'computer', url: '/Computer/' },
      { type: 'monitor', url: '/Monitor/' },
      { type: 'phone', url: '/Phone/' }
    ];

    try {
      // Exécution de toutes les requêtes en parallèle
      const responses = await Promise.all(
        endpoints.map(async ({ type, url }) => {
          try {
            const res = await api.get(url, {
              params: {
                expand_dropdowns: true,
                range: '0-200' // Ajuste selon la taille de ton parc
              }
            });
            
            const rawData = Array.isArray(res.data) ? res.data : Object.values(res.data || {});
            
            // Formatage direct des données pour correspondre aux attentes de ton ItemList.jsx
            return rawData.map(item => ({
              id: item.id,
              glpiType: url.replace(/\//g, ''), // Stocke le type GLPI (Computer, Monitor...)
              Item_Type: type, // Utilisé pour les badges et filtres de ton UI
              Name: item.name,
              Inventory_Number: item.otherserial || item.serial || 'N/A',
              Status: item.states_id || 'En production',
              Manufacturer: item.manufacturers_id || 'Inconnu',
              Model: item.computermodels_id || item.monitormodels_id || item.phonemodels_id || '',
              Location: item.locations_id || 'Non assigné',
              User: item.users_id_tech || item.users_id || 'Non assigné'
            }));

          } catch (err) {
            // Interception de l'erreur 400 si la table (ex: Phone) est vide
            if (err.response && err.response.status === 400) {
              return [];
            }
            console.error(`Erreur lors du chargement des équipements de type ${type}:`, err);
            return [];
          }
        })
      );

      // Fusion des 3 tableaux en un seul tableau global
      return responses.flat();

    } catch (error) {
      console.error("Erreur globale lors de la récupération des équipements:", error);
      throw error;
    }
  }
};