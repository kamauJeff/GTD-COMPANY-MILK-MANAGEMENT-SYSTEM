import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { factoryApi } from '../../api/client';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

interface Props {
  graders: any[];
  month: number;
  year: number;
}

export function LiquidCheck({ graders, month, year }: Props) {
  const qc = useQueryClient();
  const [selectedGrader, setSelectedGrader] = useState('');
  const [checkDate, setCheckDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedInput, setReceivedInput] = useState('');
  const [notes, setNotes] = useState('');
  const [chargeVariance, setChargeVariance] = useState(false);

  // Auto-fetch grader check data when grader + date selected
  const { data: checkData, isLoading: checking, refetch } = useQuery({
    queryKey: ['grader-check', selectedGrader, checkDate],
    queryFn: () => factoryApi.graderCheck({ graderId: selectedGrader, date: checkDate }),
    enabled: !!selectedGrader && !!checkDate,
  });
  const check = checkData?.data;

  const received = receivedInput !== '' ? Number(receivedInput) : check?.totalReceived ?? 0;
  const collected = check?.totalCollected ?? 0;
  const variance = received - collected;
  const varianceKes = Math.abs(variance) * 46;

  const saveMut = useMutation({
    mutationFn: () => factoryApi.saveGraderCheck({
      graderId: Number(selectedGrader),
      date: checkDate,
      totalReceived: received,
      notes,
      chargeVariance,
      periodMonth: month,
      periodYear: year,
    }),
    onSuccess: () => {
      alert(`✅ Liquid check saved${chargeVariance && variance < 0 ? `\nVariance of KES ${varianceKes.toLocaleString()} charged to payroll` : ''}`);
      qc.invalidateQueries({ queryKey: ['grader-check'] });
      qc.invalidateQueries({ queryKey: ['liquid'] });
      setReceivedInput('');
      setNotes('');
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to save'),
  });

  // Monthly liquid grid
  const { data: gridData, isLoading: loadingGrid } = useQuery({
    queryKey: ['liquid', month, year],
    queryFn: () => factoryApi.liquidGrid({ month, year }),
  });
  const liquidGrid = gridData?.data?.grid ?? [];
  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="space-y-4">
      {/* Smart Grader Check Panel */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Daily Grader Check</h3>
        <p className="text-xs text-gray-400 mb-4">Select a grader — system auto-fetches what they collected from farmers vs what arrived at the factory</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Grader *</label>
            <select value={selectedGrader} onChange={e => { setSelectedGrader(e.target.value); setReceivedInput(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Select grader...</option>
              {graders.map((g: any) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date *</label>
            <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Received at Factory (L)
              {check && <span className="text-blue-500 ml-1">auto: {check.totalReceived.toFixed(1)}</span>}
            </label>
            <input type="number" value={receivedInput} onChange={e => setReceivedInput(e.target.value)}
              placeholder={check ? check.totalReceived.toFixed(1) : '0.0'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        {/* Check Results */}
        {checking && <div className="text-center py-4 text-gray-400 text-sm">Fetching collection data...</div>}

        {check && !checking && (
          <div className="space-y-3">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <div className="text-xs text-blue-400 mb-1">Collected from Farmers</div>
                <div className="text-2xl font-bold text-blue-700">{collected.toFixed(2)} L</div>
                <div className="text-xs text-blue-400">{check.farmerCount} farmers</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <div className="text-xs text-green-400 mb-1">Received at Factory</div>
                <div className="text-2xl font-bold text-green-700">{received.toFixed(2)} L</div>
                <div className="text-xs text-green-400">{check.route?.name || 'No route'}</div>
              </div>
              <div className={`rounded-xl p-3 text-center border ${variance < 0 ? 'bg-red-50 border-red-200' : variance > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`text-xs mb-1 ${variance < 0 ? 'text-red-400' : variance > 0 ? 'text-yellow-500' : 'text-gray-400'}`}>Variance</div>
                <div className={`text-2xl font-bold ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {variance >= 0 ? '+' : ''}{variance.toFixed(2)} L
                </div>
                <div className={`text-xs ${variance < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {variance < 0 ? `KES ${varianceKes.toLocaleString()} deficit` : variance > 0 ? 'Excess' : 'Perfect'}
                </div>
              </div>
            </div>

            {/* Variance alert */}
            {variance < 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <div className="font-semibold text-red-700">Missing Litres Detected</div>
                    <div className="text-sm text-red-600 mt-0.5">
                      {check.grader.name} collected {collected.toFixed(2)}L but only {received.toFixed(2)}L arrived at factory.
                      <strong> {Math.abs(variance).toFixed(2)}L ({varianceKes.toLocaleString()} KES) is unaccounted for.</strong>
                    </div>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input type="checkbox" checked={chargeVariance} onChange={e => setChargeVariance(e.target.checked)}
                        className="w-4 h-4 accent-red-600" />
                      <span className="text-sm text-red-700 font-medium">
                        Charge KES {varianceKes.toLocaleString()} to {check.grader.name}'s payroll for {new Date(year, month-1).toLocaleString('default', {month:'long'})} {year}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {variance === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                <CheckCircle className="text-green-500" size={18} />
                <span className="text-green-700 font-medium">Perfect match — all collected milk accounted for!</span>
              </div>
            )}

            {variance > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
                <TrendingUp className="text-yellow-500" size={18} />
                <span className="text-yellow-700 text-sm">More arrived at factory than collected — check for receipts from other graders.</span>
              </div>
            )}

            {/* Farmer breakdown */}
            {check.breakdown && check.breakdown.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Farmer Breakdown ({check.breakdown.length})</div>
                <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-50 rounded-xl p-2">
                  {check.breakdown.map((b: any, i: number) => (
                    <div key={i} className="flex justify-between items-center px-3 py-1.5 bg-white rounded-lg text-xs">
                      <span className="text-gray-400 font-mono">{b.farmerCode}</span>
                      <span className="text-gray-700">{b.farmerName}</span>
                      <span className="font-bold text-green-700">{b.litres.toFixed(1)} L</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saveMut.isPending ? 'Saving...' : `Save Check${chargeVariance && variance < 0 ? ' & Charge Payroll' : ''}`}
            </button>
          </div>
        )}

        {!selectedGrader && (
          <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-xl">
            Select a grader above to see their daily collection data
          </div>
        )}
      </div>

      {/* Monthly Grid */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
          <div className="font-medium text-gray-700 text-sm">Monthly Liquid Records</div>
        </div>
        {loadingGrid ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
        ) : liquidGrid.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No liquid records yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${200 + daysInMonth * 70}px` }}>
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="sticky left-0 bg-gray-800 px-3 py-2 text-left min-w-[160px] z-10">ROUTE / GRADER</th>
                  {Array.from({length: daysInMonth}, (_, i) => i+1).map(d => (
                    <th key={d} className="px-1 py-2 text-center w-16">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liquidGrid.map((row: any, idx: number) => (
                  <tr key={idx} className={`border-b ${idx%2===0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50`}>
                    <td className="sticky left-0 px-3 py-2 font-medium text-gray-700 border-r bg-inherit z-10 text-xs">
                      <div>{row.route?.name}</div>
                      {row.grader && <div className="text-gray-400 text-xs">{row.grader.name}</div>}
                    </td>
                    {Array.from({length: daysInMonth}, (_, i) => i+1).map(d => {
                      const cell = row.days?.[d];
                      const v = cell ? Number(cell.variance) : null;
                      return (
                        <td key={d} className="px-1 py-2 text-center border-r border-gray-100">
                          {cell ? (
                            <div className="space-y-0.5">
                              <div className="text-gray-700 font-medium">{Number(cell.received).toFixed(0)}</div>
                              <div className={`text-xs font-bold ${v! < 0 ? 'text-red-500' : v! > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                                {v! >= 0 ? '+' : ''}{v!.toFixed(0)}
                              </div>
                            </div>
                          ) : <span className="text-gray-200">–</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t">
              Top row = litres received · Bottom = variance (red = missing, green = excess)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
