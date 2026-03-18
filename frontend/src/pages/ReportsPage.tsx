import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

type ReportTab = 'overview' | 'collections' | 'farmers' | 'graders' | 'factory' | 'payments';

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [tab, setTab]     = useState<ReportTab>('overview');

  const params = { month, year };

  // Overview stats
  const { data: overviewData } = useQuery({
    queryKey: ['report-overview', month, year],
    queryFn: () => api.get('/api/reports/overview', { params }),
    enabled: tab === 'overview',
  });
  const ov = overviewData?.data || {};

  // Collections report
  const { data: collData } = useQuery({
    queryKey: ['report-collections', month, year],
    queryFn: () => api.get('/api/reports/collections', { params }),
    enabled: tab === 'collections',
  });
  const coll = collData?.data || {};

  // Farmers report
  const { data: farmersData } = useQuery({
    queryKey: ['report-farmers', month, year],
    queryFn: () => api.get('/api/reports/farmers', { params }),
    enabled: tab === 'farmers',
  });
  const farmersReport: any[] = farmersData?.data?.farmers ?? [];

  // Graders report
  const { data: gradersData } = useQuery({
    queryKey: ['report-graders', month, year],
    queryFn: () => api.get('/api/reports/graders', { params }),
    enabled: tab === 'graders',
  });
  const gradersReport: any[] = gradersData?.data?.graders ?? [];

  // Factory report
  const { data: factoryData } = useQuery({
    queryKey: ['report-factory', month, year],
    queryFn: () => api.get('/api/reports/factory', { params }),
    enabled: tab === 'factory',
  });
  const factory = factoryData?.data || {};

  // Payments report
  const { data: paymentsData } = useQuery({
    queryKey: ['report-payments', month, year],
    queryFn: () => api.get('/api/reports/payments', { params }),
    enabled: tab === 'payments',
  });
  const paymentsReport = paymentsData?.data || {};

  const downloadCSV = async (endpoint: string, filename: string) => {
    try {
      const res = await api.get(endpoint, { params: { ...params, format: 'csv' }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  const TABS: { key: ReportTab; label: string; icon: string }[] = [
    { key: 'overview',    label: 'Overview',    icon: '📊' },
    { key: 'collections', label: 'Collections', icon: '🥛' },
    { key: 'farmers',     label: 'Farmers',     icon: '👨‍🌾' },
    { key: 'graders',     label: 'Graders',     icon: '📋' },
    { key: 'factory',     label: 'Factory',     icon: '🏭' },
    { key: 'payments',    label: 'Payments',    icon: '💰' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500">Full business performance — {MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-green-600 text-white shadow-sm' : 'border border-gray-300 hover:bg-gray-50'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Litres Collected', value: `${Number(ov.totalLitres || 0).toFixed(0)} L`, sub: `${ov.activeFarmers || 0} active farmers`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              { label: 'Gross Farmer Payments', value: `KES ${Number(ov.grossPayments || 0).toLocaleString()}`, sub: `@ KES 46/L`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
              { label: 'Total Advances', value: `KES ${Number(ov.totalAdvances || 0).toLocaleString()}`, sub: `${ov.farmersWithAdvances || 0} farmers`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
              { label: 'Net Farmer Payments', value: `KES ${Number(ov.netPayments || 0).toLocaleString()}`, sub: `After deductions`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
              { label: 'Factory Received', value: `${Number(ov.factoryReceived || 0).toFixed(0)} L`, sub: `From all graders`, color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
              { label: 'Total Variance', value: `${Number(ov.totalVariance || 0).toFixed(0)} L`, sub: `Collected vs received`, color: Number(ov.totalVariance) < 0 ? 'text-red-600' : 'text-green-600', bg: Number(ov.totalVariance) < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
              { label: 'Shop Sales', value: `${Number(ov.shopSales || 0).toFixed(0)} L`, sub: `${ov.activeShops || 0} shops`, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
              { label: 'Negative Balances', value: `${ov.negativeBalances || 0}`, sub: `Farmers in debt`, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Flow summary */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Milk Flow — {MONTHS[month-1]} {year}</h3>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              {[
                { label: 'Farmer Gate', value: `${Number(ov.totalLitres||0).toFixed(0)}L`, color: 'bg-blue-100 text-blue-800' },
                { label: '→', value: '', color: '' },
                { label: 'Factory Received', value: `${Number(ov.factoryReceived||0).toFixed(0)}L`, color: 'bg-teal-100 text-teal-800' },
                { label: '→', value: '', color: '' },
                { label: 'Pasteurized', value: `${Number(ov.pasteurized||0).toFixed(0)}L`, color: 'bg-purple-100 text-purple-800' },
                { label: '→', value: '', color: '' },
                { label: 'Sold to Shops', value: `${Number(ov.shopSales||0).toFixed(0)}L`, color: 'bg-green-100 text-green-800' },
                { label: '→', value: '', color: '' },
                { label: 'Revenue', value: `KES ${(Number(ov.shopSales||0)*60).toLocaleString()}`, color: 'bg-yellow-100 text-yellow-800' },
              ].map((s, i) => s.label === '→' ? (
                <span key={i} className="text-gray-300 text-lg">→</span>
              ) : (
                <div key={i} className={`px-3 py-2 rounded-lg ${s.color}`}>
                  <div className="text-xs opacity-70">{s.label}</div>
                  <div className="font-bold">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── COLLECTIONS ── */}
      {tab === 'collections' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => downloadCSV('/api/reports/collections', `collections-${MONTHS[month-1]}-${year}.csv`)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="text-xs text-gray-400">Total Litres</div>
              <div className="text-2xl font-bold text-blue-700">{Number(coll.totalLitres||0).toFixed(1)} L</div>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="text-xs text-gray-400">Active Farmers</div>
              <div className="text-2xl font-bold text-gray-800">{coll.activeFarmers || 0}</div>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="text-xs text-gray-400">Zero-Litre Farmers</div>
              <div className="text-2xl font-bold text-red-600">{coll.zeroFarmers || 0}</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Route','Farmers','Total Litres','Avg/Farmer','Avg/Day','Value (KES)'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {(coll.byRoute || []).map((r: any) => (
                  <tr key={r.routeId} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.routeName}</td>
                    <td className="px-4 py-3">{r.farmerCount}</td>
                    <td className="px-4 py-3 font-bold text-blue-700">{Number(r.totalLitres).toFixed(1)} L</td>
                    <td className="px-4 py-3">{r.farmerCount > 0 ? (Number(r.totalLitres)/r.farmerCount).toFixed(1) : '0'} L</td>
                    <td className="px-4 py-3">{(Number(r.totalLitres)/30).toFixed(1)} L</td>
                    <td className="px-4 py-3 font-mono">KES {(Number(r.totalLitres)*46).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FARMERS ── */}
      {tab === 'farmers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => downloadCSV('/api/reports/farmers', `farmers-report-${MONTHS[month-1]}-${year}.csv`)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Code','Farmer','Route','Litres','Gross Pay','Advances','B/F Debt','Net Pay','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {farmersReport.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No payment data for this month</td></tr>
                ) : farmersReport.map((f: any) => (
                  <tr key={f.farmerId} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{f.farmerCode}</td>
                    <td className="px-3 py-2.5 font-medium">{f.farmerName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{f.routeName}</td>
                    <td className="px-3 py-2.5 font-mono">{Number(f.totalLitres).toFixed(1)} L</td>
                    <td className="px-3 py-2.5 font-mono">KES {Number(f.grossPay).toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono text-orange-600">KES {Number(f.advances).toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono text-red-500">KES {Number(f.bfDebt||0).toLocaleString()}</td>
                    <td className={`px-3 py-2.5 font-bold font-mono ${Number(f.netPay) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      KES {Number(f.netPay).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${Number(f.netPay) < 0 ? 'bg-red-100 text-red-600' : Number(f.netPay) === 0 ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                        {Number(f.netPay) < 0 ? 'Negative' : Number(f.netPay) === 0 ? 'Zero' : 'Payable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GRADERS ── */}
      {tab === 'graders' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => downloadCSV('/api/reports/graders', `graders-report-${MONTHS[month-1]}-${year}.csv`)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Code','Grader','Route','Collected','Received at Factory','Variance (L)','Variance (KES)','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {gradersReport.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No grader data for this month</td></tr>
                ) : gradersReport.map((g: any) => {
                  const varL = Number(g.variance || 0);
                  const varKes = Math.abs(varL) * 46;
                  return (
                    <tr key={g.graderId} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{g.graderCode}</td>
                      <td className="px-3 py-2.5 font-medium">{g.graderName}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{g.routeName || '–'}</td>
                      <td className="px-3 py-2.5 font-mono text-blue-700">{Number(g.collected).toFixed(1)} L</td>
                      <td className="px-3 py-2.5 font-mono text-green-700">{Number(g.received).toFixed(1)} L</td>
                      <td className={`px-3 py-2.5 font-bold font-mono ${varL < 0 ? 'text-red-600' : varL > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {varL >= 0 ? '+' : ''}{varL.toFixed(1)} L
                      </td>
                      <td className={`px-3 py-2.5 font-mono ${varL < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {varL < 0 ? `KES ${varKes.toLocaleString()}` : '–'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${varL < 0 ? 'bg-red-100 text-red-600' : varL === 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {varL < 0 ? '⚠ Missing' : varL === 0 ? '✓ Perfect' : 'Excess'}
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

      {/* ── FACTORY ── */}
      {tab === 'factory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Received', value: `${Number(factory.received||0).toFixed(0)} L`, color: 'text-blue-700' },
              { label: 'Total Input', value: `${Number(factory.input||0).toFixed(0)} L`, color: 'text-purple-700' },
              { label: 'Total Output', value: `${Number(factory.output||0).toFixed(0)} L`, color: 'text-green-700' },
              { label: 'Total Loss', value: `${Number(factory.loss||0).toFixed(0)} L`, color: 'text-red-600' },
              { label: 'Efficiency', value: `${factory.efficiency || '–'}%`, color: Number(factory.efficiency) >= 95 ? 'text-green-700' : 'text-orange-600' },
              { label: 'Delivered to Shops', value: `${Number(factory.delivered||0).toFixed(0)} L`, color: 'text-teal-700' },
              { label: 'Total Batches', value: factory.batches || 0, color: 'text-gray-800' },
              { label: 'Shop Revenue', value: `KES ${(Number(factory.delivered||0)*60).toLocaleString()}`, color: 'text-green-700' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PAYMENTS ── */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => downloadCSV('/api/reports/payments', `payments-${MONTHS[month-1]}-${year}.csv`)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Farmers Paid', value: paymentsReport.paidCount || 0, color: 'text-green-700' },
              { label: 'Total Gross', value: `KES ${Number(paymentsReport.totalGross||0).toLocaleString()}`, color: 'text-blue-700' },
              { label: 'Total Advances', value: `KES ${Number(paymentsReport.totalAdvances||0).toLocaleString()}`, color: 'text-orange-600' },
              { label: 'Total Net', value: `KES ${Number(paymentsReport.totalNet||0).toLocaleString()}`, color: 'text-green-700' },
              { label: 'Mid-Month Paid', value: paymentsReport.midMonthCount || 0, color: 'text-purple-700' },
              { label: 'End-Month Paid', value: paymentsReport.endMonthCount || 0, color: 'text-teal-700' },
              { label: 'Negative Balances', value: paymentsReport.negativeCount || 0, color: 'text-red-600' },
              { label: 'Carried Forward', value: `KES ${Number(paymentsReport.carriedForward||0).toLocaleString()}`, color: 'text-red-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
