# 🚀 Guide de Création : Application React + SQLite + GLPI API

Pour réaliser cette application, il y a un principe technique très important à comprendre : **React s'exécute dans le navigateur (côté client), il ne peut donc pas se connecter directement à une base de données SQLite (qui est un fichier physique sur le serveur)**. 

Nous allons donc utiliser une architecture classique et robuste en **2 parties** :
1. **Un Backend léger (Node.js/Express)** : Il va gérer la base SQLite locale et communiquer avec l'API de GLPI (pour cacher les jetons d'authentification et éviter les problèmes de CORS).
2. **Un Frontend (React)** : L'interface visuelle ultra-rapide qui va consommer notre backend Node.js.

Voici toutes les étapes et commandes à exécuter pour mettre en place cette structure.

---

## 🛠️ Préparation de l'environnement

Avant de commencer, assurez-vous d'avoir installé **Node.js** sur votre machine Windows. (Vérifiez en tapant `node -v` et `npm -v` dans votre terminal).

Ouvrez un terminal (PowerShell ou Invite de commandes) et créez le dossier principal de votre projet :

```bash
mkdir glpi-react-app
cd glpi-react-app
```

---

## Étape 1 : Création du Backend (Node.js + SQLite)

Ce serveur va stocker nos données locales dans SQLite et servir de passerelle vers GLPI.

**1. Initialiser le projet Node.js :**
```bash
mkdir backend
cd backend
npm init -y
```

**2. Installer les dépendances nécessaires :**
- `express` : Pour créer notre serveur API.
- `sqlite3` : Pour gérer la base de données SQLite.
- `axios` : Pour faire des requêtes vers l'API de GLPI.
- `cors` : Pour autoriser React à communiquer avec notre serveur.

```bash
npm install express sqlite3 axios cors
```

**3. Créer le fichier principal du serveur (`server.js`) :**
Créez un fichier `server.js` dans le dossier `backend` et ajoutez-y ce code de base :

```javascript
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Initialisation de la base SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error("Erreur d'ouverture SQLite:", err.message);
    else console.log('Connecté à la base SQLite locale.');
});

// Création d'une table d'exemple si elle n'existe pas
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS local_assets (id INTEGER PRIMARY KEY, name TEXT, glpi_id INTEGER)");
});

// Exemple de Route API locale
app.get('/api/local-assets', (req, res) => {
    db.all("SELECT * FROM local_assets", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Port d'écoute
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Serveur Backend Node.js démarré sur http://localhost:${PORT}`);
});
```

---

## Étape 2 : Création du Frontend (React)

Nous allons utiliser **Vite**, qui est l'outil le plus moderne et le plus rapide pour générer une application React (bien meilleur que *Create React App*).

**1. Retourner à la racine du projet et générer React :**
```bash
cd ..
npm create vite@latest frontend -- --template react
```

**2. Entrer dans le dossier frontend et installer les dépendances par défaut :**
```bash
cd frontend
npm install
```

**3. Installer les librairies spécifiques pour notre projet React :**
- `axios` : Pour interroger notre backend Node.js.
- `react-router-dom` : Pour gérer la navigation entre les pages (si besoin).

```bash
npm install axios react-router-dom
```

**4. Créer un composant d'exemple pour tester la connexion SQLite :**
Remplacez le contenu de `frontend/src/App.jsx` par ceci :

```jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [localAssets, setLocalAssets] = useState([]);

  useEffect(() => {
    // On appelle notre propre Backend Node.js qui utilise SQLite
    axios.get('http://localhost:3001/api/local-assets')
      .then(response => {
        setLocalAssets(response.data);
      })
      .catch(error => {
        console.error("Erreur de connexion au backend SQLite :", error);
      });
  }, []);

  return (
    <div className="App">
      <h1>🚀 Interface React pour GLPI</h1>
      <h2>Données stockées dans SQLite localement :</h2>
      {localAssets.length === 0 ? (
        <p>Aucune donnée dans SQLite pour le moment.</p>
      ) : (
        <ul>
          {localAssets.map(asset => (
            <li key={asset.id}>{asset.name} (GLPI ID: {asset.glpi_id})</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
```

---

## Étape 3 : Lancement de l'environnement de développement

Pour travailler sur l'application, vous devez faire tourner les **deux serveurs en même temps**. Il vous faudra donc ouvrir 2 terminaux distincts.

**Terminal 1 : Lancer le Backend (Node.js + SQLite)**
```bash
cd glpi-react-app/backend
node server.js
```
*(Le terminal affichera : Connecté à la base SQLite locale. Serveur Backend Node.js démarré sur http://localhost:3001)*

**Terminal 2 : Lancer le Frontend (React + Vite)**
```bash
cd glpi-react-app/frontend
npm run dev
```
*(Le terminal vous donnera une adresse locale, généralement `http://localhost:5173`, que vous pourrez ouvrir dans votre navigateur).*

---

## Prochaines étapes

Une fois cette structure de base générée et fonctionnelle :
1. Nous pourrons configurer le **Backend (Node.js)** pour qu'il s'authentifie sur l'API de GLPI (via `/apirest.php/initSession`) et qu'il télécharge le catalogue des équipements pour les sauvegarder dans la base `database.sqlite`.
2. Nous mettrons en place les scripts SQL côté Backend pour la fameuse **réinitialisation de données** ciblée.
