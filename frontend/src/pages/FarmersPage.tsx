import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmersApi, routesApi, collectionsApi, paymentsApi } from '../api/client';
import { Search, Upload, Download, Plus, X, Phone, MapPin, CreditCard, Edit2, History, DollarSign, Save, XCircle } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FarmersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [routeFilter, setRouteFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [panelTab, setPanelTab] = useState<'details'|'collections'|'payments'>('details');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['farmers', search, page, routeFilter, showInactive],
    queryFn: () => farmersApi.list({ search, page, limit: 50, routeId: routeFilter || undefined, isActive: showInactive ? undefined : true }),
  });
  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });
  const farmers: any[] = data?.data?.data ?? [];
  const total: number = data?.data?.total ?? 0;
  const routes: any[] = routesData?.data ?? [];

  // Auto-fix phones silently
  useEffect(() => { farmersApi.fixPhones().catch(() => {}); }, []);

  // Load full farmer details when selected
  const { data: farmerDetail } = useQuery({
    queryKey: ['farmer', selected?.id],
    queryFn: () => farmersApi.get(selected.id),
    enabled: !!selected?.id,
  });
  const detail = farmerDetail?.data;

  // Collections for this farmer (last 3 months)
  const { data: collectionsData } = useQuery({
    queryKey: ['farmer-collections', selected?.id],
    queryFn: () => collectionsApi.journal({ farmerId: selected.id, months: 3 }),
    enabled: !!selected?.id && panelTab === 'collections',
  });

  // Payments for this farmer
  const { data: paymentsData } = useQuery({
    queryKey: ['farmer-payments', selected?.id],
    queryFn: () => paymentsApi.list({ farmerId: selected.id }),
    enabled: !!selected?.id && panelTab === 'payments',
  });
  const farmerPayments: any[] = paymentsData?.data?.payments ?? paymentsData?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: (data: any) => farmersApi.update(selected.id, data),
    onSuccess: (res) => {
      setSelected(res.data);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['farmers'] });
      qc.invalidateQueries({ queryKey: ['farmer', selected.id] });
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Update failed'),
  });

  const handleEdit = () => {
    setEditForm({
      name: detail?.name || selected.name,
      phone: detail?.phone || selected.phone,
      idNumber: detail?.idNumber || selected.idNumber || '',
      paymentMethod: detail?.paymentMethod || selected.paymentMethod,
      mpesaPhone: detail?.mpesaPhone || selected.mpesaPhone || '',
      bankName: detail?.bankName || selected.bankName || '',
      bankAccount: detail?.bankAccount || selected.bankAccount || '',
      pricePerLitre: detail?.pricePerLitre || selected.pricePerLitre,
      paidOn15th: detail?.paidOn15th ?? selected.paidOn15th,
      isActive: detail?.isActive ?? selected.isActive,
    });
    setEditing(true);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { await farmersApi.importExcel(file); alert('Import successful!'); refetch(); }
    catch { alert('Import failed.'); }
  };

  const handleExport = async () => {
    const res = await farmersApi.exportExcel();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url; a.download = 'farmers.xlsx'; a.click();
  };

  const selectFarmer = (f: any) => {
    setSelected(selected?.id === f.id ? null : f);
    setPanelTab('details');
    setEditing(false);
  };

  // Build collection calendar from detail
  const collections = detail?.collections || [];
  const collByDay: Record<string, number> = {};
  collections.forEach((c: any) => {
    const d = new Date(c.collectedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    collByDay[key] = (collByDay[key] || 0) + Number(c.litres);
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main list */}
      <div className={`flex-1 overflow-auto transition-all duration-300 ${selected ? 'mr-[420px]' : ''}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Farmers</h1>
              <p className="text-sm text-gray-500">{total.toLocaleString()} farmers · {routes.length} routes</p>
            </div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload size={14} /> Import
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              </label>
              <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download size={14} /> Export
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Plus size={14} /> Add Farmer
              </button>
            </div>
          </div>

          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name, code or phone…"
                className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <select value={routeFilter} onChange={e => { setRouteFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">All Routes</option>
              {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['#','Code','Name & Phone','Route','Payment','Account Details','Period','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
                : farmers.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No farmers found.</td></tr>
                : farmers.map((f, i) => (
                  <tr key={f.id} onClick={() => selectFarmer(f)}
                    className={`border-b last:border-0 cursor-pointer transition-colors ${selected?.id === f.id ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-3 text-gray-400 text-xs">{(page-1)*50+i+1}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-500">{f.code}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-800">{f.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{f.phone}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{f.route?.name ?? '–'}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {f.paymentMethod === 'MPESA' ? '📱 M-Pesa' : '🏦 Bank'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {f.paymentMethod === 'BANK' ? (
                        <div>
                          <div className="font-medium text-gray-700">{f.bankName || '–'}</div>
                          <div className="font-mono text-gray-500">{f.bankAccount || '–'}</div>
                        </div>
                      ) : <span className="font-mono text-gray-600">{f.mpesaPhone || f.phone}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${f.paidOn15th ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {f.paidOn15th ? 'Mid Month' : 'End Month'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${f.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
                        {f.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 50 && (
              <div className="flex justify-between items-center px-4 py-3 border-t text-sm text-gray-500 bg-gray-50">
                <span>Showing {(page-1)*50+1}–{Math.min(page*50,total)} of {total.toLocaleString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-white">Prev</button>
                  <button onClick={() => setPage(p=>p+1)} disabled={page*50>=total} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-white">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      {selected && (
        <div className="fixed right-0 top-0 h-full w-[420px] bg-white border-l shadow-2xl z-40 flex flex-col">
          {/* Header */}
          <div className="bg-green-700 p-4 text-white flex-shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-green-200">{selected.code}</div>
                <h2 className="text-lg font-bold leading-tight">{selected.name}</h2>
                <div className="text-green-200 text-sm">{selected.route?.name}</div>
              </div>
              <button onClick={() => { setSelected(null); setEditing(false); }} className="text-green-200 hover:text-white p-1"><X size={18} /></button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 mt-3">
              {[['details','Details'],['collections','Collections'],['payments','Payments']].map(([t,l]) => (
                <button key={t} onClick={() => { setPanelTab(t as any); setEditing(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${panelTab === t ? 'bg-white text-green-700' : 'text-green-100 hover:bg-green-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* DETAILS TAB */}
            {panelTab === 'details' && (
              <div className="p-4 space-y-4">
                {editing ? (
                  /* Edit Form */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">Edit Farmer</h3>
                      <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={18} /></button>
                    </div>
                    {[
                      {label:'Full Name', key:'name', type:'text'},
                      {label:'Phone', key:'phone', type:'text'},
                      {label:'ID Number', key:'idNumber', type:'text'},
                      {label:'Price per Litre', key:'pricePerLitre', type:'number'},
                    ].map(({label,key,type}) => (
                      <div key={key}>
                        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                        <input type={type} value={editForm[key] || ''} onChange={e => setEditForm((f:any) => ({...f, [key]: e.target.value}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Payment Method</label>
                      <select value={editForm.paymentMethod} onChange={e => setEditForm((f:any) => ({...f, paymentMethod: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="MPESA">M-Pesa</option>
                        <option value="BANK">Bank Transfer</option>
                      </select>
                    </div>
                    {editForm.paymentMethod === 'MPESA' ? (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">M-Pesa Number (254...)</label>
                        <input value={editForm.mpesaPhone || ''} onChange={e => setEditForm((f:any) => ({...f, mpesaPhone: e.target.value}))}
                          placeholder="254XXXXXXXXX" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Bank Name</label>
                          <input value={editForm.bankName || ''} onChange={e => setEditForm((f:any) => ({...f, bankName: e.target.value}))}
                            placeholder="e.g. EQUITY, K-UNITY" className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Account Number</label>
                          <input value={editForm.bankAccount || ''} onChange={e => setEditForm((f:any) => ({...f, bankAccount: e.target.value}))}
                            placeholder="Account number" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Payment Period</label>
                      <select value={editForm.paidOn15th ? 'mid' : 'end'} onChange={e => setEditForm((f:any) => ({...f, paidOn15th: e.target.value === 'mid'}))}
                        className="w-full px-3 py-2 border rounded-lg text-sm">
                        <option value="end">End of Month</option>
                        <option value="mid">Mid Month (15th)</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        <Save size={14} /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => setEditing(false)} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Details */
                  <div className="space-y-4">
                    {/* Status badges */}
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${selected.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {selected.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${selected.paidOn15th ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {selected.paidOn15th ? 'Mid Month' : 'End Month'}
                      </span>
                    </div>

                    {/* Contact */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</h4>
                      <div className="flex items-center gap-3">
                        <Phone size={14} className="text-gray-400 flex-shrink-0" />
                        <div><div className="text-xs text-gray-400">Phone</div><div className="font-mono font-medium">{selected.phone}</div></div>
                      </div>
                      {selected.idNumber && (
                        <div className="flex items-center gap-3">
                          <CreditCard size={14} className="text-gray-400 flex-shrink-0" />
                          <div><div className="text-xs text-gray-400">ID Number</div><div className="font-mono">{selected.idNumber}</div></div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                        <div><div className="text-xs text-gray-400">Route</div><div className="font-medium">{selected.route?.name} <span className="text-gray-400 text-xs">({selected.route?.code})</span></div></div>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payment Details</h4>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Method</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selected.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {selected.paymentMethod === 'MPESA' ? '📱 M-Pesa' : '🏦 Bank Transfer'}
                        </span>
                      </div>
                      {selected.paymentMethod === 'MPESA' ? (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">M-Pesa Number</span>
                          <span className="font-mono font-bold text-green-700 text-sm">{selected.mpesaPhone || selected.phone}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-500">Bank</span>
                            <span className="font-medium text-sm">{selected.bankName || '–'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-500">Account No.</span>
                            <span className="font-mono font-bold text-blue-700 text-sm">{selected.bankAccount || '–'}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between pt-1 border-t border-gray-200">
                        <span className="text-xs text-gray-500">Price per Litre</span>
                        <span className="font-mono font-bold text-gray-800">KES {Number(selected.pricePerLitre).toFixed(2)}</span>
                      </div>
                    </div>

                    <button onClick={handleEdit}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                      <Edit2 size={14} /> Edit Farmer Details
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* COLLECTIONS TAB */}
            {panelTab === 'collections' && (
              <div className="p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Collections (Last 31 days)</h3>
                {collections.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No collection records found</div>
                ) : (
                  <div className="space-y-2">
                    {/* Mini calendar grid */}
                    <div className="bg-gray-50 rounded-xl p-3 mb-3">
                      <div className="text-xs text-gray-500 mb-2">Daily Litres</div>
                      <div className="grid grid-cols-7 gap-1">
                        {collections.slice(0,31).map((c: any, i: number) => {
                          const litres = Number(c.litres);
                          const intensity = Math.min(1, litres / 50);
                          return (
                            <div key={i} title={`${new Date(c.collectedAt).toLocaleDateString('en-KE')}: ${litres.toFixed(1)}L`}
                              className="aspect-square rounded flex items-center justify-center text-xs font-mono cursor-default"
                              style={{ background: litres > 0 ? `rgba(22,163,74,${0.2 + intensity*0.8})` : '#f3f4f6', color: litres > 0 ? 'white' : '#9ca3af', fontSize: '9px' }}>
                              {litres > 0 ? litres.toFixed(0) : '–'}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* List */}
                    <div className="space-y-1">
                      {collections.map((c: any) => (
                        <div key={c.id} className="flex justify-between items-center px-3 py-2 bg-white rounded-lg border border-gray-100 hover:border-green-200">
                          <div className="text-xs text-gray-500">{new Date(c.collectedAt).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                          <div className="font-mono font-bold text-green-700 text-sm">{Number(c.litres).toFixed(1)} L</div>
                          <div className="text-xs text-gray-400">KES {(Number(c.litres) * Number(selected.pricePerLitre)).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-green-50 rounded-lg p-3 flex justify-between">
                      <span className="text-sm text-green-700 font-medium">Total</span>
                      <span className="font-bold text-green-800">{collections.reduce((s: number, c: any) => s + Number(c.litres), 0).toFixed(1)} L</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAYMENTS TAB */}
            {panelTab === 'payments' && (
              <div className="p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment History</h3>
                {farmerPayments.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No payment records found</div>
                ) : (
                  <div className="space-y-2">
                    {farmerPayments.map((p: any) => (
                      <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 hover:border-green-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-sm">{MONTHS[p.periodMonth-1]} {p.periodYear}</div>
                            <div className="text-xs text-gray-400">{p.isMidMonth ? 'Mid Month' : 'End Month'}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'PAID' ? 'bg-green-100 text-green-700' : p.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-xs">
                          <div className="text-center bg-gray-50 rounded p-1.5">
                            <div className="text-gray-400">Gross</div>
                            <div className="font-mono font-medium">{Number(p.grossPay).toLocaleString()}</div>
                          </div>
                          <div className="text-center bg-red-50 rounded p-1.5">
                            <div className="text-red-400">Advances</div>
                            <div className="font-mono font-medium text-red-600">{Number(p.totalAdvances).toLocaleString()}</div>
                          </div>
                          <div className={`text-center rounded p-1.5 ${Number(p.netPay) < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                            <div className={Number(p.netPay) < 0 ? 'text-red-400' : 'text-green-400'}>Net Pay</div>
                            <div className={`font-mono font-bold ${Number(p.netPay) < 0 ? 'text-red-600' : 'text-green-700'}`}>{Number(p.netPay).toLocaleString()}</div>
                          </div>
                        </div>
                        {p.paidAt && <div className="text-xs text-gray-400 mt-2">Paid: {new Date(p.paidAt).toLocaleDateString('en-KE')}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
