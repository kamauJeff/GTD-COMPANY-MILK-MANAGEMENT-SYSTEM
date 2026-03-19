import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Download, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
type Tab = 'compute' | 'records' | 'advances';

export default function PaymentsPage() {
  const now = new Date();
  const [month, setMonth]         = useState(now.getMonth() + 1);
  const [year, setYear]           = useState(now.getFullYear());
  const [isMidMonth, setIsMidMonth] = useState(false);
  const [routeId, setRouteId]     = useState('');
  const [tab, setTab]             = useState<Tab>('compute');
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [selectedFarmers, setSelectedFarmers] = useState<number[]>([]);
  const [recordStatus, setRecordStatus] = useState('ALL');
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advForm, setAdvForm]     = useState({ farmerCode: '', amount: '', notes: '', date: new Date().toISOString().split('T')[0] });
  const qc = useQueryClient();

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => api.get('/api/payments/routes') });
  const routes: any[] = routesData?.data ?? [];

  // Payment preview (compute tab)
  const { data: previewData, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['payments-preview', month, year, isMidMonth, routeId],
    queryFn: () => api.get('/api/payments', { params: { month, year, isMidMonth, routeId: routeId || undefined } }),
    enabled: tab === 'compute',
  });
  const preview = previewData?.data || {};
  const routeGroups: any[] = preview.routes || [];

  // Payment records (records tab)
  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['payments-records', month, year, isMidMonth, routeId, recordStatus],
    queryFn: () => api.get('/api/payments', { params: { month, year, isMidMonth, routeId: routeId || undefined, status: recordStatus } }),
    enabled: tab === 'records',
  });
  const records = recordsData?.data || {};
  const payments: any[] = records.payments || [];
  const totals = records.totals || {};

  // Advances
  const { data: advancesData } = useQuery({
    queryKey: ['advances', month, year, routeId],
    queryFn: () => api.get('/api/payments/advances', { params: { month, year, routeId: routeId || undefined } }),
    enabled: tab === 'advances',
  });
  const advances: any[] = advancesData?.data ?? [];

  // Summary
  const disburseMut = useMutation({
    mutationFn: (rId?: number) => api.post('/api/payments/disburse', { month, year, isMidMonth, routeId: rId || routeId || undefined }),
    onSuccess: (r) => {
      const d = r.data;
      alert(`✅ Disbursement complete!\n\nSent: ${d.successful}/${d.total} M-Pesa payments\nFailed: ${d.failed}\nBank transfers: ${d.bankPayments} (download CSV)\n\n${d.failedDetails?.length ? 'Failed:\n' + d.failedDetails.map((f: any) => `${f.phone}: ${f.error}`).join('\n') : ''}`);
      qc.invalidateQueries({ queryKey: ['payments-records'] });
      qc.invalidateQueries({ queryKey: ['payments-summary'] });
    },
    onError: (e: any) => alert(`❌ ${e?.response?.data?.error || 'Disbursement failed'}`),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['kopokopo-balance'],
    queryFn: () => api.get('/api/payments/kopokopo-balance'),
    refetchInterval: 300000, // refresh every 5 min
  });
  const kopoBalance = balanceData?.data;

  const { data: summaryData } = useQuery({
    queryKey: ['payments-summary', month, year],
    queryFn: () => api.get('/api/payments/summary', { params: { month, year } }),
  });
  const summary = summaryData?.data || {};

  const runMut = useMutation({
    mutationFn: () => api.post('/api/payments/run', { month, year, isMidMonth, routeId: routeId || undefined }),
    onSuccess: (r) => { alert(`✅ ${r.data.message}`); qc.invalidateQueries({ queryKey: ['payments'] }); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed'),
  });

  const approveMut = useMutation({
    mutationFn: (rId?: number) => api.post('/api/payments/approve', { month, year, isMidMonth, routeId: rId || routeId || undefined }),
    onSuccess: (r) => { alert(`✅ ${r.data.approved} payments approved`); qc.invalidateQueries({ queryKey: ['payments'] }); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed'),
  });

  const markPaidMut = useMutation({
    mutationFn: (ids: number[]) => api.post('/api/payments/mark-paid', { paymentIds: ids }),
    onSuccess: (r) => { alert(`✅ ${r.data.paid} marked as paid`); qc.invalidateQueries({ queryKey: ['payments-records'] }); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed'),
  });

  const addAdvanceMut = useMutation({
    mutationFn: () => api.post('/api/payments/advance', advForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['advances'] }); setShowAdvanceForm(false); setAdvForm({ farmerCode: '', amount: '', notes: '', date: new Date().toISOString().split('T')[0] }); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to record advance'),
  });

  const deleteAdvanceMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/payments/advance/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advances'] }),
  });

  const downloadFile = async (endpoint: string, filename: string) => {
    try {
      const res = await api.get(endpoint, { params: { month, year, isMidMonth, routeId: routeId || undefined }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  const toggleFarmer = (id: number) => setSelectedFarmers(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleRoute = (farmers: any[]) => {
    if (!farmers?.length) return;
    const ids = farmers.map((f: any) => f.farmer?.id).filter(Boolean);
    const allSelected = ids.every(id => selectedFarmers.includes(id));
    setSelectedFarmers(s => allSelected ? s.filter(id => !ids.includes(id)) : [...new Set([...s, ...ids])]);
  };

  const statusColor = (status: string) => ({
    PAID: 'bg-green-100 text-green-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    PENDING: 'bg-yellow-100 text-yellow-600',
  }[status] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Farmer Payments</h1>
          <p className="text-sm text-gray-500">{isMidMonth ? 'Mid Month (1–15)' : 'End Month (1–last day)'} · {MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={routeId} onChange={e => setRouteId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm min-w-[160px]">
            <option value="">All Routes</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button onClick={() => setIsMidMonth(true)} className={`px-3 py-2 text-sm font-medium ${isMidMonth ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Mid Month
            </button>
            <button onClick={() => setIsMidMonth(false)} className={`px-3 py-2 text-sm font-medium border-l ${!isMidMonth ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              End Month
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Mid Month Paid', value: `${summary.mid?.paid || 0} / ${summary.mid?.count || 0}`, sub: `KES ${Number(summary.mid?.totalNet || 0).toLocaleString()}`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { label: 'End Month Paid', value: `${summary.end?.paid || 0} / ${summary.end?.count || 0}`, sub: `KES ${Number(summary.end?.totalNet || 0).toLocaleString()}`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Advances This Month', value: summary.advances?.count || 0, sub: `KES ${Number(summary.advances?.total || 0).toLocaleString()}`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
          { label: 'Negative Balances', value: `${(summary.mid?.negative || 0) + (summary.end?.negative || 0)}`, sub: 'Carried forward', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[['compute','💰 Compute & Approve'],['records','📋 Payment Records'],['advances','📝 Advances']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-green-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── COMPUTE TAB ── */}
      {tab === 'compute' && (
        <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
            {/* KopoKopo balance */}
            <div className={`px-3 py-2 rounded-lg text-sm font-medium border ${kopoBalance?.error ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              💳 KopoKopo: {kopoBalance?.error ? 'Not connected' : `KES ${Number(kopoBalance?.amount || 0).toLocaleString()}`}
            </div>
            <button onClick={() => runMut.mutate()} disabled={runMut.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {runMut.isPending ? 'Computing...' : '⚙️ Generate Records'}
            </button>
            {selectedFarmers.length > 0 && (
              <button onClick={() => approveMut.mutate(undefined)} disabled={approveMut.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                ✅ Approve Selected ({selectedFarmers.length})
              </button>
            )}
            <button onClick={() => {
              if (!confirm('This will send M-Pesa payments via KopoKopo to all APPROVED farmers. Continue?')) return;
              disburseMut.mutate(undefined);
            }} disabled={disburseMut.isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {disburseMut.isPending ? '⏳ Sending...' : '🚀 Disburse via KopoKopo'}
            </button>
            <button onClick={() => downloadFile('/api/payments/kopokopo-export', `kopokopo-${isMidMonth?'mid':'end'}-${MONTHS[month-1]}-${year}.csv`)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1.5">
              <Download size={13} /> KopoKopo CSV
            </button>
            <button onClick={() => downloadFile('/api/payments/bank-export', `bank-${isMidMonth?'mid':'end'}-${MONTHS[month-1]}-${year}.csv`)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1.5">
              <Download size={13} /> Bank CSV
            </button>
          </div>

          {previewLoading ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Computing payments...</div>
          ) : routeGroups.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <div className="text-3xl mb-3">💰</div>
              <div className="font-medium">No payment data yet</div>
              <div className="text-sm mt-1">Click "Generate Payment Records" to compute from collections</div>
            </div>
          ) : (
            <div className="space-y-3">
              {routeGroups.map((rg: any) => {
                const isExpanded = expandedRoute === rg.routeCode;
                const routeFarmers: any[] = rg.farmers || [];
                const allRouteSelected = routeFarmers.every((f: any) => selectedFarmers.includes(f.farmer.id));
                return (
                  <div key={rg.routeCode} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    {/* Route header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b cursor-pointer"
                      onClick={() => setExpandedRoute(isExpanded ? null : rg.routeCode)}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={allRouteSelected} onChange={() => toggleRoute(routeFarmers)}
                          onClick={e => e.stopPropagation()} className="w-4 h-4 accent-green-600" />
                        {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                        <div>
                          <span className="font-semibold text-gray-800">{rg.routeName}</span>
                          <span className="text-xs text-gray-400 ml-2">{routeFarmers.length} farmers</span>
                          {rg.negativeCount > 0 && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">{rg.negativeCount} negative</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500">{rg.totalLitres.toFixed(0)} L</span>
                        <span className="text-green-700 font-bold">KES {rg.totalNet.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                        <button onClick={e => { e.stopPropagation(); approveMut.mutate(rg.routeId); }}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                          Approve Route
                        </button>
                      </div>
                    </div>

                    {/* Farmers table */}
                    {isExpanded && (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            {['','Code','Farmer','Payment','Account','Litres','Gross','Advances','B/F','Net Pay','Status'].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {routeFarmers.map((f: any) => {
                            const isSelected = selectedFarmers.includes(f.farmer.id);
                            const isNeg = f.netPay < 0;
                            return (
                              <tr key={f.farmer.id} className={`border-b last:border-0 ${isNeg ? 'bg-red-50' : isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                <td className="px-3 py-2.5">
                                  <input type="checkbox" checked={isSelected} onChange={() => toggleFarmer(f.farmer.id)} className="w-3.5 h-3.5 accent-green-600" />
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{f.farmer.code}</td>
                                <td className="px-3 py-2.5 font-medium text-gray-800">{f.farmer.name}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.farmer.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {f.farmer.paymentMethod === 'MPESA' ? '📱 M-Pesa' : '🏦 Bank'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-xs font-mono text-gray-500">
                                  {f.farmer.paymentMethod === 'MPESA' ? f.farmer.mpesaPhone || f.farmer.phone : `${f.farmer.bankName || ''} ${f.farmer.bankAccount || ''}`}
                                </td>
                                <td className="px-3 py-2.5 font-mono">{f.totalLitres.toFixed(1)} L</td>
                                <td className="px-3 py-2.5 font-mono">KES {f.grossPay.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                                <td className="px-3 py-2.5 font-mono text-orange-600">KES {f.totalAdvances.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                                <td className="px-3 py-2.5 font-mono text-red-500">{f.carriedForward > 0 ? `KES ${f.carriedForward.toLocaleString(undefined,{maximumFractionDigits:0})}` : '–'}</td>
                                <td className={`px-3 py-2.5 font-bold font-mono ${isNeg ? 'text-red-600' : 'text-green-700'}`}>
                                  KES {f.netPay.toLocaleString(undefined,{maximumFractionDigits:0})}
                                </td>
                                <td className="px-3 py-2.5">
                                  {isNeg ? (
                                    <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12} /> Negative</span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Payable</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-600">ROUTE TOTAL</td>
                            <td className="px-3 py-2 font-bold font-mono text-xs">{rg.totalLitres.toFixed(0)} L</td>
                            <td className="px-3 py-2 font-bold font-mono text-xs">KES {rg.totalGross.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                            <td className="px-3 py-2 font-bold font-mono text-xs text-orange-600">KES {rg.totalAdvances.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 font-bold font-mono text-xs text-green-700">KES {rg.totalNet.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── RECORDS TAB ── */}
      {tab === 'records' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
              {[['ALL','All'],['PENDING','Pending'],['APPROVED','Approved'],['PAID','Paid']].map(([v, l]) => (
                <button key={v} onClick={() => setRecordStatus(v)}
                  className={`px-3 py-2 font-medium ${recordStatus === v ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'} border-r last:border-0`}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={() => downloadFile('/api/payments/kopokopo-export', `kopokopo-${MONTHS[month-1]}-${year}.csv`)}
              className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
              <Download size={14} /> KopoKopo CSV
            </button>
            <button onClick={() => downloadFile('/api/payments/bank-export', `bank-${MONTHS[month-1]}-${year}.csv`)}
              className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
              <Download size={14} /> Bank CSV
            </button>
          </div>

          {/* Summary */}
          {totals.count > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Farmers', value: totals.count, color: 'text-gray-800' },
                { label: 'Total Net', value: `KES ${Number(totals.totalNet||0).toLocaleString(undefined,{maximumFractionDigits:0})}`, color: 'text-green-700' },
                { label: 'Paid', value: totals.paid, color: 'text-green-700' },
                { label: 'Negative', value: totals.negative, color: 'text-red-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border p-3 shadow-sm">
                  <div className="text-xs text-gray-400">{s.label}</div>
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {recordsLoading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No payment records found. Generate them in the Compute tab first.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Code','Farmer','Route','Method','Account','Litres','Gross','Advances','Net Pay','Status','Action'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => {
                    const f = p.farmer;
                    const isNeg = Number(p.netPay) < 0;
                    return (
                      <tr key={p.id} className={`border-b last:border-0 ${isNeg ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{f.code}</td>
                        <td className="px-3 py-2.5 font-medium">{f.name}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{f.route?.name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${f.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {f.paymentMethod === 'MPESA' ? '📱 M-Pesa' : '🏦 Bank'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                          {f.paymentMethod === 'MPESA' ? f.mpesaPhone || f.phone : f.bankAccount || '–'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{Number(p.grossPay/46).toFixed(0)} L</td>
                        <td className="px-3 py-2.5 font-mono text-xs">KES {Number(p.grossPay).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-orange-600">KES {Number(p.totalAdvances).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                        <td className={`px-3 py-2.5 font-bold font-mono text-xs ${isNeg ? 'text-red-600' : 'text-green-700'}`}>
                          KES {Number(p.netPay).toLocaleString(undefined,{maximumFractionDigits:0})}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {p.status === 'APPROVED' && !isNeg && (
                            <button onClick={() => markPaidMut.mutate([p.id])}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                              Mark Paid
                            </button>
                          )}
                          {p.status === 'PAID' && p.paidAt && (
                            <span className="text-xs text-gray-400">{new Date(p.paidAt).toLocaleDateString('en-KE')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── ADVANCES TAB ── */}
      {tab === 'advances' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">{advances.length} advances · KES {advances.reduce((s: number, a: any) => s + Number(a.amount), 0).toLocaleString()} total</div>
            <button onClick={() => setShowAdvanceForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <Plus size={14} /> Record Advance
            </button>
          </div>

          {showAdvanceForm && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Record Advance</h3>
                <button onClick={() => setShowAdvanceForm(false)}><X size={18} className="text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Farmer Code *</label>
                  <input value={advForm.farmerCode} onChange={e => setAdvForm(f => ({...f, farmerCode: e.target.value.toUpperCase()}))}
                    placeholder="e.g. FM0001" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount (KES) *</label>
                  <input type="number" value={advForm.amount} onChange={e => setAdvForm(f => ({...f, amount: e.target.value}))}
                    placeholder="0" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date</label>
                  <input type="date" value={advForm.date} onChange={e => setAdvForm(f => ({...f, date: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                  <input value={advForm.notes} onChange={e => setAdvForm(f => ({...f, notes: e.target.value}))}
                    placeholder="Optional..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <button onClick={() => addAdvanceMut.mutate()} disabled={!advForm.farmerCode || !advForm.amount || addAdvanceMut.isPending}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {addAdvanceMut.isPending ? 'Saving...' : 'Record Advance'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Date','Code','Farmer','Route','Amount','Notes',''].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {advances.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No advances recorded for {MONTHS[month-1]} {year}</td></tr>
                ) : advances.map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs text-gray-500">{new Date(a.advanceDate).toLocaleDateString('en-KE')}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{a.farmer.code}</td>
                    <td className="px-3 py-2.5 font-medium">{a.farmer.name}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{a.farmer.route?.name || '–'}</td>
                    <td className="px-3 py-2.5 font-bold text-orange-600">KES {Number(a.amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{a.notes || '–'}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => deleteAdvanceMut.mutate(a.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
