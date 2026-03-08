// src/screens/DriverScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

interface Employee { id: number; name: string; code: string; role: string; }
interface Props { employee: Employee; onBack: () => void; }

interface Shop { id: number; name: string; code: string; location?: string; }
interface Drop { id: number; shopId: number; shop: { id: number; name: string; code: string }; litres: number; cashCollected: number; notes?: string; droppedAt: string; }
interface Expense { id: number; category: string; amount: number; description?: string; }
interface Trip {
  id: number; litresLoaded: number; litresDelivered: number; litresVariance: number;
  status: string; notes?: string; drops: Drop[]; expenses: Expense[];
}

const EXPENSE_CATEGORIES = ['FUEL', 'LUNCH', 'MAINTENANCE', 'OTHER'];
const CATEGORY_EMOJI: Record<string, string> = { FUEL: '⛽', LUNCH: '🍽️', MAINTENANCE: '🔧', OTHER: '📦' };

type Tab = 'summary' | 'drops' | 'expenses';

export default function DriverScreen({ employee, onBack }: Props) {
  const [trip, setTrip]           = useState<Trip | null>(null);
  const [shops, setShops]         = useState<Shop[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]             = useState<Tab>('summary');

  // Modals
  const [showStart, setShowStart]     = useState(false);
  const [showDrop, setShowDrop]       = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [editingDrop, setEditingDrop] = useState<Drop | null>(null);

  // Form state
  const [litresLoaded, setLitresLoaded] = useState('');
  const [dropShopId, setDropShopId]     = useState<number | null>(null);
  const [dropShopSearch, setDropShopSearch] = useState('');
  const [dropLitres, setDropLitres]     = useState('');
  const [dropCash, setDropCash]         = useState('');
  const [dropNotes, setDropNotes]       = useState('');
  const [expCat, setExpCat]             = useState('FUEL');
  const [expAmount, setExpAmount]       = useState('');
  const [expDesc, setExpDesc]           = useState('');
  const [saving, setSaving]             = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    try {
      const [tripRes, shopsRes] = await Promise.all([
        api.get('/api/driver/trip', { params: { date: today } }),
        api.get('/api/driver/shops'),
      ]);
      setTrip(tripRes.data.trip);
      setShops(shopsRes.data.shops ?? []);
    } catch (e: any) {
      if (e.response?.status !== 404) console.error(e);
    }
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Start trip ──────────────────────────────────────────────────────────────
  async function handleStartTrip() {
    if (!litresLoaded || Number(litresLoaded) <= 0) {
      Alert.alert('Required', 'Enter the litres loaded from factory.'); return;
    }
    setSaving(true);
    try {
      const r = await api.post('/api/driver/trip/start', { litresLoaded: Number(litresLoaded) });
      setTrip(r.data.trip);
      setShowStart(false);
      setLitresLoaded('');
    } catch { Alert.alert('Error', 'Could not start trip. Try again.'); }
    setSaving(false);
  }

  // ── Add / edit drop ─────────────────────────────────────────────────────────
  async function handleSaveDrop() {
    if (!dropShopId) { Alert.alert('Select Shop', 'Choose a shop first.'); return; }
    if (!dropLitres || Number(dropLitres) <= 0) { Alert.alert('Invalid', 'Enter valid litres.'); return; }
    setSaving(true);
    try {
      if (editingDrop) {
        const r = await api.put(`/api/driver/trip/${trip!.id}/drop/${editingDrop.id}`, {
          litres: Number(dropLitres), cashCollected: Number(dropCash || 0), notes: dropNotes || null,
        });
        setTrip(prev => prev ? {
          ...prev,
          drops: prev.drops.map(d => d.id === editingDrop.id ? { ...d, ...r.data.drop } : d),
          litresDelivered: recalc(prev.drops.map(d => d.id === editingDrop.id ? r.data.drop : d)),
        } : prev);
      } else {
        const r = await api.post(`/api/driver/trip/${trip!.id}/drop`, {
          shopId: dropShopId, litres: Number(dropLitres),
          cashCollected: Number(dropCash || 0), notes: dropNotes || null,
        });
        setTrip(prev => prev ? { ...prev, drops: [...prev.drops, r.data.drop] } : prev);
      }
      await load(); // refresh for accurate totals
      closeDrop();
    } catch { Alert.alert('Error', 'Could not save drop.'); }
    setSaving(false);
  }

  async function handleDeleteDrop(drop: Drop) {
    Alert.alert('Delete Drop', `Remove ${drop.litres}L to ${drop.shop.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/driver/trip/${trip!.id}/drop/${drop.id}`);
          await load();
        } catch { Alert.alert('Error', 'Could not delete.'); }
      }},
    ]);
  }

  // ── Add expense ─────────────────────────────────────────────────────────────
  async function handleSaveExpense() {
    if (!expAmount || Number(expAmount) <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    setSaving(true);
    try {
      const r = await api.post(`/api/driver/trip/${trip!.id}/expense`, {
        category: expCat, amount: Number(expAmount), description: expDesc || null,
      });
      setTrip(prev => prev ? { ...prev, expenses: [...prev.expenses, r.data.expense] } : prev);
      setShowExpense(false); setExpAmount(''); setExpDesc(''); setExpCat('FUEL');
    } catch { Alert.alert('Error', 'Could not save expense.'); }
    setSaving(false);
  }

  async function handleDeleteExpense(exp: Expense) {
    Alert.alert('Delete Expense', `Remove KES ${exp.amount} ${exp.category}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/driver/trip/${trip!.id}/expense/${exp.id}`);
          setTrip(prev => prev ? { ...prev, expenses: prev.expenses.filter(e => e.id !== exp.id) } : prev);
        } catch { Alert.alert('Error', 'Could not delete.'); }
      }},
    ]);
  }

  // ── Submit trip ─────────────────────────────────────────────────────────────
  async function handleSubmitTrip() {
    Alert.alert('Submit Trip', 'This will lock today\'s trip. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: async () => {
        try {
          const r = await api.post(`/api/driver/trip/${trip!.id}/submit`);
          setTrip(r.data.trip);
          Alert.alert('✓ Submitted', 'Your trip has been submitted successfully.');
        } catch { Alert.alert('Error', 'Could not submit trip.'); }
      }},
    ]);
  }

  function openDrop(drop?: Drop) {
    if (drop) {
      setEditingDrop(drop);
      setDropShopId(drop.shop.id);
      setDropShopSearch(drop.shop.name);
      setDropLitres(String(drop.litres));
      setDropCash(String(drop.cashCollected));
      setDropNotes(drop.notes ?? '');
    } else {
      setEditingDrop(null);
      setDropShopId(null);
      setDropShopSearch('');
      setDropLitres('');
      setDropCash('');
      setDropNotes('');
    }
    setShowDrop(true);
  }

  function closeDrop() {
    setShowDrop(false);
    setEditingDrop(null);
    setDropShopId(null);
    setDropShopSearch('');
    setDropLitres('');
    setDropCash('');
    setDropNotes('');
  }

  function recalc(drops: Drop[]) {
    return drops.reduce((s, d) => s + Number(d.litres), 0);
  }

  const filteredShops = dropShopSearch.length > 0
    ? shops.filter(s => s.name.toLowerCase().includes(dropShopSearch.toLowerCase()) || s.code.toLowerCase().includes(dropShopSearch.toLowerCase()))
    : shops;

  const totalCash = trip?.drops.reduce((s, d) => s + Number(d.cashCollected), 0) ?? 0;
  const totalExp  = trip?.expenses.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
  const isSubmitted = trip?.status === 'SUBMITTED';

  const dateStr = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Driver Trip Log</Text>
          <Text style={s.headerSub}>{dateStr}</Text>
        </View>
        {trip && !isSubmitted && (
          <TouchableOpacity style={s.submitBtn} onPress={handleSubmitTrip}>
            <Text style={s.submitBtnText}>Submit ✓</Text>
          </TouchableOpacity>
        )}
        {isSubmitted && (
          <View style={s.submittedBadge}><Text style={s.submittedBadgeText}>✓ Done</Text></View>
        )}
      </View>

      {/* No trip yet */}
      {!trip ? (
        <View style={s.noTrip}>
          <Text style={s.noTripEmoji}>🚛</Text>
          <Text style={s.noTripTitle}>No trip started today</Text>
          <Text style={s.noTripSub}>Load milk from the factory to begin</Text>
          <TouchableOpacity style={s.startBtn} onPress={() => setShowStart(true)}>
            <Text style={s.startBtnText}>🏭  Start Trip — Log Factory Load</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Tabs */}
          <View style={s.tabs}>
            {(['summary', 'drops', 'expenses'] as Tab[]).map(t => (
              <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                  {t === 'summary' ? '📊 Summary' : t === 'drops' ? `🏪 Drops (${trip.drops.length})` : `💸 Expenses (${trip.expenses.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}>

            {/* ── SUMMARY TAB ── */}
            {tab === 'summary' && (
              <>
                {/* Variance card */}
                <View style={[s.varianceCard, Number(trip.litresVariance) < 0 && s.varianceCardLoss]}>
                  <Text style={s.varianceLabel}>TRIP VARIANCE</Text>
                  <Text style={[s.varianceValue, Number(trip.litresVariance) < 0 && s.varianceLoss]}>
                    {Number(trip.litresVariance) > 0 ? '+' : ''}{Number(trip.litresVariance).toFixed(1)}L
                  </Text>
                  <Text style={s.varianceSub}>
                    {Number(trip.litresVariance) === 0 ? '✓ Perfect — all milk accounted for' :
                     Number(trip.litresVariance) > 0 ? `${Number(trip.litresVariance).toFixed(1)}L not yet delivered` :
                     `⚠️ ${Math.abs(Number(trip.litresVariance)).toFixed(1)}L over-delivered`}
                  </Text>
                </View>

                {/* Stats grid */}
                <View style={s.statsGrid}>
                  <StatCard label="Loaded" value={`${Number(trip.litresLoaded).toFixed(0)}L`} color={GREEN} />
                  <StatCard label="Delivered" value={`${Number(trip.litresDelivered).toFixed(0)}L`} color="#60a5fa" />
                  <StatCard label="Drops" value={String(trip.drops.length)} color="#a78bfa" />
                  <StatCard label="Cash Collected" value={`${totalCash.toLocaleString()}`} color="#fb923c" sub="KES" />
                  <StatCard label="Expenses" value={`${totalExp.toLocaleString()}`} color="#f87171" sub="KES" />
                  <StatCard label="Net Cash" value={`${(totalCash - totalExp).toLocaleString()}`} color={GREEN} sub="KES" />
                </View>

                {/* Loaded from factory */}
                {!isSubmitted && (
                  <TouchableOpacity style={s.editLoadBtn} onPress={() => { setLitresLoaded(String(trip.litresLoaded)); setShowStart(true); }}>
                    <Text style={s.editLoadText}>✏️  Edit factory load ({Number(trip.litresLoaded).toFixed(1)}L)</Text>
                  </TouchableOpacity>
                )}

                {/* Quick shop summary */}
                {trip.drops.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>SHOP DELIVERIES</Text>
                    {trip.drops.map(d => (
                      <View key={d.id} style={s.summaryRow}>
                        <View style={s.summaryShopDot} />
                        <Text style={s.summaryShopName} numberOfLines={1}>{d.shop.name}</Text>
                        <Text style={s.summaryLitres}>{Number(d.litres).toFixed(1)}L</Text>
                        <Text style={s.summaryCash}>KES {Number(d.cashCollected).toLocaleString()}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ── DROPS TAB ── */}
            {tab === 'drops' && (
              <>
                {!isSubmitted && (
                  <TouchableOpacity style={s.addBtn} onPress={() => openDrop()}>
                    <Text style={s.addBtnText}>+ Add Shop Drop</Text>
                  </TouchableOpacity>
                )}

                {trip.drops.length === 0 ? (
                  <View style={s.empty}>
                    <Text style={s.emptyIcon}>🏪</Text>
                    <Text style={s.emptyText}>No drops recorded yet</Text>
                  </View>
                ) : trip.drops.map(d => (
                  <View key={d.id} style={s.dropCard}>
                    <View style={s.dropCardTop}>
                      <View style={s.dropAvatar}><Text style={s.dropAvatarText}>{d.shop.name.charAt(0)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.dropShopName}>{d.shop.name}</Text>
                        <Text style={s.dropShopCode}>{d.shop.code}</Text>
                      </View>
                      <Text style={s.dropLitres}>{Number(d.litres).toFixed(1)}L</Text>
                    </View>
                    <View style={s.dropCardBottom}>
                      <Text style={s.dropCash}>💵 KES {Number(d.cashCollected).toLocaleString()}</Text>
                      {d.notes ? <Text style={s.dropNotes}>{d.notes}</Text> : null}
                      {!isSubmitted && (
                        <View style={s.dropActions}>
                          <TouchableOpacity style={s.dropEditBtn} onPress={() => openDrop(d)}>
                            <Text style={s.dropEditText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.dropDeleteBtn} onPress={() => handleDeleteDrop(d)}>
                            <Text style={s.dropDeleteText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* ── EXPENSES TAB ── */}
            {tab === 'expenses' && (
              <>
                {!isSubmitted && (
                  <TouchableOpacity style={s.addBtn} onPress={() => setShowExpense(true)}>
                    <Text style={s.addBtnText}>+ Add Expense</Text>
                  </TouchableOpacity>
                )}

                {trip.expenses.length === 0 ? (
                  <View style={s.empty}>
                    <Text style={s.emptyIcon}>💸</Text>
                    <Text style={s.emptyText}>No expenses logged yet</Text>
                  </View>
                ) : trip.expenses.map(e => (
                  <View key={e.id} style={s.expenseCard}>
                    <Text style={s.expEmoji}>{CATEGORY_EMOJI[e.category] ?? '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.expCategory}>{e.category}</Text>
                      {e.description ? <Text style={s.expDesc}>{e.description}</Text> : null}
                    </View>
                    <Text style={s.expAmount}>KES {Number(e.amount).toLocaleString()}</Text>
                    {!isSubmitted && (
                      <TouchableOpacity onPress={() => handleDeleteExpense(e)} style={{ marginLeft: 10 }}>
                        <Text style={{ color: '#f87171', fontSize: 18 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {trip.expenses.length > 0 && (
                  <View style={s.expTotal}>
                    <Text style={s.expTotalLabel}>TOTAL EXPENSES</Text>
                    <Text style={s.expTotalValue}>KES {totalExp.toLocaleString()}</Text>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        </>
      )}

      {/* ── MODAL: Start/Edit Trip ── */}
      <Modal visible={showStart} animationType="slide" transparent>
        <View style={m.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={m.sheet}>
              <Text style={m.title}>🏭 Factory Load</Text>
              <Text style={m.subtitle}>How many litres did you load from the factory?</Text>
              <TextInput
                style={m.bigInput}
                placeholder="0.0"
                placeholderTextColor="#1e3d5c"
                value={litresLoaded}
                onChangeText={setLitresLoaded}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={m.hint}>Enter total litres loaded onto your vehicle</Text>
              <View style={m.btnRow}>
                <TouchableOpacity style={m.cancelBtn} onPress={() => { setShowStart(false); setLitresLoaded(''); }}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={m.confirmBtn} onPress={handleStartTrip} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0d1f33" /> : <Text style={m.confirmText}>{trip ? 'Update' : 'Start Trip'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── MODAL: Add/Edit Drop ── */}
      <Modal visible={showDrop} animationType="slide" transparent>
        <View style={m.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={m.sheet}>
              <Text style={m.title}>{editingDrop ? '✏️ Edit Drop' : '🏪 Add Shop Drop'}</Text>

              {/* Shop search */}
              <Text style={m.fieldLabel}>SHOP</Text>
              <TextInput
                style={m.input}
                placeholder="Search shop name..."
                placeholderTextColor="#4a6585"
                value={dropShopSearch}
                onChangeText={t => { setDropShopSearch(t); if (dropShopId) setDropShopId(null); }}
              />
              {dropShopSearch.length > 0 && !dropShopId && (
                <ScrollView style={m.shopList} nestedScrollEnabled>
                  {filteredShops.slice(0, 8).map(sh => (
                    <TouchableOpacity key={sh.id} style={m.shopRow} onPress={() => { setDropShopId(sh.id); setDropShopSearch(sh.name); }}>
                      <Text style={m.shopRowName}>{sh.name}</Text>
                      <Text style={m.shopRowCode}>{sh.code}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {dropShopId && (
                <View style={m.selectedShip}>
                  <Text style={m.selectedShipText}>✓ {dropShopSearch}</Text>
                  <TouchableOpacity onPress={() => { setDropShopId(null); setDropShopSearch(''); }}>
                    <Text style={{ color: '#4a7090' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>LITRES DELIVERED</Text>
              <TextInput style={m.input} placeholder="0.0" placeholderTextColor="#4a6585" value={dropLitres} onChangeText={setDropLitres} keyboardType="decimal-pad" />

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>CASH COLLECTED (KES)</Text>
              <TextInput style={m.input} placeholder="0" placeholderTextColor="#4a6585" value={dropCash} onChangeText={setDropCash} keyboardType="decimal-pad" />

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>NOTES (optional)</Text>
              <TextInput style={m.input} placeholder="e.g. short by 2L" placeholderTextColor="#4a6585" value={dropNotes} onChangeText={setDropNotes} />

              <View style={m.btnRow}>
                <TouchableOpacity style={m.cancelBtn} onPress={closeDrop}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={m.confirmBtn} onPress={handleSaveDrop} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0d1f33" /> : <Text style={m.confirmText}>Save Drop</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── MODAL: Add Expense ── */}
      <Modal visible={showExpense} animationType="slide" transparent>
        <View style={m.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={m.sheet}>
              <Text style={m.title}>💸 Log Expense</Text>

              <Text style={m.fieldLabel}>CATEGORY</Text>
              <View style={m.catRow}>
                {EXPENSE_CATEGORIES.map(c => (
                  <TouchableOpacity key={c} style={[m.catBtn, expCat === c && m.catBtnActive]} onPress={() => setExpCat(c)}>
                    <Text style={m.catEmoji}>{CATEGORY_EMOJI[c]}</Text>
                    <Text style={[m.catText, expCat === c && m.catTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>AMOUNT (KES)</Text>
              <TextInput style={m.input} placeholder="0" placeholderTextColor="#4a6585" value={expAmount} onChangeText={setExpAmount} keyboardType="decimal-pad" autoFocus />

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>DESCRIPTION (optional)</Text>
              <TextInput style={m.input} placeholder="e.g. Petrol — Total" placeholderTextColor="#4a6585" value={expDesc} onChangeText={setExpDesc} />

              <View style={m.btnRow}>
                <TouchableOpacity style={m.cancelBtn} onPress={() => { setShowExpense(false); setExpAmount(''); setExpDesc(''); }}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={m.confirmBtn} onPress={handleSaveExpense} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0d1f33" /> : <Text style={m.confirmText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <View style={sc.card}>
      {sub && <Text style={sc.sub}>{sub}</Text>}
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
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
  submitBtn:       { backgroundColor: '#143020', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: GREEN },
  submitBtnText:   { color: GREEN, fontWeight: '800', fontSize: 13 },
  submittedBadge:  { backgroundColor: '#0d2e1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  submittedBadgeText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  noTrip:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  noTripEmoji:     { fontSize: 64, marginBottom: 20 },
  noTripTitle:     { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  noTripSub:       { fontSize: 14, color: '#4a7090', marginBottom: 32, textAlign: 'center' },
  startBtn:        { backgroundColor: GREEN, borderRadius: 16, padding: 18, alignItems: 'center', width: '100%' },
  startBtnText:    { color: BG, fontWeight: '900', fontSize: 15 },
  tabs:            { flexDirection: 'row', backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  tab:             { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:       { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabText:         { fontSize: 11, color: '#4a7090', fontWeight: '600' },
  tabTextActive:   { color: GREEN },
  scroll:          { flex: 1, padding: 16 },
  varianceCard:    { backgroundColor: '#0d2e1a', borderRadius: 18, padding: 20, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1e4d2a' },
  varianceCardLoss:{ backgroundColor: '#2e0d0d', borderColor: '#4d1e1e' },
  varianceLabel:   { fontSize: 10, color: '#3a8a50', letterSpacing: 2, marginBottom: 6 },
  varianceValue:   { fontSize: 42, fontWeight: '900', color: GREEN },
  varianceLoss:    { color: '#f87171' },
  varianceSub:     { fontSize: 12, color: '#3a8a50', marginTop: 6, textAlign: 'center' },
  statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  editLoadBtn:     { backgroundColor: CARD, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  editLoadText:    { color: '#4a7090', fontSize: 13 },
  sectionLabel:    { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2.5, marginBottom: 10, marginTop: 4 },
  summaryRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  summaryShopDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  summaryShopName: { flex: 1, color: '#fff', fontSize: 13 },
  summaryLitres:   { color: GREEN, fontWeight: '700', fontSize: 13, width: 50, textAlign: 'right' },
  summaryCash:     { color: '#fb923c', fontSize: 12, width: 80, textAlign: 'right' },
  addBtn:          { backgroundColor: '#143020', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#1e4d2a' },
  addBtnText:      { color: GREEN, fontWeight: '800', fontSize: 14 },
  empty:           { alignItems: 'center', paddingTop: 50 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { color: '#4a7090', fontSize: 14 },
  dropCard:        { backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  dropCardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  dropAvatar:      { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0d2e1a', alignItems: 'center', justifyContent: 'center' },
  dropAvatarText:  { color: GREEN, fontWeight: '900', fontSize: 16 },
  dropShopName:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  dropShopCode:    { color: '#4a7090', fontSize: 11, marginTop: 2 },
  dropLitres:      { color: GREEN, fontWeight: '900', fontSize: 18 },
  dropCardBottom:  { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  dropCash:        { color: '#fb923c', fontSize: 13, marginBottom: 6 },
  dropNotes:       { color: '#4a7090', fontSize: 12, marginBottom: 6 },
  dropActions:     { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  dropEditBtn:     { backgroundColor: '#1e3d5c', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  dropEditText:    { color: '#60a5fa', fontWeight: '600', fontSize: 12 },
  dropDeleteBtn:   { backgroundColor: '#2e0d0d', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  dropDeleteText:  { color: '#f87171', fontWeight: '600', fontSize: 12 },
  expenseCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: BORDER, gap: 12 },
  expEmoji:        { fontSize: 24 },
  expCategory:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  expDesc:         { color: '#4a7090', fontSize: 12, marginTop: 2 },
  expAmount:       { color: '#f87171', fontWeight: '900', fontSize: 16 },
  expTotal:        { backgroundColor: '#2e0d0d', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#4d1e1e' },
  expTotalLabel:   { fontSize: 10, fontWeight: '700', color: '#8a3a3a', letterSpacing: 2 },
  expTotalValue:   { fontSize: 20, fontWeight: '900', color: '#f87171' },
});

const sc = StyleSheet.create({
  card:  { width: '47%', backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  sub:   { fontSize: 9, color: '#4a7090', letterSpacing: 1, marginBottom: 2 },
  value: { fontSize: 22, fontWeight: '900' },
  label: { fontSize: 10, color: '#4a7090', marginTop: 4, textAlign: 'center' },
});

const m = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#132d48', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: '#1e3d5c' },
  title:        { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 6 },
  subtitle:     { fontSize: 13, color: '#4a7090', marginBottom: 20 },
  bigInput:     { backgroundColor: '#0d1f33', borderWidth: 2, borderColor: GREEN, borderRadius: 16, fontSize: 48, fontWeight: '900', color: GREEN, textAlign: 'center', paddingVertical: 16, marginBottom: 8 },
  hint:         { fontSize: 12, color: '#4a7090', textAlign: 'center', marginBottom: 20 },
  fieldLabel:   { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2, marginBottom: 8 },
  input:        { backgroundColor: '#0d1f33', borderWidth: 1, borderColor: '#1e3d5c', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: '#fff', fontSize: 15, marginBottom: 4 },
  shopList:     { backgroundColor: '#0d1f33', borderRadius: 12, maxHeight: 180, marginBottom: 8, borderWidth: 1, borderColor: '#1e3d5c' },
  shopRow:      { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e3d5c' },
  shopRowName:  { color: '#fff', fontSize: 14 },
  shopRowCode:  { color: '#4a7090', fontSize: 12 },
  selectedShip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d2e1a', borderRadius: 10, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: '#1e4d2a' },
  selectedShipText: { color: GREEN, fontWeight: '700' },
  catRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0d1f33', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#1e3d5c' },
  catBtnActive: { backgroundColor: '#0d2e1a', borderColor: GREEN },
  catEmoji:     { fontSize: 16 },
  catText:      { color: '#4a7090', fontSize: 12, fontWeight: '600' },
  catTextActive:{ color: GREEN },
  btnRow:       { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:    { flex: 1, backgroundColor: '#0d1f33', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e3d5c' },
  cancelText:   { color: '#4a7090', fontWeight: '700', fontSize: 14 },
  confirmBtn:   { flex: 2, backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: 'center' },
  confirmText:  { color: '#0d1f33', fontWeight: '900', fontSize: 14 },
});
