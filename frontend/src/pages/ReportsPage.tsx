// src/pages/ReportsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { reportsApi, routesApi, farmersApi } from '../api/client';

const MONTHS = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const NOW = new Date();
// Default to previous month — current month rarely has full data
const DEFAULT_MONTH = NOW.getMonth() === 0 ? 12 : NOW.getMonth();
const DEFAULT_YEAR  = NOW.getMonth() === 0 ? NOW.getFullYear() - 1 : NOW.getFullYear();
const fmt  = (n: number) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtL = (n: number) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Tab = 'grid' | 'route' | 'payment' | 'statement';

async function downloadBlob(promise: Promise<any>, filename: string) {
  try {
    const r = await promise;
    const url = URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch { alert('Export failed — make sure data exists for the selected period.'); }
}

// ── Stat card ──────────────────────────────────────────────────
function Stat({ label, value, color = '#374151', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ══ COLLECTION GRID TAB ════════════════════════════════════════
function CollectionGrid({ month, year }: { month: number; year: number }) {
  const [routes, setRoutes]   = useState<any[]>([]);
  const [routeId, setRouteId] = useState('');
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    routesApi.list().then(r => setRoutes(r.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await reportsApi.collectionGrid({ month, year, routeId: routeId || undefined });
      setData(r.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [month, year, routeId]);

  useEffect(() => { load(); }, [load]);

  const days    = data ? Array.from({ length: data.daysInMonth }, (_, i) => i + 1) : [];
  const totalTL = data?.data.reduce((s: number, r: any) => s + r.tl, 0) ?? 0;
  const totalTM = data?.data.reduce((s: number, r: any) => s + r.tm, 0) ?? 0;
  const totalAD = data?.data.reduce((s: number, r: any) => s + r.ad, 0) ?? 0;
  const totalTP = data?.data.reduce((s: number, r: any) => s + r.tp, 0) ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={S.sel} value={routeId} onChange={e => setRouteId(e.target.value)}>
          <option value="">All Routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button style={S.excelBtn} onClick={() => downloadBlob(
          reportsApi.collectionGridExcel({ month, year, routeId: routeId || undefined }),
          `Collection_Grid_${MONTHS[month]}_${year}.xlsx`)}>
          📥 Excel
        </button>
      </div>

      {data && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="Farmers"       value={String(data.data.length)} />
          <Stat label="TL — Litres"   value={fmtL(totalTL) + ' L'}   color="#1d4ed8" sub="Total litres" />
          <Stat label="TM — Money"    value={'KES ' + fmt(totalTM)}   color="#374151" sub="Litres × rate" />
          <Stat label="AD — Deductions" value={'KES ' + fmt(totalAD)} color="#dc2626" sub="Advances + other" />
          <Stat label="TP — Net Pay"  value={'KES ' + fmt(totalTP)}   color="#16a34a" sub="TM minus AD" />
        </div>
      )}

      {loading ? <div style={S.center}>Loading...</div> : !data ? null : (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <table style={{ borderCollapse: 'collapse' as const, fontSize: 11, width: '100%' }}>
            <thead>
              <tr style={{ background: '#1e3a5f', color: '#fff', position: 'sticky' as const, top: 0 }}>
                <th style={{ ...S.th, width: 30, minWidth: 30, position: 'sticky' as const, left: 0, background: '#1e3a5f', zIndex: 3 }}>#</th>
                <th style={{ ...S.th, minWidth: 180, textAlign: 'left' as const, position: 'sticky' as const, left: 30, background: '#1e3a5f', zIndex: 3 }}>FARMER</th>
                {days.map(d => <th key={d} style={{ ...S.th, width: 32 }}>{d}</th>)}
                <th style={{ ...S.th, width: 52, background: '#0f2a47' }}>TL</th>
                <th style={{ ...S.th, width: 80, background: '#0f2a47', textAlign: 'right' as const }}>TM (KES)</th>
                <th style={{ ...S.th, width: 80, background: '#7f1d1d', textAlign: 'right' as const }}>AD (KES)</th>
                <th style={{ ...S.th, width: 86, background: '#14532d', textAlign: 'right' as const }}>TP / NET PAY</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((row: any, idx: number) => (
                <tr key={row.farmer.id} style={{ background: idx % 2 === 1 ? '#f9fafb' : '#fff', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...S.td, color: '#9ca3af', position: 'sticky' as const, left: 0, background: 'inherit', width: 30, zIndex: 1 }}>{idx+1}</td>
                  <td style={{ ...S.td, fontWeight: 600, position: 'sticky' as const, left: 30, background: 'inherit', minWidth: 180, zIndex: 1 }}>
                    <div>{row.farmer.name}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{row.farmer.code}</div>
                  </td>
                  {days.map(d => (
                    <td key={d} style={{ ...S.td, textAlign: 'center' as const, color: row.days[d] > 0 ? '#111' : '#e5e7eb', padding: '6px 2px' }}>
                      {row.days[d] > 0 ? fmtL(row.days[d]) : '·'}
                    </td>
                  ))}
                  <td style={{ ...S.td, fontWeight: 800, textAlign: 'center' as const, color: '#1d4ed8' }}>{fmtL(row.tl)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: '#374151' }}>{fmt(row.tm)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: row.ad > 0 ? '#dc2626' : '#9ca3af' }}>{row.ad > 0 ? fmt(row.ad) : '—'}</td>
                  <td style={{ ...S.td, fontWeight: 800, textAlign: 'right' as const, color: row.tp < 0 ? '#dc2626' : '#16a34a' }}>{fmt(row.tp)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: 800, fontSize: 12 }}>
                <td colSpan={2} style={{ padding: '8px 10px', position: 'sticky' as const, left: 0, background: '#1e3a5f', zIndex: 1 }}>
                  TOTALS ({data.data.length})
                </td>
                {days.map(d => {
                  const dayTotal = data.data.reduce((s: number, r: any) => s + (r.days[d] ?? 0), 0);
                  return <td key={d} style={{ padding: '8px 2px', textAlign: 'center' as const, fontSize: 10, color: dayTotal > 0 ? '#86efac' : '#374151' }}>
                    {dayTotal > 0 ? dayTotal.toFixed(0) : ''}
                  </td>;
                })}
                <td style={{ padding: '8px 6px', textAlign: 'center' as const, color: '#93c5fd' }}>{fmtL(totalTL)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' as const, color: '#d1d5db' }}>{fmt(totalTM)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' as const, color: '#fca5a5' }}>{fmt(totalAD)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' as const, color: '#86efac', fontWeight: 800 }}>{fmt(totalTP)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ══ ROUTE PERFORMANCE TAB ══════════════════════════════════════
function RoutePerformance({ month, year }: { month: number; year: number }) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort]     = useState<'litres' | 'revenue' | 'name'>('litres');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await reportsApi.routePerformance({ month, year }); setData(r.data); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const sorted = data?.routes ? [...data.routes].sort((a: any, b: any) =>
    sort === 'litres' ? b.tl - a.tl :
    sort === 'revenue' ? b.tp - a.tp :
    a.name.localeCompare(b.name)) : [];

  const maxLitres = sorted[0]?.tl ?? 1;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Sort by:</span>
        {(['litres','revenue','name'] as const).map(s => (
          <button key={s} style={{ ...S.sortBtn, ...(sort === s ? S.sortBtnActive : {}) }} onClick={() => setSort(s)}>
            {s === 'litres' ? '📊 Litres' : s === 'revenue' ? '💰 Revenue' : '🔤 Name'}
          </button>
        ))}
        <button style={{ ...S.excelBtn, marginLeft: 'auto' }} onClick={() => downloadBlob(
          reportsApi.routePerformanceExcel({ month, year }),
          `Route_Performance_${MONTHS[month]}_${year}.xlsx`)}>
          📥 Excel
        </button>
      </div>

      {data?.grandTotal && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="Active Routes"  value={String(sorted.length)} />
          <Stat label="Farmers"        value={String(data.grandTotal.farmers)} color="#6b7280" />
          <Stat label="TL — Total Litres" value={fmtL(data.grandTotal.tl) + ' L'}   color="#1d4ed8" sub="All litres collected" />
          <Stat label="TM — Total Money"  value={'KES ' + fmt(data.grandTotal.tm)}  color="#374151" sub="Litres × rate" />
          <Stat label="AD — Deductions"   value={'KES ' + fmt(data.grandTotal.ad)}  color="#dc2626" sub="Advances + other" />
          <Stat label="TP — Net Payable"  value={'KES ' + fmt(data.grandTotal.tp)}  color="#16a34a" sub="TM minus AD" />
        </div>
      )}

      {loading ? <div style={S.center}>Loading...</div> : !data ? null : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {sorted.map((route: any, idx: number) => (
            <div key={route.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>{route.name}</span>
                    <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>{route.code}</span>
                    <span style={{ background: '#1e3a5f', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>#{idx+1}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                    👤 {route.supervisor} &nbsp;·&nbsp; {route.activeFarmers} farmers &nbsp;·&nbsp; {route.activeDays} active days
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', textAlign: 'right' as const }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1d4ed8' }}>{fmtL(route.tl)} L</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>TL</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#374151' }}>KES {fmt(route.tm)}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>TM</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>KES {fmt(route.ad)}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>AD</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: route.tp < 0 ? '#dc2626' : '#16a34a' }}>KES {fmt(route.tp)}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>TP</div>
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 10, height: 6, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(route.tl / maxLitres) * 100}%`, background: '#1e3a5f', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══ PAYMENT SUMMARY TAB ════════════════════════════════════════
function PaymentSummary({ month, year }: { month: number; year: number }) {
  const [isMidMonth, setIsMidMonth] = useState(false);
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [expandMethod, setExpandMethod] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await reportsApi.paymentSummary({ month, year, isMidMonth }); setData(r.data); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [month, year, isMidMonth]);

  useEffect(() => { load(); }, [load]);

  const METHOD_COLORS: Record<string, string> = {
    MPESA: '#16a34a', EQUITY: '#8b0000', KCB: '#006633',
    'CO-OP': '#004080', FAMILY: '#5b2c8c', 'K-UNITY': '#c55a11',
    TAI: '#1f5c1f', FARIJI: '#0070c0', CASH: '#374151',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
          {[false, true].map(mid => (
            <button key={String(mid)} style={{ ...S.toggle, ...(isMidMonth === mid ? S.toggleActive : {}) }}
              onClick={() => setIsMidMonth(mid)}>
              {mid ? '15th (Mid)' : 'End Month'}
            </button>
          ))}
        </div>
        <button style={{ ...S.excelBtn, marginLeft: 'auto' }} onClick={() => downloadBlob(
          reportsApi.paymentSummaryExcel({ month, year, isMidMonth }),
          `Payment_Summary_${MONTHS[month]}_${year}_${isMidMonth ? 'Mid' : 'End'}.xlsx`)}>
          📥 Excel
        </button>
      </div>

      {data?.totals && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="Farmers Paid" value={String(data.totals.count)} />
          <Stat label="Gross" value={'KES ' + fmt(data.totals.gross)} color="#374151" />
          <Stat label="Advances" value={'KES ' + fmt(data.totals.advances)} color="#dc2626" />
          <Stat label="Net Pay" value={'KES ' + fmt(data.totals.net)} color="#16a34a" />
          <Stat label="Paid ✓" value={String(data.totals.paid)} color="#16a34a" sub={`${data.totals.pending} pending`} />
        </div>
      )}

      {/* Method breakdown */}
      {data?.summary && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {data.summary.map((s: any) => (
            <button key={s.method}
              onClick={() => setExpandMethod(expandMethod === s.method ? null : s.method)}
              style={{ background: expandMethod === s.method ? METHOD_COLORS[s.method] ?? '#374151' : '#fff',
                color: expandMethod === s.method ? '#fff' : METHOD_COLORS[s.method] ?? '#374151',
                border: `2px solid ${METHOD_COLORS[s.method] ?? '#374151'}`,
                borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, textAlign: 'left' as const }}>
              <div>{s.method}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{s.count} · KES {fmt(s.amount)}</div>
            </button>
          ))}
        </div>
      )}

      {loading ? <div style={S.center}>Loading...</div> : !data ? null : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                {['#','M.No','Farmer','Route','Method','Account','Gross','Advances','Net Pay','Status'].map(h => (
                  <th key={h} style={{ ...S.th, textAlign: h === 'Gross' || h === 'Advances' || h === 'Net Pay' ? 'right' as const : 'left' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(expandMethod
                ? data.payments.filter((p: any) => p.farmer.paymentMethod === expandMethod)
                : data.payments
              ).map((p: any, idx: number) => (
                <tr key={p.id} style={{ background: idx % 2 === 1 ? '#f9fafb' : '#fff', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...S.td, color: '#9ca3af' }}>{idx+1}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{p.farmer.code}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{p.farmer.name}</td>
                  <td style={{ ...S.td, fontSize: 11, color: '#6b7280' }}>{p.farmer.route?.name}</td>
                  <td style={{ ...S.td }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                      background: (METHOD_COLORS[p.farmer.paymentMethod] ?? '#374151') + '18',
                      color: METHOD_COLORS[p.farmer.paymentMethod] ?? '#374151' }}>
                      {p.farmer.paymentMethod}
                    </span>
                  </td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{p.farmer.mpesaPhone ?? p.farmer.bankAccount ?? '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{fmt(Number(p.grossPay))}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: '#dc2626' }}>{Number(p.totalAdvances) > 0 ? fmt(Number(p.totalAdvances)) : '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, fontWeight: 800, color: Number(p.netPay) < 0 ? '#dc2626' : '#16a34a' }}>{fmt(Number(p.netPay))}</td>
                  <td style={{ ...S.td }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                      background: p.status === 'PAID' ? '#dcfce7' : '#f3f4f6',
                      color: p.status === 'PAID' ? '#166534' : '#6b7280' }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.payments.length === 0 && (
            <div style={{ textAlign: 'center' as const, padding: 40, color: '#9ca3af' }}>
              No payments found for {data.period}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══ FARMER STATEMENT TAB ══════════════════════════════════════
function FarmerStatement({ month, year }: { month: number; year: number }) {
  const [query, setQuery]     = useState('');
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length >= 2) {
      farmersApi.list({ search: query, limit: 10 }).then(r => setFarmers(r.data?.data ?? r.data ?? [])).catch(() => {});
    } else { setFarmers([]); }
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    reportsApi.farmerStatement(selected.id, { month, year })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selected, month, year]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div>
      {/* Farmer search */}
      <div style={{ marginBottom: 16, maxWidth: 400 }}>
        <div style={{ position: 'relative' as const }}>
          <input style={{ ...S.sel, width: '100%', paddingLeft: 36 }}
            value={query} onChange={e => { setQuery(e.target.value); setSelected(null); setData(null); }}
            placeholder="🔍 Search farmer name or code..." />
        </div>
        {farmers.length > 0 && !selected && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {farmers.map(f => (
              <button key={f.id} style={{ width: '100%', textAlign: 'left' as const, padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}
                onClick={() => { setSelected(f); setQuery(f.name); setFarmers([]); }}>
                <span style={{ fontWeight: 700 }}>{f.name}</span>
                <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{f.code} · {f.route?.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={S.center}>Loading...</div>}

      {data && selected && (
        <div>
          {/* Farmer header */}
          <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{data.farmer.name}</div>
              <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 3 }}>
                {data.farmer.code} &nbsp;·&nbsp; {data.farmer.route?.name} &nbsp;·&nbsp; KES {Number(data.farmer.pricePerLitre).toFixed(2)}/L
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { l: 'Total Litres', v: fmtL(data.summary.totalLitres) + ' L', c: '#93c5fd' },
                { l: 'Gross Pay', v: 'KES ' + fmt(data.summary.grossPay), c: '#86efac' },
                { l: 'Advances', v: 'KES ' + fmt(data.summary.totalAdvances), c: '#fca5a5' },
                { l: 'Net Pay', v: 'KES ' + fmt(data.summary.netPay), c: data.summary.netPay < 0 ? '#fca5a5' : '#86efac' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: '#93c5fd' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily grid */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {days.map(d => <th key={d} style={{ padding: '8px 6px', textAlign: 'center' as const, fontWeight: 700, color: '#374151', width: 36 }}>{d}</th>)}
                  <th style={{ padding: '8px 10px', fontWeight: 800, color: '#1d4ed8' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {days.map(d => {
                    const col = data.collections.filter((c: any) => new Date(c.collectedAt).getDate() === d);
                    const litres = col.reduce((s: number, c: any) => s + Number(c.litres), 0);
                    return (
                      <td key={d} style={{ padding: '10px 6px', textAlign: 'center' as const, fontWeight: litres > 0 ? 700 : 400, color: litres > 0 ? '#111' : '#d1d5db', background: litres > 0 ? '#f0f9ff' : 'transparent' }}>
                        {litres > 0 ? fmtL(litres) : '·'}
                      </td>
                    );
                  })}
                  <td style={{ padding: '10px', fontWeight: 800, color: '#1d4ed8', textAlign: 'center' as const }}>{fmtL(data.summary.totalLitres)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Advances + Deductions */}
          {(data.advances.length > 0 || data.deductions.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {data.advances.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#fef2f2', padding: '8px 14px', fontWeight: 800, fontSize: 12, color: '#dc2626' }}>ADVANCES</div>
                  {data.advances.map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
                      <span style={{ color: '#6b7280' }}>{new Date(a.advanceDate).toLocaleDateString('en-KE')}</span>
                      <span style={{ fontWeight: 700, color: '#dc2626' }}>KES {fmt(Number(a.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.deductions.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#fef9c3', padding: '8px 14px', fontWeight: 800, fontSize: 12, color: '#92400e' }}>OTHER DEDUCTIONS</div>
                  {data.deductions.map((d: any) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
                      <span style={{ color: '#6b7280' }}>{d.reason ?? 'Deduction'}</span>
                      <span style={{ fontWeight: 700, color: '#92400e' }}>KES {fmt(Number(d.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!selected && !loading && (
        <div style={{ textAlign: 'center' as const, padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p style={{ fontWeight: 600 }}>Search for a farmer above</p>
          <p style={{ fontSize: 13 }}>Type their name or farmer code to load their statement</p>
        </div>
      )}
    </div>
  );
}

// ══ MAIN PAGE ══════════════════════════════════════════════════
export default function ReportsPage() {
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [year, setYear]   = useState(DEFAULT_YEAR);
  const [tab, setTab]     = useState<Tab>('grid');

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'grid',      label: 'Collection Grid',  icon: '📅' },
    { key: 'route',     label: 'Route Performance', icon: '🚛' },
    { key: 'payment',   label: 'Payment Summary',   icon: '💸' },
    { key: 'statement', label: 'Farmer Statement',  icon: '👤' },
  ];

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Reports</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>Collection · Routes · Payments · Statements</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={S.sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select style={S.sel} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[NOW.getFullYear()-2, NOW.getFullYear()-1, NOW.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 12, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key}
            style={{ border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#1e3a5f' : '#6b7280',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
            onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'grid'      && <CollectionGrid    month={month} year={year} />}
      {tab === 'route'     && <RoutePerformance  month={month} year={year} />}
      {tab === 'payment'   && <PaymentSummary    month={month} year={year} />}
      {tab === 'statement' && <FarmerStatement   month={month} year={year} />}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  sel:           { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#fff' },
  excelBtn:      { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  sortBtn:       { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' },
  sortBtnActive: { background: '#1e3a5f', color: '#fff', borderColor: '#1e3a5f' },
  toggle:        { border: 'none', background: 'transparent', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6b7280' },
  toggleActive:  { background: '#fff', color: '#1e3a5f', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  th:            { padding: '9px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const },
  td:            { padding: '9px 10px', verticalAlign: 'middle' as const },
  center:        { textAlign: 'center' as const, padding: 60, color: '#9ca3af' },
};
