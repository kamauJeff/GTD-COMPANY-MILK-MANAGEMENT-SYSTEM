// src/screens/FarmerStatementScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Print from 'expo-print';
import { farmersApi, collectionsApi } from '../api/client';

interface Props {
  farmerCode: string;
  month: number;
  year: number;
  onClose: () => void;
}

export default function FarmerStatementScreen({ farmerCode, month, year, onClose }: Props) {
  const [loading, setLoading]     = useState(true);
  const [data, setData]           = useState<any>(null);
  const [isMidMonth, setMidMonth] = useState(false);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  useEffect(() => { load(); }, [isMidMonth]);

  async function load() {
    setLoading(true);
    try {
      const res = await farmersApi.statement({ farmerCode, month, year, isMidMonth });
      setData(res.data);
    } catch { Alert.alert('Error', 'Could not load statement'); }
    setLoading(false);
  }

  async function handlePrint() {
    if (!data) return;
    const startDay = isMidMonth ? 1 : (data.paidOn15th ? 16 : 1);
    const endDay   = isMidMonth ? 15 : data.daysInMonth;
    const days = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i);
    const rows = days.map(d => {
      const l = data.dailyLitres[d] || 0;
      return `<tr><td>${d}</td><td>${l > 0 ? l.toFixed(1) : '–'}</td></tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          width: 72mm;
          max-width: 72mm;
          padding: 2mm 3mm;
          color: #000;
          background: #fff;
        }
        .c   { text-align: center; }
        .r   { text-align: right; }
        .b   { font-weight: bold; }
        .s   { font-size: 11px; }
        .xs  { font-size: 9px; }
        .dash{ border-top: 1px dashed #000; margin: 4px 0; }
        .line{ border-top: 2px solid #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
        .co  { font-size: 17px; font-weight: 900; text-align: center; letter-spacing: 1px; }
        .ttl { font-size: 13px; font-weight: 900; text-align: center; }
        .day-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .day-table td { padding: 2px 3px; border-bottom: 1px dotted #bbb; }
        .day-table .dn { width: 20%; font-weight: bold; }
        .day-table .lv { width: 30%; text-align: right; }
        .total-line { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin: 3px 0; border-top: 2px solid #000; padding-top: 3px; }
        .deduct-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; padding-left: 4px; }
        .net-pay { font-size: 16px; font-weight: 900; text-align: center; border: 2px solid #000; padding: 4px; margin: 5px 0; }
      </style>
      </head><body>

      <div class="co">GUTORIA DAIRIES</div>
      <div class="c s">Milk Payment Statement</div>
      <div class="c xs">Tel: 0793392375</div>
      <div class="line"></div>

      <div class="ttl">${isMidMonth ? 'MID-MONTH STATEMENT' : 'END OF MONTH STATEMENT'}</div>
      <div class="c xs">${data.period}</div>
      <div class="dash"></div>

      <div class="row"><span>Farmer No:</span><span class="b">${data.farmer.code}</span></div>
      <div class="c b" style="font-size:14px;margin:3px 0;text-transform:uppercase">${data.farmer.name}</div>
      <div class="row"><span>Route:</span><span>${data.farmer.route?.name || '–'}</span></div>
      <div class="row"><span>Rate:</span><span class="b">KES ${data.farmer.pricePerLitre}/Litre</span></div>
      <div class="row"><span>Payment:</span><span>${data.farmer.paymentMethod === 'MPESA' ? 'M-Pesa: ' + (data.farmer.mpesaPhone || data.farmer.phone) : 'Bank'}</span></div>
      <div class="line"></div>

      <div class="c b s">DAILY MILK DELIVERIES</div>
      <div class="dash"></div>
      <table class="day-table">
        <tr>
          <td class="b">Day</td><td class="b lv">Litres</td>
          <td class="b">Day</td><td class="b lv">Litres</td>
          <td class="b">Day</td><td class="b lv">Litres</td>
        </tr>
        ${(() => {
          const rows = [];
          for (let i = 0; i < days.length; i += 3) {
            const cells = [days[i], days[i+1], days[i+2]].map(d => {
              if (!d) return '<td></td><td class="lv"></td>';
              const l = data.dailyLitres[d] || 0;
              return `<td class="dn">${d}</td><td class="lv">${l > 0 ? l.toFixed(1) : '–'}</td>`;
            }).join('');
            rows.push(`<tr>${cells}</tr>`);
          }
          return rows.join('');
        })()}
      </table>
      <div class="dash"></div>

      <div class="total-line"><span>TOTAL LITRES:</span><span>${data.totalLitres.toFixed(1)} L</span></div>
      <div class="row"><span>Gross Pay:</span><span class="b">KES ${Number(data.grossPay).toLocaleString()}</span></div>
      <div class="line"></div>

      <div class="c xs b">DEDUCTIONS</div>

      ${(data.deductionsList && data.deductionsList.length > 0
        ? data.deductionsList
        : [
            ...(data.bfBalance > 0 ? [{ label: 'Balance b/f', amount: data.bfBalance }] : []),
            ...(Array.isArray(data.advances) ? data.advances.map((a: any) => ({ label: `Advance — ${a.label}`, amount: a.amount })) : []),
          ]
      ).map((d: any) =>
        `<div class="deduct-row"><span>${d.label}:</span><span>- KES ${Number(d.amount).toLocaleString()}</span></div>`
      ).join('')}
      <div class="row b" style="border-top:1px dashed #000;margin-top:3px;padding-top:3px">
        <span>Total Deductions:</span>
        <span>KES ${Number(data.totalDeductions || Number(data.totalAdvances) + Number(data.bfBalance || 0)).toLocaleString()}</span>
      </div>
      <div class="line"></div>

      <div class="net-pay">NET PAY: KES ${Number(data.netPay).toLocaleString()}</div>

      <div class="c xs">*** OFFICIAL RECEIPT ***</div>
      <div class="c xs">Keep for your records</div>
      <div class="line" style="margin-top:6px"></div>
      <div class="c xs" style="margin-top:3px">Powered by JK SOFTWARE SOLUTIONS</div>
      <div class="c xs">+254 117 956 599</div>
      <div style="margin-top:10px"></div>

      </body></html>
    `;

    try { await Print.printAsync({ html }); }
    catch { Alert.alert('Print Error', 'Could not connect to printer'); }
  }

  if (loading) return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <ActivityIndicator color="#3ddc84" size="large" />
        <Text style={s.loadingText}>Loading statement...</Text>
      </View>
    </View>
  );

  if (!data) return null;

  const days = Array.from({ length: data.daysInMonth }, (_, i) => i + 1);

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Farmer Statement</Text>
            <Text style={s.sub}>{MONTHS[month-1]} {year} · {data.farmer.code}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Mid / End Month Toggle */}
        <View style={tog.wrap}>
          <TouchableOpacity
            style={[tog.btn, !isMidMonth && tog.btnActive]}
            onPress={() => setMidMonth(false)}>
            <Text style={[tog.label, !isMidMonth && tog.labelActive]}>📅 Full Month</Text>
            <Text style={[tog.sub, !isMidMonth && tog.subActive]}>1st – {data.daysInMonth}th</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tog.btn, isMidMonth && tog.btnMid]}
            onPress={() => setMidMonth(true)}>
            <Text style={[tog.label, isMidMonth && tog.labelActive]}>📅 Mid Month</Text>
            <Text style={[tog.sub, isMidMonth && tog.subActive]}>1st – 15th</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <ActivityIndicator color={GREEN} size="large" />
            <Text style={{ color: '#4a7090', marginTop: 12, fontSize: 13 }}>Loading {isMidMonth ? 'mid' : 'full'} month...</Text>
          </View>
        ) : (
        <ScrollView style={s.scroll}>
          {/* Farmer info */}
          <View style={s.section}>
            <Text style={s.farmerName}>{data.farmer.name}</Text>
            <Text style={s.farmerMeta}>{data.farmer.route?.name} · KES {data.farmer.pricePerLitre}/L · {data.period}</Text>
          </View>

          {/* Daily litres grid — 7 per row, only days in period */}
          <Text style={s.sectionTitle}>DAILY DELIVERIES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 16 }}>
            {Array.from(
              { length: isMidMonth ? 15 : (data.paidOn15th ? data.daysInMonth - 15 : data.daysInMonth) },
              (_, i) => isMidMonth ? i + 1 : (data.paidOn15th ? i + 16 : i + 1)
            ).map(d => {
              const litres = data.dailyLitres[d] || 0;
              return (
                <View key={d} style={[s.dayCell, litres > 0 && s.dayCellActive]}>
                  <Text style={s.dayNum}>{d}</Text>
                  <Text style={[s.dayLitres, litres > 0 && s.dayLitresActive]}>{litres > 0 ? litres.toFixed(1) : '–'}</Text>
                </View>
              );
            })}
          </View>

          {/* Totals */}
          <View style={s.totalsCard}>
            <Row label="Total Litres" value={`${data.totalLitres.toFixed(1)} L`} highlight />
            <Row label={`Gross Pay (@ KES ${data.farmer.pricePerLitre}/L)`} value={`KES ${Number(data.grossPay).toLocaleString()}`} />
            <View style={s.divider} />
            <Row label="DEDUCTIONS" value="" />
            {/* Use deductionsList if available (full breakdown), otherwise fallback */}
            {(data.deductionsList && data.deductionsList.length > 0
              ? data.deductionsList
              : [
                  ...(data.bfBalance > 0 ? [{ label: 'Balance b/f', amount: data.bfBalance }] : []),
                  ...(Array.isArray(data.advances) ? data.advances.map((a: any) => ({ label: `Advance — ${a.label}`, amount: a.amount })) : []),
                ]
            ).map((d: any, i: number) => (
              <Row key={i} label={`  ${d.label}`} value={`- KES ${Number(d.amount).toLocaleString()}`} negative />
            ))}
            <View style={s.divider} />
            <Row label="Total Deductions" value={`- KES ${Number(data.totalDeductions ?? Number(data.totalAdvances) + Number(data.bfBalance || 0)).toLocaleString()}`} negative />
            <View style={s.divider} />
            <Row label="NET PAY" value={`KES ${Number(data.netPay).toLocaleString()}`} highlight netPay={data.netPay} />
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
        )}

        <TouchableOpacity style={s.printBtn} onPress={handlePrint}>
          <Text style={s.printBtnText}>🖨️ Print — {data?.period || (isMidMonth ? 'Mid Month' : 'Full Month')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value, highlight, negative, netPay }: any) {
  return (
    <View style={rs.row}>
      <Text style={[rs.label, highlight && rs.labelBold]}>{label}</Text>
      <Text style={[rs.value, negative && rs.neg, highlight && { fontWeight: '900', fontSize: 16 }, netPay !== undefined && netPay < 0 && rs.neg, netPay !== undefined && netPay >= 0 && rs.pos]}>
        {value}
      </Text>
    </View>
  );
}

