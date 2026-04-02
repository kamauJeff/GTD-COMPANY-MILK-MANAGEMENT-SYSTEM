import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { showSuccess, showError } from '../components/Toast';
import { Plus, RefreshCw, Building2, Users, TrendingUp, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const PLANS   = ['TRIAL','SMALL','MEDIUM','LARGE'];
const STATUSES = ['TRIAL','ACTIVE','SUSPENDED','CANCELLED'];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  TRIAL:     'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400',
  SUSPENDED: 'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
  CANCELLED: 'bg-gray-100  text-gray-500  dark:bg-gray-800     dark:text-gray-400',
};

export default function SuperAdminPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({
    name:'', slug:'', phone:'', email:'', location:'', plan:'TRIAL', monthlyFee:'0',
    adminName:'', adminCode:'', adminPhone:'', adminPassword:'',
  });

  const { data: statsData } = useQuery({
    queryKey: ['super-stats'],
    queryFn: () => api.get('/api/super/stats'),
    staleTime: 0, refetchInterval: 60000,
  });
  const stats = statsData?.data;

  const { data: dairiesData, isLoading, refetch } = useQuery({
    queryKey: ['super-dairies'],
    queryFn: () => api.get('/api/super/dairies'),
    staleTime: 0,
  });
  const dairies: any[] = dairiesData?.data ?? [];

  const createMut = useMutation({
    mutationFn: () => api.post('/api/super/dairies', form),
    onSuccess: (r) => {
      showSuccess(`✅ ${r.data.message}`);
      setShowCreate(false);
      setForm({ name:'',slug:'',phone:'',email:'',location:'',plan:'TRIAL',monthlyFee:'0',
                adminName:'',adminCode:'',adminPhone:'',adminPassword:'' });
      qc.invalidateQueries({ queryKey: ['super-dairies'] });
      qc.invalidateQueries({ queryKey: ['super-stats'] });
    },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/api/super/dairies/${id}`, data),
    onSuccess: () => { showSuccess('Updated'); qc.invalidateQueries({ queryKey: ['super-dairies'] }); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const suspendMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/super/dairies/${id}`),
    onSuccess: () => { showSuccess('Dairy suspended'); qc.invalidateQueries({ queryKey: ['super-dairies'] }); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Platform Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage all dairy clients on the platform</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-green-600 hover:border-green-300 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
            <Plus size={15} /> Add New Dairy
          </button>
        </div>
      </div>

      {/* Platform stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Dairies',    value: stats.totalDairies,    color: 'text-gray-800 dark:text-gray-100' },
            { label: 'Active Clients',   value: stats.activeDairies,   color: 'text-green-700 dark:text-green-400' },
            { label: 'Total Farmers',    value: stats.totalFarmers?.toLocaleString(), color: 'text-blue-700 dark:text-blue-400' },
            { label: 'Monthly Revenue',  value: `KES ${Number(stats.monthlyRevenue).toLocaleString()}`, color: 'text-purple-700 dark:text-purple-400' },
            { label: 'Annual Revenue',   value: `KES ${Number(stats.annualRevenue).toLocaleString()}`,  color: 'text-orange-700 dark:text-orange-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-xs text-gray-400 mb-1">{s.label}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create dairy modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-green-700 px-6 py-4 text-white flex items-center justify-between">
              <h2 className="font-bold text-lg">Add New Dairy Client</h2>
              <button onClick={() => setShowCreate(false)} className="text-green-200 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dairy Details</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Dairy Name *</label>
                  <input value={form.name}
                    onChange={e => setForm(f => ({...f, name: e.target.value, slug: autoSlug(e.target.value)}))}
                    placeholder="e.g. Kamuthe Dairies" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Slug (URL ID) *</label>
                  <input value={form.slug} onChange={e => setForm(f => ({...f, slug: e.target.value}))}
                    placeholder="kamuthe-dairies" className="w-full px-3 py-2.5 border rounded-xl text-sm font-mono dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    placeholder="254XXXXXXXXX" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))}
                    placeholder="e.g. Kiambu County" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Plan</label>
                  <select value={form.plan} onChange={e => setForm(f => ({...f, plan: e.target.value}))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {PLANS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Monthly Fee (KES)</label>
                  <input type="number" value={form.monthlyFee} onChange={e => setForm(f => ({...f, monthlyFee: e.target.value}))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm font-mono dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>

              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-2">Admin Account</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Admin Name *</label>
                  <input value={form.adminName} onChange={e => setForm(f => ({...f, adminName: e.target.value}))}
                    placeholder="Director name" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Admin Code *</label>
                  <input value={form.adminCode} onChange={e => setForm(f => ({...f, adminCode: e.target.value.toUpperCase()}))}
                    placeholder="ADMIN001" className="w-full px-3 py-2.5 border rounded-xl text-sm font-mono dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Admin Phone</label>
                  <input value={form.adminPhone} onChange={e => setForm(f => ({...f, adminPhone: e.target.value}))}
                    placeholder="254XXXXXXXXX" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Password *</label>
                  <input type="password" value={form.adminPassword} onChange={e => setForm(f => ({...f, adminPassword: e.target.value}))}
                    placeholder="••••••••" className="w-full px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => createMut.mutate()} disabled={createMut.isPending}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 text-sm">
                  {createMut.isPending ? 'Creating...' : '✅ Create Dairy'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dairies table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">All Dairy Clients</h2>
          <span className="text-xs text-gray-400">{dairies.length} dairies</span>
        </div>
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading dairies...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <tr>{['Dairy','Slug','Plan','Status','Farmers','Monthly Fee','Trial Ends','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {dairies.map((d: any) => (
                  <tr key={d.id} className="border-b dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 dark:text-gray-100">{d.name}</div>
                      <div className="text-xs text-gray-400">{d.location || '—'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.slug}</td>
                    <td className="px-4 py-3">
                      <select value={d.plan}
                        onChange={e => updateMut.mutate({ id: d.id, data: { plan: e.target.value } })}
                        className="text-xs px-2 py-1 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                        {PLANS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[d.status] || STATUS_BADGE.CANCELLED}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{d._count?.farmers?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 font-mono text-sm text-green-700 dark:text-green-400">
                      KES {Number(d.monthlyFee).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {d.trialEndsAt ? new Date(d.trialEndsAt).toLocaleDateString('en-KE') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {d.status !== 'ACTIVE' && (
                          <button onClick={() => updateMut.mutate({ id: d.id, data: { status: 'ACTIVE' } })}
                            className="text-xs px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                            Activate
                          </button>
                        )}
                        {d.status !== 'SUSPENDED' && (
                          <button onClick={() => { if(confirm(`Suspend ${d.name}?`)) suspendMut.mutate(d.id); }}
                            className="text-xs px-2.5 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-medium">
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
