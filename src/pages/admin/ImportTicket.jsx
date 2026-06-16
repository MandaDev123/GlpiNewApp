import React, { useState } from 'react';
import { ticketService, normalizeMouvement } from '../../services/ticketService';

export default function ImportTicket() {
  const [resultat, setResultat] = useState("");

  // ── LA FONCTION MÉTIER (Source unique de vérité) ───────────────────────
  async function traiterEtEnvoyer(ticket, mouvement, valeur) {
    console.log("Envoi du mouvement vers l'API :", { ticket, mouvement, valeur });

    if (!ticket || !mouvement) {
      return `Ligne rejetée : colonnes manquantes.`;
    }

    // La base n'accepte que 3 valeurs canoniques : open / cancel / close.
    // On normalise les libellés libres du CSV (ex: "Réouverture", "Clôture"...) vers ces valeurs.
    const typeNormalise = normalizeMouvement(mouvement);
    if (!typeNormalise) {
      return `Ligne rejetée (ticket #${ticket}) : mouvement "${mouvement}" inconnu (attendu : open, cancel ou close).`;
    }

    // Un 'cancel' ne prend jamais de montant : le serveur retrouve seul le dernier coût de clôture.
    // Pour open/close, un montant valide est requis.
    let amount;
    if (typeNormalise !== 'cancel') {
      const parsedValeur = parseFloat(valeur);
      if (isNaN(parsedValeur)) {
        return `Ligne rejetée (ticket #${ticket}) : montant manquant ou invalide pour le mouvement "${typeNormalise}".`;
      }
      amount = parsedValeur;
    }

    try {
      // Préparation du payload sous forme de tableau attendu par l'API.
      // Pas de champ "amount" pour un cancel : il serait ignoré côté serveur de toute façon.
      const payload = [{
        ticket_id: ticket.trim(),
        mouvement: typeNormalise,
        ...(typeNormalise !== 'cancel' ? { amount } : {})
      }];

      // Appel de la méthode importTicket du service
      const res = await ticketService.importTicket(payload);
      // L'API renvoie un succès global même si une ligne individuelle échoue
      // (ex: 'cancel' sans 'close' préalable) ; le vrai statut est dans rapport[0].
      const ligne = res.rapport && res.rapport[0];

      if (ligne ? ligne.success : res.success) {
        return `Ticket #${ticket} [${mouvement}] -> Envoyé avec succès.`;
      } else {
        const errMsg = (ligne && ligne.error) || res.error || res.message || 'Erreur inconnue.';
        return `Ticket #${ticket} [${mouvement}] -> Échec de l'envoi : ${errMsg}`;
      }
    } catch (err) {
      return `Erreur réseau lors de l'envoi du ticket #${ticket} : ${err.message}`;
    }
  }

  // ── APPEL DEPUIS L'INTERFACE (Importation de fichier CSV) ────────────────
  function handleImport(event) {
    const fichier = event.target.files[0];
    if (!fichier) return;

    setResultat("Lecture et envoi du fichier en cours...");

    const lecteur = new FileReader();
    lecteur.onload = async (e) => {
      const contenuComplet = e.target.result.trim();
      const lignes = contenuComplet.split("\n");
      
      let comptesRendus = [];

      for (let i = 0; i < lignes.length; i++) {
        const ligneId = lignes[i].trim();
        
        // Sauter la ligne si elle est vide ou s'il s'agit de l'en-tête (ex: ticket_id,mouvement,amount)
        if (!ligneId || ligneId.toLowerCase().includes("mouvement") || ligneId.toLowerCase().includes("ticket_id")) {
          continue;
        }

        const [impA, impB, impC] = ligneId.split(",");
        const rLine = await traiterEtEnvoyer(impA, impB, impC);
        comptesRendus.push(rLine);
      }

      // Concatène les lignes de rapport pour un affichage propre dans l'UI
      setResultat(comptesRendus.join("\n"));
    };
    lecteur.readAsText(fichier);
  }

  // ── STRUCTURE DE L'INTERFACE UTILISATEUR ─────────────────────────────────
  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', color: '#1f2937', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px', fontWeight: 'semibold' }}>Importation par Fichier (CSV)</h2>        
        <input 
          type="file" 
          accept=".csv,.txt" 
          onChange={handleImport} 
          style={{ display: 'block', marginBottom: '12px' }} 
        />
        
        <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
          <p style={{ margin: 0 }}><strong>Résultat du traitement & API :</strong></p>
          <p style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap', fontStyle: 'italic', fontSize: '14px', color: '#1e40af' }}>
            {resultat || "Aucun fichier traité pour le moment."}
          </p>
        </div>
      </div>
    </div>
  );
} 