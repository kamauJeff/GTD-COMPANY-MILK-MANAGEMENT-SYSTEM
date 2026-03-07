// src/pages/CollectionsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { collectionsApi, routesApi } from '../api/client';

// ── Types ──────────────────────────────────────────────────────
interface Route { id: number; name: string; code: string }
interface OtherDeduction { id: number; amount: number; reason: string; date: string }
interface FarmerJournal {
  id: number; code: string; name: string; phone: string;
  paymentMethod: string; pricePerLitre: number;
  daily: number[]; daysInMonth: number;
  totalLitres15: number; totalLitres: number; grossPay: number;
  balBf: number; prevMonthStatus: string | null;
  adv5: number; adv10: number; adv15: number; adv20: number; adv25: number; emerAI: number;
  totalAdv: number;
  otherDeductions: OtherDeduction[];
  totalOtherDeductions: number;
  totalDeductions: number;
  midPayable: number; netPay: number; endPayable: number;
  debtRisk: boolean; hasDebt: boolean;
}
interface Totals {
  farmers: number; totalLitres: number; grossPay: number;
  totalAdv: number; totalBalBf: number; totalOtherDed: number;
  netPay: number; midPayable: number;
  farmersWithDebt: number; farmersAtRisk: number;
  dailyTotals: number[];
}

