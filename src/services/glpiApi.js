import axios from 'axios';

// Instance axios configurée pour pointer vers le proxy PHP local
const api = axios.create({
  baseURL: 'http://localhost/glpi/api_proxy.php',
  headers: {
    'Content-Type': 'application/json',
    'App-Token': 'olNWQBXR6Y1CkhKKXbkoAeWUZj6kHGibm63KYd69'
  }
});

let sessionToken = null;

// Cache en mémoire pour éviter de créer des doublons et de multiplier les requêtes
const dropdownCache = {
  Location: {},
  Manufacturer: {},
  ComputerModel: {},
  ComputerType: {},
  MonitorModel: {},
  MonitorType: {},
  PhoneModel: {},
  PhoneType: {},
  State: {},
  User: {}
};

// ─── Map extensible des types d'équipements ───────────────────────────────────
// Pour ajouter un nouveau type (ex: Printer), ajouter une entrée ici.
// glpiType    : nom du endpoint GLPI (/Computer/, /Monitor/, /Phone/, ...)
// modelKey    : clé du payload pour l'ID du modèle
// typeKey     : clé du payload pour l'ID du type
// modelCache  : clé dans dropdownCache pour les modèles
// typeCache   : clé dans dropdownCache pour les types
const ITEM_TYPE_MAP = {
  computer: {
    glpiType:   'Computer',
    modelKey:   'computermodels_id',
    typeKey:    'computertypes_id',
    modelCache: 'ComputerModel',
    typeCache:  'ComputerType',
  },
  monitor: {
    glpiType:   'Monitor',
    modelKey:   'monitormodels_id',
    typeKey:    'monitortypes_id',
    modelCache: 'MonitorModel',
    typeCache:  'MonitorType',
  },
  phone: {
    glpiType:   'Phone',
    modelKey:   'phonemodels_id',
    typeKey:    'phonetypes_id',
    modelCache: 'PhoneModel',
    typeCache:  'PhoneType',
  },
};

// Fallback si le type n'est pas reconnu
const DEFAULT_TYPE_CONFIG = ITEM_TYPE_MAP.computer;

// Configurez vos identifiants GLPI ici (si différents des valeurs par défaut)
const GLPI_USERNAME = 'glpi';
const GLPI_PASSWORD = 'admin';

/**
 * Initialise la session avec GLPI
 */
export const initSession = async () => {
  // Réinitialiser le cache et la session à chaque import
  Object.keys(dropdownCache).forEach(k => { dropdownCache[k] = {}; });
  sessionToken = null;

  try {
    // On passe les identifiants en "params" (Query String) plutôt qu'en Headers
    const response = await api.get('/initSession/', {
      params: {
        login: GLPI_USERNAME,
        password: GLPI_PASSWORD
      }
    });
    
    sessionToken = response.data.session_token;
    api.defaults.headers.common['Session-Token'] = sessionToken;
    return sessionToken;
  } catch (error) {
    console.error("Erreur initSession:", error);
    throw new Error("Impossible de se connecter à l'API GLPI.");
  }
};

/**
 * Cherche un élément par nom ou le crée s'il n'existe pas.
 */
