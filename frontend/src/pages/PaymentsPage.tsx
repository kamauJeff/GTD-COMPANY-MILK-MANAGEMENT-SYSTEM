// src/pages/PaymentsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { paymentsApi, routesApi } from '../api/client';

// ── Types ─────────────────────────────────────────────────────
interface Route { id: number; name: string; _count?: { farmers: number } }
interface FarmerPayment {
  id: number; code: string; name: string; phone: string;
  routeId: number; routeName: string;
  paymentMethod: string; mpesaPhone?: string; bankName?: string; bankAccount?: string;
  pricePerLitre: number; paidOn15th: boolean;
  totalLitres: number; grossPay: number;
  adv5: number; adv10: number; adv15: number; adv20: number; adv25: number; emerAI: number;
  totalAdvances: number; netPay: number;
  midLitres: number; midGross: number; midAdvances: number; midPayable: number;
  midPayment?: { id: number; status: string; paidAt?: string } | null;
  endPayment?: { id: number; status: string; paidAt?: string } | null;
}
interface Totals { farmers: number; totalLitres: number; grossPay: number; totalAdvances: number; netPay: number }

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
const NOW = new Date();

const fmt  = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtL = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span style={badge('E2E8F0','64748B')}>—</span>;
  const map: Record<string, [string, string]> = {
    PENDING:  ['FEF9C3','92400E'],
    APPROVED: ['DCFCE7','166534'],
    PAID:     ['DBEAFE','1E40AF'],
  };
  const [bg, color] = map[status] ?? ['F3F4F6','374151'];
  return <span style={badge(bg, color)}>{status}</span>;
}
function badge(bg: string, color: string): React.CSSProperties {
  return { padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
           backgroundColor: '#' + bg, color: '#' + color, whiteSpace: 'nowrap' as const };
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color ?? '#111' }}>{value}</span>
    </div>
  );
}

