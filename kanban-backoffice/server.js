const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ── TYPES DE MOUVEMENTS AUTORISÉS (table unique) ─────────────────────────────
// open   = réouverture (frais de réouverture)
// cancel = annulation (compense un mouvement 'close' précédent)
// close  = clôture (nouveau coût au moment de clore le ticket)
const MOUVEMENT_TYPES = ['open', 'cancel', 'close'];

// Petits helpers pour utiliser sqlite3 avec async/await
const dbGet = (sql, params) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const dbRun = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

// Un 'cancel' ne reçoit JAMAIS de montant depuis le client (ni via l'API, ni via l'import CSV) :
// on retrouve automatiquement le dernier mouvement 'close' du ticket et on insère une ligne
// compensatoire (montant négatif) qui l'annule, sans jamais supprimer l'historique.
async function cancelLastClose(ticketId) {
  const row = await dbGet(
    `SELECT amount FROM mouvements WHERE ticket_id = ? AND mouvement = 'close' ORDER BY created_at DESC LIMIT 1`,
    [ticketId]
  );
  if (!row) {
    throw new Error('Aucun coût de clôture trouvé pour ce ticket.');
  }
  const result = await dbRun(
    `INSERT INTO mouvements (ticket_id, mouvement, amount) VALUES (?, 'cancel', ?)`,
    [ticketId, -row.amount]
  );
  return result.lastID;
}

// Initialisation de la base de données SQLite (fichier local)
const db = new sqlite3.Database('./kanban_settings.sqlite', (err) => {
  if (err) {
    console.error('Erreur lors de la création de la base de données:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    initDatabase();
  }
});

// Création des tables (CONCEPTION CORRIGÉE : une seule table de mouvements)
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS mouvements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      mouvement TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => { if (err) console.error(err.message); });

  db.run(`
    CREATE TABLE IF NOT EXISTS kanban_settings (
      status TEXT PRIMARY KEY,
      color TEXT NOT NULL,
      labelMalgache TEXT NOT NULL
    )
  `, (err) => {
    if (err) return console.error(err.message);

    db.get(`SELECT COUNT(*) as count FROM kanban_settings`, [], (err, row) => {
      if (row && row.count === 0) {
        const insertStmt = db.prepare(`INSERT INTO kanban_settings (status, color, labelMalgache) VALUES (?, ?, ?)`);
        insertStmt.run('New', '#fee2e2', 'Vaovao');
        insertStmt.run('In_Progress', '#fef3c7', 'Efa manao');
        insertStmt.run('Closed', '#dcfce7', 'Vita');
        insertStmt.finalize();
        console.log('Configurations par défaut insérées.');
      }
    });
  });
}

// ── ROUTES API CONFIGURATIONS ────────────────────────────────────────────────

app.get('/api/kanban-settings', (req, res) => {
  db.all(`SELECT * FROM kanban_settings`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settingsObject = {};
    rows.forEach(row => {
      settingsObject[row.status] = { color: row.color, labelMalgache: row.labelMalgache };
    });
    res.json(settingsObject);
  });
});

