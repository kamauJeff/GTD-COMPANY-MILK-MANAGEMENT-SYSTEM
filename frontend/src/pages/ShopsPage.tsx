import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Store, User, TrendingUp, Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ShopsPage() {
  const now = new Date();
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());
  const [tab, setTab]       = useState<'shops'|'sales'|'assign'>('shops');
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [saleForm, setSaleForm] = useState({ shopId: '', litresSold: '', cashCollected: '', tillAmount: '', saleDate: new Date().toISOString().split('T')[0] });
  const qc = useQueryClient();

  const { data: shopsData, isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => api.get('/api/shops'),
  });
  const shops: any[] = shopsData?.data ?? [];

  const { data: salesData } = useQuery({
    queryKey: ['shop-sales', month, year],
    queryFn: () => api.get('/api/shop-sales', { params: { month, year } }),
    enabled: tab === 'sales',
  });
  const sales: any[] = salesData?.data?.sales ?? salesData?.data ?? [];

  const { data: employeesData } = useQuery({
    queryKey: ['shopkeepers'],
    queryFn: () => api.get('/api/employees', { params: { role: 'SHOPKEEPER' } }),
    enabled: tab === 'assign',
  });
  const shopkeepers: any[] = employeesData?.data ?? [];

  // Monthly grid
  const { data: gridData } = useQuery({
    queryKey: ['shops-monthly', month, year],
    queryFn: () => api.get('/api/shops/monthly-grid', { params: { month, year } }),
    enabled: tab === 'shops',
  });
  const grid = gridData?.data?.grid ?? [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const addSaleMut = useMutation({
    mutationFn: () => api.post('/api/shop-sales', {
      shopId: Number(saleForm.shopId),
      litresSold: Number(saleForm.litresSold),
      cashCollected: Number(saleForm.cashCollected),
      tillAmount: Number(saleForm.tillAmount || 0),
      saleDate: saleForm.saleDate,
      expectedRevenue: Number(saleForm.litresSold) * 60,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-sales'] });
      qc.invalidateQueries({ queryKey: ['shops-monthly'] });
      setSaleForm(f => ({ ...f, litresSold: '', cashCollected: '', tillAmount: '' }));
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed'),
  });

  const assignMut = useMutation({
    mutationFn: ({ shopId, keeperId }: { shopId: number; keeperId: number }) =>
      api.put(`/api/shops/${shopId}/assign`, { keeperId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }),
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to assign'),
  });

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Shops</h1>
          <p className="text-sm text-gray-500">{shops.length} shops · {MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex gap-2">
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
        {[['shops','📊 Monthly Grid'],['sales','📝 Record Sale'],['assign','👤 Assign Shopkeepers']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-green-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* MONTHLY GRID */}
      {tab === 'shops' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : grid.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Store size={40} className="mx-auto mb-3 opacity-30" />
              <div className="font-medium">No sales recorded yet</div>
              <div className="text-sm mt-1">Use "Record Sale" tab to add daily sales</div>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              <table className="text-xs border-collapse" style={{ minWidth: `${200 + daysInMonth * 48}px` }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-800 text-white">
                    <th className="sticky left-0 bg-gray-800 z-30 px-3 py-2.5 text-left min-w-[180px]">SHOP</th>
                    {days.map(d => <th key={d} className="px-1 py-2.5 text-center w-12 font-medium">{d}</th>)}
                    <th className="sticky right-0 bg-gray-800 px-3 py-2.5 text-right min-w-[65px]">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row: any, idx: number) => {
                    const rowTotal = days.reduce((s, d) => s + (row.days?.[d]?.litres || 0), 0);
                    return (
                      <tr key={idx} className={`border-b ${idx%2===0?'bg-white':'bg-gray-50'} hover:bg-green-50`}>
                        <td className={`sticky left-0 z-10 px-3 py-2 font-medium text-gray-800 border-r ${idx%2===0?'bg-white':'bg-gray-50'}`}>
                          <div>{row.shop?.name}</div>
                          {row.shop?.keeper && <div className="text-xs text-gray-400">{row.shop.keeper.name}</div>}
                        </td>
                        {days.map(d => {
                          const cell = row.days?.[d];
                          return (
                            <td key={d} className="px-0.5 py-2 text-center border-r border-gray-50">
                              {cell?.litres > 0 ? (
                                <div>
                                  <div className="font-medium text-green-700">{Number(cell.litres).toFixed(0)}</div>
                                  {cell.variance !== 0 && (
                                    <div className={`text-xs font-bold ${cell.variance < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                                      {cell.variance > 0 ? '+' : ''}{Number(cell.variance).toFixed(0)}
                                    </div>
                                  )}
                                </div>
                              ) : <span className="text-gray-200">–</span>}
                            </td>
                          );
                        })}
                        <td className="sticky right-0 bg-green-50 px-3 py-2 text-right font-bold text-green-700 border-l border-green-100">
                          {rowTotal > 0 ? rowTotal.toFixed(0) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="bg-gray-800 text-white font-bold sticky bottom-0">
                    <td className="sticky left-0 bg-gray-800 z-10 px-3 py-2.5">TOTAL</td>
                    {days.map(d => {
                      const dayTotal = grid.reduce((s: number, r: any) => s + (r.days?.[d]?.litres || 0), 0);
                      return (
                        <td key={d} className="px-0.5 py-2.5 text-center text-xs">
                          {dayTotal > 0 ? <span className="text-green-300">{dayTotal.toFixed(0)}</span> : <span className="text-gray-600">–</span>}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bg-gray-800 px-3 py-2.5 text-right text-green-300">
                      {grid.reduce((s: number, r: any) => s + days.reduce((ss: number, d: number) => ss + (r.days?.[d]?.litres || 0), 0), 0).toFixed(0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECORD SALE */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Record Daily Sale</h3>
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
                <label className="text-xs text-gray-500 mb-1 block">Till Amount (KES)</label>
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
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                Expected revenue: <strong>KES {(Number(saleForm.litresSold) * 60).toLocaleString()}</strong>
                {saleForm.cashCollected && saleForm.tillAmount && (
                  <span className="ml-3">Variance: <strong className={Number(saleForm.cashCollected)+Number(saleForm.tillAmount) < Number(saleForm.litresSold)*60 ? 'text-red-600' : 'text-green-600'}>
                    KES {(Number(saleForm.cashCollected)+Number(saleForm.tillAmount)-Number(saleForm.litresSold)*60).toLocaleString()}
                  </strong></span>
                )}
              </div>
            )}
          </div>

          {/* Sales list */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Date','Shop','Litres','Expected','Cash','Till','Variance','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">No sales this month</td></tr>
                ) : sales.map((s: any) => {
                  const expected = Number(s.litresSold) * 60;
                  const collected = Number(s.cashCollected) + Number(s.tillAmount || 0);
                  const variance = collected - expected;
                  return (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs">{new Date(s.saleDate).toLocaleDateString('en-KE')}</td>
                      <td className="px-3 py-2.5 font-medium">{s.shop?.name}</td>
                      <td className="px-3 py-2.5 font-mono text-green-700">{Number(s.litresSold).toFixed(1)} L</td>
                      <td className="px-3 py-2.5 font-mono">KES {expected.toLocaleString()}</td>
                      <td className="px-3 py-2.5 font-mono text-blue-700">KES {Number(s.cashCollected).toLocaleString()}</td>
                      <td className="px-3 py-2.5 font-mono text-purple-700">KES {Number(s.tillAmount||0).toLocaleString()}</td>
                      <td className={`px-3 py-2.5 font-bold font-mono text-xs ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {variance >= 0 ? '+' : ''}{variance.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${s.reconciled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-600'}`}>
                          {s.reconciled ? 'Reconciled' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ASSIGN SHOPKEEPERS */}
      {tab === 'assign' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <p className="text-sm text-gray-600">Assign shopkeepers to their shops. Each shop should have one dedicated shopkeeper for performance monitoring.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Shop','Location','Till Number','Current Shopkeeper','Assign'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {shops.map((shop: any) => (
                <tr key={shop.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{shop.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{shop.location || '–'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{shop.tillNumber || '–'}</td>
                  <td className="px-4 py-3">
                    {shop.keeper ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                          <User size={14} className="text-green-700" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{shop.keeper.name}</div>
                          <div className="text-xs text-gray-400">{shop.keeper.code}</div>
                        </div>
                      </div>
                    ) : <span className="text-xs text-gray-400 italic">Not assigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={shop.keeper?.id || shop.keeperId || ''}
                      onChange={e => assignMut.mutate({ shopId: shop.id, keeperId: Number(e.target.value) })}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs min-w-[160px]">
                      <option value="">— Select shopkeeper —</option>
                      {shopkeepers.map((sk: any) => (
                        <option key={sk.id} value={sk.id}>{sk.name} ({sk.code})</option>
                      ))}
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
