// src/pages/DashboardPage.tsx
import { useQuery } from '@tanstack/react-query';
import { collectionsApi, farmersApi, routesApi } from '../api/client';
import { format } from 'date-fns';

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: totals } = useQuery({ queryKey: ['daily-totals', today], queryFn: () => collectionsApi.dailyTotals(today) });
  const { data: farmers } = useQuery({ queryKey: ['farmers-count'], queryFn: () => farmersApi.list({ limit: 1 }) });
  const { data: routes } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });

  const routeData: any[] = totals?.data ?? [];
  const totalLitres = routeData.reduce((s: number, r: any) => s + Number(r.totalLitres), 0);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Today's Milk" value={`${totalLitres.toFixed(0)}L`} color="green" />
        <StatCard label="Active Farmers" value={farmers?.data?.total ?? 'â€“'} color="blue" />
        <StatCard label="Active Routes" value={routes?.data?.length ?? 'â€“'} color="purple" />
        <StatCard label="Routes Reporting" value={routeData.length} color="orange" />
      </div>

      {/* Route totals table */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Today's Route Totals</h2>
        {routeData.length === 0 ? (
          <p className="text-sm text-gray-400">No collections recorded yet today.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Route</th><th className="pb-2">Farmers</th><th className="pb-2 text-right">Litres</th>
            </tr></thead>
            <tbody>
              {routeData.map((r: any) => (
                <tr key={r.route?.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.route?.name}</td>
                  <td className="py-2 text-gray-500">{r.farmerCount}</td>
                  <td className="py-2 text-right font-mono font-semibold text-green-700">{Number(r.totalLitres).toFixed(1)}L</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700', orange: 'bg-orange-50 text-orange-700',
  };
  return (
    <div className={`rounded-xl p-5 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-75">{label}</div>
    </div>
  );
}

