import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SECTIONS = {
  routes: 'ROUTES',
  brokers: 'BROKERS',
  issues: 'ISSUES',
  sales: 'SALES',
};

export default function LitresPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [editCell, setEditCell] = useState<{section: string, name: string, day: number} | null>(null);
  const [editValue, setEditValue] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['litres-ledger', month, year],
    queryFn: () => api.get('/api/factory/litres-ledger', { params: { month, year } }),
    retry: 1,
  });

  const ledger = data?.data || {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const saveMut = useMutation({
    mutationFn: (d: any) => api.post('/api/factory/litres-ledger', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['litres-ledger'] }); setEditCell(null); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to save'),
  });

  const handleCellClick = (section: string, name: string, day: number, currentVal: number) => {
    setEditCell({ section, name, day });
    setEditValue(currentVal > 0 ? currentVal.toFixed(1) : '');
  };

  const handleSave = () => {
    if (!editCell) return;
    saveMut.mutate({
      section: editCell.section,
      name: editCell.name,
      day: editCell.day,
      month, year,
      value: Number(editValue) || 0,
    });
  };

  const getVal = (section: string, name: string, day: number) => {
    return ledger[section]?.[name]?.[day] || 0;
  };

  const getRowTotal = (section: string, name: string) => {
    return days.reduce((s, d) => s + (ledger[section]?.[name]?.[d] || 0), 0);
  };

  const getDayTotal = (section: string, day: number) => {
    if (!ledger[section]) return 0;
    return Object.keys(ledger[section]).reduce((s, name) => s + (ledger[section][name][day] || 0), 0);
  };

  const getSectionTotal = (section: string) => {
    if (!ledger[section]) return 0;
    return Object.keys(ledger[section]).reduce((s, name) => s + getRowTotal(section, name), 0);
  };

  // Computed values per day
  const getAvailable = (day: number) => {
    const bal = ledger.balance?.[day - 1] || 0; // previous day balance
    return bal + getDayTotal('routes', day) + getDayTotal('brokers', day) - getDayTotal('issues', day);
  };

  const getBalance = (day: number) => {
    return getAvailable(day) - getDayTotal('sales', day);
  };

  const routeNames: string[] = Object.keys(ledger.routes || {});
  const brokerNames: string[] = Object.keys(ledger.brokers || {});
  const issueNames: string[] = Object.keys(ledger.issues || {});
  const salesNames: string[] = Object.keys(ledger.sales || {});

  const SectionRow = ({ section, name, color }: { section: string; name: string; color: string }) => (
    <tr className="border-b hover:bg-gray-50 group">
      <td className={`sticky left-0 z-10 px-3 py-2 text-xs font-medium bg-white border-r ${color}`}>{name}</td>
      {days.map(d => {
        const val = getVal(section, name, d);
        const isEditing = editCell?.section === section && editCell?.name === name && editCell?.day === d;
        return (
          <td key={d} className="px-0.5 py-1 text-center border-r border-gray-100 min-w-[52px]"
            onClick={() => !isEditing && handleCellClick(section, name, d, val)}>
            {isEditing ? (
              <input autoFocus type="number" value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditCell(null); }}
                onBlur={handleSave}
                className="w-full px-1 py-0.5 text-xs text-center border border-green-400 rounded outline-none bg-green-50"
                style={{ width: '48px' }} />
            ) : (
              <span className={`text-xs cursor-pointer ${val > 0 ? 'font-medium text-gray-800' : 'text-gray-200'} group-hover:text-green-600`}>
                {val > 0 ? val.toFixed(1) : '–'}
              </span>
            )}
          </td>
        );
      })}
      <td className={`sticky right-0 px-2 py-2 text-xs font-bold text-right border-l bg-gray-50 ${color}`}>
        {getRowTotal(section, name).toFixed(1)}
      </td>
    </tr>
  );

  const TotalRow = ({ label, section, bgClass }: { label: string; section: string; bgClass: string }) => (
    <tr className={bgClass}>
      <td className={`sticky left-0 z-10 px-3 py-2 text-xs font-bold border-r ${bgClass}`}>{label}</td>
      {days.map(d => (
        <td key={d} className="px-1 py-2 text-center text-xs font-bold border-r">
          {getDayTotal(section, d) > 0 ? getDayTotal(section, d).toFixed(1) : '–'}
        </td>
      ))}
      <td className={`sticky right-0 px-2 py-2 text-xs font-bold text-right border-l ${bgClass}`}>
        {getSectionTotal(section).toFixed(1)}
      </td>
    </tr>
  );

  const SummaryRow = ({ label, fn, bgClass, textClass }: { label: string; fn: (d: number) => number; bgClass: string; textClass: string }) => (
    <tr className={bgClass}>
      <td className={`sticky left-0 z-10 px-3 py-2 text-xs font-bold border-r ${bgClass} ${textClass}`}>{label}</td>
      {days.map(d => {
        const v = fn(d);
        return (
          <td key={d} className={`px-1 py-2 text-center text-xs font-bold border-r ${textClass}`}>
            {v !== 0 ? v.toFixed(1) : '–'}
          </td>
        );
      })}
      <td className={`sticky right-0 px-2 py-2 text-xs font-bold text-right border-l ${bgClass} ${textClass}`}>
        {days.reduce((s, d) => s + fn(d), 0).toFixed(1)}
      </td>
    </tr>
  );

  // Summary stats
  const totalRoutes = getSectionTotal('routes');
  const totalBrokers = getSectionTotal('brokers');
  const totalIssues = getSectionTotal('issues');
  const totalSales = getSectionTotal('sales');
  const totalAvailable = totalRoutes + totalBrokers - totalIssues;
  const totalBalance = totalAvailable - totalSales;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Litres Ledger</h1>
          <p className="text-sm text-gray-500">Daily milk flow — Routes · Brokers · Issues · Sales · Balance</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Routes Total', value: totalRoutes, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Brokers', value: totalBrokers, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { label: 'Issues', value: totalIssues, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Available', value: totalAvailable, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Total Sales', value: totalSales, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
          { label: 'Balance', value: totalBalance, color: totalBalance >= 0 ? 'text-green-700' : 'text-red-600', bg: totalBalance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value.toFixed(0)} L</div>
          </div>
        ))}
      </div>

      {/* Tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700 mb-4">
        💡 Click any cell to edit. Press Enter to save, Escape to cancel.
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Loading ledger...</div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${180 + daysInMonth * 54 + 60}px` }}>
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="sticky left-0 bg-gray-800 z-20 px-3 py-2 text-left min-w-[160px]">ROUTE / SOURCE</th>
                  {days.map(d => <th key={d} className="px-1 py-2 text-center w-14 font-medium">{d}</th>)}
                  <th className="sticky right-0 bg-gray-800 px-3 py-2 text-right min-w-[60px]">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {/* Balance b/f */}
                <tr className="bg-yellow-50 border-b">
                  <td className="sticky left-0 z-10 px-3 py-2 text-xs font-bold text-yellow-700 bg-yellow-50 border-r">Balance b/f</td>
                  {days.map(d => <td key={d} className="px-1 py-2 text-center text-xs text-yellow-600 font-medium border-r">
                    {ledger.balance?.[d-1] > 0 ? Number(ledger.balance[d-1]).toFixed(1) : '–'}
                  </td>)}
                  <td className="sticky right-0 bg-yellow-50 px-2 py-2 border-l"></td>
                </tr>

                {/* ROUTES section header */}
                <tr className="bg-blue-700 text-white">
                  <td className="sticky left-0 z-10 px-3 py-1.5 text-xs font-bold bg-blue-700 border-r" colSpan={1}>ROUTES</td>
                  {days.map(d => <td key={d} className="border-r border-blue-600" />)}
                  <td className="sticky right-0 bg-blue-700 border-l" />
                </tr>
                {routeNames.map(name => <SectionRow key={name} section="routes" name={name} color="text-blue-700" />)}
                <TotalRow label="ROUTES TOTAL" section="routes" bgClass="bg-blue-50 text-blue-800" />

                {/* BROKERS section */}
                <tr className="bg-purple-700 text-white">
                  <td className="sticky left-0 z-10 px-3 py-1.5 text-xs font-bold bg-purple-700 border-r" colSpan={1}>BROKERS</td>
                  {days.map(d => <td key={d} className="border-r border-purple-600" />)}
                  <td className="sticky right-0 bg-purple-700 border-l" />
                </tr>
                {brokerNames.map(name => <SectionRow key={name} section="brokers" name={name} color="text-purple-700" />)}
                <TotalRow label="BROKERS TOTAL" section="brokers" bgClass="bg-purple-50 text-purple-800" />

                {/* ISSUES section */}
                <tr className="bg-red-700 text-white">
                  <td className="sticky left-0 z-10 px-3 py-1.5 text-xs font-bold bg-red-700 border-r" colSpan={1}>ISSUES (Rejects/Spills)</td>
                  {days.map(d => <td key={d} className="border-r border-red-600" />)}
                  <td className="sticky right-0 bg-red-700 border-l" />
                </tr>
                {issueNames.map(name => <SectionRow key={name} section="issues" name={name} color="text-red-600" />)}
                <TotalRow label="ISSUES TOTAL" section="issues" bgClass="bg-red-50 text-red-700" />

                {/* Available to sell */}
                <SummaryRow label="✅ AVAILABLE TO SELL"
                  fn={d => getDayTotal('routes', d) + getDayTotal('brokers', d) - getDayTotal('issues', d) + (ledger.balance?.[d-1] || 0)}
                  bgClass="bg-green-700" textClass="text-white" />

                {/* SALES section */}
                <tr className="bg-orange-600 text-white">
                  <td className="sticky left-0 z-10 px-3 py-1.5 text-xs font-bold bg-orange-600 border-r" colSpan={1}>SALES</td>
                  {days.map(d => <td key={d} className="border-r border-orange-500" />)}
                  <td className="sticky right-0 bg-orange-600 border-l" />
                </tr>
                {salesNames.map(name => <SectionRow key={name} section="sales" name={name} color="text-orange-700" />)}
                <TotalRow label="SALES TOTAL" section="sales" bgClass="bg-orange-50 text-orange-700" />

                {/* Balance */}
                <SummaryRow label="📦 EXPECTED BALANCE"
                  fn={d => getDayTotal('routes', d) + getDayTotal('brokers', d) - getDayTotal('issues', d) + (ledger.balance?.[d-1] || 0) - getDayTotal('sales', d)}
                  bgClass="bg-gray-800" textClass="text-yellow-300" />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
