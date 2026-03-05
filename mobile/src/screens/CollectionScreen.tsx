// src/screens/CollectionScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { savePendingCollection } from '../utils/offlineStore';
import { syncPendingCollections } from '../utils/syncService';
import { farmersApi } from '../api/client';

export default function CollectionScreen() {
  const [farmers, setFarmers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [litres, setLitres] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (search.length >= 2) {
      farmersApi.list({ search, limit: 20 })
        .then((r) => setFarmers(r.data.data))
        .catch(() => {});
    } else {
      setFarmers([]);
    }
  }, [search]);

  const handleSave = async () => {
    if (!selectedFarmer || !litres) {
      Alert.alert('Validation', 'Please select a farmer and enter litres.');
      return;
    }
    setSaving(true);
    try {
      await savePendingCollection({
        farmerId: selectedFarmer.id,
        litres: parseFloat(litres),
        collectedAt: new Date().toISOString(),
      });
      Alert.alert('Saved', `${litres}L recorded for ${selectedFarmer.name}. Will sync when online.`);
      setSelectedFarmer(null);
      setLitres('');
      setSearch('');
    } catch {
      Alert.alert('Error', 'Failed to save collection.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncPendingCollections();
    setSyncing(false);
    Alert.alert('Sync Complete', `Synced: ${result.synced}, Failed: ${result.failed}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Collection</Text>

      {/* Farmer search */}
      {!selectedFarmer ? (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Search farmer name or codeâ€¦"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={farmers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.farmerRow} onPress={() => setSelectedFarmer(item)}>
                <Text style={styles.farmerName}>{item.name}</Text>
                <Text style={styles.farmerCode}>{item.code} Â· {item.route?.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <View>
          <View style={styles.selectedFarmer}>
            <Text style={styles.farmerName}>{selectedFarmer.name}</Text>
            <Text style={styles.farmerCode}>{selectedFarmer.code}</Text>
            <TouchableOpacity onPress={() => setSelectedFarmer(null)}>
              <Text style={styles.changeBtn}>Change</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Litres collected"
            value={litres}
            onChangeText={setLitres}
            keyboardType="decimal-pad"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Collection</Text>}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
        {syncing ? <ActivityIndicator color="#16a34a" /> : <Text style={styles.syncBtnText}>âŸ³  Sync Pending Records</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 20 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10 },
  farmerRow: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  farmerName: { fontSize: 15, fontWeight: '600', color: '#111' },
  farmerCode: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  selectedFarmer: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 10, padding: 14, marginBottom: 14 },
  changeBtn: { color: '#16a34a', fontWeight: '600', marginTop: 6, fontSize: 13 },
  saveBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  syncBtn: { marginTop: 24, borderWidth: 1, borderColor: '#16a34a', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  syncBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
});

