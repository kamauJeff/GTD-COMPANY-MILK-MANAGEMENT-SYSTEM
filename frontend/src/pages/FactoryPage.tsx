// src/pages/FactoryPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { factoryApi, shopsApi } from '../api/client';

const MONTHS = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const NOW   = new Date();
const fmt   = (n: number) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtL  = (n: number) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });

type Tab = 'receipts' | 'batches' | 'deliveries' | 'liquid';

// ── Stat card ──────────────────────────────────────────────────
function Stat({ label, value, sub, color = '#374151', icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '14px 18px', flex: 1, minWidth: 130 }}>
      {icon && <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>}
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const,
        letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Modal shell ────────────────────────────────────────────────
function Modal({ title, sub, onClose, children }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background: '#1e3a5f', padding: '16px 20px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: '#93c5fd', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151',
        marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px',
  fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
};

// ══ RECEIPTS TAB ═══════════════════════════════════════════════
function ReceiptsTab({ month, year }: { month: number; year: number }) {
  const [data, setData]       = useState<any[]>([]);
  const [graders, setGraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ graderId: '', litres: '', receivedAt: '', notes: '' });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await factoryApi.receipts({ month, year }); setData(r.data ?? []); }
    catch {} finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { factoryApi.graders().then(r => setGraders(r.data ?? [])).catch(() => {}); }, []);

  async function save() {
    if (!form.graderId || !form.litres || !form.receivedAt) { setErr('Fill all required fields'); return; }
    setSaving(true); setErr('');
    try {
      await factoryApi.createReceipt({ ...form, graderId: Number(form.graderId), litres: Number(form.litres) });
      setShowAdd(false); setForm({ graderId: '', litres: '', receivedAt: '', notes: '' }); load();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this receipt?')) return;
    try { await factoryApi.deleteReceipt(id); load(); } catch {}
  }

  const totalL = data.reduce((s, r) => s + Number(r.litres), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{data.length} entries</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{fmtL(totalL)} L received</span>
        </div>
        <button style={S.addBtn} onClick={() => setShowAdd(true)}>+ Record Receipt</button>
      </div>

      {loading && <div style={S.loadBar}><div style={S.loadFill} /></div>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              {['#','Date','Grader','Litres','Notes',''].map(h => (
                <th key={h} style={{ ...S.th, textAlign: h === 'Litres' ? 'right' as const : 'left' as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.id} style={{ ...S.tr, background: i % 2 === 1 ? '#f9fafb' : '#fff' }}>
                <td style={{ ...S.td, color: '#9ca3af', width: 36 }}>{i+1}</td>
                <td style={S.td}>{fmtDate(r.receivedAt)}</td>
                <td style={S.td}>
                  <span style={{ fontWeight: 600 }}>{r.grader?.name}</span>
                  <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 6 }}>{r.grader?.code}</span>
                </td>
                <td style={{ ...S.td, textAlign: 'right' as const, fontWeight: 700, color: '#1d4ed8' }}>{fmtL(Number(r.litres))} L</td>
                <td style={{ ...S.td, color: '#6b7280', fontSize: 12 }}>{r.notes ?? '—'}</td>
                <td style={S.td}>
                  <button onClick={() => remove(r.id)} style={S.delBtn}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: 800 }}>
                <td colSpan={3} style={{ padding: '10px 14px' }}>TOTAL ({data.length} entries)</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' as const, color: '#93c5fd' }}>{fmtL(totalL)} L</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
        {data.length === 0 && !loading && (
          <div style={S.empty}><div style={{ fontSize: 36 }}>🏭</div><p>No receipts for {MONTHS[month]} {year}</p></div>
        )}
      </div>

      {showAdd && (
        <Modal title="Record Milk Receipt" sub="Log milk received at factory" onClose={() => setShowAdd(false)}>
          {err && <div style={S.err}>{err}</div>}
          <Field label="Grader *">
            <select style={inp} value={form.graderId} onChange={e => setForm(f => ({ ...f, graderId: e.target.value }))}>
              <option value="">Select grader...</option>
              {graders.map(g => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
            </select>
          </Field>
          <Field label="Date Received *">
            <input style={inp} type="datetime-local" value={form.receivedAt}
              onChange={e => setForm(f => ({ ...f, receivedAt: e.target.value }))} />
          </Field>
          <Field label="Litres *">
            <input style={inp} type="number" step="0.1" min="0" value={form.litres}
              onChange={e => setForm(f => ({ ...f, litres: e.target.value }))} placeholder="0.0" />
          </Field>
          <Field label="Notes (optional)">
            <input style={inp} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Morning delivery" />
          </Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={S.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save Receipt'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══ BATCHES TAB ════════════════════════════════════════════════
function BatchesTab({ month, year }: { month: number; year: number }) {
  const [data, setData]     = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm]     = useState({ batchNo: '', inputLitres: '', outputLitres: '', processedAt: '', qualityNotes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await factoryApi.batches({ month, year }); setData(r.data ?? []); }
    catch {} finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  async function openAdd() {
    const r = await factoryApi.nextBatchNo();
    setForm(f => ({ ...f, batchNo: r.data.batchNo }));
    setShowAdd(true);
  }

  async function save() {
    if (!form.batchNo || !form.inputLitres || !form.outputLitres || !form.processedAt) {
      setErr('Fill all required fields'); return;
    }
    setSaving(true); setErr('');
    try {
      await factoryApi.createBatch({ ...form, inputLitres: Number(form.inputLitres), outputLitres: Number(form.outputLitres) });
      setShowAdd(false); setForm({ batchNo: '', inputLitres: '', outputLitres: '', processedAt: '', qualityNotes: '' }); load();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this batch? This cannot be undone.')) return;
    try { await factoryApi.deleteBatch(id); load(); }
    catch (e: any) { alert(e.response?.data?.error ?? 'Cannot delete batch'); }
  }

  const totalIn  = data.reduce((s, b) => s + Number(b.inputLitres), 0);
  const totalOut = data.reduce((s, b) => s + Number(b.outputLitres), 0);
  const totalLoss= data.reduce((s, b) => s + Number(b.lossLitres), 0);
  const avgEff   = totalIn > 0 ? (totalOut / totalIn * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{data.length} batches</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{fmtL(totalIn)} L in</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmtL(totalOut)} L out</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmtL(totalLoss)} L loss</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{avgEff.toFixed(1)}% efficiency</span>
        </div>
        <button style={{ ...S.addBtn, marginLeft: 'auto' }} onClick={openAdd}>+ New Batch</button>
      </div>

      {loading && <div style={S.loadBar}><div style={S.loadFill} /></div>}

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        {data.map((batch, i) => {
          const eff = Number(batch.inputLitres) > 0
            ? (Number(batch.outputLitres) / Number(batch.inputLitres) * 100) : 0;
          const delivered = batch.deliveries?.reduce((s: number, d: any) => s + Number(d.litres), 0) ?? 0;
          const remaining = Number(batch.outputLitres) - delivered;
          const isOpen = expanded === batch.id;

          return (
            <div key={batch.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              {/* Batch header */}
              <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 10,
                cursor: 'pointer', userSelect: 'none' as const }}
                onClick={() => setExpanded(isOpen ? null : batch.id)}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, fontFamily: 'monospace' }}>{batch.batchNo}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{fmtDate(batch.processedAt)}</span>
                    {remaining > 0
                      ? <span style={{ ...S.badge, background: '#fef3c7', color: '#92400e' }}>{fmtL(remaining)} L undelivered</span>
                      : <span style={{ ...S.badge, background: '#dcfce7', color: '#166534' }}>✓ Fully delivered</span>}
                  </div>
                  {batch.qualityNotes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{batch.qualityNotes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{fmtL(Number(batch.inputLitres))} L</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Input</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmtL(Number(batch.outputLitres))} L</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Output</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmtL(Number(batch.lossLitres))} L</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Loss</div>
                  </div>
                  <div style={{ textAlign: 'center' as const, background: eff >= 95 ? '#dcfce7' : eff >= 90 ? '#fef9c3' : '#fee2e2',
                    borderRadius: 8, padding: '4px 10px', minWidth: 54 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: eff >= 95 ? '#16a34a' : eff >= 90 ? '#92400e' : '#dc2626' }}>
                      {eff.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>eff.</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); remove(batch.id); }} style={S.delBtn}>🗑</button>
                  <span style={{ color: '#9ca3af', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Efficiency bar */}
              <div style={{ height: 4, background: '#f3f4f6' }}>
                <div style={{ height: '100%', width: `${Math.min(eff, 100)}%`,
                  background: eff >= 95 ? '#16a34a' : eff >= 90 ? '#f59e0b' : '#dc2626',
                  transition: 'width 0.4s' }} />
              </div>

              {/* Deliveries sub-table */}
              {isOpen && (
                <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                    DELIVERIES FROM THIS BATCH
                  </div>
                  {batch.deliveries?.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: 13 }}>No deliveries recorded yet for this batch.</div>
                  ) : (
                    <table style={{ ...S.table, fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          {['Shop','Driver','Litres','Price/L','Revenue','Date'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', fontWeight: 700, fontSize: 11,
                              textAlign: h === 'Litres' || h === 'Revenue' || h === 'Price/L' ? 'right' as const : 'left' as const,
                              color: '#374151' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {batch.deliveries.map((d: any) => (
                          <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 600 }}>{d.shop?.name}</td>
                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{d.driver?.name}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' as const, fontWeight: 700, color: '#1d4ed8' }}>{fmtL(Number(d.litres))} L</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' as const }}>KES {fmt(Number(d.sellingPrice))}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' as const, fontWeight: 700, color: '#16a34a' }}>
                              KES {fmt(Number(d.litres) * Number(d.sellingPrice))}
                            </td>
                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{fmtDate(d.deliveredAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {data.length === 0 && !loading && (
          <div style={S.empty}><div style={{ fontSize: 36 }}>🧪</div><p>No batches for {MONTHS[month]} {year}</p></div>
        )}
      </div>

      {showAdd && (
        <Modal title="New Pasteurization Batch" onClose={() => setShowAdd(false)}>
          {err && <div style={S.err}>{err}</div>}
          <Field label="Batch Number *">
            <input style={inp} value={form.batchNo} onChange={e => setForm(f => ({ ...f, batchNo: e.target.value }))} />
          </Field>
          <Field label="Processed At *">
            <input style={inp} type="datetime-local" value={form.processedAt}
              onChange={e => setForm(f => ({ ...f, processedAt: e.target.value }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Input Litres *">
              <input style={inp} type="number" step="0.1" min="0" value={form.inputLitres}
                onChange={e => setForm(f => ({ ...f, inputLitres: e.target.value }))} placeholder="0.0" />
            </Field>
            <Field label="Output Litres *">
              <input style={inp} type="number" step="0.1" min="0" value={form.outputLitres}
                onChange={e => setForm(f => ({ ...f, outputLitres: e.target.value }))} placeholder="0.0" />
            </Field>
          </div>
          {form.inputLitres && form.outputLitres && (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>
                Efficiency: {(Number(form.outputLitres) / Number(form.inputLitres) * 100).toFixed(1)}%
              </span>
              <span style={{ color: '#6b7280', marginLeft: 12 }}>
                Loss: {fmtL(Number(form.inputLitres) - Number(form.outputLitres))} L
              </span>
            </div>
          )}
          <Field label="Quality Notes (optional)">
            <input style={inp} value={form.qualityNotes}
              onChange={e => setForm(f => ({ ...f, qualityNotes: e.target.value }))}
              placeholder="e.g. Normal, Grade A" />
          </Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={S.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Create Batch'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══ DELIVERIES TAB ═════════════════════════════════════════════
function DeliveriesTab({ month, year }: { month: number; year: number }) {
  const [data, setData]     = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [shops, setShops]   = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]     = useState({
    batchId: '', shopId: '', driverId: '',
    litres: '', sellingPrice: '65', deliveredAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await factoryApi.deliveries({ month, year }); setData(r.data ?? []); }
    catch {} finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    factoryApi.batches({ month, year }).then(r => setBatches(r.data ?? [])).catch(() => {});
    shopsApi.list({ limit: 100 }).then(r => setShops(r.data?.data ?? r.data ?? [])).catch(() => {});
    factoryApi.drivers().then(r => setDrivers(r.data ?? [])).catch(() => {});
  }, [month, year]);

  const selectedBatch = batches.find(b => String(b.id) === form.batchId);
  const deliveredSoFar = selectedBatch?.deliveries?.reduce((s: number, d: any) => s + Number(d.litres), 0) ?? 0;
  const remaining = selectedBatch ? Number(selectedBatch.outputLitres) - deliveredSoFar : 0;

  async function save() {
    if (!form.batchId || !form.shopId || !form.driverId || !form.litres || !form.sellingPrice || !form.deliveredAt) {
      setErr('Fill all required fields'); return;
    }
    setSaving(true); setErr('');
    try {
      await factoryApi.createDelivery({
        batchId: Number(form.batchId), shopId: Number(form.shopId),
        driverId: Number(form.driverId), litres: Number(form.litres),
        sellingPrice: Number(form.sellingPrice), deliveredAt: form.deliveredAt,
      });
      setShowAdd(false);
      setForm({ batchId: '', shopId: '', driverId: '', litres: '', sellingPrice: '65', deliveredAt: '' });
      load();
    } catch (e: any) { setErr(e.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this delivery record?')) return;
    try { await factoryApi.deleteDelivery(id); load(); } catch {}
  }

  const totalL  = data.reduce((s, d) => s + Number(d.litres), 0);
  const totalRev= data.reduce((s, d) => s + Number(d.litres) * Number(d.sellingPrice), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{data.length} deliveries</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{fmtL(totalL)} L delivered</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>KES {fmt(totalRev)} revenue</span>
        </div>
        <button style={S.addBtn} onClick={() => setShowAdd(true)}>+ Record Delivery</button>
      </div>

      {loading && <div style={S.loadBar}><div style={S.loadFill} /></div>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              {['#','Date','Batch','Shop','Driver','Litres','Price/L','Revenue',''].map(h => (
                <th key={h} style={{ ...S.th, textAlign: ['Litres','Price/L','Revenue'].includes(h) ? 'right' as const : 'left' as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.id} style={{ ...S.tr, background: i % 2 === 1 ? '#f9fafb' : '#fff' }}>
                <td style={{ ...S.td, color: '#9ca3af', width: 36 }}>{i+1}</td>
                <td style={S.td}>{fmtDate(d.deliveredAt)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{d.batch?.batchNo}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{d.shop?.name}</td>
                <td style={{ ...S.td, color: '#6b7280' }}>{d.driver?.name}</td>
                <td style={{ ...S.td, textAlign: 'right' as const, fontWeight: 700, color: '#1d4ed8' }}>{fmtL(Number(d.litres))} L</td>
                <td style={{ ...S.td, textAlign: 'right' as const }}>KES {fmt(Number(d.sellingPrice))}</td>
                <td style={{ ...S.td, textAlign: 'right' as const, fontWeight: 700, color: '#16a34a' }}>
                  KES {fmt(Number(d.litres) * Number(d.sellingPrice))}
                </td>
                <td style={S.td}><button onClick={() => remove(d.id)} style={S.delBtn}>🗑</button></td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: 800 }}>
                <td colSpan={5} style={{ padding: '10px 14px' }}>TOTAL ({data.length} deliveries)</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' as const, color: '#93c5fd' }}>{fmtL(totalL)} L</td>
                <td />
                <td style={{ padding: '10px 14px', textAlign: 'right' as const, color: '#86efac' }}>KES {fmt(totalRev)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {data.length === 0 && !loading && (
          <div style={S.empty}><div style={{ fontSize: 36 }}>🚚</div><p>No deliveries for {MONTHS[month]} {year}</p></div>
        )}
      </div>

      {showAdd && (
        <Modal title="Record Shop Delivery" sub="Deliver pasteurized milk to a shop" onClose={() => setShowAdd(false)}>
          {err && <div style={S.err}>{err}</div>}
          <Field label="Batch *">
            <select style={inp} value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value, litres: '' }))}>
              <option value="">Select batch...</option>
              {batches.map(b => {
                const del = b.deliveries?.reduce((s: number, d: any) => s + Number(d.litres), 0) ?? 0;
                const rem = Number(b.outputLitres) - del;
                return <option key={b.id} value={b.id}>{b.batchNo} — {fmtL(rem)} L remaining</option>;
              })}
            </select>
          </Field>
          {selectedBatch && (
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#1d4ed8' }}>
              {fmtL(remaining)} L available from this batch
            </div>
          )}
          <Field label="Shop *">
            <select style={inp} value={form.shopId} onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))}>
              <option value="">Select shop...</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </Field>
          <Field label="Driver *">
            <select style={inp} value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
              <option value="">Select driver...</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
            </select>
          </Field>
          <Field label="Date & Time *">
            <input style={inp} type="datetime-local" value={form.deliveredAt}
              onChange={e => setForm(f => ({ ...f, deliveredAt: e.target.value }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={`Litres * ${remaining > 0 ? `(max ${fmtL(remaining)})` : ''}`}>
              <input style={inp} type="number" step="0.1" min="0" max={remaining || undefined}
                value={form.litres} onChange={e => setForm(f => ({ ...f, litres: e.target.value }))} placeholder="0.0" />
            </Field>
            <Field label="Selling Price/L (KES) *">
              <input style={inp} type="number" step="0.5" min="0"
                value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} />
            </Field>
          </div>
          {form.litres && form.sellingPrice && (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              Revenue: <strong style={{ color: '#16a34a' }}>KES {fmt(Number(form.litres) * Number(form.sellingPrice))}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={S.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Record Delivery'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ══ LIQUID RECONCILIATION TAB ══════════════════════════════════
// Mirrors the Excel "Liquid August" sheet.
// Rows = routes. Columns = per day: Journal (collections) | Liquid (entered) | Diff
// Negative diff = loss. Grader can be charged via VarianceRecord.
// ══════════════════════════════════════════════════════════════

async function downloadLiquidExcel(month: number, year: number) {
  const r = await factoryApi.liquidExcel({ month, year });
  const url = URL.createObjectURL(new Blob([r.data]));
  const a = document.createElement('a'); a.href = url;
  a.download = `Liquid_${month}_${year}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

function DiffCell({ diff }: { diff: number | null }) {
  if (diff === null) return <span style={{ color: '#d1d5db' }}>—</span>;
  const color = diff < -1 ? '#dc2626' : diff > 1 ? '#16a34a' : '#9ca3af';
  const bold  = Math.abs(diff) > 10;
  return (
    <span style={{ color, fontWeight: bold ? 800 : 400, fontSize: 11 }}>
      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
    </span>
  );
}

function LiquidTab({ month, year }: { month: number; year: number }) {
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [editing,  setEditing]  = useState<{ routeId: number; day: number } | null>(null);
  const [editVal,  setEditVal]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [chargeRow,    setChargeRow]    = useState<any>(null);
  const [chargeAmt,    setChargeAmt]    = useState('');
  const [chargeReason, setChargeReason] = useState('');
  const [charging,     setCharging]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await factoryApi.liquidGrid({ month, year });
      setData(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load');
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  async function saveCell(routeId: number, day: number) {
    const val = editVal.trim();
    setEditing(null);
    if (val === '') return;
    setSaving(true);
    try {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      await factoryApi.saveLiquid({ routeId, recordDate: dateStr, liquidL: Number(val) });
      load();
    } catch (e: any) { alert(e?.response?.data?.error ?? 'Save failed'); }
    finally { setSaving(false); }
  }

  async function doCharge() {
    if (!chargeRow || !chargeAmt) return;
    if (!chargeRow.grader?.id) {
      alert('No grader/supervisor assigned to this route. Assign one in Routes first.');
      return;
    }
    setCharging(true);
    try {
      await factoryApi.chargeLoss({
        graderId: chargeRow.grader.id, month, year,
        amount: Number(chargeAmt),
        description: chargeReason || `Liquid loss — ${MONTHS[month]} ${year}`,
      });
      setChargeRow(null); setChargeAmt(''); setChargeReason('');
      alert(`✓ Deduction of KES ${Number(chargeAmt).toLocaleString()} applied against ${chargeRow.grader.name}`);
    } catch (e: any) { alert(e?.response?.data?.error ?? 'Charge failed'); }
    finally { setCharging(false); }
  }

  /* ── render helpers ───────────────────────────────────────── */
  function diffColor(d: number | null) {
    if (d === null) return '#d1d5db';
    if (d < -5)  return '#dc2626';
    if (d < 0)   return '#f59e0b';
    if (d > 0)   return '#16a34a';
    return '#9ca3af';
  }
  function diffText(d: number | null) {
    if (d === null) return '';
    return (d > 0 ? '+' : '') + d.toFixed(1);
  }

  /* ── early states ─────────────────────────────────────────── */
  if (loading && !data) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
      Loading liquid data...
    </div>
  );

  if (error) return (
    <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10,
      padding: 20, color: '#dc2626' }}>
      <strong>Error loading liquid data:</strong> {error}
      <br /><button onClick={load} style={{ marginTop: 10, padding: '6px 14px',
        background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  );

  if (!data) return null;

  const days = Array.from({ length: data.daysInMonth }, (_, i) => i + 1);
  const grandJ = data.grandJournal ?? 0;
  const grandL = data.grandLiquid  ?? 0;
  const grandD = +(grandL - grandJ).toFixed(1);

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div>
      <style>{`
        @keyframes slideBar { from { margin-left:0; width:30% } to { margin-left:60%; width:40% } }
        .liq-l-cell:hover { background: #f0fdf4 !important; }
        .liq-row:hover td { background: #fafafa !important; }
      `}</style>

      {/* Loading bar */}
      {loading && (
        <div style={{ height: 3, background: '#e5e7eb', marginBottom: 8, overflow: 'hidden', borderRadius: 2 }}>
          <div style={{ height: '100%', width: '40%', background: '#1e3a5f',
            animation: 'slideBar 1s ease-in-out infinite alternate' }} />
        </div>
      )}

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={LS.card}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>📋 JOURNAL (farmers → graders)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{fmtL(grandJ)} L</div>
        </div>
        <div style={LS.card}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>🏭 LIQUID (arrived at factory)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{fmtL(grandL)} L</div>
        </div>
        <div style={{ ...LS.card, borderLeftColor: grandD < -5 ? '#dc2626' : grandD > 0 ? '#16a34a' : '#9ca3af' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>
            {grandD < -5 ? '⚠ TOTAL LOSS' : 'NET DIFFERENCE'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: diffColor(grandD) }}>
            {diffText(grandD)} L
          </div>
        </div>
        <button
          onClick={async () => {
            try {
              const r = await factoryApi.liquidExcel({ month, year });
              const url = URL.createObjectURL(new Blob([r.data]));
              const a = document.createElement('a'); a.href = url;
              a.download = `Liquid_${MONTHS[month]}_${year}.xlsx`; a.click();
            } catch { alert('Excel export failed'); }
          }}
          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
            padding: '0 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'stretch', minWidth: 100 }}>
          📥 Excel
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
        Click any <strong style={{ color: '#16a34a' }}>Liquid</strong> cell to enter litres received at factory.
        Press <kbd style={{ background:'#f3f4f6',borderRadius:3,padding:'1px 5px' }}>Enter</kbd> to save,{' '}
        <kbd style={{ background:'#f3f4f6',borderRadius:3,padding:'1px 5px' }}>Esc</kbd> to cancel.
        {saving && <span style={{ color: '#f59e0b', marginLeft: 10 }}>⏳ Saving...</span>}
      </p>

      {/* THE GRID */}
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
        <table style={{ fontSize: 11, borderCollapse: 'collapse' as const, width: '100%' }}>
          <thead>
            {/* Row 1: day numbers (each spans 3 cols: J | L | Diff) */}
            <tr>
              <th style={LS.h_no}>#</th>
              <th style={LS.h_route}>ROUTE</th>
              <th style={LS.h_grader}>GRADER</th>
              {days.map(d => (
                <th key={d} colSpan={3} style={{
                  padding: '7px 4px', textAlign: 'center' as const, fontWeight: 700,
                  fontSize: 10, color: '#fff', whiteSpace: 'nowrap' as const,
                  background: d === 15 ? '#92400e' : d <= 15 ? '#1e3a5f' : '#0f2742',
                  borderLeft: d % 5 === 1 ? '2px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)',
                }}>{d}</th>
              ))}
              <th colSpan={3} style={{ ...LS.h_sum, background: '#14532d', borderLeft: '3px solid rgba(255,255,255,0.4)' }}>1–15th</th>
              <th colSpan={3} style={{ ...LS.h_sum, background: '#7f1d1d', borderLeft: '2px solid rgba(255,255,255,0.25)' }}>16–end</th>
              <th colSpan={3} style={{ ...LS.h_sum, background: '#1e3a5f', borderLeft: '3px solid rgba(255,255,255,0.4)' }}>TOTAL</th>
              <th style={{ ...LS.h_sum, background: '#4c1d95' }}>ACT</th>
            </tr>
            {/* Row 2: J / L / Δ sub-headers */}
            <tr style={{ background: '#f0f4f8' }}>
              <th style={{ ...LS.h_no, background: '#f0f4f8', color: '#374151', fontSize: 9 }}></th>
              <th style={{ ...LS.h_route, background: '#f0f4f8', color: '#374151' }}></th>
              <th style={{ ...LS.h_grader, background: '#f0f4f8', color: '#374151' }}></th>
              {days.flatMap(d => [
                <th key={`hj${d}`} style={LS.sh_j}>J</th>,
                <th key={`hl${d}`} style={LS.sh_l}>L</th>,
                <th key={`hd${d}`} style={LS.sh_d}>Δ</th>,
              ])}
              {['J','L','Δ','J','L','Δ','J','L','Δ'].map((h,i) => (
                <th key={`hs${i}`} style={h==='J'?LS.sh_j:h==='L'?LS.sh_l:LS.sh_d}>{h}</th>
              ))}
              <th></th>
            </tr>
          </thead>

          <tbody>
            {(data.data ?? []).map((row: any, idx: number) => {
              const bg = idx % 2 === 1 ? '#f9fafb' : '#fff';
              const hasLoss = row.totals.totalDiff < -2 && row.totals.totalLiquid > 0;

              return (
                <tr key={row.route.id} className="liq-row"
                  style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {/* Sticky columns */}
                  <td style={{ ...LS.td_no, background: bg }}>{idx+1}</td>
                  <td style={{ ...LS.td_route, background: bg }}>
                    <div style={{ fontWeight: 700, fontSize: 11 }}>{row.route.name}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{row.route.code}</div>
                  </td>
                  <td style={{ ...LS.td_grader, background: bg }}>
                    {row.grader ? (
                      <span style={{ fontSize: 11, color: '#374151' }}>{row.grader.name}</span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#d1d5db' }}>—</span>
                    )}
                  </td>

                  {/* Daily cells */}
                  {days.map(d => {
                    const j    = +(row.journalDays[d] ?? 0);
                    const l    = row.liquidDays[d];   // null = not entered
                    const diff = l !== null ? +(l - j).toFixed(1) : null;
                    const isEd = editing?.routeId === row.route.id && editing?.day === d;

                    return [
                      /* Journal */
                      <td key={`j${d}`} style={LS.td_j}>
                        {j > 0 ? j.toFixed(1) : <span style={{ color: '#e5e7eb' }}>·</span>}
                      </td>,

                      /* Liquid — editable */
                      <td key={`l${d}`} className="liq-l-cell"
                        style={{ ...LS.td_l, background: l !== null ? '#f0fdf4' : bg }}
                        onClick={() => {
                          if (!isEd) {
                            setEditing({ routeId: row.route.id, day: d });
                            setEditVal(l !== null ? String(l) : '');
                          }
                        }}>
                        {isEd ? (
                          <input autoFocus type="number" step="0.1" min="0"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveCell(row.route.id, d);
                              if (e.key === 'Escape') { setEditing(null); }
                            }}
                            onBlur={() => saveCell(row.route.id, d)}
                            style={{ width: 50, border: '2px solid #16a34a', borderRadius: 4,
                              padding: '2px 3px', fontSize: 11, textAlign: 'center' as const,
                              outline: 'none', background: '#fff' }} />
                        ) : l !== null ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{Number(l).toFixed(1)}</span>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: 14, lineHeight: 1 }}>+</span>
                        )}
                      </td>,

                      /* Diff */
                      <td key={`d${d}`} style={{ ...LS.td_d, color: diffColor(diff), fontWeight: diff !== null && Math.abs(diff) > 10 ? 700 : 400 }}>
                        {diff !== null ? diffText(diff) : ''}
                      </td>,
                    ];
                  })}

                  {/* Mid-month totals */}
                  <td style={{ ...LS.td_sum_j, borderLeft: '3px solid #e5e7eb' }}>{row.totals.midJournal > 0 ? row.totals.midJournal : '—'}</td>
                  <td style={LS.td_sum_l}>{row.totals.midLiquid > 0 ? row.totals.midLiquid : '—'}</td>
                  <td style={{ ...LS.td_sum_d, color: diffColor(row.totals.midLiquid > 0 ? row.totals.midDiff : null) }}>
                    {row.totals.midLiquid > 0 ? diffText(row.totals.midDiff) : '—'}
                  </td>

                  {/* End-month totals */}
                  <td style={{ ...LS.td_sum_j, borderLeft: '2px solid #e5e7eb' }}>{row.totals.endJournal > 0 ? row.totals.endJournal : '—'}</td>
                  <td style={LS.td_sum_l}>{row.totals.endLiquid > 0 ? row.totals.endLiquid : '—'}</td>
                  <td style={{ ...LS.td_sum_d, color: diffColor(row.totals.endLiquid > 0 ? row.totals.endDiff : null) }}>
                    {row.totals.endLiquid > 0 ? diffText(row.totals.endDiff) : '—'}
                  </td>

                  {/* Full month totals */}
                  <td style={{ ...LS.td_sum_j, borderLeft: '3px solid #e5e7eb', fontWeight: 800, fontSize: 12 }}>{row.totals.totalJournal > 0 ? row.totals.totalJournal : '—'}</td>
                  <td style={{ ...LS.td_sum_l, fontWeight: 800, fontSize: 12 }}>{row.totals.totalLiquid > 0 ? row.totals.totalLiquid : '—'}</td>
                  <td style={{ ...LS.td_sum_d, fontWeight: 800, fontSize: 12, color: diffColor(row.totals.totalLiquid > 0 ? row.totals.totalDiff : null) }}>
                    {row.totals.totalLiquid > 0 ? diffText(row.totals.totalDiff) : '—'}
                  </td>

                  {/* Charge action */}
                  <td style={{ padding: '4px 6px', borderLeft: '2px solid #e5e7eb', textAlign: 'center' as const, whiteSpace: 'nowrap' as const }}>
                    {hasLoss && (
                      <button onClick={() => {
                        setChargeRow(row);
                        setChargeAmt(Math.abs(row.totals.totalDiff * 10).toFixed(2));
                        setChargeReason('');
                      }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626',
                        borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                        ⚠ Charge
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Grand totals footer */}
          <tfoot>
            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
              <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 800, fontSize: 12,
                position: 'sticky' as const, left: 0, background: '#1e3a5f', zIndex: 2 }}>
                TOTALS ({(data.data ?? []).length} routes)
              </td>
              {days.flatMap(d => {
                const dJ = (data.data ?? []).reduce((s: number, r: any) => s + (r.journalDays[d] ?? 0), 0);
                const dL = (data.data ?? []).reduce((s: number, r: any) => r.liquidDays[d] !== null ? s + r.liquidDays[d] : s, 0);
                const anyL = (data.data ?? []).some((r: any) => r.liquidDays[d] !== null);
                return [
                  <td key={`fj${d}`} style={{ padding: '8px 3px', textAlign: 'center' as const, color: '#93c5fd', fontSize: 10 }}>{dJ>0?dJ.toFixed(0):''}</td>,
                  <td key={`fl${d}`} style={{ padding: '8px 3px', textAlign: 'center' as const, color: '#86efac', fontSize: 10 }}>{anyL?dL.toFixed(0):''}</td>,
                  <td key={`fd${d}`} style={{ padding: '8px 2px' }}></td>,
                ];
              })}
              {/* Mid / End / Total summary */}
              {[
                [(data.data??[]).reduce((s:number,r:any)=>s+r.totals.midJournal,0), (data.data??[]).reduce((s:number,r:any)=>s+r.totals.midLiquid,0)],
                [(data.data??[]).reduce((s:number,r:any)=>s+r.totals.endJournal,0), (data.data??[]).reduce((s:number,r:any)=>s+r.totals.endLiquid,0)],
                [grandJ, grandL],
              ].flatMap(([j,l], gi) => {
                const d = +(l-j).toFixed(1);
                const bl = gi===0?'3px solid rgba(255,255,255,0.3)':gi===2?'3px solid rgba(255,255,255,0.4)':'2px solid rgba(255,255,255,0.2)';
                return [
                  <td key={`gj${gi}`} style={{ padding:'9px 8px', textAlign:'center' as const, color:'#93c5fd', fontWeight:700, borderLeft:bl }}>{fmtL(j)}</td>,
                  <td key={`gl${gi}`} style={{ padding:'9px 8px', textAlign:'center' as const, color:'#86efac', fontWeight:700 }}>{fmtL(l)}</td>,
                  <td key={`gd${gi}`} style={{ padding:'9px 8px', textAlign:'center' as const, fontWeight:800,
                    color: d<-2?'#fca5a5':d>2?'#86efac':'#d1d5db' }}>{l>0?diffText(d):'—'}</td>,
                ];
              })}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Charge modal */}
      {chargeRow && (
        <div style={{ position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.45)',
          zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setChargeRow(null)}>
          <div style={{ background:'#fff', borderRadius:14, width:430,
            boxShadow:'0 20px 60px rgba(0,0,0,0.25)', overflow:'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:'#dc2626', padding:'16px 20px' }}>
              <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>Charge Liquid Loss</div>
              <div style={{ fontSize:12, color:'#fca5a5', marginTop:3 }}>
                {chargeRow.route.name} · {chargeRow.grader?.name ?? 'No grader assigned'}
              </div>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, display:'flex', justifyContent:'space-between' }}>
                <span>Journal: <strong>{fmtL(chargeRow.totals.totalJournal)} L</strong></span>
                <span>Liquid: <strong>{fmtL(chargeRow.totals.totalLiquid)} L</strong></span>
                <span style={{ color:'#dc2626' }}>Loss: <strong>{fmtL(Math.abs(chargeRow.totals.totalDiff))} L</strong></span>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>DEDUCTION AMOUNT (KES) *</label>
                <input style={inp} type="number" step="0.01" value={chargeAmt} onChange={e=>setChargeAmt(e.target.value)} placeholder="0.00" autoFocus />
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                  Suggestion: KES {Math.abs(chargeRow.totals.totalDiff * 10).toFixed(2)} (loss × KES 10/L)
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>REASON (optional)</label>
                <input style={inp} value={chargeReason} onChange={e=>setChargeReason(e.target.value)}
                  placeholder={`Liquid loss — ${MONTHS[month]} ${year}`} />
              </div>
              <div style={{ fontSize:12, color:'#6b7280', background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:16 }}>
                This creates a <strong>variance deduction</strong> against the grader applied at payroll time.
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button style={S.cancelBtn} onClick={()=>setChargeRow(null)}>Cancel</button>
                <button style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:8,
                  padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:charging?0.6:1 }}
                  onClick={doCharge} disabled={charging}>
                  {charging ? 'Applying...' : '⚠ Apply Deduction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Liquid tab styles
const LS: Record<string, React.CSSProperties> = {
  card:     { background:'#fff', border:'1px solid #e5e7eb', borderLeft:'4px solid #1d4ed8', borderRadius:10, padding:'12px 18px', flex:1, minWidth:170 },
  h_no:     { position:'sticky', left:0, zIndex:3, background:'#1e3a5f', color:'#fff', width:28, padding:'8px 4px', textAlign:'center', fontSize:10, fontWeight:700 },
  h_route:  { position:'sticky', left:28, zIndex:3, background:'#1e3a5f', color:'#fff', minWidth:130, padding:'8px 8px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' },
  h_grader: { position:'sticky', left:158, zIndex:3, background:'#1e3a5f', color:'#fff', minWidth:110, padding:'8px 8px', fontSize:10, fontWeight:700, borderRight:'2px solid rgba(255,255,255,0.2)', whiteSpace:'nowrap' },
  h_sum:    { color:'#fff', textAlign:'center', fontSize:10, fontWeight:700, padding:'7px 4px', whiteSpace:'nowrap' },
  sh_j:     { padding:'5px 3px', textAlign:'center', color:'#1d4ed8', fontWeight:700, fontSize:10, background:'#f0f4f8' },
  sh_l:     { padding:'5px 3px', textAlign:'center', color:'#16a34a', fontWeight:700, fontSize:10, background:'#f0f4f8' },
  sh_d:     { padding:'5px 3px', textAlign:'center', color:'#6b7280', fontWeight:600, fontSize:10, background:'#f0f4f8', borderRight:'1px solid #e5e7eb' },
  td_no:    { position:'sticky', left:0, zIndex:1, width:28, padding:'8px 4px', textAlign:'center', color:'#9ca3af', fontSize:11 },
  td_route: { position:'sticky', left:28, zIndex:1, minWidth:130, padding:'7px 8px' },
  td_grader:{ position:'sticky', left:158, zIndex:1, minWidth:110, padding:'7px 8px', borderRight:'2px solid #e5e7eb' },
  td_j:     { padding:'6px 3px', textAlign:'center', color:'#1d4ed8', fontSize:11, whiteSpace:'nowrap' },
  td_l:     { padding:'4px 3px', textAlign:'center', cursor:'pointer', fontSize:11 },
  td_d:     { padding:'6px 3px', textAlign:'center', fontSize:11, borderRight:'1px solid #f3f4f6', whiteSpace:'nowrap' },
  td_sum_j: { padding:'8px 6px', textAlign:'center', color:'#1d4ed8', fontSize:11 },
  td_sum_l: { padding:'8px 6px', textAlign:'center', color:'#16a34a', fontSize:11 },
  td_sum_d: { padding:'8px 6px', textAlign:'center', fontSize:11 },
};


// ══ MAIN PAGE ══════════════════════════════════════════════════
export default function FactoryPage() {
  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const [year, setYear]   = useState(NOW.getFullYear());
  const [tab, setTab]     = useState<Tab>('receipts');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    factoryApi.stats({ month, year }).then(r => setStats(r.data)).catch(() => {});
  }, [month, year]);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'receipts',  label: 'Milk Receipts',   icon: '🥛' },
    { key: 'batches',   label: 'Pasteurization',   icon: '🧪' },
    { key: 'deliveries',label: 'Shop Deliveries',  icon: '🚚' },
    { key: 'liquid',     label: 'Liquid Check',     icon: '🔍' },
  ];

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Factory</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>Receipts · Pasteurization · Deliveries</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={S.sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select style={S.sel} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[NOW.getFullYear()-2, NOW.getFullYear()-1, NOW.getFullYear()].map(y =>
              <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <Stat icon="🥛" label="Received"      value={fmtL(stats.totalReceived) + ' L'}  color="#1d4ed8" />
          <Stat icon="⬆️"  label="Input"         value={fmtL(stats.totalInput) + ' L'}     color="#374151" />
          <Stat icon="⬇️"  label="Output"        value={fmtL(stats.totalOutput) + ' L'}    color="#16a34a" />
          <Stat icon="📉"  label="Loss"          value={fmtL(stats.totalLoss) + ' L'}      color="#dc2626" />
          <Stat icon="📊"  label="Efficiency"    value={stats.efficiencyPct + '%'}
            color={stats.efficiencyPct >= 95 ? '#16a34a' : stats.efficiencyPct >= 90 ? '#f59e0b' : '#dc2626'} />
          <Stat icon="🚚"  label="Delivered"     value={fmtL(stats.totalDelivered) + ' L'} color="#7c3aed" />
          <Stat icon="📦"  label="Undelivered"   value={fmtL(stats.undelivered) + ' L'}
            color={stats.undelivered > 0 ? '#f59e0b' : '#16a34a'} />
          <Stat icon="💰"  label="Revenue"       value={'KES ' + fmt(stats.totalRevenue)}  color="#16a34a" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6',
        borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#1e3a5f' : '#6b7280',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'receipts'   && <ReceiptsTab   month={month} year={year} />}
      {tab === 'batches'    && <BatchesTab    month={month} year={year} />}
      {tab === 'deliveries' && <DeliveriesTab month={month} year={year} />}
      {tab === 'liquid'     && <LiquidTab     month={month} year={year} />}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  sel:       { border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#fff' },
  addBtn:    { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  saveBtn:   { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  cancelBtn: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  delBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, opacity: 0.6 },
  table:     { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  thead:     { background: '#1e3a5f', color: '#fff' },
  th:        { padding: '10px 12px', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const },
  tr:        { borderBottom: '1px solid #f3f4f6' },
  td:        { padding: '10px 12px', verticalAlign: 'middle' as const },
  badge:     { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 },
  err:       { background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 },
  empty:     { textAlign: 'center' as const, padding: 50, color: '#9ca3af' },
  loadBar:   { height: 3, background: '#e5e7eb', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  loadFill:   { height: '100%', width: '50%', background: '#1e3a5f', borderRadius: 2, animation: 'slideBar 1s ease-in-out infinite alternate' },
  liquidCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 200 },
  excelBtn:   { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
};
