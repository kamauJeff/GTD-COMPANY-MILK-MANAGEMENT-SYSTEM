import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectionsApi, routesApi, api } from '../api/client';
import { Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CollectionsPage() {
  const now = new Date();
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [routeId, setRouteId] = useState('');
  const [search, setSearch]   = useState('');

  const { data: routesData } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });
  const routes: any[] = routesData?.data ?? [];

  const { data: gridData, isLoading } = useQuery({
    queryKey: ['collection-journal', month, year, routeId],
    queryFn: () => collectionsApi.journalFull({ month, year, routeId: routeId || undefined }),
  });

  const grid        = gridData?.data;
  const farmers: any[]                    = grid?.farmers ?? [];
  const dayTotals: Record<number,number>  = grid?.dayTotals ?? {};
  const daysInMonth: number               = grid?.daysInMonth ?? new Date(year, month, 0).getDate();
  const grandTotal: number                = grid?.grandTotal ?? 0;
  const grandMoney: number                = grid?.grandMoney ?? 0;
  const advanceDates: number[]            = grid?.advanceDates ?? [5,10,15,20,25];
  const days    = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const midDays = days.filter(d => d <= 15);
  const endDays = days.filter(d => d > 15);

  const filtered = search
    ? farmers.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase()))
    : farmers;

  // Per-farmer computations matching Excel structure
  const getTotal15 = (f: any) => midDays.reduce((s, d) => s + (f.days[d] || 0), 0);
  const getTotalLitres = (f: any) => days.reduce((s, d) => s + (f.days[d] || 0), 0);
  const getTotalMoney = (f: any, pricePerLitre = 46) => getTotalLitres(f) * pricePerLitre;

  const handleExport = async () => {
    try {
      const res = await api.get('/api/collections/export', {
        params: { month, year, routeId: routeId || undefined },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `collections-${MONTHS[month-1]}-${year}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  // Day column total
  const getDayTotal = (day: number) => filtered.reduce((s, f) => s + (f.days[day] || 0), 0);
  const getMid15Total = () => filtered.reduce((s, f) => s + getTotal15(f), 0);
  const getGrandTotal = () => filtered.reduce((s, f) => s + getTotalLitres(f), 0);
  const getGrandMoney = () => filtered.reduce((s, f) => s + getTotalMoney(f), 0);

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Milk Collections Journal</h1>
          <p className="text-sm text-gray-500">{MONTHS[month-1]} {year} · {filtered.length} farmers · {getGrandTotal().toFixed(1)} L</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={routeId} onChange={e => setRouteId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[160px]">
          <option value="">All Routes</option>
          {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search farmer..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-44" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400">Farmers</div>
          <div className="text-xl font-bold text-gray-800">{filtered.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400">Total Litres (TL)</div>
          <div className="text-xl font-bold text-green-700">{getGrandTotal().toFixed(1)} L</div>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400">Mid-Month (1–15)</div>
          <div className="text-xl font-bold text-purple-700">{getMid15Total().toFixed(1)} L</div>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400">Total Money (TM)</div>
          <div className="text-xl font-bold text-blue-700">KES {getGrandMoney().toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <div className="text-xs text-gray-400">Total Advances</div>
          <div className="text-xl font-bold text-orange-600">KES {filtered.reduce((s,f) => s + (f.totalAdvances||0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Journal Grid */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading journal...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🥛</div>
            <div className="font-medium">No collections found</div>
            <div className="text-sm mt-1">Select a route or check mobile app sync</div>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <table className="text-xs border-collapse"
              style={{ minWidth: `${60 + 160 + daysInMonth * 38 + 80 + 80 + 80}px` }}>

              {/* Sticky header */}
              <thead className="sticky top-0 z-30">
                {/* Row 1: section groups */}
                <tr className="bg-gray-900 text-white text-center">
                  <th className="sticky left-0 bg-gray-900 z-40 px-2 py-1.5 text-left min-w-[55px]" rowSpan={2}>M.NO</th>
                  <th className="sticky left-[55px] bg-gray-900 z-40 px-2 py-1.5 text-left min-w-[150px] border-r border-gray-700" rowSpan={2}>FARMER NAME</th>
                  <th className="bg-blue-800 px-1 py-1 border-r border-blue-700 text-xs" colSpan={15}>1st – 15th</th>
                  <th className="bg-purple-800 px-1 py-1 border-r border-purple-700 text-xs" rowSpan={2}>Total<br/>15th</th>
                  <th className="bg-blue-900 px-1 py-1 border-r border-blue-800 text-xs" colSpan={daysInMonth - 15}>16th – {daysInMonth}th</th>
                  <th className="bg-green-800 px-2 py-1 border-r border-green-700 text-xs" rowSpan={2}>TL</th>
                  <th className="bg-green-900 px-2 py-1 border-r border-green-700 text-xs" rowSpan={2}>TM</th>
                  <th className="bg-orange-800 px-1 py-1 border-r border-orange-700 text-xs" rowSpan={2}>B/f</th>
                  <th className="bg-orange-700 px-1 py-1 border-r border-orange-600 text-xs" colSpan={5}>ADVANCES</th>
                  <th className="bg-orange-900 px-2 py-1 border-r text-xs" rowSpan={2}>Total<br/>Adv</th>
                  <th className="bg-teal-800 sticky right-0 px-2 py-1 text-xs" rowSpan={2}>Amt<br/>Payable</th>
                </tr>
                {/* Row 2: day numbers */}
                <tr className="bg-gray-800 text-white">
                  {midDays.map(d => (
                    <th key={d} className={`px-0.5 py-1.5 text-center w-9 font-medium ${(dayTotals[d] || 0) > 0 ? 'text-green-300' : 'text-gray-500'}`}>{d}</th>
                  ))}
                  {endDays.map(d => (
                    <th key={d} className={`px-0.5 py-1.5 text-center w-9 font-medium border-r border-gray-700 ${(dayTotals[d] || 0) > 0 ? 'text-green-300' : 'text-gray-500'}`}>{d}</th>
                  ))}
                  {advanceDates.map(d => (
                    <th key={d} className="px-0.5 py-1.5 text-center w-10 text-orange-300 font-medium border-r border-orange-800">{d}th</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* Route header if showing all routes */}
                {!routeId && (() => {
                  const groups: Record<string, any[]> = {};
                  filtered.forEach(f => {
                    const key = f.route?.name || 'UNKNOWN';
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(f);
                  });
                  return Object.entries(groups).map(([routeName, routeFarmers]) => (
                    <>
                      <tr key={`route-${routeName}`} className="bg-green-700 text-white">
                        <td className="sticky left-0 bg-green-700 z-10 px-2 py-1.5 font-bold text-xs">{routeName}</td>
                        <td className="sticky left-[55px] bg-green-700 z-10 px-2 py-1.5 font-bold text-xs border-r border-green-600" colSpan={1}>
                          {routeFarmers.length} farmers
                        </td>
                        {days.map(d => <td key={d} className="bg-green-700" />)}
                        <td className="bg-green-700" /><td className="bg-green-700" /><td className="sticky right-0 bg-green-700" />
                      </tr>
                      {routeFarmers.map((f, idx) => <FarmerRow key={f.id} f={f} idx={idx} days={days} midDays={midDays} endDays={endDays} getTotal15={getTotal15} getTotalLitres={getTotalLitres} getTotalMoney={getTotalMoney} />)}
                      <RouteSubtotal key={`sub-${routeName}`} farmers={routeFarmers} days={days} midDays={midDays} endDays={endDays} getDayTotal={(d: number) => routeFarmers.reduce((s: number, f: any) => s + (f.days[d]||0), 0)} getTotal15={() => routeFarmers.reduce((s: number, f: any) => s + getTotal15(f), 0)} getTotalLitres={() => routeFarmers.reduce((s: number, f: any) => s + getTotalLitres(f), 0)} getTotalMoney={() => routeFarmers.reduce((s: number, f: any) => s + getTotalMoney(f), 0)} />
                    </>
                  ));
                })()}

                {/* Single route view */}
                {routeId && filtered.map((f, idx) => (
                  <FarmerRow key={f.id} f={f} idx={idx} days={days} midDays={midDays} endDays={endDays} getTotal15={getTotal15} getTotalLitres={getTotalLitres} getTotalMoney={getTotalMoney} />
                ))}

                {/* Grand totals */}
                <tr className="bg-gray-800 text-white font-bold sticky bottom-0 z-20">
                  <td className="sticky left-0 bg-gray-800 z-30 px-2 py-2.5 text-xs" colSpan={2}>GRAND TOTAL</td>
                  {midDays.map(d => (
                    <td key={d} className="px-0.5 py-2.5 text-center text-xs">
                      {getDayTotal(d) > 0 ? <span className="text-green-300">{getDayTotal(d).toFixed(0)}</span> : <span className="text-gray-600">–</span>}
                    </td>
                  ))}
                  <td className="px-1 py-2.5 text-center text-xs text-purple-300">{getMid15Total().toFixed(0)}</td>
                  {endDays.map(d => (
                    <td key={d} className="px-0.5 py-2.5 text-center text-xs border-r border-gray-700">
                      {getDayTotal(d) > 0 ? <span className="text-green-300">{getDayTotal(d).toFixed(0)}</span> : <span className="text-gray-600">–</span>}
                    </td>
                  ))}
                  <td className="px-1 py-2.5 text-center text-xs text-green-300">{getGrandTotal().toFixed(0)}</td>
                  <td className="sticky right-0 bg-gray-800 px-2 py-2.5 text-right text-xs text-green-300">
                    {getGrandMoney().toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FarmerRow({ f, idx, days, midDays, endDays, getTotal15, getTotalLitres, getTotalMoney }: any) {
  const total15     = getTotal15(f);
  const totalLitres = getTotalLitres(f);
  const totalMoney  = getTotalMoney(f);
  const advDates    = [5, 10, 15, 20, 25];
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
  return (
    <tr className={`border-b border-gray-100 ${rowBg} hover:bg-green-50`}>
      <td className={`sticky left-0 z-10 px-2 py-2 font-mono text-gray-400 text-xs ${rowBg}`}>{f.code}</td>
      <td className={`sticky left-[55px] z-10 px-2 py-2 font-medium text-gray-800 border-r border-gray-100 text-xs ${rowBg}`}>
        {f.name}
        {f.route && <div className="text-xs text-gray-400 font-normal">{f.route.name}</div>}
      </td>
      {midDays.map((d: number) => (
        <td key={d} className="px-0.5 py-2 text-center border-r border-gray-50">
          {f.days[d] > 0 ? <span className={`text-xs font-medium ${f.days[d] >= 20 ? 'text-green-700' : 'text-green-500'}`}>{f.days[d] % 1 === 0 ? f.days[d] : f.days[d].toFixed(1)}</span>
            : <span className="text-gray-200">–</span>}
        </td>
      ))}
      <td className="px-1 py-2 text-center font-bold text-purple-700 border-r border-purple-100 bg-purple-50 text-xs">
        {total15 > 0 ? total15.toFixed(1) : '–'}
      </td>
      {endDays.map((d: number) => (
        <td key={d} className="px-0.5 py-2 text-center border-r border-gray-50">
          {f.days[d] > 0 ? <span className={`text-xs font-medium ${f.days[d] >= 20 ? 'text-green-700' : 'text-green-500'}`}>{f.days[d] % 1 === 0 ? f.days[d] : f.days[d].toFixed(1)}</span>
            : <span className="text-gray-200">–</span>}
        </td>
      ))}
      <td className="px-1 py-2 text-center font-bold text-green-700 bg-green-50 border-r border-green-100 text-xs">{totalLitres > 0 ? totalLitres.toFixed(1) : '–'}</td>
      <td className="px-1 py-2 text-center font-bold text-blue-700 bg-blue-50 border-r border-blue-100 text-xs">{totalMoney > 0 ? totalMoney.toLocaleString(undefined,{maximumFractionDigits:0}) : '–'}</td>
      {/* B/f */}
      <td className={`px-1 py-2 text-center text-xs border-r ${f.bfBalance > 0 ? 'text-red-600 font-bold bg-red-50' : 'text-gray-300'}`}>
        {f.bfBalance > 0 ? f.bfBalance.toLocaleString(undefined,{maximumFractionDigits:0}) : '–'}
      </td>
      {/* Advance columns */}
      {advDates.map(d => (
        <td key={d} className="px-0.5 py-2 text-center text-xs border-r border-orange-100">
          {f.advances?.[d] > 0 ? <span className="text-orange-600 font-medium">{f.advances[d].toLocaleString(undefined,{maximumFractionDigits:0})}</span> : <span className="text-gray-200">–</span>}
        </td>
      ))}
      {/* Total advances */}
      <td className="px-1 py-2 text-center text-xs font-bold text-orange-600 border-r bg-orange-50">
        {f.totalAdvances > 0 ? f.totalAdvances.toLocaleString(undefined,{maximumFractionDigits:0}) : '–'}
      </td>
      {/* Amt Payable */}
      <td className={`sticky right-0 px-2 py-2 text-right font-bold text-xs border-l ${f.amtPayable < 0 ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}`}>
        {f.amtPayable !== undefined ? f.amtPayable.toLocaleString(undefined,{maximumFractionDigits:0}) : '–'}
      </td>
    </tr>
  );
}

function RouteSubtotal({ farmers, days, midDays, endDays, getDayTotal, getTotal15, getTotalLitres, getTotalMoney }: any) {
  return (
    <tr className="bg-green-50 border-y border-green-200 font-semibold">
      <td className="sticky left-0 bg-green-50 z-10 px-2 py-2 text-xs text-green-700" colSpan={2}>ROUTE TOTAL ({farmers.length})</td>
      {midDays.map((d: number) => (
        <td key={d} className="px-0.5 py-2 text-center text-xs text-green-700">
          {getDayTotal(d) > 0 ? getDayTotal(d).toFixed(0) : '–'}
        </td>
      ))}
      <td className="px-1 py-2 text-center text-xs font-bold text-purple-700 bg-purple-50">{getTotal15().toFixed(0)}</td>
      {endDays.map((d: number) => (
        <td key={d} className="px-0.5 py-2 text-center text-xs text-green-700 border-r border-gray-200">
          {getDayTotal(d) > 0 ? getDayTotal(d).toFixed(0) : '–'}
        </td>
      ))}
      <td className="px-1 py-2 text-center text-xs font-bold text-green-800 bg-green-100">{getTotalLitres().toFixed(0)}</td>
      <td className="sticky right-0 bg-green-50 px-2 py-2 text-right text-xs font-bold text-blue-700">
        {getTotalMoney().toLocaleString(undefined,{maximumFractionDigits:0})}
      </td>
    </tr>
  );
}
