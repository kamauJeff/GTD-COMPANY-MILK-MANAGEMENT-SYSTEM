// src/pages/ShopsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { shopsApi } from '../api/client';

interface ShopRow  { id: number; code: string; name: string; unit: string; daily: number[]; total: number }
interface UnitData   { [unit: string]: ShopRow[] }
interface UnitTotals { [unit: string]: number[] }
interface Shop       { id: number; code: string; name: string; unit: string }

const MONTHS = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const NOW = new Date();

const UNIT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  KCU:    { bg: '#f0fdf4', border: '#86efac', text: '#14532d', badge: '#16a34a' },
  KCQ:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e3a8a', badge: '#2563eb' },
  KDE:    { bg: '#fdf4ff', border: '#d8b4fe', text: '#581c87', badge: '#9333ea' },
  KCN:    { bg: '#fff7ed', border: '#fdba74', text: '#7c2d12', badge: '#ea580c' },
  KBP:    { bg: '#f0fdfa', border: '#6ee7b7', text: '#064e3b', badge: '#059669' },
  OTHERS: { bg: '#fffbeb', border: '#fcd34d', text: '#78350f', badge: '#d97706' },
};

const fmtL = (n: number) => n > 0
  ? Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  : '';

export default function ShopsPage() {
  const [month, setMonth]           = useState(NOW.getMonth() + 1);
  const [year, setYear]             = useState(NOW.getFullYear());
  const [tab, setTab]               = useState<'grid' | 'record'>('grid');
  const [activeUnit, setActiveUnit] = useState<string>('ALL');

  // All shops loaded once from DB
  const [allShops, setAllShops]       = useState<Shop[]>([]);
  const [shopsLoaded, setShopsLoaded] = useState(false);

  // Grid/sales data
  const [units, setUnits]             = useState<UnitData>({});
  const [unitTotals, setUnitTotals]   = useState<UnitTotals>({});
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [loading, setLoading]         = useState(false);

  // Record form
  const [filterUnit, setFilterUnit] = useState('');
  const [selShop, setSelShop]       = useState<Shop | null>(null);
  const [saleDate, setSaleDate]     = useState(NOW.toISOString().split('T')[0]);
  const [litres, setLitres]         = useState('');
  const [cash, setCash]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ type: 'ok'|'err'; text: string }|null>(null);

  // Load all shops once on mount
  useEffect(() => {
    shopsApi.list()
      .then(r => { setAllShops(r.data ?? []); setShopsLoaded(true); })
      .catch(() => setShopsLoaded(true));
  }, []);

  // Load grid — depends on month/year only, NOT activeUnit
  const loadGrid = useCallback(async (shopsList: Shop[], m: number, y: number) => {
    setLoading(true);
    try {
      const res = await shopsApi.monthlyGrid({ month: m, year: y });
      const dim: number       = res.data.daysInMonth ?? 31;
      const gridUnits: UnitData   = res.data.units ?? {};
      const gridTotals: UnitTotals = res.data.unitTotals ?? {};

      // Start with every shop from DB showing zero daily
      const merged: UnitData = {};
      shopsList.forEach(shop => {
        const u = shop.unit ?? 'OTHERS';
        if (!merged[u]) merged[u] = [];
        merged[u].push({ id: shop.id, code: shop.code, name: shop.name, unit: u,
          daily: Array(dim).fill(0), total: 0 });
      });

      // Overlay real sales data
      Object.entries(gridUnits).forEach(([u, rows]) => {
        rows.forEach(row => {
          if (!merged[u]) merged[u] = [];
          const existing = merged[u].find(s => s.id === row.id);
          if (existing) { existing.daily = row.daily; existing.total = row.total; }
          else merged[u].push(row);
        });
      });

      // Sort alphabetically
      Object.keys(merged).forEach(u => {
        merged[u].sort((a, b) => a.name.localeCompare(b.name));
      });

      setUnits(merged);
      setUnitTotals(gridTotals);
      setDaysInMonth(dim);
    } catch (e) {
      console.error('Grid load error:', e);
    } finally { setLoading(false); }
  }, []);

  // Trigger grid when shops ready or month/year changes
  useEffect(() => {
    if (shopsLoaded) loadGrid(allShops, month, year);
  }, [shopsLoaded, allShops, month, year, loadGrid]);

  async function handleRecord() {
    if (!selShop || !litres) return;
    setSaving(true); setMsg(null);
    try {
      await shopsApi.createSale({
        shopId: selShop.id, saleDate,
        litresSold: Number(litres),
        cashCollected: Number(cash || 0),
        sellingPrice: 65,
      });
      setMsg({ type: 'ok', text: `✓ Saved ${litres}L for ${selShop.name} on ${saleDate}` });
      setLitres(''); setCash(''); setSelShop(null);
      loadGrid(allShops, month, year);
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error ?? 'Failed to save' });
    } finally { setSaving(false); }
  }

  const allUnitKeys   = Object.keys(UNIT_COLORS).filter(u => (units[u]?.length ?? 0) > 0 || allShops.some(s => s.unit === u));
  const displayUnits  = activeUnit === 'ALL' ? allUnitKeys : [activeUnit].filter(u => units[u] || allShops.some(s => s.unit === u));
  const dayLabels     = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const grandTotal    = allUnitKeys.reduce((s, u) => s + (units[u] ?? []).reduce((ss, sh) => ss + sh.total, 0), 0);
  const grandDailyTotals = Array.from({ length: daysInMonth }, (_, i) => allUnitKeys.reduce((s, u) => s + (unitTotals[u]?.[i] ?? 0), 0));
  const recordShops   = filterUnit ? allShops.filter(s => s.unit === filterUnit) : allShops;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Shop Sales</h1>
          <p style={S.subtitle}>
            Daily milk sales across all distribution units · {MONTHS[month]} {year}
            {shopsLoaded && (
              <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 700 }}>
                · {allShops.length} shops loaded
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select style={S.select} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select style={S.select} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[NOW.getFullYear()-1, NOW.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Unit filter cards — clicking sets activeUnit, does NOT reload data */}
      <div style={S.unitCards}>
        <button
          style={{ ...S.unitCard, backgroundColor: '#f8fafc',
            borderColor: activeUnit === 'ALL' ? '#0f172a' : '#e2e8f0',
            boxShadow: activeUnit === 'ALL' ? '0 4px 14px rgba(0,0,0,0.18)' : 'none',
            transform: activeUnit === 'ALL' ? 'scale(1.04)' : 'scale(1)' }}
          onClick={() => setActiveUnit('ALL')}
        >
          <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>ALL UNITS</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{fmtL(grandTotal) || '0'} L</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{allUnitKeys.length} units · {allShops.length} shops</div>
        </button>

        {Object.entries(UNIT_COLORS).map(([unit, c]) => {
          const count     = allShops.filter(s => s.unit === unit).length;
          if (count === 0) return null;
          const unitTotal = (units[unit] ?? []).reduce((s, sh) => s + sh.total, 0);
          const isActive  = activeUnit === unit;
          return (
            <button key={unit}
              style={{ ...S.unitCard, backgroundColor: c.bg,
                borderColor: isActive ? c.badge : c.border,
                boxShadow: isActive ? `0 4px 14px ${c.badge}50` : 'none',
                transform: isActive ? 'scale(1.04)' : 'scale(1)' }}
              onClick={() => setActiveUnit(unit)}
            >
              <div style={{ ...S.unitBadge, backgroundColor: c.badge }}>{unit}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: c.badge, marginTop: 6 }}>{fmtL(unitTotal) || '0'} L</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{count} shops</div>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button style={{ ...S.tab, ...(tab === 'grid'   ? S.tabActive : {}) }} onClick={() => setTab('grid')}>📊 Monthly Grid</button>
        <button style={{ ...S.tab, ...(tab === 'record' ? S.tabActive : {}) }} onClick={() => setTab('record')}>✏️ Record Sale</button>
      </div>

      {/* GRID TAB */}
      {tab === 'grid' && (
        loading ? (
          <div style={S.center}><div style={S.spinner} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {displayUnits.map(unit => {
              const shopList  = units[unit] ?? allShops.filter(s => s.unit === unit).map(s => ({ ...s, daily: Array(daysInMonth).fill(0), total: 0 }));
              const totals    = unitTotals[unit] ?? Array(daysInMonth).fill(0);
              const c         = UNIT_COLORS[unit] ?? UNIT_COLORS.OTHERS;
              const unitTotal = shopList.reduce((s, sh) => s + sh.total, 0);

              return (
                <div key={unit} style={{ ...S.unitSection, borderColor: c.border }}>
                  <div style={{ ...S.unitHeader, backgroundColor: c.bg, borderBottomColor: c.border }}>
                    <span style={{ ...S.unitBadge, backgroundColor: c.badge }}>{unit}</span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: c.text, flex: 1, marginLeft: 10 }}>Unit {unit}</span>
                    <span style={{ fontWeight: 900, fontSize: 15, color: c.badge }}>{fmtL(unitTotal) || '0'} L</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 12 }}>{shopList.length} shops</span>
                  </div>
                  <div style={S.gridWrap}>
                    <table style={S.grid}>
                      <thead>
                        <tr>
                          <th style={S.shopNameTh}>Shop</th>
                          {dayLabels.map(d => <th key={d} style={S.dayTh}>{d}</th>)}
                          <th style={{ ...S.dayTh, ...S.totalTh }}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopList.map((shop, i) => (
                          <tr key={shop.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={S.shopNameTd}>{shop.name}</td>
                            {shop.daily.map((v, di) => (
                              <td key={di} style={{ ...S.dayTd, color: v > 0 ? '#111' : '#d1d5db', fontWeight: v > 0 ? 600 : 400 }}>
                                {v > 0 ? fmtL(v) : '·'}
                              </td>
                            ))}
                            <td style={{ ...S.dayTd, ...S.totalCell, color: c.badge }}>{fmtL(shop.total) || '·'}</td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: c.bg }}>
                          <td style={{ ...S.shopNameTd, fontWeight: 800, color: c.text }}>TOTAL</td>
                          {Array.from({ length: daysInMonth }, (_, i) => totals[i] ?? 0).map((v, di) => (
                            <td key={di} style={{ ...S.dayTd, fontWeight: 800, color: v > 0 ? c.badge : '#d1d5db' }}>
                              {v > 0 ? fmtL(v) : '·'}
                            </td>
                          ))}
                          <td style={{ ...S.dayTd, ...S.totalCell, fontWeight: 900, color: c.badge }}>
                            {fmtL(totals.reduce((s, v) => s + v, 0)) || '·'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {activeUnit === 'ALL' && allUnitKeys.length > 1 && (
              <div style={{ ...S.unitSection, borderColor: '#94a3b8' }}>
                <div style={{ ...S.unitHeader, backgroundColor: '#f8fafc', borderBottomColor: '#e2e8f0' }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>GRAND TOTAL — ALL UNITS</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: '#0f172a', marginLeft: 'auto' }}>{fmtL(grandTotal) || '0'} L</span>
                </div>
                <div style={S.gridWrap}>
                  <table style={S.grid}>
                    <thead>
                      <tr>
                        <th style={S.shopNameTh}>Unit</th>
                        {dayLabels.map(d => <th key={d} style={S.dayTh}>{d}</th>)}
                        <th style={{ ...S.dayTh, ...S.totalTh }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUnitKeys.map((unit, i) => {
                        const c      = UNIT_COLORS[unit] ?? UNIT_COLORS.OTHERS;
                        const tots   = unitTotals[unit] ?? [];
                        const uTotal = tots.reduce((s, v) => s + v, 0);
                        return (
                          <tr key={unit} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={S.shopNameTd}>
                              <span style={{ ...S.unitBadge, backgroundColor: c.badge, fontSize: 10 }}>{unit}</span>
                            </td>
                            {Array.from({ length: daysInMonth }, (_, i) => tots[i] ?? 0).map((v, di) => (
                              <td key={di} style={{ ...S.dayTd, color: v > 0 ? '#111' : '#d1d5db', fontWeight: v > 0 ? 600 : 400 }}>
                                {v > 0 ? fmtL(v) : '·'}
                              </td>
                            ))}
                            <td style={{ ...S.dayTd, ...S.totalCell, color: c.badge, fontWeight: 800 }}>{fmtL(uTotal) || '·'}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <td style={{ ...S.shopNameTd, fontWeight: 900 }}>GRAND TOTAL</td>
                        {grandDailyTotals.map((v, di) => (
                          <td key={di} style={{ ...S.dayTd, fontWeight: 800, color: v > 0 ? '#0f172a' : '#d1d5db' }}>
                            {v > 0 ? fmtL(v) : '·'}
                          </td>
                        ))}
                        <td style={{ ...S.dayTd, ...S.totalCell, fontWeight: 900, color: '#0f172a' }}>{fmtL(grandTotal) || '0'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* RECORD TAB */}
      {tab === 'record' && (
        <div style={S.recordCard}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Record Shop Sale</div>

          {msg && (
            <div style={{ ...S.banner, backgroundColor: msg.type==='ok'?'#f0fdf4':'#fef2f2', borderColor: msg.type==='ok'?'#86efac':'#fca5a5', color: msg.type==='ok'?'#166534':'#991b1b' }}>
              {msg.text}
            </div>
          )}

          <div style={S.formGrid}>
            <div style={S.formGroup}>
              <label style={S.label}>Filter by Unit</label>
              <select style={S.input} value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setSelShop(null); }}>
                <option value="">All units ({allShops.length} shops)</option>
                {Object.keys(UNIT_COLORS).map(u => {
                  const count = allShops.filter(s => s.unit === u).length;
                  return count > 0 ? <option key={u} value={u}>{u} — {count} shops</option> : null;
                })}
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Shop ({recordShops.length} available)</label>
              <select style={S.input} value={selShop?.id ?? ''}
                onChange={e => setSelShop(allShops.find(s => s.id === Number(e.target.value)) ?? null)}>
                <option value="">Select shop...</option>
                {recordShops.map(s => (
                  <option key={s.id} value={s.id}>[{s.unit}] {s.name}</option>
                ))}
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Sale Date</label>
              <input style={S.input} type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Litres Sold</label>
              <input style={S.input} type="number" step="1" min="1" value={litres}
                onChange={e => setLitres(e.target.value)} placeholder="0"
                onKeyDown={e => e.key === 'Enter' && handleRecord()} />
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Cash Collected (KES)</label>
              <input style={S.input} type="number" step="0.01" min="0" value={cash}
                onChange={e => setCash(e.target.value)} placeholder="0.00" />
              {litres && cash && Number(litres) > 0 && (
                <div style={{ fontSize: 12, marginTop: 4, color: Number(cash) >= Number(litres)*65 ? '#16a34a' : '#dc2626' }}>
                  Expected: KES {(Number(litres)*65).toLocaleString()} @ 65/L
                  {Number(cash) < Number(litres)*65
                    ? ` · Shortfall: KES ${((Number(litres)*65)-Number(cash)).toLocaleString()}`
                    : ' ✓'}
                </div>
              )}
            </div>
          </div>

          <button style={{ ...S.recordBtn, opacity: (!selShop||!litres||saving)?0.5:1 }}
            onClick={handleRecord} disabled={!selShop||!litres||saving}>
            {saving ? 'Saving...' : '✓ Record Sale'}
          </button>

          {allShops.length === 0 && shopsLoaded && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef9c3', borderRadius: 8, fontSize: 13, color: '#854d0e' }}>
              ⚠️ No shops in database. Run: <code>npx ts-node --transpile-only src/seedShops.ts</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:        { padding: 24, maxWidth: '100%', margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:       { fontSize: 24, fontWeight: 800, color: '#111', margin: 0 },
  subtitle:    { fontSize: 14, color: '#6b7280', marginTop: 4 },
  select:      { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', cursor: 'pointer' },
  unitCards:   { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 },
  unitCard:    { border: '2.5px solid', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', background: 'none', minWidth: 110, transition: 'all 0.15s ease' },
  unitBadge:   { display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, color: '#fff' },
  tabs:        { display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab:         { border: 'none', background: 'transparent', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280' },
  tabActive:   { background: '#fff', color: '#16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  unitSection: { border: '1.5px solid', borderRadius: 14, overflow: 'hidden' },
  unitHeader:  { display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1.5px solid', gap: 8 },
  gridWrap:    { overflowX: 'auto' },
  grid:        { width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' },
  shopNameTh:  { padding: '8px 12px', textAlign: 'left', fontWeight: 700, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', width: 150, position: 'sticky', left: 0, zIndex: 2 },
  shopNameTd:  { padding: '7px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f3f4f6', width: 150, position: 'sticky', left: 0, background: 'inherit', zIndex: 1 },
  dayTh:       { padding: '8px 4px', textAlign: 'center', fontWeight: 700, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', width: 34, minWidth: 34, color: '#6b7280' },
  dayTd:       { padding: '7px 4px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', width: 34 },
  totalTh:     { fontWeight: 800, color: '#111', background: '#f1f5f9', minWidth: 58 },
  totalCell:   { fontWeight: 800, background: '#f9fafb', minWidth: 58 },
  recordCard:  { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 28, maxWidth: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  banner:      { border: '1px solid', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 600, marginBottom: 16 },
  formGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  formGroup:   { display: 'flex', flexDirection: 'column', gap: 6 },
  label:       { fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  input:       { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box' as const },
  recordBtn:   { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer', width: '100%' },
  center:      { display: 'flex', justifyContent: 'center', padding: 80 },
  spinner:     { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};
