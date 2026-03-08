// src/pages/PayrollPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { payrollApi } from '../api/client';

const MONTHS = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const NOW = new Date();

const fmt = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Types ──────────────────────────────────────────────────────
interface Employee {
  id: number; code: string; name: string; role: string; phone: string;
  salary: number; bankAccount: string; bankName: string; paymentMethod: string; isActive: boolean;
}
interface PayrollEntry {
  id: number; employeeId: number; periodMonth: number; periodYear: number;
  baseSalary: number; varianceDeductions: number; otherDeductions: number;
  netPay: number; status: string;
  employee: Employee;
}
interface Totals {
  count: number; baseSalary: number; deductions: number; netPay: number;
  pending: number; approved: number; paid: number;
}

// ── Deduction Modal ────────────────────────────────────────────
function DeductionModal({ employee, month, year, onClose, onSaved }: {
  employee: Employee; month: number; year: number;
  onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function save() {
    if (!amount || !reason) return;
    setSaving(true); setErr('');
    try {
      await payrollApi.addDeduction({ employeeId: employee.id, month, year, amount: Number(amount), reason });
      onSaved();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div style={DM.overlay} onClick={onClose}>
      <div style={DM.modal} onClick={e => e.stopPropagation()}>
        <div style={DM.header}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Add Deduction</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{employee.name} · {MONTHS[month]} {year}</div>
          </div>
          <button style={DM.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <div>
            <label style={DM.label}>Amount (KES)</label>
            <input style={DM.input} type="number" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <label style={DM.label}>Reason</label>
            <input style={DM.input} value={reason}
              onChange={e => setReason(e.target.value)} placeholder="e.g. Advance, Late penalty..." />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={DM.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{ ...DM.saveBtn, opacity: (!amount || !reason || saving) ? 0.5 : 1 }}
              onClick={save} disabled={!amount || !reason || saving}>
              {saving ? 'Saving...' : 'Add Deduction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Set Salary Modal ───────────────────────────────────────────
function SalaryModal({ employee, onClose, onSaved }: {
  employee: Employee; onClose: () => void; onSaved: () => void;
}) {
  const [salary, setSalaryVal] = useState(String(employee.salary ?? ''));
  const [saving, setSaving]    = useState(false);
  const [err, setErr]          = useState('');

  async function save() {
    if (!salary || Number(salary) <= 0) { setErr('Enter a valid salary amount'); return; }
    setSaving(true); setErr('');
    try {
      await payrollApi.setSalary({ employeeId: employee.id, salary: Number(salary) });
      onSaved();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div style={DM.overlay} onClick={onClose}>
      <div style={{ ...DM.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={DM.header}>
          <div>
            <div style={{ fontWeight: 800 }}>💰 Set Salary</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{employee.name}</div>
          </div>
          <button style={DM.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <div>
            <label style={DM.label}>Monthly Salary (KES)</label>
            <input style={DM.input} type="number" value={salary}
              onChange={e => setSalaryVal(e.target.value)} placeholder="15000" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={DM.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{ ...DM.saveBtn, opacity: saving ? 0.5 : 1 }} onClick={save} disabled={saving}>
              {saving ? 'Saving...' : '✓ Set Salary'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Employee Modal (add/edit) ──────────────────────────────────
function EmployeeModal({ employee, onClose, onSaved }: {
  employee: Employee | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!employee;
  const [form, setForm]   = useState({
    name:          employee?.name ?? '',
    role:          employee?.role ?? 'GRADER',
    phone:         employee?.phone ?? '',
    salary:        String(employee?.salary ?? ''),
    bankAccount:   employee?.bankAccount ?? '',
    bankName:      employee?.bankName ?? 'K-Unity SACCO',
    paymentMethod: employee?.paymentMethod ?? 'K-UNITY',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name || !form.salary) { setErr('Name and salary are required'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { ...form, salary: Number(form.salary), name: form.name.toUpperCase().trim() };
      if (isEdit) await payrollApi.updateEmployee(employee!.id, payload);
      else        await payrollApi.createEmployee(payload);
      onSaved();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div style={DM.overlay} onClick={onClose}>
      <div style={{ ...DM.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={DM.header}>
          <div style={{ fontWeight: 800 }}>{isEdit ? '✏️ Edit Employee' : '➕ Add Employee'}</div>
          <button style={DM.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={DM.label}>Full Name *</label>
              <input style={DM.input} value={form.name}
                onChange={e => set('name', e.target.value.toUpperCase())} placeholder="JOHN KAMAU" autoFocus />
            </div>
            <div>
              <label style={DM.label}>Role</label>
              <select style={DM.input} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="GRADER">Grader</option>
                <option value="SHOPKEEPER">Shopkeeper</option>
                <option value="DRIVER">Driver</option>
                <option value="FACTORY">Factory</option>
                <option value="OFFICE">Office</option>
              </select>
            </div>
            <div>
              <label style={DM.label}>Monthly Salary (KES) *</label>
              <input style={DM.input} type="number" value={form.salary}
                onChange={e => set('salary', e.target.value)} placeholder="15000" />
            </div>
            <div>
              <label style={DM.label}>Phone</label>
              <input style={DM.input} value={form.phone}
                onChange={e => set('phone', e.target.value)} placeholder="0712345678" />
            </div>
            <div>
              <label style={DM.label}>Bank / SACCO</label>
              <input style={DM.input} value={form.bankName}
                onChange={e => set('bankName', e.target.value)} placeholder="K-Unity SACCO" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={DM.label}>Account Number</label>
              <input style={DM.input} value={form.bankAccount}
                onChange={e => set('bankAccount', e.target.value)} placeholder="e.g. 0071-22351" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={DM.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{ ...DM.saveBtn, opacity: saving ? 0.5 : 1 }}
              onClick={save} disabled={saving}>
              {saving ? 'Saving...' : isEdit ? '✓ Update' : '✓ Add Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DM: Record<string, React.CSSProperties> = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:     { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' },
  closeBtn:  { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' },
  label:     { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 5 },
  input:     { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 11px', fontSize: 13, boxSizing: 'border-box' as const },
  saveBtn:   { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
};

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PENDING:  ['#f3f4f6', '#6b7280'],
    APPROVED: ['#dbeafe', '#1d4ed8'],
    PAID:     ['#dcfce7', '#166534'],
  };
  const [bg, color] = map[status] ?? ['#f3f4f6', '#6b7280'];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: bg, color }}>
      {status}
    </span>
  );
}

// ══ MAIN PAGE ══════════════════════════════════════════════════
export default function PayrollPage() {
  const [month, setMonth]   = useState(NOW.getMonth() + 1);
  const [year, setYear]     = useState(NOW.getFullYear());
  const [tab, setTab]       = useState<'graders' | 'shopkeepers' | 'staff'>('graders');

  const [payrolls, setPayrolls]   = useState<PayrollEntry[]>([]);
  const [totals, setTotals]       = useState<Totals | null>(null);
  const [loading, setLoading]     = useState(false);
  const [running, setRunning]     = useState(false);
  const [approving, setApproving] = useState(false);

  const [deductEntry, setDeductEntry]   = useState<Employee | null>(null);
  const [salaryEntry, setSalaryEntry]   = useState<Employee | null>(null);
  const [removing, setRemoving]         = useState<number | null>(null);
  const [payrollMap, setPayrollMap]     = useState<Record<number, number>>({}); // employeeId → payrollId
  const [empModal, setEmpModal]         = useState<Employee | null | 'new'>(null);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [empLoading, setEmpLoading]     = useState(false);
  const [search, setSearch]             = useState('');

  const roleFilter = tab === 'graders' ? 'GRADER' : tab === 'shopkeepers' ? 'SHOPKEEPER' : undefined;

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await payrollApi.getPayroll({ month, year, role: roleFilter });
      const entries = r.data?.payrolls ?? [];
      setPayrolls(entries);
      setTotals(r.data?.totals ?? null);
      // Build employeeId → payrollId map for use in All Staff tab
      const map: Record<number, number> = {};
      entries.forEach((p: any) => { map[p.employeeId] = p.id; });
      setPayrollMap(map);
    } catch {}
    finally { setLoading(false); }
  }, [month, year, roleFilter]);

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const r = await payrollApi.getEmployees({ role: roleFilter, search: search || undefined });
      setEmployees(r.data ?? []);
    } catch {}
    finally { setEmpLoading(false); }
  }, [roleFilter, search]);

  async function handleRemoveFromPayroll(payrollId: number) {
    if (!window.confirm('Remove this entry from payroll? The employee stays in the system.')) return;
    setRemoving(payrollId);
    try {
      await payrollApi.removeFromPayroll(payrollId);
      // Refresh whichever is active
      if (tab !== 'staff') await loadPayroll();
      else { await loadAllPayroll(); await loadEmployees(); }
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed'); }
    finally { setRemoving(null); }
  }

  // Always keep payrollMap fresh so staff tab can show remove button
  const loadAllPayroll = useCallback(async () => {
    try {
      const r = await payrollApi.getPayroll({ month, year });
      const entries = r.data?.payrolls ?? [];
      const map: Record<number, number> = {};
      entries.forEach((p: any) => { map[p.employeeId] = p.id; });
      setPayrollMap(map);
    } catch {}
  }, [month, year]);

  useEffect(() => {
    if (tab !== 'staff') loadPayroll();
    else { loadEmployees(); loadAllPayroll(); }
  }, [tab, loadPayroll, loadEmployees, loadAllPayroll]);

  async function handleRunPayroll() {
    setRunning(true);
    try {
      await payrollApi.runPayroll({ month, year, role: roleFilter });
      await loadPayroll();
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed to run payroll'); }
    finally { setRunning(false); }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const r = await payrollApi.approvePayroll({ month, year, role: roleFilter });
      alert(`✓ Approved ${r.data.approved} payroll entries`);
      await loadPayroll();
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed'); }
    finally { setApproving(false); }
  }

  async function handleExport() {
    try {
      const r = await payrollApi.getRemittance({ month, year, role: roleFilter });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gutoria_Payroll_${MONTHS[month]}_${year}.xlsx`;
      a.click();
    } catch { alert('Export failed'); }
  }

  const displayed = payrolls.filter(p =>
    !search || p.employee.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={P.page}>
      {/* Header */}
      <div style={P.header}>
        <div>
          <h1 style={P.title}>Staff Payroll</h1>
          <p style={P.subtitle}>Graders · Shopkeepers · K-Unity SACCO</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tab !== 'staff' && (
            <>
              <button style={P.outlineBtn} onClick={handleRunPayroll} disabled={running}>
                {running ? '⏳ Running...' : '⚙️ Generate Payroll'}
              </button>
              <button style={P.outlineBtn} onClick={handleApprove} disabled={approving || !totals?.pending}>
                {approving ? '⏳...' : `✓ Approve All (${totals?.pending ?? 0})`}
              </button>
              <button style={P.exportBtn} onClick={handleExport}>
                📥 Export Remittance
              </button>
            </>
          )}
          {tab === 'staff' && (
            <button style={P.addBtn} onClick={() => setEmpModal('new')}>+ Add Employee</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={P.filterBar}>
        <select style={P.sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select style={P.sel} value={year} onChange={e => setYear(Number(e.target.value))}>
          {[NOW.getFullYear()-1, NOW.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input style={P.searchInput} value={search}
          onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name..." />
      </div>

      {/* Tabs */}
      <div style={P.tabs}>
        {(['graders', 'shopkeepers', 'staff'] as const).map(t => (
          <button key={t} style={{ ...P.tab, ...(tab === t ? P.tabActive : {}) }}
            onClick={() => { setTab(t); setSearch(''); }}>
            {t === 'graders' ? '🚛 Graders' : t === 'shopkeepers' ? '🏪 Shopkeepers' : '👥 All Staff'}
          </button>
        ))}
      </div>

      {/* No-salary warning -- handled via run payroll response */}
      {/* Summary strip */}
      {totals && tab !== 'staff' && (
        <div style={P.strip}>
          {[
            { l: 'Staff',      v: String(totals.count),           c: '#374151' },
            { l: 'Gross',      v: 'KES ' + fmt(totals.baseSalary),c: '#16a34a' },
            { l: 'Deductions', v: 'KES ' + fmt(totals.deductions), c: '#dc2626' },
            { l: 'Net Pay',    v: 'KES ' + fmt(totals.netPay),     c: '#1d4ed8' },
            { l: 'Pending',    v: String(totals.pending),          c: '#6b7280' },
            { l: 'Approved',   v: String(totals.approved),         c: '#1d4ed8' },
            { l: 'Paid',       v: String(totals.paid),             c: '#16a34a' },
          ].map(c => (
            <div key={c.l} style={P.stripItem}>
              <div style={{ fontSize: 15, fontWeight: 800, color: c.c }}>{c.v}</div>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{c.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ PAYROLL TABLE ════════════════════════════════════ */}
      {tab !== 'staff' && (
        loading ? (
          <div style={P.center}><div style={P.spinner} /></div>
        ) : payrolls.length === 0 ? (
          <div style={P.empty}>
            <div style={{ fontSize: 40 }}>📋</div>
            <p style={{ fontWeight: 600 }}>No payroll entries for {MONTHS[month]} {year}</p>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Click "Generate Payroll" to create entries from current salaries</p>
          </div>
        ) : (
          <div style={P.tableCard}>
            <table style={P.table}>
              <thead>
                <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                  <th style={P.th}>#</th>
                  <th style={P.th}>Code</th>
                  <th style={P.th}>Full Name</th>
                  <th style={P.th}>Role</th>
                  <th style={P.th}>K-Unity Acc No.</th>
                  <th style={{ ...P.th, textAlign: 'right' }}>Gross (KES)</th>
                  <th style={{ ...P.th, textAlign: 'right' }}>Variance Ded.</th>
                  <th style={{ ...P.th, textAlign: 'right' }}>Other Ded.</th>
                  <th style={{ ...P.th, textAlign: 'right' }}>Net Pay (KES)</th>
                  <th style={P.th}>Status</th>
                  <th style={P.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((p, idx) => (
                  <tr key={p.id} style={{ background: idx % 2 === 1 ? '#f9fafb' : '#fff', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <td style={{ ...P.td, color: '#9ca3af', fontSize: 11 }}>{idx + 1}</td>
                    <td style={{ ...P.td, fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{p.employee.code}</td>
                    <td style={{ ...P.td, fontWeight: 700 }}>{p.employee.name}</td>
                    <td style={P.td}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: p.employee.role === 'GRADER' ? '#eff6ff' : '#f0fdf4', color: p.employee.role === 'GRADER' ? '#1d4ed8' : '#166534' }}>
                        {p.employee.role}
                      </span>
                    </td>
                    <td style={{ ...P.td, fontFamily: 'monospace', fontSize: 12 }}>{p.employee.bankAccount}</td>
                    <td style={{ ...P.td, textAlign: 'right', fontWeight: 600 }}>{fmt(Number(p.baseSalary))}</td>
                    <td style={{ ...P.td, textAlign: 'right', color: Number(p.varianceDeductions) > 0 ? '#dc2626' : '#9ca3af' }}>
                      {Number(p.varianceDeductions) > 0 ? fmt(Number(p.varianceDeductions)) : '—'}
                    </td>
                    <td style={{ ...P.td, textAlign: 'right', color: Number(p.otherDeductions) > 0 ? '#dc2626' : '#9ca3af' }}>
                      {Number(p.otherDeductions) > 0 ? fmt(Number(p.otherDeductions)) : '—'}
                    </td>
                    <td style={{ ...P.td, textAlign: 'right', fontWeight: 800, color: Number(p.netPay) < 0 ? '#dc2626' : '#16a34a' }}>
                      {fmt(Number(p.netPay))}
                    </td>
                    <td style={P.td}><StatusBadge status={p.status} /></td>
                    <td style={{ ...P.td, whiteSpace: 'nowrap' }}>
                      {!p.employee.salary && (
                        <button style={{ ...P.dedBtn, background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e', marginRight: 4 }}
                          onClick={() => setSalaryEntry(p.employee)}>
                          💰 Set Salary
                        </button>
                      )}
                      <button style={{ ...P.dedBtn, marginRight: 4 }}
                        onClick={() => setDeductEntry(p.employee)}
                        disabled={p.status === 'PAID'}>
                        − Ded
                      </button>
                      <button style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#dc2626', cursor: 'pointer', opacity: removing === p.id ? 0.5 : 1 }}
                        onClick={() => handleRemoveFromPayroll(p.id)}
                        disabled={p.status === 'PAID' || removing === p.id}
                        title="Remove from this month's payroll">
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: 800, fontSize: 13 }}>
                  <td colSpan={5} style={{ padding: '10px 12px' }}>TOTALS ({totals?.count})</td>
                  <td style={{ ...P.td, textAlign: 'right', color: '#86efac' }}>{totals ? fmt(totals.baseSalary) : ''}</td>
                  <td colSpan={2} style={{ ...P.td, textAlign: 'right', color: '#fca5a5' }}>{totals ? fmt(totals.deductions) : ''}</td>
                  <td style={{ ...P.td, textAlign: 'right', color: '#93c5fd' }}>{totals ? fmt(totals.netPay) : ''}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}

      {/* ══ STAFF LIST TAB ═══════════════════════════════════ */}
      {tab === 'staff' && (
        empLoading ? (
          <div style={P.center}><div style={P.spinner} /></div>
        ) : (
          <div style={P.tableCard}>
            <table style={P.table}>
              <thead>
                <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                  <th style={P.th}>#</th>
                  <th style={P.th}>Code</th>
                  <th style={P.th}>Full Name</th>
                  <th style={P.th}>Role</th>
                  <th style={P.th}>Phone</th>
                  <th style={P.th}>Bank / SACCO</th>
                  <th style={P.th}>Account No.</th>
                  <th style={{ ...P.th, textAlign: 'right' }}>Salary (KES)</th>
                  <th style={P.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase())).map((e, idx) => (
                  <tr key={e.id} style={{ background: idx % 2 === 1 ? '#f9fafb' : '#fff', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <td style={{ ...P.td, color: '#9ca3af', fontSize: 11 }}>{idx + 1}</td>
                    <td style={{ ...P.td, fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{e.code}</td>
                    <td style={{ ...P.td, fontWeight: 700 }}>{e.name}</td>
                    <td style={P.td}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: e.role === 'GRADER' ? '#eff6ff' : '#f0fdf4', color: e.role === 'GRADER' ? '#1d4ed8' : '#166534' }}>
                        {e.role}
                      </span>
                    </td>
                    <td style={{ ...P.td, fontSize: 12 }}>{e.phone}</td>
                    <td style={{ ...P.td, fontSize: 12 }}>{e.bankName}</td>
                    <td style={{ ...P.td, fontFamily: 'monospace', fontSize: 12 }}>{e.bankAccount}</td>
                    <td style={{ ...P.td, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                      KES {fmt(Number(e.salary))}
                    </td>
                    <td style={{ ...P.td, whiteSpace: 'nowrap' as const }}>
                      <button style={{ ...P.editBtn, marginRight: 6 }} onClick={() => setEmpModal(e)}>Edit</button>
                      {payrollMap[e.id] ? (
                        <button
                          style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#dc2626', cursor: 'pointer', opacity: removing === payrollMap[e.id] ? 0.5 : 1 }}
                          onClick={() => handleRemoveFromPayroll(payrollMap[e.id])}
                          disabled={removing === payrollMap[e.id]}
                          title={`Remove from ${MONTHS[month]} ${year} payroll`}>
                          🗑 Remove
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#d1d5db', fontStyle: 'italic' }}>not in payroll</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 && (
              <div style={P.empty}>
                <p>No staff found. Run the seed script first.</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Modals */}
      {salaryEntry && (
        <SalaryModal
          employee={salaryEntry}
          onClose={() => setSalaryEntry(null)}
          onSaved={() => { setSalaryEntry(null); loadPayroll(); }}
        />
      )}
      {deductEntry && (
        <DeductionModal
          employee={deductEntry} month={month} year={year}
          onClose={() => setDeductEntry(null)}
          onSaved={() => { setDeductEntry(null); loadPayroll(); }}
        />
      )}
      {empModal && (
        <EmployeeModal
          employee={empModal === 'new' ? null : empModal as Employee}
          onClose={() => setEmpModal(null)}
          onSaved={() => { setEmpModal(null); loadEmployees(); }}
        />
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const P: Record<string, React.CSSProperties> = {
  page:       { padding: 20 },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  title:      { fontSize: 22, fontWeight: 800, color: '#111', margin: 0 },
  subtitle:   { fontSize: 13, color: '#6b7280', marginTop: 3 },
  filterBar:  { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' },
  sel:        { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 },
  searchInput:{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, flex: 1, minWidth: 200 },
  tabs:       { display: 'flex', gap: 4, marginBottom: 16, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab:        { border: 'none', background: 'transparent', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280' },
  tabActive:  { background: '#fff', color: '#1e3a5f', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  strip:      { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 },
  stripItem:  { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 16px', flex: 1, minWidth: 100, textAlign: 'center' as const },
  tableCard:  { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th:         { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const },
  td:         { padding: '10px 12px', verticalAlign: 'middle' as const },
  outlineBtn: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' },
  exportBtn:  { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  addBtn:     { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  dedBtn:     { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#dc2626', cursor: 'pointer' },
  editBtn:    { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1d4ed8', cursor: 'pointer' },
  center:     { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:    { width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#1e3a5f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty:      { textAlign: 'center' as const, padding: 60, color: '#9ca3af' },
};
