// src/pages/FarmersPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmersApi } from '../api/client';
import { Search, Upload, Download, Plus } from 'lucide-react';

export default function FarmersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['farmers', search, page],
    queryFn: () => farmersApi.list({ search, page, limit: 50 }),
  });

  const farmers: any[] = data?.data?.data ?? [];
  const total: number = data?.data?.total ?? 0;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { await farmersApi.importExcel(file); alert('Import successful!'); }
    catch { alert('Import failed. Check the file format.'); }
  };

  const handleExport = async () => {
    const res = await farmersApi.exportExcel();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url; a.download = 'farmers.xlsx'; a.click();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Farmers</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} farmers registered</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <Upload size={14} /> Import Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus size={14} /> Add Farmer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search farmersâ€¦"
          className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Code', 'Name', 'Phone', 'Route', 'Price/L', 'Payment', 'Status'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loadingâ€¦</td></tr>
            ) : farmers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No farmers found.</td></tr>
            ) : farmers.map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.code}</td>
                <td className="px-4 py-3 font-medium">{f.name}</td>
                <td className="px-4 py-3 text-gray-500">{f.phone}</td>
                <td className="px-4 py-3">{f.route?.name ?? 'â€“'}</td>
                <td className="px-4 py-3 font-mono">KES {Number(f.pricePerLitre).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {f.paymentMethod}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${f.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {f.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {total > 50 && (
          <div className="flex justify-between items-center px-4 py-3 border-t text-sm text-gray-500">
            <span>Showing {(page - 1) * 50 + 1}â€“{Math.min(page * 50, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

