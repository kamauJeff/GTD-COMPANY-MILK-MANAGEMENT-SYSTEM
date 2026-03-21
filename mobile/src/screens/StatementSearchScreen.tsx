// src/screens/StatementSearchScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { farmersApi } from '../api/client';
import FarmerStatementScreen from './FarmerStatementScreen';

interface Employee { id: number; name: string; code: string; role: string; }
interface Props { employee: Employee; onBack: () => void; }

export default function StatementSearchScreen({ employee, onBack }: Props) {
  const [search, setSearch]           = useState('');
  const [results, setResults]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedFarmer, setSelected] = useState<any>(null);

  const now = new Date();
  // Default to previous month if we're in first 5 days (statements usually printed start of new month)
  const defaultMonth = now.getDate() <= 5 ? (now.getMonth() === 0 ? 12 : now.getMonth()) : now.getMonth() + 1;
  const defaultYear  = now.getDate() <= 5 && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear]   = useState(defaultYear);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  async function doSearch(q: string) {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await farmersApi.list({ search: q, limit: 10, isActive: true });
      setResults(res.data?.data ?? res.data ?? []);
    } catch { setResults([]); }
    setLoading(false);
  }

  if (selectedFarmer) {
    return (
      <FarmerStatementScreen
        farmerCode={selectedFarmer.code}
        month={month}
        year={year}
        onClose={() => setSelected(null)}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Farmer Statement</Text>
          <Text style={s.sub}>Search a farmer to print their monthly statement</Text>
        </View>
      </View>

      <View style={s.body}>
        {/* Month/Year picker */}
        <Text style={s.label}>STATEMENT PERIOD</Text>
        <View style={s.periodRow}>
          <View style={s.monthScroll}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity key={i} onPress={() => setMonth(i + 1)}
                style={[s.monthBtn, month === i + 1 && s.monthBtnActive]}>
                <Text style={[s.monthBtnText, month === i + 1 && s.monthBtnTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.yearRow}>
            {[2024, 2025, 2026].map(y => (
              <TouchableOpacity key={y} onPress={() => setYear(y)}
                style={[s.yearBtn, year === y && s.yearBtnActive]}>
                <Text style={[s.yearBtnText, year === y && s.yearBtnTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.selectedPeriod}>
          <Text style={s.selectedPeriodText}>
            📅 {MONTHS[month - 1]} {year}
          </Text>
        </View>

        {/* Search */}
        <Text style={[s.label, { marginTop: 20 }]}>SEARCH FARMER</Text>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Name or code e.g. FM0001..."
            placeholderTextColor="#4a7090"
            value={search}
            onChangeText={doSearch}
            autoCapitalize="none"
          />
          {loading && <ActivityIndicator color={GREEN} size="small" style={{ marginRight: 12 }} />}
        </View>

        {/* Results */}
        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={i => String(i.id)}
            style={s.resultsList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={s.resultRow} onPress={() => setSelected(item)}>
                <View style={s.resultIcon}>
                  <Text style={{ color: GREEN, fontWeight: '700', fontSize: 12 }}>{item.code?.slice(-4)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.resultName}>{item.name}</Text>
                  <Text style={s.resultMeta}>{item.route?.name || '–'} · {item.paymentMethod}</Text>
                </View>
                <Text style={s.resultChev}>›</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {search.length >= 2 && !loading && results.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyText}>No farmers found for "{search}"</Text>
          </View>
        )}

        {search.length < 2 && (
          <View style={s.hint}>
            <Text style={s.hintText}>💡 Type at least 2 characters to search</Text>
            <Text style={s.hintText}>Statement shows all daily litres, gross pay,</Text>
            <Text style={s.hintText}>deductions and net amount payable.</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const GREEN  = '#3ddc84';
const BG     = '#0d1f33';
const CARD   = '#132d48';
const BORDER = '#1e3d5c';

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: BG },
  header:            { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 18, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  backArrow:         { color: GREEN, fontSize: 26, lineHeight: 30 },
  title:             { fontSize: 17, fontWeight: '800', color: '#fff' },
  sub:               { fontSize: 11, color: '#4a7090', marginTop: 2 },
  body:              { flex: 1, padding: 20 },
  label:             { fontSize: 10, fontWeight: '700', color: '#4a7090', letterSpacing: 2, marginBottom: 10 },
  periodRow:         { gap: 8 },
  monthScroll:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthBtn:          { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  monthBtnActive:    { backgroundColor: '#0a2a14', borderColor: GREEN },
  monthBtnText:      { color: '#4a7090', fontSize: 11, fontWeight: '600' },
  monthBtnTextActive:{ color: GREEN },
  yearRow:           { flexDirection: 'row', gap: 8, marginTop: 4 },
  yearBtn:           { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  yearBtnActive:     { backgroundColor: '#0a2a14', borderColor: GREEN },
  yearBtnText:       { color: '#4a7090', fontSize: 13, fontWeight: '600' },
  yearBtnTextActive: { color: GREEN },
  selectedPeriod:    { marginTop: 10, padding: 10, backgroundColor: '#0a2a14', borderRadius: 10, borderWidth: 1, borderColor: GREEN, alignItems: 'center' },
  selectedPeriodText:{ color: GREEN, fontWeight: '700', fontSize: 13 },
  searchWrap:        { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER },
  searchIcon:        { paddingLeft: 14, fontSize: 16 },
  searchInput:       { flex: 1, paddingHorizontal: 12, paddingVertical: 14, color: '#fff', fontSize: 15, fontFamily: 'monospace' },
  resultsList:       { marginTop: 12, maxHeight: 320 },
  resultRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: BORDER, gap: 12 },
  resultIcon:        { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0a2a14', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  resultName:        { color: '#fff', fontSize: 14, fontWeight: '600' },
  resultMeta:        { color: '#4a7090', fontSize: 11, marginTop: 2 },
  resultChev:        { color: '#4a7090', fontSize: 20 },
  empty:             { paddingTop: 30, alignItems: 'center' },
  emptyText:         { color: '#4a7090', fontSize: 13 },
  hint:              { paddingTop: 30, alignItems: 'center', gap: 4 },
  hintText:          { color: '#2a4d6a', fontSize: 12, textAlign: 'center' },
});
