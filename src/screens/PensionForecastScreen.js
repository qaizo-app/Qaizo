// src/screens/PensionForecastScreen.js
// Пенсионный прогноз: профили по людям, две корзины (кицва/капитал),
// степпер возраста + сравнение возрастов. Математика — utils/pensionForecast.
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Amount from '../components/Amount';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import RowText from '../components/RowText';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';
import {
  DEFAULT_ANNUAL_RETURN_PCT, DEFAULT_ANNUITY_COEF,
  forecastFamily, forecastProfile,
} from '../utils/pensionForecast';

const AGE_MIN = 55;
const AGE_MAX = 75;
const genId = () => `pp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function PensionForecastScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [profiles, setProfiles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // profile id | 'family'
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  // profile create/edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [links, setLinks] = useState([]); // draft [{accountId, basket}]
  const [yearErr, setYearErr] = useState(false);
  const [nameErr, setNameErr] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // deposit override editing
  const [overrideDraft, setOverrideDraft] = useState(null); // string | null
  const st = createSt();

  const loadData = async () => {
    const [pp, accs, txs] = await Promise.all([
      dataService.getPensionProfiles(),
      dataService.getAccounts(),
      dataService.getTransactions(),
    ]);
    setProfiles(pp);
    setAccounts(accs);
    setTransactions(txs);
    setSelectedId(prev => {
      if (prev === 'family') return pp.length >= 2 ? prev : (pp[0]?.id || null);
      if (prev && pp.find(p => p.id === prev)) return prev;
      return pp[0]?.id || null;
    });
    return pp;
  };
  useFocusEffect(useCallback(() => {
    loadData().then(pp => {
      if (route.params?.openCreate) {
        navigation.setParams({ openCreate: undefined });
        if ((pp || []).length === 0) openAdd();
      }
    });
  }, [route.params?.openCreate]));

  const investAccounts = accounts.filter(a => (a.type === 'investment' && a.isActive !== false) || links.some(l => l.accountId === a.id));
  const accName = (id) => accounts.find(a => a.id === id)?.name || '?';
  const selected = selectedId === 'family' ? null : profiles.find(p => p.id === selectedId);
  const selAge = selected && Number.isFinite(selected.retireAge) ? selected.retireAge : 67;
  const resolvedLinks = selected ? (selected.links || []).filter(l => accounts.some(a => a.id === l.accountId && a.isActive !== false)) : [];

  // Persist profiles + prune links to accounts that no longer exist.
  const persist = async (next) => {
    const accIds = new Set(accounts.map(a => a.id));
    const pruned = next.map(p => ({ ...p, links: (p.links || []).filter(l => accIds.has(l.accountId)) }));
    setProfiles(pruned);
    await dataService.savePensionProfiles(pruned);
  };

  const patchSelected = (patch) => {
    if (!selected) return;
    persist(profiles.map(p => p.id === selected.id ? { ...p, ...patch } : p));
  };

  // ── profile modal ──
  const openAdd = () => {
    setEditId(null); setName(''); setBirthYear(''); setLinks([]); setYearErr(false); setNameErr(false);
    setShowEdit(true);
  };
  const openEdit = (p) => {
    setEditId(p.id); setName(p.name); setBirthYear(String(p.birthYear));
    setLinks((p.links || []).map(l => ({ ...l }))); setYearErr(false); setNameErr(false);
    setShowEdit(true);
  };
  const saveProfile = () => {
    const year = parseInt(birthYear, 10);
    if (!Number.isFinite(year) || year < 1930 || year > 2015) { setYearErr(true); return; }
    if (!name.trim()) { setNameErr(true); return; }
    if (editId) {
      persist(profiles.map(p => p.id === editId ? { ...p, name: name.trim(), birthYear: year, links } : p));
    } else {
      const p = {
        id: genId(), name: name.trim(), birthYear: year, retireAge: 67,
        links, createdAt: new Date().toISOString(),
      };
      persist([...profiles, p]);
      setSelectedId(p.id);
    }
    setShowEdit(false);
  };
  const confirmDelete = () => {
    const rest = profiles.filter(p => p.id !== deleteTarget.id);
    persist(rest);
    setDeleteTarget(null); setShowEdit(false);
    setSelectedId(rest[0]?.id || null);
  };
  const toggleDraftLink = (accountId) => {
    setLinks(prev => {
      const found = prev.find(l => l.accountId === accountId);
      if (!found) return [...prev, { accountId, basket: 'pension' }];
      return prev.filter(l => l.accountId !== accountId);
    });
  };
  const toggleDraftBasket = (accountId) => {
    setLinks(prev => prev.map(l => l.accountId === accountId
      ? { ...l, basket: l.basket === 'pension' ? 'capital' : 'pension' } : l));
  };

  // ── forecast data ──
  const fam = profiles.length > 0 ? forecastFamily(profiles, accounts, transactions) : null;
  const fc = selected ? forecastProfile(selected, accounts, transactions) : null;
  const compareAges = selected
    ? ([selAge, 64, 67].filter((v, i, a) => a.indexOf(v) === i).length === 3
        ? [selAge, 64, 67].sort((a, b) => a - b)
        : [60, 64, 67])
    : [];

  const basketBadge = (basket) => (
    <View style={[st.badge, { backgroundColor: basket === 'pension' ? `${colors.green}22` : `${colors.blue}22` }]}>
      <Text style={[st.badgeTxt, { color: basket === 'pension' ? colors.green : colors.blue }]}>
        {i18n.t(basket === 'pension' ? 'pfBasketPension' : 'pfBasketCapital')}
      </Text>
    </View>
  );

  // retireAge === null → family view (no single age to show)
  const renderResult = (r, retireAge, alreadyEligible) => (
    <Card>
      <Text style={st.resultLabel}>
        {retireAge == null ? i18n.t('pfFamily') : i18n.t('pfSavedBy').replace('{age}', String(retireAge))}
      </Text>
      <Amount value={r.pension.projected + r.capital.projected} style={st.resultTotal} numberOfLines={1} adjustsFontSizeToFit />
      {alreadyEligible && <Text style={st.eligibleNote}>{i18n.t('pfAlreadyEligible')}</Text>}
      <View style={st.basketRow}>
        <View style={[st.dot, { backgroundColor: colors.green }]} />
        <RowText style={st.basketLabel}>{i18n.t('pfAnnuity')}</RowText>
        <Text style={st.basketValue}>~{r.pension.annuity.toLocaleString()} {sym()}{i18n.t('pfPerMonth')}</Text>
      </View>
      <View style={st.basketRow}>
        <View style={[st.dot, { backgroundColor: colors.blue }]} />
        <RowText style={st.basketLabel}>{i18n.t('pfCapital')}</RowText>
        <Text style={st.basketValue}>{r.capital.projected.toLocaleString()} {sym()}</Text>
      </View>
    </Card>
  );

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('pfTitle')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Profile chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
          {profiles.map(p => (
            <TouchableOpacity key={p.id} style={[st.chip, selectedId === p.id && st.chipActive]}
              onPress={() => { setSelectedId(p.id); setOverrideDraft(null); }} onLongPress={() => openEdit(p)} delayLongPress={350}>
              <Text style={[st.chipTxt, selectedId === p.id && st.chipTxtActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
          {profiles.length >= 2 && (
            <TouchableOpacity style={[st.chip, selectedId === 'family' && st.chipActive]} onPress={() => setSelectedId('family')}>
              <Text style={[st.chipTxt, selectedId === 'family' && st.chipTxtActive]}>{i18n.t('pfFamily')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={st.chipAdd} onPress={openAdd}>
            <Feather name="plus" size={16} color={colors.green} />
          </TouchableOpacity>
        </ScrollView>

        {profiles.length === 0 && (
          <Card>
            <View style={st.empty}>
              <Feather name="umbrella" size={44} color={colors.textMuted} />
              <Text style={st.emptyTitle}>{i18n.t('pfTeaser')}</Text>
              <TouchableOpacity style={st.setupBtn} onPress={openAdd}>
                <Text style={st.setupBtnTxt}>{i18n.t('pfAddProfile')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ── Family view ── */}
        {selectedId === 'family' && fam && renderResult(fam, null, false)}
        {selectedId === 'family' && fam && (
          <Text style={st.familyNote}>{i18n.t('pfDisclaimer')}</Text>
        )}

        {/* ── Single profile ── */}
        {selected && fc && (
          <>
            {/* Age stepper */}
            <Card>
              <View style={st.stepperRow}>
                <RowText style={st.stepperLabel}>{i18n.t('pfRetireAge')}</RowText>
                <View style={st.stepper}>
                  <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ retireAge: Math.max(AGE_MIN, selAge - 1) })}>
                    <Feather name="minus" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={st.stepVal}>{selAge}</Text>
                  <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ retireAge: Math.min(AGE_MAX, selAge + 1) })}>
                    <Feather name="plus" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Result */}
            {resolvedLinks.length === 0 ? (
              <Card>
                <View style={st.empty}>
                  <Feather name="link" size={36} color={colors.textMuted} />
                  <Text style={st.emptyText}>{i18n.t('pfNoAccounts')}</Text>
                  <TouchableOpacity style={st.setupBtn} onPress={() => openEdit(selected)}>
                    <Text style={st.setupBtnTxt}>{i18n.t('pfAddAccounts')}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : (
              <>
                {renderResult(fc, selAge, fc.alreadyEligible)}

                {/* Comparison table */}
                <Card>
                  <Text style={st.sectionTitle}>{i18n.t('pfCompare')}</Text>
                  <View style={st.tblHead}>
                    <RowText style={[st.tblCell, st.tblHeadTxt]}>{i18n.t('pfAge')}</RowText>
                    <RowText style={[st.tblCell, st.tblHeadTxt, st.tblNum]}>{i18n.t('pfProjectedCol')}</RowText>
                    <RowText style={[st.tblCell, st.tblHeadTxt, st.tblNum]}>{i18n.t('pfAnnuity')}</RowText>
                    <RowText style={[st.tblCell, st.tblHeadTxt, st.tblNum]}>{i18n.t('pfBasketCapital')}</RowText>
                  </View>
                  {compareAges.map(age => {
                    const r = forecastProfile(selected, accounts, transactions, new Date(), age);
                    const isChosen = age === selAge;
                    return (
                      <View key={age} style={[st.tblRow, isChosen && st.tblRowActive]}>
                        <RowText style={[st.tblCell, isChosen && st.tblCellActive]}>{age}</RowText>
                        <RowText style={[st.tblCell, st.tblNum, isChosen && st.tblCellActive]}>{Math.round(r.pension.projected + r.capital.projected).toLocaleString()}</RowText>
                        <RowText style={[st.tblCell, st.tblNum, isChosen && st.tblCellActive]}>~{r.pension.annuity.toLocaleString()}</RowText>
                        <RowText style={[st.tblCell, st.tblNum, isChosen && st.tblCellActive]}>{r.capital.projected.toLocaleString()}</RowText>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* Linked accounts */}
            <Card>
              <View style={st.sectionHead}>
                <RowText style={st.sectionTitle}>{i18n.t('pfAccountsSection')}</RowText>
                <TouchableOpacity onPress={() => openEdit(selected)}>
                  <Feather name="edit-2" size={16} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              {(selected.links || []).filter(l => accounts.find(a => a.id === l.accountId)).map(l => (
                <TouchableOpacity key={l.accountId} style={st.accRow} onPress={() => {
                  patchSelected({ links: selected.links.map(x => x.accountId === l.accountId ? { ...x, basket: x.basket === 'pension' ? 'capital' : 'pension' } : x) });
                }}>
                  <RowText style={st.accName}>{accName(l.accountId)}</RowText>
                  {basketBadge(l.basket)}
                </TouchableOpacity>
              ))}
            </Card>

            {/* Assumptions (collapsed). Keyed by profile id: the TextInputs
                inside use uncontrolled defaultValue, which is only applied on
                mount — without the key, switching profiles with this section
                open kept showing the previous profile's values. */}
            <Card key={`assump_${selected.id}`}>
              <TouchableOpacity style={st.sectionHead} onPress={() => setAssumptionsOpen(v => !v)}>
                <RowText style={st.sectionTitle}>{i18n.t('pfAssumptions')}</RowText>
                <Feather name={assumptionsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textDim} />
              </TouchableOpacity>
              {assumptionsOpen && (
                <>
                  {/* Annual return stepper 0–10 step 0.5 */}
                  <View style={st.stepperRow}>
                    <RowText style={st.assumpLabel}>{i18n.t('pfReturn')}</RowText>
                    <View style={st.stepper}>
                      <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ annualReturnPct: Math.max(0, (selected.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT) - 0.5) })}>
                        <Feather name="minus" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={st.stepVal}>{(selected.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT).toFixed(1)}%</Text>
                      <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ annualReturnPct: Math.min(10, (selected.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT) + 0.5) })}>
                        <Feather name="plus" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Annuity coefficient */}
                  <View style={st.stepperRow}>
                    <RowText style={st.assumpLabel}>{i18n.t('pfCoef')}</RowText>
                    <TextInput
                      style={[st.coefInput, { textAlign: 'center' }]}
                      keyboardType="numeric"
                      defaultValue={String(selected.annuityCoef ?? DEFAULT_ANNUITY_COEF)}
                      onEndEditing={(e) => {
                        const v = parseFloat((e.nativeEvent.text || '').replace(',', '.'));
                        patchSelected({ annuityCoef: Number.isFinite(v) && v > 0 ? v : DEFAULT_ANNUITY_COEF });
                      }}
                    />
                  </View>
                  <Text style={st.hint}>{i18n.t('pfCoefHint')}</Text>

                  {/* Monthly deposit: auto value + override */}
                  <View style={st.stepperRow}>
                    <RowText style={st.assumpLabel}>{i18n.t('pfMonthlyDeposit')}</RowText>
                    {selected.monthlyOverride == null && overrideDraft == null ? (
                      <TouchableOpacity style={st.autoRow} onPress={() => setOverrideDraft(String(fc.monthlyAuto.pension + fc.monthlyAuto.capital))}>
                        <Text style={st.autoVal}>{(fc.monthlyAuto.pension + fc.monthlyAuto.capital).toLocaleString()} {sym()} · {i18n.t('pfAuto')}</Text>
                        <Feather name="edit-2" size={14} color={colors.textDim} />
                      </TouchableOpacity>
                    ) : (
                      <TextInput
                        style={[st.coefInput, { textAlign: 'center' }]}
                        keyboardType="numeric"
                        autoFocus={overrideDraft != null}
                        defaultValue={overrideDraft ?? String(selected.monthlyOverride)}
                        onEndEditing={(e) => {
                          const v = parseFloat((e.nativeEvent.text || '').replace(',', '.'));
                          setOverrideDraft(null);
                          patchSelected({ monthlyOverride: Number.isFinite(v) && v >= 0 ? v : null });
                        }}
                      />
                    )}
                  </View>
                  {selected.monthlyOverride != null && (
                    <TouchableOpacity onPress={() => { setOverrideDraft(null); patchSelected({ monthlyOverride: null }); }}>
                      <Text style={st.resetAuto}>{i18n.t('pfResetAuto')}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </Card>

            <Text style={st.disclaimer}>{i18n.t('pfDisclaimer')}</Text>
          </>
        )}
      </ScrollView>

      {/* Profile create/edit modal */}
      <SwipeModal visible={showEdit} onClose={() => setShowEdit(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={st.modalTitle}>{editId ? i18n.t('edit') : i18n.t('pfAddProfile')}</Text>

          <Text style={st.fieldLabel}>{i18n.t('pfProfileName')}</Text>
          <TextInput style={[st.input, { textAlign: i18n.textAlign() }, nameErr && st.inputErr]} value={name}
            onChangeText={(v) => { setName(v); setNameErr(false); }}
            placeholder={i18n.t('pfProfileName')} placeholderTextColor={colors.textMuted} />

          <Text style={st.fieldLabel}>{i18n.t('pfBirthYear')}</Text>
          <TextInput style={[st.input, { textAlign: i18n.textAlign() }, yearErr && st.inputErr]} value={birthYear}
            onChangeText={(v) => { setBirthYear(v); setYearErr(false); }}
            keyboardType="numeric" placeholder="1980" placeholderTextColor={colors.textMuted} maxLength={4} />
          {yearErr && <Text style={st.errTxt}>{i18n.t('pfBirthYearInvalid')}</Text>}

          <Text style={st.fieldLabel}>{i18n.t('pfAccountsSection')}</Text>
          {investAccounts.map(a => {
            const link = links.find(l => l.accountId === a.id);
            return (
              <View key={a.id} style={st.pickRow}>
                <TouchableOpacity style={st.pickLeft} onPress={() => toggleDraftLink(a.id)}>
                  <Feather name={link ? 'check-square' : 'square'} size={20} color={link ? colors.green : colors.textMuted} />
                  <RowText style={st.accName}>  {a.name}</RowText>
                </TouchableOpacity>
                {link && (
                  <TouchableOpacity onPress={() => toggleDraftBasket(a.id)}>
                    {basketBadge(link.basket)}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={st.saveBtn} onPress={saveProfile}>
            <Text style={st.saveBtnTxt}>{i18n.t('save')}</Text>
          </TouchableOpacity>
          {editId && (
            <TouchableOpacity style={st.deleteBtn} onPress={() => setDeleteTarget(profiles.find(p => p.id === editId))}>
              <Text style={st.deleteBtnTxt}>{i18n.t('delete')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SwipeModal>

      <ConfirmModal
        visible={!!deleteTarget}
        title={i18n.t('pfDeleteProfile')}
        message={deleteTarget?.name}
        confirmText={i18n.t('delete')}
        cancelText={i18n.t('cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },

  chipsRow: { flexDirection: i18n.row(), gap: 8, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTxtActive: { color: colors.bg, fontWeight: '700' },
  chipAdd: { width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.green}18`, justifyContent: 'center', alignItems: 'center' },

  empty: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  setupBtn: { backgroundColor: colors.green, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  setupBtnTxt: { color: colors.bg, fontSize: 14, fontWeight: '700' },

  stepperRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  stepperLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  assumpLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  stepper: { flexDirection: i18n.row(), alignItems: 'center', gap: 10, backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: colors.cardBorder },
  stepBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stepVal: { color: colors.text, fontSize: 16, fontWeight: '800', minWidth: 44, textAlign: 'center' },

  resultLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: i18n.textAlign() },
  resultTotal: { color: colors.text, fontSize: 30, fontWeight: '800', marginVertical: 6, textAlign: i18n.textAlign() },
  eligibleNote: { color: colors.orange, fontSize: 12, marginBottom: 6, textAlign: i18n.textAlign() },
  basketRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  basketLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  basketValue: { color: colors.text, fontSize: 15, fontWeight: '700' },

  sectionHead: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8, textAlign: i18n.textAlign() },
  tblHead: { flexDirection: i18n.row(), borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 6 },
  tblHeadTxt: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  tblRow: { flexDirection: i18n.row(), paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tblRowActive: { backgroundColor: `${colors.green}0E`, borderRadius: 8 },
  tblCell: { flexBasis: 0, flexGrow: 1, color: colors.textDim, fontSize: 12, textAlign: i18n.textAlign() },
  tblNum: { textAlign: 'center' },
  tblCellActive: { color: colors.text, fontWeight: '700' },

  accRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  accName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },

  hint: { color: colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: 6, textAlign: i18n.textAlign() },
  coefInput: { backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 15, fontWeight: '700', borderWidth: 1, borderColor: colors.cardBorder, minWidth: 90 },
  autoRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  autoVal: { color: colors.text, fontSize: 14, fontWeight: '700' },
  resetAuto: { color: colors.green, fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: i18n.textAlign() },

  familyNote: { color: colors.textMuted, fontSize: 11, marginHorizontal: 24, marginTop: 8, textAlign: i18n.textAlign() },
  disclaimer: { color: colors.textMuted, fontSize: 11, marginHorizontal: 24, marginTop: 8, lineHeight: 16, textAlign: i18n.textAlign() },

  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: i18n.textAlign() },
  fieldLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, marginTop: 10, textAlign: i18n.textAlign() },
  input: { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.cardBorder },
  inputErr: { borderColor: colors.red },
  errTxt: { color: colors.red, fontSize: 11, marginTop: 4, textAlign: i18n.textAlign() },
  pickRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickLeft: { flexDirection: i18n.row(), alignItems: 'center', flexShrink: 1 },
  saveBtn: { backgroundColor: colors.green, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  deleteBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteBtnTxt: { color: colors.red, fontSize: 14, fontWeight: '600' },
});