const GREEN = '#3ddc84'; const BG = '#0d1f33'; const CARD = '#132d48';
const s = StyleSheet.create({
  overlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal:       { backgroundColor: BG, borderRadius: 20, width: '95%', maxHeight: '92%', overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: '#1e3d5c' },
  title:       { fontSize: 16, fontWeight: '800', color: '#fff' },
  sub:         { fontSize: 11, color: '#4a7090', marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e3d5c', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:{ color: '#4a7090', fontWeight: '700' },
  scroll:      { padding: 16 },
  section:     { marginBottom: 16 },
  farmerName:  { fontSize: 18, fontWeight: '900', color: '#fff' },
  farmerMeta:  { fontSize: 12, color: '#4a7090', marginTop: 2 },
  sectionTitle:{ fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2, marginBottom: 10 },
  daysGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 20 },
  dayCell:     { width: 44, backgroundColor: CARD, borderRadius: 6, padding: 4, alignItems: 'center', borderWidth: 1, borderColor: '#1e3d5c' },
  dayCellActive:{ borderColor: GREEN, backgroundColor: '#0a2a14' },
  dayNum:      { fontSize: 9, color: '#4a7090' },
  dayLitres:   { fontSize: 11, color: '#4a7090', fontWeight: '600' },
  dayLitresActive: { color: GREEN, fontWeight: '900' },
  totalsCard:  { backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e3d5c' },
  divider:     { height: 1, backgroundColor: '#1e3d5c', marginVertical: 8 },
  printBtn:    { padding: 18, backgroundColor: '#0a1e10', borderTopWidth: 1, borderTopColor: '#1e3d5c', alignItems: 'center' },
  printBtnText:{ color: GREEN, fontWeight: '800', fontSize: 15 },
  loadingText: { color: '#4a7090', marginTop: 12 },
});
const rs = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label:     { fontSize: 12, color: '#4a7090', flex: 1 },
  labelBold: { color: '#fff', fontWeight: '700' },
  value:     { fontSize: 12, color: '#fff', fontWeight: '600', textAlign: 'right' },
  neg:       { color: '#f87171' },
  pos:       { color: GREEN, fontSize: 15, fontWeight: '900' },
});
const tog = StyleSheet.create({
  wrap:        { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, marginBottom: 4, gap: 8 },
  btn:         { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0d1f33', borderWidth: 1.5, borderColor: '#1e3d5c', alignItems: 'center' },
  btnActive:   { backgroundColor: '#0a1e10', borderColor: GREEN },
  btnMid:      { backgroundColor: '#1a0d2e', borderColor: '#a78bfa' },
  label:       { color: '#4a7090', fontWeight: '700', fontSize: 12 },
  labelActive: { color: GREEN },
  sub:         { color: '#2a4d6a', fontSize: 10, marginTop: 2 },
  subActive:   { color: '#a3e4c0' },
});
