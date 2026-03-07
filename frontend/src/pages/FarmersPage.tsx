// src/pages/FarmersPage.tsx
import { useState, useEffect, useRef } from 'react';
import { farmersApi, routesApi } from '../api/client';

// ── Types ──────────────────────────────────────────────────────
interface Route { id: number; name: string; code: string }
interface Farmer {
  id: number; code: string; name: string; idNumber: string | null;
  phone: string; routeId: number; pricePerLitre: number;
  paymentMethod: string; mpesaPhone: string | null;
  bankName: string | null; bankAccount: string | null;
  paidOn15th: boolean; isActive: boolean;
  route: { id: number; name: string; code: string };
  createdAt: string;
}

const BANKS = [
  'Equity Bank', 'KCB Bank', 'Co-operative Bank', 'Family Bank',
  'Fariji SACCO', 'K-Unity SACCO', 'TAI SACCO',
];
const PAYMENT_METHODS = ['MPESA', 'EQUITY', 'KCB', 'CO-OP', 'FAMILY', 'FARIJI', 'K-UNITY', 'TAI', 'CASH', 'DO NOT PAY'];

const EMPTY_FORM = {
  code: '', name: '', idNumber: '', phone: '', routeId: '',
  pricePerLitre: '46', paymentMethod: 'MPESA', mpesaPhone: '',
  bankName: '', bankAccount: '', paidOn15th: false,
};

function badge(method: string) {
  const map: Record<string, [string, string]> = {
    MPESA: ['#d1fae5', '#065f46'], EQUITY: ['#dbeafe', '#1e3a8a'],
    KCB: ['#dcfce7', '#14532d'], 'CO-OP': ['#ede9fe', '#4c1d95'],
    FAMILY: ['#fef3c7', '#78350f'], FARIJI: ['#fce7f3', '#831843'],
    'K-UNITY': ['#e0f2fe', '#0c4a6e'], TAI: ['#fef9c3', '#713f12'],
    CASH: ['#f3f4f6', '#374151'], 'DO NOT PAY': ['#fee2e2', '#991b1b'],
  };
  const [bg, color] = map[method] ?? ['#f3f4f6', '#374151'];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9, background: bg, color, whiteSpace: 'nowrap' as const }}>
      {method}
    </span>
  );
}

