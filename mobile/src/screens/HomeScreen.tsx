// src/screens/HomeScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPendingCollections, getAllCollectionsToday } from '../utils/offlineStore';
import { syncPendingCollections } from '../utils/syncService';

type Screen = 'home' | 'collection' | 'history';

interface Employee { id: number; name: string; code: string; role: string; }
interface Props { employee: Employee; onNavigate: (s: Screen) => void; onLogout: () => void; }

const ROLE_LABEL: Record<string, string> = {
  GRADER: 'Grader', SHOPKEEPER: 'Shopkeeper', DRIVER: 'Driver',
  FACTORY: 'Factory', ADMIN: 'Admin', MANAGER: 'Manager',
};

export default function HomeScreen({ employee, onNavigate, onLogout }: Props) {
  const [pendingCount, setPendingCount] = useState(0);
  const [todayCount,   setTodayCount]   = useState(0);
  const [todayLitres,  setTodayLitres]  = useState(0);
  const [syncing,      setSyncing]      = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [cnt, todayRows] = await Promise.all([
        getPendingCollections(),
        getAllCollectionsToday(),
      ]);
      setPendingCount(cnt.length);
      setTodayCount(todayRows.length);
      setTodayLitres(todayRows.reduce((s: number, r: any) => s + r.litres, 0));
    } catch {}
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    try {
      const r = await syncPendingCollections();
      if (r.synced > 0 || r.failed === 0) {
        Alert.alert('Sync Complete', r.synced > 0 ? `✓ ${r.synced} record${r.synced > 1 ? 's' : ''} uploaded to server` : 'Nothing to sync');
      } else {
        Alert.alert('Sync Failed', 'Could not reach server. Records saved locally and will sync when online.');
      }
      await load();
    } catch {
      Alert.alert('Sync Error', 'Could not reach server. Check your connection.');
    }
    setSyncing(false);
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = employee.name.split(' ')[0];
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{greeting},</Text>
          <Text style={s.name}>{firstName}</Text>
          <Text style={s.date}>{dateStr}</Text>
        </View>
        <View style={s.headerRight}>
          <View style={s.rolePill}>
            <Text style={s.rolePillText}>{ROLE_LABEL[employee.role] ?? employee.role}</Text>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={() =>
            Alert.alert('Logout', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: onLogout },
            ])}>
            <Text style={s.logoutIcon}>↩️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNumber}>{todayLitres.toFixed(0)}<Text style={s.statUnit}>L</Text></Text>
            <Text style={s.statLabel}>Today's Litres</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNumber}>{todayCount}</Text>
            <Text style={s.statLabel}>Farmers Served</Text>
          </View>
          <View style={[s.statCard, pendingCount > 0 && s.statCardWarn]}>
            <Text style={[s.statNumber, pendingCount > 0 && s.statWarnText]}>{pendingCount}</Text>
            <Text style={[s.statLabel, pendingCount > 0 && s.statWarnText]}>Unsynced</Text>
          </View>
        </View>

        {/* Sync alert */}
        {pendingCount > 0 && (
          <TouchableOpacity style={s.syncAlert} onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
            {syncing
              ? <ActivityIndicator color="#f59e0b" size="small" />
              : <Text style={s.syncAlertText}>⚠️  {pendingCount} record{pendingCount > 1 ? 's' : ''} pending sync — Tap to upload</Text>}
          </TouchableOpacity>
        )}

        {/* Actions */}
        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>

        <TouchableOpacity style={s.actionCard} onPress={() => onNavigate('collection')} activeOpacity={0.85}>
          <View style={[s.actionIcon, { backgroundColor: '#0d2e1a' }]}>
            <Text style={s.actionEmoji}>🥛</Text>
          </View>
          <View style={s.actionBody}>
            <Text style={s.actionTitle}>Record Collection</Text>
            <Text style={s.actionSub}>Log milk received from farmers</Text>
          </View>
          <Text style={s.actionChev}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionCard} onPress={() => onNavigate('history')} activeOpacity={0.85}>
          <View style={[s.actionIcon, { backgroundColor: '#0d1f33' }]}>
            <Text style={s.actionEmoji}>📋</Text>
          </View>
          <View style={s.actionBody}>
            <Text style={s.actionTitle}>View History</Text>
            <Text style={s.actionSub}>Today's saved collections</Text>
          </View>
          <Text style={s.actionChev}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionCard} onPress={() => onNavigate('statement')} activeOpacity={0.85}>
          <View style={[s.actionIcon, { backgroundColor: '#1a0d2e' }]}>
            <Text style={s.actionEmoji}>📄</Text>
          </View>
          <View style={s.actionBody}>
            <Text style={s.actionTitle}>Farmer Statement</Text>
            <Text style={s.actionSub}>Print monthly statement for a farmer</Text>
          </View>
          <Text style={s.actionChev}>›</Text>
        </TouchableOpacity>

        {(employee.role === 'DRIVER' || employee.role === 'ADMIN') && (
          <TouchableOpacity style={s.actionCard} onPress={() => onNavigate('driver')} activeOpacity={0.85}>
            <View style={[s.actionIcon, { backgroundColor: '#1a1000' }]}>
              <Text style={s.actionEmoji}>🚛</Text>
            </View>
            <View style={s.actionBody}>
              <Text style={s.actionTitle}>Driver Trip Log</Text>
              <Text style={s.actionSub}>Loads, drops, expenses</Text>
            </View>
            <Text style={s.actionChev}>›</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.actionCard} onPress={handleSync} disabled={syncing} activeOpacity={0.85}>
          <View style={[s.actionIcon, { backgroundColor: '#1a1200' }]}>
            {syncing ? <ActivityIndicator color={GREEN} size="small" /> : <Text style={s.actionEmoji}>☁️</Text>}
          </View>
          <View style={s.actionBody}>
            <Text style={s.actionTitle}>Sync to Server</Text>
            <Text style={s.actionSub}>{syncing ? 'Uploading...' : pendingCount === 0 ? 'All records synced ✓' : `${pendingCount} pending`}</Text>
          </View>
          <Text style={s.actionChev}>›</Text>
        </TouchableOpacity>

        {/* Staff info */}
        <View style={s.empCard}>
          <Text style={s.empCardCode}>{employee.code}</Text>
          <Text style={s.empCardName}>{employee.name}</Text>
          <Text style={s.empCardRole}>{ROLE_LABEL[employee.role] ?? employee.role}</Text>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const GREEN  = '#3ddc84';
const BG     = '#0d1f33';
const CARD   = '#132d48';
const BORDER = '#1e3d5c';

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 54, paddingBottom: 20, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  greeting:     { fontSize: 12, color: '#4a7090', letterSpacing: 1 },
  name:         { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 2 },
  date:         { fontSize: 12, color: '#4a7090', marginTop: 3 },
  headerRight:  { alignItems: 'flex-end', gap: 10 },
  rolePill:     { backgroundColor: '#1e3d5c', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  rolePillText: { color: GREEN, fontSize: 12, fontWeight: '700' },
  logoutBtn:    { backgroundColor: '#1e3d5c', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  logoutIcon:   { fontSize: 18 },
  scroll:       { flex: 1, padding: 20 },
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:     { flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  statCardWarn: { borderColor: '#f59e0b', backgroundColor: '#1a1200' },
  statNumber:   { fontSize: 26, fontWeight: '900', color: GREEN },
  statUnit:     { fontSize: 14 },
  statWarnText: { color: '#f59e0b' },
  statLabel:    { fontSize: 10, color: '#4a7090', marginTop: 4, textAlign: 'center' },
  syncAlert:    { backgroundColor: '#1a1200', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#f59e0b', alignItems: 'center' },
  syncAlertText:{ color: '#f59e0b', fontWeight: '700', fontSize: 13 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 3, marginBottom: 12, marginTop: 6 },
  actionCard:   { backgroundColor: CARD, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  actionIcon:   { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  actionEmoji:  { fontSize: 24 },
  actionBody:   { flex: 1 },
  actionTitle:  { fontSize: 15, fontWeight: '700', color: '#fff' },
  actionSub:    { fontSize: 12, color: '#4a7090', marginTop: 3 },
  actionChev:   { fontSize: 26, color: '#4a7090' },
  empCard:      { backgroundColor: CARD, borderRadius: 16, padding: 18, marginTop: 6, borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  empCardCode:  { fontSize: 11, color: GREEN, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  empCardName:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  empCardRole:  { fontSize: 12, color: '#4a7090', marginTop: 4 },
});
