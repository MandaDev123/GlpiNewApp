import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader, DollarSign } from 'lucide-react';
import { ticketService, computeGlpiCostTotal } from '../../services/ticketService';

const ELEMENT_LABELS = {
  Computer: 'Ordinateurs',
  Monitor: 'Moniteurs',
  Printer: 'Imprimantes',
  Phone: 'Téléphones',
  NetworkEquipment: 'Équipements réseau',
  Peripheral: 'Périphériques',
  Software: 'Logiciels',
};

const labelFor = (itemtype) => ELEMENT_LABELS[itemtype] || itemtype || 'Non assigné';

const CostsSummary = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [grandTotals, setGrandTotals] = useState({ existing: 0, nouveau: 0, frais: 0, total: 0 });

  useEffect(() => {
    const buildSummary = async () => {
      setLoading(true);
      try {
        const tickets = await ticketService.getAllTickets();
        const ticketList = Array.isArray(tickets) ? tickets : Object.values(tickets || {});

        const localTotals = await ticketService.getAllLocalCostTotals();
        const fraisTotals = await ticketService.getAllLocalFraisTotals();

        const ticketDetails = await Promise.all(
          ticketList.map(async (t) => {
            const [costs, items] = await Promise.all([
              ticketService.getTicketCosts(t.id),
              ticketService.getTicketItems(t.id),
            ]);

            const existingTotal = computeGlpiCostTotal(Array.isArray(costs) ? costs : []);
            const newTotal      = parseFloat(localTotals[t.id] || 0);
            const fraisTotal    = parseFloat(fraisTotals[t.id] || 0);
            const itemList      = Array.isArray(items) ? items : [];

            return { ticketId: t.id, existingTotal, newTotal, fraisTotal, items: itemList };
          })
        );

        const groups = {};

        ticketDetails.forEach(({ existingTotal, newTotal, fraisTotal, items }) => {
          if (existingTotal === 0 && newTotal === 0 && fraisTotal === 0) return;

          if (items.length === 0) {
            const key = 'Non assigné';
            if (!groups[key]) groups[key] = { existing: 0, nouveau: 0, frais: 0 };
            groups[key].existing += existingTotal;
            groups[key].nouveau  += newTotal;
            groups[key].frais    += fraisTotal;
            return;
          }

          const nbItems = items.length;
          items.forEach((item) => {
            const key = labelFor(item.itemtype);
            if (!groups[key]) groups[key] = { existing: 0, nouveau: 0, frais: 0 };
            groups[key].existing += existingTotal / nbItems;
            groups[key].nouveau  += newTotal / nbItems;
            groups[key].frais    += fraisTotal / nbItems;
          });
        });

        const builtRows = Object.entries(groups)
          .map(([element, vals]) => ({
            element,
            existing: vals.existing,
            nouveau:  vals.nouveau,
            frais:    vals.frais,
            total:    vals.existing + vals.nouveau + vals.frais,
          }))
          .sort((a, b) => b.total - a.total);

        const totals = builtRows.reduce(
          (acc, r) => ({
            existing: acc.existing + r.existing,
            nouveau:  acc.nouveau  + r.nouveau,
            frais:    acc.frais    + r.frais,
            total:    acc.total    + r.total,
          }),
          { existing: 0, nouveau: 0, frais: 0, total: 0 }
        );

        setRows(builtRows);
        setGrandTotals(totals);
      } catch (error) {
        console.error('Erreur lors de la construction du récapitulatif des coûts', error);
      } finally {
        setLoading(false);
      }
    };

    buildSummary();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <Link to="/kanban" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={18} /> Retour
        </Link>
        <h1 style={{ margin: 0, fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <DollarSign size={22} color="var(--accent)" />
          Récapitulatif des coûts par élément
        </h1>
      </div>

      <div className="glass-panel" style={{ padding: '20px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Pour chaque ticket, le coût total est divisé par le nombre d'éléments rattachés
          (ordinateurs, moniteurs, etc.), puis additionné par type d'élément.
        </p>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader size={20} style={{ marginBottom: '10px' }} />
            <p>Calcul du récapitulatif en cours...</p>
          </div>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun coût enregistré pour le moment.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--panel-border)', textAlign: 'left', background: 'rgba(0,0,0,0.03)' }}>
                <th style={{ padding: '12px 10px' }}>Élément</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Coûts existants (GLPI)</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Nouveaux coûts</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Frais de réouverture</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.element} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{r.element}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{r.existing.toFixed(2)} €</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{r.nouveau.toFixed(2)} €</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{r.frais.toFixed(2)} €</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{r.total.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--panel-border)', fontWeight: 700, background: 'rgba(0,0,0,0.03)' }}>
                <td style={{ padding: '12px 10px' }}>Total général</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{grandTotals.existing.toFixed(2)} €</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{grandTotals.nouveau.toFixed(2)} €</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{grandTotals.frais.toFixed(2)} €</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--accent)' }}>{grandTotals.total.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default CostsSummary;