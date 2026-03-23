import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Printer, TrendingUp, AlertTriangle, CheckCircle, Filter, RefreshCw } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
type ReportTab = 'daily-ledger' | 'payment-mid' | 'payment-end' | 'shops';
type PayFilter = 'ALL' | 'MPESA_PAID' | 'BANK_PAID' | 'UNPAID' | 'NEGATIVE';

export default function ReportsPage() {
  const now = new Date();
  const [tab, setTab]         = useState<ReportTab>('daily-ledger');
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [date, setDate]       = useState(now.toISOString().split('T')[0]);
  const [routeId, setRouteId] = useState('');
  const [payFilter, setPayFilter] = useState<PayFilter>('ALL');
  const printRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function refreshAll() {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['report-daily-ledger'] });
    await qc.invalidateQueries({ queryKey: ['report-litres-summary'] });
    await qc.invalidateQueries({ queryKey: ['report-payment-mid'] });
    await qc.invalidateQueries({ queryKey: ['report-payment-end'] });
    await qc.invalidateQueries({ queryKey: ['report-shops'] });
    await qc.invalidateQueries({ queryKey: ['payments'] });
    setRefreshing(false);
  }

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => api.get('/api/routes') });
  const routes: any[] = routesData?.data ?? [];

  // Daily ledger + litres ledger summary
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['report-daily-ledger', date, routeId, tab === 'daily-ledger'],
    queryFn: () => api.get('/api/reports/daily-ledger', { params: { date, routeId: routeId || undefined } }),
    enabled: tab === 'daily-ledger',
    staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
  });
  const ledger = ledgerData?.data || {};

  // Litres ledger summary for that day
  const { data: litresData } = useQuery({
    queryKey: ['report-litres-summary', date],
    staleTime: 0, refetchOnMount: true,
    queryFn: () => {
      const d = new Date(date);
      return api.get('/api/factory/litres-ledger', { params: { month: d.getMonth()+1, year: d.getFullYear() } });
    },
    enabled: tab === 'daily-ledger',
  });
  const litresSummary = litresData?.data?.dailySummary?.[new Date(date).getDate()] || {};

  const { data: midData, isLoading: midLoading } = useQuery({
    queryKey: ['report-payment-mid', month, year, routeId, tab === 'payment-mid'],
    queryFn: () => api.get('/api/payments', { params: { month, year, isMidMonth: true, status: 'ALL', routeId: routeId || undefined } }),
    enabled: tab === 'payment-mid',
    staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
  });
  const allMidPayments: any[] = midData?.data?.payments ?? [];

  const { data: endData, isLoading: endLoading } = useQuery({
    queryKey: ['report-payment-end', month, year, routeId, tab === 'payment-end'],
    queryFn: () => api.get('/api/payments', { params: { month, year, isMidMonth: false, status: 'ALL', routeId: routeId || undefined } }),
    enabled: tab === 'payment-end',
    staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
  });
  const allEndPayments: any[] = endData?.data?.payments ?? [];

  const { data: shopsData, isLoading: shopsLoading } = useQuery({
    queryKey: ['report-shops', month, year, tab === 'shops'],
    queryFn: () => api.get('/api/reports/shops', { params: { month, year } }),
    enabled: tab === 'shops',
    staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
  });
  const shopsReport = shopsData?.data || {};

  // Filter payments
  const filterPayments = (payments: any[]) => {
    switch (payFilter) {
      case 'MPESA_PAID': return payments.filter(p => p.status === 'PAID' && p.farmer?.paymentMethod === 'MPESA');
      case 'BANK_PAID':  return payments.filter(p => p.status === 'PAID' && p.farmer?.paymentMethod === 'BANK');
      case 'UNPAID':     return payments.filter(p => p.status !== 'PAID' && Number(p.netPay) > 0);
      case 'NEGATIVE':   return payments.filter(p => Number(p.netPay) < 0);
      default:           return payments;
    }
  };
  const midPayments = filterPayments(allMidPayments);
  const endPayments = filterPayments(allEndPayments);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Gutoria Dairies Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:20px}
        table{width:100%;border-collapse:collapse;margin:8px 0}
        th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}
        th{background:#f5f5f5;font-weight:bold}
        .green{color:#16a34a}.red{color:#dc2626}.orange{color:#ea580c}.blue{color:#2563eb}
        .bold{font-weight:bold}.center{text-align:center}
        .section-header{background:#1f2937;color:white;padding:6px 8px;font-weight:bold;margin:12px 0 4px}
        .total-row{background:#f0fdf4;font-weight:bold}
        .header{text-align:center;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:8px}
        @media print{.no-print{display:none}}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { PAID: 'bg-green-100 text-green-700', APPROVED: 'bg-blue-100 text-blue-700', PENDING: 'bg-yellow-100 text-yellow-700' };
    return `inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`;
  };

  const payFilterLabel: Record<PayFilter, string> = {
    ALL: 'All Payments', MPESA_PAID: '📱 Paid via KopoKopo', BANK_PAID: '🏦 Paid via Bank',
    UNPAID: '⏳ Unpaid', NEGATIVE: '⚠️ Negatives',
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Operational intelligence · Live data</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Refresh button — always visible */}
          <button onClick={refreshAll} disabled={refreshing}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${refreshing ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600' : 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
          {tab !== 'daily-ledger' && (
            <>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
              </select>
            </>
          )}
          {tab === 'daily-ledger' && (
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          )}
          {/* Route filter - show on payment tabs */}
          {(tab === 'payment-mid' || tab === 'payment-end') && (
            <select value={routeId} onChange={e => { setRouteId(e.target.value); setPayFilter('ALL'); }}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-w-[150px]">
              <option value="">All Routes</option>
              {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          ['daily-ledger',  '📊 Daily Litres Ledger'],
          ['payment-mid',   '💜 Mid Month Payments'],
          ['payment-end',   '💚 End Month Payments'],
          ['shops',         '🏪 Shops Performance'],
        ] as const).map(([t, l]) => (
          <button key={t} onClick={() => { setTab(t); setPayFilter('ALL'); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-green-600 text-white shadow-sm' : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Payment sub-filters */}
      {(tab === 'payment-mid' || tab === 'payment-end') && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['ALL', 'MPESA_PAID', 'BANK_PAID', 'UNPAID', 'NEGATIVE'] as PayFilter[]).map(f => (
            <button key={f} onClick={() => setPayFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${payFilter === f
                ? f === 'NEGATIVE' ? 'bg-red-600 text-white' : f === 'UNPAID' ? 'bg-yellow-500 text-white' : f === 'BANK_PAID' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              {payFilterLabel[f]}
            </button>
          ))}
          {routeId && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-medium">
              <Filter size={11} />
              {routes.find(r => r.id === Number(routeId))?.name}
              <button onClick={() => setRouteId('')} className="ml-1 hover:text-red-500">✕</button>
            </span>
          )}
        </div>
      )}

      <div ref={printRef}>
        {/* Print header */}
        <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-black">
          <div className="text-xl font-bold">GUTORIA DAIRIES</div>
          <div className="text-sm">
            {tab === 'daily-ledger' ? `Daily Litres Report — ${new Date(date).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
              : tab === 'payment-mid' ? `Mid Month Payment Report — ${MONTHS[month-1]} ${year}`
              : tab === 'payment-end' ? `End Month Payment Report — ${MONTHS[month-1]} ${year}`
              : `Shops Performance Report — ${MONTHS[month-1]} ${year}`}
          </div>
          {routeId && <div className="text-sm">Route: {routes.find(r => r.id === Number(routeId))?.name}</div>}
          {(tab === 'payment-mid' || tab === 'payment-end') && payFilter !== 'ALL' && <div className="text-sm">Filter: {payFilterLabel[payFilter]}</div>}
          <div className="text-xs text-gray-500">Printed: {new Date().toLocaleString('en-KE')}</div>
        </div>

        {/* ── DAILY LITRES LEDGER ── */}
        {tab === 'daily-ledger' && (
          <div className="space-y-4">
            {ledgerLoading ? <LoadingCard /> : !ledger.routes?.length ? <EmptyCard msg="No collections for this date" /> : (
              <>
                {/* Route collections summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Total Collected', value: `${(ledger.summary?.totalCollected || 0).toFixed(1)} L`, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
                    { label: 'Factory Received', value: `${(ledger.summary?.totalReceived || 0).toFixed(1)} L`, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                    { label: 'Grader Variance', value: `${(ledger.summary?.totalVariance || 0).toFixed(1)} L`, color: (ledger.summary?.totalVariance || 0) < -1 ? 'text-red-600' : 'text-green-700', bg: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700' },
                    { label: 'Active Routes', value: ledger.routes?.length || 0, color: 'text-gray-800 dark:text-gray-100', bg: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700' },
                    { label: 'Total Farmers', value: ledger.routes?.reduce((s: number, r: any) => s + r.farmerCount, 0) || 0, color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                      <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Litres Ledger Summary Box */}
                {(litresSummary.routesTotal || litresSummary.salesTotal) ? (
                  <div className="bg-gradient-to-r from-green-900 to-blue-900 rounded-2xl p-5 text-white">
                    <div className="font-bold text-lg mb-4">📦 Milk Stock Summary — {new Date(date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white/10 rounded-xl p-3">
                        <div className="text-xs text-green-200">From Routes</div>
                        <div className="text-2xl font-bold text-green-300">{(litresSummary.routesTotal || 0).toFixed(1)} L</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3">
                        <div className="text-xs text-purple-200">From Brokers</div>
                        <div className="text-2xl font-bold text-purple-300">{(litresSummary.brokersTotal || 0).toFixed(1)} L</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3">
                        <div className="text-xs text-red-200">Rejects/Issues</div>
                        <div className="text-2xl font-bold text-red-300">{(litresSummary.issuesTotal || 0).toFixed(1)} L</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3 border border-green-400/50">
                        <div className="text-xs text-yellow-200">Available to Sell</div>
                        <div className="text-2xl font-bold text-yellow-300">{(litresSummary.available || 0).toFixed(1)} L</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="bg-white/10 rounded-xl p-3 flex-1">
                        <div className="text-xs text-orange-200">Distributed to Shops</div>
                        <div className="text-xl font-bold text-orange-300">{(litresSummary.salesTotal || 0).toFixed(1)} L</div>
                      </div>
                      <div className="text-3xl font-light text-white/50">=</div>
                      <div className={`rounded-xl p-3 flex-1 ${(litresSummary.closingBalance || 0) < 0 ? 'bg-red-500/20 border border-red-400/50' : 'bg-green-500/20 border border-green-400/50'}`}>
                        <div className="text-xs text-gray-200">Closing Balance</div>
                        <div className={`text-xl font-bold ${(litresSummary.closingBalance || 0) < 0 ? 'text-red-300' : 'text-green-300'}`}>
                          {(litresSummary.closingBalance || 0).toFixed(1)} L
                        </div>
                        <div className="text-xs mt-1 text-gray-300">
                          {(litresSummary.closingBalance || 0) < 0 ? '⚠️ Deficit — more distributed than available' : '✅ All accounted for'}
                        </div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3 flex-1">
                        <div className="text-xs text-teal-200">Revenue (@ KES 60/L)</div>
                        <div className="text-xl font-bold text-teal-300">KES {((litresSummary.salesTotal || 0) * 60).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3 flex-1">
                        <div className="text-xs text-blue-200">Farmer Cost (@ KES 46/L)</div>
                        <div className="text-xl font-bold text-blue-300">KES {((litresSummary.routesTotal || 0) * 46).toLocaleString()}</div>
                      </div>
                      <div className={`rounded-xl p-3 flex-1 ${((litresSummary.salesTotal || 0)*60 - (litresSummary.routesTotal || 0)*46) > 0 ? 'bg-green-500/20 border border-green-400' : 'bg-red-500/20 border border-red-400'}`}>
                        <div className="text-xs text-gray-200">Gross Margin</div>
                        <div className={`text-xl font-bold ${((litresSummary.salesTotal || 0)*60 - (litresSummary.routesTotal || 0)*46) > 0 ? 'text-green-300' : 'text-red-300'}`}>
                          KES {(((litresSummary.salesTotal || 0)*60) - ((litresSummary.routesTotal || 0)*46)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Per-route grader table */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-semibold text-sm text-gray-700 dark:text-gray-300">
                    📍 Grader Variance Report
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                      <tr>{['Route','Grader','Farmers','Collected (L)','Received at Factory (L)','Variance (L)','Status'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {ledger.routes?.map((r: any) => {
                        const variance = Number(r.received) - Number(r.collected);
                        const hasIssue = Math.abs(variance) > 1;
                        return (
                          <tr key={r.routeId} className={`border-b dark:border-gray-700 ${hasIssue ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                            <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{r.routeName}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.graderName}</td>
                            <td className="px-4 py-2.5 text-center">{r.farmerCount}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-green-700 dark:text-green-400">{Number(r.collected).toFixed(1)}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-blue-700 dark:text-blue-400">{Number(r.received).toFixed(1)}</td>
                            <td className={`px-4 py-2.5 font-bold font-mono ${variance < -1 ? 'text-red-600' : variance > 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {variance > 0 ? '+' : ''}{variance.toFixed(1)}
                            </td>
                            <td className="px-4 py-2.5">
                              {hasIssue
                                ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12} />Variance</span>
                                : <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} />OK</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 font-bold">
                      <tr>
                        <td className="px-4 py-2.5 text-xs" colSpan={3}>TOTAL</td>
                        <td className="px-4 py-2.5 font-mono text-green-700 dark:text-green-400">{(ledger.summary?.totalCollected || 0).toFixed(1)}</td>
                        <td className="px-4 py-2.5 font-mono text-blue-700 dark:text-blue-400">{(ledger.summary?.totalReceived || 0).toFixed(1)}</td>
                        <td className={`px-4 py-2.5 font-mono ${(ledger.summary?.totalVariance || 0) < -1 ? 'text-red-600' : 'text-green-600'}`}>{(ledger.summary?.totalVariance || 0).toFixed(1)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MID MONTH PAYMENTS ── */}
        {tab === 'payment-mid' && (
          <PaymentReport payments={midPayments} allPayments={allMidPayments} loading={midLoading}
            label="Mid Month" month={month} year={year} isMid={true} payFilter={payFilter} payFilterLabel={payFilterLabel} statusBadge={statusBadge} />
        )}

        {/* ── END MONTH PAYMENTS ── */}
        {tab === 'payment-end' && (
          <PaymentReport payments={endPayments} allPayments={allEndPayments} loading={endLoading}
            label="End Month" month={month} year={year} isMid={false} payFilter={payFilter} payFilterLabel={payFilterLabel} statusBadge={statusBadge} />
        )}

        {/* ── SHOPS PERFORMANCE ── */}
        {tab === 'shops' && (
          <div className="space-y-4">
            {shopsLoading ? <LoadingCard /> : !shopsReport.shops?.length ? <EmptyCard msg="No shop data this month" /> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Delivered', value: `${(shopsReport.totals?.delivered || 0).toFixed(0)} L`, color: 'text-blue-700 dark:text-blue-400' },
                    { label: 'Total Sold', value: `${(shopsReport.totals?.sold || 0).toFixed(0)} L`, color: 'text-green-700 dark:text-green-400' },
                    { label: 'Cash Collected', value: `KES ${(shopsReport.totals?.cash || 0).toLocaleString()}`, color: 'text-purple-700 dark:text-purple-400' },
                    { label: 'KopoKopo Till', value: `KES ${(shopsReport.totals?.till || 0).toLocaleString()}`, color: 'text-teal-700 dark:text-teal-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                      <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                      <tr>{['Shop','Shopkeeper','Opening','Delivered','Available','Sold','Variance','Cash','Till','Expected Rev','Rev Variance','Performance'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {shopsReport.shops?.map((s: any) => {
                        const revVariance = s.actualRevenue - s.expectedRevenue;
                        const perfScore = s.expectedRevenue > 0 ? Math.min(100, (s.actualRevenue / s.expectedRevenue * 100)) : 0;
                        return (
                          <tr key={s.shopId} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2.5 font-medium">{s.shopName}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{s.keeperName || '–'}</td>
                            <td className={`px-3 py-2.5 font-mono ${Number(s.openingLitres) > 0 ? 'text-orange-600 font-medium' : 'text-gray-300 dark:text-gray-600'}`}>{Number(s.openingLitres || 0).toFixed(0)} L</td>
                            <td className="px-3 py-2.5 font-mono text-blue-700 dark:text-blue-400">{Number(s.delivered).toFixed(0)} L</td>
                            <td className="px-3 py-2.5 font-mono font-bold text-purple-700 dark:text-purple-400">{Number(s.availableForSale || s.delivered).toFixed(0)} L</td>
                            <td className="px-3 py-2.5 font-mono text-green-700 dark:text-green-400">{Number(s.sold).toFixed(0)} L</td>
                            <td className={`px-3 py-2.5 font-bold font-mono ${Number(s.variance ?? s.unaccounted) > 1 ? 'text-red-600' : 'text-gray-400'}`}>{Number(s.variance ?? s.unaccounted).toFixed(0)} L</td>
                            <td className="px-3 py-2.5 font-mono">KES {Number(s.cash).toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono">KES {Number(s.till).toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono">KES {Number(s.expectedRevenue).toLocaleString()}</td>
                            <td className={`px-3 py-2.5 font-bold font-mono ${revVariance < -100 ? 'text-red-600' : 'text-green-600'}`}>
                              {revVariance >= 0 ? '+' : ''}KES {revVariance.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                                  <div className={`h-1.5 rounded-full ${perfScore >= 95 ? 'bg-green-500' : perfScore >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${perfScore}%` }} />
                                </div>
                                <span className={`text-xs font-bold ${perfScore >= 95 ? 'text-green-600' : perfScore >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {perfScore.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 font-bold">
                      <tr>
                        <td className="px-3 py-2.5 text-xs" colSpan={2}>TOTAL</td>
                        <td className="px-3 py-2.5 font-mono text-orange-600">{(shopsReport.totals?.openingLitres || 0).toFixed(0)} L</td>
                        <td className="px-3 py-2.5 font-mono text-blue-700">{(shopsReport.totals?.delivered || 0).toFixed(0)} L</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-purple-700">{(shopsReport.totals?.available || 0).toFixed(0)} L</td>
                        <td className="px-3 py-2.5 font-mono text-green-700">{(shopsReport.totals?.sold || 0).toFixed(0)} L</td>
                        <td className={`px-3 py-2.5 font-mono font-bold ${(shopsReport.totals?.variance || 0) > 5 ? 'text-red-600' : 'text-gray-400'}`}>{(shopsReport.totals?.variance || 0).toFixed(0)} L</td>
                        <td className="px-3 py-2.5 font-mono">KES {(shopsReport.totals?.cash || 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono">KES {(shopsReport.totals?.till || 0).toLocaleString()}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentReport({ payments, allPayments, loading, label, month, year, isMid, payFilter, payFilterLabel, statusBadge }: any) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [drillFarmer, setDrillFarmer] = useState<any>(null);
  const [drillData, setDrillData]     = useState<any>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  async function openDrill(p: any) {
    setDrillFarmer(p);
    setDrillData(null);
    setDrillLoading(true);
    try {
      const res = await api.get('/api/collections/statement', {
        params: { farmerCode: p.farmer?.code, month, year, isMidMonth: isMid },
      });
      setDrillData(res.data);
    } catch {}
    setDrillLoading(false);
  }
  const paid    = allPayments.filter((p: any) => p.status === 'PAID');
  const byMpesa = paid.filter((p: any) => p.farmer?.paymentMethod === 'MPESA');
  const byBank  = paid.filter((p: any) => p.farmer?.paymentMethod === 'BANK');
  const unpaid  = allPayments.filter((p: any) => p.status !== 'PAID' && Number(p.netPay) > 0);
  const negatives = allPayments.filter((p: any) => Number(p.netPay) < 0);

  if (loading) return <LoadingCard />;
  if (!allPayments.length) return <EmptyCard msg={`No ${label.toLowerCase()} payment records for ${MONTHS[month-1]} ${year}`} />;

  const totalNet = payments.filter((p: any) => Number(p.netPay) > 0).reduce((s: number, p: any) => s + Number(p.netPay), 0);

  return (
    <div className="space-y-4">
      {/* Farmer drill-down modal */}
      {drillFarmer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-green-800 px-5 py-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-green-300 font-mono mb-1">{drillFarmer.farmer?.code}</div>
                  <div className="text-lg font-bold">{drillFarmer.farmer?.name}</div>
                  <div className="text-xs text-green-200 mt-0.5">{drillFarmer.farmer?.route?.name} · {MONTHS[month-1]} {year}</div>
                </div>
                <button onClick={() => setDrillFarmer(null)} className="text-green-200 hover:text-white text-xl">✕</button>
              </div>
            </div>
            {/* Breakdown */}
            <div className="p-5 space-y-1">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Breakdown</div>

              {/* Litres & Gross */}
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">Rate per Litre</span>
                <span className="font-mono text-sm">KES {Number(drillFarmer.pricePerLitre || drillFarmer.farmer?.pricePerLitre || 0).toLocaleString()}/L</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Total Litres {drillFarmer.farmer?.paidOn15th ? (isMid ? '(1–15)' : '(16–end)') : '(1–end)'}
                </span>
                <span className="font-mono text-sm font-bold">{Number(drillFarmer.totalLitres || 0).toFixed(1)} L</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">Gross Pay</span>
                <span className="font-mono text-sm font-bold text-blue-600">KES {Number(drillFarmer.grossPay).toLocaleString()}</span>
              </div>

              {/* Deductions — use statement data if available for full line-item breakdown */}
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-3 pb-1">Deductions</div>
              {drillLoading && <div className="text-xs text-gray-400 animate-pulse py-1">Loading full breakdown...</div>}
              {drillData ? (
                <>
                  {drillData.deductionsList?.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between py-1.5 pl-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{d.label}</span>
                      <span className="font-mono text-sm text-red-500">- KES {Number(d.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {Number(drillFarmer.carriedForward) > 0 && (
                    <div className="flex justify-between py-1.5 pl-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Balance b/f</span>
                      <span className="font-mono text-sm text-red-500">- KES {Number(drillFarmer.carriedForward).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(drillFarmer.totalAdvances) > 0 && (
                    <div className="flex justify-between py-1.5 pl-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Advances</span>
                      <span className="font-mono text-sm text-orange-600">- KES {Number(drillFarmer.totalAdvances).toLocaleString()}</span>
                    </div>
                  )}
                  {(() => {
                    const other = Number(drillFarmer.totalDeductions) - Number(drillFarmer.totalAdvances) - Number(drillFarmer.carriedForward || 0);
                    return other > 0 ? (
                      <div className="flex justify-between py-1.5 pl-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Other charges</span>
                        <span className="font-mono text-sm text-red-500">- KES {other.toLocaleString()}</span>
                      </div>
                    ) : null;
                  })()}
                </>
              )}
              <div className="flex justify-between py-2 border-t border-gray-200 dark:border-gray-700 mt-1">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Total Deductions</span>
                <span className="font-mono text-sm font-bold text-red-600">- KES {Number(drillFarmer.totalDeductions).toLocaleString()}</span>
              </div>

              {/* Net */}
              <div className={`flex justify-between py-3 px-3 rounded-xl mt-2 ${Number(drillFarmer.netPay) >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <span className="font-bold text-base">NET PAY</span>
                <span className={`font-mono font-bold text-lg ${Number(drillFarmer.netPay) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                  KES {Number(drillFarmer.netPay).toLocaleString()}
                </span>
              </div>

              {/* Payment info */}
              <div className="pt-3 space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Payment Method</span>
                  <span className="font-medium">{drillFarmer.farmer?.paymentMethod === 'MPESA' ? `📱 ${drillFarmer.farmer?.mpesaPhone || drillFarmer.farmer?.phone}` : `🏦 ${drillFarmer.farmer?.bankName} · ${drillFarmer.farmer?.bankAccount}`}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Status</span>
                  <span className={`font-bold ${drillFarmer.status === 'PAID' ? 'text-green-600' : drillFarmer.status === 'APPROVED' ? 'text-blue-600' : 'text-yellow-600'}`}>{drillFarmer.status}</span>
                </div>
                {drillFarmer.paidAt && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Paid At</span>
                    <span>{new Date(drillFarmer.paidAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats — always show full picture */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Farmers', value: allPayments.length, color: 'text-gray-800 dark:text-gray-100', bg: 'bg-white dark:bg-gray-900' },
          { label: 'Paid via KopoKopo', value: byMpesa.length, sub: `KES ${byMpesa.reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}`, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Paid via Bank', value: byBank.length, sub: `KES ${byBank.reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}`, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Unpaid', value: unpaid.length, sub: `KES ${unpaid.reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}`, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Negatives (b/f)', value: negatives.length, sub: 'Carried forward', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border border-gray-200 dark:border-gray-700 p-3 ${s.bg}`}>
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Filtered result label */}
      {payFilter !== 'ALL' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm text-gray-600 dark:text-gray-300">
          <Filter size={14} />
          Showing: <strong>{payFilterLabel[payFilter]}</strong> — {payments.length} farmer{payments.length !== 1 ? 's' : ''} · KES {totalNet.toLocaleString()}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {payments.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No records match this filter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <tr>{['Code','Farmer','Route','Method','Account','Gross','Deductions','Net Pay','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id}
                    onClick={() => openDrill(p)}
                    className={`border-b dark:border-gray-700 last:border-0 cursor-pointer ${Number(p.netPay) < 0 ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100' : 'hover:bg-green-50 dark:hover:bg-green-900/10'}`}>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{p.farmer?.code}</td>
                    <td className="px-3 py-2.5 font-medium text-xs">
                      <span className="text-green-600 hover:underline">{p.farmer?.name}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.farmer?.route?.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.farmer?.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {p.farmer?.paymentMethod === 'MPESA' ? '📱' : '🏦'} {p.farmer?.paymentMethod}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">{p.farmer?.paymentMethod === 'MPESA' ? p.farmer?.mpesaPhone || p.farmer?.phone : p.farmer?.bankAccount}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">KES {Number(p.grossPay).toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-red-600">KES {Number(p.totalDeductions ?? p.totalAdvances).toLocaleString()}</td>
                    <td className={`px-3 py-2.5 font-bold font-mono text-xs ${Number(p.netPay) < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`}>
                      KES {Number(p.netPay).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5"><span className={statusBadge(p.status)}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 font-bold">
                <tr>
                  <td className="px-3 py-2.5 text-xs" colSpan={7}>TOTAL ({payments.length} farmers)</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-green-700 dark:text-green-400">
                    KES {totalNet.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingCard() {
  return <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center text-gray-400">Loading report...</div>;
}
function EmptyCard({ msg }: { msg: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center text-gray-400">
      <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
      <div className="font-medium">{msg}</div>
    </div>
  );
}