const MONTHS = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const NOW = new Date();
const fmtL = (n: number) => n === 0 ? '' : Number(n).toFixed(1);
const fmtC = (n: number) => n === 0 ? '' : Math.abs(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCFull = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Deduction modal ────────────────────────────────────────────
function DeductionModal({ farmer, month, year, onClose, onSaved }: {
  farmer: FarmerJournal; month: number; year: number;
  onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount]   = useState('');
  const [reason, setReason]   = useState('');
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  async function save() {
    if (!amount || !reason) return;
    setSaving(true); setErr('');
    try {
      await collectionsApi.recordDeduction({ farmerId: farmer.id, amount: Number(amount), reason, deductionDate: date, periodMonth: month, periodYear: year });
      onSaved();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div style={DM.overlay} onClick={onClose}>
      <div style={DM.modal} onClick={e => e.stopPropagation()}>
        <div style={DM.header}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Add Deduction</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{farmer.name}</div>
          </div>
          <button style={DM.close} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <div>
            <label style={DM.label}>Amount (KES)</label>
            <input style={DM.input} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <label style={DM.label}>Reason</label>
            <input style={DM.input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Loan repayment, Vet fees..." />
          </div>
          <div>
            <label style={DM.label}>Date</label>
            <input style={DM.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={DM.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{ ...DM.saveBtn, opacity: (!amount || !reason || saving) ? 0.5 : 1 }}
              onClick={save} disabled={!amount || !reason || saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DM: Record<string, React.CSSProperties> = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:     { background: '#fff', borderRadius: 14, width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' },
  close:     { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' },
  label:     { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 5 },
  input:     { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' as const },
  saveBtn:   { background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
};

// ── Debt badge ─────────────────────────────────────────────────
function DebtBadge({ amount, risk }: { amount: number; risk: boolean }) {
  if (amount === 0) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
      background: risk ? '#fef2f2' : '#fff7ed',
      color: risk ? '#dc2626' : '#d97706',
      border: `1px solid ${risk ? '#fca5a5' : '#fcd34d'}`,
      marginLeft: 4,
    }}>
      {risk ? '⚠️' : '!'} KES {fmtCFull(amount)} b/f
    </span>
  );
}

// ══ MAIN PAGE ══════════════════════════════════════════════════
export default function CollectionsPage() {
  const [month, setMonth]     = useState(NOW.getMonth() + 1);
  const [year, setYear]       = useState(NOW.getFullYear());
  const [routeId, setRouteId] = useState<number | ''>('');
  const [tab, setTab]         = useState<'journal' | 'record' | 'debts'>('journal');
  const [search, setSearch]   = useState('');
  const [hideZero, setHideZero] = useState(false);

  const [routes, setRoutes]       = useState<Route[]>([]);
  const [farmers, setFarmers]     = useState<FarmerJournal[]>([]);
  const [totals, setTotals]       = useState<Totals | null>(null);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [loading, setLoading]     = useState(false);

  // Record collection state
  const [recFarmerSearch, setRecFarmerSearch] = useState('');
  const [recFarmerResults, setRecFarmerResults] = useState<any[]>([]);
  const [recFarmer, setRecFarmer] = useState<any>(null);
  const [recLitres, setRecLitres] = useState('');
  const [recDate, setRecDate]     = useState(NOW.toISOString().split('T')[0]);
  const [recSaving, setRecSaving] = useState(false);
  const [recMsg, setRecMsg]       = useState<{ type: 'ok'|'err'; text: string }|null>(null);
  const searchTimer = useRef<any>(null);

  // Deduction / advance modal
  const [deductFarmer, setDeductFarmer] = useState<FarmerJournal | null>(null);

  // Debts
  const [debts, setDebts]       = useState<any>(null);
  const [debtsLoading, setDebtsLoading] = useState(false);

  useEffect(() => {
    routesApi.list().then(r => setRoutes(r.data ?? [])).catch(() => {});
  }, []);

  const loadJournal = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    try {
      const r = await collectionsApi.journal({ routeId, month, year });
      setFarmers(r.data.farmers ?? []);
      setTotals(r.data.totals ?? null);
      setDaysInMonth(r.data.daysInMonth ?? 30);
    } catch {}
    finally { setLoading(false); }
  }, [routeId, month, year]);

  useEffect(() => { loadJournal(); }, [loadJournal]);

  const loadDebts = useCallback(async () => {
    setDebtsLoading(true);
    try {
      const r = await collectionsApi.debts({ month, year });
      setDebts(r.data);
    } catch {}
    finally { setDebtsLoading(false); }
  }, [month, year]);

  useEffect(() => {
    if (tab === 'debts') loadDebts();
  }, [tab, loadDebts]);

  // Farmer search for record tab
  function handleFarmerSearch(q: string) {
    setRecFarmerSearch(q);
    clearTimeout(searchTimer.current);
    if (q.length < 2) { setRecFarmerResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await collectionsApi.searchFarmers(q);
        setRecFarmerResults(r.data?.data ?? []);
      } catch {}
    }, 300);
  }

  async function handleRecord() {
    if (!recFarmer || !recLitres) return;
    setRecSaving(true); setRecMsg(null);
    try {
      await collectionsApi.create({ farmerId: recFarmer.id, litres: Number(recLitres), collectedAt: recDate });
      setRecMsg({ type: 'ok', text: `✓ Recorded ${recLitres}L for ${recFarmer.name}` });
      setRecLitres(''); setRecFarmer(null); setRecFarmerSearch(''); setRecFarmerResults([]);
      if (routeId) loadJournal();
    } catch (e: any) {
      setRecMsg({ type: 'err', text: e.response?.data?.error ?? 'Failed to save' });
    } finally { setRecSaving(false); }
  }

  const displayed = farmers.filter(f => {
    if (hideZero && f.totalLitres === 0 && f.balBf === 0) return false;
    if (search) return f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div style={P.page}>
      {/* Header */}
      <div style={P.header}>
        <div>
          <h1 style={P.title}>Collections Journal</h1>
          <p style={P.subtitle}>{MONTHS[month]} {year} · Daily milk · Deductions · Net pay per farmer</p>
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
        <select style={{ ...P.sel, fontWeight: routeId ? 700 : 400, minWidth: 180 }}
          value={routeId} onChange={e => setRouteId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">— Select Route —</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {tab === 'journal' && routeId && (
          <>
            <input style={P.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search farmer..." />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
              Hide zero milk
            </label>
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={P.tabs}>
        <button style={{ ...P.tab, ...(tab === 'journal' ? P.tabActive : {}) }} onClick={() => setTab('journal')}>📊 Journal Grid</button>
        <button style={{ ...P.tab, ...(tab === 'record'  ? P.tabActive : {}) }} onClick={() => setTab('record')}>✏️ Record Collection</button>
        <button style={{ ...P.tab, ...(tab === 'debts'   ? P.tabActive : {}) }} onClick={() => setTab('debts')}>
          ⚠️ Debt Tracker
          {totals && totals.farmersWithDebt > 0 && (
            <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 800 }}>
              {totals.farmersWithDebt}
            </span>
          )}
        </button>
      </div>

      {/* ══ JOURNAL TAB ══════════════════════════════════════ */}
      {tab === 'journal' && (
        <>
          {/* Summary strip */}
          {totals && routeId && (
            <div style={P.strip}>
              {[
                { l: 'Farmers', v: String(totals.farmers), c: '#374151' },
                { l: 'Total Litres', v: totals.totalLitres.toFixed(1) + ' L', c: '#16a34a' },
                { l: 'Gross Pay', v: 'KES ' + fmtCFull(totals.grossPay), c: '#16a34a' },
                { l: 'Total Advances', v: 'KES ' + fmtCFull(totals.totalAdv), c: '#d97706' },
                { l: 'Bal b/f (Debts)', v: 'KES ' + fmtCFull(totals.totalBalBf), c: '#dc2626' },
                { l: 'Net Payable', v: 'KES ' + fmtCFull(totals.netPay), c: totals.netPay < 0 ? '#dc2626' : '#2563eb' },
                { l: 'In Debt', v: `${totals.farmersWithDebt} farmers`, c: '#dc2626' },
              ].map(c => (
                <div key={c.l} style={P.stripItem}>
                  <div style={{ ...P.stripVal, color: c.c }}>{c.v}</div>
                  <div style={P.stripLabel}>{c.l}</div>
                </div>
              ))}
            </div>
          )}

          {!routeId ? (
            <div style={P.empty}>
              <div style={{ fontSize: 48 }}>📋</div>
              <p style={{ fontWeight: 600, color: '#374151' }}>Select a route to view the journal</p>
              <p style={{ fontSize: 13 }}>Choose a route from the dropdown above</p>
            </div>
          ) : loading ? (
            <div style={P.center}><div style={P.spinner} /></div>
          ) : (
            <div style={P.tableWrap}>
              <table style={P.table}>
                <thead>
                  {/* Section headers */}
                  <tr style={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
                    <th style={{ ...P.stickyTh,  ...P.noTh,   background: '#1e3a5f' }} rowSpan={2}>#</th>
                    <th style={{ ...P.stickyTh2, width: 170,  background: '#1e3a5f' }} rowSpan={2}>FARMER</th>
                    <th style={{ ...P.sectionTh, background: '#1a4731' }} colSpan={daysInMonth + 2}>
                      DAILY MILK COLLECTIONS (Litres)
                    </th>
                    <th style={{ ...P.sectionTh, background: '#7f1d1d' }} colSpan={8}>
                      DEDUCTIONS
                    </th>
                    <th style={{ ...P.sectionTh, background: '#1e3a8a' }} colSpan={3}>
                      PAYMENT
                    </th>
                    <th style={{ ...P.sectionTh, background: '#1e3a5f' }} rowSpan={2}></th>
                  </tr>
                  {/* Column labels */}
                  <tr style={{ backgroundColor: '#f0f4f8', fontSize: 11 }}>
                    {days.map(d => (
                      <th key={d} style={{
                        ...P.dayTh,
                        background: d === 15 ? '#fef3c7' : d <= 15 ? '#f0fdf4' : '#f8f8f8',
                        borderRight: d === 15 ? '2px solid #d97706' : undefined,
                      }}>{d}</th>
                    ))}
                    <th style={{ ...P.dayTh, background: '#dcfce7', fontWeight: 800, minWidth: 38 }}>TL</th>
                    <th style={{ ...P.dayTh, background: '#dcfce7', fontWeight: 800, minWidth: 60 }}>GROSS</th>
                    <th style={{ ...P.dedTh, background: '#fee2e2' }}>Bal b/f</th>
                    <th style={{ ...P.dedTh, background: '#fee2e2' }}>5th</th>
                    <th style={{ ...P.dedTh, background: '#fee2e2' }}>10th</th>
                    <th style={{ ...P.dedTh, background: '#fee2e2' }}>15th</th>
                    <th style={{ ...P.dedTh, background: '#fee2e2' }}>20th</th>
                    <th style={{ ...P.dedTh, background: '#fee2e2' }}>25th</th>
                    <th style={{ ...P.dedTh, background: '#fca5a5' }}>Other Ded.</th>
                    <th style={{ ...P.dedTh, background: '#f87171', fontWeight: 800 }}>Total Ded.</th>
                    <th style={{ ...P.payTh, background: '#bfdbfe' }}>Mid Pay</th>
                    <th style={{ ...P.payTh, background: '#93c5fd' }}>Net Pay</th>
                    <th style={{ ...P.payTh, background: '#60a5fa', fontWeight: 800 }}>C/f</th>
                  </tr>
                </thead>

                <tbody>
                  {displayed.map((f, idx) => {
                    const rowBg  = idx % 2 === 1 ? '#f9fafb' : '#fff';
                    const isDebt = f.hasDebt;
                    const isRisk = f.debtRisk;

                    return (
                      <tr key={f.id} style={{ backgroundColor: isDebt ? '#fef9f9' : rowBg, fontSize: 12 }}>
                        {/* # */}
                        <td style={{ ...P.stickyTd, ...P.noTd, background: isDebt ? '#fef9f9' : rowBg }}>{idx + 1}</td>
                        {/* Farmer name */}
                        <td style={{ ...P.stickyTd2, background: isDebt ? '#fef9f9' : rowBg }}>
                          <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                            {f.name}
                            {isRisk && <span title="High debt risk" style={{ marginLeft: 4, color: '#dc2626' }}>⚠️</span>}
                          </div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>{f.code}</div>
                          {f.balBf > 0 && <DebtBadge amount={f.balBf} risk={isRisk} />}
                        </td>

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

                        {/* TL */}
                        <td style={{ ...P.numTd, fontWeight: 800, color: '#16a34a', background: '#f0fdf4' }}>
                          {fmtL(f.totalLitres)}
                        </td>
                        {/* Gross */}
                        <td style={{ ...P.numTd, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', minWidth: 60 }}>
                          {fmtC(f.grossPay)}
                        </td>

                        {/* Bal b/f */}
                        <td style={{ ...P.dedTd, color: f.balBf > 0 ? '#dc2626' : '#9ca3af', fontWeight: f.balBf > 0 ? 700 : 400 }}>
                          {f.balBf > 0 ? fmtC(f.balBf) : '—'}
                        </td>
                        {/* Advance slots */}
                        <td style={P.dedTd}>{fmtC(f.adv5)}</td>
                        <td style={P.dedTd}>{fmtC(f.adv10)}</td>
                        <td style={P.dedTd}>{fmtC(f.adv15)}</td>
                        <td style={P.dedTd}>{fmtC(f.adv20)}</td>
                        <td style={P.dedTd}>{fmtC(f.adv25)}</td>
                        {/* Other deductions */}
                        <td style={{ ...P.dedTd, position: 'relative' }}>
                          {f.totalOtherDeductions > 0
                            ? <span title={f.otherDeductions.map(d => `${d.reason}: ${d.amount}`).join('\n')} style={{ cursor: 'help', borderBottom: '1px dashed #9ca3af' }}>
                                {fmtC(f.totalOtherDeductions)}
                              </span>
                            : '—'}
                        </td>
                        {/* Total deductions */}
                        <td style={{ ...P.dedTd, fontWeight: 800, color: f.totalDeductions > 0 ? '#dc2626' : '#9ca3af', background: '#fef2f2' }}>
                          {fmtC(f.totalDeductions)}
                        </td>

                        {/* Mid payable */}
                        <td style={{ ...P.payTd, color: f.midPayable < 0 ? '#dc2626' : '#1d4ed8' }}>
                          {f.midPayable !== 0 ? (f.midPayable < 0 ? '-' : '') + fmtC(f.midPayable) : '—'}
                        </td>
                        {/* Net pay */}
                        <td style={{ ...P.payTd, fontWeight: 800, color: f.netPay < 0 ? '#dc2626' : '#16a34a' }}>
                          {f.netPay !== 0 ? (f.netPay < 0 ? '-' : '') + fmtC(f.netPay) : '—'}
                        </td>
                        {/* C/f */}
                        <td style={{ ...P.payTd, fontWeight: 800, color: f.netPay < 0 ? '#dc2626' : '#9ca3af', background: f.netPay < 0 ? '#fef2f2' : undefined }}>
                          {f.netPay < 0 ? '-' + fmtC(Math.abs(f.netPay)) : '—'}
                        </td>

                        {/* Actions */}
                        <td style={{ ...P.payTd, whiteSpace: 'nowrap', gap: 4, display: 'table-cell' }}>
                          <button style={P.dedBtn} onClick={() => setDeductFarmer(f)} title="Add deduction">
                            − Ded
                          </button>
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
                      <td style={{ ...P.stickyTd2, background: '#1e3a5f', fontSize: 13 }}>
                        TOTALS ({totals.farmers})
                      </td>
                      {totals.dailyTotals.map((v, i) => (
                        <td key={i} style={{ ...P.numTd, color: v > 0 ? '#86efac' : '#334155', borderRight: i === 14 ? '2px solid #d97706' : undefined }}>
                          {v > 0 ? v.toFixed(1) : ''}
                        </td>
                      ))}
                      <td style={{ ...P.numTd, color: '#86efac' }}>{totals.totalLitres.toFixed(1)}</td>
                      <td style={{ ...P.numTd, color: '#86efac' }}>{fmtCFull(totals.grossPay)}</td>
                      <td style={{ ...P.numTd, color: '#fca5a5' }}>{fmtCFull(totals.totalBalBf)}</td>
                      <td colSpan={5} style={P.numTd} />
                      <td style={{ ...P.numTd, color: '#fca5a5' }}>{fmtCFull(totals.totalOtherDed)}</td>
                      <td style={P.numTd} />
                      <td style={P.numTd} />
                      <td style={{ ...P.numTd, color: '#93c5fd' }}>{fmtCFull(totals.netPay)}</td>
                      <td style={P.numTd} />
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>

              {displayed.length === 0 && !loading && (
                <div style={P.empty}>
                  <p>No farmers found{search ? ` matching "${search}"` : ''}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ RECORD TAB ══════════════════════════════════════ */}
      {tab === 'record' && (
        <div style={P.recordCard}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Record Milk Collection</div>

          {recMsg && (
            <div style={{ border: '1px solid', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 600, marginBottom: 16,
              backgroundColor: recMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
              borderColor:     recMsg.type === 'ok' ? '#86efac' : '#fca5a5',
              color:           recMsg.type === 'ok' ? '#166534' : '#991b1b' }}>
              {recMsg.text}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Farmer search */}
            <div style={{ position: 'relative', gridColumn: '1 / -1' }}>
              <label style={P.label}>Farmer</label>
              <input style={P.input} value={recFarmerSearch}
                onChange={e => { handleFarmerSearch(e.target.value); if (!e.target.value) setRecFarmer(null); }}
                placeholder="Search by name or code..." />
              {recFarmerResults.length > 0 && !recFarmer && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                  {recFarmerResults.map((f: any) => (
                    <div key={f.id} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}
                      onClick={() => { setRecFarmer(f); setRecFarmerSearch(f.name); setRecFarmerResults([]); }}>
                      <span style={{ fontWeight: 700 }}>{f.name}</span>
                      <span style={{ color: '#6b7280', marginLeft: 8 }}>{f.code}</span>
                      <span style={{ float: 'right', color: '#6b7280', fontSize: 11 }}>{f.route?.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {recFarmer && (
                <div style={{ marginTop: 6, padding: '8px 12px', background: '#f0fdf4', borderRadius: 7, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{recFarmer.name}</strong> · {recFarmer.route?.name} · KES {recFarmer.pricePerLitre}/L</span>
                  <button style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }} onClick={() => { setRecFarmer(null); setRecFarmerSearch(''); }}>✕</button>
                </div>
              )}
            </div>

            <div>
              <label style={P.label}>Date</label>
              <input style={P.input} type="date" value={recDate} onChange={e => setRecDate(e.target.value)} />
            </div>

            <div>
              <label style={P.label}>Litres</label>
              <input style={P.input} type="number" step="0.1" min="0" value={recLitres}
                onChange={e => setRecLitres(e.target.value)} placeholder="0.0"
                onKeyDown={e => e.key === 'Enter' && handleRecord()} />
              {recFarmer && recLitres && (
                <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                  Est. value: KES {(Number(recLitres) * Number(recFarmer.pricePerLitre)).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <button style={{ ...P.primaryBtn, opacity: (!recFarmer || !recLitres || recSaving) ? 0.5 : 1 }}
            onClick={handleRecord} disabled={!recFarmer || !recLitres || recSaving}>
            {recSaving ? 'Saving...' : '✓ Record Collection'}
          </button>
        </div>
      )}

      {/* ══ DEBTS TAB ════════════════════════════════════════ */}
      {tab === 'debts' && (
        <div>
          {debtsLoading ? (
            <div style={P.center}><div style={P.spinner} /></div>
          ) : debts ? (
            <>
              {/* Summary */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <div style={{ ...P.stripItem, flex: 'none', minWidth: 160, borderColor: '#fca5a5' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626' }}>{debts.total}</div>
                  <div style={P.stripLabel}>Farmers with debt</div>
                </div>
                <div style={{ ...P.stripItem, flex: 'none', minWidth: 200, borderColor: '#fca5a5' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>KES {fmtCFull(debts.totalDebt)}</div>
                  <div style={P.stripLabel}>Total outstanding debt</div>
                </div>
                <div style={{ ...P.stripItem, flex: 1, background: '#fffbeb', borderColor: '#fcd34d' }}>
                  <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                    ⚠️ These farmers carried a negative balance from last month. Their debt is automatically deducted from this month's payment.
                    <strong> Do not issue advances to farmers with large outstanding debts without manager approval.</strong>
                  </div>
                </div>
              </div>

              {/* Debt table */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#7f1d1d', color: '#fff' }}>
                      <th style={P.dth}>#</th>
                      <th style={P.dth}>Farmer</th>
                      <th style={P.dth}>Code</th>
                      <th style={P.dth}>Route</th>
                      <th style={P.dth}>Phone</th>
                      <th style={{ ...P.dth, textAlign: 'right' }}>Debt Amount (KES)</th>
                      <th style={P.dth}>From</th>
                      <th style={P.dth}>Guidance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.debtors.map((d: any, i: number) => {
                      const isHigh = d.debtAmount > 5000;
                      return (
                        <tr key={d.farmerId} style={{ background: i % 2 === 1 ? '#fff5f5' : '#fff', borderBottom: '1px solid #fee2e2' }}>
                          <td style={P.dtd}>{i + 1}</td>
                          <td style={{ ...P.dtd, fontWeight: 700 }}>{d.name}</td>
                          <td style={{ ...P.dtd, color: '#6b7280', fontSize: 11 }}>{d.code}</td>
                          <td style={{ ...P.dtd, fontSize: 11 }}>{d.routeName}</td>
                          <td style={{ ...P.dtd, fontSize: 11 }}>{d.phone}</td>
                          <td style={{ ...P.dtd, textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                            {fmtCFull(d.debtAmount)}
                          </td>
                          <td style={{ ...P.dtd, fontSize: 11, color: '#6b7280' }}>
                            {MONTHS[d.fromMonth]} {d.fromYear}
                          </td>
                          <td style={P.dtd}>
                            {isHigh
                              ? <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>🚫 Block advances</span>
                              : <span style={{ fontSize: 11, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>⚠️ Caution</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {debts.debtors.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                    <div style={{ fontSize: 32 }}>✅</div>
                    <p style={{ fontWeight: 600 }}>No outstanding debts from last month</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={P.empty}>
              <p>Select month/year and click Debt Tracker to load</p>
            </div>
          )}
        </div>
      )}

      {/* Deduction modal */}
      {deductFarmer && (
        <DeductionModal
          farmer={deductFarmer} month={month} year={year}
          onClose={() => setDeductFarmer(null)}
          onSaved={() => { setDeductFarmer(null); loadJournal(); }}
        />
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const P: Record<string, React.CSSProperties> = {
  page:      { padding: 20, maxWidth: '100%' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title:     { fontSize: 22, fontWeight: 800, color: '#111', margin: 0 },
  subtitle:  { fontSize: 13, color: '#6b7280', marginTop: 3 },

  filterBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' },
  sel:       { border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff' },
  search:    { border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '7px 12px', fontSize: 13, flex: 1, minWidth: 180 },

  tabs:      { display: 'flex', gap: 4, marginBottom: 16, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab:       { border: 'none', background: 'transparent', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 },
  tabActive: { background: '#fff', color: '#16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },

  strip:     { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 },
  stripItem: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 110 },
  stripVal:  { fontSize: 14, fontWeight: 800 },
  stripLabel:{ fontSize: 11, color: '#6b7280', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },

  tableWrap: { overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' },
  table:     { borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: 2000 },

  stickyTh:  { position: 'sticky', left: 0, zIndex: 3, borderRight: '1px solid #374151', padding: '6px 4px', whiteSpace: 'nowrap' },
  stickyTh2: { position: 'sticky', left: 36, zIndex: 3, borderRight: '2px solid #374151', padding: '6px 10px', whiteSpace: 'nowrap' },
  stickyTd:  { position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid #e5e7eb' },
  stickyTd2: { position: 'sticky', left: 36, zIndex: 1, borderRight: '2px solid #e5e7eb', padding: '7px 10px' },
  noTh:      { width: 36, textAlign: 'center', fontSize: 11 },
  noTd:      { width: 36, textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '6px 4px' },
  sectionTh: { textAlign: 'center', fontSize: 11, fontWeight: 800, padding: '5px 4px', color: '#fff', letterSpacing: '0.05em' },

  dayTh:     { width: 34, minWidth: 34, textAlign: 'center', fontSize: 11, padding: '5px 2px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' },
  dedTh:     { width: 62, minWidth: 62, textAlign: 'center', fontSize: 10, padding: '5px 3px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' },
  payTh:     { width: 68, minWidth: 68, textAlign: 'center', fontSize: 10, padding: '5px 3px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' },

  numTd:     { width: 34, textAlign: 'center', padding: '6px 2px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' },
  dedTd:     { width: 62, textAlign: 'right', padding: '6px 5px', borderBottom: '1px solid #f3f4f6', fontSize: 11, color: '#374151' },
  payTd:     { width: 68, textAlign: 'right', padding: '6px 5px', borderBottom: '1px solid #f3f4f6', fontSize: 11 },

  dedBtn:    { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#dc2626', cursor: 'pointer' },
  primaryBtn:{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer', width: '100%' },

  // Record form
  recordCard:{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 28, maxWidth: 600 },
  label:     { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 5 },
  input:     { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box' as const },

  // Debt table
  dth:       { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700 },
  dtd:       { padding: '10px 12px', fontSize: 13 },

  center:    { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:   { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty:     { textAlign: 'center', padding: 60, color: '#9ca3af' },
};
