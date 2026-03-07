// src/components/DisbursementPanel.tsx
import { useState, useEffect } from 'react';
import { paymentsApi } from '../api/client';

// ── Types ──────────────────────────────────────────────────────
interface FarmerResult {
  id: number; name: string; code: string; routeName: string;
  paymentMethod: string; phone: string; normalisedPhone?: string;
  bankName?: string; bankAccount?: string;
  litres: number; gross: number; adv: number; netPay: number;
  canPay: boolean; isMpesa: boolean; isBank: boolean; phoneValid: boolean;
}
interface BankGroup {
  bank: string; count: number; amount: number; farmers: FarmerResult[];
}
interface Preview {
  period: string; isMidMonth: boolean;
  summary: {
    total: number; mpesa: number; mpesaAmount: number;
    bank: number; bankAmount: number; totalAmount: number; phoneErrors: number;
  };
  mpesa: FarmerResult[];
  banks: BankGroup[];
}

interface Props {
  month: number; year: number;
  onClose: () => void;
}

const fmtC = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BANK_COLORS: Record<string, string> = {
  EQUITY: '#8B0000', KCB: '#006633', 'CO-OP': '#004080',
  FAMILY: '#5B2C8C', FARIJI: '#0070C0', 'K-UNITY': '#C55A11', TAI: '#1F5C1F',
};

