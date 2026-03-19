import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { RefreshCw, Plus, Edit3 } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function LitresPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [editCell, setEditCell] = useState<{section: string; name: string; day: number} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [openingBal, setOpeningBal] = useState('');
  const [showAddRow, setShowAddRow] = useState<string | null>(null);
  const [newRowName, setNewRowName] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['litres-ledger', month, year],
    queryFn: () => api.get('/api/factory/litres-ledger', { params: { month, year } }),
    refetchInterval: 60000, // auto-refresh every 60s
  });

  const ledger    = data?.data || {};
  const daysInMonth = ledger.daysInMonth || new Date(year, month, 0).getDate();
  const days      = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const summary   = ledger.dailySummary || {};
  const balance   = ledger.balance || {};

  const saveMut = useMutation({
    mutationFn: (d: any) => api.post('/api/factory/litres-ledger', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['litres-ledger'] }); setEditCell(null); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to save'),
  });

  const setBalMut = useMutation({
    mutationFn: (bal: number) => api.post('/api/factory/litres-ledger/set-balance', { month, year, balance: bal }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['litres-ledger'] }); setOpeningBal(''); },
  });

  const addRowMut = useMutation({
    mutationFn: (d: any) => api.post('/api/factory/litres-ledger/add-row', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['litres-ledger'] }); setShowAddRow(null); setNewRowName(''); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed'),
  });

  const handleSave = () => {
    if (!editCell) return;
    saveMut.mutate({ section: editCell.section, name: editCell.name, day: editCell.day, month, year, value: Number(editValue) || 0 });
  };

  const getVal = (section: string, name: string, day: number) =>
    ledger[section]?.[name]?.[day] || 0;

  const getRowTotal = (section: string, name: string) =>
    days.reduce((s, d) => s + (ledger[section]?.[name]?.[d] || 0), 0);

  const getSectionDayTotal = (section: string, day: number) => {
    if (!ledger[section]) return 0;
    return Object.keys(ledger[section]).reduce((s, name) => s + (ledger[section][name][day] || 0), 0);
  };

  const getSectionTotal = (section: string) => {
    if (!ledger[section]) return 0;
    return Object.keys(ledger[section]).reduce((s, name) => s + getRowTotal(section, name), 0);
  };

  // Month totals
  const totalRoutes   = getSectionTotal('routes');
  const totalBrokers  = getSectionTotal('brokers');
  const totalIssues   = getSectionTotal('issues');
  const totalSales    = getSectionTotal('sales');
  const totalAvailable = totalRoutes + totalBrokers - totalIssues;
  const grandBalance  = totalAvailable - totalSales;

  // Today's numbers
  const today = now.getDate();
  const todaySummary = summary[today] || {};

  // Section row component
  const DataRow = ({ section, name, isAuto }: { section: string; name: string; isAuto: boolean }) => (
    <tr className="border-b hover:bg-gray-50 group">
      <td className={`sticky left-0 z-10 px-3 py-2 text-xs font-medium border-r bg-white ${isAuto ? 'text-blue-700' : 'text-gray-700'}`}>
        <div className="flex items-center gap-1">
          {name}
          {isAuto && <span className="text-xs text-blue-400 font-normal ml-1">auto</span>}
        </div>
      </td>
      {days.map(d => {
        const val = getVal(section, name, d);
        const isEditing = editCell?.section === section && editCell?.name === name && editCell?.day === d;
        const canEdit = !isAuto;
        return (
          <td key={d} className="px-0.5 py-1 text-center border-r border-gray-100 min-w-[52px]"
            onClick={() => canEdit && !isEditing && setEditCell({ section, name, day: d }) && setEditValue(val > 0 ? val.toString() : '')}>
            {isEditing ? (
              <input autoFocus type="number" value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditCell(null); }}
                onBlur={handleSave}
                className="w-full px-1 py-0.5 text-xs text-center border border-green-400 rounded outline-none bg-green-50"
                style={{ width: '48px' }} />
            ) : (
              <span className={`text-xs ${val > 0 ? 'font-medium text-gray-800' : 'text-gray-200'} ${canEdit ? 'cursor-pointer group-hover:text-green-600' : ''}`}>
                {val > 0 ? val.toFixed(1) : '–'}
              </span>
            )}
          </td>
        );
      })}
      <td className="sticky right-0 px-2 py-2 text-xs font-bold text-right border-l bg-gray-50 text-gray-700">
        {getRowTotal(section, name).toFixed(1)}
      </td>
    </tr>
  );

  const SectionHeader = ({ label, color, section, canAdd }: { label: string; color: string; section: string; canAdd?: boolean }) => (
    <tr className={`${color} text-white`}>
      <td className={`sticky left-0 z-10 px-3 py-1.5 text-xs font-bold ${color} border-r flex items-center justify-between`}>
        <span>{label}</span>
        {canAdd && (
          <button onClick={() => setShowAddRow(section)} className="text-white opacity-70 hover:opacity-100 ml-2">
            <Plus size={12} />
          </button>
        )}
      </td>
      {days.map(d => <td key={d} className="border-r border-opacity-30 py-1.5" />)}
      <td className="sticky right-0 border-l" />
    </tr>
  );

  const TotalRow = ({ label, section, bg, textColor }: { label: string; section: string; bg: string; textColor: string }) => (
    <tr className={bg}>
      <td className={`sticky left-0 z-10 px-3 py-2 text-xs font-bold border-r ${bg} ${textColor}`}>{label}</td>
      {days.map(d => (
        <td key={d} className={`px-1 py-2 text-center text-xs font-bold border-r ${textColor}`}>
          {getSectionDayTotal(section, d) > 0 ? getSectionDayTotal(section, d).toFixed(1) : '–'}
        </td>
      ))}
      <td className={`sticky right-0 px-2 py-2 text-xs font-bold text-right border-l ${bg} ${textColor}`}>
        {getSectionTotal(section).toFixed(1)}
      </td>
    </tr>
  );

  const ComputedRow = ({ label, fn, bg, textColor }: { label: string; fn: (d: number) => number; bg: string; textColor: string }) => (
    <tr className={bg}>
      <td className={`sticky left-0 z-10 px-3 py-2 text-xs font-bold border-r ${bg} ${textColor}`}>{label}</td>
      {days.map(d => {
        const v = fn(d);
        return (
          <td key={d} className={`px-1 py-2 text-center text-xs font-bold border-r ${v < 0 ? 'text-red-300' : textColor}`}>
            {v !== 0 ? v.toFixed(1) : '–'}
          </td>
        );
      })}
      <td className={`sticky right-0 px-2 py-2 text-xs font-bold text-right border-l ${bg} ${textColor}`}>
        {days.reduce((s, d) => s + fn(d), 0).toFixed(1)}
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Litres Ledger</h1>
          <p className="text-sm text-gray-500">Routes auto-fetch from collections · Sales auto-fetch from shop deliveries · Brokers & issues are manual</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => refetch()} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Today's live snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        {[
          { label: `Today's Collections`, value: `${(todaySummary.routesTotal || 0).toFixed(1)} L`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Brokers Today', value: `${(todaySummary.brokersTotal || 0).toFixed(1)} L`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { label: 'Issues Today', value: `${(todaySummary.issuesTotal || 0).toFixed(1)} L`, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Available Today', value: `${(todaySummary.available || 0).toFixed(1)} L`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Sales Today', value: `${(todaySummary.salesTotal || 0).toFixed(1)} L`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
          { label: 'Closing Balance', value: `${(todaySummary.closingBalance || 0).toFixed(1)} L`, color: (todaySummary.closingBalance || 0) < 0 ? 'text-red-600' : 'text-green-700', bg: (todaySummary.closingBalance || 0) < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        {[
          { label: 'Month Routes', value: `${totalRoutes.toFixed(0)} L`, color: 'text-blue-700' },
          { label: 'Month Brokers', value: `${totalBrokers.toFixed(0)} L`, color: 'text-purple-700' },
          { label: 'Month Issues', value: `${totalIssues.toFixed(0)} L`, color: 'text-red-600' },
          { label: 'Month Available', value: `${totalAvailable.toFixed(0)} L`, color: 'text-green-700' },
          { label: 'Month Sales', value: `${totalSales.toFixed(0)} L`, color: 'text-orange-700' },
          { label: 'Month Balance', value: `${grandBalance.toFixed(0)} L`, color: grandBalance < 0 ? 'text-red-600' : 'text-green-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-3 shadow-sm">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Opening balance setter */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-4">
        <span className="text-sm text-yellow-700 font-medium">Opening Balance (b/f from previous month):</span>
        <span className="font-bold text-yellow-800">{Number(balance[0] || 0).toFixed(1)} L</span>
        <input type="number" value={openingBal} onChange={e => setOpeningBal(e.target.value)}
          placeholder="Set b/f litres..." className="px-3 py-1.5 border border-yellow-300 rounded-lg text-sm w-40 bg-white" />
        <button onClick={() => setBalMut.mutate(Number(openingBal))} disabled={!openingBal || setBalMut.isPending}
          className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">
          {setBalMut.isPending ? 'Saving...' : 'Set'}
        </button>
      </div>

      {/* Tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-600 mb-4">
        💡 <strong>Routes</strong> and <strong>Sales</strong> are auto-fetched from the system. Click any <strong>Broker</strong> or <strong>Issue</strong> cell to edit. Press Enter to save.
      </div>

      {/* Main grid */}
      {isLoading ? (
        <div className="bg-white rounded-xl border p-16 text-center text-gray-400">Loading ledger...</div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
            <table className="text-xs border-collapse" style={{ minWidth: `${190 + daysInMonth * 54 + 60}px` }}>
              <thead className="sticky top-0 z-30">
                <tr className="bg-gray-800 text-white">
                  <th className="sticky left-0 bg-gray-800 z-20 px-3 py-2.5 text-left min-w-[190px]">ROUTE / SOURCE</th>
                  {days.map(d => (
                    <th key={d} className={`px-1 py-2.5 text-center w-14 font-medium ${summary[d]?.routesTotal > 0 ? 'text-green-300' : 'text-gray-500'}`}>{d}</th>
                  ))}
                  <th className="sticky right-0 bg-gray-800 px-3 py-2.5 text-right min-w-[65px]">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {/* Balance b/f row */}
                <tr className="bg-yellow-50 border-b">
                  <td className="sticky left-0 z-10 px-3 py-2 text-xs font-bold text-yellow-700 bg-yellow-50 border-r">Balance b/f</td>
                  {days.map(d => (
                    <td key={d} className="px-1 py-2 text-center text-xs text-yellow-600 font-medium border-r">
                      {d === 1 && balance[0] > 0 ? Number(balance[0]).toFixed(1) : '–'}
                    </td>
                  ))}
                  <td className="sticky right-0 bg-yellow-50 px-2 py-2 border-l text-xs font-bold text-yellow-700 text-right">
                    {Number(balance[0] || 0).toFixed(1)}
                  </td>
                </tr>

                {/* ROUTES — auto */}
                <SectionHeader label="🥛 ROUTES (auto)" color="bg-blue-700" section="routes" canAdd={false} />
                {Object.keys(ledger.routes || {}).sort().map(name => (
                  <DataRow key={name} section="routes" name={name} isAuto={true} />
                ))}
                <TotalRow label="ROUTES TOTAL" section="routes" bg="bg-blue-50" textColor="text-blue-800" />

                {/* BROKERS — manual */}
                <SectionHeader label="🤝 BROKERS (manual)" color="bg-purple-700" section="brokers" canAdd={true} />
                {Object.keys(ledger.brokers || {}).sort().map(name => (
                  <DataRow key={name} section="brokers" name={name} isAuto={false} />
                ))}
                <TotalRow label="BROKERS TOTAL" section="brokers" bg="bg-purple-50" textColor="text-purple-800" />

                {/* ISSUES — manual */}
                <SectionHeader label="⚠️ ISSUES (manual)" color="bg-red-700" section="issues" canAdd={true} />
                {Object.keys(ledger.issues || {}).sort().map(name => (
                  <DataRow key={name} section="issues" name={name} isAuto={false} />
                ))}
                <TotalRow label="ISSUES TOTAL" section="issues" bg="bg-red-50" textColor="text-red-700" />

                {/* AVAILABLE TO SELL */}
                <ComputedRow label="✅ AVAILABLE TO SELL"
                  fn={d => (balance[0] || 0) + getSectionDayTotal('routes', d) + getSectionDayTotal('brokers', d) - getSectionDayTotal('issues', d)}
                  bg="bg-green-700" textColor="text-white" />

                {/* SALES — auto */}
                <SectionHeader label="🏪 SALES (auto - shop deliveries)" color="bg-orange-600" section="sales" canAdd={false} />
                {Object.keys(ledger.sales || {}).sort().map(name => (
                  <DataRow key={name} section="sales" name={name} isAuto={true} />
                ))}
                <TotalRow label="SALES TOTAL" section="sales" bg="bg-orange-50" textColor="text-orange-700" />

                {/* EXPECTED BALANCE */}
                <ComputedRow label="📦 EXPECTED BALANCE"
                  fn={d => {
                    const prevBal = d === 1 ? (balance[0] || 0) : (summary[d-1]?.closingBalance || 0);
                    return prevBal + getSectionDayTotal('routes', d) + getSectionDayTotal('brokers', d) - getSectionDayTotal('issues', d) - getSectionDayTotal('sales', d);
                  }}
                  bg="bg-gray-800" textColor="text-yellow-300" />
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t flex items-center gap-4">
            <span>🔵 Routes & Sales = auto-fetched from system</span>
            <span>🟣 Brokers & Issues = click to edit</span>
            <span>🟢 Balance updates automatically</span>
          </div>
        </div>
      )}

      {/* Add row modal */}
      {showAddRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-80 shadow-xl">
            <h3 className="font-semibold mb-3">Add {showAddRow === 'brokers' ? 'Broker' : 'Issue'} Row</h3>
            <input value={newRowName} onChange={e => setNewRowName(e.target.value)}
              placeholder={showAddRow === 'brokers' ? 'e.g. JOHN BROKER' : 'e.g. SPILLED - ROUTE 3'}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3" autoFocus
              onKeyDown={e => e.key === 'Enter' && addRowMut.mutate({ section: showAddRow, name: newRowName.toUpperCase(), month, year })} />
            <div className="flex gap-2">
              <button onClick={() => addRowMut.mutate({ section: showAddRow, name: newRowName.toUpperCase(), month, year })}
                disabled={!newRowName || addRowMut.isPending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                Add
              </button>
              <button onClick={() => { setShowAddRow(null); setNewRowName(''); }}
                className="px-4 py-2 border rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
