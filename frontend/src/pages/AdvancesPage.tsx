import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { showSuccess, showError } from '../components/Toast';
import { Plus, Trash2, Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ADVANCE_DATES = [5, 10, 20, 25];

export default function AdvancesPage() {
  const now = new Date();
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [routeId, setRouteId] = useState('');
  const [tab, setTab]         = useState<'advances'|'deductions'>('advances');
  const [bulkMode, setBulkMode] = useState(false);

  // Form for single advance
  const [form, setForm] = useState({
    farmerCode: '', amount: '', advanceDate: ADVANCE_DATES[0].toString(), notes: ''
  });
  const [farmerSearch, setFarmerSearch] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);

  // Bulk: routeId + advanceDate → list of farmers with amount inputs
  const [bulkDate, setBulkDate]     = useState(ADVANCE_DATES[0]);
  const [bulkAmounts, setBulkAmounts] = useState<Record<string, string>>({});

  const qc = useQueryClient();

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => api.get('/api/routes') });
  const routes: any[] = routesData?.data ?? [];

  // Live farmer search for single-entry form
  const { data: farmerSuggestData } = useQuery({
    queryKey: ['farmer-suggest', farmerSearch],
    queryFn: () => api.get('/api/farmers', { params: { search: farmerSearch, limit: 8, isActive: true } }),
    enabled: farmerSearch.length >= 1 && !selectedFarmer,
    staleTime: 0,
  });
  const farmerSuggestions: any[] = farmerSuggestData?.data?.data ?? [];

  // Load advances for this period
  const { data: advancesData, isLoading } = useQuery({
    queryKey: ['advances-page', month, year, routeId, tab],
    queryFn: () => tab === 'advances'
      ? api.get('/api/payments/advances', { params: { month, year, routeId: routeId || undefined } })
      : api.get('/api/collections/deductions', { params: { month, year, routeId: routeId || undefined } }),
  });
  const advances: any[] = advancesData?.data ?? [];

  // Farmers for bulk entry
  const { data: farmersData } = useQuery({
    queryKey: ['farmers-bulk', routeId],
    queryFn: () => api.get('/api/farmers', { params: { routeId: Number(routeId), limit: 200, isActive: true } }),
    staleTime: 0,
    enabled: bulkMode && !!routeId,
  });
  const bulkFarmers: any[] = farmersData?.data?.data ?? farmersData?.data ?? [];

  const addMut = useMutation({
    mutationFn: () => {
      const d = new Date(year, month - 1, Number(form.advanceDate));
      return api.post('/api/payments/advance', {
        farmerCode: form.farmerCode.toUpperCase(),
        amount: Number(form.amount),
        date: d.toISOString(),
        notes: form.notes || `Advance ${form.advanceDate}th`,
      });
    },
    onSuccess: (r) => {
      showSuccess(`Advance recorded — ${r.data.farmer?.name}`);
      qc.invalidateQueries({ queryKey: ['advances-page'] });
      setForm(f => ({ ...f, farmerCode: '', amount: '' }));
      setFarmerSearch('');
      setSelectedFarmer(null);
    },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const d = new Date(year, month - 1, bulkDate);
      const entries = Object.entries(bulkAmounts).filter(([, amt]) => Number(amt) > 0);
      const results = await Promise.all(entries.map(([code, amt]) =>
        api.post('/api/payments/advance', { farmerCode: code, amount: Number(amt), date: d.toISOString(), notes: `Advance ${bulkDate}th` })
      ));
      return results;
    },
    onSuccess: (r) => {
      showSuccess(`${r.length} advances recorded`);
      qc.invalidateQueries({ queryKey: ['advances-page'] });
      setBulkAmounts({});
    },
    onError: (e: any) => showError(e?.response?.data?.error || 'Bulk entry failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/payments/advance/${id}`),
    onSuccess: () => { showSuccess('Deleted'); qc.invalidateQueries({ queryKey: ['advances-page'] }); qc.invalidateQueries({ queryKey: ['collection-journal'] }); qc.invalidateQueries({ queryKey: ['payments-preview'] }); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);

  // Group by advance date
  const byDate: Record<string, any[]> = {};
  for (const a of advances) {
    const d = new Date(a.advanceDate).getDate();
    const key = `${d}th`;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(a);
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">Advances & Deductions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{MONTHS[month-1]} {year} · {advances.length} records · KES {totalAdvances.toLocaleString()}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={routeId} onChange={e => setRouteId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-w-[150px]">
            <option value="">All Routes</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('advances')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'advances' ? 'bg-orange-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>💰 Advances</button>
        <button onClick={() => setTab('deductions')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'deductions' ? 'bg-red-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>📉 Deductions</button>
        {tab === 'advances' && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setBulkMode(false)} className={`px-3 py-2 rounded-xl text-xs font-medium ${!bulkMode ? 'bg-green-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>Single Entry</button>
            <button onClick={() => setBulkMode(true)} className={`px-3 py-2 rounded-xl text-xs font-medium ${bulkMode ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>⚡ Bulk Entry</button>
          </div>
        )}
      </div>

      {/* Single entry form */}
      {tab === 'advances' && !bulkMode && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Record Advance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Farmer Name or Code *</label>
              <input value={farmerSearch}
                onChange={e => { setFarmerSearch(e.target.value); setSelectedFarmer(null); setForm(f => ({...f, farmerCode: e.target.value.toUpperCase()})); }}
                placeholder="Search by name or code..."
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 dark:text-gray-100" />
              {selectedFarmer && (
                <div className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
                  ✓ {selectedFarmer.name} · {selectedFarmer.code} · {selectedFarmer.route?.name}
                </div>
              )}
              {farmerSuggestions.length > 0 && !selectedFarmer && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                  {farmerSuggestions.map((f: any) => (
                    <button key={f.id} type="button"
                      onClick={() => { setSelectedFarmer(f); setFarmerSearch(f.name); setForm(frm => ({...frm, farmerCode: f.code})); }}
                      className="w-full text-left px-3 py-2 hover:bg-green-50 dark:hover:bg-green-900/20 border-b last:border-0 dark:border-gray-700 text-sm">
                      <span className="font-medium dark:text-gray-100">{f.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{f.code} · {f.route?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Amount (KES) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 dark:text-gray-100 font-mono" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Advance Date</label>
              <select value={form.advanceDate} onChange={e => setForm(f => ({...f, advanceDate: e.target.value}))}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 dark:text-gray-100">
                {ADVANCE_DATES.map(d => <option key={d} value={d}>{d}th {MONTHS[month-1]}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => addMut.mutate()} disabled={!form.farmerCode || !form.amount || addMut.isPending}
                className="w-full py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 disabled:opacity-50 text-sm">
                {addMut.isPending ? 'Saving...' : '+ Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk entry form */}
      {tab === 'advances' && bulkMode && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">⚡ Bulk Advance Entry</h3>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-gray-500 dark:text-gray-400">Route:</label>
              <select value={routeId} onChange={e => setRouteId(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-100">
                <option value="">Select route...</option>
                {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-gray-500 dark:text-gray-400">Date:</label>
              <select value={bulkDate} onChange={e => setBulkDate(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-100">
                {ADVANCE_DATES.map(d => <option key={d} value={d}>{d}th {MONTHS[month-1]}</option>)}
              </select>
            </div>
            <button onClick={() => bulkMut.mutate()} disabled={!routeId || Object.values(bulkAmounts).every(v => !Number(v)) || bulkMut.isPending}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {bulkMut.isPending ? 'Saving...' : `Save All (${Object.values(bulkAmounts).filter(v => Number(v) > 0).length} entries)`}
            </button>
          </div>

          {!routeId ? (
            <div className="text-center py-8 text-gray-400 text-sm">Select a route to load farmers</div>
          ) : bulkFarmers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No farmers on this route</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Code</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Farmer Name</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Payment</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400 w-36">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkFarmers.map((f: any) => (
                    <tr key={f.id} className={`border-b dark:border-gray-700 ${bulkAmounts[f.code] && Number(bulkAmounts[f.code]) > 0 ? 'bg-orange-50 dark:bg-orange-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-400">{f.code}</td>
                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{f.name}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${f.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {f.paymentMethod === 'MPESA' ? '📱' : '🏦'} {f.paymentMethod}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={bulkAmounts[f.code] || ''}
                          onChange={e => setBulkAmounts(prev => ({ ...prev, [f.code]: e.target.value }))}
                          placeholder="0" min="0"
                          className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-100 font-mono text-right" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300">TOTAL</td>
                    <td className="px-3 py-2 text-right font-bold text-orange-600 font-mono text-sm">
                      KES {Object.values(bulkAmounts).reduce((s, v) => s + (Number(v) || 0), 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Records list — grouped by date */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border p-12 text-center text-gray-400">Loading...</div>
      ) : advances.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
          <div className="text-3xl mb-3">💰</div>
          <div className="font-medium">No {tab} recorded for {MONTHS[month-1]} {year}</div>
        </div>
      ) : Object.entries(byDate).map(([dateKey, items]) => (
        <div key={dateKey} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
            <div className="font-semibold text-orange-700 dark:text-orange-400">{dateKey} {MONTHS[month-1]} — {items.length} farmers</div>
            <div className="font-bold text-orange-600 dark:text-orange-400">
              KES {items.reduce((s, a) => s + Number(a.amount), 0).toLocaleString()}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>{['Code','Farmer','Route','Method','Amount','Notes',''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {items.map((a: any) => (
                <tr key={a.id} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{a.farmer?.code}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{a.farmer?.name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{a.farmer?.route?.name || '–'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.farmer?.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700'}`}>
                      {a.farmer?.paymentMethod === 'MPESA' ? '📱' : '🏦'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-orange-600 font-mono">KES {Number(a.amount).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{a.notes || '–'}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => deleteMut.mutate(a.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
