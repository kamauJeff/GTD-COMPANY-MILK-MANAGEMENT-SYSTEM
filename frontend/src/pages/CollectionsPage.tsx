// src/pages/CollectionsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { collectionsApi, farmersApi, routesApi } from '../api/client';

// ── Types ─────────────────────────────────────────────────────
interface Route    { id: number; name: string }
interface Farmer   { id: number; code: string; name: string; phone: string; pricePerLitre: number; paymentMethod: string; route: { name: string } }
interface Collection {
  id: number; litres: number; collectedAt: string;
  farmer: { id: number; code: string; name: string; pricePerLitre?: number };
  route:  { id: number; name: string };
  grader: { id: number; name: string };
  receiptNo?: string;
}
interface DailyTotal { route: { id: number; name: string }; totalLitres: number; farmerCount: number }

const fmt  = (n: number) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtM = (n: number) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];

// ── Colour cycle for route cards ─────────────────────────────
const COLORS = [
  ['#f0fdf4','#16a34a'],['#eff6ff','#2563eb'],['#fdf4ff','#9333ea'],
  ['#fff7ed','#ea580c'],['#f0fdfa','#059669'],['#fef2f2','#dc2626'],
  ['#fffbeb','#d97706'],['#f8fafc','#475569'],
];

export default function CollectionsPage() {
  const [tab, setTab]         = useState<'record' | 'view'>('record');
  const [date, setDate]       = useState(today());
  const [routes, setRoutes]   = useState<Route[]>([]);
  const [routeId, setRouteId] = useState<number | ''>('');
  const [dailyTotals, setDailyTotals]   = useState<DailyTotal[]>([]);
  const [collections, setCollections]   = useState<Collection[]>([]);
  const [loadingCols, setLoadingCols]   = useState(false);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);

  // Record form state
  const [search, setSearch]           = useState('');
  const [searchResults, setSearchResults] = useState<Farmer[]>([]);
  const [searching, setSearching]     = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [litres, setLitres]           = useState('');
  const [collDate, setCollDate]       = useState(today());
  const [saving, setSaving]           = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [errorMsg, setErrorMsg]       = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const LIMIT = 50;

  // Load routes + daily totals on mount / date change
  useEffect(() => {
    routesApi.list().then(r => setRoutes(r.data ?? [])).catch(() => {});
  }, []);

  const loadDailyTotals = useCallback(() => {
    collectionsApi.dailyTotals(date)
      .then(r => setDailyTotals(r.data ?? []))
      .catch(() => {});
  }, [date]);

  useEffect(() => { loadDailyTotals(); }, [loadDailyTotals]);

  // Load collections list
  const loadCollections = useCallback(async (p = 1) => {
    setLoadingCols(true);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (routeId) params.routeId = routeId;
      if (date)    params.date    = date;
      const r = await collectionsApi.list(params);
      setCollections(p === 1 ? (r.data.data ?? []) : prev => [...prev, ...(r.data.data ?? [])]);
      setTotal(r.data.total ?? 0);
      setPage(p);
    } catch {}
    finally { setLoadingCols(false); }
  }, [routeId, date]);

  useEffect(() => { if (tab === 'view') loadCollections(1); }, [tab, loadCollections]);

  // Farmer search with debounce
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await farmersApi.list({ search, limit: 8 });
        setSearchResults(r.data.data ?? []);
      } catch {}
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function selectFarmer(f: Farmer) {
    setSelectedFarmer(f);
    setSearch('');
    setSearchResults([]);
    setLitres('');
    setSuccessMsg('');
    setErrorMsg('');
  }

  async function handleRecord() {
    if (!selectedFarmer || !litres || Number(litres) <= 0) return;
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await collectionsApi.create({
        farmerId:    selectedFarmer.id,
        litres:      Number(litres),
        collectedAt: new Date(collDate + 'T08:00:00').toISOString(),
      });
      const value = (Number(litres) * selectedFarmer.pricePerLitre).toFixed(2);
      setSuccessMsg(`✓ Recorded ${litres}L for ${selectedFarmer.name} — KES ${value}`);
      setSelectedFarmer(null);
      setLitres('');
      setSearch('');
      loadDailyTotals();
      searchRef.current?.focus();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error ?? 'Failed to save. Try again.');
    } finally { setSaving(false); }
  }

  const grandTotal = dailyTotals.reduce((s, t) => s + Number(t.totalLitres), 0);
  const grandFarmers = dailyTotals.reduce((s, t) => s + t.farmerCount, 0);

  return (
    <div style={S.page}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Milk Collections</h1>
          <p style={S.subtitle}>Record daily collections from farmers across all routes</p>
        </div>
        <input type="date" style={S.datePicker} value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* ── Daily summary cards ─────────────────────────────── */}
      <div style={S.summaryRow}>
        <div style={S.summaryCard}>
          <span style={{ fontSize: 28 }}>🥛</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{fmt(grandTotal)} L</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Total collected today</div>
          </div>
        </div>
        <div style={S.summaryCard}>
          <span style={{ fontSize: 28 }}>👨‍🌾</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{grandFarmers}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Farmers recorded</div>
          </div>
        </div>
        <div style={S.summaryCard}>
          <span style={{ fontSize: 28 }}>🛣️</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>{dailyTotals.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Active routes</div>
          </div>
        </div>
      </div>

      {/* ── Route totals grid ───────────────────────────────── */}
      {dailyTotals.length > 0 && (
        <div style={S.routeGrid}>
          {dailyTotals
            .sort((a, b) => Number(b.totalLitres) - Number(a.totalLitres))
            .map((t, i) => {
              const [bg, color] = COLORS[i % COLORS.length];
              return (
                <div key={t.route.id} style={{ ...S.routeCard, backgroundColor: bg, borderColor: color + '40' }}>
                  <div style={{ ...S.routeDot, backgroundColor: color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{t.route.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{t.farmerCount} farmers</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, color }}>
                    {fmt(Number(t.totalLitres))} L
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── Tab switcher ────────────────────────────────────── */}
      <div style={S.tabs}>
        <button style={{ ...S.tab, ...(tab === 'record' ? S.tabActive : {}) }} onClick={() => setTab('record')}>
          ✏️ Record Collection
        </button>
        <button style={{ ...S.tab, ...(tab === 'view' ? S.tabActive : {}) }} onClick={() => setTab('view')}>
          📋 View Collections
        </button>
      </div>

      {/* ══ RECORD TAB ══════════════════════════════════════════ */}
      {tab === 'record' && (
        <div style={S.recordCard}>
          <div style={S.recordTitle}>Record Milk Collection</div>

          {/* Success / error messages */}
          {successMsg && (
            <div style={S.successBanner}>{successMsg}</div>
          )}
          {errorMsg && (
            <div style={S.errorBanner}>{errorMsg}</div>
          )}

          <div style={S.formGrid}>
            {/* Farmer search */}
            <div style={S.formGroup}>
              <label style={S.label}>Farmer</label>
              {selectedFarmer ? (
                <div style={S.selectedFarmer}>
                  <div style={S.farmerAvatar}>
                    {selectedFarmer.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedFarmer.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedFarmer.code} · {selectedFarmer.route?.name} · KES {selectedFarmer.pricePerLitre}/L</div>
                  </div>
                  <button style={S.clearFarmer} onClick={() => { setSelectedFarmer(null); setLitres(''); setTimeout(() => searchRef.current?.focus(), 50); }}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchRef}
                    style={S.input}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or code..."
                    autoComplete="off"
                  />
                  {searching && <div style={S.searchingDot}>⏳</div>}
                  {searchResults.length > 0 && (
                    <div style={S.dropdown}>
                      {searchResults.map(f => (
                        <div key={f.id} style={S.dropdownItem} onClick={() => selectFarmer(f)}>
                          <span style={S.dropdownCode}>{f.code}</span>
                          <span style={{ flex: 1, fontWeight: 600 }}>{f.name}</span>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{f.route?.name}</span>
                          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>KES {f.pricePerLitre}/L</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Litres */}
            <div style={S.formGroup}>
              <label style={S.label}>Litres Collected</label>
              <input
                style={S.input}
                type="number"
                step="0.1"
                min="0.1"
                value={litres}
                onChange={e => setLitres(e.target.value)}
                placeholder="0.0"
                disabled={!selectedFarmer}
                onKeyDown={e => e.key === 'Enter' && handleRecord()}
              />
              {selectedFarmer && litres && Number(litres) > 0 && (
                <div style={S.valuePreview}>
                  Est. value: <strong>KES {fmtM(Number(litres) * selectedFarmer.pricePerLitre)}</strong>
                </div>
              )}
            </div>

            {/* Date */}
            <div style={S.formGroup}>
              <label style={S.label}>Collection Date</label>
              <input style={S.input} type="date" value={collDate} onChange={e => setCollDate(e.target.value)} />
            </div>
          </div>

          <button
            style={{ ...S.recordBtn, opacity: (!selectedFarmer || !litres || saving) ? 0.5 : 1 }}
            onClick={handleRecord}
            disabled={!selectedFarmer || !litres || saving}
          >
            {saving ? 'Saving...' : '✓ Record Collection'}
          </button>
        </div>
      )}

      {/* ══ VIEW TAB ════════════════════════════════════════════ */}
      {tab === 'view' && (
        <>
          {/* Filters */}
          <div style={S.filterBar}>
            <select style={S.select} value={routeId} onChange={e => { setRouteId(e.target.value ? Number(e.target.value) : ''); }}>
              <option value="">All Routes</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{total} records found</span>
          </div>

          <div style={S.tableWrap}>
            {loadingCols && collections.length === 0 ? (
              <div style={S.center}><div style={S.spinner} /></div>
            ) : collections.length === 0 ? (
              <div style={S.empty}><div style={{ fontSize: 40 }}>🥛</div><p>No collections for this date.</p></div>
            ) : (
              <>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['Time','Farmer','Code','Route','Litres','Value (KES)','Grader'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((c, i) => {
                      const d = new Date(c.collectedAt);
                      const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
                      const dayStr = d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
                      return (
                        <tr key={c.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ ...S.td, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{dayStr} {time}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{c.farmer.name}</td>
                          <td style={S.td}>
                            <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                              {c.farmer.code}
                            </span>
                          </td>
                          <td style={{ ...S.td, color: '#6b7280', fontSize: 12 }}>{c.route.name}</td>
                          <td style={{ ...S.td, fontWeight: 800, color: '#2563eb', fontSize: 15 }}>{fmt(c.litres)} L</td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#16a34a' }}>
                            {c.farmer.pricePerLitre ? fmtM(Number(c.litres) * c.farmer.pricePerLitre) : '—'}
                          </td>
                          <td style={{ ...S.td, fontSize: 12, color: '#6b7280' }}>{c.grader.name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f0fdf4' }}>
                      <td colSpan={4} style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
                      <td style={{ ...S.td, fontWeight: 800, color: '#16a34a', fontSize: 15 }}>
                        {fmt(collections.reduce((s, c) => s + Number(c.litres), 0))} L
                      </td>
                      <td colSpan={2} style={S.td} />
                    </tr>
                  </tfoot>
                </table>

                {collections.length < total && (
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <button style={S.loadMoreBtn} onClick={() => loadCollections(page + 1)} disabled={loadingCols}>
                      {loadingCols ? 'Loading...' : `Load more (${total - collections.length} remaining)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page:         { padding: 24, maxWidth: 1300, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:        { fontSize: 24, fontWeight: 800, color: '#111', margin: 0 },
  subtitle:     { fontSize: 14, color: '#6b7280', marginTop: 4 },
  datePicker:   { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#111' },

  summaryRow:   { display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' },
  summaryCard:  { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 160, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },

  routeGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 },
  routeCard:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1.5px solid', borderRadius: 10 },
  routeDot:     { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },

  tabs:         { display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab:          { border: 'none', background: 'transparent', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280' },
  tabActive:    { background: '#fff', color: '#16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },

  recordCard:   { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', maxWidth: 700 },
  recordTitle:  { fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 20 },

  successBanner:{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#166534', fontWeight: 600, marginBottom: 16 },
  errorBanner:  { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#991b1b', marginBottom: 16 },

  formGrid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  formGroup:    { display: 'flex', flexDirection: 'column', gap: 6 },
  label:        { fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  input:        { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  valuePreview: { fontSize: 12, color: '#16a34a', marginTop: 4 },

  selectedFarmer:{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '8px 12px' },
  farmerAvatar:  { width: 36, height: 36, borderRadius: 8, background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clearFarmer:   { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 2 },

  searchingDot:  { position: 'absolute', right: 12, top: 10, fontSize: 14 },
  dropdown:      { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, marginTop: 4, overflow: 'hidden' },
  dropdownItem:  { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 13 },
  dropdownCode:  { padding: '2px 6px', borderRadius: 5, fontSize: 11, fontWeight: 700, backgroundColor: '#f0fdf4', color: '#16a34a', flexShrink: 0 },

  recordBtn:    { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer', width: '100%' },

  filterBar:    { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 },
  select:       { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', cursor: 'pointer' },

  tableWrap:    { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 750 },
  th:           { padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td:           { padding: '11px 14px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  loadMoreBtn:  { background: '#fff', border: '1.5px solid #16a34a', color: '#16a34a', borderRadius: 8, padding: '9px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  center:       { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:      { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty:        { textAlign: 'center', padding: 60, color: '#9ca3af' },
};
