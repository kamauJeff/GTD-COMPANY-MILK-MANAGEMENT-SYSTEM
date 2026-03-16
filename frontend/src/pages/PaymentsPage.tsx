import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, routesApi } from '../api/client';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PaymentsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [period, setPeriod] = useState<'mid' | 'end'>('end');
  const [routeId, setRouteId] = useState('');
  const [tab, setTab] = useState<'journal' | 'advance' | 'disburse'>('journal');
  const qc = useQueryClient();

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });
  const routes: any[] = routesData?.data ?? [];

  const { data: listData, isLoading } = useQuery({
    queryKey: ['payments', month, year, period, routeId],
    queryFn: () => paymentsApi.list({ month, year, isMidMonth: period === 'mid', routeId: routeId || undefined }),
  });
  const payments: any[] = listData?.data?.payments ?? listData?.data ?? [];

  const approveMutation = useMutation({
    mutationFn: () => paymentsApi.approve({ periodMonth: month, periodYear: year, isMidMonth: period === 'mid', routeId: routeId || undefined }),
    onSuccess: () => { alert('Payments approved!'); qc.invalidateQueries({ queryKey: ['payments'] }); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to approve'),
  });

  const [advForm, setAdvForm] = useState({ farmerCode: '', amount: '', notes: '', date: new Date().toISOString().split('T')[0] });
  const advanceMutation = useMutation({
    mutationFn: () => paymentsApi.recordAdvance({ farmerCode: advForm.farmerCode.toUpperCase(), amount: Number(advForm.amount), notes: advForm.notes, date: advForm.date }),
    onSuccess: () => { alert('Advance recorded!'); setAdvForm(f => ({ ...f, farmerCode: '', amount: '', notes: '' })); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to record advance'),
  });

  const pending = payments.filter(p => p.status === 'PENDING').length;
  const approved = payments.filter(p => p.status === 'APPROVED').length;
  const paid = payments.filter(p => p.status === 'PAID').length;
  const totalNet = payments.reduce((s, p) => s + Number(p.netPay || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Farmer Payments Journal</h1>
          <p className="text-sm text-gray-500">{MONTHS[month-1]} {year} · Daily milk · Advances · Net Pay</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setPeriod('mid')} className={`px-3 py-2 text-sm ${period === 'mid' ? 'bg-green-600 text-white' : 'bg-white hover:bg-gray-50'}`}>Mid Month (15th)</button>
            <button onClick={() => setPeriod('end')} className={`px-3 py-2 text-sm ${period === 'end' ? 'bg-green-600 text-white' : 'bg-white hover:bg-gray-50'}`}>End Month</button>
          </div>
          <select value={routeId} onChange={e => setRouteId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Routes</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm"><div className="text-xs text-gray-400 mb-1">Farmers</div><div className="text-2xl font-bold">{payments.length}</div></div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4"><div className="text-xs text-yellow-600 mb-1">Pending</div><div className="text-2xl font-bold text-yellow-700">{pending}</div></div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4"><div className="text-xs text-blue-600 mb-1">Approved</div><div className="text-2xl font-bold text-blue-700">{approved}</div></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4"><div className="text-xs text-green-600 mb-1">Total Net Pay</div><div className="text-lg font-bold text-green-700">KES {totalNet.toLocaleString()}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['journal','advance','disburse'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-green-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
            {t === 'journal' ? '📋 Journal' : t === 'advance' ? '💳 Record Advance' : '🚀 Disburse'}
          </button>
        ))}
        {(pending > 0 || approved > 0) && (
          <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {approveMutation.isPending ? 'Approving...' : `✅ Approve ${pending} Pending`}
          </button>
        )}
      </div>

      {tab === 'journal' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Farmer Code','Name','Route','Gross Pay','Advances','Deductions','Net Pay','Status','Paid At'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No payment records found for this period.</td></tr>
                ) : payments.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-xs">{p.farmer?.code}</td>
                    <td className="px-3 py-2.5 font-medium">{p.farmer?.name}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.farmer?.route?.name}</td>
                    <td className="px-3 py-2.5 font-mono">KES {Number(p.grossPay).toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono text-red-600">{Number(p.totalAdvances) > 0 ? `- ${Number(p.totalAdvances).toLocaleString()}` : '–'}</td>
                    <td className="px-3 py-2.5 font-mono text-red-600">{Number(p.totalDeductions) > 0 ? `- ${Number(p.totalDeductions).toLocaleString()}` : '–'}</td>
                    <td className={`px-3 py-2.5 font-bold font-mono ${Number(p.netPay) < 0 ? 'text-red-600' : 'text-green-700'}`}>KES {Number(p.netPay).toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'PAID' ? 'bg-green-100 text-green-700' : p.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-KE') : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'advance' && (
        <div className="bg-white rounded-xl border p-6 shadow-sm max-w-md">
          <h3 className="font-semibold text-gray-800 mb-4">Record Farmer Advance</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Farmer Code *</label>
              <input value={advForm.farmerCode} onChange={e => setAdvForm(f => ({...f, farmerCode: e.target.value.toUpperCase()}))}
                placeholder="e.g. FM0668" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <input value={advForm.notes} onChange={e => setAdvForm(f => ({...f, notes: e.target.value}))}
                placeholder="Optional note..." className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <button onClick={() => advanceMutation.mutate()} disabled={advanceMutation.isPending}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {advanceMutation.isPending ? 'Recording...' : 'Record Advance'}
            </button>
          </div>
        </div>
      )}

      {tab === 'disburse' && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">KopoKopo Disbursement</h3>
          <p className="text-sm text-gray-500 mb-4">Disburse payments to {approved} approved farmers via M-Pesa bulk payment.</p>
          {approved === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              No approved payments yet. First approve payments using the button above, then come back to disburse.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm font-medium text-green-800">{approved} farmers ready for disbursement</div>
                <div className="text-lg font-bold text-green-700 mt-1">KES {payments.filter(p => p.status === 'APPROVED').reduce((s, p) => s + Number(p.netPay), 0).toLocaleString()}</div>
              </div>
              <button className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                🚀 Send via KopoKopo M-Pesa
              </button>
              <p className="text-xs text-gray-400">All phone numbers must be in 254XXXXXXXXX format. Go to Farmers page and click "Fix Phones to 254" first.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
