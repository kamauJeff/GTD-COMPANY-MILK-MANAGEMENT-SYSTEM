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
    const maxDay = isMidMonth ? 15 : data.daysInMonth;
    const days = Array.from({ length: maxDay }, (_, i) => i + 1);
    const rows = days.map(d => {
      const l = data.dailyLitres[d] || 0;
      return `<tr><td>${d}</td><td>${l > 0 ? l.toFixed(1) : '–'}</td></tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: 'Courier New', monospace; font-size: 11px; margin: 15px; }
        .center { text-align: center; } .bold { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; }
        th { background: #f0f0f0; font-weight: bold; }
        .total-row { background: #e8f5e9; font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .header { font-size: 16px; font-weight: 900; }
        .section { font-size: 10px; color: #555; }
        .amount { font-size: 14px; font-weight: bold; }
        .dev { font-size: 8px; color: #777; margin-top: 10px; border-top: 1px solid #ccc; padding-top: 6px; text-align: center; }
      </style>
      </head><body>
      <div class="center bold header">GUTORIA DAIRIES</div>
      <div class="center section">Enquiries: 0793392375</div>
      <div class="divider"></div>
      <div class="center bold" style="font-size:13px">FARMER ${isMidMonth ? 'MID-MONTH' : 'END OF MONTH'} STATEMENT</div>
      <div class="center" style="font-size:11px;color:#555">${data.period}</div>
      <div class="center section">${MONTHS[month-1]} ${year}</div>
      <div class="divider"></div>
      <table>
        <tr><td class="bold">Farmer No:</td><td class="bold">${data.farmer.code}</td></tr>
        <tr><td>Name:</td><td class="bold">${data.farmer.name}</td></tr>
        <tr><td>Route:</td><td>${data.farmer.route?.name || '–'}</td></tr>
        <tr><td>Price/Litre:</td><td>KES ${data.farmer.pricePerLitre}</td></tr>
      </table>
      <div class="divider"></div>
      <div class="center bold section">DAILY MILK DELIVERIES</div>
      <table>
        <tr><th>Day</th><th>Litres</th><th>Day</th><th>Litres</th></tr>
        ${days.reduce((rows: string[], d, i) => {
          if (i % 2 === 0) {
            const d2 = days[i+1];
            const l1 = data.dailyLitres[d] || 0;
            const l2 = d2 ? (data.dailyLitres[d2] || 0) : null;
            rows.push(`<tr><td>${d}</td><td>${l1 > 0 ? l1.toFixed(1) : '–'}</td><td>${d2 || ''}</td><td>${d2 ? (l2 && l2 > 0 ? l2.toFixed(1) : '–') : ''}</td></tr>`);
          }
          return rows;
        }, []).join('')}
      </table>
      <div class="divider"></div>
      <table>
        <tr class="total-row"><td class="bold">Total Litres:</td><td class="bold amount">${data.totalLitres.toFixed(1)} L</td></tr>
        <tr><td>Gross Pay (@ KES ${data.farmer.pricePerLitre}/L):</td><td class="bold">KES ${data.grossPay.toLocaleString()}</td></tr>
        ${(Array.isArray(data.advances) ? data.advances : []).map((adv: any) => `<tr><td>Advance — ${adv.label}:</td><td class="bold" style="color:#e65100">- KES ${Number(adv.amount).toLocaleString()}</td></tr>`).join('')}
        ${data.bfBalance > 0 ? `<tr><td>Balance b/f:</td><td class="bold" style="color:#c62828">- KES ${data.bfBalance.toLocaleString()}</td></tr>` : ''}
        <tr><td>Total Deductions:</td><td class="bold" style="color:#e65100">- KES ${data.totalAdvances.toLocaleString()}</td></tr>
        <tr class="total-row"><td class="bold">NET PAY:</td><td class="bold amount" style="color:${data.netPay >= 0 ? '#1b5e20' : '#c62828'}">KES ${data.netPay.toLocaleString()}</td></tr>
      </table>
      <div class="divider"></div>
      <div class="center section">Payment Method: ${data.farmer.paymentMethod === 'MPESA' ? `M-Pesa: ${data.farmer.mpesaPhone || data.farmer.phone}` : `Bank: ${data.farmer.bankName} - ${data.farmer.bankAccount}`}</div>
      <div class="dev">
        <div class="bold" style="font-size:9px">JK SOFTWARE SOLUTIONS</div>
        <div>Dairy & Business Management Systems</div>
        <div>📞 +254 117 956 599</div>
      </div>
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
            {Array.from({ length: isMidMonth ? 15 : data.daysInMonth }, (_, i) => i + 1).map(d => {
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
            {data.bfBalance > 0 && <Row label="  Balance b/f" value={`- KES ${Number(data.bfBalance).toLocaleString()}`} negative />}
            {(Array.isArray(data.advances) ? data.advances : Object.entries(data.advances || {}).map(([label, amount]) => ({ label, amount }))).map((adv: any, i: number) => (
              <Row key={i} label={`  Advance — ${adv.label || adv[0]}`} value={`- KES ${Number(adv.amount || adv[1]).toLocaleString()}`} negative />
            ))}
            <View style={s.divider} />
            <Row label="Total Deductions" value={`- KES ${Number(data.totalDeductions || Number(data.totalAdvances) + Number(data.bfBalance || 0)).toLocaleString()}`} negative />
            <View style={s.divider} />
            <Row label="NET PAY" value={`KES ${Number(data.netPay).toLocaleString()}`} highlight netPay={data.netPay} />
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
        )}

        <TouchableOpacity style={s.printBtn} onPress={handlePrint}>
          <Text style={s.printBtnText}>🖨️ Print — {isMidMonth ? 'Mid Month (1–15)' : 'Full Month'}</Text>
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