app.post('/api/kanban-settings', (req, res) => {
  const settings = req.body;
  const stmt = db.prepare(`
    INSERT INTO kanban_settings (status, color, labelMalgache)
    VALUES (?, ?, ?)
    ON CONFLICT(status) DO UPDATE SET color = excluded.color, labelMalgache = excluded.labelMalgache
  `);
  try {
    Object.keys(settings).forEach(status => {
      stmt.run(status, settings[status].color, settings[status].labelMalgache);
    });
    stmt.finalize();
    res.json({ success: true, message: 'Configuration enregistrée avec succès.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── ROUTES : MOUVEMENTS (TABLE UNIQUE) ───────────────────────────────────────

// Enregistrement d'un mouvement unitaire (open / cancel / close)
app.post('/api/mouvements', async (req, res) => {
  const { ticket_id, mouvement, amount } = req.body;
  if (!ticket_id || !mouvement) {
    return res.status(400).json({ error: 'ticket_id et mouvement sont requis.' });
  }
  const type = mouvement.toLowerCase().trim();
  if (!MOUVEMENT_TYPES.includes(type)) {
    return res.status(400).json({ error: `mouvement invalide. Valeurs autorisées : ${MOUVEMENT_TYPES.join(', ')}.` });
  }

  try {
    // 'cancel' n'accepte pas de montant : il est toujours déduit du dernier 'close' du ticket.
    if (type === 'cancel') {
      const id = await cancelLastClose(ticket_id);
      return res.json({ success: true, id, message: 'Dernier coût de clôture annulé automatiquement.' });
    }

    const parsedAmount = parseFloat(amount) || 0;
    const result = await dbRun(
      `INSERT INTO mouvements (ticket_id, mouvement, amount) VALUES (?, ?, ?)`,
      [ticket_id, type, parsedAmount]
    );
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    res.status(err.message.includes('Aucun') ? 404 : 500).json({ error: err.message });
  }
});

// Import en masse (ex : import CSV depuis ImportTicket.jsx)
// Traitement SÉQUENTIEL : un 'cancel' doit pouvoir s'appuyer sur un 'close' inséré
// plus haut dans le même fichier.
// Import en masse (ex : import CSV depuis ImportTicket.jsx)
app.post('/api/mouvements/import', async (req, res) => {
  const { mouvement } = req.body;
  if (!mouvement || !Array.isArray(mouvement)) {
    return res.status(400).json({ error: 'mouvement doit être un tableau.' });
  }

  const rapport = [];

  for (const m of mouvement) {
    const type = (m.mouvement || '').toString().toLowerCase().trim();
    const ticketId = m.ticket_id;

    if (!ticketId || !MOUVEMENT_TYPES.includes(type)) {
      rapport.push({ ticket_id: ticketId, success: false, error: 'mouvement invalide ou ticket_id manquant.' });
      continue;
    }

    try {
      if (type === 'cancel') {
        // Aucun montant attendu : on annule automatiquement le dernier 'close' connu pour ce ticket.
        await cancelLastClose(ticketId);
        rapport.push({ ticket_id: ticketId, mouvement: type, success: true });
      }
      else if (type === 'open') {
        // ── LOGIQUE POUR LA RÉOUVERTURE EN POURCENTAGE ──
        const pourcentage = parseFloat(m.amount ?? m.valeur ?? 0) || 0;

        // Récupérer le dernier capital ('close') enregistré pour ce ticket
        const dernierClose = await dbGet(
          `SELECT amount FROM mouvements WHERE ticket_id = ? AND mouvement = 'close' ORDER BY created_at DESC LIMIT 1`,
          [ticketId]
        );

        let montantCalcule = 0;
        if (dernierClose) {
          // Calcul de la valeur à partir du pourcentage (ex: 15% de 100 = 15)
          montantCalcule = (parseFloat(dernierClose.amount) * pourcentage) / 100;
        } else {
          // Optionnel : Si aucun 'close' précédent n'est trouvé, vous pouvez soit lever une erreur, 
          // soit considérer le capital précédent à 0. Ici on choisit de lever une erreur.
          throw new Error(`Impossible de calculer la réouverture : aucun capital ('close') trouvé pour le ticket #${ticketId}.`);
        }

        await dbRun(
          `INSERT INTO mouvements (ticket_id, mouvement, amount) VALUES (?, 'open', ?)`,
          [ticketId, montantCalcule]
        );
        rapport.push({ ticket_id: ticketId, mouvement: type, success: true, message: `Inséré ${montantCalcule} (${pourcentage}%)` });
      }
      else {
        // Mouvement 'close' classique (montant direct) ✅
        const amount = parseFloat(m.amount ?? m.valeur ?? 0) || 0;

        // CORRECTION ICI : On utilise bien les points d'interrogation (?, ?, ?) et on passe les variables dans un tableau []
        await dbRun(
          `INSERT INTO mouvements (ticket_id, mouvement, amount) VALUES (?, ?, ?)`,
          [ticketId, type, amount]
        );
        rapport.push({ ticket_id: ticketId, mouvement: type, success: true });
      }
    } catch (err) {
      rapport.push({ ticket_id: ticketId, mouvement: type, success: false, error: err.message });
    }
  }

  res.json({ success: true, message: 'Mouvements importés avec succès.', rapport });
});

// Annulation du dernier coût de clôture d'un ticket.
// On n'efface jamais l'historique : on ajoute un mouvement 'cancel' qui compense le dernier 'close'.
app.post('/api/mouvements/cancel-last/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  try {
    const id = await cancelLastClose(ticketId);
    res.json({ success: true, message: 'Dernier coût de clôture annulé avec succès.', id });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Historique complet (tous types de mouvements confondus) d'un ticket
app.get('/api/mouvements/:ticketId', (req, res) => {
  const { ticketId } = req.params;
  db.all(
    `SELECT * FROM mouvements WHERE ticket_id = ? ORDER BY created_at DESC`,
    [ticketId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Détail + total des coûts de clôture ('close' + 'cancel' qui les compensent) pour un ticket
app.get('/api/mouvements/close/:ticketId', (req, res) => {
  const { ticketId } = req.params;
  db.all(
    `SELECT * FROM mouvements WHERE ticket_id = ? AND mouvement IN ('close', 'cancel') ORDER BY created_at DESC`,
    [ticketId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
      res.json({ items: rows, total });
    }
  );
});

// Détail + total des frais de réouverture ('open') pour un ticket
app.get('/api/mouvements/open/:ticketId', (req, res) => {
  const { ticketId } = req.params;
  db.all(
    `SELECT * FROM mouvements WHERE ticket_id = ? AND mouvement = 'open' ORDER BY created_at DESC`,
    [ticketId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
      res.json({ items: rows, total });
    }
  );
});

// Totaux ('close' + 'cancel') groupés par ticket — équivalent à l'ancien /api/ticket-costs
app.get('/api/mouvements/totals/close', (req, res) => {
  db.all(
    `SELECT ticket_id, SUM(amount) as total FROM mouvements WHERE mouvement IN ('close', 'cancel') GROUP BY ticket_id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const totals = {};
      rows.forEach(row => { totals[row.ticket_id] = parseFloat(row.total || 0); });
      res.json(totals);
    }
  );
});

// Totaux ('open') groupés par ticket — équivalent à l'ancien /api/ticket-frais
app.get('/api/mouvements/totals/open', (req, res) => {
  db.all(
    `SELECT ticket_id, SUM(amount) as total FROM mouvements WHERE mouvement = 'open' GROUP BY ticket_id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const totals = {};
      rows.forEach(row => { totals[row.ticket_id] = parseFloat(row.total || 0); });
      res.json(totals);
    }
  );
});

// Suppression d'une ligne précise (correction manuelle uniquement, à utiliser avec précaution)
app.delete('/api/mouvements/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM mouvements WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Aucune ligne trouvée.' });
    res.json({ success: true, message: `Mouvement #${id} supprimé.` });
  });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});