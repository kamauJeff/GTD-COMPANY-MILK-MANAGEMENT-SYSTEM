// src/screens/LoginScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';

interface Props {
  onLoginSuccess: (emp: { id: number; name: string; code: string; role: string }) => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  function doShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 12,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleLogin() {
    const trimCode = code.trim().toUpperCase();
    if (!trimCode || !password) { doShake(); Alert.alert('Required', 'Enter your staff code and password.'); return; }
    setLoading(true);
    try {
      const res = await authApi.login(trimCode, password);
      const { token, employee } = res.data;
      await AsyncStorage.setItem('gutoria_token', token);
      await AsyncStorage.setItem('gutoria_employee', JSON.stringify(employee));
      onLoginSuccess(employee);
    } catch (err: any) {
      doShake();
      const msg = err.response?.data?.error ?? err.message ?? 'Login failed';
      Alert.alert('Login Failed', msg);
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

        {/* Card */}
        <Animated.View style={[s.card, { transform: [{ translateX: shake }] }]}>
          <Text style={s.cardHeading}>Staff Login</Text>

          <Text style={s.label}>STAFF CODE</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. GR001"
            placeholderTextColor="#4a6585"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={s.label}>PASSWORD</Text>
          <View style={s.passRow}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Your password"
              placeholderTextColor="#4a6585"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
              <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#0d1f33" />
              : <Text style={s.btnText}>LOG IN  →</Text>}
          </TouchableOpacity>
        </Animated.View>

        <Text style={s.footer}>© {new Date().getFullYear()} Gutoria Dairies · All rights reserved</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN  = '#3ddc84';
const BG     = '#0d1f33';
const CARD   = '#132d48';
const BORDER = '#1e3d5c';

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: BG },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logoWrap:  { alignItems: 'center', marginBottom: 40 },
  logoRing:  { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: CARD },
  logoEmoji: { fontSize: 38 },
  brand:     { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 8 },
  tagline:   { fontSize: 11, color: '#4a7090', marginTop: 4, letterSpacing: 1.5 },
  card:      { backgroundColor: CARD, borderRadius: 22, padding: 26, borderWidth: 1, borderColor: BORDER, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20 },
  cardHeading: { fontSize: 13, fontWeight: '800', color: GREEN, letterSpacing: 3, marginBottom: 22 },
  label:     { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2.5, marginBottom: 8, marginTop: 14 },
  input:     { backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, marginBottom: 0 },
  passRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eyeBtn:    { backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 13 },
  btn:       { backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  btnText:   { color: '#0d1f33', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  footer:    { textAlign: 'center', color: '#1e3d5c', fontSize: 11, marginTop: 36 },
});
