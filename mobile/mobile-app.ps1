# ============================================================
# Gutoria Mobile App - Full Scaffold
# Run from gutoria-dairies\mobile folder:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup-mobile.ps1
# ============================================================

function New-File {
    param($path, $content)
    $dir = Split-Path $path -Parent
    if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Created: $path" -ForegroundColor Green
}

Write-Host "`nSetting up Gutoria Mobile App..." -ForegroundColor Cyan


New-File "app.json" @'
{
  "expo": {
    "name": "Gutoria Dairies",
    "slug": "gutoria-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": { "resizeMode": "contain", "backgroundColor": "#16a34a" },
    "android": { "adaptiveIcon": { "backgroundColor": "#16a34a" }, "package": "com.gutoria.dairies" },
    "ios": { "bundleIdentifier": "com.gutoria.dairies" }
  }
}
'@

New-File "package.json" @'
{
  "name": "gutoria-mobile",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "1.23.1",
    "@react-navigation/bottom-tabs": "^6.5.20",
    "@react-navigation/native": "^6.1.17",
    "@react-navigation/native-stack": "^6.9.26",
    "axios": "^1.7.2",
    "expo": "~51.0.14",
    "expo-sqlite": "~14.0.3",
    "expo-status-bar": "~1.12.1",
    "react": "18.2.0",
    "react-native": "0.74.3",
    "react-native-safe-area-context": "4.10.5",
    "react-native-screens": "3.31.1",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.79",
    "typescript": "^5.3.3"
  }
}
'@

New-File "babel.config.js" @'
module.exports = function(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
'@

New-File "src\store\auth.store.ts" @'
import { create } from 'zustand';
import AsyncStorage from '' + '@'react-native-async-storage/async-storage';

interface AuthState {
  token: string | null;
  user: { id: number; name: string; role: string } | null;
  setAuth: (token: string, user: AuthState['user']) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: async (token, user) => {
    await AsyncStorage.setItem('gutoria_token', token);
    await AsyncStorage.setItem('gutoria_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: async () => {
    await AsyncStorage.removeItem('gutoria_token');
    await AsyncStorage.removeItem('gutoria_user');
    set({ token: null, user: null });
  },
  loadFromStorage: async () => {
    const token = await AsyncStorage.getItem('gutoria_token');
    const userStr = await AsyncStorage.getItem('gutoria_user');
    if (token && userStr) set({ token, user: JSON.parse(userStr) });
  },
}));
'@

New-File "src\api\client.ts" @'
import axios from 'axios';
import AsyncStorage from '' + '@'react-native-async-storage/async-storage';

// Change this to your computer's local IP when testing on a real device
// e.g. http://192.168.1.x:3001
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('gutoria_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (code: string, password: string) =>
    api.post('/api/auth/login', { code, password }),
  me: () => api.get('/api/auth/me'),
};

export const farmersApi = {
  list: (params?: any) => api.get('/api/farmers', { params }),
  get: (id: number) => api.get(`/api/farmers/${id}`),
  create: (data: any) => api.post('/api/farmers', data),
  update: (id: number, data: any) => api.put(`/api/farmers/${id}`, data),
};

export const routesApi = {
  list: () => api.get('/api/routes'),
};

export const collectionsApi = {
  list: (params?: any) => api.get('/api/collections', { params }),
  dailyTotals: (date?: string) =>
    api.get('/api/collections/daily-totals', { params: { date } }),
  create: (data: any) => api.post('/api/collections', data),
  batchSync: (records: any[]) =>
    api.post('/api/collections/batch', { records }),
};

export const reportsApi = {
  collectionGrid: (params: any) =>
    api.get('/api/reports/collection-grid', { params }),
};
'@

