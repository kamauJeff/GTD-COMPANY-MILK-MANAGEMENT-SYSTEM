// App.tsx — Gutoria Dairies Mobile
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StatusBar, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CollectionScreen from './src/screens/CollectionScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import DriverScreen from './src/screens/DriverScreen';
import StatementSearchScreen from './src/screens/StatementSearchScreen';
import { downloadFarmersForGrader } from './src/utils/syncService';
import { initDB } from './src/utils/offlineStore';

export type Screen = 'home' | 'collection' | 'history' | 'driver' | 'statement';

export interface Employee {
  id: number;
  name: string;
  code: string;
  role: string;
}

export default function App() {
  const [employee, setEmployee]   = useState<Employee | null>(null);
  const [checking, setChecking]   = useState(true);
  const [screen, setScreen]       = useState<Screen>('home');
  const [routeId, setRouteId]     = useState<number | undefined>();
  const [routeName, setRouteName] = useState<string | undefined>();
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState('');

  useEffect(() => {
    initDB().then(() => {
      AsyncStorage.getItem('gutoria_employee').then(stored => {
        if (stored) {
          try {
            const emp = JSON.parse(stored);
            setEmployee(emp);
            // Restore cached route
            AsyncStorage.getItem('gutoria_route').then(r => {
              if (r) {
                const route = JSON.parse(r);
                setRouteId(route.id);
                setRouteName(route.name);
              }
            });
          } catch {}
        }
        setChecking(false);
      });
    });
  }, []);

  async function handleLoginSuccess(emp: Employee) {
    setEmployee(emp);
    setScreen('home');

    // Download farmers in background
    setSyncing(true);
    setSyncMsg('Downloading farmers...');
    try {
      // Get grader's route first
      const { getGraderRoute } = await import('./src/utils/syncService');
      const route = await getGraderRoute();
      if (route) {
        setRouteId(route.id);
        setRouteName(route.name);
        await AsyncStorage.setItem('gutoria_route', JSON.stringify(route));
      }
      const count = await downloadFarmersForGrader(route?.id);
      setSyncMsg(`✅ ${count} farmers cached${route ? ` · ${route.name}` : ''}`);
      setTimeout(() => setSyncMsg(''), 3000);
    } catch {
      setSyncMsg('Offline — using cached data');
      setTimeout(() => setSyncMsg(''), 3000);
    }
    setSyncing(false);
  }

  async function handleLogout() {
    await AsyncStorage.multiRemove(['gutoria_token', 'gutoria_employee', 'gutoria_route']);
    setEmployee(null);
    setScreen('home');
    setRouteId(undefined);
    setRouteName(undefined);
  }

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d1f33', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1f33" />
        <ActivityIndicator color="#3ddc84" size="large" />
      </View>
    );
  }

  if (!employee) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#0d1f33" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#132d48" />

      {/* Sync status toast */}
      {syncMsg !== '' && (
        <View style={{ position: 'absolute', top: 50, left: 20, right: 20, zIndex: 999, backgroundColor: '#0d2e1a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1e4d2a' }}>
          <Text style={{ color: '#3ddc84', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{syncMsg}</Text>
        </View>
      )}

      {screen === 'home' && (
        <HomeScreen employee={employee} onNavigate={setScreen} onLogout={handleLogout}
          routeName={routeName} farmerCount={undefined} />
      )}
      {screen === 'collection' && (
        <CollectionScreen employee={employee} onBack={() => setScreen('home')}
          routeId={routeId} routeName={routeName} />
      )}
      {screen === 'history' && (
        <HistoryScreen employee={employee} onBack={() => setScreen('home')} />
      )}
      {screen === 'driver' && (
        <DriverScreen employee={employee} onBack={() => setScreen('home')} />
      )}
      {screen === 'statement' && (
        <StatementSearchScreen employee={employee} onBack={() => setScreen('home')} />
      )}
    </>
  );
}
