import React, { useState } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip'; // <--- Ajout de JSZip
import { Upload, FileText, Image as ImageIcon, CheckCircle, Play, AlertCircle } from 'lucide-react';
import { 
  initSession, 
  importItemRow, 
  importTicketRow, 
  importCostRow, 
  findItemIdByName, // <--- Importé pour faire la correspondance des images
  uploadAndLinkImage // <--- Notre nouvelle fonction d'API
} from '../../services/glpiApi';

const ImportData = () => {
  const [status, setStatus] = useState({
    ticket: { loaded: false, data: [] }
  });

  const [importState, setImportState] = useState({
    isImporting: false,
    progress: 0,
    total: 0,
    logs: []
  });

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];

    // Traitement standard des CSV (inchangé)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t', '|'],
      transformHeader: header => header.trim(),
      complete: (results) => {
        let parsedData = results.data;
        if (type === 'tickets') {
          parsedData = parsedData.map(ticket => ({
            ...ticket,
            Items: ticket.Items ? JSON.parse(ticket.Items.replace(/'/g, '"')) : []
          }));
        }
        setStatus(prev => ({ ...prev, [type]: { loaded: true, data: parsedData } }));
      },
      error: (error) => {
        alert(`Erreur lors de la lecture du fichier: ${error.message}`);
      }
    });
  };

  const processImport = async () => {
    if (!status.items.loaded && !status.tickets.loaded && !status.costs.loaded && !status.images.loaded) {
      alert("Veuillez charger au moins un fichier avant d'importer.");
      return;
    }

    setImportState({ isImporting: true, progress: 0, total: totalLines, logs: [] });

    try {
      addLog("Initialisation de la session API GLPI...", "info");
      await initSession();
      addLog("Session GLPI authentifiée avec succès.", "success");

      let currentProgress = 0;

      // 1. Importer les Équipements (Items)
      if (status.items.loaded) {
        addLog(`Début de l'importation de ${status.items.data.length} équipements...`, "info");
        for (const item of status.items.data) {
          try {
            await importItemRow(item);
            addLog(`✅ Équipement importé : ${item.Name}`, "success");
          } catch (error) {
            addLog(`❌ Erreur équipement ${item.Name}: ${error.message}`, "error");
          }
          currentProgress++;
          setImportState(prev => ({ ...prev, progress: currentProgress }));
        }
      }

      // 2. NOUVEAU : Importer et lier les Images issues du ZIP
      if (status.images.loaded && imageFilesKeys.length > 0) {
        addLog(`Début du traitement de ${imageFilesKeys.length} images...`, "info");
        
        for (const fileName of imageFilesKeys) {
          try {
            // Extraction du nom de l'équipement (ex: "MN-FORM-002.png" -> "MN-FORM-002")
            const itemNameTarget = fileName.substring(0, fileName.lastIndexOf('.'));
            
            addLog(`Recherche de l'équipement exact pour l'image : "${itemNameTarget}"...`, "info");
            const itemObj = await findItemIdByName(itemNameTarget);

            if (itemObj) {
              const blob = status.images.files[fileName];
              // Envoi à GLPI
              await uploadAndLinkImage(blob, fileName, itemObj.itemtype, itemObj.id);
              addLog(`📸 Image '${fileName}' liée avec succès à l'équipement '${itemNameTarget}' (${itemObj.itemtype})`, "success");
            } else {
              addLog(`⚠️ Impossible d'importer l'image '${fileName}' : Équipement '${itemNameTarget}' introuvable dans GLPI.`, "warning");
            }
          } catch (error) {
            addLog(`❌ Erreur traitement image ${fileName}: ${error.message}`, "error");
          }
          currentProgress++;
          setImportState(prev => ({ ...prev, progress: currentProgress }));
        }
      }

      // 3. Importer les Tickets (inchangé)
      const ticketIdMap = {};
      if (status.tickets.loaded) {
        addLog(`Début de l'importation de ${status.tickets.data.length} tickets...`, "info");
        for (const ticket of status.tickets.data) {
          try {
            const result = await importTicketRow(ticket);
            ticketIdMap[ticket.Ref_Ticket] = result.id;
            addLog(`✅ Ticket importé : ${ticket.Titre} (ID GLPI: ${result.id})`, "success");
          } catch (error) {
            addLog(`❌ Erreur ticket ${ticket.Titre}: ${error.message}`, "error");
          }
          currentProgress++;
          setImportState(prev => ({ ...prev, progress: currentProgress }));
        }
      }

      // 4. Importer les Coûts (inchangé)
      if (status.costs.loaded) {
        addLog(`Début de l'importation de ${status.costs.data.length} coûts...`, "info");
        for (const cost of status.costs.data) {
          try {
            const glpiTicketId = ticketIdMap[cost.Num_Ticket];
            if (!glpiTicketId) {
              addLog(`⚠️ Impossible de lier le coût: le ticket ${cost.Num_Ticket} n'a pas été créé correctement.`, "warning");
            } else {
              await importCostRow(cost, glpiTicketId);
              addLog(`✅ Coût importé pour le ticket ${cost.Num_Ticket}`, "success");
            }
          } catch (error) {
            addLog(`❌ Erreur coût ticket ${cost.Num_Ticket}: ${error.message}`, "error");
          }
          currentProgress++;
          setImportState(prev => ({ ...prev, progress: currentProgress }));
        }
      }

      addLog("🎉 Importation terminée avec succès !", "success");

    } catch (err) {
      addLog(`🚨 Erreur critique : ${err.message}`, "error");
    } finally {
      setImportState(prev => ({ ...prev, isImporting: false }));
    }
  };

return (
    <div>
      <h1 style={{ marginBottom: '24px', fontSize: '24px' }}>Import</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Import ticket
      </p>

        {/* CSV Tickets */}
        <div className="glass-panel" style={{ border: status.tickets.loaded ? '1px solid var(--accent)' : '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FileText size={24} color={status.tickets.loaded ? 'var(--accent)' : 'var(--warning)'} />
            <h3 style={{ margin: 0, fontSize: '16px' }}>1. Tickets (CSV)</h3>
          </div>
          {status.tickets.loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '14px' }}><CheckCircle size={16} /> {status.tickets.data.length} lignes prêtes</div>
          ) : (
            <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'tickets')} style={{ fontSize: '14px', width: '100%' }} disabled={importState.isImporting} />
          )}
        </div>

      {/* Button & Progress (inchangé) */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <button
          className="btn btn-primary"
          onClick={processImport}
          style={{ padding: '12px 32px', fontSize: '16px' }}
          disabled={importState.isImporting || (!status.items.loaded && !status.tickets.loaded && !status.costs.loaded && !status.images.loaded)}
        >
          {importState.isImporting ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Play size={18} className="spin" /> Importation en cours...</span> : <span><Upload size={20} /> Démarrer l'intégration API GLPI</span>}
        </button>

        {importState.total > 0 && (
          <div style={{ marginTop: '20px', maxWidth: '600px', margin: '20px auto 0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span>Progression</span>
              <span>{importState.progress} / {importState.total}</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${(importState.progress / importState.total) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportData;