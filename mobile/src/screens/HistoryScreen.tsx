// src/screens/HistoryScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { getAllCollectionsToday, getPendingCollections } from '../utils/offlineStore';
import { syncPendingCollections } from '../utils/syncService';
import FarmerStatementScreen from './FarmerStatementScreen';

interface Employee { id: number; name: string; code: string; role: string; }
interface Props { employee: Employee; onBack: () => void; }

export default function HistoryScreen({ employee, onBack }: Props) {
  const [records, setRecords]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [showStatement, setShowStatement] = useState<{ farmerCode: string; month: number; year: number } | null>(null);
  const now = new Date();

  const load = useCallback(async () => {
    try {
      const rows = await getAllCollectionsToday();
      setRecords(rows);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    await syncPendingCollections().catch(() => {});
    await load();
    setSyncing(false);
  }

  const totalLitres = records.reduce((s, r) => s + Number(r.litres), 0);
  const pendingRows = records.filter(r => r.synced === 0);
  const syncedRows  = records.filter(r => r.synced === 1);
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View style={s.root}>
      {showStatement && (
        <FarmerStatementScreen
          farmerCode={showStatement.farmerCode}
          month={showStatement.month}
          year={showStatement.year}
          onClose={() => setShowStatement(null)}
        />
      )}

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Collection History</Text>
          <Text style={s.headerSub}>{today}</Text>
        </View>
        {pendingRows.length > 0 && (
          <TouchableOpacity style={s.syncBtn} onPress={handleSync} disabled={syncing}>
            {syncing
              ? <ActivityIndicator color={GREEN} size="small" />
              : <Text style={s.syncBtnText}>Sync {pendingRows.length}</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator color={GREEN} size="large" />
          </View>
        ) : records.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyTitle}>No collections today</Text>
            <Text style={s.emptySub}>Records you save will appear here</Text>
          </View>
        ) : (
          <>
            {/* Summary */}
            <View style={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={s.summaryVal}>{totalLitres.toFixed(1)}<Text style={{ fontSize: 14 }}>L</Text></Text>
                <Text style={s.summaryLabel}>Total Litres</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={s.summaryVal}>{records.length}</Text>
                <Text style={s.summaryLabel}>Farmers</Text>
              </View>
              <View style={[s.summaryCard, pendingRows.length > 0 && s.summaryWarn]}>
                <Text style={[s.summaryVal, pendingRows.length > 0 && { color: '#f59e0b' }]}>{pendingRows.length}</Text>
                <Text style={[s.summaryLabel, pendingRows.length > 0 && { color: '#a07020' }]}>Unsynced</Text>
              </View>
            </View>

            {pendingRows.length > 0 && (
              <>
                <Text style={s.groupLabel}>⏳ PENDING SYNC ({pendingRows.length})</Text>
                {pendingRows.map(r => (
                  <RecordRow key={r.id} record={r}
                    onStatement={(code: string) => setShowStatement({ farmerCode: code, month: now.getMonth()+1, year: now.getFullYear() })} />
                ))}
              </>
            )}

            {syncedRows.length > 0 && (
              <>
                <Text style={[s.groupLabel, { marginTop: 16 }]}>✓ SYNCED ({syncedRows.length})</Text>
                {syncedRows.map(r => (
                  <RecordRow key={r.id} record={r} synced
                    onStatement={(code: string) => setShowStatement({ farmerCode: code, month: now.getMonth()+1, year: now.getFullYear() })} />
                ))}
              </>
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function RecordRow({ record, synced, onStatement }: { record: any; synced?: boolean; onStatement?: (code: string) => void }) {
  const dt = record.collected_at || record.collectedAt || new Date().toISOString();
  const time = new Date(dt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  const farmerCode = record.farmer_code || record.farmerCode || '';
  const farmerName = record.farmer_name || `Farmer #${record.farmer_id || record.farmerId}`;
  return (
    <View style={[rs.row, synced && rs.rowSynced]}>
      <View style={rs.timeWrap}>
        <Text style={rs.time}>{time}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rs.farmerName}>{farmerName}</Text>
        {farmerCode ? <Text style={rs.code}>{farmerCode}</Text> : null}
        <Text style={rs.status}>{synced ? '✓ Uploaded' : '⏳ Pending sync'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={rs.litres}>{Number(record.litres).toFixed(1)}L</Text>
        {synced && farmerCode && onStatement && (
          <TouchableOpacity onPress={() => onStatement(farmerCode)}
            style={{ backgroundColor: '#0a1e10', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#1e4d2a' }}>
            <Text style={{ color: '#3ddc84', fontSize: 9, fontWeight: '700' }}>📄 STATEMENT</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const GREEN  = '#3ddc84';
const BG     = '#0d1f33';
const CARD   = '#132d48';
const BORDER = '#1e3d5c';

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 18, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { color: GREEN, fontSize: 26, lineHeight: 30 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: '#4a7090', marginTop: 2 },
  syncBtn:     { backgroundColor: '#1a1200', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#f59e0b' },
  syncBtnText: { color: '#f59e0b', fontWeight: '700', fontSize: 12 },
  scroll:      { flex: 1, padding: 20 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty:       { alignItems: 'center', paddingTop: 80 },
  emptyIcon:   { fontSize: 52, marginBottom: 16 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptySub:    { fontSize: 13, color: '#4a7090' },
  summaryRow:  { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  summaryWarn: { borderColor: '#f59e0b', backgroundColor: '#1a1200' },
  summaryVal:  { fontSize: 24, fontWeight: '900', color: GREEN },
  summaryLabel:{ fontSize: 10, color: '#4a7090', marginTop: 4, textAlign: 'center' },
  groupLabel:  { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2.5, marginBottom: 10 },
});

const rs = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: BORDER, gap: 12 },
  rowSynced:  { borderColor: '#1e4d2a', backgroundColor: '#0a1e10' },
  timeWrap:   { width: 46 },
  time:       { fontSize: 12, color: '#4a7090', fontWeight: '600' },
  farmerName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  code:       { color: '#4a7090', fontSize: 11, marginTop: 1 },
  status:     { fontSize: 11, color: '#4a7090', marginTop: 2 },
  litres:     { color: GREEN, fontWeight: '900', fontSize: 16 },
});
