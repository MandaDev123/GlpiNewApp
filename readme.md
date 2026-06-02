# 🛠️ GLPI - Gestionnaire Libre de Parc Informatique

GLPI est une solution open-source de gestion de parc informatique (ITSM) et de gestion de services d'assistance (Service Desk). Il offre des fonctionnalités étendues pour aider les administrateurs informatiques à gérer efficacement les ressources matérielles, logicielles et les requêtes des utilisateurs.

## 🌟 Fonctionnalités Principales

- **Gestion des équipements (SACM)** : Suivi dynamique des ordinateurs, périphériques, imprimantes réseaux et composants associés. Intègre des outils d'inventaire natifs.
- **Service Desk / Assistance** : Gestion complète des incidents, problèmes et demandes des utilisateurs (compatible avec les bonnes pratiques ITIL).
- **Gestion des Changements** : Planification, révision et implémentation contrôlée des changements dans votre infrastructure informatique.
- **Base de Connaissances & FAQ** : Centralisation du savoir et des solutions pour faciliter le travail des techniciens et aider les utilisateurs finaux.
- **Gestion Financière et Contrats** : Suivi des licences logicielles, des contrats fournisseurs, des budgets, des amortissements et des garanties.
- **Réservation de Matériel** : Possibilité de planifier la réservation d'équipements par les utilisateurs.
- **DCIM (Data Center Infrastructure Management)** : Modélisation et gestion avancée de l'infrastructure des datacenters (baies, serveurs, PDU, etc.).

---

## ⚙️ Prérequis Système

Pour fonctionner, GLPI requiert un environnement de type LAMP/WAMP/XAMPP :
- **Serveur Web** : Apache, Nginx, ou IIS
- **Base de données** : MariaDB (>= 10.6) ou MySQL (>= 8.0)
- **PHP** : Version 8.2 ou supérieure
- **Extensions PHP obligatoires** : `dom`, `fileinfo`, `filter`, `libxml`, `simplexml`, `xmlreader`, `xmlwriter`, `bcmath`, `curl`, `gd`, `intl`, `mbstring`, `mysqli`, `openssl`, `zlib`.
- **Extensions PHP recommandées** : `bz2`, `phar`, `zip`, `exif`, `ldap`, `Zend OPcache`.

---

## 🚀 Guide d'Installation Rapide (Environnement XAMPP - Windows)

Puisque vous utilisez XAMPP pour héberger GLPI localement, voici les étapes de déploiement :

### 1. Préparation de XAMPP
1. Téléchargez et installez **XAMPP** (assurez-vous qu'il inclut PHP 8.2+).
2. Ouvrez le panneau de contrôle XAMPP et démarrez les modules **Apache** et **MySQL**.
3. Assurez-vous d'activer les extensions PHP nécessaires dans le fichier `C:\xampp\php\php.ini` (ex: `extension=intl`, `extension=gd`, `extension=ldap`, etc.). Redémarrez Apache après modification.

### 2. Déploiement de GLPI
1. Téléchargez la dernière archive de GLPI (ex: `11.0.x`) depuis [GitHub Releases](https://github.com/glpi-project/glpi/releases).
2. Extrayez l'archive dans le dossier `htdocs` de XAMPP (`C:\xampp\htdocs\glpi`).
3. **Important (Sécurité Web)** : Depuis GLPI 10+, le répertoire racine web doit pointer sur le dossier `public/`.
   - Modifiez la configuration de votre *VirtualHost* Apache (`C:\xampp\apache\conf\extra\httpd-vhosts.conf`) pour que `DocumentRoot` pointe sur `C:\xampp\htdocs\glpi\public`.
   - *Note : Un problème de chemins CSS (Erreur 403) peut survenir sous Windows à cause des antislashs (`\`). Ce bug de compilation SCSS peut être corrigé dans les fichiers `src/Html.php` et `FrontEndAssetsExtension.php`.*

### 3. Création de la Base de Données
1. Ouvrez **phpMyAdmin** (généralement via `http://localhost/phpmyadmin`).
2. Créez une nouvelle base de données nommée par exemple `glpi`.
3. Créez un utilisateur spécifique avec tous les privilèges sur cette base de données.

### 4. Assistant d'Installation
1. Ouvrez votre navigateur et allez sur `http://localhost/glpi/public/` (ou votre domaine configuré).
2. Sélectionnez la langue et acceptez la licence.
3. Cliquez sur **Installer**.
4. L'assistant vérifiera vos prérequis PHP. S'il manque des extensions, activez-les dans le `php.ini`.
5. Renseignez les paramètres de connexion à la base de données (Serveur: `localhost`, Utilisateur, Mot de passe, et sélectionnez la base `glpi`).
6. L'installation initialise la base de données.

### 5. Identifiants par Défaut
Après l'installation, GLPI fournit plusieurs comptes par défaut qu'il est impératif de modifier pour des raisons de sécurité :
- Administrateur système : `glpi` / `glpi`
- Technicien : `tech` / `tech`
- Utilisateur standard : `normal` / `normal`
- Profil "Only post" (Helpdesk) : `post-only` / `postonly`

---

## 🔒 Sécurité Post-Installation

Une fois GLPI installé, n'oubliez pas d'effectuer ces actions critiques :
1. **Supprimez le fichier d'installation** : Allez dans le répertoire `install/` et supprimez ou renommez le fichier `install.php`.
2. **Modifiez les mots de passe** des 4 comptes par défaut cités ci-dessus.
3. Sécurisez vos répertoires `files` et `config` si vous n'utilisez pas de VirtualHost pointant vers `public/`.

---

## 🔗 Ressources et Documentation

- **Site Web Officiel** : [glpi-project.org](http://glpi-project.org)
- **Démonstration en Ligne** : [glpi-network.cloud](https://www.glpi-network.cloud)
- **Documentation Utilisateur / Administrateur** : [readthedocs.io](https://glpi-user-documentation.readthedocs.io)
- **Signaler un bug / Code Source** : [GitHub GLPI](https://github.com/glpi-project/glpi)
- **Catalogue de Plugins** : [plugins.glpi-project.org](http://plugins.glpi-project.org)

---
*Ce document est un guide de référence personnalisé généré pour votre environnement local.*
