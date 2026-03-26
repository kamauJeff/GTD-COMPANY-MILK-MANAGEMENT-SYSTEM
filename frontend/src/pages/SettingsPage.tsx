import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { showSuccess, showError } from '../components/Toast';
import { RefreshCw, Bell, TrendingUp, MessageSquare, Save, Plus, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'sms'|'tiers'|'alerts'>('sms');

  // SMS config
  const { data: smsConfig, isLoading: smsLoading, refetch: refetchSms } = useQuery({
    queryKey: ['sms-config'],
    queryFn: () => api.get('/api/notifications/config'),
    staleTime: 0,
  });
  const cfg = smsConfig?.data;

  // Price tiers
  const { data: tiersData, isLoading: tiersLoading, refetch: refetchTiers } = useQuery({
    queryKey: ['price-tiers'],
    queryFn: () => api.get('/api/price-tiers'),
    staleTime: 0,
  });
  const [tiers, setTiers] = useState<any[]>([]);
  const [tiersInit, setTiersInit] = useState(false);
  if (tiersData?.data && !tiersInit) { setTiers(tiersData.data); setTiersInit(true); }

  // SMS state
  const [smsMonth, setSmsMonth] = useState(new Date().getMonth() + 1);
  const [smsYear, setSmsYear] = useState(new Date().getFullYear());
  const [smsMid, setSmsMid] = useState(false);
  const [sending, setSending] = useState(false);

  // Variance alert state
  const [alertPhone, setAlertPhone] = useState('');

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Send payment SMS
  async function sendPaymentSMS() {
    setSending(true);
    try {
      const r = await api.post('/api/notifications/payment-sms', { month: smsMonth, year: smsYear, isMidMonth: smsMid });
      showSuccess(`✅ ${r.data.message}`);
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Failed to send SMS');
    }
    setSending(false);
  }

  // Save price tiers
  const saveTiersMut = useMutation({
    mutationFn: () => api.post('/api/price-tiers', { tiers }),
    onSuccess: () => { showSuccess('Price tiers saved'); refetchTiers(); setTiersInit(false); },
    onError: (e: any) => showError(e?.response?.data?.error || 'Failed'),
  });

  const addTier = () => {
    setTiers(t => [...t, { minLitresPerDay: 0, maxLitresPerDay: 999, pricePerLitre: 50 }]);
  };
  const removeTier = (i: number) => setTiers(t => t.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: string, val: string) => {
    setTiers(t => t.map((tier, idx) => idx === i ? { ...tier, [field]: Number(val) } : tier));
  };

  const tabs = [
    { id: 'sms',    label: 'SMS Notifications', icon: MessageSquare },
    { id: 'tiers',  label: 'Price Tiers',        icon: TrendingUp },
    { id: 'alerts', label: 'Variance Alerts',    icon: Bell },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">System Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">SMS notifications · Price tiers · Alerts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* SMS Tab */}
      {tab === 'sms' && (
        <div className="space-y-5">
          {/* Config status */}
          <div className={`rounded-2xl border p-5 ${cfg?.configured ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-700' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${cfg?.configured ? 'bg-green-100 dark:bg-green-900/40' : 'bg-yellow-100 dark:bg-yellow-900/40'}`}>
                {cfg?.configured ? '✅' : '⚙️'}
              </div>
              <div>
                <div className="font-bold text-gray-800 dark:text-gray-100">
                  Africa's Talking SMS — {cfg?.configured ? 'Connected' : 'Not configured'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {cfg?.configured
                    ? `Username: ${cfg.username} · Sender: ${cfg.senderId} · Mode: ${cfg.mode}`
                    : 'Add your Africa\'s Talking credentials to Railway environment variables to enable real SMS'}
                </div>
                {!cfg?.configured && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-yellow-200 dark:border-yellow-700 text-xs font-mono text-gray-600 dark:text-gray-300 space-y-1">
                    <div>AT_API_KEY=your_api_key_from_africastalking.com</div>
                    <div>AT_USERNAME=your_username</div>
                    <div>AT_SENDER_ID=GUTORIA</div>
                    <div>MANAGER_PHONE=254XXXXXXXXX</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Send payment SMS */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-green-600" />
              Send Payment Notifications
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              After disbursement, send each farmer an SMS confirming their net pay, gross, and deductions.
              {!cfg?.configured && <span className="text-yellow-600 dark:text-yellow-400"> (Will simulate — add AT credentials to send real SMS)</span>}
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={smsMonth} onChange={e => setSmsMonth(Number(e.target.value))}
                className="px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={smsYear} onChange={e => setSmsYear(Number(e.target.value))}
                className="px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
              </select>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                <button onClick={() => setSmsMid(true)} className={`px-4 py-2.5 text-sm font-medium ${smsMid ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>Mid Month</button>
                <button onClick={() => setSmsMid(false)} className={`px-4 py-2.5 text-sm font-medium border-l dark:border-gray-600 ${!smsMid ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>End Month</button>
              </div>
            </div>
            <button onClick={sendPaymentSMS} disabled={sending}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 text-sm">
              <MessageSquare size={14} />
              {sending ? 'Sending...' : `Send Payment SMS — ${MONTHS[smsMonth-1]} ${smsYear} (${smsMid ? 'Mid' : 'End'})`}
            </button>
          </div>

          {/* SMS preview */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 text-sm">Message Preview</h3>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-300 font-mono border border-gray-200 dark:border-gray-700">
              Gutoria Dairies: KES 1,400 paid for end-month Mar 2026.<br />
              Net Pay: KES 1,400<br />
              Gross: KES 1,500 | Deductions: KES 100<br />
              Queries: 0700 000 000
            </div>
          </div>
        </div>
      )}

      {/* Price Tiers Tab */}
      {tab === 'tiers' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600" />
                  Price Tiers by Daily Volume
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Higher daily delivery = higher price per litre. Applied automatically at payment time.
                </p>
              </div>
              <button onClick={() => refetchTiers()}
                className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <RefreshCw size={14} />
              </button>
            </div>

            {tiersLoading ? (
              <div className="text-center py-8 text-gray-400">Loading tiers...</div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {tiers.map((tier, i) => (
                    <div key={i} className="flex gap-3 items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block">Min L/day</label>
                          <input type="number" value={tier.minLitresPerDay}
                            onChange={e => updateTier(i, 'minLitresPerDay', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded-lg text-sm font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block">Max L/day</label>
                          <input type="number" value={tier.maxLitresPerDay}
                            onChange={e => updateTier(i, 'maxLitresPerDay', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded-lg text-sm font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block">KES/Litre</label>
                          <input type="number" value={tier.pricePerLitre}
                            onChange={e => updateTier(i, 'pricePerLitre', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded-lg text-sm font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 text-green-600 font-bold" />
                        </div>
                      </div>
                      <button onClick={() => removeTier(i)}
                        className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={addTier}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Plus size={14} /> Add Tier
                  </button>
                  <button onClick={() => saveTiersMut.mutate()} disabled={saveTiersMut.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    <Save size={14} />
                    {saveTiersMut.isPending ? 'Saving...' : 'Save Tiers'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-700 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>How it works:</strong> At payment time, the system checks each farmer's average daily litres
              for the period and applies the matching tier price. Farmers delivering more milk earn more per litre —
              rewarding consistent high-volume suppliers automatically.
            </p>
          </div>
        </div>
      )}

      {/* Variance Alerts Tab */}
      {tab === 'alerts' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Bell size={16} className="text-orange-500" />
              Variance Alert Configuration
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              When today's collection vs factory received differs by more than 1L, automatically SMS the manager.
              This catches theft or recording errors the same day.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Manager Phone Number</label>
                <div className="flex gap-3">
                  <input value={alertPhone} onChange={e => setAlertPhone(e.target.value)}
                    placeholder="254XXXXXXXXX"
                    className="flex-1 px-3 py-2.5 border rounded-xl text-sm font-mono dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  <button
                    onClick={async () => {
                      try {
                        await api.post('/api/notifications/variance-alert', {
                          date: new Date().toISOString().split('T')[0],
                          collectedLitres: 500, receivedLitres: 485,
                          routesReported: 28, routesTotal: 29,
                          managerPhone: alertPhone,
                        });
                        showSuccess('Test alert sent!');
                      } catch { showError('Failed'); }
                    }}
                    disabled={!alertPhone}
                    className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    Test Alert
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Or set permanently via Railway env: <span className="font-mono">MANAGER_PHONE=254XXXXXXXXX</span>
                </p>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-700">
                <div className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-2">Alert Message Preview</div>
                <div className="text-xs font-mono text-orange-700 dark:text-orange-300 space-y-0.5">
                  <div>Gutoria Dairies ALERT 2026-03-25:</div>
                  <div>Factory received 15.0L less than graders collected.</div>
                  <div>Collected: 500.0L | Received: 485.0L</div>
                  <div>Routes reported: 28/29</div>
                  <div>Please investigate.</div>
                </div>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                <strong>Integration tip:</strong> The daily reconciliation on the Dashboard automatically
                shows the variance. Connect this to your morning workflow — if the dashboard shows a red variance,
                send the alert before graders leave the route.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