export default function PaymentsPage() {
  const [month, setMonth]     = useState(NOW.getMonth() + 1);
  const [year, setYear]       = useState(NOW.getFullYear());
  const [routeId, setRouteId] = useState<number | ''>('');
  const [view, setView]       = useState<'end' | 'mid'>('end');
  const [search, setSearch]   = useState('');

  const [routes, setRoutes]   = useState<Route[]>([]);
  const [farmers, setFarmers] = useState<FarmerPayment[]>([]);
  const [totals, setTotals]   = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FarmerPayment | null>(null);

  const [advModal, setAdvModal]   = useState(false);
  const [advFarmer, setAdvFarmer] = useState<FarmerPayment | null>(null);
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate]     = useState('');
  const [advNotes, setAdvNotes]   = useState('');
  const [advSaving, setAdvSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    paymentsApi.routes().then(r => setRoutes(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { month, year };
      if (routeId) params.routeId = routeId;
      const r = await paymentsApi.list(params);
      setFarmers(r.data.farmers ?? []);
      setTotals(r.data.totals ?? null);
    } catch {}
    finally { setLoading(false); }
  }, [month, year, routeId]);

  useEffect(() => { load(); }, [load]);

  const active = farmers.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase());
    const matchView   = view === 'mid' ? f.paidOn15th : true;
    return f.totalLitres > 0 && matchSearch && matchView;
  });

  async function saveAdvance() {
    if (!advFarmer || !advAmount || !advDate) return;
    setAdvSaving(true);
    try {
      await paymentsApi.recordAdvance({ farmerId: advFarmer.id, amount: Number(advAmount), advanceDate: advDate, notes: advNotes });
      setAdvModal(false); setAdvAmount(''); setAdvDate(''); setAdvNotes('');
      load();
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed to save advance'); }
    finally { setAdvSaving(false); }
  }

  async function approveAll() {
    if (!confirm(`Approve all ${view === 'mid' ? 'mid-month' : 'end-month'} payments for ${MONTHS[month]} ${year}?`)) return;
    setApproving(true);
    try {
      await paymentsApi.approve({ month, year, routeId: routeId || undefined, isMidMonth: view === 'mid' });
      load();
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed'); }
    finally { setApproving(false); }
  }

  const pendingCount = active.filter(f => {
    const pay = view === 'mid' ? f.midPayment : f.endPayment;
    return !pay || pay.status === 'PENDING';
  }).length;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Farmer Payments</h1>
          <p style={S.subtitle}>Advances, mid-month and end-month payouts · {MONTHS[month]} {year}</p>
        </div>
        <button style={{ ...S.approveBtn, opacity: pendingCount === 0 ? 0.5 : 1 }} onClick={approveAll} disabled={approving || pendingCount === 0}>
          {approving ? 'Processing...' : `✓ Approve ${pendingCount} Pending`}
        </button>
      </div>

      {/* Filters */}
      <div style={S.filterBar}>
        <select style={S.select} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select style={S.select} value={year} onChange={e => setYear(Number(e.target.value))}>
          {[NOW.getFullYear()-1, NOW.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select style={S.select} value={routeId} onChange={e => setRouteId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">All Routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name} ({r._count?.farmers ?? 0})</option>)}
        </select>
        <div style={S.viewToggle}>
          <button style={{ ...S.toggleBtn, ...(view === 'end' ? S.toggleActive : {}) }} onClick={() => setView('end')}>End Month</button>
          <button style={{ ...S.toggleBtn, ...(view === 'mid' ? S.toggleActive : {}) }} onClick={() => setView('mid')}>Mid Month (15th)</button>
        </div>
        <input style={S.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search farmer name or code..." />
      </div>

      {/* Summary cards */}
      {totals && (
        <div style={S.cards}>
          {[
            { label: 'Active Farmers', value: String(active.length), color: '#16a34a', icon: '👨‍🌾' },
            { label: 'Total Litres',   value: fmtL(active.reduce((s,f) => s + (view==='mid'?f.midLitres:f.totalLitres), 0)) + ' L', color: '#2563eb', icon: '🥛' },
            { label: 'Gross Pay',      value: 'KES ' + fmt(active.reduce((s,f) => s + (view==='mid'?f.midGross:f.grossPay), 0)), color: '#7c3aed', icon: '💰' },
            { label: 'Total Advances', value: 'KES ' + fmt(active.reduce((s,f) => s + (view==='mid'?f.midAdvances:f.totalAdvances), 0)), color: '#ea580c', icon: '📤' },
            { label: 'Net Payable',    value: 'KES ' + fmt(active.reduce((s,f) => s + (view==='mid'?f.midPayable:f.netPay), 0)), color: '#0891b2', icon: '✅' },
          ].map(c => (
            <div key={c.label} style={S.card}>
              <span style={{ fontSize: 26 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={S.tableWrap}>
        {loading ? (
          <div style={S.center}><div style={S.spinner} /></div>
        ) : active.length === 0 ? (
          <div style={S.empty}><div style={{ fontSize: 48 }}>💸</div><p>No payment data for {MONTHS[month]} {year}</p></div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>{['Code','Name','Route','Litres','Gross Pay','Advances','Net Pay','Method','Status',''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {active.map((f, i) => {
                const pay = view === 'mid' ? f.midPayment : f.endPayment;
                const netV   = view === 'mid' ? f.midPayable    : f.netPay;
                const grossV = view === 'mid' ? f.midGross      : f.grossPay;
                const advV   = view === 'mid' ? f.midAdvances   : f.totalAdvances;
                const litV   = view === 'mid' ? f.midLitres     : f.totalLitres;
                return (
                  <tr key={f.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={S.td}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, backgroundColor: '#f0fdf4', color: '#16a34a' }}>{f.code}</span></td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{f.name}</td>
                    <td style={{ ...S.td, color: '#6b7280', fontSize: 12 }}>{f.routeName}</td>
                    <td style={{ ...S.td, color: '#2563eb', fontWeight: 700 }}>{fmtL(litV)}</td>
                    <td style={{ ...S.td, color: '#16a34a', fontWeight: 700 }}>KES {fmt(grossV)}</td>
                    <td style={{ ...S.td, color: advV > 0 ? '#ea580c' : '#9ca3af' }}>{advV > 0 ? `(${fmt(advV)})` : '—'}</td>
                    <td style={{ ...S.td, fontWeight: 800, color: netV < 0 ? '#dc2626' : '#0f172a' }}>KES {fmt(netV)}</td>
                    <td style={S.td}>
                      <span style={badge(f.paymentMethod === 'MPESA' ? 'DCFCE7' : 'DBEAFE', f.paymentMethod === 'MPESA' ? '166534' : '1E40AF')}>
                        {f.paymentMethod === 'MPESA' ? 'MPESA' : (f.bankName ?? 'BANK')}
                      </span>
                    </td>
                    <td style={S.td}><StatusBadge status={pay?.status} /></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={S.iconBtn} onClick={() => { setAdvFarmer(f); setAdvModal(true); }}>+ Adv</button>
                        <button style={{ ...S.iconBtn, backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }} onClick={() => setSelected(f)}>View</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Farmer detail drawer */}
      {selected && (
        <div style={S.overlay} onClick={() => setSelected(null)}>
          <div style={S.drawer} onClick={e => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selected.name}</h2>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{selected.code} · {selected.routeName}</span>
              </div>
              <button style={S.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={S.drawerBody}>
              <div style={S.section}>
                <div style={S.sectionTitle}>📊 {MONTHS[month]} {year} Summary</div>
                <Row label="Total Litres"   value={fmtL(selected.totalLitres) + ' L'} />
                <Row label="Price / Litre"  value={'KES ' + selected.pricePerLitre.toFixed(2)} />
                <Row label="Gross Pay"      value={'KES ' + fmt(selected.grossPay)} bold />
                <Row label="Total Advances" value={'(KES ' + fmt(selected.totalAdvances) + ')'} color="#ea580c" />
                <Row label="Net Pay"        value={'KES ' + fmt(selected.netPay)} bold color={selected.netPay < 0 ? '#dc2626' : '#16a34a'} />
              </div>

              {selected.totalAdvances > 0 && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>📤 Advances Breakdown</div>
                  {[['5th', selected.adv5],['10th', selected.adv10],['15th', selected.adv15],
                    ['20th', selected.adv20],['25th', selected.adv25],['Emer/AI', selected.emerAI]]
                    .filter(([, v]) => (v as number) > 0)
                    .map(([l, v]) => <Row key={l as string} label={`${l} Advance`} value={'KES ' + fmt(v as number)} />)}
                </div>
              )}

              {selected.paidOn15th && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>📅 Mid-Month (1–15th)</div>
                  <Row label="Mid Litres"   value={fmtL(selected.midLitres) + ' L'} />
                  <Row label="Mid Gross"    value={'KES ' + fmt(selected.midGross)} />
                  <Row label="Mid Advances" value={'(KES ' + fmt(selected.midAdvances) + ')'} />
                  <Row label="Mid Payable"  value={'KES ' + fmt(selected.midPayable)} bold color={selected.midPayable < 0 ? '#dc2626' : '#16a34a'} />
                  <div style={{ marginTop: 10 }}><StatusBadge status={selected.midPayment?.status} /></div>
                </div>
              )}

              <div style={S.section}>
                <div style={S.sectionTitle}>💳 Payment Details</div>
                <Row label="Method" value={selected.paymentMethod} />
                {selected.paymentMethod === 'MPESA'
                  ? <Row label="M-Pesa No." value={selected.mpesaPhone ?? '—'} />
                  : <><Row label="Bank" value={selected.bankName ?? '—'} /><Row label="Account" value={selected.bankAccount ?? '—'} /></>}
                <Row label="Phone"    value={selected.phone} />
                <Row label="Pay Date" value={selected.paidOn15th ? '15th (Mid-month)' : 'End of month'} />
              </div>

              <button style={S.actionBtn} onClick={() => { setAdvFarmer(selected); setAdvModal(true); setSelected(null); }}>
                + Record Advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance modal */}
      {advModal && advFarmer && (
        <div style={S.overlay} onClick={() => setAdvModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Record Advance — {advFarmer.name}</h2>
              <button style={S.closeBtn} onClick={() => setAdvModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label style={S.label}>Amount (KES)</label><input style={S.input} type="number" value={advAmount} onChange={e => setAdvAmount(e.target.value)} placeholder="0.00" /></div>
              <div><label style={S.label}>Date</label><input style={S.input} type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} /></div>
              <div><label style={S.label}>Notes (optional)</label><input style={S.input} value={advNotes} onChange={e => setAdvNotes(e.target.value)} placeholder="e.g. Emergency advance" /></div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={S.cancelBtn} onClick={() => setAdvModal(false)}>Cancel</button>
                <button style={{ ...S.actionBtn, opacity: (!advAmount || !advDate) ? 0.5 : 1 }} onClick={saveAdvance} disabled={advSaving || !advAmount || !advDate}>
                  {advSaving ? 'Saving...' : 'Save Advance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:        { padding: 24, maxWidth: 1400, margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:       { fontSize: 24, fontWeight: 800, color: '#111', margin: 0 },
  subtitle:    { fontSize: 14, color: '#6b7280', marginTop: 4 },
  approveBtn:  { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  filterBar:   { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' },
  select:      { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', cursor: 'pointer' },
  viewToggle:  { display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 },
  toggleBtn:   { border: 'none', background: 'transparent', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280' },
  toggleActive:{ background: '#fff', color: '#16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  search:      { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', fontSize: 13, flex: 1, minWidth: 200 },
  cards:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 },
  card:        { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  tableWrap:   { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1000 },
  th:          { padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td:          { padding: '11px 14px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  iconBtn:     { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' },
  center:      { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:     { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty:       { textAlign: 'center', padding: 60, color: '#9ca3af' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' },
  drawer:      { background: '#fff', width: 440, height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)' },
  modal:       { position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 16, width: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', zIndex: 101 },
  drawerHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
  drawerBody:  { padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },
  closeBtn:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: 4 },
  section:     { background: '#f9fafb', borderRadius: 10, padding: 16 },
  sectionTitle:{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 10 },
  label:       { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:       { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' as const },
  actionBtn:   { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' },
  cancelBtn:   { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
};
