// src/pages/RoutesPage.tsx
// Drop this file into frontend/src/pages/RoutesPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { routesApi, farmersApi } from '../api/client';

// ── Types ────────────────────────────────────────────────────
interface Route {
  id: number;
  code: string;
  name: string;
  _count?: { farmers: number; collections: number };
}

interface Farmer {
  id: number;
  code: string;
  name: string;
  phone: string;
  pricePerLitre: number;
  paymentMethod: string;
  mpesaPhone?: string;
  bankName?: string;
  bankAccount?: string;
  paidOn15th: boolean;
  isActive: boolean;
}

// ── Colour palette — one per route (cycles) ──────────────────
const ROUTE_COLORS = [
  { bg: '#f0fdf4', border: '#86efac', badge: '#16a34a', text: '#14532d' },
  { bg: '#eff6ff', border: '#93c5fd', badge: '#2563eb', text: '#1e3a8a' },
  { bg: '#fdf4ff', border: '#d8b4fe', badge: '#9333ea', text: '#581c87' },
  { bg: '#fff7ed', border: '#fdba74', badge: '#ea580c', text: '#7c2d12' },
  { bg: '#f0fdfa', border: '#6ee7b7', badge: '#059669', text: '#064e3b' },
  { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', text: '#7f1d1d' },
  { bg: '#fffbeb', border: '#fcd34d', badge: '#d97706', text: '#78350f' },
  { bg: '#f8fafc', border: '#94a3b8', badge: '#475569', text: '#0f172a' },
];

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farmersLoading, setFarmersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const LIMIT = 50;

  // Load routes
  useEffect(() => {
    routesApi.list()
      .then(r => setRoutes(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load farmers when route selected
  const loadFarmers = useCallback(async (routeId: number, q = '', p = 1) => {
    setFarmersLoading(true);
    try {
      const res = await farmersApi.list({ routeId, search: q, page: p, limit: LIMIT });
      setFarmers(p === 1 ? (res.data.data ?? []) : prev => [...prev, ...(res.data.data ?? [])]);
      setTotal(res.data.total ?? 0);
      setPage(p);
    } catch {}
    finally { setFarmersLoading(false); }
  }, []);

  const handleRouteClick = (route: Route) => {
    setSelectedRoute(route);
    setSearch('');
    setFarmers([]);
    setPage(1);
    loadFarmers(route.id, '', 1);
  };

  const handleBack = () => {
    setSelectedRoute(null);
    setSelectedFarmer(null);
    setFarmers([]);
    setSearch('');
  };

  // Search with debounce
  useEffect(() => {
    if (!selectedRoute) return;
    const t = setTimeout(() => loadFarmers(selectedRoute.id, search, 1), 350);
    return () => clearTimeout(t);
  }, [search, selectedRoute, loadFarmers]);

  // ── Routes grid view ────────────────────────────────────────
  if (!selectedRoute) {
    return (
      <div style={styles.container}>
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>Collection Routes</h1>
            <p style={styles.pageSubtitle}>
              {loading ? 'Loading...' : `${routes.length} routes · click a route to view farmers`}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={styles.centerSpinner}>
            <div style={styles.spinner} />
          </div>
        ) : (
          <div style={styles.routeGrid}>
            {routes.map((route, idx) => {
              const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
              const farmerCount = (route as any)._count?.farmers ?? '–';
              return (
                <button
                  key={route.id}
                  style={{ ...styles.routeCard, backgroundColor: color.bg, borderColor: color.border }}
                  onClick={() => handleRouteClick(route)}
                >
                  <div style={{ ...styles.routeBadge, backgroundColor: color.badge }}>
                    {route.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={styles.routeCardBody}>
                    <span style={{ ...styles.routeName, color: color.text }}>{route.name}</span>
                    <span style={styles.routeMeta}>{farmerCount} farmers</span>
                  </div>
                  <span style={{ ...styles.routeArrow, color: color.badge }}>›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Farmer detail panel ─────────────────────────────────────
  if (selectedFarmer) {
    return (
      <div style={styles.container}>
        <div style={styles.pageHeader}>
          <div style={styles.breadcrumb}>
            <button style={styles.breadcrumbBtn} onClick={handleBack}>Routes</button>
            <span style={styles.breadcrumbSep}>›</span>
            <button style={styles.breadcrumbBtn} onClick={() => setSelectedFarmer(null)}>
              {selectedRoute.name}
            </button>
            <span style={styles.breadcrumbSep}>›</span>
            <span style={styles.breadcrumbCurrent}>{selectedFarmer.name}</span>
          </div>
        </div>

        <div style={styles.farmerDetailCard}>
          <div style={styles.farmerDetailHeader}>
            <div style={styles.farmerAvatar}>
              {selectedFarmer.name.split(' ').map((n: string) => n[0]).slice(0, 3).join('')}
            </div>
            <div>
              <h2 style={styles.farmerDetailName}>{selectedFarmer.name}</h2>
              <span style={styles.farmerDetailCode}>{selectedFarmer.code}</span>
            </div>
            <span style={{
              ...styles.statusBadge,
              backgroundColor: selectedFarmer.isActive ? '#dcfce7' : '#fee2e2',
              color: selectedFarmer.isActive ? '#16a34a' : '#dc2626',
            }}>
              {selectedFarmer.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div style={styles.detailGrid}>
            {[
              ['Route', selectedRoute.name],
              ['Member Code', selectedFarmer.code],
              ['Phone', selectedFarmer.phone],
              ['Price / Litre', `KES ${Number(selectedFarmer.pricePerLitre).toFixed(2)}`],
              ['Payment Method', selectedFarmer.paymentMethod],
              ...(selectedFarmer.paymentMethod === 'MPESA'
                ? [['M-Pesa Number', selectedFarmer.mpesaPhone ?? '–']]
                : [
                    ['Bank', (selectedFarmer as any).bankName ?? '–'],
                    ['Account Number', (selectedFarmer as any).bankAccount ?? '–'],
                  ]
              ),
              ['Payment Date', selectedFarmer.paidOn15th ? '15th (Mid-month)' : 'End of month'],
            ].map(([label, value]) => (
              <div key={label} style={styles.detailRow}>
                <span style={styles.detailLabel}>{label}</span>
                <span style={styles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Farmers list for selected route ────────────────────────
  const routeIdx = routes.findIndex(r => r.id === selectedRoute.id);
  const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div style={styles.breadcrumb}>
          <button style={styles.breadcrumbBtn} onClick={handleBack}>Routes</button>
          <span style={styles.breadcrumbSep}>›</span>
          <span style={styles.breadcrumbCurrent}>{selectedRoute.name}</span>
        </div>
        <span style={{ ...styles.countPill, backgroundColor: color.bg, color: color.badge, borderColor: color.border }}>
          {total} farmers
        </span>
      </div>

      {/* Search */}
      <div style={styles.searchBar}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.searchInput}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search farmers in ${selectedRoute.name}...`}
        />
        {search && (
          <button style={styles.clearBtn} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Farmers table */}
      {farmersLoading && farmers.length === 0 ? (
        <div style={styles.centerSpinner}><div style={styles.spinner} /></div>
      ) : farmers.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👨‍🌾</div>
          <p>No farmers found{search ? ` for "${search}"` : ''}.</p>
        </div>
      ) : (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Code', 'Name', 'Phone', 'KES/L', 'Payment', 'Account', 'Pay Date'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {farmers.map((farmer, i) => (
                  <tr
                    key={farmer.id}
                    style={{ ...styles.tr, backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}
                    onClick={() => setSelectedFarmer(farmer)}
                  >
                    <td style={styles.td}>
                      <span style={{ ...styles.codePill, backgroundColor: color.bg, color: color.badge }}>
                        {farmer.code}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600, minWidth: 200 }}>{farmer.name}</td>
                    <td style={styles.td}>{farmer.phone}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#16a34a' }}>
                      {Number(farmer.pricePerLitre).toFixed(0)}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.methodPill,
                        backgroundColor: farmer.paymentMethod === 'MPESA' ? '#dcfce7' : '#dbeafe',
                        color: farmer.paymentMethod === 'MPESA' ? '#16a34a' : '#2563eb',
                      }}>
                        {farmer.paymentMethod}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontSize: 12, color: '#6b7280' }}>
                      {farmer.paymentMethod === 'MPESA'
                        ? (farmer.mpesaPhone ?? '–')
                        : (farmer.bankAccount ?? '–')}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.methodPill,
                        backgroundColor: farmer.paidOn15th ? '#fef9c3' : '#f3f4f6',
                        color: farmer.paidOn15th ? '#92400e' : '#6b7280',
                      }}>
                        {farmer.paidOn15th ? '15th' : 'End'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {farmers.length < total && (
            <div style={styles.loadMoreWrap}>
              <button
                style={{ ...styles.loadMoreBtn, borderColor: color.badge, color: color.badge }}
                onClick={() => loadFarmers(selectedRoute.id, search, page + 1)}
                disabled={farmersLoading}
              >
                {farmersLoading ? 'Loading...' : `Load more (${total - farmers.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', maxWidth: 1200, margin: '0 auto' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: '#111', margin: 0 },
  pageSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8 },
  breadcrumbBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontWeight: 600, fontSize: 15, padding: 0 },
  breadcrumbSep: { color: '#9ca3af', fontSize: 18 },
  breadcrumbCurrent: { fontWeight: 700, color: '#111', fontSize: 15 },
  countPill: { padding: '4px 14px', borderRadius: 20, border: '1px solid', fontWeight: 700, fontSize: 13 },

  routeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 },
  routeCard: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
    border: '1.5px solid', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
    transition: 'transform 0.1s, box-shadow 0.1s', background: 'none', width: '100%',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  routeBadge: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 },
  routeCardBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  routeName: { fontWeight: 700, fontSize: 15 },
  routeMeta: { fontSize: 12, color: '#9ca3af' },
  routeArrow: { fontSize: 22, fontWeight: 700 },

  searchBar: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '10px 16px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent', color: '#111' },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0 },

  tableWrap: { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 },
  th: { padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  tr: { cursor: 'pointer', transition: 'background 0.1s' },
  td: { padding: '11px 14px', borderBottom: '1px solid #f3f4f6', color: '#374151' },
  codePill: { padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  methodPill: { padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 },

  loadMoreWrap: { textAlign: 'center', marginTop: 20 },
  loadMoreBtn: { background: '#fff', border: '1.5px solid', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },

  farmerDetailCard: { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  farmerDetailHeader: { display: 'flex', alignItems: 'center', gap: 16, padding: 24, background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' },
  farmerAvatar: { width: 56, height: 56, borderRadius: 14, background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  farmerDetailName: { fontSize: 20, fontWeight: 800, color: '#111', margin: 0 },
  farmerDetailCode: { fontSize: 13, color: '#6b7280', marginTop: 2, display: 'block' },
  statusBadge: { marginLeft: 'auto', padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12 },
  detailGrid: { padding: '8px 24px 24px', display: 'flex', flexDirection: 'column' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid #f3f4f6', gap: 24 },
  detailLabel: { fontSize: 13, color: '#6b7280', flexShrink: 0, minWidth: 130 },
  detailValue: { fontSize: 14, fontWeight: 600, color: '#111', textAlign: 'right' as const },

  centerSpinner: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  emptyState: { textAlign: 'center', padding: 60, color: '#9ca3af' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
};
