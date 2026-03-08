// src/pages/StaffPage.tsx
// Staff registration — capture identity details only, NO salary at this stage.
// Salary is set later during payroll processing.
import { useState, useEffect, useCallback } from 'react';
import { payrollApi } from '../api/client';

const ROLES = ['GRADER','SHOPKEEPER','DRIVER','FACTORY','OFFICE','ADMIN'];
const BANKS = ['K-Unity SACCO','Equity Bank','KCB Bank','Co-operative Bank','Family Bank','Fariji SACCO','TAI SACCO','MPESA'];

interface Employee {
  id: number; code: string; name: string; role: string; phone: string;
  salary: number | null; bankName: string | null; bankAccount: string | null;
  paymentMethod: string; isActive: boolean; createdAt: string;
}

// ── Register / Edit Modal ──────────────────────────────────────
function StaffModal({ employee, onClose, onSaved }: {
  employee: Employee | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    name:          employee?.name ?? '',
    role:          employee?.role ?? 'GRADER',
    phone:         employee?.phone ?? '',
    paymentMethod: employee?.paymentMethod ?? 'K-UNITY',
    bankName:      employee?.bankName ?? 'K-Unity SACCO',
    bankAccount:   employee?.bankAccount ?? '',
    password:      '',           // only for new staff
    confirmPass:   '',
  });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    setErr('');
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (!isEdit && form.password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (!isEdit && form.password !== form.confirmPass) { setErr('Passwords do not match'); return; }

    setSaving(true);
    try {
      const payload: any = {
        name:          form.name.toUpperCase().trim(),
        role:          form.role,
        phone:         form.phone.trim(),
        paymentMethod: form.paymentMethod,
        bankName:      form.bankName || null,
        bankAccount:   form.bankAccount.trim() || null,
      };
      if (!isEdit && form.password) payload.password = form.password;

      if (isEdit) await payrollApi.updateEmployee(employee!.id, payload);
      else        await payrollApi.createEmployee(payload);
      onSaved();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed to save'); }
    finally { setSaving(false); }
  }

  const isMpesa = form.paymentMethod === 'MPESA';

  return (
    <div style={DM.overlay} onClick={onClose}>
      <div style={DM.modal} onClick={e => e.stopPropagation()}>
        <div style={DM.header}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{isEdit ? '✏️ Edit Staff' : '👤 Register New Staff'}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {isEdit ? 'Update staff details' : 'Salary is set separately during payroll'}
            </div>
          </div>
          <button style={DM.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>{err}</div>}

          {/* Identity */}
          <div style={DM.section}>IDENTITY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={DM.label}>Full Name *</label>
              <input style={DM.input} value={form.name}
                onChange={e => set('name', e.target.value.toUpperCase())}
                placeholder="JOHN KAMAU MWANGI" autoFocus />
            </div>
            <div>
              <label style={DM.label}>Role *</label>
              <select style={DM.input} value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={DM.label}>Phone *</label>
              <input style={DM.input} value={form.phone}
                onChange={e => set('phone', e.target.value)} placeholder="0712345678" />
            </div>
          </div>

          {/* Payment */}
          <div style={DM.section}>PAYMENT METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={DM.label}>Method</label>
              <select style={DM.input} value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                {['MPESA','K-UNITY','EQUITY','KCB','CO-OP','FAMILY','FARIJI','TAI'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={DM.label}>Bank / SACCO</label>
              <input style={DM.input} value={form.bankName}
                onChange={e => set('bankName', e.target.value)}
                placeholder="K-Unity SACCO" disabled={isMpesa} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={DM.label}>{isMpesa ? 'M-Pesa Phone' : 'Account Number'}</label>
              <input style={DM.input} value={form.bankAccount}
                onChange={e => set('bankAccount', e.target.value)}
                placeholder={isMpesa ? '0712345678' : 'e.g. 0071-22351'} />
            </div>
          </div>

          {/* Login credentials — new staff only */}
          {!isEdit && (
            <>
              <div style={DM.section}>APP LOGIN CREDENTIALS</div>
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                ⚠️ The employee code (auto-generated) will be their username. Set a temporary password — they can change it after first login.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={DM.label}>Temporary Password</label>
                  <input style={DM.input} type="password" value={form.password}
                    onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div>
                  <label style={DM.label}>Confirm Password</label>
                  <input style={DM.input} type="password" value={form.confirmPass}
                    onChange={e => set('confirmPass', e.target.value)} placeholder="Repeat password" />
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={DM.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...DM.saveBtn, opacity: saving ? 0.5 : 1 }} onClick={save} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? '✓ Update Staff' : '✓ Register Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate Confirm ─────────────────────────────────────────
function ConfirmModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void; }) {
  return (
    <div style={DM.overlay} onClick={onClose}>
      <div style={{ ...DM.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 28, textAlign: 'center' as const }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Remove Staff Member?</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            <strong>{name}</strong> will be deactivated. Their history is preserved. They will lose app access.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button style={DM.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{ ...DM.saveBtn, background: '#dc2626' }} onClick={onConfirm}>Yes, Remove</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DM: Record<string, React.CSSProperties> = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:     { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' },
  closeBtn:  { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' },
  section:   { fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', paddingBottom: 4, borderBottom: '1px solid #f3f4f6' },
  label:     { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 5 },
  input:     { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 11px', fontSize: 13, boxSizing: 'border-box' as const, background: '#fff' },
  saveBtn:   { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
};

// ══ MAIN PAGE ══════════════════════════════════════════════════
export default function StaffPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal]         = useState<Employee | null | 'new'>(null);
  const [confirmDel, setConfirmDel] = useState<Employee | null>(null);
  const [removing, setRemoving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await payrollApi.getEmployees({ role: roleFilter || undefined, includeInactive: true });
      setEmployees(r.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleRemove(emp: Employee) {
    setRemoving(true);
    try {
      await payrollApi.deactivateEmployee(emp.id);
      setConfirmDel(null);
      await load();
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed'); }
    finally { setRemoving(false); }
  }

  async function handleReactivate(emp: Employee) {
    try {
      await payrollApi.updateEmployee(emp.id, { isActive: true });
      await load();
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed'); }
  }

  const roleCount = (role: string) => employees.filter(e => e.role === role && e.isActive).length;

  const displayed = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchRole   = !roleFilter || e.role === roleFilter;
    return matchSearch && matchRole;
  });

  const ROLE_COLORS: Record<string, [string, string]> = {
    GRADER:     ['#eff6ff','#1d4ed8'],
    SHOPKEEPER: ['#f0fdf4','#166534'],
    DRIVER:     ['#fff7ed','#c2410c'],
    FACTORY:    ['#faf5ff','#7e22ce'],
    OFFICE:     ['#f0f9ff','#0369a1'],
    ADMIN:      ['#fef2f2','#dc2626'],
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Staff Register</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>Register staff · Set salary during payroll</p>
        </div>
        <button style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => setModal('new')}>
          + Register Staff
        </button>
      </div>

      {/* Role summary cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {ROLES.map(role => {
          const [bg, color] = ROLE_COLORS[role] ?? ['#f3f4f6','#374151'];
          const cnt = roleCount(role);
          if (cnt === 0) return null;
          return (
            <button key={role}
              onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
              style={{ background: roleFilter === role ? color : bg, color: roleFilter === role ? '#fff' : color,
                border: `1.5px solid ${color}`, borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
                fontWeight: 700, fontSize: 13, transition: 'all 0.15s' }}>
              {role} <span style={{ fontSize: 11, opacity: 0.8 }}>({cnt})</span>
            </button>
          );
        })}
        {roleFilter && (
          <button onClick={() => setRoleFilter('')}
            style={{ background: '#f3f4f6', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input style={{ width: '100%', maxWidth: 380, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontSize: 13, boxSizing: 'border-box' as const }}
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search name or code..." />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center' as const, padding: 60, color: '#9ca3af' }}>Loading...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                {['#','Code','Full Name','Role','Phone','Payment Method','Account No.','Salary','Status','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((emp, idx) => {
                const [bg, color] = ROLE_COLORS[emp.role] ?? ['#f3f4f6','#374151'];
                return (
                  <tr key={emp.id} style={{ background: !emp.isActive ? '#fafafa' : idx % 2 === 1 ? '#f9fafb' : '#fff', borderBottom: '1px solid #f3f4f6', opacity: emp.isActive ? 1 : 0.55 }}>
                    <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 11 }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{emp.code}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{emp.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: bg, color }}>{emp.role}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{emp.phone}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600 }}>{emp.paymentMethod}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{emp.bankAccount ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: emp.salary ? '#166534' : '#9ca3af', fontWeight: 700 }}>
                      {emp.salary ? `KES ${Number(emp.salary).toLocaleString()}` : <span style={{ fontSize: 11, fontStyle: 'italic' }}>Not set</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                        background: emp.isActive ? '#dcfce7' : '#f3f4f6',
                        color: emp.isActive ? '#166534' : '#9ca3af' }}>
                        {emp.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' as const }}>
                      <button style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1d4ed8', cursor: 'pointer', marginRight: 6 }}
                        onClick={() => setModal(emp)}>Edit</button>
                      {emp.isActive ? (
                        <button style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}
                          onClick={() => setConfirmDel(emp)}>Remove</button>
                      ) : (
                        <button style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#16a34a', cursor: 'pointer' }}
                          onClick={() => handleReactivate(emp)}>Reactivate</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayed.length === 0 && !loading && (
            <div style={{ textAlign: 'center' as const, padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 40 }}>👥</div>
              <p style={{ fontWeight: 600 }}>No staff found</p>
              <p style={{ fontSize: 13 }}>Click "Register Staff" to add someone</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <StaffModal
          employee={modal === 'new' ? null : modal as Employee}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          name={confirmDel.name}
          onClose={() => setConfirmDel(null)}
          onConfirm={() => !removing && handleRemove(confirmDel)}
        />
      )}
    </div>
  );
}
