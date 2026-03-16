import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopsApi } from '../api/client';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ShopsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<'monthly' | 'record'>('monthly');
  const [saleForm, setSaleForm] = useState({ shopId: '', saleDate: new Date().toISOString().split('T')[0], litresSold: '', sellingPrice: '60', cashCollected: '', tillAmount: '' });
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops'], queryFn: () => shopsApi.list() });
  const shops: any[] = shopsData?.data ?? [];

  const { data: gridData, isLoading } = useQuery({
    queryKey: ['shops-monthly', month, year],
    queryFn: () => shopsApi.monthlyGrid({ month, year }),
  });
  const grid: any[] = gridData?.data?.grid ?? [];
  const daysInMonth = new Date(year, month, 0).getDate();

  const recordMutation = useMutation({
    mutationFn: (data: any) => shopsApi.createSale(data),
    onSuccess: () => { alert('Sale recorded!'); qc.invalidateQueries({ queryKey: ['shops-monthly'] }); setSaleForm(f => ({ ...f, litresSold: '', cashCollected: '', tillAmount: '' })); },
    onError: () => alert('Failed to record sale'),
  });

  const handleRecord = () => {
    if (!saleForm.shopId || !saleForm.litresSold || !saleForm.cashCollected) { alert('Fill all required fields'); return; }
    const litres = Number(saleForm.litresSold);
    const price = Number(saleForm.sellingPrice);
    const expected = litres * price;
    recordMutation.mutate({
      shopId: Number(saleForm.shopId),
      saleDate: saleForm.saleDate,
      litresSold: litres,
      expectedRevenue: expected,
      cashCollected: Number(saleForm.cashCollected),
      tillAmount: Number(saleForm.tillAmount || 0),
      variance: Number(saleForm.cashCollected) + Number(saleForm.tillAmount || 0) - expected,
    });
  };

  // Compute totals per day
  const dailyTotals: Record<number, number> = {};
  for (let d = 1; d <= daysInMonth; d++) dailyTotals[d] = 0;
  grid.forEach((row: any) => {
    Object.entries(row.days || {}).forEach(([day, val]: any) => {
      dailyTotals[Number(day)] = (dailyTotals[Number(day)] || 0) + Number(val.litresSold || 0);
    });
  });
  const grandTotal = Object.values(dailyTotals).reduce((s, v) => s + v, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Shop Sales</h1>
          <p className="text-sm text-gray-500">Daily milk sales across all distribution units · {MONTHS[month-1]} {year}
            {shops.length > 0 && <span className="ml-2 text-green-600 font-medium">· {shops.length} shops loaded</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="text-xs text-gray-400 mb-1">Total Litres Sold</div>
          <div className="text-2xl font-bold text-green-700">{grandTotal.toFixed(1)} L</div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="text-xs text-gray-400 mb-1">Active Shops</div>
          <div className="text-2xl font-bold text-blue-700">{shops.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="text-xs text-gray-400 mb-1">Expected Revenue</div>
          <div className="text-2xl font-bold text-purple-700">KES {(grandTotal * 60).toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('monthly')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'monthly' ? 'bg-green-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
          📊 Monthly Grid
        </button>
        <button onClick={() => setTab('record')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'record' ? 'bg-green-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
          ✏ Record Sale
        </button>
      </div>

      {tab === 'record' && (
        <div className="bg-white rounded-xl border p-6 shadow-sm max-w-lg">
          <h3 className="font-semibold text-gray-800 mb-4">Record Daily Sale</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Shop *</label>
              <select value={saleForm.shopId} onChange={e => setSaleForm(f => ({...f, shopId: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select shop...</option>
                {shops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date *</label>
                <input type="date" value={saleForm.saleDate} onChange={e => setSaleForm(f => ({...f, saleDate: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Litres Sold *</label>
                <input type="number" value={saleForm.litresSold} onChange={e => setSaleForm(f => ({...f, litresSold: e.target.value}))}
                  placeholder="0.0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Selling Price/L</label>
                <input type="number" value={saleForm.sellingPrice} onChange={e => setSaleForm(f => ({...f, sellingPrice: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cash Collected *</label>
                <input type="number" value={saleForm.cashCollected} onChange={e => setSaleForm(f => ({...f, cashCollected: e.target.value}))}
                  placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Till Amount (KopoKopo)</label>
                <input type="number" value={saleForm.tillAmount} onChange={e => setSaleForm(f => ({...f, tillAmount: e.target.value}))}
                  placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {saleForm.litresSold && saleForm.sellingPrice && (
                <div className="flex items-end pb-1">
                  <div>
                    <div className="text-xs text-gray-400">Expected</div>
                    <div className="font-bold text-green-700">KES {(Number(saleForm.litresSold) * Number(saleForm.sellingPrice)).toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleRecord} disabled={recordMutation.isPending}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 mt-2">
              {recordMutation.isPending ? 'Recording...' : 'Record Sale'}
            </button>
          </div>
        </div>
      )}

      {tab === 'monthly' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading grid...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse" style={{ minWidth: `${200 + daysInMonth * 48}px` }}>
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="sticky left-0 bg-gray-800 px-3 py-2 text-left font-medium min-w-[180px] z-10">SHOP</th>
                    {Array.from({length: daysInMonth}, (_, i) => i + 1).map(d => (
                      <th key={d} className="px-1 py-2 text-center font-medium w-12">{d}</th>
                    ))}
                    <th className="px-3 py-2 text-center font-medium bg-green-800">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row: any, idx: number) => {
                    const rowTotal = Object.values(row.days || {}).reduce((s: number, v: any) => s + Number(v.litresSold || 0), 0);
                    return (
                      <tr key={idx} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50`}>
                        <td className="sticky left-0 px-3 py-2 font-medium text-gray-700 border-r bg-inherit z-10">{row.shop?.name}</td>
                        {Array.from({length: daysInMonth}, (_, i) => i + 1).map(d => {
                          const cell = row.days?.[d];
                          return (
                            <td key={d} className="px-1 py-2 text-center border-r border-gray-100">
                              {cell ? (
                                <span className={`${Number(cell.litresSold) > 0 ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
                                  {Number(cell.litresSold) > 0 ? Number(cell.litresSold).toFixed(0) : '–'}
                                </span>
                              ) : <span className="text-gray-200">–</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-green-700 bg-green-50">{rowTotal > 0 ? rowTotal.toFixed(1) : '–'}</td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-800 text-white font-bold">
                    <td className="sticky left-0 bg-gray-800 px-3 py-2 z-10">DAILY TOTALS</td>
                    {Array.from({length: daysInMonth}, (_, i) => i + 1).map(d => (
                      <td key={d} className="px-1 py-2 text-center text-xs">
                        {dailyTotals[d] > 0 ? dailyTotals[d].toFixed(0) : '–'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center bg-green-700">{grandTotal.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
