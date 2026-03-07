// src/pages/PaymentsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { paymentsApi } from '../api/client';
import DisbursementPanel from '../components/DisbursementPanel';

// ── Types ──────────────────────────────────────────────────────
interface Route { id: number; name: string; _count?: { farmers: number } }
interface FarmerRow {
  id: number; code: string; name: string; phone: string;
  routeId: number; routeName: string;
  paymentMethod: string; mpesaPhone?: string; bankName?: string; bankAccount?: string;
  pricePerLitre: number; paidOn15th: boolean;
  daily: number[]; daysInMonth: number;
  totalLitres15: number; totalLitres: number; grossPay: number;
  adv5: number; adv10: number; adv15: number; adv20: number; adv25: number; emerAI: number;
  totalAdv: number; amtPayable: number;
  midGross: number; midAdv: number; midPayable: number; midCf: number;
  endCf: number; endPayable: number;
  midPayment?: { id: number; status: string; paidAt?: string } | null;
  endPayment?: { id: number; status: string; paidAt?: string } | null;
}
interface Totals {
  farmers: number; totalLitres: number; grossPay: number;
  totalAdv: number; amtPayable: number; midPayable: number; endPayable: number;
  dailyTotals: number[];
}

const MONTHS = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const NOW = new Date();
const fmt  = (n: number) => n === 0 ? '' : n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtL = (n: number) => n === 0 ? '' : Number(n).toFixed(1);
const fmtC = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Status pill ────────────────────────────────────────────────
function StatusPill({ status }: { status?: string }) {
  if (!status) return <span style={{ color: '#9ca3af', fontSize: 10 }}>—</span>;
  const colors: Record<string, string> = { PENDING: '#d97706', APPROVED: '#16a34a', PAID: '#2563eb' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: colors[status] ?? '#6b7280',
      background: (colors[status] ?? '#e5e7eb') + '20', padding: '1px 6px', borderRadius: 10 }}>
      {status}
    </span>
  );
}