export const getOrCreateDropdown = async (itemtype, name) => {
  if (name === undefined || name === null || String(name).trim() === '') {
    return 0;
  }

  const cleanName = String(name).trim();

  // Vérification cache
  if (
    dropdownCache[itemtype] &&
    dropdownCache[itemtype][cleanName] !== undefined
  ) {
    return dropdownCache[itemtype][cleanName];
  }

  const extractIdFromSearch = (data) => {
    if (!data || data.totalcount === 0) return null;

    const rawData = data.data;
    if (!rawData) return null;

    const rows = Array.isArray(rawData)
      ? rawData
      : Object.values(rawData);

    if (rows.length === 0) return null;

    const row = rows[0];

    const id = parseInt(
      row[2] ??
      row['2'] ??
      row.id ??
      0,
      10
    );

    return id > 0 ? id : null;
  };

  // Recherche exacte
  try {
    const searchResponse = await api.get(`/search/${itemtype}`, {
      params: {
        'criteria[0][field]': 1,
        'criteria[0][searchtype]': 'equals',
        'criteria[0][value]': cleanName,
        'forcedisplay[0]': 2,
        'range': '0-1'
      }
    });

    const foundId = extractIdFromSearch(searchResponse.data);

    if (foundId) {
      if (!dropdownCache[itemtype]) {
        dropdownCache[itemtype] = {};
      }

      dropdownCache[itemtype][cleanName] = foundId;

      console.log(
        `[FOUND] ${itemtype} '${cleanName}' => ${foundId}`
      );

      return foundId;
    }
  } catch (err) {
    console.warn(
      `[SEARCH ERROR] ${itemtype} '${cleanName}'`,
      err.response?.data || err.message
    );
  }

  // Création
  try {
    console.log(
      `[CREATE] ${itemtype} '${cleanName}'`
    );

    const createResponse = await api.post(
      `/${itemtype}/`,
      {
        input: {
          name: cleanName
        }
      }
    );

    console.log(
      `[CREATE RESPONSE]`,
      createResponse.data
    );

    let newId =
      createResponse.data?.id ||
      createResponse.data?.ID;

    if (
      !newId &&
      Array.isArray(createResponse.data)
    ) {
      newId = createResponse.data[0]?.id;
    }

    if (newId) {
      newId = parseInt(newId, 10);

      if (!dropdownCache[itemtype]) {
        dropdownCache[itemtype] = {};
      }

      dropdownCache[itemtype][cleanName] = newId;

      console.log(
        `[CREATED] ${itemtype} '${cleanName}' => ${newId}`
      );

      return newId;
    }
  } catch (err) {
    console.warn(
      `[CREATE FAILED] ${itemtype} '${cleanName}'`,
      err.response?.data || err.message
    );
  }

  // Fallback recherche large
  try {
    const fallbackResponse = await api.get(
      `/search/${itemtype}`,
      {
        params: {
          'searchText[name]': cleanName,
          'forcedisplay[0]': 2,
          'range': '0-50'
        }
      }
    );

    const rows = Array.isArray(fallbackResponse.data?.data)
      ? fallbackResponse.data.data
      : Object.values(fallbackResponse.data?.data || {});

    for (const row of rows) {
      const id = parseInt(
        row[2] ??
        row['2'] ??
        row.id ??
        0,
        10
      );

      const rowName =
        row[1] ??
        row['1'] ??
        row.name ??
        '';

      if (
        id > 0 &&
        String(rowName).trim().toLowerCase() ===
          cleanName.toLowerCase()
      ) {
        if (!dropdownCache[itemtype]) {
          dropdownCache[itemtype] = {};
        }

        dropdownCache[itemtype][cleanName] = id;

        console.log(
          `[FALLBACK FOUND] ${itemtype} '${cleanName}' => ${id}`
        );

        return id;
      }
    }
  } catch (err) {
    console.error(
      `[FALLBACK ERROR] ${itemtype} '${cleanName}'`,
      err.response?.data || err.message
    );
  }

  console.error(
    `[NOT FOUND] ${itemtype} '${cleanName}'`
  );

  return 0;
};

/**
 * Utilisateurs: Nom Complet "Nom Prénom"
 */
export const getOrCreateUser = async (fullName) => {
  if (!fullName) return 0;
  fullName = fullName.trim();
  const itemtype = 'User';

  if (dropdownCache[itemtype][fullName]) return dropdownCache[itemtype][fullName];

  try {
    const searchResponse = await api.get(`/search/User`, {
      params: {
        'criteria[0][field]': 9,
        'criteria[0][searchtype]': 'contains',
        'criteria[0][value]': fullName.split(' ')[0],
        'forcedisplay[0]': 2
      }
    });

    if (searchResponse.data.totalcount > 0) {
      const foundId = searchResponse.data.data[0][2];
      dropdownCache[itemtype][fullName] = foundId;
      return foundId;
    }
  } catch (err) { }

  // Create User
  try {
    const names = fullName.split(' ');
    const firstname = names.shift();
    const lastname = names.join(' ');

    const payload = {
      input: {
        name: firstname.toLowerCase() + '.' + (lastname ? lastname.toLowerCase().replace(/ /g, '') : 'user'),
        firstname: firstname,
        realname: lastname || '',
        is_active: 1
      }
    };
    const createResponse = await api.post(`/User/`, payload);
    const newId = createResponse.data.id;
    dropdownCache[itemtype][fullName] = newId;
    return newId;
  } catch (err) {
    return 0;
  }
};

/**
 * Créer ou mettre à jour un équipement complet en résolvant toutes ses dépendances.
 * Supporte Computer, Monitor, Phone — et tout type ajouté dans ITEM_TYPE_MAP.
 */
