// App.tsx — Gutoria Dairies Mobile
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CollectionScreen from './src/screens/CollectionScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import DriverScreen from './src/screens/DriverScreen';

export type Screen = 'home' | 'collection' | 'history' | 'driver';

export interface Employee {
  id: number;
  name: string;
  code: string;
  role: string;
}

export default function App() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [checking, setChecking] = useState(true);
  const [screen, setScreen]     = useState<Screen>('home');

  useEffect(() => {
    AsyncStorage.getItem('gutoria_employee').then(stored => {
      if (stored) {
        try { setEmployee(JSON.parse(stored)); } catch {}
      }
      setChecking(false);
    });
  }, []);

  async function handleLogout() {
    await AsyncStorage.multiRemove(['gutoria_token', 'gutoria_employee']);
    setEmployee(null);
    setScreen('home');
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
        <LoginScreen onLoginSuccess={emp => { setEmployee(emp); setScreen('home'); }} />
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#132d48" />
      {screen === 'home' && (
        <HomeScreen employee={employee} onNavigate={setScreen} onLogout={handleLogout} />
      )}
      {screen === 'collection' && (
        <CollectionScreen employee={employee} onBack={() => setScreen('home')} />
      )}
      {screen === 'history' && (
        <HistoryScreen employee={employee} onBack={() => setScreen('home')} />
      )}
      {screen === 'driver' && (
        <DriverScreen employee={employee} onBack={() => setScreen('home')} />
      )}
    </>
  );
}
