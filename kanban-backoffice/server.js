const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Initialisation de la base de données SQLite (fichier local)
const db = new sqlite3.Database('./kanban_settings.sqlite', (err) => {
  if (err) {
    console.error('Erreur lors de la création de la base de données:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    initDatabase();
  }
});

// Création de la table et insertion des valeurs par défaut si vide
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS kanban_settings (
      status TEXT PRIMARY KEY,
      color TEXT NOT NULL,
      labelMalgache TEXT NOT NULL
    )
  `, (err) => {
    if (err) return console.error(err.message);

    // Vérifier si la table est vide pour mettre les configurations initiales
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

// ── ROUTES API ──────────────────────────────────────────────────────────────

// GET : Récupérer les configurations
app.get('/api/kanban-settings', (req, res) => {
  db.all(`SELECT * FROM kanban_settings`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Transformer le tableau en objet indexé par statut pour correspondre au Front
    const settingsObject = {};
    rows.forEach(row => {
      settingsObject[row.status] = {
        color: row.color,
        labelMalgache: row.labelMalgache
      };
    });
    
    res.json(settingsObject);
  });
});

// POST : Sauvegarder les configurations
app.post('/api/kanban-settings', (req, res) => {
  const settings = req.body; // Attendu: { New: {...}, In_Progress: {...}, Closed: {...} }

  const stmt = db.prepare(`
    INSERT INTO kanban_settings (status, color, labelMalgache)
    VALUES (?, ?, ?)
    ON CONFLICT(status) DO UPDATE SET
      color = excluded.color,
      labelMalgache = excluded.labelMalgache
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

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});