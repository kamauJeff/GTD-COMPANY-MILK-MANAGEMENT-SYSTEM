import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Download, Printer, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
type ReportTab = 'daily-ledger' | 'payment-mid' | 'payment-end' | 'shops';

export default function ReportsPage() {
  const now = new Date();
  const [tab, setTab]     = useState<ReportTab>('daily-ledger');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [date, setDate]   = useState(now.toISOString().split('T')[0]);
  const [routeId, setRouteId] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => api.get('/api/routes') });
  const routes: any[] = routesData?.data ?? [];

  // Daily litres ledger
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['report-daily-ledger', date, routeId],
    queryFn: () => api.get('/api/reports/daily-ledger', { params: { date, routeId: routeId || undefined } }),
    enabled: tab === 'daily-ledger',
  });
  const ledger = ledgerData?.data || {};

  // Payment reports
  const { data: midData, isLoading: midLoading } = useQuery({
    queryKey: ['report-payment-mid', month, year],
    queryFn: () => api.get('/api/payments', { params: { month, year, isMidMonth: true, status: 'ALL' } }),
    enabled: tab === 'payment-mid',
  });
  const midPayments: any[] = midData?.data?.payments ?? [];
  const midTotals = midData?.data?.totals ?? {};

  const { data: endData, isLoading: endLoading } = useQuery({
    queryKey: ['report-payment-end', month, year],
    queryFn: () => api.get('/api/payments', { params: { month, year, isMidMonth: false, status: 'ALL' } }),
    enabled: tab === 'payment-end',
  });
  const endPayments: any[] = endData?.data?.payments ?? [];
  const endTotals = endData?.data?.totals ?? {};

  // Shops report
  const { data: shopsData, isLoading: shopsLoading } = useQuery({
    queryKey: ['report-shops', month, year],
    queryFn: () => api.get('/api/reports/shops', { params: { month, year } }),
    enabled: tab === 'shops',
  });
  const shopsReport = shopsData?.data || {};

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Gutoria Dairies Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: bold; }
        .green { color: #16a34a; } .red { color: #dc2626; } .orange { color: #ea580c; }
        .total-row { background: #f0fdf4; font-weight: bold; }
        @media print { .no-print { display: none; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PAID: 'bg-green-100 text-green-700',
      APPROVED: 'bg-blue-100 text-blue-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
    };
    return `inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`;
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Operational intelligence for informed decisions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tab !== 'daily-ledger' && (
            <>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600">
                {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
              </select>
            </>
          )}
          {tab === 'daily-ledger' && (
            <>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600" />
              <select value={routeId} onChange={e => setRouteId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 min-w-[140px]">
                <option value="">All Routes</option>
                {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </>
          )}
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
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
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-green-600 text-white shadow-sm' : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            {l}
          </button>
        ))}
      </div>

      <div ref={printRef}>
        {/* Print header */}
        <div className="hidden print:block text-center mb-6">
          <div className="text-xl font-bold">GUTORIA DAIRIES</div>
          <div className="text-sm text-gray-500">Report generated: {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        {/* ── DAILY LITRES LEDGER ── */}
        {tab === 'daily-ledger' && (
          <div className="space-y-4">
            {ledgerLoading ? <LoadingCard /> : !ledger.routes?.length ? <EmptyCard msg="No collections for this date" /> : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Total Collected', value: `${(ledger.summary?.totalCollected || 0).toFixed(1)} L`, color: 'text-green-700 dark:text-green-400' },
                    { label: 'Factory Received', value: `${(ledger.summary?.totalReceived || 0).toFixed(1)} L`, color: 'text-blue-700 dark:text-blue-400' },
                    { label: 'Total Variance', value: `${(ledger.summary?.totalVariance || 0).toFixed(1)} L`, color: (ledger.summary?.totalVariance || 0) < 0 ? 'text-red-600' : 'text-green-700' },
                    { label: 'Routes Active', value: ledger.routes?.length || 0, color: 'text-gray-800 dark:text-gray-200' },
                    { label: 'Graders', value: ledger.summary?.graderCount || 0, color: 'text-purple-700 dark:text-purple-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                      <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Per-route grader variances */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-semibold text-sm text-gray-700 dark:text-gray-300">
                    📍 Route-by-Route Breakdown — {new Date(date).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>{['Route','Grader','Farmers','Collected (L)','Received (L)','Variance (L)','Status'].map(h => (
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
                                ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12} /> Variance</span>
                                : <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> OK</span>}
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
                        <td className={`px-4 py-2.5 font-mono ${(ledger.summary?.totalVariance || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{(ledger.summary?.totalVariance || 0).toFixed(1)}</td>
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
          <PaymentReport
            payments={midPayments}
            totals={midTotals}
            loading={midLoading}
            label="Mid Month"
            month={month} year={year}
            statusBadge={statusBadge}
          />
        )}

        {/* ── END MONTH PAYMENTS ── */}
        {tab === 'payment-end' && (
          <PaymentReport
            payments={endPayments}
            totals={endTotals}
            loading={endLoading}
            label="End Month"
            month={month} year={year}
            statusBadge={statusBadge}
          />
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
                      <tr>{['Shop','Shopkeeper','Delivered','Sold','Unaccounted','Cash','Till','Expected','Variance','Performance'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {shopsReport.shops?.map((s: any) => {
                        const revVariance = s.actualRevenue - s.expectedRevenue;
                        const perfScore = s.expectedRevenue > 0 ? (s.actualRevenue / s.expectedRevenue * 100).toFixed(0) : 0;
                        return (
                          <tr key={s.shopId} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2.5 font-medium">{s.shopName}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{s.keeperName || '–'}</td>
                            <td className="px-3 py-2.5 font-mono text-blue-700 dark:text-blue-400">{Number(s.delivered).toFixed(0)} L</td>
                            <td className="px-3 py-2.5 font-mono text-green-700 dark:text-green-400">{Number(s.sold).toFixed(0)} L</td>
                            <td className={`px-3 py-2.5 font-mono ${Number(s.unaccounted) > 1 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{Number(s.unaccounted).toFixed(0)} L</td>
                            <td className="px-3 py-2.5 font-mono">KES {Number(s.cash).toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono">KES {Number(s.till).toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono">KES {Number(s.expectedRevenue).toLocaleString()}</td>
                            <td className={`px-3 py-2.5 font-bold font-mono ${revVariance < -100 ? 'text-red-600' : 'text-green-600'}`}>
                              {revVariance >= 0 ? '+' : ''}KES {revVariance.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                                  <div className={`h-1.5 rounded-full ${Number(perfScore) >= 95 ? 'bg-green-500' : Number(perfScore) >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, Number(perfScore))}%` }} />
                                </div>
                                <span className={`text-xs font-bold ${Number(perfScore) >= 95 ? 'text-green-600' : Number(perfScore) >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {perfScore}%
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
                        <td className="px-3 py-2.5 font-mono text-blue-700 dark:text-blue-400">{(shopsReport.totals?.delivered || 0).toFixed(0)} L</td>
                        <td className="px-3 py-2.5 font-mono text-green-700 dark:text-green-400">{(shopsReport.totals?.sold || 0).toFixed(0)} L</td>
                        <td colSpan={2} className="px-3 py-2.5 font-mono">KES {(shopsReport.totals?.cash || 0).toLocaleString()}</td>
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

function PaymentReport({ payments, totals, loading, label, month, year, statusBadge }: any) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const paid    = payments.filter((p: any) => p.status === 'PAID');
  const unpaid  = payments.filter((p: any) => p.status !== 'PAID' && Number(p.netPay) > 0);
  const negatives = payments.filter((p: any) => Number(p.netPay) < 0);
  const byBank  = paid.filter((p: any) => p.farmer?.paymentMethod === 'BANK');
  const byMpesa = paid.filter((p: any) => p.farmer?.paymentMethod === 'MPESA');

  if (loading) return <LoadingCard />;
  if (!payments.length) return <EmptyCard msg={`No ${label.toLowerCase()} payment records for ${MONTHS[month-1]} ${year}`} />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Farmers', value: payments.length, color: 'text-gray-800 dark:text-gray-100' },
          { label: 'Paid (M-Pesa)', value: byMpesa.length, sub: `KES ${byMpesa.reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}`, color: 'text-green-700 dark:text-green-400' },
          { label: 'Paid (Bank)', value: byBank.length, sub: `KES ${byBank.reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}`, color: 'text-blue-700 dark:text-blue-400' },
          { label: 'Unpaid', value: unpaid.length, sub: `KES ${unpaid.reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}`, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Negatives', value: negatives.length, sub: 'Carried forward', color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Sections */}
      {[
        { title: `✅ Paid via M-Pesa (${byMpesa.length})`, rows: byMpesa, bg: 'bg-green-50 dark:bg-green-900/10' },
        { title: `🏦 Paid via Bank (${byBank.length})`, rows: byBank, bg: 'bg-blue-50 dark:bg-blue-900/10' },
        { title: `⏳ Unpaid — To Be Paid End Month (${unpaid.length})`, rows: unpaid, bg: 'bg-yellow-50 dark:bg-yellow-900/10' },
        { title: `⚠️ Negatives — Carried Forward (${negatives.length})`, rows: negatives, bg: 'bg-red-50 dark:bg-red-900/10' },
      ].map(section => section.rows.length > 0 && (
        <div key={section.title} className={`rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden ${section.bg}`}>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-sm text-gray-700 dark:text-gray-300">{section.title}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                <tr>{['Code','Farmer','Route','Method','Account','Litres','Gross','Advances','Net Pay','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {section.rows.map((p: any) => (
                  <tr key={p.id} className="border-b dark:border-gray-700 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-gray-400">{p.farmer?.code}</td>
                    <td className="px-3 py-2 font-medium text-xs">{p.farmer?.name}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.farmer?.route?.name}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${p.farmer?.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{p.farmer?.paymentMethod === 'MPESA' ? '📱' : '🏦'} {p.farmer?.paymentMethod}</span></td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.farmer?.paymentMethod === 'MPESA' ? p.farmer?.mpesaPhone || p.farmer?.phone : p.farmer?.bankAccount}</td>
                    <td className="px-3 py-2 font-mono text-xs">{(Number(p.grossPay)/46).toFixed(0)} L</td>
                    <td className="px-3 py-2 font-mono text-xs">KES {Number(p.grossPay).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs text-orange-600">KES {Number(p.totalAdvances).toLocaleString()}</td>
                    <td className={`px-3 py-2 font-bold font-mono text-xs ${Number(p.netPay) < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`}>KES {Number(p.netPay).toLocaleString()}</td>
                    <td className="px-3 py-2"><span className={statusBadge(p.status)}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-white/70 dark:bg-gray-800/70 border-t dark:border-gray-700 font-bold">
                <tr>
                  <td className="px-3 py-2 text-xs" colSpan={8}>SUBTOTAL ({section.rows.length})</td>
                  <td className="px-3 py-2 font-mono text-xs text-green-700 dark:text-green-400">
                    KES {section.rows.reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
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