// ── Farmer Form Modal ──────────────────────────────────────────
function FarmerModal({ farmer, routes, onClose, onSaved }: {
  farmer: Farmer | null; routes: Route[];
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!farmer;
  const [form, setForm]   = useState<any>(farmer ? {
    code: farmer.code, name: farmer.name, idNumber: farmer.idNumber ?? '',
    phone: farmer.phone, routeId: String(farmer.routeId),
    pricePerLitre: String(farmer.pricePerLitre),
    paymentMethod: farmer.paymentMethod,
    mpesaPhone: farmer.mpesaPhone ?? '', bankName: farmer.bankName ?? '',
    bankAccount: farmer.bankAccount ?? '', paidOn15th: farmer.paidOn15th,
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.code.trim())          e.code         = 'Code is required';
    if (!form.name.trim())          e.name         = 'Name is required';
    if (!form.phone.trim())         e.phone        = 'Phone is required';
    if (!form.routeId)              e.routeId      = 'Route is required';
    if (!form.pricePerLitre)        e.pricePerLitre = 'Price is required';
    if (form.idNumber && !/^\d{6,8}$/.test(form.idNumber.trim()))
                                    e.idNumber     = 'ID should be 6–8 digits';
    if (form.phone && !/^(07|01|2547|2541)\d{8,}$/.test(form.phone.replace(/\s/g, '')))
                                    e.phone        = 'Enter a valid Kenyan phone number';
    const isMpesa = form.paymentMethod === 'MPESA';
    const isBank  = !isMpesa && form.paymentMethod !== 'CASH' && form.paymentMethod !== 'DO NOT PAY';
    if (isMpesa && form.mpesaPhone && !/^(07|01|2547|2541)\d{8,}$/.test(form.mpesaPhone.replace(/\s/g, '')))
                                    e.mpesaPhone   = 'Enter a valid M-Pesa number';
    if (isBank && !form.bankAccount.trim()) e.bankAccount = 'Bank account is required for bank payment';
    return e;
  }

  async function save() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        routeId:       Number(form.routeId),
        pricePerLitre: Number(form.pricePerLitre),
        idNumber:      form.idNumber.trim() || null,
        mpesaPhone:    form.mpesaPhone.trim() || null,
        bankName:      form.bankName.trim() || null,
        bankAccount:   form.bankAccount.trim() || null,
      };
      if (isEdit) await farmersApi.update(farmer!.id, payload);
      else        await farmersApi.create(payload);
      onSaved();
    } catch (err: any) {
      setErrors({ general: err.response?.data?.error ?? 'Failed to save. Check all fields.' });
    } finally { setSaving(false); }
  }

  const isMpesa = form.paymentMethod === 'MPESA';
  const isBank  = !isMpesa && form.paymentMethod !== 'CASH' && form.paymentMethod !== 'DO NOT PAY';

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={M.header}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {isEdit ? '✏️ Edit Farmer' : '🌾 Onboard New Farmer'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {isEdit ? `Updating ${farmer!.name}` : 'Add a new farmer to the system'}
            </div>
          </div>
          <button style={M.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={M.body}>
          {errors.general && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
              {errors.general}
            </div>
          )}

          {/* Section: Basic Info */}
          <div style={M.section}>
            <div style={M.sectionTitle}>👤 Basic Information</div>
            <div style={M.grid2}>
              <Field label="Full Name *" error={errors.name}>
                <input style={inp(!!errors.name)} value={form.name}
                  onChange={e => set('name', e.target.value.toUpperCase())}
                  placeholder="e.g. JOHN KAMAU NJOROGE" autoFocus />
              </Field>
              <Field label="Farmer Code *" error={errors.code}>
                <input style={inp(!!errors.code)} value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. KARI1234" disabled={isEdit} />
                {isEdit && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Code cannot be changed after creation</div>}
              </Field>
              <Field label="National ID Number" error={errors.idNumber}>
                <input style={inp(!!errors.idNumber)} value={form.idNumber}
                  onChange={e => set('idNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 12345678" maxLength={8} />
              </Field>
              <Field label="Phone Number *" error={errors.phone}>
                <input style={inp(!!errors.phone)} value={form.phone}
                  onChange={e => set('phone', e.target.value.replace(/\s/g, ''))}
                  placeholder="e.g. 0712345678" />
              </Field>
            </div>
          </div>

          {/* Section: Route & Pricing */}
          <div style={M.section}>
            <div style={M.sectionTitle}>🚛 Route & Pricing</div>
            <div style={M.grid2}>
              <Field label="Route *" error={errors.routeId}>
                <select style={inp(!!errors.routeId)} value={form.routeId}
                  onChange={e => set('routeId', e.target.value)}>
                  <option value="">— Select Route —</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Price per Litre (KES) *" error={errors.pricePerLitre}>
                <input style={inp(!!errors.pricePerLitre)} type="number" step="0.5" min="30" max="80"
                  value={form.pricePerLitre} onChange={e => set('pricePerLitre', e.target.value)}
                  placeholder="e.g. 46" />
              </Field>
              <Field label="Paid on 15th?">
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {[true, false].map(v => (
                    <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" checked={form.paidOn15th === v}
                        onChange={() => set('paidOn15th', v)} />
                      {v ? 'Yes (mid-month)' : 'No (end-month only)'}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* Section: Payment */}
          <div style={M.section}>
            <div style={M.sectionTitle}>💰 Payment Method</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PAYMENT_METHODS.map(pm => (
                <button key={pm}
                  onClick={() => set('paymentMethod', pm)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: form.paymentMethod === pm ? '2px solid #1e3a5f' : '1.5px solid #e5e7eb',
                    background: form.paymentMethod === pm ? '#1e3a5f' : '#f9fafb',
                    color: form.paymentMethod === pm ? '#fff' : '#374151',
                  }}>
                  {pm}
                </button>
              ))}
            </div>

            {/* M-Pesa number */}
            {isMpesa && (
              <Field label="M-Pesa Phone (if different from main phone)" error={errors.mpesaPhone}>
                <input style={inp(!!errors.mpesaPhone)} value={form.mpesaPhone}
                  onChange={e => set('mpesaPhone', e.target.value.replace(/\s/g, ''))}
                  placeholder="Leave blank to use main phone" />
              </Field>
            )}

            {/* Bank details */}
            {isBank && (
              <div style={M.grid2}>
                <Field label="Bank / SACCO">
                  <select style={inp(false)} value={form.bankName}
                    onChange={e => set('bankName', e.target.value)}>
                    <option value="">— Select Bank —</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Account Number *" error={errors.bankAccount}>
                  <input style={inp(!!errors.bankAccount)} value={form.bankAccount}
                    onChange={e => set('bankAccount', e.target.value.trim())}
                    placeholder="e.g. 1110123456789" />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={M.footer}>
          <button style={M.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...M.saveBtn, opacity: saving ? 0.6 : 1 }}
            onClick={save} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? '✓ Update Farmer' : '✓ Add Farmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate Confirm ─────────────────────────────────────────
function DeactivateModal({ farmer, onClose, onDone }: {
  farmer: Farmer; onClose: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  async function confirm() {
    setLoading(true);
    try { await farmersApi.deactivate(farmer.id); onDone(); }
    catch { alert('Failed'); setLoading(false); }
  }
  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={{ ...M.modal, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={M.header}>
          <div style={{ fontWeight: 800 }}>Deactivate Farmer</div>
          <button style={M.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 14, marginBottom: 16, lineHeight: 1.7 }}>
            Are you sure you want to deactivate <strong>{farmer.name}</strong>?
            <br /><br />
            <span style={{ color: '#6b7280', fontSize: 13 }}>
              The farmer's historical data (collections, payments) will be kept.
              They will be hidden from active lists and will not receive payments.
              You can reactivate them at any time.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={M.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{ ...M.saveBtn, background: '#dc2626', opacity: loading ? 0.6 : 1 }}
              onClick={confirm} disabled={loading}>
              {loading ? 'Deactivating...' : 'Yes, Deactivate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Import result modal ────────────────────────────────────────
function ImportResultModal({ result, onClose }: { result: any; onClose: () => void }) {
  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={{ ...M.modal, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={M.header}>
          <div style={{ fontWeight: 800 }}>📥 Import Complete</div>
          <button style={M.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { l: 'Created', v: result.created ?? 0, c: '#16a34a' },
              { l: 'Updated', v: result.updated ?? 0, c: '#2563eb' },
              { l: 'Skipped', v: result.skipped ?? 0, c: '#d97706' },
              { l: 'Errors',  v: result.errors?.length ?? 0, c: '#dc2626' },
            ].map(s => (
              <div key={s.l} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{s.l}</div>
              </div>
            ))}
          </div>
          {result.errors?.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, maxHeight: 150, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Issues:</div>
              {result.errors.map((e: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 3 }}>• {e}</div>
              ))}
            </div>
          )}
          <button style={{ ...M.saveBtn, width: '100%', marginTop: 16, justifyContent: 'center', display: 'block' }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{error}</div>}
    </div>
  );
}
function inp(hasErr: boolean): React.CSSProperties {
  return { width: '100%', border: `1.5px solid ${hasErr ? '#f87171' : '#e5e7eb'}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none', background: '#fff' };
}

// ══ MAIN PAGE ══════════════════════════════════════════════════
export default function FarmersPage() {
  const [farmers, setFarmers]       = useState<Farmer[]>([]);
  const [total, setTotal]           = useState(0);
  const [routes, setRoutes]         = useState<Route[]>([]);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [routeFilter, setRouteFilter] = useState<number | ''>('');
  const [showInactive, setShowInactive] = useState(false);

  const [modal, setModal]           = useState<'add' | 'edit' | null>(null);
  const [editFarmer, setEditFarmer] = useState<Farmer | null>(null);
  const [deactFarmer, setDeactFarmer] = useState<Farmer | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const importRef = useRef<HTMLInputElement>(null);
  const LIMIT = 50;

  useEffect(() => {
    routesApi.list().then(r => setRoutes(r.data ?? [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await farmersApi.list({
        search: search || undefined,
        routeId: routeFilter || undefined,
        page, limit: LIMIT,
        isActive: showInactive ? undefined : true,
      });
      setFarmers(r.data?.data ?? []);
      setTotal(r.data?.total ?? 0);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [search, routeFilter, page, showInactive]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    try {
      const r = await farmersApi.importExcel(file);
      setImportResult(r.data);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Import failed. Check the file format.');
    }
  }

  async function handleExport() {
    try {
      const r = await farmersApi.exportExcel();
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `farmers_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch { alert('Export failed'); }
  }

  function openEdit(f: Farmer) { setEditFarmer(f); setModal('edit'); }
  function onSaved() { setModal(null); setEditFarmer(null); load(); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={P.page}>
      {/* Header */}
      <div style={P.header}>
        <div>
          <h1 style={P.title}>Farmers</h1>
          <p style={P.subtitle}>{total.toLocaleString()} farmers registered across {routes.length} routes</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Import */}
          <button style={P.outlineBtn} onClick={() => importRef.current?.click()}>
            📥 Import Excel
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />

          {/* Export */}
          <button style={P.outlineBtn} onClick={handleExport}>
            📤 Export
          </button>

          {/* Add */}
          <button style={P.addBtn} onClick={() => setModal('add')}>
            + Onboard Farmer
          </button>
        </div>
      </div>

      {/* Import note */}
      <div style={P.importNote}>
        <strong>📋 Deploying with new data?</strong> Export the current list, update it in Excel (add new farmers, change details, mark leavers), then re-import. The system will create new farmers and update existing ones by code. Farmers not in the sheet are NOT automatically deactivated — deactivate leavers manually to preserve their history.
      </div>

      {/* Filters */}
      <div style={P.filterBar}>
        <input style={P.searchInput} value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Search by name or code..." />
        <select style={P.sel} value={routeFilter}
          onChange={e => { setRouteFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
          <option value="">All Routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          {total.toLocaleString()} farmers
        </div>
      </div>

      {/* Table */}
      <div style={P.tableCard}>
        <table style={P.table}>
          <thead>
            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
              <th style={P.th}>#</th>
              <th style={P.th}>Code</th>
              <th style={P.th}>Full Name</th>
              <th style={P.th}>National ID</th>
              <th style={P.th}>Phone</th>
              <th style={P.th}>Route</th>
              <th style={P.th}>Price/L</th>
              <th style={P.th}>Payment</th>
              <th style={P.th}>Bank / Account</th>
              <th style={P.th}>Status</th>
              <th style={P.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </td></tr>
            ) : farmers.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 36 }}>🌾</div>
                <p style={{ fontWeight: 600 }}>No farmers found</p>
                <p style={{ fontSize: 13 }}>{search ? `No results for "${search}"` : 'Click "Onboard Farmer" to add the first one'}</p>
              </td></tr>
            ) : farmers.map((f, idx) => (
              <tr key={f.id} style={{ background: idx % 2 === 1 ? '#f9fafb' : '#fff', borderBottom: '1px solid #f3f4f6', opacity: f.isActive ? 1 : 0.5 }}>
                <td style={{ ...P.td, color: '#9ca3af', fontSize: 11 }}>{(page - 1) * LIMIT + idx + 1}</td>
                <td style={{ ...P.td, fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{f.code}</td>
                <td style={{ ...P.td, fontWeight: 700, maxWidth: 180 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                </td>
                <td style={{ ...P.td, fontFamily: 'monospace', fontSize: 12 }}>{f.idNumber ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                <td style={{ ...P.td, fontSize: 12 }}>{f.phone}</td>
                <td style={{ ...P.td, fontSize: 12 }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                    {f.route?.name}
                  </span>
                </td>
                <td style={{ ...P.td, fontWeight: 700, color: '#16a34a', fontSize: 12 }}>KES {Number(f.pricePerLitre).toFixed(2)}</td>
                <td style={P.td}>{badge(f.paymentMethod)}</td>
                <td style={{ ...P.td, fontSize: 11, maxWidth: 160 }}>
                  {f.bankName && f.bankAccount
                    ? <div><div style={{ fontWeight: 600 }}>{f.bankName}</div><div style={{ color: '#6b7280', fontFamily: 'monospace' }}>{f.bankAccount}</div></div>
                    : f.mpesaPhone
                      ? <span style={{ color: '#6b7280' }}>{f.mpesaPhone}</span>
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
                <td style={P.td}>
                  {f.isActive
                    ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Active</span>
                    : <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Inactive</span>}
                </td>
                <td style={{ ...P.td, whiteSpace: 'nowrap' }}>
                  <button style={P.editBtn} onClick={() => openEdit(f)}>Edit</button>
                  {f.isActive
                    ? <button style={P.deactBtn} onClick={() => setDeactFarmer(f)}>Deactivate</button>
                    : <button style={P.reactBtn} onClick={async () => { await farmersApi.update(f.id, { isActive: true }); load(); }}>Reactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button style={P.pgBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <span style={{ fontSize: 13, color: '#374151' }}>Page {page} of {totalPages}</span>
          <button style={P.pgBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
        </div>
      )}

      {/* Modals */}
      {(modal === 'add' || modal === 'edit') && (
        <FarmerModal
          farmer={modal === 'edit' ? editFarmer : null}
          routes={routes}
          onClose={() => { setModal(null); setEditFarmer(null); }}
          onSaved={onSaved}
        />
      )}
      {deactFarmer && (
        <DeactivateModal
          farmer={deactFarmer}
          onClose={() => setDeactFarmer(null)}
          onDone={() => { setDeactFarmer(null); load(); }}
        />
      )}
      {importResult && (
        <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const P: Record<string, React.CSSProperties> = {
  page:        { padding: 20 },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  title:       { fontSize: 22, fontWeight: 800, color: '#111', margin: 0 },
  subtitle:    { fontSize: 13, color: '#6b7280', marginTop: 3 },
  importNote:  { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#78350f', marginBottom: 14, lineHeight: 1.7 },
  filterBar:   { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' },
  searchInput: { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, flex: 1, minWidth: 220 },
  sel:         { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, minWidth: 160 },
  tableCard:   { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  td:          { padding: '10px 12px', verticalAlign: 'top' },
  outlineBtn:  { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' },
  addBtn:      { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  editBtn:     { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 4 },
  deactBtn:    { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  reactBtn:    { background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  pgBtn:       { background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
};

const M: Record<string, React.CSSProperties> = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:     { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  body:      { overflowY: 'auto', padding: '20px 24px', flex: 1 },
  footer:    { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  section:   { marginBottom: 22 },
  sectionTitle: { fontSize: 12, fontWeight: 800, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' },
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  closeBtn:  { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: 4 },
  cancelBtn: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  saveBtn:   { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
};
