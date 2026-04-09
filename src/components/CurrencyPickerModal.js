// src/components/CurrencyPickerModal.js
// Выбор валюты: местная первая + поиск
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Localization from 'expo-localization';
import i18n from '../i18n';
import { CURRENCIES } from '../utils/currency';
import { colors } from '../theme/colors';
import SwipeModal from './SwipeModal';

// Map device locale/region to currency code
const LOCALE_CURRENCY = {
  IL: 'ILS', US: 'USD', GB: 'GBP', EU: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  RU: 'RUB', UA: 'UAH', JP: 'JPY', CN: 'CNY', IN: 'INR', AU: 'AUD', CA: 'CAD', BR: 'BRL',
  TR: 'TRY', PL: 'PLN', CZ: 'CZK', SE: 'SEK', NO: 'NOK', DK: 'DKK', ZA: 'ZAR', KR: 'KRW',
  SG: 'SGD', MY: 'MYR', TH: 'THB', AE: 'AED', SA: 'SAR', EG: 'EGP', JO: 'JOD', HU: 'HUF',
  RO: 'RON', CH: 'CHF',
};

function getLocalCurrencyCode() {
  try {
    const locales = Localization.getLocales?.() || [];
    const region = locales[0]?.regionCode || '';
    return LOCALE_CURRENCY[region] || 'ILS';
  } catch { return 'ILS'; }
}

export default function CurrencyPickerModal({ visible, onClose, onSelect, selected }) {
  const [search, setSearch] = useState('');
  const st = createSt();

  useEffect(() => { if (visible) setSearch(''); }, [visible]);

  const localCode = getLocalCurrencyCode();

  // Sort: selected first, then original order
  const sorted = [...CURRENCIES].sort((a, b) => {
    if (a.code === selected) return -1;
    if (b.code === selected) return 1;
    return 0;
  });

  const filtered = search.trim()
    ? sorted.filter(c =>
        c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        c.code.toLowerCase().includes(search.trim().toLowerCase()) ||
        c.symbol.includes(search.trim()))
    : sorted;

  return (
    <SwipeModal visible={visible} onClose={onClose}>
      <View style={st.container}>
        <Text style={st.title}>{i18n.t('currency')}</Text>

        <View style={st.searchRow}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput style={st.searchInput} value={search} onChangeText={setSearch}
            placeholder={i18n.t('search')} placeholderTextColor={colors.textMuted} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={st.list} showsVerticalScrollIndicator={false}>
          {filtered.map(cur => {
            const isSel = cur.code === selected;
            return (
              <TouchableOpacity key={cur.code} style={[st.row, isSel && st.rowActive]}
                onPress={() => { onSelect(cur); onClose(); }} activeOpacity={0.7}>
                <Text style={st.symbol}>{cur.symbol}</Text>
                <View style={st.info}>
                  <Text style={[st.code, isSel && { color: colors.green }]}>{cur.code}</Text>
                  <Text style={st.name}>{cur.name}</Text>
                </View>
                {isSel && <Feather name="check" size={18} color={colors.green} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SwipeModal>
  );
}

const createSt = () => StyleSheet.create({
  container: { maxHeight: 500 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, gap: 10, borderWidth: 1, borderColor: colors.cardBorder },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },

  list: { maxHeight: 380 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 14 },
  rowActive: { backgroundColor: colors.greenSoft, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12 },
  symbol: { color: colors.text, fontSize: 20, fontWeight: '700', width: 40, textAlign: 'center' },
  info: { flex: 1 },
  code: { color: colors.text, fontSize: 16, fontWeight: '700' },
  name: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