export const importItemRow = async (row) => {
  try {
    if (!row.Name) {
      throw new Error(`La colonne 'Name' est vide ou introuvable. Colonnes détectées: ${Object.keys(row).join(', ')}`);
    }

    // Résolution du type via ITEM_TYPE_MAP
    const typeKey = row.Item_Type?.toLowerCase().trim();
    const typeConfig = ITEM_TYPE_MAP[typeKey] || DEFAULT_TYPE_CONFIG;
    const { glpiType, modelKey, typeKey: typePayloadKey, modelCache, typeCache } = typeConfig;

    // Résolution de tous les IDs de dépendances
    const states_id       = await getOrCreateDropdown('State',       row.Status);
    const locations_id    = await getOrCreateDropdown('Location',    row.Location);
    const manufacturers_id = await getOrCreateDropdown('Manufacturer', row.Manufacturer);
    const models_id       = await getOrCreateDropdown(modelCache,    row.Model);
    const types_id        = await getOrCreateDropdown(typeCache,     row.Item_Type);
    const users_id        = await getOrCreateUser(row.User);

    const payload = {
      input: {
        name:            row.Name,
        otherserial:     row.Inventory_Number,
        states_id,
        locations_id,
        manufacturers_id,
        [modelKey]:      models_id,
        [typePayloadKey]: types_id,
        users_id_tech:   users_id,
      }
    };

    // Chercher si l'équipement existe déjà par son nom
    const searchReq = await api.get(`/search/${glpiType}`, {
      params: {
        'criteria[0][field]': 1,
        'criteria[0][searchtype]': 'equals',
        'criteria[0][value]': row.Name,
        'forcedisplay[0]': 2
      }
    });

    if (searchReq.data.totalcount > 0) {
      // Mise à jour
      const idToUpdate = searchReq.data.data[0][2];
      await api.put(`/${glpiType}/${idToUpdate}`, { input: { id: idToUpdate, ...payload.input } });
      return { status: 'updated', id: idToUpdate, type: glpiType };
    } else {
      // Création
      const res = await api.post(`/${glpiType}/`, payload);
      return { status: 'created', id: res.data.id, type: glpiType };
    }
  } catch (err) {
    throw new Error(`Erreur lors de l'import de ${row.Name}: ${err.message}`);
  }
};

/**
 * Cherche un Item par son nom exact parmi tous les types connus.
 * Utilise ITEM_TYPE_MAP pour être exhaustif.
 */
/**
 * Recherche un équipement par son nom exact dans GLPI (sans distinction de casse)
 * Parcourt les ordinateurs, moniteurs et téléphones.
 */
export const findItemIdByName = async (name) => {
  if (!name) return null;
  
  const typesToSearch = ['Computer', 'Monitor', 'Phone'];
  const cleanName = name.trim().toLowerCase();

  for (const itemtype of typesToSearch) {
    try {
      // On récupère une plage large pour couvrir tout le parc importé
      const response = await api.get(`/${itemtype}/`, {
        params: { range: '0-300' }
      });

      const items = response.data || [];
      // Recherche textuelle exacte et sécurisée
      const foundItem = items.find(item => 
        item.name && item.name.trim().toLowerCase() === cleanName
      );

      if (foundItem) {
        return {
          id: foundItem.id,
          itemtype: itemtype
        };
      }
    } catch (err) {
      // Si la table est vide ou inaccessible, on passe au type suivant
      if (err.response?.status !== 400) {
        console.warn(`[RECHERCHE] Pas de résultats dans /${itemtype}/ pour "${name}"`);
      }
    }
  }
  
  return null; // Aucun équipement trouvé nulle part
};

/**
 * Convertir priorité texte en chiffre (1-5)
 */
const parsePriority = (priorityStr) => {
  switch (priorityStr?.toLowerCase()) {
    case 'low':    return 2;
    case 'medium': return 3;
    case 'high':   return 4;
    case 'urgent': return 5;
    default:       return 3;
  }
};

/**
 * Convertir status texte en id GLPI
 */
const parseTicketStatus = (statusStr) => {
  switch (statusStr?.toLowerCase()) {
    case 'new': return 1;
    case 'In progress (assigned)': return 2;
    case 'solved': return 5;
    case 'closed': return 6;
    default: return 1;
  }
};

/**
 * Extrait et formate une date brute "DD/MM/YYYYHH:mm" en "YYYY-MM-DD HH:mm:ss"
 */
/**
 * Combine et formate une date "DD/MM/YYYY" et une heure "HH:mm" en "YYYY-MM-DD HH:mm:ss"
 */