export default function DisbursementPanel({ month, year, onClose }: Props) {
  const [isMidMonth, setIsMidMonth] = useState(false);
  const [preview, setPreview]       = useState<Preview | null>(null);
  const [loading, setLoading]       = useState(false);
  const [disbursing, setDisbursing] = useState(false);
  const [step, setStep]             = useState<'preview' | 'confirm' | 'done'>('preview');
  const [results, setResults]       = useState<any>(null);
  const [activeTab, setActiveTab]   = useState<'mpesa' | 'bank'>('mpesa');

  async function loadPreview() {
    setLoading(true);
    try {
      const r = await paymentsApi.previewDisbursement({ month, year, isMidMonth });
      setPreview(r.data);
      setStep('preview');
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Failed to load preview');
    } finally { setLoading(false); }
  }

  useEffect(() => { loadPreview(); }, [isMidMonth]);

  async function runMpesaDisbursement() {
    if (!preview) return;
    setDisbursing(true);
    try {
      const r = await paymentsApi.disburseMpesa({ month, year, isMidMonth });
      setResults(r.data);
      setStep('done');
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Disbursement failed');
    } finally { setDisbursing(false); }
  }

  async function downloadRemittance() {
    const params = new URLSearchParams({ month: String(month), year: String(year), isMidMonth: String(isMidMonth) });
    window.open(`/api/disbursements/remittance?${params}`, '_blank');
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>💸 Disburse Payments</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>KopoKopo M-Pesa · Bank Remittance Export</div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Period toggle */}
        <div style={S.periodBar}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Payment period:</span>
          <div style={S.toggle}>
            <button style={{ ...S.toggleBtn, ...(isMidMonth ? S.toggleActive : {}) }}
              onClick={() => setIsMidMonth(true)}>Mid Month (15th)</button>
            <button style={{ ...S.toggleBtn, ...(!isMidMonth ? S.toggleActive : {}) }}
              onClick={() => setIsMidMonth(false)}>End Month</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={S.spinner} />
          </div>
        ) : preview && (
          <>
            {/* Summary cards */}
            <div style={S.cards}>
              <div style={S.card}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>
                  KES {fmtC(preview.summary.totalAmount)}
                </div>
                <div style={S.cardLabel}>Total to disburse</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {preview.summary.total} farmers
                </div>
              </div>
              <div style={{ ...S.card, borderColor: '#86efac' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>
                  KES {fmtC(preview.summary.mpesaAmount)}
                </div>
                <div style={S.cardLabel}>M-Pesa (KopoKopo)</div>
                <div style={{ fontSize: 11, color: preview.summary.phoneErrors > 0 ? '#dc2626' : '#6b7280', marginTop: 2 }}>
                  {preview.summary.mpesa} farmers
                  {preview.summary.phoneErrors > 0 && ` · ⚠️ ${preview.summary.phoneErrors} invalid phones`}
                </div>
              </div>
              <div style={{ ...S.card, borderColor: '#93c5fd' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>
                  KES {fmtC(preview.summary.bankAmount)}
                </div>
                <div style={S.cardLabel}>Bank / SACCO</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {preview.summary.bank} farmers
                </div>
              </div>
            </div>

            {step === 'done' && results ? (
              /* Results view */
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, color: '#15803d', fontSize: 15 }}>✓ Disbursement initiated</div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>
                    {results.successful} of {results.processed} sent · {results.failed} failed
                  </div>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
                  {results.results.map((r: any) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                      <span style={{ color: '#6b7280' }}>{r.phone}</span>
                      <span style={{ fontWeight: 700 }}>KES {fmtC(r.amount ?? 0)}</span>
                      <span style={{ color: r.status === 'PROCESSING' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{r.status}</span>
                    </div>
                  ))}
                </div>
                <button style={{ ...S.primaryBtn, marginTop: 16 }} onClick={() => setStep('preview')}>← Back</button>
              </div>
            ) : step === 'confirm' ? (
              /* Confirm view */
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: '#c2410c' }}>⚠️ Confirm M-Pesa Disbursement</div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
                    You are about to send <strong>KES {fmtC(preview.summary.mpesaAmount)}</strong> to{' '}
                    <strong>{preview.summary.mpesa} farmers</strong> via KopoKopo.
                    This action cannot be undone.
                  </div>
                  {preview.summary.phoneErrors > 0 && (
                    <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>
                      ⚠️ {preview.summary.phoneErrors} farmers have invalid phone numbers and will be skipped.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={S.cancelBtn} onClick={() => setStep('preview')}>Cancel</button>
                  <button style={{ ...S.primaryBtn, background: '#dc2626', opacity: disbursing ? 0.6 : 1 }}
                    onClick={runMpesaDisbursement} disabled={disbursing}>
                    {disbursing ? 'Sending...' : `✓ Send KES ${fmtC(preview.summary.mpesaAmount)}`}
                  </button>
                </div>
              </div>
            ) : (
              /* Main preview */
              <div style={{ padding: '0 20px 20px' }}>
                {/* Tabs */}
                <div style={S.tabs}>
                  <button style={{ ...S.tab, ...(activeTab === 'mpesa' ? S.tabActive : {}) }}
                    onClick={() => setActiveTab('mpesa')}>
                    📱 M-Pesa ({preview.mpesa.length})
                  </button>
                  <button style={{ ...S.tab, ...(activeTab === 'bank' ? S.tabActive : {}) }}
                    onClick={() => setActiveTab('bank')}>
                    🏦 Bank / SACCO ({preview.banks.reduce((s, b) => s + b.count, 0)})
                  </button>
                </div>

                {/* M-Pesa tab */}
                {activeTab === 'mpesa' && (
                  <>
                    <div style={S.tableWrap}>
                      <table style={S.table}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={S.th}>Farmer</th>
                            <th style={S.th}>Route</th>
                            <th style={S.th}>Phone</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Net Pay</th>
                            <th style={S.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.mpesa.map((f, i) => (
                            <tr key={f.id} style={{ background: i % 2 === 1 ? '#f9fafb' : '#fff' }}>
                              <td style={S.td}>
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{f.name}</div>
                                <div style={{ fontSize: 10, color: '#9ca3af' }}>{f.code}</div>
                              </td>
                              <td style={{ ...S.td, fontSize: 11, color: '#6b7280' }}>{f.routeName}</td>
                              <td style={{ ...S.td, fontSize: 11 }}>
                                {f.normalisedPhone
                                  ? <span style={{ color: '#16a34a' }}>✓ {f.normalisedPhone}</span>
                                  : <span style={{ color: '#dc2626' }}>⚠ {f.phone}</span>}
                              </td>
                              <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                {fmtC(f.netPay)}
                              </td>
                              <td style={{ ...S.td, fontSize: 11 }}>
                                {f.phoneValid
                                  ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Ready</span>
                                  : <span style={{ color: '#dc2626', fontWeight: 600 }}>Invalid phone</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button style={{ ...S.primaryBtn, marginTop: 14 }}
                      onClick={() => setStep('confirm')}
                      disabled={preview.summary.mpesa === 0}>
                      🚀 Disburse via KopoKopo — KES {fmtC(preview.summary.mpesaAmount)}
                    </button>
                  </>
                )}

                {/* Bank tab */}
                {activeTab === 'bank' && (
                  <>
                    {preview.banks.map(group => (
                      <div key={group.bank} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ background: BANK_COLORS[group.bank] ?? '#374151', color: '#fff', borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 800 }}>
                            {group.bank}
                          </span>
                          <span style={{ fontSize: 13, color: '#374151' }}>{group.count} farmers</span>
                          <span style={{ fontWeight: 800, color: '#1d4ed8', marginLeft: 'auto' }}>KES {fmtC(group.amount)}</span>
                        </div>
                        <div style={S.tableWrap}>
                          <table style={S.table}>
                            <thead>
                              <tr style={{ background: '#f9fafb' }}>
                                <th style={S.th}>Farmer</th>
                                <th style={S.th}>Account No.</th>
                                <th style={{ ...S.th, textAlign: 'right' }}>Net Pay (KES)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.farmers.map((f, i) => (
                                <tr key={f.id} style={{ background: i % 2 === 1 ? '#f9fafb' : '#fff' }}>
                                  <td style={S.td}>
                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{f.name}</div>
                                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{f.routeName}</div>
                                  </td>
                                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>
                                    {f.bankAccount || <span style={{ color: '#dc2626' }}>⚠ Missing</span>}
                                  </td>
                                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmtC(f.netPay)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}

                    <button style={{ ...S.primaryBtn, background: '#1d4ed8', marginTop: 8 }} onClick={downloadRemittance}>
                      ⬇ Download Remittance Excel (All Banks)
                    </button>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                      Opens an Excel file with one sheet per bank/SACCO. Upload each sheet to your respective bank's bulk payment portal.
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' },
  panel:       { background: '#fff', width: '100%', maxWidth: 680, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', overflowY: 'auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' },
  closeBtn:    { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' },
  periodBar:   { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', background: '#f1f5f9', borderBottom: '1px solid #e5e7eb' },
  toggle:      { display: 'flex', background: '#e5e7eb', borderRadius: 8, padding: 3, gap: 2 },
  toggleBtn:   { border: 'none', background: 'transparent', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6b7280' },
  toggleActive:{ background: '#fff', color: '#1e3a5f', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  cards:       { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '14px 20px' },
  card:        { background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' },
  cardLabel:   { fontSize: 11, color: '#6b7280', fontWeight: 600, marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  tabs:        { display: 'flex', background: '#f3f4f6', borderRadius: 9, padding: 3, marginBottom: 14, width: 'fit-content' },
  tab:         { border: 'none', background: 'transparent', borderRadius: 7, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280' },
  tabActive:   { background: '#fff', color: '#1e3a5f', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  tableWrap:   { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 280, overflowY: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:          { padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td:          { padding: '8px 10px', borderBottom: '1px solid #f3f4f6' },
  primaryBtn:  { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%' },
  cancelBtn:   { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 9, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', flex: 1 },
  spinner:     { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};
