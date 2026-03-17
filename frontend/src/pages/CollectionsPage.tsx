import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectionsApi, routesApi } from '../api/client';
import { Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CollectionsPage() {
  const now = new Date();
  const [month, setMonth]       = useState(now.getMonth() + 1);
  const [year, setYear]         = useState(now.getFullYear());
  const [routeId, setRouteId]   = useState('');
  const [search, setSearch]     = useState('');

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });
  const routes: any[] = routesData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['journal-grid', month, year, routeId],
    queryFn: () => collectionsApi.list({ month, year, routeId: routeId || undefined }),
    // Use journal endpoint
  });

  const { data: gridData, isLoading: gridLoading } = useQuery({
    queryKey: ['collection-journal', month, year, routeId],
    queryFn: () => collectionsApi.journal({ month, year, routeId: routeId || undefined }),
  });

  const grid = gridData?.data;
  const farmers: any[] = grid?.farmers ?? [];
  const dayTotals: Record<number, number> = grid?.dayTotals ?? {};
  const daysInMonth: number = grid?.daysInMonth ?? new Date(year, month, 0).getDate();
  const grandTotal: number = grid?.grandTotal ?? 0;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const filtered = search
    ? farmers.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase()))
    : farmers;

  const handleExcel = async () => {
    try {
      const res = await collectionsApi.list({ month, year, routeId: routeId || undefined, format: 'excel' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `collections-${MONTHS[month-1]}-${year}.xlsx`;
      a.click();
    } catch { alert('Export not available yet'); }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Milk Collections</h1>
          <p className="text-sm text-gray-500">
            {MONTHS[month-1]} {year} · {farmers.length} farmers · {grandTotal.toFixed(1)} L total
          </p>
        </div>
        <button onClick={handleExcel}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          <Download size={14} /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={routeId} onChange={e => setRouteId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px]">
          <option value="">All Routes</option>
          {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search farmer..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400 mb-1">Farmers</div>
          <div className="text-xl font-bold text-gray-800">{farmers.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400 mb-1">Total Litres</div>
          <div className="text-xl font-bold text-green-700">{grandTotal.toFixed(1)} L</div>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400 mb-1">Avg per Farmer</div>
          <div className="text-xl font-bold text-blue-700">
            {farmers.length > 0 ? (grandTotal / farmers.length).toFixed(1) : '0'} L
          </div>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400 mb-1">Gross Value</div>
          <div className="text-xl font-bold text-purple-700">KES {(grandTotal * 46).toLocaleString()}</div>
        </div>
      </div>

      {/* Journal Grid */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {gridLoading ? (
          <div className="text-center py-16 text-gray-400">Loading journal...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🥛</div>
            <div className="font-medium">No collections found</div>
            <div className="text-sm mt-1">
              {routeId ? 'No data for this route yet' : 'Select a route or check if the mobile app has synced'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${220 + daysInMonth * 40 + 70}px` }}>
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="sticky left-0 bg-gray-800 z-20 px-3 py-2.5 text-left min-w-[60px]">CODE</th>
                  <th className="sticky left-[60px] bg-gray-800 z-20 px-3 py-2.5 text-left min-w-[160px] border-r border-gray-700">NAME</th>
                  {days.map(d => (
                    <th key={d} className={`px-1 py-2.5 text-center w-10 font-medium ${dayTotals[d] > 0 ? 'text-green-300' : 'text-gray-500'}`}>
                      {d}
                    </th>
                  ))}
                  <th className="sticky right-0 bg-gray-800 px-3 py-2.5 text-right min-w-[65px] border-l border-gray-700">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((farmer, idx) => (
                  <tr key={farmer.id}
                    className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50`}>
                    <td className={`sticky left-0 z-10 px-3 py-2 font-mono text-gray-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {farmer.code}
                    </td>
                    <td className={`sticky left-[60px] z-10 px-3 py-2 font-medium text-gray-800 border-r border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {farmer.name}
                      {farmer.route && !routeId && (
                        <div className="text-xs text-gray-400 font-normal">{farmer.route.name}</div>
                      )}
                    </td>
                    {days.map(d => {
                      const val = farmer.days[d];
                      return (
                        <td key={d} className="px-0.5 py-2 text-center border-r border-gray-50">
                          {val > 0 ? (
                            <span className={`font-medium ${val >= 20 ? 'text-green-700' : val >= 10 ? 'text-green-600' : 'text-green-500'}`}>
                              {val % 1 === 0 ? val : val.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-200">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 px-3 py-2 text-right font-bold text-green-700 border-l border-gray-100 bg-green-50">
                      {farmer.total.toFixed(1)}
                    </td>
                  </tr>
                ))}

                {/* Day totals row */}
                <tr className="bg-gray-800 text-white font-bold border-t-2">
                  <td className="sticky left-0 bg-gray-800 z-10 px-3 py-2.5" colSpan={2}>DAILY TOTAL</td>
                  {days.map(d => (
                    <td key={d} className="px-0.5 py-2.5 text-center text-xs">
                      {dayTotals[d] > 0 ? (
                        <span className="text-green-300">{Number(dayTotals[d]).toFixed(0)}</span>
                      ) : <span className="text-gray-600">–</span>}
                    </td>
                  ))}
                  <td className="sticky right-0 bg-gray-800 px-3 py-2.5 text-right text-green-300">
                    {grandTotal.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