const parseCsvDate = (dateStr, timeStr) => {
  if (!dateStr) return null;

  // Extraction du jour, mois et année
  const dateMatch = String(dateStr).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dateMatch) return null;

  const [_, day, month, year] = dateMatch;

  // Valeurs par défaut pour l'heure si la colonne est vide
  let hour = '00';
  let minute = '00';

  // Si une heure est fournie dans le CSV, on l'extrait
  if (timeStr) {
    const timeMatch = String(timeStr).match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      hour = timeMatch[1];
      minute = timeMatch[2];
    }
  }

  // Retourne le format exact attendu par GLPI
  return `${year}-${month}-${day} ${hour}:${minute}:00`;
};

/**
 * Importer un ticket et le lier aux équipements
 */
/**
 * Importer un ticket et le lier aux équipements
 */
export const importTicketRow = async (row) => {
  try {
    // 1. Extraction et formatage en combinant la colonne Date et la colonne Heure
    const openingDate = parseCsvDate(row.Date, row.Heure);

    // DEBUG : Vérifiez dans votre console que la fusion s'est bien passée
    console.log(`[DEBUG Date] Date: "${row.Date}" | Heure: "${row.Heure}" -> Parsée: "${openingDate}"`);

    const payload = {
      input: {
        name:     row.Titre,
        content:  row.Description,
        priority: parsePriority(row.Priority),
        status:   parseTicketStatus(row.Status),
        type:     row.Type?.toLowerCase() === 'incident' ? 1 : 2, // 1: Incident, 2: Request
      }
    };

    let ticketId = null;
    
    // Recherche si le ticket existe déjà
    const searchReq = await api.get(`/search/Ticket`, {
      params: {
        'criteria[0][field]': 1,
        'criteria[0][searchtype]': 'equals',
        'criteria[0][value]': row.Titre,
        'forcedisplay[0]': 2
      }
    });

    if (searchReq.data.totalcount > 0) {
      // --- CAS 1 : MISE À JOUR ---
      ticketId = searchReq.data.data[0][2];
      
      if (openingDate) {
        payload.input.date = openingDate;
        // Sur certaines versions de GLPI, la date de création interne s'appelle date_creation
        payload.input.date_creation = openingDate; 
      }
      
      await api.put(`/Ticket/${ticketId}`, { input: { id: ticketId, ...payload.input } });
      
    } else {
      // --- CAS 2 : CRÉATION ---
      const res = await api.post(`/Ticket/`, payload);
      ticketId = res.data.id;

      // CONTOURNEMENT GLPI : On force la date via un PUT juste après la création
      if (openingDate) {
        await api.put(`/Ticket/${ticketId}`, {
          input: {
            id: ticketId,
            date: openingDate,
            date_creation: openingDate
          }
        });
      }
    }

    // Lier les équipements (Computer, Monitor, Phone, ...)
    let itemsArray = [];
    
    if (row.Items) {
      // 1. On nettoie brutalement la chaîne : on supprime tous les crochets, guillemets simples et doubles.
      // Ainsi, '["PC-ADM-001", "MN-FORM-002"]' devient simplement 'PC-ADM-001, MN-FORM-002'
      const cleanedString = String(row.Items).replace(/[\[\]"']/g, '');
      
      // 2. On découpe en fonction des virgules, on enlève les espaces superflus et on supprime les vides
      itemsArray = cleanedString.split(',').map(item => item.trim()).filter(Boolean);
    }

    if (itemsArray.length > 0) {
      for (const itemName of itemsArray) {
        // Une dernière sécurité pour s'assurer que le nom est parfait
        const safeItemName = itemName.trim();
        
        console.log(`[DEBUG] Recherche de l'équipement exact : "${safeItemName}"`);
        
        const itemObj = await findItemIdByName(safeItemName);
        
        if (itemObj) {
          try {
            await api.post(`/Item_Ticket/`, {
              input: {
                tickets_id: ticketId,
                itemtype:   itemObj.itemtype,
                items_id:   itemObj.id
              }
            });
            console.log(`[SUCCESS] Équipement "${safeItemName}" lié au ticket ${ticketId}`);
          } catch (e) {
             console.warn(`[WARNING] Lien déjà existant ou erreur pour "${safeItemName}":`, e.message);
          }
        } else {
          console.warn(`[NOT FOUND] L'équipement "${safeItemName}" n'a pas été trouvé dans GLPI.`);
        }
      }
    }

    return { status: 'success', id: ticketId };
  } catch (err) {
    throw new Error(`Erreur lors de l'import du ticket ${row.Titre}: ${err.message}`);
  }
};

/**
 * Import d'un coût de ticket
 */
export const importCostRow = async (row, ticketInternalId) => {
  try {
    const payload = {
      input: {
        tickets_id:  ticketInternalId,
        cost_time:   parseFloat((row.Time_Cost || 0).replace(",",".")),
        cost_fixed:  parseFloat((row.Fixed_Cost || 0).replace(",",".")),
        actiontime:  parseInt(row.Duration_second || 0),
        name:        "Import CSV Cost"
      }
    };
    await api.post(`/TicketCost/`, payload);
  } catch (err) {
    throw new Error(`Erreur lors de l'import du coût: ${err.message}`);
  }
};

/**
 * Récupère tous les IDs d'un type d'item dans GLPI via l'API search.
 * Retourne un tableau d'IDs [1, 2, 3, ...].
 */
export const getAllItemIds = async (itemtype) => {
  const ids = [];
  try {
    const res = await api.get(`/search/${itemtype}`, {
      params: {
        'forcedisplay[0]': 2,
        'range': '0-9999'
      }
    });
    if (res.data && res.data.data) {
      const dataArr = Array.isArray(res.data.data)
        ? res.data.data
        : Object.values(res.data.data);
      for (const item of dataArr) {
        const id = item[2] || item['2'];
        if (id) ids.push(id);
      }
    }
  } catch (err) {
    // 400 = pas de résultats (table vide), c'est normal
    if (err.response?.status !== 400) {
      console.warn(`Erreur recherche ${itemtype}:`, err);
    }
  }
  return ids;
};

/**
 * Supprime massivement des items par type via DELETE avec force_purge.
 * Envoie par lots de 50 pour éviter les timeouts.
 */
export const bulkDeleteItems = async (itemtype, ids, onProgress) => {
  const BATCH_SIZE = 50;
  let deleted = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const inputPayload = batch.map(id => ({ id }));

    try {
      await api.delete(`/${itemtype}/`, {
        data: { input: inputPayload, force_purge: true }
      });
      deleted += batch.length;
    } catch (err) {
      console.error(`Erreur suppression ${itemtype} batch ${i}:`, err);
      // Tentative individuelle si le batch échoue
      for (const id of batch) {
        try {
          await api.delete(`/${itemtype}/${id}`, {
            params: { force_purge: true }
          });
          deleted++;
        } catch (e) {
          console.error(`Impossible de supprimer ${itemtype}/${id}:`, e);
        }
      }
    }

    if (onProgress) onProgress(deleted);
  }

  return deleted;
};

/**
 * Retourne tous les types GLPI connus (utile pour Reset, etc.)
 */
export const getAllGlpiTypes = () =>
  Object.values(ITEM_TYPE_MAP).map(c => c.glpiType);

/**
 * Téléverse un Blob d'image dans GLPI en tant que Document et le lie à un équipement
 * @param {Blob} imageBlob - Le fichier image extrait du zip
 * @param {string} fileName - Le nom du fichier (ex: MN-FORM-002.png)
 * @param {string} itemtype - Le type d'équipement GLPI (Computer, Monitor, Phone)
 * @param {number} items_id - L'ID de l'équipement dans GLPI
 */
export const uploadAndLinkImage = async (imageBlob, fileName, itemtype, items_id) => {
  try {
    // 1. Préparation du FormData pour envoyer le fichier binaire à GLPI
    const formData = new FormData();
    
    // Structure standard attendue par l'API GLPI pour l'ajout de document
    formData.append('uploadManifest', JSON.stringify({
      input: {
        name: `Image ${fileName}`,
        comment: "Importé automatiquement depuis le package ZIP"
      }
    }));
    
    // 'filename[]' est le nom du champ de fichier requis par l'API GLPI
    formData.append('filename[]', imageBlob, fileName);

    // Envoi du document à GLPI
    const docResponse = await api.post('/Document/', formData, {
      headers: {
        // Obligatoire pour envoyer un fichier (Axios gère le boundary automatiquement)
        'Content-Type': 'multipart/form-data'
      }
    });

    const documentId = docResponse.data?.id;
    if (!documentId) {
      throw new Error("L'API GLPI n'a pas retourné d'ID pour le document créé.");
    }

    console.log(`[DOCUMENT] Image '${fileName}' téléversée avec succès (ID Document: ${documentId})`);

    // 2. Création de la liaison Document <-> Équipement (Item_Project / Document_Item)
    await api.post('/Document_Item/', {
      input: {
        documents_id: documentId,
        itemtype: itemtype,
        items_id: items_id
      }
    });

    console.log(`[LINK SUCCESS] Document ${documentId} lié à l'élément ${itemtype} (ID: ${items_id})`);
    return true;
  } catch (err) {
    throw new Error(`Échec du téléversement/liaison de l'image ${fileName}: ${err.response?.data || err.message}`);
  }
};

export default api;