New-File "src\utils\offlineStore.ts" @'
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function initDB() {
  db = await SQLite.openDatabaseAsync('gutoria.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id INTEGER NOT NULL,
      farmer_name TEXT,
      litres REAL NOT NULL,
      collected_at TEXT NOT NULL,
      receipt_no TEXT,
      synced INTEGER DEFAULT 0
    );
  `);
}

export async function savePendingCollection(data: {
  farmerId: number;
  farmerName: string;
  litres: number;
  collectedAt: string;
  receiptNo?: string;
}) {
  if (!db) await initDB();
  await db.runAsync(
    'INSERT INTO pending_collections (farmer_id, farmer_name, litres, collected_at, receipt_no) VALUES (?, ?, ?, ?, ?)',
    [data.farmerId, data.farmerName, data.litres, data.collectedAt, data.receiptNo ?? null]
  );
}

export async function getPendingCollections() {
  if (!db) await initDB();
  return db.getAllAsync<any>('SELECT * FROM pending_collections WHERE synced = 0 ORDER BY collected_at DESC');
}

export async function getAllPending() {
  if (!db) await initDB();
  return db.getAllAsync<any>('SELECT * FROM pending_collections ORDER BY collected_at DESC');
}

export async function markSynced(ids: number[]) {
  if (!db) await initDB();
  if (ids.length === 0) return;
  await db.runAsync(
    `UPDATE pending_collections SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function getPendingCount() {
  if (!db) await initDB();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pending_collections WHERE synced = 0'
  );
  return result?.count ?? 0;
}
'@

New-File "src\utils\syncService.ts" @'
import { getPendingCollections, markSynced } from './offlineStore';
import { collectionsApi } from '../api/client';

export async function syncPendingCollections(): Promise<{
  synced: number;
  failed: number;
}> {
  const pending = await getPendingCollections();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  const records = pending.map((p: any) => ({
    farmerId: p.farmer_id,
    litres: p.litres,
    collectedAt: p.collected_at,
    receiptNo: p.receipt_no,
  }));

  try {
    const result = await collectionsApi.batchSync(records);
    await markSynced(pending.map((p: any) => p.id));
    return { synced: result.data.created, failed: result.data.failed };
  } catch {
    return { synced: 0, failed: pending.length };
  }
}
'@

