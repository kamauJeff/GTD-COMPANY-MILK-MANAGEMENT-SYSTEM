import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmersApi, routesApi } from '../api/client';
import { Search, Upload, Download, Plus, Phone, CreditCard, Building2 } from 'lucide-react';

export default function FarmersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [routeFilter, setRouteFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['farmers', search, page, routeFilter, showInactive],
    queryFn: () => farmersApi.list({ search, page, limit: 50, routeId: routeFilter || undefined, isActive: showInactive ? undefined : true }),
  });

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });

  const farmers: any[] = data?.data?.data ?? [];
  const total: number = data?.data?.total ?? 0;
  const routes: any[] = routesData?.data ?? [];

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { await farmersApi.importExcel(file); alert('Import successful!'); refetch(); }
    catch { alert('Import failed.'); }
  };

  const handleExport = async () => {
    const res = await farmersApi.exportExcel();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url; a.download = 'farmers.xlsx'; a.click();
  };

  const handleFixPhones = async () => {
    if (!confirm('Fix all phone numbers to 254XXXXXXXXX format?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/farmers/fix-phones`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      alert(data.message); refetch();
    } catch { alert('Failed to fix phones'); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Farmers</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} farmers registered across {routes.length} routes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleFixPhones} className="flex items-center gap-2 px-3 py-2 text-xs border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50">
            <Phone size={12} /> Fix Phones to 254
          </button>
          <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <Upload size={14} /> Import Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus size={14} /> Add Farmer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, code or phone…"
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <select value={routeFilter} onChange={e => { setRouteFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">All Routes</option>
          {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['#', 'Code', 'Full Name', 'Phone (254)', 'Route', 'Price/L', 'Payment', 'Bank / Account', 'Period', 'Status'].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-gray-500 font-medium whitespace-nowrap text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : farmers.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">No farmers found. Try a different search.</td></tr>
              ) : farmers.map((f, i) => (
                <tr key={f.id} onClick={() => setSelected(f === selected ? null : f)}
                  className={`border-b last:border-0 hover:bg-green-50 cursor-pointer transition-colors ${selected?.id === f.id ? 'bg-green-50' : ''}`}>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{(page - 1) * 50 + i + 1}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{f.code}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{f.name}</td>
                  <td className="px-3 py-2.5">
                    <span className={`font-mono text-xs ${f.phone?.startsWith('254') ? 'text-green-700' : 'text-orange-600 font-bold'}`}>
                      {f.phone}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{f.route?.name ?? '–'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">KES {Number(f.pricePerLitre).toFixed(0)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {f.paymentMethod === 'MPESA' ? '📱 M-Pesa' : '🏦 Bank'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {f.paymentMethod === 'BANK' ? (
                      <div>
                        <div className="font-medium text-gray-700">{f.bankName || '–'}</div>
                        <div className="font-mono text-xs">{f.bankAccount || '–'}</div>
                      </div>
                    ) : (
                      <span className="font-mono">{f.mpesaPhone || f.phone}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${f.paidOn15th ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {f.paidOn15th ? 'Mid Month' : 'End Month'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${f.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
                      {f.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 50 && (
          <div className="flex justify-between items-center px-4 py-3 border-t text-sm text-gray-500 bg-gray-50">
            <span>Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-white">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-white">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Selected farmer detail card */}
      {selected && (
        <div className="mt-4 bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg text-gray-800">{selected.name}</h3>
              <p className="text-sm text-gray-500">{selected.code} · {selected.route?.name}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><div className="text-gray-400 text-xs mb-1">Phone</div><div className="font-mono font-medium">{selected.phone}</div></div>
            <div><div className="text-gray-400 text-xs mb-1">Payment Method</div><div>{selected.paymentMethod}</div></div>
            <div><div className="text-gray-400 text-xs mb-1">Payment Period</div><div>{selected.paidOn15th ? 'Mid Month (15th)' : 'End Month'}</div></div>
            <div><div className="text-gray-400 text-xs mb-1">Price per Litre</div><div className="font-mono">KES {Number(selected.pricePerLitre).toFixed(2)}</div></div>
            {selected.paymentMethod === 'BANK' && <>
              <div><div className="text-gray-400 text-xs mb-1">Bank Name</div><div>{selected.bankName || '–'}</div></div>
              <div><div className="text-gray-400 text-xs mb-1">Account No.</div><div className="font-mono">{selected.bankAccount || '–'}</div></div>
            </>}
            {selected.paymentMethod === 'MPESA' && <>
              <div><div className="text-gray-400 text-xs mb-1">M-Pesa Phone</div><div className="font-mono">{selected.mpesaPhone || selected.phone}</div></div>
            </>}
            {selected.idNumber && <div><div className="text-gray-400 text-xs mb-1">ID Number</div><div>{selected.idNumber}</div></div>}
          </div>
        </div>
      )}
    </div>
  );
}
