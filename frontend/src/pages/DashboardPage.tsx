import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { format } from 'date-fns';
import { RefreshCw, CheckCircle, AlertTriangle, TrendingUp, Users, Milk, Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function DashboardPage() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard'),
    staleTime: 0,
    refetchInterval: 30_000,  // auto-refresh every 30s
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const d = dashData?.data;

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['dashboard'] });
    setRefreshing(false);
  }

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="text-center text-gray-400">
        <Milk size={40} className="mx-auto mb-3 animate-pulse opacity-40" />
        <div>Loading dashboard...</div>
      </div>
    </div>
  );

  const rec    = d?.reconciliation;
  const pay    = d?.paymentReadiness;
  const routes: any[] = d?.routeStatus || [];
  const today  = format(new Date(), 'EEEE, d MMMM yyyy');
  const month  = d?.month || new Date().getMonth() + 1;
  const year   = d?.year  || new Date().getFullYear();

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Good {getGreeting()}, Gutoria 🌿</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{today}</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 border border-green-300 dark:border-green-700 rounded-xl text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── PAYMENT READINESS ALERTS ── */}
      {pay && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PaymentReadinessCard
            label="Mid-Month Payments"
            sublabel={`1–15 ${MONTHS[month-1]} ${year}`}
            data={pay.mid}
            isMid={true}
          />
          <PaymentReadinessCard
            label="End-Month Payments"
            sublabel={`Full ${MONTHS[month-1]} ${year}`}
            data={pay.end}
            isMid={false}
          />
        </div>
      )}

      {/* ── DAILY RECONCILIATION ── */}
      {rec && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${rec.isBalanced ? 'bg-green-500' : 'bg-orange-400'}`} />
              <h2 className="font-bold text-gray-800 dark:text-gray-100">Today's Reconciliation</h2>
            </div>
            <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              rec.isBalanced
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            }`}>
              {rec.isBalanced ? '✓ Balanced' : '⚠ Check variance'}
            </div>
          </div>

          {/* The 4-step flow */}
          <div className="p-5">
            <div className="flex flex-wrap gap-3 items-center">
              <FlowStep
                icon="🐄" label="Collected by Graders"
                value={`${rec.collectedLitres.toFixed(1)} L`}
                sub={`${rec.routesReported}/${rec.routesTotal} routes reported`}
                color="blue"
              />
              <FlowArrow diff={rec.collVsReceived} label="collection vs factory" />
              <FlowStep
                icon="🏭" label="Received at Factory"
                value={`${rec.receivedLitres.toFixed(1)} L`}
                sub="Pasteurization input"
                color="purple"
              />
              <FlowArrow diff={0} label="" noAlert />
              <FlowStep
                icon="🛵" label="Delivered to Shops"
                value={`${rec.deliveredLitres.toFixed(1)} L`}
                sub="Shop drops today"
                color="orange"
              />
              <FlowArrow diff={rec.delivVsSold} label="delivered vs sold" />
              <FlowStep
                icon="🛒" label="Sold at Shops"
                value={`${rec.soldLitres.toFixed(1)} L`}
                sub={`KES ${Number(rec.revenueToday).toLocaleString()} revenue`}
                color="green"
              />
            </div>

            {/* Variance notes */}
            {Math.abs(rec.collVsReceived) > 1 && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-700">
                <AlertTriangle size={14} className="text-orange-500 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  <strong>Variance alert:</strong> Factory received {Math.abs(rec.collVsReceived).toFixed(1)} L {rec.collVsReceived > 0 ? 'more' : 'less'} than graders collected.
                  {rec.collVsReceived < 0 ? ' Check for un-synced grader records or missing factory entries.' : ' Could be measurement differences — review liquid check.'}
                </p>
              </div>
            )}
            {rec.delivVsSold > 20 && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
                <AlertTriangle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  <strong>{rec.delivVsSold.toFixed(1)} L unsold</strong> sitting in shops today. Shopkeepers may not have recorded all sales, or stock is carrying over to tomorrow.
                </p>
              </div>
            )}
            {rec.routesReported < rec.routesTotal && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                <AlertTriangle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>{rec.routesTotal - rec.routesReported} routes</strong> have not synced collections yet today.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ROUTE STATUS TODAY ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b dark:border-gray-700">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">Route Activity Today</h2>
        </div>
        {routes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No collections yet today</div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {routes.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${r.reported ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className={`text-sm ${r.reported ? 'text-gray-800 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                    {r.name}
                  </span>
                </div>
                {r.reported ? (
                  <span className="font-mono text-sm font-bold text-green-700 dark:text-green-400">
                    {r.litres.toFixed(1)} L
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Not reported</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FARMERS OVERVIEW ── */}
      {d?.farmers && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Active Farmers', value: d.farmers.total, icon: Users, color: 'blue' },
            { label: 'Paid Mid + End Month', value: d.farmers.midMonth, icon: TrendingUp, color: 'green' },
            { label: 'Paid End Month Only', value: d.farmers.endOnly, icon: Users, color: 'gray' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <s.icon size={20} className={`mb-3 ${s.color === 'blue' ? 'text-blue-500' : s.color === 'green' ? 'text-green-500' : 'text-gray-400'}`} />
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{s.value.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Payment Readiness Card ────────────────────────────────────────────────────
function PaymentReadinessCard({ label, sublabel, data, isMid }: any) {
  if (!data) return null;

  // Status logic
  const statusColor = data.alreadyPaid
    ? 'border-gray-200 dark:border-gray-700'
    : data.approved?.count > 0
    ? 'border-blue-300 dark:border-blue-700'
    : data.pending?.count > 0
    ? 'border-yellow-300 dark:border-yellow-600'
    : data.ready
    ? 'border-green-300 dark:border-green-700'
    : 'border-gray-200 dark:border-gray-700';

  const statusBg = data.alreadyPaid
    ? 'bg-gray-50 dark:bg-gray-800/50'
    : data.approved?.count > 0
    ? 'bg-blue-50 dark:bg-blue-900/20'
    : data.pending?.count > 0
    ? 'bg-yellow-50 dark:bg-yellow-900/20'
    : data.ready
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-white dark:bg-gray-900';

  const badge = data.alreadyPaid
    ? { text: '✅ Paid', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' }
    : data.approved?.count > 0
    ? { text: `⏳ ${data.approved.count} Approved — Ready to Disburse`, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
    : data.pending?.count > 0
    ? { text: `📋 ${data.pending.count} Pending Approval`, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
    : data.ready
    ? { text: '🟢 Ready to Compute', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
    : { text: 'Not yet due', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };

  return (
    <div className={`rounded-2xl border ${statusColor} ${statusBg} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-gray-800 dark:text-gray-100">{label}</div>
          <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.color}`}>{badge.text}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs text-gray-400">Farmers with milk</div>
          <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{data.farmersWithCollections.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Total litres</div>
          <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{Number(data.totalLitres).toLocaleString()} L</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Est. gross pay</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-400">KES {Number(data.estimatedGross).toLocaleString()}</div>
        </div>
        {data.approved && (
          <div>
            <div className="text-xs text-gray-400">Approved amount</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">KES {Number(data.approved.amount).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Action button */}
      {!data.alreadyPaid && (
        <div className="flex gap-2">
          {data.approved?.count > 0 ? (
            <Link to="/disbursement"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              <Send size={14} /> Go to Disbursement →
            </Link>
          ) : (
            <Link to="/payments"
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                data.ready
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
              <TrendingUp size={14} />
              {data.pending?.count > 0 ? 'Review & Approve →' : data.ready ? 'Process Payments →' : 'Payments →'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Flow step widget ──────────────────────────────────────────────────────────
function FlowStep({ icon, label, value, sub, color }: any) {
  const colors: any = {
    blue:   'bg-blue-50   dark:bg-blue-900/20   border-blue-200   dark:border-blue-700   text-blue-700   dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400',
    green:  'bg-green-50  dark:bg-green-900/20  border-green-200  dark:border-green-700  text-green-700  dark:text-green-400',
  };
  return (
    <div className={`flex-1 min-w-[120px] rounded-xl border p-3 ${colors[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-70">{sub}</div>
    </div>
  );
}

function FlowArrow({ diff, label, noAlert }: { diff: number; label: string; noAlert?: boolean }) {
  const ok = noAlert || Math.abs(diff) < 1;
  return (
    <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
      <div className={`text-xl font-light ${!ok ? 'text-orange-400' : ''}`}>→</div>
      {!noAlert && !ok && (
        <div className="text-[10px] text-orange-500 text-center max-w-[60px]">
          {diff > 0 ? `+${diff.toFixed(1)}L` : `${diff.toFixed(1)}L`}
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