New-File "src\navigation\AppNavigator.tsx" @'
import React from 'react';
import { createBottomTabNavigator } from '' + '@'react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '' + '@'react-navigation/native-stack';
import { NavigationContainer } from '' + '@'react-navigation/native';
import { Text } from 'react-native';
import { useAuthStore } from '../store/auth.store';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CollectionScreen from '../screens/CollectionScreen';
import FarmersScreen from '../screens/FarmersScreen';
import FarmerDetailScreen from '../screens/FarmerDetailScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SyncScreen from '../screens/SyncScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '📊', Collection: '🥛', Farmers: '👨‍🌾', Reports: '📋', Sync: '🔄'
  };
  return <Text style={{ fontSize: focused ? 22 : 18 }}>{icons[name]}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { paddingBottom: 5, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#16a34a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Collection" component={CollectionScreen} options={{ title: 'Collect Milk' }} />
      <Tab.Screen name="Farmers" component={FarmersScreen} options={{ title: 'Farmers' }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Tab.Screen name="Sync" component={SyncScreen} options={{ title: 'Sync' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const token = useAuthStore((s) => s.token);
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="FarmerDetail"
              component={FarmerDetailScreen}
              options={{ headerShown: true, title: 'Farmer Details', headerStyle: { backgroundColor: '#16a34a' }, headerTintColor: '#fff' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
'@

New-File "App.tsx" @'
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/auth.store';
import { initDB } from './src/utils/offlineStore';

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
    initDB().catch(console.error);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
'@

New-File "src\screens\LoginScreen.tsx" @'
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { authApi } from '../api/client';
import { useAuthStore } from '../store/auth.store';

export default function LoginScreen() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = async () => {
    if (!code.trim() || !password.trim()) {
      Alert.alert('Validation', 'Please enter your employee code and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.login(code.trim(), password);
      await setAuth(data.token, data.employee);
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <View style={s.card}>
        <Text style={s.logo}>🐄</Text>
        <Text style={s.title}>Gutoria Dairies</Text>
        <Text style={s.subtitle}>Field Collection App</Text>

        <View style={s.form}>
          <Text style={s.label}>Employee Code</Text>
          <TextInput
            style={s.input}
            value={code}
            onChangeText={setCode}
            placeholder="e.g. ADMIN001"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
          />
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />
          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  logo: { fontSize: 52, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#111', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 2 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111', marginBottom: 12 },
  btn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
'@

New-File "src\screens\DashboardScreen.tsx" @'
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { collectionsApi, farmersApi } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { getPendingCount } from '../utils/offlineStore';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routeTotals, setRouteTotals] = useState<any[]>([]);
  const [farmerCount, setFarmerCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    try {
      const [totalsRes, farmersRes, pending] = await Promise.all([
        collectionsApi.dailyTotals(today),
        farmersApi.list({ limit: 1 }),
        getPendingCount(),
      ]);
      setRouteTotals(totalsRes.data ?? []);
      setFarmerCount(farmersRes.data?.total ?? 0);
      setPendingCount(pending);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const totalLitres = routeTotals.reduce((s: number, r: any) => s + Number(r.totalLitres), 0);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#16a34a" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}>
      <View style={s.header}>
        <Text style={s.greeting}>Good morning,</Text>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.date}>{new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      </View>

      <View style={s.statsRow}>
        <StatCard label="Today's Milk" value={`${totalLitres.toFixed(0)}L`} color="#dcfce7" text="#16a34a" />
        <StatCard label="Farmers" value={farmerCount} color="#dbeafe" text="#2563eb" />
        <StatCard label="Pending Sync" value={pendingCount} color={pendingCount > 0 ? "#fef9c3" : "#f3f4f6"} text={pendingCount > 0 ? "#ca8a04" : "#6b7280"} />
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Today's Route Totals</Text>
        {routeTotals.length === 0 ? (
          <Text style={s.empty}>No collections recorded yet today.</Text>
        ) : routeTotals.map((r: any, i: number) => (
          <View key={i} style={s.routeRow}>
            <View>
              <Text style={s.routeName}>{r.route?.name ?? 'Unknown'}</Text>
              <Text style={s.routeSub}>{r.farmerCount} farmers</Text>
            </View>
            <Text style={s.routeLitres}>{Number(r.totalLitres).toFixed(1)}L</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color, text }: any) {
  return (
    <View style={[s.statCard, { backgroundColor: color }]}>
      <Text style={[s.statValue, { color: text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: text }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#16a34a', padding: 24, paddingTop: 16 },
  greeting: { color: '#bbf7d0', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  date: { color: '#86efac', fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  section: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 12 },
  empty: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  routeName: { fontSize: 14, fontWeight: '600', color: '#111' },
  routeSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  routeLitres: { fontSize: 16, fontWeight: '800', color: '#16a34a' },
});
'@

New-File "src\screens\CollectionScreen.tsx" @'
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { farmersApi } from '../api/client';
import { savePendingCollection, getPendingCount } from '../utils/offlineStore';
import { syncPendingCollections } from '../utils/syncService';

export default function CollectionScreen() {
  const [search, setSearch] = useState('');
  const [farmers, setFarmers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [litres, setLitres] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<any>(null);

  useEffect(() => {
    getPendingCount().then(setPendingCount);
  }, []);

  useEffect(() => {
    if (search.length < 2) { setFarmers([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await farmersApi.list({ search, limit: 20 });
        setFarmers(res.data.data ?? []);
      } catch { setFarmers([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleSave = async () => {
    if (!selectedFarmer) { Alert.alert('Select a farmer first'); return; }
    const l = parseFloat(litres);
    if (!litres || isNaN(l) || l <= 0) { Alert.alert('Enter valid litres'); return; }

    setSaving(true);
    try {
      await savePendingCollection({
        farmerId: selectedFarmer.id,
        farmerName: selectedFarmer.name,
        litres: l,
        collectedAt: new Date().toISOString(),
      });
      const newCount = await getPendingCount();
      setPendingCount(newCount);
      setLastSaved({ farmer: selectedFarmer, litres: l });
      setShowSuccess(true);
      setSelectedFarmer(null);
      setLitres('');
      setSearch('');
      setFarmers([]);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingCollections();
      const newCount = await getPendingCount();
      setPendingCount(newCount);
      Alert.alert('Sync Complete', `Synced: ${result.synced} records\nFailed: ${result.failed}`);
    } catch {
      Alert.alert('Sync Failed', 'Check your internet connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      {/* Pending badge */}
      {pendingCount > 0 && (
        <TouchableOpacity style={s.pendingBanner} onPress={handleSync} disabled={syncing}>
          {syncing
            ? <ActivityIndicator color="#92400e" size="small" />
            : <Text style={s.pendingText}>⚡ {pendingCount} record{pendingCount !== 1 ? 's' : ''} pending sync — tap to sync now</Text>
          }
        </TouchableOpacity>
      )}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Select Farmer</Text>
        {!selectedFarmer ? (
          <>
            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or code..."
                placeholderTextColor="#9ca3af"
              />
              {searching && <ActivityIndicator color="#16a34a" style={{ marginLeft: 8 }} />}
            </View>
            {farmers.map((f) => (
              <TouchableOpacity key={f.id} style={s.farmerRow} onPress={() => { setSelectedFarmer(f); setSearch(''); setFarmers([]); }}>
                <View style={s.farmerCode}><Text style={s.farmerCodeText}>{f.code}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.farmerName}>{f.name}</Text>
                  <Text style={s.farmerSub}>{f.route?.name} • KES {Number(f.pricePerLitre).toFixed(0)}/L</Text>
                </View>
              </TouchableOpacity>
            ))}
            {search.length >= 2 && !searching && farmers.length === 0 && (
              <Text style={s.noResults}>No farmers found for "{search}"</Text>
            )}
          </>
        ) : (
          <View style={s.selectedCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.selectedName}>{selectedFarmer.name}</Text>
              <Text style={s.selectedSub}>{selectedFarmer.code} • {selectedFarmer.route?.name}</Text>
              <Text style={s.selectedPrice}>KES {Number(selectedFarmer.pricePerLitre).toFixed(0)} per litre</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedFarmer(null)} style={s.changeBtn}>
              <Text style={s.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {selectedFarmer && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Litres Collected</Text>
          <TextInput
            style={s.litresInput}
            value={litres}
            onChangeText={setLitres}
            placeholder="0.0"
            placeholderTextColor="#d1d5db"
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          {litres ? (
            <Text style={s.estimate}>
              Estimated value: KES {(parseFloat(litres || '0') * Number(selectedFarmer.pricePerLitre)).toFixed(2)}
            </Text>
          ) : null}

          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveBtnText}>Save Collection</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Success modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalEmoji}>✅</Text>
            <Text style={s.modalTitle}>Saved Successfully</Text>
            {lastSaved && (
              <>
                <Text style={s.modalBody}>{lastSaved.farmer.name}</Text>
                <Text style={s.modalLitres}>{lastSaved.litres}L collected</Text>
                <Text style={s.modalNote}>Will sync when online</Text>
              </>
            )}
            <TouchableOpacity style={s.modalBtn} onPress={() => setShowSuccess(false)}>
              <Text style={s.modalBtnText}>Record Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  pendingBanner: { backgroundColor: '#fef3c7', margin: 12, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fde68a' },
  pendingText: { color: '#92400e', fontWeight: '600', fontSize: 13 },
  section: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  searchInput: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111' },
  farmerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  farmerCode: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  farmerCodeText: { color: '#16a34a', fontWeight: '700', fontSize: 12 },
  farmerName: { fontSize: 15, fontWeight: '600', color: '#111' },
  farmerSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  noResults: { color: '#9ca3af', textAlign: 'center', padding: 16, fontSize: 14 },
  selectedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#bbf7d0' },
  selectedName: { fontSize: 16, fontWeight: '700', color: '#111' },
  selectedSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  selectedPrice: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 4 },
  changeBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#16a34a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  changeBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  litresInput: { fontSize: 48, fontWeight: '800', color: '#111', textAlign: 'center', borderBottomWidth: 3, borderBottomColor: '#16a34a', paddingVertical: 8, marginBottom: 8 },
  estimate: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginBottom: 16 },
  saveBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%' },
  modalEmoji: { fontSize: 52, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 8 },
  modalBody: { fontSize: 16, fontWeight: '600', color: '#374151' },
  modalLitres: { fontSize: 28, fontWeight: '800', color: '#16a34a', marginVertical: 4 },
  modalNote: { fontSize: 13, color: '#9ca3af', marginBottom: 20 },
  modalBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
'@

New-File "src\screens\FarmersScreen.tsx" @'
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, Alert, ScrollView,
} from 'react-native';
import { farmersApi, routesApi } from '../api/client';
import { useAuthStore } from '../store/auth.store';

export default function FarmersScreen({ navigation }: any) {
  const [farmers, setFarmers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const user = useAuthStore((s) => s.user);

  const load = useCallback(async (p = 1, q = search) => {
    try {
      const res = await farmersApi.list({ search: q, page: p, limit: 30 });
      const data = res.data.data ?? [];
      setFarmers(p === 1 ? data : (prev) => [...prev, ...data]);
      setTotal(res.data.total ?? 0);
      setPage(p);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { setLoading(true); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    routesApi.list().then((r) => setRoutes(r.data ?? [])).catch(() => {});
  }, []);

  const canManage = user?.role === 'ADMIN' || user?.role === 'OFFICE';

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder="Search farmers..." placeholderTextColor="#9ca3af" />
        {canManage && (
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.count}>{total} farmers</Text>

      {loading ? <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={farmers}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor="#16a34a" />}
          onEndReached={() => { if (farmers.length < total) load(page + 1); }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate('FarmerDetail', { farmer: item })}>
              <View style={s.cardLeft}>
                <View style={s.codeBadge}><Text style={s.codeText}>{item.code}</Text></View>
                <View>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.sub}>{item.route?.name} • {item.phone}</Text>
                </View>
              </View>
              <View style={s.cardRight}>
                <Text style={s.price}>KES {Number(item.pricePerLitre).toFixed(0)}/L</Text>
                <View style={[s.badge, { backgroundColor: item.paymentMethod === 'MPESA' ? '#dcfce7' : '#dbeafe' }]}>
                  <Text style={[s.badgeText, { color: item.paymentMethod === 'MPESA' ? '#16a34a' : '#2563eb' }]}>{item.paymentMethod}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={s.empty}>No farmers found.</Text>}
        />
      )}
      {showAdd && <AddFarmerModal routes={routes} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(1); }} />}
    </View>
  );
}

function AddFarmerModal({ routes, onClose, onSaved }: any) {
  const [form, setForm] = useState({ code: '', name: '', phone: '', routeId: '', pricePerLitre: '', paymentMethod: 'MPESA', mpesaPhone: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.code || !form.name || !form.phone || !form.routeId || !form.pricePerLitre) {
      Alert.alert('Validation', 'Please fill in all required fields.'); return;
    }
    setSaving(true);
    try {
      await farmersApi.create({ ...form, routeId: parseInt(form.routeId), pricePerLitre: parseFloat(form.pricePerLitre) });
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to create farmer.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={m.header}>
        <Text style={m.title}>Add Farmer</Text>
        <TouchableOpacity onPress={onClose}><Text style={m.close}>Cancel</Text></TouchableOpacity>
      </View>
      <ScrollView style={m.body}>
        {[['Code *', 'code', false], ['Full Name *', 'name', false], ['Phone *', 'phone', true], ['Price per Litre *', 'pricePerLitre', true], ['M-Pesa Phone', 'mpesaPhone', true]].map(([label, key, numeric]: any) => (
          <View key={key} style={m.field}>
            <Text style={m.label}>{label}</Text>
            <TextInput style={m.input} value={(form as any)[key]} onChangeText={(v) => set(key, v)} keyboardType={numeric ? 'phone-pad' : 'default'} autoCapitalize={key === 'code' ? 'characters' : 'words'} placeholderTextColor="#9ca3af" placeholder={label.replace(' *', '')} />
          </View>
        ))}
        <View style={m.field}>
          <Text style={m.label}>Route *</Text>
          {routes.map((r: any) => (
            <TouchableOpacity key={r.id} style={[m.option, form.routeId === String(r.id) && m.optionSelected]} onPress={() => set('routeId', String(r.id))}>
              <Text style={[m.optionText, form.routeId === String(r.id) && m.optionSelectedText]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={m.field}>
          <Text style={m.label}>Payment Method</Text>
          <View style={m.toggle}>
            {['MPESA', 'BANK'].map((pm) => (
              <TouchableOpacity key={pm} style={[m.toggleBtn, form.paymentMethod === pm && m.toggleActive]} onPress={() => set('paymentMethod', pm)}>
                <Text style={[m.toggleText, form.paymentMethod === pm && m.toggleActiveText]}>{pm}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.saveBtnText}>Save Farmer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  topBar: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  search: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111' },
  addBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  count: { padding: 12, paddingBottom: 4, fontSize: 12, color: '#9ca3af' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  codeBadge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  codeText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  name: { fontSize: 15, fontWeight: '600', color: '#111' },
  sub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  price: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 40, fontSize: 15 },
});

const m = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 18, fontWeight: '800', color: '#111' },
  close: { color: '#16a34a', fontSize: 16, fontWeight: '600' },
  body: { padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' },
  option: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginBottom: 6 },
  optionSelected: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  optionText: { fontSize: 14, color: '#374151' },
  optionSelectedText: { color: '#16a34a', fontWeight: '600' },
  toggle: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, alignItems: 'center' },
  toggleActive: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  toggleText: { fontWeight: '600', color: '#6b7280' },
  toggleActiveText: { color: '#16a34a' },
  saveBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
'@

New-File "src\screens\FarmerDetailScreen.tsx" @'
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { farmersApi } from '../api/client';

export default function FarmerDetailScreen({ route }: any) {
  const { farmer: initialFarmer } = route.params;
  const [farmer, setFarmer] = useState<any>(initialFarmer);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    farmersApi.get(initialFarmer.id)
      .then((r) => setFarmer(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialFarmer.id]);

  const collections: any[] = farmer?.collections ?? [];
  const totalLitres = collections.reduce((s: number, c: any) => s + Number(c.litres), 0);

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.name}>{farmer.name}</Text>
        <Text style={s.code}>{farmer.code}</Text>
      </View>
      <View style={s.infoCard}>
        {[
          ['Phone', farmer.phone],
          ['Route', farmer.route?.name ?? '–'],
          ['Price per Litre', `KES ${Number(farmer.pricePerLitre).toFixed(2)}`],
          ['Payment Method', farmer.paymentMethod],
          ['M-Pesa Phone', farmer.mpesaPhone ?? '–'],
          ['Paid on 15th', farmer.paidOn15th ? 'Yes' : 'No'],
        ].map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.rowLabel}>{label}</Text>
            <Text style={s.rowValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statVal}>{collections.length}</Text><Text style={s.statLbl}>Collections</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{totalLitres.toFixed(0)}L</Text><Text style={s.statLbl}>Total Litres</Text></View>
        <View style={s.stat}><Text style={s.statVal}>KES {(totalLitres * Number(farmer.pricePerLitre)).toFixed(0)}</Text><Text style={s.statLbl}>Gross Pay</Text></View>
      </View>
      {loading
        ? <ActivityIndicator color="#16a34a" style={{ margin: 20 }} />
        : (
          <View style={s.collectionsCard}>
            <Text style={s.collectionsTitle}>Recent Collections</Text>
            {collections.length === 0
              ? <Text style={s.empty}>No collections yet.</Text>
              : collections.slice(0, 10).map((c: any, i: number) => (
                <View key={i} style={s.collRow}>
                  <Text style={s.collDate}>{new Date(c.collectedAt).toLocaleDateString('en-KE')}</Text>
                  <Text style={s.collLitres}>{Number(c.litres).toFixed(1)}L</Text>
                </View>
              ))
            }
          </View>
        )
      }
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#16a34a', padding: 24 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  code: { color: '#86efac', fontSize: 14, marginTop: 4 },
  infoCard: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLabel: { fontSize: 14, color: '#6b7280' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  statsRow: { flexDirection: 'row', marginHorizontal: 12, gap: 10, marginBottom: 4 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  statVal: { fontSize: 16, fontWeight: '800', color: '#16a34a' },
  statLbl: { fontSize: 11, color: '#9ca3af', marginTop: 2, textAlign: 'center' },
  collectionsCard: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  collectionsTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 12 },
  collRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  collDate: { fontSize: 14, color: '#374151' },
  collLitres: { fontSize: 14, fontWeight: '700', color: '#16a34a' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 20 },
});
'@

New-File "src\screens\ReportsScreen.tsx" @'
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { reportsApi } from '../api/client';

export default function ReportsScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [grid, setGrid] = useState<any>(null);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.collectionGrid({ month, year });
      setGrid(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load report. Make sure you are online.');
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={s.container}>
      <View style={s.filterCard}>
        <Text style={s.filterTitle}>Collection Report</Text>
        <View style={s.monthRow}>
          {months.map((m, i) => (
            <TouchableOpacity key={m} style={[s.monthBtn, month === i+1 && s.monthActive]} onPress={() => setMonth(i+1)}>
              <Text style={[s.monthText, month === i+1 && s.monthActiveText]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.yearRow}>
          {[now.getFullYear()-1, now.getFullYear()].map((y) => (
            <TouchableOpacity key={y} style={[s.yearBtn, year === y && s.monthActive]} onPress={() => setYear(y)}>
              <Text style={[s.yearText, year === y && s.monthActiveText]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.loadBtn} onPress={loadReport} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loadBtnText}>Load Report</Text>}
        </TouchableOpacity>
      </View>

      {grid && (
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>{months[month-1]} {year} Summary</Text>
          <View style={s.summaryRow}>
            <SumItem label="Farmers" value={grid.data.length} />
            <SumItem label="Total Litres" value={`${grid.data.reduce((s: number, f: any) => s + f.total, 0).toFixed(0)}L`} />
            <SumItem label="Gross Pay" value={`KES ${grid.data.reduce((s: number, f: any) => s + f.grossPay, 0).toLocaleString()}`} />
          </View>
        </View>
      )}

      {grid?.data?.map((row: any) => (
        <View key={row.farmer.id} style={s.farmerCard}>
          <View style={s.farmerHeader}>
            <Text style={s.farmerName}>{row.farmer.name}</Text>
            <Text style={s.farmerTotal}>{row.total.toFixed(1)}L</Text>
          </View>
          <View style={s.daysGrid}>
            {Object.entries(row.days).map(([day, litres]: any) => (
              <View key={day} style={[s.dayCell, litres > 0 && s.dayCellFilled]}>
                <Text style={[s.dayNum, litres > 0 && s.dayNumFilled]}>{day}</Text>
                {litres > 0 && <Text style={s.dayLitres}>{Number(litres).toFixed(0)}</Text>}
              </View>
            ))}
          </View>
          <Text style={s.grossPay}>KES {Number(row.grossPay).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function SumItem({ label, value }: any) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#16a34a' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  filterCard: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  filterTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 12 },
  monthRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  monthBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  monthActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  monthText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  monthActiveText: { color: '#fff' },
  yearRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  yearBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  yearText: { fontWeight: '600', color: '#6b7280' },
  loadBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  loadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  summaryCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 },
  summaryRow: { flexDirection: 'row' },
  farmerCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  farmerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  farmerName: { fontSize: 14, fontWeight: '700', color: '#111' },
  farmerTotal: { fontSize: 14, fontWeight: '800', color: '#16a34a' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 8 },
  dayCell: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  dayCellFilled: { backgroundColor: '#dcfce7' },
  dayNum: { fontSize: 9, color: '#9ca3af' },
  dayNumFilled: { color: '#16a34a', fontWeight: '700' },
  dayLitres: { fontSize: 7, color: '#16a34a', fontWeight: '700' },
  grossPay: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'right' },
});
'@

New-File "src\screens\SyncScreen.tsx" @'
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { getAllPending, getPendingCount } from '../utils/offlineStore';
import { syncPendingCollections } from '../utils/syncService';
import { useAuthStore } from '../store/auth.store';

export default function SyncScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { user, logout } = useAuthStore();

  const load = useCallback(async () => {
    const all = await getAllPending();
    setRecords(all);
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingCollections();
      await load();
      Alert.alert('Sync Complete', `Synced: ${result.synced}  Failed: ${result.failed}`);
    } catch {
      Alert.alert('Sync Failed', 'Check your internet connection.');
    } finally { setSyncing(false); }
  };

  return (
    <View style={s.container}>
      <View style={s.statusCard}>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: pendingCount > 0 ? '#f59e0b' : '#16a34a' }]} />
          <Text style={s.statusText}>{pendingCount > 0 ? `${pendingCount} records pending sync` : 'All records synced'}</Text>
        </View>
        <TouchableOpacity style={[s.syncBtn, syncing && { opacity: 0.6 }]} onPress={handleSync} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.syncBtnText}>Sync Now</Text>}
        </TouchableOpacity>
      </View>

      <Text style={s.listTitle}>All Records ({records.length})</Text>

      <FlatList
        data={records}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={[s.record, item.synced && s.recordSynced]}>
            <View style={{ flex: 1 }}>
              <Text style={s.recordFarmer}>{item.farmer_name}</Text>
              <Text style={s.recordDate}>{new Date(item.collected_at).toLocaleString('en-KE')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.recordLitres}>{Number(item.litres).toFixed(1)}L</Text>
              <View style={[s.badge, { backgroundColor: item.synced ? '#dcfce7' : '#fef9c3' }]}>
                <Text style={[s.badgeText, { color: item.synced ? '#16a34a' : '#92400e' }]}>
                  {item.synced ? 'Synced' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No records yet.</Text>}
      />

      <View style={s.footer}>
        <Text style={s.footerUser}>Logged in as {user?.name} ({user?.role})</Text>
        <TouchableOpacity onPress={logout}><Text style={s.logoutText}>Log Out</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  statusCard: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  syncBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listTitle: { paddingHorizontal: 12, paddingBottom: 4, fontSize: 13, color: '#9ca3af' },
  record: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 6, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  recordSynced: { opacity: 0.6 },
  recordFarmer: { fontSize: 14, fontWeight: '600', color: '#111' },
  recordDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  recordLitres: { fontSize: 16, fontWeight: '800', color: '#16a34a' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 40, fontSize: 15 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerUser: { fontSize: 13, color: '#6b7280' },
  logoutText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
});
'@

Write-Host "`nDone! Now run:" -ForegroundColor Green
Write-Host "  npm install" -ForegroundColor White
Write-Host "  npx expo start" -ForegroundColor White
Write-Host "`nScan the QR code with Expo Go on your phone." -ForegroundColor Cyan
Write-Host "Make sure EXPO_PUBLIC_API_URL in .env points to your computer IP." -ForegroundColor Yellow