// ── Advance modal ──────────────────────────────────────────────
function AdvanceModal({ farmer, month, year, onClose, onSaved }: {
  farmer: FarmerRow; month: number; year: number;
  onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate]     = useState(`${year}-${String(month).padStart(2,'0')}-05`);
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function save() {
    if (!amount || !date) return;
    setSaving(true); setErr('');
    try {
      await paymentsApi.recordAdvance({ farmerId: farmer.id, amount: Number(amount), advanceDate: date, notes });
      onSaved();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={e => e.stopPropagation()}>
        <div style={M.header}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Record Advance</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{farmer.name} · {farmer.routeName}</div>
          </div>
          <button style={M.close} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <div>
            <label style={M.label}>Amount (KES)</label>
            <input style={M.input} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <label style={M.label}>Date</label>
            <input style={M.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={M.label}>Notes (optional)</label>
            <input style={M.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Emergency" />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={M.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{ ...M.saveBtn, opacity: (!amount || saving) ? 0.5 : 1 }}
              onClick={save} disabled={!amount || saving}>
              {saving ? 'Saving...' : 'Save Advance'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const M: Record<string, React.CSSProperties> = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:     { background: '#fff', borderRadius: 14, width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' },
  close:     { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' },
  label:     { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 5 },
  input:     { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' as const },
  saveBtn:   { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
};

// ══ MAIN PAGE ══════════════════════════════════════════════════
export default function PaymentsPage() {
  const [month, setMonth]     = useState(NOW.getMonth() + 1);
  const [year, setYear]       = useState(NOW.getFullYear());
  const [routeId, setRouteId] = useState<number | ''>('');
  const [search, setSearch]   = useState('');
  const [hideZero, setHideZero] = useState(true);

  const [routes, setRoutes]   = useState<Route[]>([]);
  const [farmers, setFarmers] = useState<FarmerRow[]>([]);
  const [totals, setTotals]   = useState<Totals | null>(null);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [loading, setLoading] = useState(false);

  const [advFarmer, setAdvFarmer] = useState<FarmerRow | null>(null);
  const [approving, setApproving]       = useState(false);
  const [showDisburse, setShowDisburse] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    paymentsApi.routes().then(r => setRoutes(r.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { month, year };
      if (routeId) params.routeId = routeId;
      const r = await paymentsApi.list(params);
      setFarmers(r.data.farmers ?? []);
      setTotals(r.data.totals ?? null);
      setDaysInMonth(r.data.daysInMonth ?? 30);
    } catch {}
    finally { setLoading(false); }
  }, [month, year, routeId]);

  useEffect(() => { load(); }, [load]);

  const displayed = farmers.filter(f => {
    if (hideZero && f.totalLitres === 0) return false;
    if (search) return f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  async function approveAll(isMidMonth: boolean) {
    if (!confirm(`Approve all ${isMidMonth ? 'mid-month' : 'end-month'} payments?`)) return;
    setApproving(true);
    try {
      await paymentsApi.approve({ month, year, routeId: routeId || undefined, isMidMonth });
      load();
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed'); }
    finally { setApproving(false); }
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // ── sticky col widths (must match th/td)
  const COL = { no: 36, name: 160, price: 46 };

  return (
    <div style={P.page}>
      {/* Header */}
      <div style={P.header}>
        <div>
          <h1 style={P.title}>Farmer Payments Journal</h1>
          <p style={P.subtitle}>{MONTHS[month]} {year} · Daily milk · Advances · Net pay</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={P.midBtn} onClick={() => approveAll(true)} disabled={approving}>
            ✓ Approve 15th
          </button>
          <button style={P.endBtn} onClick={() => approveAll(false)} disabled={approving}>
            ✓ Approve End Month
          </button>
          <button style={P.disburseBtn} onClick={() => setShowDisburse(true)}>
            💸 Disburse Payments
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={P.filterBar}>
        <select style={P.sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select style={P.sel} value={year} onChange={e => setYear(Number(e.target.value))}>
          {[NOW.getFullYear()-1, NOW.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select style={P.sel} value={routeId} onChange={e => setRouteId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">All Routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name} ({r._count?.farmers})</option>)}
        </select>
        <input style={P.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search farmer..." />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
          Hide zero-milk farmers
        </label>
      </div>

      {/* Summary strip */}
      {totals && (
        <div style={P.strip}>
          {[
            { l: 'Farmers', v: String(totals.farmers) },
            { l: 'Total Litres', v: totals.totalLitres.toFixed(1) + ' L' },
            { l: 'Gross Pay', v: 'KES ' + fmtC(totals.grossPay) },
            { l: 'Advances', v: 'KES ' + fmtC(totals.totalAdv) },
            { l: 'Mid Payable', v: 'KES ' + fmtC(totals.midPayable) },
            { l: 'End Payable', v: 'KES ' + fmtC(totals.endPayable) },
          ].map(c => (
            <div key={c.l} style={P.stripItem}>
              <div style={P.stripVal}>{c.v}</div>
              <div style={P.stripLabel}>{c.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── THE JOURNAL TABLE ─────────────────────────────────── */}
      {loading ? (
        <div style={P.center}><div style={P.spinner} /></div>
      ) : (
        <div style={P.tableWrap} ref={tableRef}>
          <table style={P.table}>
            <thead>
              {/* Row 1: section headers */}
              <tr style={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
                <th style={{ ...P.stickyTh, ...P.noTh, background: '#1e3a5f' }} rowSpan={2}>#</th>
                <th style={{ ...P.stickyTh2, width: COL.name, background: '#1e3a5f' }} rowSpan={2}>FARMER</th>
                <th style={{ ...P.dayTh, background: '#1e3a5f', width: COL.price }} rowSpan={2} title="Price/L">P/L</th>
                <th style={{ ...P.sectionTh, background: '#1e4d2b' }} colSpan={daysInMonth + 2}>DAILY LITRES</th>
                <th style={{ ...P.sectionTh, background: '#4c1d1d' }} colSpan={7}>ADVANCES</th>
                <th style={{ ...P.sectionTh, background: '#1a3a5c' }} colSpan={3}>MID MONTH (15th)</th>
                <th style={{ ...P.sectionTh, background: '#2d1a4c' }} colSpan={3}>END MONTH</th>
                <th style={{ ...P.sectionTh, background: '#1e3a5f' }} colSpan={2}>STATUS</th>
                <th style={{ ...P.sectionTh, background: '#1e3a5f' }} rowSpan={2}></th>
              </tr>
              {/* Row 2: column labels */}
              <tr style={{ backgroundColor: '#f0f4f8', fontSize: 11 }}>
                {days.map(d => (
                  <th key={d} style={{ ...P.dayTh, background: d === 15 ? '#fef3c7' : d <= 15 ? '#f0fdf4' : '#f8f8f8',
                    borderRight: d === 15 ? '2px solid #d97706' : undefined }}>
                    {d}
                  </th>
                ))}
                <th style={{ ...P.dayTh, background: '#dcfce7', fontWeight: 800 }}>TL</th>
                <th style={{ ...P.dayTh, background: '#dcfce7', fontWeight: 800 }}>TM</th>
                <th style={{ ...P.advTh, background: '#fee2e2' }}>Bal b/f</th>
                <th style={{ ...P.advTh, background: '#fee2e2' }}>5th</th>
                <th style={{ ...P.advTh, background: '#fee2e2' }}>10th</th>
                <th style={{ ...P.advTh, background: '#fee2e2' }}>15th</th>
                <th style={{ ...P.advTh, background: '#fee2e2' }}>20th</th>
                <th style={{ ...P.advTh, background: '#fee2e2' }}>25th</th>
                <th style={{ ...P.advTh, background: '#fca5a5', fontWeight: 800 }}>Total Adv</th>
                <th style={{ ...P.payTh, background: '#bfdbfe' }}>Gross</th>
                <th style={{ ...P.payTh, background: '#bfdbfe' }}>Adv</th>
                <th style={{ ...P.payTh, background: '#93c5fd', fontWeight: 800 }}>Payable</th>
                <th style={{ ...P.payTh, background: '#e9d5ff' }}>Gross</th>
                <th style={{ ...P.payTh, background: '#e9d5ff' }}>Adv</th>
                <th style={{ ...P.payTh, background: '#c4b5fd', fontWeight: 800 }}>Payable</th>
                <th style={{ ...P.payTh, background: '#f0fdf4' }}>15th</th>
                <th style={{ ...P.payTh, background: '#dcfce7' }}>End</th>
              </tr>
            </thead>

            <tbody>
              {displayed.map((f, idx) => {
                const isOdd = idx % 2 === 1;
                const rowBg = isOdd ? '#f9fafb' : '#fff';
                const negStyle = (n: number): React.CSSProperties =>
                  n < 0 ? { color: '#dc2626', fontWeight: 700 } : {};

                return (
                  <tr key={f.id} style={{ backgroundColor: rowBg, fontSize: 12 }}>
                    {/* Sticky: # */}
                    <td style={{ ...P.stickyTd, ...P.noTd, background: rowBg }}>{idx + 1}</td>
                    {/* Sticky: Name */}
                    <td style={{ ...P.stickyTd2, background: rowBg }}>
                      <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 155 }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>{f.code} · {f.routeName}</div>
                    </td>
                    {/* Price/L */}
                    <td style={{ ...P.numTd, fontSize: 11, color: '#6b7280' }}>{f.pricePerLitre}</td>

                    {/* Daily litres */}
                    {f.daily.map((v, di) => (
                      <td key={di} style={{
                        ...P.numTd,
                        color: v > 0 ? '#111' : '#e5e7eb',
                        fontWeight: v > 0 ? 600 : 400,
                        background: di === 14 ? '#fffbeb' : undefined,
                        borderRight: di === 14 ? '2px solid #d97706' : undefined,
                      }}>
                        {v > 0 ? fmtL(v) : '·'}
                      </td>
                    ))}

                    {/* TL — total litres */}
                    <td style={{ ...P.numTd, fontWeight: 800, color: '#16a34a', background: '#f0fdf4' }}>
                      {f.totalLitres > 0 ? f.totalLitres.toFixed(1) : ''}
                    </td>
                    {/* TM — total money */}
                    <td style={{ ...P.numTd, fontWeight: 800, color: '#16a34a', background: '#f0fdf4' }}>
                      {f.grossPay > 0 ? fmt(f.grossPay) : ''}
                    </td>

                    {/* Advances */}
                    <td style={P.advTd}>0</td>
                    <td style={P.advTd}>{fmt(f.adv5)}</td>
                    <td style={P.advTd}>{fmt(f.adv10)}</td>
                    <td style={P.advTd}>{fmt(f.adv15)}</td>
                    <td style={P.advTd}>{fmt(f.adv20)}</td>
                    <td style={P.advTd}>{fmt(f.adv25)}</td>
                    <td style={{ ...P.advTd, fontWeight: 800, color: f.totalAdv > 0 ? '#dc2626' : '#9ca3af', background: '#fee2e2' }}>
                      {fmt(f.totalAdv)}
                    </td>

                    {/* Mid-month */}
                    <td style={P.payTd}>{fmt(f.midGross)}</td>
                    <td style={P.payTd}>{f.midAdv > 0 ? fmt(f.midAdv) : ''}</td>
                    <td style={{ ...P.payTd, fontWeight: 800, background: '#eff6ff', ...negStyle(f.midCf) }}>
                      {f.midCf !== 0 ? fmt(f.midCf) : ''}
                    </td>

                    {/* End-month */}
                    <td style={P.payTd}>{fmt(f.grossPay - f.midGross)}</td>
                    <td style={P.payTd}>{(f.adv20 + f.adv25 + f.emerAI) > 0 ? fmt(f.adv20 + f.adv25 + f.emerAI) : ''}</td>
                    <td style={{ ...P.payTd, fontWeight: 800, background: '#f5f3ff', ...negStyle(f.endCf) }}>
                      {f.endCf !== 0 ? fmt(f.endCf) : ''}
                    </td>

                    {/* Status */}
                    <td style={{ ...P.payTd, textAlign: 'center' }}><StatusPill status={f.midPayment?.status} /></td>
                    <td style={{ ...P.payTd, textAlign: 'center' }}><StatusPill status={f.endPayment?.status} /></td>

                    {/* Actions */}
                    <td style={{ ...P.payTd, whiteSpace: 'nowrap' }}>
                      <button style={P.advBtn} onClick={() => setAdvFarmer(f)}>+ Adv</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals footer */}
            {totals && (
              <tfoot>
                <tr style={{ backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 800, fontSize: 12 }}>
                  <td style={{ ...P.stickyTd, ...P.noTd, background: '#1e3a5f' }} />
                  <td style={{ ...P.stickyTd2, background: '#1e3a5f', fontWeight: 800, fontSize: 13 }}>
                    TOTALS ({totals.farmers} farmers)
                  </td>
                  <td style={P.numTd} />
                  {totals.dailyTotals.map((v, i) => (
                    <td key={i} style={{ ...P.numTd, color: v > 0 ? '#86efac' : '#334155',
                      borderRight: i === 14 ? '2px solid #d97706' : undefined }}>
                      {v > 0 ? v.toFixed(1) : ''}
                    </td>
                  ))}
                  <td style={{ ...P.numTd, color: '#86efac' }}>{totals.totalLitres.toFixed(1)}</td>
                  <td style={{ ...P.numTd, color: '#86efac' }}>{fmtC(totals.grossPay)}</td>
                  <td style={P.numTd} />
                  <td colSpan={5} style={P.numTd} />
                  <td style={{ ...P.numTd, color: '#fca5a5' }}>{fmtC(totals.totalAdv)}</td>
                  <td colSpan={2} style={P.numTd} />
                  <td style={{ ...P.numTd, color: '#93c5fd' }}>{fmtC(totals.midPayable)}</td>
                  <td colSpan={2} style={P.numTd} />
                  <td style={{ ...P.numTd, color: '#c4b5fd' }}>{fmtC(totals.endPayable)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>

          {displayed.length === 0 && !loading && (
            <div style={P.empty}>
              <div style={{ fontSize: 40 }}>💸</div>
              <p>No farmers found for {MONTHS[month]} {year}</p>
            </div>
          )}
        </div>
      )}

      {/* Advance modal */}
      {advFarmer && (
        <AdvanceModal
          farmer={advFarmer} month={month} year={year}
          onClose={() => setAdvFarmer(null)}
          onSaved={() => { setAdvFarmer(null); load(); }}
        />
      )}

      {/* Disbursement panel */}
      {showDisburse && (
        <DisbursementPanel
          month={month} year={year}
          onClose={() => setShowDisburse(false)}
        />
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const P: Record<string, React.CSSProperties> = {
  page:      { padding: 20, maxWidth: '100%' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  title:     { fontSize: 22, fontWeight: 800, color: '#111', margin: 0 },
  subtitle:  { fontSize: 13, color: '#6b7280', marginTop: 3 },
  midBtn:    { background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  endBtn:    { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  disburseBtn: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },

  filterBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' },
  sel:       { border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff' },
  search:    { border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '7px 12px', fontSize: 13, flex: 1, minWidth: 180 },

  strip:     { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  stripItem: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 16px', flex: 1, minWidth: 120 },
  stripVal:  { fontSize: 15, fontWeight: 800, color: '#111' },
  stripLabel:{ fontSize: 11, color: '#6b7280', marginTop: 2 },

  tableWrap: { overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' },
  table:     { borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: 1800 },

  // Sticky cols
  stickyTh:  { position: 'sticky', left: 0, zIndex: 3, borderRight: '1px solid #374151', whiteSpace: 'nowrap' },
  stickyTh2: { position: 'sticky', left: 36, zIndex: 3, borderRight: '2px solid #374151', whiteSpace: 'nowrap' },
  stickyTd:  { position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid #e5e7eb' },
  stickyTd2: { position: 'sticky', left: 36, zIndex: 1, borderRight: '2px solid #e5e7eb' },

  noTh:      { width: 36, textAlign: 'center', fontSize: 11, padding: '6px 4px' },
  noTd:      { width: 36, textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '6px 4px' },

  sectionTh: { textAlign: 'center', fontSize: 11, fontWeight: 800, padding: '5px 4px', letterSpacing: '0.05em', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.2)' },

  dayTh:     { width: 34, minWidth: 34, textAlign: 'center', fontSize: 11, padding: '5px 2px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' },
  advTh:     { width: 60, minWidth: 60, textAlign: 'center', fontSize: 10, padding: '5px 3px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' },
  payTh:     { width: 68, minWidth: 68, textAlign: 'center', fontSize: 10, padding: '5px 3px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' },

  numTd:     { width: 34, textAlign: 'center', padding: '6px 2px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' },
  advTd:     { width: 60, textAlign: 'right', padding: '6px 5px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 11 },
  payTd:     { width: 68, textAlign: 'right', padding: '6px 5px', borderBottom: '1px solid #f3f4f6', fontSize: 11 },

  advBtn:    { background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#c2410c', cursor: 'pointer' },
  center:    { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:   { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty:     { textAlign: 'center', padding: 60, color: '#9ca3af' },
};
