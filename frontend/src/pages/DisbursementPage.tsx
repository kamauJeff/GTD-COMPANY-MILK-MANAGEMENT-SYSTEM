import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { showSuccess, showError } from '../components/Toast';
import { CheckCircle, AlertTriangle, RefreshCw, Send, DollarSign } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function DisbursementPage() {
  const now = new Date();
  const [month, setMonth]       = useState(now.getMonth() + 1);
  const [year, setYear]         = useState(now.getFullYear());
  const [isMidMonth, setMid]    = useState(false);
  const [routeId, setRouteId]   = useState('');
  const [refreshing, setRefresh] = useState(false);
  const qc = useQueryClient();

  // KopoKopo config state
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: '',
    tillIdentifier: '',
    env: 'sandbox' as 'sandbox' | 'production',
  });

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => api.get('/api/routes'), staleTime: 0 });
  const routes: any[] = routesData?.data ?? [];

  // Load APPROVED payments ready for disbursement
  const { data: paymentsData, isLoading, refetch } = useQuery({
    queryKey: ['disburse-approved', month, year, isMidMonth, routeId],
    queryFn: () => api.get('/api/payments', { params: { month, year, isMidMonth, status: 'APPROVED', routeId: routeId || undefined } }),
    staleTime: 0, refetchOnMount: true,
  });

  const payments: any[] = paymentsData?.data?.payments ?? [];
  const mpesaPayments = payments.filter(p => p.farmer?.paymentMethod === 'MPESA' && Number(p.netPay) > 0);
  const bankPayments  = payments.filter(p => p.farmer?.paymentMethod === 'BANK'  && Number(p.netPay) > 0);
  const totalMpesa = mpesaPayments.reduce((s, p) => s + Number(p.netPay), 0);
  const totalBank  = bankPayments.reduce((s, p) => s + Number(p.netPay), 0);

  // KopoKopo balance
  const { data: balData } = useQuery({
    queryKey: ['kopokopo-balance'],
    queryFn: () => api.get('/api/payments/kopokopo-balance'),
    staleTime: 0, refetchOnMount: true,
  });
  const kpBalance = balData?.data?.balance;

  const disburseMut = useMutation({
    mutationFn: () => api.post('/api/payments/disburse', { month, year, isMidMonth, routeId: routeId || undefined }),
    onSuccess: (r) => {
      const d = r.data;
      showSuccess(`✅ Disbursed ${d.successful}/${d.total}`, `M-Pesa: ${d.successful} · Bank CSV: ${d.bankPayments} · Failed: ${d.failed}`);
      qc.invalidateQueries({ queryKey: ['disburse-approved'] });
      qc.invalidateQueries({ queryKey: ['payments-records'] });
      qc.invalidateQueries({ queryKey: ['report-payment-mid'] });
      qc.invalidateQueries({ queryKey: ['report-payment-end'] });
      qc.invalidateQueries({ queryKey: ['kopokopo-balance'] });
    },
    onError: (e: any) => showError(e?.response?.data?.error || 'Disbursement failed'),
  });

  const saveConfigMut = useMutation({
    mutationFn: () => api.post('/api/payments/kopokopo-config', config),
    onSuccess: () => { showSuccess('KopoKopo configured'); setShowConfig(false); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed to save config'),
  });

  async function handleRefresh() {
    setRefresh(true);
    await refetch();
    await qc.invalidateQueries({ queryKey: ['kopokopo-balance'] });
    setRefresh(false);
  }

  const exportBankCSV = () => {
    const rows = [['Farmer Code','Name','Bank','Account','Amount']];
    bankPayments.forEach(p => rows.push([p.farmer?.code, p.farmer?.name, p.farmer?.bankName || '', p.farmer?.bankAccount || '', String(Number(p.netPay))]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `bank-payments-${MONTHS[month-1]}-${year}-${isMidMonth ? 'mid' : 'end'}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Send size={22} className="text-green-600" /> Disbursement Console
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Director / Finance Manager only · Approve and disburse farmer payments</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20">
            ⚙️ KopoKopo Config
          </button>
        </div>
      </div>

      {/* KopoKopo Config Panel */}
      {showConfig && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-4">🔑 KopoKopo API Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Client ID</label>
              <input value={config.clientId} onChange={e => setConfig(c => ({...c, clientId: e.target.value}))}
                placeholder="From KopoKopo developer portal" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Client Secret</label>
              <input type="password" value={config.clientSecret} onChange={e => setConfig(c => ({...c, clientSecret: e.target.value}))}
                placeholder="••••••••" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Till / Account Identifier</label>
              <input value={config.tillIdentifier} onChange={e => setConfig(c => ({...c, tillIdentifier: e.target.value}))}
                placeholder="Your KopoKopo till number" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Environment</label>
              <select value={config.env} onChange={e => setConfig(c => ({...c, env: e.target.value as any}))}
                className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                <option value="sandbox">Sandbox (testing)</option>
                <option value="production">Production (live money)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2 items-center">
            <button onClick={() => saveConfigMut.mutate()} disabled={saveConfigMut.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saveConfigMut.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
            <p className="text-xs text-gray-400">Credentials are stored securely as environment variables on Railway.</p>
          </div>
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
            <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium">⚠️ Production mode will send REAL M-Pesa payments. Always test in sandbox first.</p>
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
            <button onClick={() => setMid(true)} className={`px-4 py-2.5 text-sm font-medium ${isMidMonth ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              Mid Month (1–15)
            </button>
            <button onClick={() => setMid(false)} className={`px-4 py-2.5 text-sm font-medium border-l border-gray-200 dark:border-gray-600 ${!isMidMonth ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              End Month (16–31)
            </button>
          </div>
          <select value={routeId} onChange={e => setRouteId(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">All Routes</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* KopoKopo balance */}
      {kpBalance !== undefined && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border mb-4 ${Number(kpBalance) >= totalMpesa ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'}`}>
          <DollarSign size={20} className={Number(kpBalance) >= totalMpesa ? 'text-green-600' : 'text-red-600'} />
          <div>
            <div className={`font-bold text-sm ${Number(kpBalance) >= totalMpesa ? 'text-green-700 dark:text-green-400' : 'text-red-700'}`}>
              KopoKopo Balance: KES {Number(kpBalance).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">{Number(kpBalance) >= totalMpesa ? `✓ Sufficient — M-Pesa total is KES ${totalMpesa.toLocaleString()}` : `⚠️ Insufficient — Need KES ${(totalMpesa - Number(kpBalance)).toLocaleString()} more`}</div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Approved Farmers', value: payments.length, color: 'text-gray-800 dark:text-gray-100', bg: 'bg-white dark:bg-gray-900' },
          { label: '📱 M-Pesa Total', value: `KES ${totalMpesa.toLocaleString()}`, sub: `${mpesaPayments.length} farmers`, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: '🏦 Bank Transfer Total', value: `KES ${totalBank.toLocaleString()}`, sub: `${bankPayments.length} farmers`, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border border-gray-200 dark:border-gray-700 p-4 ${s.bg}`}>
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Disbursement actions */}
      {payments.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">💳 Disburse Payments</h3>
          <div className="flex gap-3 flex-wrap">
            {mpesaPayments.length > 0 && (
              <button onClick={() => disburseMut.mutate()} disabled={disburseMut.isPending}
                className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 text-sm">
                <Send size={16} />
                {disburseMut.isPending ? 'Sending M-Pesa...' : `Send ${mpesaPayments.length} M-Pesa Payments (KES ${totalMpesa.toLocaleString()})`}
              </button>
            )}
            {bankPayments.length > 0 && (
              <button onClick={exportBankCSV}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 text-sm">
                📥 Download Bank CSV ({bankPayments.length} farmers · KES {totalBank.toLocaleString()})
              </button>
            )}
            <button onClick={async () => {
                try {
                  const r = await api.post('/api/notifications/payment-sms', { month, year, isMidMonth, routeId: routeId || undefined });
                  showSuccess(`📱 ${r.data.message}`);
                } catch (e: any) { showError(e?.response?.data?.error || 'SMS failed'); }
              }}
              className="flex items-center gap-2 px-5 py-3 bg-green-700 text-white rounded-xl font-medium hover:bg-green-800 text-sm">
              📱 Notify Farmers via SMS
            </button>
          </div>
          {disburseMut.isPending && (
            <div className="mt-3 text-xs text-gray-400 animate-pulse">Processing payments via KopoKopo API...</div>
          )}
        </div>
      )}

      {/* Payments table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">
            Approved Payments — {MONTHS[month-1]} {year} · {isMidMonth ? 'Mid Month' : 'End Month'}
          </h3>
          <span className="text-xs text-gray-400">{payments.length} farmers</span>
        </div>
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading approved payments...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle size={40} className="mx-auto mb-3 opacity-20" />
            <div className="font-medium">No approved payments for this period</div>
            <div className="text-xs mt-1">Go to Payments → Generate → Approve, then come back here to disburse</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <tr>{['Code','Farmer','Route','Method','Account','Period',isMidMonth ? 'Litres (1–15)' : 'Litres (period)','Gross','Deductions','Net Pay','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className={`border-b dark:border-gray-700 last:border-0 ${Number(p.netPay) < 0 ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{p.farmer?.code}</td>
                    <td className="px-3 py-2.5 font-medium text-xs">{p.farmer?.name}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.farmer?.route?.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.farmer?.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.farmer?.paymentMethod === 'MPESA' ? '📱' : '🏦'} {p.farmer?.paymentMethod}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.farmer?.paymentMethod === 'MPESA' ? p.farmer?.mpesaPhone || p.farmer?.phone : p.farmer?.bankAccount}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.farmer?.paidOn15th ? (isMidMonth ? '1–15' : '16–end') : '1–end'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{Number(p.totalLitres || 0).toFixed(1)} L</td>
                    <td className="px-3 py-2.5 font-mono text-xs">KES {Number(p.grossPay).toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-red-600">- KES {Number(p.totalDeductions ?? p.totalAdvances).toLocaleString()}</td>
                    <td className={`px-3 py-2.5 font-bold font-mono text-xs ${Number(p.netPay) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      KES {Number(p.netPay).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 font-bold">
                <tr>
                  <td className="px-3 py-2.5 text-xs" colSpan={8}>TOTAL ({payments.length} farmers)</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-red-600">- KES {payments.reduce((s: number, p: any) => s + Number(p.totalDeductions ?? p.totalAdvances ?? 0), 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-green-700">KES {payments.filter((p: any) => Number(p.netPay) > 0).reduce((s: number, p: any) => s + Number(p.netPay), 0).toLocaleString()}</td>
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
