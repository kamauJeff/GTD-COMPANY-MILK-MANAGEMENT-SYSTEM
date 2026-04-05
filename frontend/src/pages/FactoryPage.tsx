import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { factoryApi } from '../api/client';
import { LiquidCheck } from '../components/factory/LiquidCheck';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function FactoryPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<'receipts'|'batches'|'deliveries'|'liquid'>('receipts');
  const [selectedDate, setSelectedDate] = useState<string>('');  // '' = show full month
  const qc = useQueryClient();

  // Stats
  const { data: statsData } = useQuery({
    queryKey: ['factory-stats', month, year],
    queryFn: () => factoryApi.stats({ month, year }),
  });
  const stats = statsData?.data || {};

  // Graders & Drivers for dropdowns
  const { data: gradersData } = useQuery({ queryKey: ['graders'], queryFn: () => factoryApi.graders() });
  const { data: driversData } = useQuery({ queryKey: ['drivers'], queryFn: () => factoryApi.drivers() });
  const graders: any[] = gradersData?.data ?? [];
  const drivers: any[] = driversData?.data ?? [];

  // Receipts
  const { data: receiptsData, isLoading: loadingReceipts } = useQuery({
    queryKey: ['receipts', month, year, selectedDate],
    queryFn: () => factoryApi.receipts({ month, year, date: selectedDate || undefined }),
    staleTime: 0,
    enabled: tab === 'receipts',
  });
  const receipts: any[] = receiptsData?.data ?? [];
  const [receiptForm, setReceiptForm] = useState({ graderId: '', litres: '', receivedAt: new Date().toISOString().split('T')[0], notes: '' });

  const createReceiptMut = useMutation({
    mutationFn: () => factoryApi.createReceipt({ graderId: Number(receiptForm.graderId), litres: Number(receiptForm.litres), receivedAt: receiptForm.receivedAt, notes: receiptForm.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['receipts'] }); qc.invalidateQueries({ queryKey: ['factory-stats'] }); qc.invalidateQueries({ queryKey: ['report-daily-ledger'] }); qc.invalidateQueries({ queryKey: ['litres-ledger'] }); setReceiptForm(f => ({ ...f, litres: '', notes: '' })); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed'),
  });

  // Batches
  const { data: batchesData, isLoading: loadingBatches } = useQuery({
    queryKey: ['batches', month, year, selectedDate],
    queryFn: () => factoryApi.batches({ month, year, date: selectedDate || undefined }),
    staleTime: 0,
    enabled: tab === 'batches',
  });
  const batches: any[] = batchesData?.data ?? [];
  const [batchForm, setBatchForm] = useState({ batchNo: '', inputLitres: '', outputLitres: '', lossLitres: '', processedAt: new Date().toISOString().split('T')[0], qualityNotes: '' });
  const { data: nextBatch } = useQuery({ queryKey: ['next-batch'], queryFn: () => factoryApi.nextBatchNo(), enabled: tab === 'batches' });
  
  const createBatchMut = useMutation({
    mutationFn: () => factoryApi.createBatch({ ...batchForm, inputLitres: Number(batchForm.inputLitres), outputLitres: Number(batchForm.outputLitres), lossLitres: Number(batchForm.lossLitres || 0) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches'] }); qc.invalidateQueries({ queryKey: ['next-batch'] }); qc.invalidateQueries({ queryKey: ['factory-stats'] }); qc.invalidateQueries({ queryKey: ['report-daily-ledger'] }); setBatchForm(f => ({ ...f, inputLitres: '', outputLitres: '', lossLitres: '', qualityNotes: '' })); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed'),
  });

  // Deliveries
  const { data: deliveriesData, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['deliveries', month, year, selectedDate],
    queryFn: () => factoryApi.deliveries({ month, year, date: selectedDate || undefined }),
    staleTime: 0,
    enabled: tab === 'deliveries',
  });
  const deliveries: any[] = deliveriesData?.data ?? [];

  // Liquid Grid
  const { data: liquidData, isLoading: loadingLiquid, refetch: refetchLiquid } = useQuery({
    queryKey: ['liquid', month, year],
    queryFn: () => factoryApi.liquidGrid({ month, year }),
    staleTime: 0,
    enabled: tab === 'liquid',
    retry: 1,
  });
  const liquidGrid = liquidData?.data?.grid ?? [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const [liquidForm, setLiquidForm] = useState({ routeId: '', graderId: '', recordDate: new Date().toISOString().split('T')[0], received: '', dispatched: '', notes: '' });

  const saveLiquidMut = useMutation({
    mutationFn: () => factoryApi.saveLiquid({ ...liquidForm, routeId: Number(liquidForm.routeId), graderId: liquidForm.graderId ? Number(liquidForm.graderId) : null, received: Number(liquidForm.received), dispatched: Number(liquidForm.dispatched) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['liquid'] }); setLiquidForm(f => ({ ...f, received: '', dispatched: '', notes: '' })); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to save'),
  });

  const eff = stats.batches?.input > 0 ? ((stats.batches?.output / stats.batches?.input) * 100).toFixed(1) : '–';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Factory</h1>
          <p className="text-sm text-gray-500">Receipts · Pasteurization · Deliveries · {selectedDate ? new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `${MONTHS[month-1]} ${year}`}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={month} onChange={e => { setMonth(Number(e.target.value)); setSelectedDate(''); }} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setSelectedDate(''); }} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
          {/* Day filter */}
          <div className="flex items-center gap-1">
            <input type="date" value={selectedDate}
              onChange={e => {
                const d = e.target.value;
                setSelectedDate(d);
                if (d) {
                  const dt = new Date(d);
                  setMonth(dt.getMonth() + 1);
                  setYear(dt.getFullYear());
                }
              }}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            {selectedDate && (
              <button onClick={() => setSelectedDate('')}
                className="px-2 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border dark:border-gray-600"
                title="Clear date filter">✕ Full Month</button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-6">
        {[
          { label: 'RECEIVED', value: `${Number(stats.receipts?.total || 0).toFixed(0)} L`, color: 'text-blue-700' },
          { label: 'INPUT', value: `${Number(stats.batches?.input || 0).toFixed(0)} L`, color: 'text-purple-700' },
          { label: 'OUTPUT', value: `${Number(stats.batches?.output || 0).toFixed(0)} L`, color: 'text-green-700' },
          { label: 'LOSS', value: `${Number(stats.batches?.loss || 0).toFixed(0)} L`, color: 'text-red-600' },
          { label: 'EFFICIENCY', value: `${eff}%`, color: 'text-orange-600' },
          { label: 'DELIVERED', value: `${Number(stats.deliveries?.total || 0).toFixed(0)} L`, color: 'text-teal-700' },
          { label: 'UNDELIVERED', value: `${Math.max(0, Number(stats.batches?.output || 0) - Number(stats.deliveries?.total || 0)).toFixed(0)} L`, color: 'text-gray-600' },
          { label: 'REVENUE', value: `KES ${(Number(stats.deliveries?.total || 0) * 60).toLocaleString()}`, color: 'text-green-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-3 shadow-sm text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([['receipts','🥛 Milk Receipts'],['batches','🧪 Pasteurization'],['deliveries','🚚 Shop Deliveries'],['liquid','📊 Liquid Check']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-green-600 text-white' : 'border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* RECEIPTS */}
      {tab === 'receipts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700"><tr>
                {['Date','Grader','Litres','Notes',''].map(h => <th key={h} className="text-left px-3 py-3 text-xs text-gray-500">{h}</th>)}
              </tr></thead>
              <tbody>
                {loadingReceipts ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
                : receipts.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">No receipts this month</td></tr>
                : receipts.map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2.5 text-xs">{new Date(r.receivedAt).toLocaleDateString('en-KE')}</td>
                    <td className="px-3 py-2.5 font-medium">{r.grader?.name}</td>
                    <td className="px-3 py-2.5 font-bold text-blue-700">{Number(r.litres).toFixed(1)} L</td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{r.notes || '–'}</td>
                    <td className="px-3 py-2.5"><button onClick={() => factoryApi.deleteReceipt(r.id).then(() => qc.invalidateQueries({ queryKey: ['receipts'] }))} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold mb-4 text-gray-800">Add Receipt</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Grader *</label>
                <select value={receiptForm.graderId} onChange={e => setReceiptForm(f => ({...f, graderId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select grader...</option>
                  {graders.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 mb-1 block">Litres *</label>
                  <input type="number" value={receiptForm.litres} onChange={e => setReceiptForm(f => ({...f, litres: e.target.value}))} placeholder="0.0" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div><label className="text-xs text-gray-500 mb-1 block">Date</label>
                  <input type="date" value={receiptForm.receivedAt} onChange={e => setReceiptForm(f => ({...f, receivedAt: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <button onClick={() => createReceiptMut.mutate()} disabled={!receiptForm.graderId || !receiptForm.litres || createReceiptMut.isPending}
                className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {createReceiptMut.isPending ? 'Saving...' : 'Add Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCHES */}
      {tab === 'batches' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700"><tr>
                {['Batch No','Date','Input','Output','Loss','Efficiency',''].map(h => <th key={h} className="text-left px-3 py-3 text-xs text-gray-500">{h}</th>)}
              </tr></thead>
              <tbody>
                {loadingBatches ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
                : batches.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No batches this month</td></tr>
                : batches.map((b: any) => {
                  const eff = Number(b.inputLitres) > 0 ? ((Number(b.outputLitres) / Number(b.inputLitres)) * 100).toFixed(1) : '–';
                  return (
                    <tr key={b.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2.5 font-mono text-xs font-bold">{b.batchNo}</td>
                      <td className="px-3 py-2.5 text-xs">{new Date(b.processedAt).toLocaleDateString('en-KE')}</td>
                      <td className="px-3 py-2.5 font-mono">{Number(b.inputLitres).toFixed(1)} L</td>
                      <td className="px-3 py-2.5 font-mono text-green-700">{Number(b.outputLitres).toFixed(1)} L</td>
                      <td className="px-3 py-2.5 font-mono text-red-600">{Number(b.lossLitres).toFixed(1)} L</td>
                      <td className="px-3 py-2.5"><span className={`text-xs font-bold ${Number(eff) >= 95 ? 'text-green-600' : 'text-orange-500'}`}>{eff}%</span></td>
                      <td className="px-3 py-2.5"><button onClick={() => factoryApi.deleteBatch(b.id).then(() => qc.invalidateQueries({ queryKey: ['batches'] }))} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold mb-1 text-gray-800">Add Batch</h3>
            {nextBatch?.data?.batchNo && <p className="text-xs text-gray-400 mb-3">Next: {nextBatch.data.batchNo}</p>}
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Batch No *</label>
                <input value={batchForm.batchNo || nextBatch?.data?.batchNo || ''} onChange={e => setBatchForm(f => ({...f, batchNo: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 mb-1 block">Input (L) *</label>
                  <input type="number" value={batchForm.inputLitres} onChange={e => setBatchForm(f => ({...f, inputLitres: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div><label className="text-xs text-gray-500 mb-1 block">Output (L) *</label>
                  <input type="number" value={batchForm.outputLitres} onChange={e => setBatchForm(f => ({...f, outputLitres: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div><label className="text-xs text-gray-500 mb-1 block">Loss (L)</label>
                  <input type="number" value={batchForm.lossLitres} onChange={e => setBatchForm(f => ({...f, lossLitres: e.target.value}))} placeholder="0" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div><label className="text-xs text-gray-500 mb-1 block">Date</label>
                  <input type="date" value={batchForm.processedAt} onChange={e => setBatchForm(f => ({...f, processedAt: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <button onClick={() => createBatchMut.mutate()} disabled={!batchForm.inputLitres || !batchForm.outputLitres || createBatchMut.isPending}
                className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {createBatchMut.isPending ? 'Saving...' : 'Add Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERIES */}
      {tab === 'deliveries' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700"><tr>
              {['Date','Batch','Shop','Driver','Litres','Selling Price','Revenue'].map(h => <th key={h} className="text-left px-3 py-3 text-xs text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {loadingDeliveries ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
              : deliveries.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No deliveries this month</td></tr>
              : deliveries.map((d: any) => (
                <tr key={d.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2.5 text-xs">{new Date(d.deliveredAt).toLocaleDateString('en-KE')}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{d.batch?.batchNo}</td>
                  <td className="px-3 py-2.5 font-medium">{d.shop?.name}</td>
                  <td className="px-3 py-2.5 text-gray-500">{d.driver?.name}</td>
                  <td className="px-3 py-2.5 font-bold text-green-700">{Number(d.litres).toFixed(1)} L</td>
                  <td className="px-3 py-2.5 font-mono">KES {Number(d.sellingPrice).toFixed(0)}</td>
                  <td className="px-3 py-2.5 font-mono text-green-700">KES {(Number(d.litres) * Number(d.sellingPrice)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* LIQUID CHECK */}
      {tab === 'liquid' && (
        <LiquidCheck graders={graders} month={month} year={year} />
      )}
    </div>
  );
}
