// src/pages/RoutesPage.tsx
import { useQuery } from '@tanstack/react-query';
import { routesApi } from '../api/client';

export default function RoutesPage() {
  const { data } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });
  const routes: any[] = data?.data ?? [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Routes</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {routes.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border p-5">
            <div className="font-mono text-xs text-gray-400 mb-1">{r.code}</div>
            <div className="font-semibold text-gray-800">{r.name}</div>
            {r.supervisor && <div className="text-sm text-gray-500 mt-1">Supervisor: {r.supervisor.name}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

