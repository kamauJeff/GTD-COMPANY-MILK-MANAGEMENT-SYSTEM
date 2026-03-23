import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Search, Printer, RefreshCw, Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ordinal(n: number) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function StatementPage() {
  const now = new Date();
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<any>(null);
  const [month, setMonth]         = useState(now.getMonth() + 1);
  const [year, setYear]           = useState(now.getFullYear());
  const [isMid, setMid]           = useState(false);
  const printRef                  = useRef<HTMLDivElement>(null);

  // Farmer search
  const { data: searchData } = useQuery({
    queryKey: ['stmt-search', search],
    queryFn: () => api.get('/api/farmers', { params: { search, limit: 10 } }),
    enabled: search.length >= 2,
    staleTime: 0,
  });
  const suggestions: any[] = searchData?.data?.data ?? [];

  // Statement data
  const { data: stmtData, isLoading, error, refetch } = useQuery({
    queryKey: ['statement', selected?.code, month, year, isMid],
    queryFn: () => api.get('/api/collections/statement', {
      params: { farmerCode: selected?.code, month, year, isMidMonth: isMid },
    }),
    enabled: !!selected,
    staleTime: 0,
  });
  const stmt = stmtData?.data;

  function handlePrint() {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Statement — ${stmt?.farmer?.name}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}
        h2{margin:0 0 4px}
        .meta{color:#555;font-size:11px;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th{background:#f0f0f0;padding:6px 8px;text-align:left;border:1px solid #ddd;font-size:11px}
        td{padding:5px 8px;border:1px solid #ddd;font-size:11px}
        .days-grid{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}
        .day-cell{width:40px;text-align:center;padding:4px;border:1px solid #ddd;font-size:10px;border-radius:4px}
        .day-cell.has-milk{background:#d4edda;font-weight:bold}
        .totals{margin-top:12px}
        .totals tr.total-row{font-weight:bold;background:#f9f9f9}
        .net-pay{font-size:16px;font-weight:bold;padding:8px;background:#2d6a4f;color:white;text-align:center;border-radius:6px;margin-top:10px}
        @media print{body{margin:5mm}}
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  function handleDownloadCSV() {
    if (!stmt) return;
    const rows = [
      ['Gutoria Dairies — Farmer Statement'],
      ['Farmer', stmt.farmer.name, 'Code', stmt.farmer.code],
      ['Route', stmt.farmer.route?.name, 'Period', stmt.period],
      ['Price/Litre', `KES ${stmt.farmer.pricePerLitre}`],
      [],
      ['Day', 'Litres'],
      ...Array.from({ length: stmt.daysInMonth }, (_, i) => [String(i + 1), String(stmt.dailyLitres[i + 1] || 0)]),
      [],
      ['Total Litres', stmt.totalLitres.toFixed(1)],
      ['Gross Pay', stmt.grossPay],
      [],
      ['DEDUCTIONS', ''],
      ...(stmt.deductionsList || []).map((d: any) => [d.label, d.amount]),
      ['Total Deductions', stmt.totalDeductions],
      [],
      ['NET PAY', stmt.netPay],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `statement-${stmt.farmer.code}-${MONTHS[month-1]}-${year}.csv`;
    a.click();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Farmer Statements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Search any farmer · view full payment breakdown · print or download</p>
        </div>
        {stmt && (
          <div className="flex gap-2">
            <button onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-green-600 dark:text-green-400 border-green-300 hover:bg-green-50">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-blue-600 border-blue-300 hover:bg-blue-50">
              <Download size={14} /> CSV
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Printer size={14} /> Print
            </button>
          </div>
        )}
      </div>

      {/* Search + Period controls */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Farmer search */}
          <div className="flex-1 min-w-[240px] relative">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Search Farmer (name or code)</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
                placeholder="e.g. John Kamau or FM0042"
                className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            </div>
            {suggestions.length > 0 && !selected && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((f: any) => (
                  <button key={f.id} onClick={() => { setSelected(f); setSearch(f.name); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm border-b last:border-0 dark:border-gray-700">
                    <span className="font-medium dark:text-gray-100">{f.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{f.code} · {f.route?.name}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${f.paidOn15th ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.paidOn15th ? 'Mid+End' : 'End only'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Period controls */}
          <div className="flex gap-2 flex-wrap items-center">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            {selected?.paidOn15th && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Period</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                  <button onClick={() => setMid(true)} className={`px-3 py-2.5 text-sm font-medium ${isMid ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    Mid (1–15)
                  </button>
                  <button onClick={() => setMid(false)} className={`px-3 py-2.5 text-sm font-medium border-l dark:border-gray-600 ${!isMid ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    End (16–31)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statement */}
      {!selected ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-20" />
          <div className="font-medium">Search for a farmer above to view their statement</div>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center text-gray-400">
          Loading statement for {selected.name}...
        </div>
      ) : error || !stmt ? (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-700 p-8 text-center">
          <div className="text-red-600 font-medium mb-2">Could not load statement</div>
          <div className="text-sm text-red-400 mb-4">{(error as any)?.response?.data?.error || 'Check connection and try again'}</div>
          <button onClick={() => refetch()} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm">Retry</button>
        </div>
      ) : (
        <div ref={printRef}>
          {/* Farmer header */}
          <div className="bg-green-800 text-white rounded-2xl p-5 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-green-300 font-mono">{stmt.farmer.code}</div>
                <h2 className="text-xl font-bold mt-0.5">{stmt.farmer.name}</h2>
                <div className="text-sm text-green-200 mt-1">{stmt.farmer.route?.name} · {stmt.period}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-300">Payment Type</div>
                <div className="text-sm font-medium mt-0.5">{stmt.farmer.paidOn15th ? 'Mid + End Month' : 'End Month Only'}</div>
                <div className="text-xs text-green-300 mt-1">KES {Number(stmt.farmer.pricePerLitre).toLocaleString()}/L</div>
              </div>
            </div>
          </div>

          {/* Daily collections — compact table, groups days in rows of 8 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Daily Collections</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  {Array.from({ length: 8 }, (_, i) => (
                    <th key={i} className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-gray-500 font-medium w-[12.5%]">Day</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(stmt.daysInMonth / 8) }, (_, rowIdx) => {
                  const startDay = rowIdx * 8 + 1;
                  const cells = Array.from({ length: 8 }, (_, ci) => startDay + ci);
                  return (
                    <tr key={rowIdx}>
                      {cells.map(day => {
                        if (day > stmt.daysInMonth) return <td key={day} className="border border-gray-100 dark:border-gray-800 p-1" />;
                        const litres = stmt.dailyLitres[day];
                        const inPeriod = isMid ? day <= 15 : stmt.farmer.paidOn15th ? day >= 16 : true;
                        return (
                          <td key={day} className={`border px-1 py-1 text-center
                            ${!inPeriod ? 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-300' :
                              litres > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 font-bold text-green-800 dark:text-green-300' :
                              'border-gray-200 dark:border-gray-700 text-gray-300'}`}>
                            <div className="text-gray-400 text-[9px]">{ordinal(day)}</div>
                            <div className="font-mono">{litres ? litres.toFixed(1) : '–'}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Inline total row */}
            <div className="mt-3 flex justify-between items-center px-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Days with milk: {Object.values(stmt.dailyLitres).filter((v: any) => v > 0).length}
              </span>
              <span className="font-mono font-bold text-sm text-green-700 dark:text-green-400">
                Total: {Number(stmt.totalLitres).toFixed(1)} L
              </span>
            </div>
          </div>

          {/* Totals breakdown */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Payment Summary</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {/* Litres + Gross */}
              <div className="flex justify-between px-5 py-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">Total Litres ({stmt.period})</span>
                <span className="font-mono font-bold text-sm">{Number(stmt.totalLitres).toFixed(1)} L</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">Gross Pay @ KES {Number(stmt.farmer.pricePerLitre).toLocaleString()}/L</span>
                <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-400">KES {Number(stmt.grossPay).toLocaleString()}</span>
              </div>

              {/* Deductions header */}
              <div className="px-5 py-2 bg-red-50 dark:bg-red-900/10">
                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Deductions</span>
              </div>

              {/* Each deduction line */}
              {(stmt.deductionsList || []).map((d: any, i: number) => (
                <div key={i} className="flex justify-between px-5 py-2.5 pl-8">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{d.label}</span>
                  <span className="font-mono text-sm text-red-600">- KES {Number(d.amount).toLocaleString()}</span>
                </div>
              ))}

              {/* Total deductions */}
              <div className="flex justify-between px-5 py-3 bg-red-50 dark:bg-red-900/10">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Total Deductions</span>
                <span className="font-mono font-bold text-sm text-red-600">- KES {Number(stmt.totalDeductions).toLocaleString()}</span>
              </div>

              {/* Net Pay */}
              <div className={`flex justify-between px-5 py-4 ${Number(stmt.netPay) >= 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                <span className="text-base font-bold text-white">NET PAY</span>
                <span className="font-mono font-bold text-xl text-white">KES {Number(stmt.netPay).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
