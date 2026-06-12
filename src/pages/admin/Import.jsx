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
    items: { loaded: false, data: [] },
    tickets: { loaded: false, data: [] },
    costs: { loaded: false, data: [] },
    images: { loaded: false, files: {} } // <--- On va stocker un objet { "nom_image.png": Blob }
  });

  const [importState, setImportState] = useState({
    isImporting: false,
    progress: 0,
    total: 0,
    logs: []
  });

  const addLog = (message, type = 'info') => {
    setImportState(prev => ({
      ...prev,
      logs: [...prev.logs, { message, type, time: new Date().toLocaleTimeString() }]
    }));
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Traitement spécifique pour le fichier ZIP d'images
    if (type === 'images') {
      try {
        addLog("Lecture et extraction du fichier ZIP...", "info");
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        
        const extractedImages = {};
        let imageCount = 0;

        // On parcourt chaque élément du fichier ZIP
        for (const relativePath in loadedZip.files) {
          const zipEntry = loadedZip.files[relativePath];
          
          // On ignore les dossiers cachés (__MACOSX) et on ne prend que les formats images courants
          if (!zipEntry.dir && !relativePath.includes('__MACOSX') && /\.(png|jpg|jpeg|gif)$/i.test(relativePath)) {
            // Extraire uniquement le nom de fichier pur sans le chemin complet du dossier interne
            const fileName = relativePath.substring(relativePath.lastIndexOf('/') + 1);
            
            // Convertir le fichier en Blob exploitable par FormData
            const fileBlob = await zipEntry.async('blob');
            extractedImages[fileName] = fileBlob;
            imageCount++;
          }
        }

        setStatus(prev => ({ 
          ...prev, 
          images: { loaded: true, files: extractedImages } 
        }));
        
        addLog(`Le fichier ZIP a été traité. ${imageCount} image(s) prête(s) pour l'import.`, "success");
      } catch (err) {
        alert(`Erreur lors de la lecture du fichier ZIP: ${err.message}`);
        addLog(`❌ Erreur ZIP : ${err.message}`, "error");
      }
      return;
    }

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

    const imageFilesKeys = Object.keys(status.images.files || {});
    
    // Calcul du total en incluant le nombre d'images à traiter
    const totalLines = 
      status.items.data.length + 
      status.tickets.data.length + 
      status.costs.data.length + 
      imageFilesKeys.length;

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
      <h1 style={{ marginBottom: '24px', fontSize: '24px' }}>Importation de données vers GLPI (API)</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Chargez vos fichiers CSV et ZIP. L'algorithme se charge de faire l'association automatique de vos matériels, tickets, coûts et photos.
      </p>

      {/* Upload Zones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* CSV Équipements */}
        <div className="glass-panel" style={{ border: status.items.loaded ? '1px solid var(--accent)' : '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FileText size={24} color={status.items.loaded ? 'var(--accent)' : 'var(--primary)'} />
            <h3 style={{ margin: 0, fontSize: '16px' }}>1. Équipements (CSV)</h3>
          </div>
          {status.items.loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '14px' }}><CheckCircle size={16} /> {status.items.data.length} lignes prêtes</div>
          ) : (
            <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'items')} style={{ fontSize: '14px', width: '100%' }} disabled={importState.isImporting} />
          )}
        </div>

        {/* CSV Tickets */}
        <div className="glass-panel" style={{ border: status.tickets.loaded ? '1px solid var(--accent)' : '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FileText size={24} color={status.tickets.loaded ? 'var(--accent)' : 'var(--warning)'} />
            <h3 style={{ margin: 0, fontSize: '16px' }}>2. Tickets (CSV)</h3>
          </div>
          {status.tickets.loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '14px' }}><CheckCircle size={16} /> {status.tickets.data.length} lignes prêtes</div>
          ) : (
            <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'tickets')} style={{ fontSize: '14px', width: '100%' }} disabled={importState.isImporting} />
          )}
        </div>

        {/* CSV Costs */}
        <div className="glass-panel" style={{ border: status.costs.loaded ? '1px solid var(--accent)' : '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FileText size={24} color={status.costs.loaded ? 'var(--accent)' : 'var(--primary)'} />
            <h3 style={{ margin: 0, fontSize: '16px' }}>3. Coûts (CSV)</h3>
          </div>
          {status.costs.loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '14px' }}><CheckCircle size={16} /> {status.costs.data.length} lignes prêtes</div>
          ) : (
            <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'costs')} style={{ fontSize: '14px', width: '100%' }} disabled={importState.isImporting} />
          )}
        </div>

        {/* ZIP Images - MAINTENANCE EFFECTUÉE ICI */}
        <div className="glass-panel" style={{ border: status.images.loaded ? '1px solid var(--accent)' : '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <ImageIcon size={24} color={status.images.loaded ? 'var(--accent)' : '#ec4899'} />
            <h3 style={{ margin: 0, fontSize: '16px' }}>4. Images (ZIP)</h3>
          </div>
          {status.images.loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '14px' }}>
              <CheckCircle size={16} /> {Object.keys(status.images.files).length} image(s) extraite(s)
            </div>
          ) : (
            <input type="file" accept=".zip" onChange={(e) => handleFileUpload(e, 'images')} style={{ fontSize: '14px', width: '100%' }} disabled={importState.isImporting} />
          )}
        </div>
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

      {/* Logs Console (inchangé) */}
      {importState.logs.length > 0 && (
        <div className="glass-panel" style={{ background: '#000', fontFamily: 'monospace', maxHeight: '400px', overflowY: 'auto', textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #333', paddingBottom: '8px', color: '#fff' }}>Terminal d'Importation GLPI</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
            {importState.logs.map((log, idx) => {
              let color = '#ccc';
              if (log.type === 'error') color = '#ef4444';
              if (log.type === 'success') color = '#10b981';
              if (log.type === 'warning') color = '#f59e0b';

              return (
                <li key={idx} style={{ marginBottom: '6px', color, display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#666', minWidth: '70px' }}>[{log.time}]</span>
                  <span>{log.message}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImportData;