// src/screens/LoginScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';

const CACHED_CREDS_KEY = 'gutoria_cached_creds';

interface Props {
  onLoginSuccess: (emp: { id: number; name: string; code: string; role: string }) => void;
}

// Simple hash for offline credential check — NOT cryptographic, just obfuscation
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  function doShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 12,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function tryOfflineLogin(trimCode: string, pwd: string): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(CACHED_CREDS_KEY);
      if (!raw) return false;
      const creds = JSON.parse(raw);
      const cached = creds[trimCode];
      if (!cached) return false;
      // Check hashed password matches
      if (cached.pwHash !== simpleHash(pwd)) return false;
      // Restore employee from cache
      await AsyncStorage.setItem('gutoria_employee', JSON.stringify(cached.employee));
      // Keep old token if exists — it may still be valid
      return true;
    } catch {
      return false;
    }
  }

  async function cacheCredentials(code: string, pwd: string, employee: any) {
    try {
      const raw = await AsyncStorage.getItem(CACHED_CREDS_KEY);
      const creds = raw ? JSON.parse(raw) : {};
      creds[code] = {
        pwHash: simpleHash(pwd),
        employee,
        cachedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(CACHED_CREDS_KEY, JSON.stringify(creds));
    } catch {}
  }

  async function handleLogin() {
    const trimCode = code.trim().toUpperCase();
    if (!trimCode || !password) { doShake(); Alert.alert('Required', 'Enter your staff code and password.'); return; }
    setLoading(true);

    try {
      // Try online first
      const res = await authApi.login(trimCode, password);
      const { token, employee } = res.data;
      await AsyncStorage.setItem('gutoria_token', token);
      await AsyncStorage.setItem('gutoria_employee', JSON.stringify(employee));
      // Cache credentials for offline use
      await cacheCredentials(trimCode, password, employee);
      setOfflineMode(false);
      onLoginSuccess(employee);
    } catch (err: any) {
      // Online failed — try offline cache
      const isNetworkError = !err.response; // no response = no internet
      if (isNetworkError) {
        const offlineOk = await tryOfflineLogin(trimCode, password);
        if (offlineOk) {
          const empRaw = await AsyncStorage.getItem('gutoria_employee');
          const employee = empRaw ? JSON.parse(empRaw) : null;
          if (employee) {
            setOfflineMode(true);
            onLoginSuccess(employee);
            return;
          }
        }
        doShake();
        Alert.alert(
          'No Connection',
          'Cannot reach server and no offline credentials found.\n\nLog in with internet at least once to enable offline login.',
          [{ text: 'OK' }]
        );
      } else {
        doShake();
        const msg = err.response?.data?.error ?? 'Login failed. Check your code and password.';
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoRing}>
            <Text style={s.logoEmoji}>🐄</Text>
          </View>
          <Text style={s.brand}>GUTORIA</Text>
          <Text style={s.tagline}>Dairies Management System</Text>
        </View>

        {/* Offline indicator */}
        <View style={s.offlineBanner}>
          <Text style={s.offlineText}>📵 No internet? Login still works if you've logged in before</Text>
        </View>

        {/* Form */}
        <Animated.View style={[s.card, { transform: [{ translateX: shake }] }]}>
          <Text style={s.inputLabel}>STAFF CODE</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. GR001"
            placeholderTextColor="#4a6585"
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={[s.inputLabel, { marginTop: 16 }]}>PASSWORD</Text>
          <View style={s.passWrap}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter password"
              placeholderTextColor="#4a6585"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
              <Text style={s.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.loginBtn, loading && s.loginBtnOff]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#0d1f33" />
              : <Text style={s.loginBtnText}>LOGIN</Text>}
          </TouchableOpacity>
        </Animated.View>

        <Text style={s.footer}>Gutoria Dairies © {new Date().getFullYear()}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN  = '#3ddc84';
const BG     = '#0d1f33';
const CARD   = '#132d48';
const BORDER = '#1e3d5c';

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: BG },
  scroll:       { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoWrap:     { alignItems: 'center', marginBottom: 28 },
  logoRing:     { width: 80, height: 80, borderRadius: 40, backgroundColor: CARD, borderWidth: 2, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoEmoji:    { fontSize: 36 },
  brand:        { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 6 },
  tagline:      { fontSize: 12, color: '#4a7090', marginTop: 4, letterSpacing: 1 },
  offlineBanner:{ backgroundColor: '#1a2d1a', borderRadius: 10, padding: 10, marginBottom: 20, borderWidth: 1, borderColor: '#1e4d2a' },
  offlineText:  { color: '#3ddc84', fontSize: 11, textAlign: 'center', opacity: 0.8 },
  card:         { backgroundColor: CARD, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: BORDER },
  inputLabel:   { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2.5, marginBottom: 8 },
  input:        { backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16, marginBottom: 4 },
  passWrap:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:       { padding: 14, backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  eyeText:      { fontSize: 16 },
  loginBtn:     { backgroundColor: GREEN, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 24 },
  loginBtnOff:  { opacity: 0.5 },
  loginBtnText: { color: '#0d1f33', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  footer:       { textAlign: 'center', color: '#2a4a6a', fontSize: 11, marginTop: 32 },
});
