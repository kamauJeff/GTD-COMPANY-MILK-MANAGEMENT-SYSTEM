import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { showSuccess, showError, showWarning } from '../components/Toast';
import { Plus, Truck, Store, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, X, Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
type Tab = 'dispatch' | 'trips' | 'sales' | 'reconcile' | 'assign';

export default function ShopsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [tab, setTab]     = useState<Tab>('dispatch');
  const [date, setDate]   = useState(now.toISOString().split('T')[0]);
  const [expandedTrip, setExpandedTrip] = useState<number | null>(null);
  const [showNewTrip, setShowNewTrip]   = useState(false);
  const [showAddDrop, setShowAddDrop]   = useState<number | null>(null);
  const [tripForm, setTripForm]   = useState({ driverId: '', tripDate: now.toISOString().split('T')[0], notes: '' });
  const [dropForm, setDropForm]   = useState({ shopId: '', litres: '' });
  const [saleForm, setSaleForm]   = useState({ shopId: '', litresSold: '', cashCollected: '', tillAmount: '', saleDate: now.toISOString().split('T')[0] });
  const qc = useQueryClient();

  const { data: shopsData }   = useQuery({ queryKey: ['shops'], queryFn: () => api.get('/api/shops') });
  const { data: driversData } = useQuery({ queryKey: ['drivers'], queryFn: () => api.get('/api/drivers') });
  const { data: employeesData } = useQuery({ queryKey: ['shopkeepers'], queryFn: () => api.get('/api/employees', { params: { role: 'SHOPKEEPER' } }), enabled: tab === 'assign' });

  const shops:   any[] = shopsData?.data   ?? [];
  const drivers: any[] = driversData?.data ?? [];
  const shopkeepers: any[] = employeesData?.data ?? [];

  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ['trips', month, year],
    queryFn: () => api.get('/api/drivers/trips', { params: { month, year } }),
    staleTime: 0,
    enabled: tab === 'trips' || tab === 'dispatch',
  });
  const trips: any[] = tripsData?.data ?? [];

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['daily-summary', date],
    queryFn: () => api.get('/api/drivers/daily-summary', { params: { date } }),
    staleTime: 0,
    enabled: tab === 'reconcile',
  });
  const summary = summaryData?.data || {};

  const { data: salesData } = useQuery({
    queryKey: ['shop-sales', month, year],
    queryFn: () => api.get('/api/shop-sales', { params: { month, year } }),
    staleTime: 0,
    enabled: tab === 'sales',
  });
  const sales: any[] = salesData?.data?.sales ?? salesData?.data ?? [];

  // Monthly grid
  const { data: gridData } = useQuery({
    queryKey: ['shops-monthly', month, year],
    queryFn: () => api.get('/api/shops/monthly-grid', { params: { month, year } }),
    staleTime: 0,
    enabled: tab === 'sales',
  });
  const grid: any[] = gridData?.data?.grid ?? [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const createTripMut = useMutation({
    mutationFn: () => api.post('/api/drivers/trips', { ...tripForm, driverId: Number(tripForm.driverId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setShowNewTrip(false); setTripForm({ driverId: '', tripDate: now.toISOString().split('T')[0], notes: '' }); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const addDropMut = useMutation({
    mutationFn: (tripId: number) => api.post(`/api/drivers/trips/${tripId}/drops`, { shopId: Number(dropForm.shopId), litres: Number(dropForm.litres) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setShowAddDrop(null); setDropForm({ shopId: '', litres: '' }); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const confirmTripMut = useMutation({
    mutationFn: (id: number) => api.post(`/api/drivers/trips/${id}/confirm`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); qc.invalidateQueries({ queryKey: ['report-shops'] }); qc.invalidateQueries({ queryKey: ['report-daily-ledger'] }); qc.invalidateQueries({ queryKey: ['litres-ledger'] }); showSuccess('Trip confirmed'); },
  });

  const deleteDropMut = useMutation({
    mutationFn: ({ tripId, dropId }: { tripId: number; dropId: number }) => api.delete(`/api/drivers/trips/${tripId}/drops/${dropId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });

  const addSaleMut = useMutation({
    mutationFn: () => api.post('/api/shop-sales', {
      shopId: Number(saleForm.shopId),
      litresSold: Number(saleForm.litresSold),
      cashCollected: Number(saleForm.cashCollected),
      tillAmount: Number(saleForm.tillAmount || 0),
      saleDate: saleForm.saleDate,
      expectedRevenue: Number(saleForm.litresSold) * 60,
      variance: (Number(saleForm.cashCollected) + Number(saleForm.tillAmount || 0)) - (Number(saleForm.litresSold) * 60),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-sales'] }); qc.invalidateQueries({ queryKey: ['shops-monthly'] }); qc.invalidateQueries({ queryKey: ['daily-summary'] }); qc.invalidateQueries({ queryKey: ['report-shops'] }); qc.invalidateQueries({ queryKey: ['report-daily-ledger'] }); qc.invalidateQueries({ queryKey: ['litres-ledger'] }); setSaleForm(f => ({ ...f, litresSold: '', cashCollected: '', tillAmount: '' })); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const assignMut = useMutation({
    mutationFn: ({ shopId, keeperId }: any) => api.put(`/api/shops/${shopId}/assign`, { keeperId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }),
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const statusColor = (status: string) => ({ PENDING: 'bg-yellow-100 text-yellow-700', CONFIRMED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-600' }[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300');

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Shops & Sales</h1>
          <p className="text-sm text-gray-500">{shops.length} shops · {MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          ['dispatch', '🚚 Dispatch & Trips'],
          ['trips',    '📋 Trip Records'],
          ['sales',    '🏪 Shop Sales'],
          ['reconcile','⚖️ Daily Reconcile'],
          ['assign',   '👤 Assign Shopkeepers'],
        ] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-green-600 text-white' : 'border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── DISPATCH & TRIPS ── */}
      {(tab === 'dispatch' || tab === 'trips') && (
        <div className="space-y-4">
          {tab === 'dispatch' && (
            <div className="flex gap-2">
              <button onClick={() => setShowNewTrip(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                <Plus size={14} /> New Dispatch
              </button>
            </div>
          )}

          {/* New trip form */}
          {showNewTrip && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">🚚 New Driver Dispatch</h3>
                <button onClick={() => setShowNewTrip(false)}><X size={18} className="text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Driver *</label>
                  <select value={tripForm.driverId} onChange={e => setTripForm(f => ({...f, driverId: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select driver...</option>
                    {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date</label>
                  <input type="date" value={tripForm.tripDate} onChange={e => setTripForm(f => ({...f, tripDate: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                  <input value={tripForm.notes} onChange={e => setTripForm(f => ({...f, notes: e.target.value}))}
                    placeholder="Optional..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <button onClick={() => createTripMut.mutate()} disabled={!tripForm.driverId || createTripMut.isPending}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {createTripMut.isPending ? 'Creating...' : 'Create Trip — Add Shop Drops Next'}
              </button>
            </div>
          )}

          {/* Trips list */}
          {tripsLoading ? <div className="bg-white dark:bg-gray-900 rounded-xl border p-12 text-center text-gray-400">Loading trips...</div>
          : trips.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border p-12 text-center text-gray-400">
              <Truck size={40} className="mx-auto mb-3 opacity-30" />
              <div className="font-medium">No trips this month</div>
              <div className="text-sm mt-1">Create a dispatch to get started</div>
            </div>
          ) : trips.map((trip: any) => {
            const isExpanded = expandedTrip === trip.id;
            const dropsTotal = trip.shopDrops?.reduce((s: number, d: any) => s + Number(d.litres), 0) || 0;
            return (
              <div key={trip.id} className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden">
                {/* Trip header */}
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <Truck size={16} className="text-gray-400" />
                    <div>
                      <div className="font-semibold text-gray-800">{trip.driver?.name}</div>
                      <div className="text-xs text-gray-400">{new Date(trip.tripDate).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })} · {trip.shopDrops?.length || 0} shops · {dropsTotal.toFixed(1)} L</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(trip.status)}`}>{trip.status}</span>
                    {trip.status === 'PENDING' && (
                      <button onClick={e => { e.stopPropagation(); confirmTripMut.mutate(trip.id); }}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        ✓ Confirm
                      </button>
                    )}
                  </div>
                </div>

                {/* Trip drops */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                        <tr>
                          {['Shop','Litres Dropped','Time',''].map(h => (
                            <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trip.shopDrops?.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-sm">No drops recorded yet</td></tr>
                        ) : trip.shopDrops?.map((drop: any) => (
                          <tr key={drop.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-2.5 font-medium">{drop.shop?.name}</td>
                            <td className="px-4 py-2.5 font-bold text-green-700">{Number(drop.litres).toFixed(1)} L</td>
                            <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(drop.droppedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-2.5">
                              <button onClick={() => deleteDropMut.mutate({ tripId: trip.id, dropId: drop.id })}
                                className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
                        <tr>
                          <td className="px-4 py-2 font-bold text-xs text-gray-600">TOTAL</td>
                          <td className="px-4 py-2 font-bold text-green-700">{dropsTotal.toFixed(1)} L</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>

                    {/* Add drop */}
                    {trip.status === 'PENDING' && (
                      showAddDrop === trip.id ? (
                        <div className="p-4 bg-green-50 border-t flex gap-3 flex-wrap items-end">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Shop</label>
                            <select value={dropForm.shopId} onChange={e => setDropForm(f => ({...f, shopId: e.target.value}))}
                              className="px-3 py-2 border rounded-lg text-sm min-w-[160px]">
                              <option value="">Select shop...</option>
                              {shops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Litres</label>
                            <input type="number" value={dropForm.litres} onChange={e => setDropForm(f => ({...f, litres: e.target.value}))}
                              placeholder="0.0" className="px-3 py-2 border rounded-lg text-sm w-28" />
                          </div>
                          <button onClick={() => addDropMut.mutate(trip.id)} disabled={!dropForm.shopId || !dropForm.litres || addDropMut.isPending}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            Add Drop
                          </button>
                          <button onClick={() => setShowAddDrop(null)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
                        </div>
                      ) : (
                        <div className="p-3 border-t dark:border-gray-700">
                          <button onClick={() => setShowAddDrop(trip.id)}
                            className="flex items-center gap-2 px-3 py-2 border border-dashed border-green-400 text-green-600 rounded-lg text-sm hover:bg-green-50 w-full justify-center">
                            <Plus size={14} /> Add Shop Drop
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── SHOP SALES ── */}
      {tab === 'sales' && (
        <div className="space-y-4">
          {/* Record sale form */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Record Shop Sale</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Shop *</label>
                <select value={saleForm.shopId} onChange={e => setSaleForm(f => ({...f, shopId: e.target.value}))}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select shop...</option>
                  {shops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <input type="date" value={saleForm.saleDate} onChange={e => setSaleForm(f => ({...f, saleDate: e.target.value}))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Litres Sold *</label>
                <input type="number" value={saleForm.litresSold} onChange={e => setSaleForm(f => ({...f, litresSold: e.target.value}))}
                  placeholder="0.0" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cash Collected (KES)</label>
                <input type="number" value={saleForm.cashCollected} onChange={e => setSaleForm(f => ({...f, cashCollected: e.target.value}))}
                  placeholder="0" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Till/KopoKopo (KES)</label>
                <input type="number" value={saleForm.tillAmount} onChange={e => setSaleForm(f => ({...f, tillAmount: e.target.value}))}
                  placeholder="0" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={() => addSaleMut.mutate()} disabled={!saleForm.shopId || !saleForm.litresSold || addSaleMut.isPending}
                  className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {addSaleMut.isPending ? 'Saving...' : 'Record Sale'}
                </button>
              </div>
            </div>
            {saleForm.litresSold && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm flex gap-4 flex-wrap">
                <span>Expected: <strong>KES {(Number(saleForm.litresSold)*60).toLocaleString()}</strong></span>
                {saleForm.cashCollected && <span>Collected: <strong>KES {(Number(saleForm.cashCollected)+Number(saleForm.tillAmount||0)).toLocaleString()}</strong></span>}
                {saleForm.cashCollected && <span className={Number(saleForm.cashCollected)+Number(saleForm.tillAmount||0) < Number(saleForm.litresSold)*60 ? 'text-red-600' : 'text-green-600'}>
                  Variance: <strong>KES {(Number(saleForm.cashCollected)+Number(saleForm.tillAmount||0)-Number(saleForm.litresSold)*60).toLocaleString()}</strong>
                </span>}
              </div>
            )}
          </div>

          {/* Monthly grid */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-700">Monthly Sales Grid</div>
            {grid.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No sales recorded yet</div>
            ) : (
              <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                <table className="text-xs border-collapse" style={{ minWidth: `${200 + daysInMonth * 44}px` }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-800 text-white">
                      <th className="sticky left-0 bg-gray-800 z-30 px-3 py-2.5 text-left min-w-[170px]">SHOP</th>
                      {days.map(d => <th key={d} className="px-1 py-2.5 text-center w-11">{d}</th>)}
                      <th className="sticky right-0 bg-gray-800 px-3 py-2.5 text-right min-w-[60px]">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row: any, idx: number) => {
                      const rowTotal = days.reduce((s, d) => s + (row.days?.[d]?.litres || 0), 0);
                      return (
                        <tr key={idx} className={`border-b ${idx%2===0?'bg-white dark:bg-gray-900':'bg-gray-50'} hover:bg-green-50`}>
                          <td className={`sticky left-0 z-10 px-3 py-2 border-r ${idx%2===0?'bg-white dark:bg-gray-900':'bg-gray-50'}`}>
                            <div className="font-medium text-gray-800 text-xs">{row.shop?.name}</div>
                            {row.shop?.keeper && <div className="text-xs text-gray-400">{row.shop.keeper.name}</div>}
                          </td>
                          {days.map(d => {
                            const cell = row.days?.[d];
                            const hasVariance = cell && Number(cell.variance) !== 0;
                            return (
                              <td key={d} className="px-0.5 py-2 text-center border-r border-gray-50">
                                {cell?.litres > 0 ? (
                                  <div title={`Cash: ${Number(cell.cash||0).toLocaleString()} + Till: ${Number(cell.till||0).toLocaleString()}`}>
                                    <div className="font-medium text-green-700">{Number(cell.litres).toFixed(0)}</div>
                                    {hasVariance && <div className={`text-xs font-bold ${Number(cell.variance) < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                                      {Number(cell.variance) > 0 ? '+' : ''}{Number(cell.variance).toFixed(0)}
                                    </div>}
                                  </div>
                                ) : <span className="text-gray-200">–</span>}
                              </td>
                            );
                          })}
                          <td className="sticky right-0 bg-green-50 px-3 py-2 text-right font-bold text-green-700 border-l text-xs">
                            {rowTotal > 0 ? rowTotal.toFixed(0) : '–'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-800 text-white font-bold sticky bottom-0">
                      <td className="sticky left-0 bg-gray-800 z-10 px-3 py-2.5 text-xs">TOTAL</td>
                      {days.map(d => {
                        const t = grid.reduce((s: number, r: any) => s + (r.days?.[d]?.litres || 0), 0);
                        return <td key={d} className="px-0.5 py-2.5 text-center text-xs">{t > 0 ? <span className="text-green-300">{t.toFixed(0)}</span> : <span className="text-gray-600">–</span>}</td>;
                      })}
                      <td className="sticky right-0 bg-gray-800 px-3 py-2.5 text-right text-green-300 text-xs">
                        {grid.reduce((s: number, r: any) => s + days.reduce((ss: number, d: number) => ss + (r.days?.[d]?.litres || 0), 0), 0).toFixed(0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DAILY RECONCILIATION ── */}
      {tab === 'reconcile' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Date:</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm" />
          </div>

          {summaryLoading ? <div className="bg-white dark:bg-gray-900 rounded-xl border p-12 text-center text-gray-400">Loading...</div>
          : !summary.shops?.length ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border p-12 text-center text-gray-400">
              <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
              <div className="font-medium">No data for this date</div>
              <div className="text-sm mt-1">Record trips and sales first</div>
            </div>
          ) : (
            <>
              {/* Summary totals */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Dispatched', value: `${(summary.totals?.delivered || 0).toFixed(1)} L`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Total Sold', value: `${(summary.totals?.sold || 0).toFixed(1)} L`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                  { label: 'Cash Collected', value: `KES ${(summary.totals?.cash || 0).toLocaleString()}`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                  { label: 'Till (KopoKopo)', value: `KES ${(summary.totals?.till || 0).toLocaleString()}`, color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
                  { label: 'Total Revenue', value: `KES ${(summary.totals?.revenue || 0).toLocaleString()}`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                    <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Per-shop breakdown */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                    <tr>{['Shop','Shopkeeper','Delivered','Sold','Unaccounted','Cash','Till','Expected Rev','Variance','Status'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {summary.shops.map((s: any) => {
                      const hasIssue = s.unaccounted > 0.5 || s.revenueVariance < -50;
                      return (
                        <tr key={s.shop.id} className={`border-b ${hasIssue ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <td className="px-3 py-2.5 font-medium">{s.shop.name}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{s.shop.keeper?.name || '–'}</td>
                          <td className="px-3 py-2.5 font-mono text-blue-700">{s.delivered.toFixed(1)} L</td>
                          <td className="px-3 py-2.5 font-mono text-green-700">{s.sold.toFixed(1)} L</td>
                          <td className={`px-3 py-2.5 font-bold font-mono ${s.unaccounted > 0.5 ? 'text-red-600' : 'text-gray-400'}`}>
                            {s.unaccounted.toFixed(1)} L
                          </td>
                          <td className="px-3 py-2.5 font-mono">KES {s.cash.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono">KES {s.till.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono">KES {s.expectedRevenue.toLocaleString()}</td>
                          <td className={`px-3 py-2.5 font-bold font-mono ${s.revenueVariance < -50 ? 'text-red-600' : s.revenueVariance > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {s.revenueVariance >= 0 ? '+' : ''}KES {s.revenueVariance.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5">
                            {hasIssue
                              ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12} /> Issue</span>
                              : <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ASSIGN SHOPKEEPERS ── */}
      {tab === 'assign' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b text-sm text-gray-600">
            Assign each shop to a dedicated shopkeeper for accountability and performance monitoring.
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>{['Shop','Code','Location','Till Number','Current Shopkeeper','Change Assignment'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {shops.map((shop: any) => (
                <tr key={shop.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{shop.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{shop.code}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{shop.location || '–'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{shop.tillNumber || '–'}</td>
                  <td className="px-4 py-3">
                    {shop.keeper ? (
                      <div>
                        <div className="font-medium text-sm">{shop.keeper.name}</div>
                        <div className="text-xs text-gray-400">{shop.keeper.code}</div>
                      </div>
                    ) : <span className="text-xs text-red-400 italic">⚠ Not assigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select value={shop.keeper?.id || shop.keeperId || ''}
                      onChange={e => e.target.value && assignMut.mutate({ shopId: shop.id, keeperId: Number(e.target.value) })}
                      className="px-2 py-1.5 border rounded-lg text-xs min-w-[180px]">
                      <option value="">— Select shopkeeper —</option>
                      {shopkeepers.map((sk: any) => <option key={sk.id} value={sk.id}>{sk.name} ({sk.code})</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
