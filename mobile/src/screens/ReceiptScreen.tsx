// src/screens/ReceiptScreen.tsx
import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import * as Print from 'expo-print';

interface Collection {
  id: number;
  farmerName: string;
  farmerCode: string;
  litres: number;
  time: string;
  receiptNo?: string;
}

interface Props {
  collection: Collection;
  graderName: string;
  routeName: string;
  cumulative: number;   // total litres for this farmer today
  onClose: () => void;
}

function padZero(n: number) { return n.toString().padStart(2, '0'); }

function generateReceiptNo() {
  const now = new Date();
  return `GTD${now.getFullYear()}${padZero(now.getMonth()+1)}${padZero(now.getDate())}${padZero(now.getHours())}${padZero(now.getMinutes())}${padZero(now.getSeconds())}`;
}

export default function ReceiptScreen({ collection, graderName, routeName, cumulative, onClose }: Props) {
  const receiptNo = collection.receiptNo || generateReceiptNo();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .large { font-size: 16px; }
        .xlarge { font-size: 20px; font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .highlight { font-size: 28px; font-weight: bold; text-align: center; margin: 6px 0; }
        .small { font-size: 10px; }
        .footer { font-size: 9px; text-align: center; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="center bold xlarge">GUTORIA DAIRIES</div>
      <div class="center small">Enquiries: 0793392375</div>
      <div class="divider"></div>
      <div class="row"><span>Receipt No:</span><span class="bold">${receiptNo}</span></div>
      <div class="row"><span>Date:</span><span>${dateStr}</span></div>
      <div class="row"><span>Time:</span><span class="bold">${timeStr}</span></div>
      <div class="row"><span>Route:</span><span>${routeName}</span></div>
      <div class="divider"></div>
      <div class="row"><span>Farmer No:</span><span class="bold">${collection.farmerCode}</span></div>
      <div class="row large bold center">${collection.farmerName}</div>
      <div class="divider"></div>
      <div class="center small">LITRES WEIGHED</div>
      <div class="highlight">${collection.litres.toFixed(1)} L</div>
      <div class="divider"></div>
      <div class="row"><span>Cumulative Today:</span><span class="bold">${cumulative.toFixed(1)} L</span></div>
      <div class="divider"></div>
      <div class="row"><span>Served by:</span><span class="bold">${graderName}</span></div>
      <div class="divider"></div>
      <div class="footer">*** Thank you for your business ***</div>
      <div style="font-size:8px;text-align:center;color:#555;margin-top:6px;border-top:1px solid #ccc;padding-top:4px">
        <div style="font-weight:bold">JK SOFTWARE SOLUTIONS</div>
        <div>Dairy &amp; Business Management Systems</div>
        <div>&#128222; +254 117 956 599</div>
      </div>
    </body>
    </html>
  `;

  const handlePrint = async () => {
    try {
      await Print.printAsync({ html: receiptHTML });
    } catch (e) {
      Alert.alert('Print Error', 'Could not connect to printer. Make sure Bluetooth printer is paired.');
    }
  };

  const handleShare = async () => {
    try {
      const text = [
        '==============================',
        '        GUTORIA DAIRIES       ',
        '    Enquiries: 0793392375     ',
        '==============================',
        `Receipt No: ${receiptNo}`,
        `Date: ${dateStr}`,
        `Time: ${timeStr}`,
        `Route: ${collection.routeName || routeName}`,
        '------------------------------',
        `Farmer No: ${collection.farmerCode}`,
        `Name: ${collection.farmerName}`,
        '------------------------------',
        `LITRES WEIGHED: ${collection.litres.toFixed(1)} L`,
        `Cumulative Today: ${cumulative.toFixed(1)} L`,
        '------------------------------',
        `Served by: ${graderName}`,
        '------------------------------',
        '*** Thank you for your business ***',
        '==============================',
        'JK SOFTWARE SOLUTIONS',
        'Dairy & Business Management Systems',
        'Phone: +254 117 956 599',
        '*** Thank you ***',
      ].join('\n');
      await Share.share({ message: text, title: `Receipt ${receiptNo}` });
    } catch {}
  };

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Receipt preview */}
          <View style={s.receipt}>
            <Text style={s.companyName}>GUTORIA DAIRIES</Text>
            <Text style={s.enquiry}>Enquiries: 0793392375</Text>
            <View style={s.divider} />

            <View style={s.row}><Text style={s.label}>Receipt No:</Text><Text style={s.value}>{receiptNo}</Text></View>
            <View style={s.row}><Text style={s.label}>Date:</Text><Text style={s.value}>{dateStr}</Text></View>
            <View style={s.row}><Text style={s.label}>Time:</Text><Text style={[s.value, s.bold]}>{timeStr}</Text></View>
            <View style={s.row}><Text style={s.label}>Route:</Text><Text style={[s.value, s.bold]}>{(collection as any).routeName || routeName}</Text></View>
            <View style={s.divider} />

            <View style={s.row}><Text style={s.label}>Farmer No:</Text><Text style={[s.value, s.bold]}>{collection.farmerCode}</Text></View>
            <Text style={s.farmerName}>{collection.farmerName}</Text>
            <View style={s.divider} />

            <Text style={s.litresLabel}>LITRES WEIGHED</Text>
            <Text style={s.litresBig}>{collection.litres.toFixed(1)} L</Text>
            <View style={s.divider} />

            <View style={s.row}><Text style={s.label}>Cumulative Today:</Text><Text style={[s.value, s.bold]}>{cumulative.toFixed(1)} L</Text></View>
            <View style={s.divider} />

            <View style={s.row}><Text style={s.label}>Served by:</Text><Text style={[s.value, s.bold]}>{graderName}</Text></View>
            <View style={s.divider} />

            <Text style={s.footer}>*** Thank you for your business ***</Text>
            <View style={{borderTopWidth:1, borderColor:'#ddd', marginTop:6, paddingTop:4}}>
              <Text style={[s.footer, {fontWeight:'700', fontSize:10}]}>JK SOFTWARE SOLUTIONS</Text>
              <Text style={s.footer}>Dairy & Business Management Systems</Text>
              <Text style={s.footer}>📞 +254 117 956 599</Text>
            </View>
          </View>
        </ScrollView>

        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity style={s.printBtn} onPress={handlePrint}>
            <Text style={s.printBtnText}>🖨️ Print Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
            <Text style={s.shareBtnText}>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal:       { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxHeight: '90%', overflow: 'hidden' },
  receipt:     { padding: 20, backgroundColor: '#fff' },
  companyName: { fontSize: 22, fontWeight: '900', textAlign: 'center', fontFamily: 'monospace', letterSpacing: 2 },
  enquiry:     { fontSize: 11, textAlign: 'center', color: '#555', marginBottom: 4 },
  divider:     { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#aaa', marginVertical: 8 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  label:       { fontSize: 12, color: '#555', fontFamily: 'monospace' },
  value:       { fontSize: 12, fontFamily: 'monospace' },
  bold:        { fontWeight: '700' },
  farmerName:  { fontSize: 16, fontWeight: '800', textAlign: 'center', marginVertical: 6, fontFamily: 'monospace' },
  litresLabel: { fontSize: 11, textAlign: 'center', color: '#666', marginTop: 4 },
  litresBig:   { fontSize: 36, fontWeight: '900', textAlign: 'center', color: '#000', marginVertical: 4 },
  footer:      { fontSize: 10, textAlign: 'center', color: '#666', marginTop: 2 },
  actions:     { flexDirection: 'row', borderTopWidth: 1, borderColor: '#eee' },
  printBtn:    { flex: 2, padding: 16, backgroundColor: '#1a3a1a', alignItems: 'center' },
  printBtnText:{ color: '#3ddc84', fontWeight: '700', fontSize: 14 },
  shareBtn:    { flex: 1, padding: 16, backgroundColor: '#1a2d4a', alignItems: 'center' },
  shareBtnText:{ color: '#60a5fa', fontWeight: '700', fontSize: 13 },
  closeBtn:    { flex: 1, padding: 16, backgroundColor: '#2a1a1a', alignItems: 'center' },
  closeBtnText:{ color: '#f87171', fontWeight: '700', fontSize: 13 },
});
