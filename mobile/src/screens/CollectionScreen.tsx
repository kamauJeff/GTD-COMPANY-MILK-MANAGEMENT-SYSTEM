// src/screens/CollectionScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, FlatList,
} from 'react-native';
import { savePendingCollection, searchCachedFarmers, getCachedFarmersByRoute, getCachedFarmerCount } from '../utils/offlineStore';
import { syncPendingCollections, downloadFarmersForGrader } from '../utils/syncService';
import { farmersApi } from '../api/client';

interface Employee { id: number; name: string; code: string; role: string; }
interface Props { employee: Employee; onBack: () => void; routeId?: number; routeName?: string; }

export default function CollectionScreen({ employee, onBack, routeId, routeName }: Props) {
  const [search, setSearch]                 = useState('');
  const [farmers, setFarmers]               = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [litres, setLitres]                 = useState('');
  const [saving, setSaving]                 = useState(false);
  const [searching, setSearching]           = useState(false);
  const [sessionSaved, setSessionSaved]     = useState<any[]>([]);
  const [isOnline, setIsOnline]             = useState(true);
  const [cachedCount, setCachedCount]       = useState(0);
  const [syncing, setSyncing]               = useState(false);
  const litresRef = useRef<TextInput>(null);
  const debounceRef = useRef<any>(null);

  // On mount — check cache and try to sync
  useEffect(() => {
    getCachedFarmerCount().then(setCachedCount);
    // Try background sync
    syncPendingCollections()
      .then(r => { if (r.synced > 0) Alert.alert('✅ Synced', `${r.synced} pending records uploaded.`); })
      .catch(() => setIsOnline(false));
  }, []);

  // Search farmers — use cache first, fallback to API
  useEffect(() => {
    if (search.length < 2) { setFarmers([]); return; }
    if (selectedFarmer && search === selectedFarmer.name) return;
    clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        // Try cache first
        const cached = await searchCachedFarmers(search, routeId);
        if (cached.length > 0) {
          setFarmers(cached);
          setSearching(false);
          return;
        }
        // Fallback to API if online
        const r = await farmersApi.list({ search, limit: 15, routeId });
        setFarmers(r.data?.data ?? []);
        setIsOnline(true);
      } catch {
        // API failed — use cache only
        const cached = await searchCachedFarmers(search);
        setFarmers(cached);
        setIsOnline(false);
      }
      setSearching(false);
    }, 350);
  }, [search]);

  function selectFarmer(f: any) {
    setSelectedFarmer(f);
    setSearch(f.name);
    setFarmers([]);
    setTimeout(() => litresRef.current?.focus(), 150);
  }

  async function handleSave() {
    if (!selectedFarmer) { Alert.alert('Select Farmer', 'Search and select a farmer first.'); return; }
    const l = parseFloat(litres);
    if (!litres || isNaN(l) || l <= 0) { Alert.alert('Invalid Amount', 'Enter a valid number of litres.'); return; }
    if (l > 300) {
      Alert.alert('Unusually Large', `${l}L seems very high. Are you sure?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save Anyway', onPress: doSave },
      ]);
      return;
    }
    doSave();
  }

  async function doSave() {
    const l = parseFloat(litres);
    setSaving(true);
    try {
      await savePendingCollection({
        farmerId:    selectedFarmer.id,
        farmerName:  selectedFarmer.name,
        routeId:     selectedFarmer.routeId ?? selectedFarmer.route?.id ?? routeId,
        graderId:    employee.id,
        litres:      l,
        collectedAt: new Date().toISOString(),
      });

      setSessionSaved(prev => [{
        id: Date.now(),
        farmerName: selectedFarmer.name,
        farmerCode: selectedFarmer.code,
        litres: l,
        time: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
      }, ...prev]);

      setSelectedFarmer(null);
      setSearch('');
      setLitres('');
      setFarmers([]);

      // Background sync
      syncPendingCollections().catch(() => {});
    } catch {
      Alert.alert('Save Failed', 'Could not save. Please try again.');
    }
    setSaving(false);
  }

  async function handleManualSync() {
    setSyncing(true);
    const result = await syncPendingCollections();
    setSyncing(false);
    if (result.synced > 0) {
      Alert.alert('✅ Sync Complete', `${result.synced} records uploaded successfully.`);
    } else {
      Alert.alert('Sync', 'No pending records to sync.');
    }
  }

  const sessionTotal = sessionSaved.reduce((s, r) => s + r.litres, 0);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Record Collection</Text>
          <Text style={s.headerSub}>
            {routeName ? `📍 ${routeName}  · ` : ''}{new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </View>
        {sessionSaved.length > 0 && (
          <View style={s.sessionBadge}>
            <Text style={s.sessionBadgeVal}>{sessionTotal.toFixed(0)}L</Text>
            <Text style={s.sessionBadgeLabel}>{sessionSaved.length} saved</Text>
          </View>
        )}
      </View>

      {/* Offline / cache banner */}
      {!isOnline && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineText}>📵 Offline — using cached data ({cachedCount} farmers)</Text>
        </View>
      )}

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Search */}
        <Text style={s.label}>FARMER NAME OR CODE</Text>
        <View style={s.searchWrap}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder={cachedCount > 0 ? `Search ${cachedCount} farmers...` : 'Search farmer...'}
            placeholderTextColor="#4a6585"
            value={search}
            onChangeText={t => {
              setSearch(t);
              if (selectedFarmer && t !== selectedFarmer.name) setSelectedFarmer(null);
            }}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator color={GREEN} style={s.searchSpinner} size="small" />}
        </View>

        {/* Dropdown */}
        {farmers.length > 0 && (
          <View style={s.dropdown}>
            {farmers.map(f => (
              <TouchableOpacity key={f.id} style={s.dropdownRow} onPress={() => selectFarmer(f)}>
                <View style={s.farmerAvatar}>
                  <Text style={s.farmerAvatarLetter}>{f.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.farmerName}>{f.name}</Text>
                  <Text style={s.farmerMeta}>{f.code}  ·  {f.route?.name ?? '—'}</Text>
                </View>
                <Text style={{ color: GREEN, fontSize: 20, fontWeight: '700' }}>+</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected farmer */}
        {selectedFarmer && (
          <View style={s.selectedChip}>
            <View style={s.selectedDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.selectedName}>{selectedFarmer.name}</Text>
              <Text style={s.selectedMeta}>{selectedFarmer.code} · {selectedFarmer.route?.name ?? '—'}</Text>
            </View>
            <TouchableOpacity onPress={() => { setSelectedFarmer(null); setSearch(''); }}>
              <Text style={s.selectedClear}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Litres */}
        <Text style={[s.label, { marginTop: 20 }]}>LITRES COLLECTED</Text>
        <TextInput
          ref={litresRef}
          style={s.litresInput}
          placeholder="0.0"
          placeholderTextColor="#1e3d5c"
          value={litres}
          onChangeText={setLitres}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        {/* Quick preset */}
        <View style={s.quickRow}>
          {['5', '10', '15', '20', '25', '30', '40', '50'].map(v => (
            <TouchableOpacity key={v} style={[s.quickBtn, litres === v && s.quickBtnActive]} onPress={() => setLitres(v)}>
              <Text style={[s.quickBtnText, litres === v && s.quickBtnTextActive]}>{v}L</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, (!selectedFarmer || !litres || saving) && s.saveBtnOff]}
          onPress={handleSave}
          disabled={!selectedFarmer || !litres || saving}
          activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator color="#0d1f33" />
            : <Text style={s.saveBtnText}>💾  SAVE COLLECTION</Text>}
        </TouchableOpacity>

        {/* Manual sync button */}
        <TouchableOpacity style={s.syncBtn} onPress={handleManualSync} disabled={syncing}>
          <Text style={s.syncBtnText}>{syncing ? '⟳ Syncing...' : '↑ Sync to Server'}</Text>
        </TouchableOpacity>

        {/* Session list */}
        {sessionSaved.length > 0 && (
          <>
            <Text style={[s.label, { marginTop: 28 }]}>THIS SESSION  ·  {sessionTotal.toFixed(1)}L total</Text>
            {sessionSaved.map(r => (
              <View key={r.id} style={s.savedRow}>
                <Text style={s.savedTime}>{r.time}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.savedFarmer}>{r.farmerName}</Text>
                  <Text style={s.savedCode}>{r.farmerCode}</Text>
                </View>
                <Text style={s.savedLitres}>{r.litres}L</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN  = '#3ddc84';
const BG     = '#0d1f33';
const CARD   = '#132d48';
const BORDER = '#1e3d5c';

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: BG },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 18, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  backArrow:       { color: GREEN, fontSize: 26, lineHeight: 30 },
  headerTitle:     { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:       { fontSize: 11, color: '#4a7090', marginTop: 2 },
  sessionBadge:    { backgroundColor: '#0d2e1a', borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1e4d2a' },
  sessionBadgeVal: { fontSize: 16, fontWeight: '900', color: GREEN },
  sessionBadgeLabel: { fontSize: 10, color: '#3a8a50', marginTop: 1 },
  offlineBanner:   { backgroundColor: '#2d1800', padding: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#5d3000' },
  offlineText:     { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  scroll:          { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  label:           { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2.5, marginBottom: 8 },
  searchWrap:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  input:           { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15 },
  searchSpinner:   { position: 'absolute', right: 16 },
  dropdown:        { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 10, overflow: 'hidden' },
  dropdownRow:     { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 12 },
  farmerAvatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0d2e1a', alignItems: 'center', justifyContent: 'center' },
  farmerAvatarLetter: { color: GREEN, fontWeight: '900', fontSize: 16 },
  farmerName:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  farmerMeta:      { color: '#4a7090', fontSize: 11, marginTop: 2 },
  selectedChip:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d2e1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e4d2a', gap: 12, marginBottom: 4 },
  selectedDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  selectedName:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  selectedMeta:    { color: '#3a8a50', fontSize: 11, marginTop: 2 },
  selectedClear:   { color: '#4a7090', fontSize: 18, padding: 4 },
  litresInput:     { backgroundColor: CARD, borderWidth: 2, borderColor: GREEN, borderRadius: 18, fontSize: 48, fontWeight: '900', color: GREEN, textAlign: 'center', paddingVertical: 20, marginBottom: 12 },
  quickRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  quickBtn:        { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9 },
  quickBtnActive:  { backgroundColor: '#0d2e1a', borderColor: GREEN },
  quickBtnText:    { color: '#4a7090', fontSize: 13, fontWeight: '600' },
  quickBtnTextActive: { color: GREEN },
  saveBtn:         { backgroundColor: GREEN, borderRadius: 16, padding: 18, alignItems: 'center' },
  saveBtnOff:      { opacity: 0.35 },
  saveBtnText:     { color: '#0d1f33', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  syncBtn:         { marginTop: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, alignItems: 'center' },
  syncBtnText:     { color: '#4a7090', fontSize: 13, fontWeight: '600' },
  savedRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: BORDER, gap: 12 },
  savedTime:       { fontSize: 11, color: '#4a7090', width: 42 },
  savedFarmer:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  savedCode:       { color: '#4a7090', fontSize: 11, marginTop: 2 },
  savedLitres:     { color: GREEN, fontWeight: '900', fontSize: 16 },
});
