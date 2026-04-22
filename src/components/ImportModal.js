// src/components/ImportModal.js
// Modal for importing transactions from CSV/Excel files with column mapping
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import importService from '../services/importService';
import { colors } from '../theme/colors';
import { catName } from '../utils/categoryName';
import Amount from './Amount';
import SwipeModal from './SwipeModal';

const FIELDS = ['date', 'amount', 'type', 'category', 'payee', 'note'];
const FIELD_ICONS = { date: 'calendar', amount: 'dollar-sign', type: 'tag', category: 'grid', payee: 'user', note: 'file-text' };
const ACCOUNT_TYPES = ['bank', 'cash', 'credit', 'investment', 'crypto', 'asset', 'loan', 'mortgage'];
const COMMON_CATEGORIES = [
  'food', 'restaurant', 'transport', 'fuel', 'health', 'phone', 'utilities',
  'clothing', 'household', 'kids', 'entertainment', 'education', 'cosmetics',
  'electronics', 'insurance', 'rent', 'arnona', 'vaad', 'other',
  'salary_me', 'salary_spouse', 'handyman', 'sales', 'rental_income', 'other_income',
];

export default function ImportModal({ visible, onClose, onImported }) {
  const [step, setStep] = useState('pick'); // pick, mapping, preview, review, importing, done
  const [parseResult, setParseResult] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Review state
  const [reviewData, setReviewData] = useState(null); // { accounts, otherCategories }
  const [existingAccounts, setExistingAccounts] = useState([]);
  const [accountChoices, setAccountChoices] = useState({}); // rawName → { id } | { create: {type} } | { skip: true }
  const [categoryChoices, setCategoryChoices] = useState({}); // rawCat → categoryId
  const st = createSt();

  const handlePick = async () => {
    setLoading(true);
    setError('');
    const result = await importService.pickAndParseFile();
    setLoading(false);
    if (!result.success) {
      if (result.error === 'cancelled') return;
      setError(result.error === 'read_error' ? i18n.t('errorOccurred') : result.error || i18n.t('errorOccurred'));
      return;
    }
    setParseResult(result);
    setMapping(result.autoMapping || {});
    // If auto-detected well (known format), go straight to preview
    if (result.format !== 'generic' && result.transactions.length > 0) {
      setStep('preview');
    } else {
      setStep('mapping');
    }
  };

  const handleApplyMapping = () => {
    if (!parseResult) return;
    const { transactions, errorLines } = importService.parseWithMapping(parseResult.lines, mapping);
    setParseResult(prev => ({ ...prev, transactions, errorLines }));
    setStep('preview');
  };

  const handleProceedToReview = async () => {
    if (!parseResult) return;
    const accounts = await dataService.getAccounts();
    setExistingAccounts(accounts.filter(a => a.isActive !== false));
    const analyzed = importService.analyzeImportData(parseResult.transactions, accounts);
    // If nothing to review, skip directly to import
    if (analyzed.accounts.length === 0 && analyzed.otherCategories.length === 0) {
      return handleImport({});
    }
    // Pre-populate choices from fuzzy matches
    const acc = {};
    analyzed.accounts.forEach(a => {
      if (a.match.confidence === 'high') acc[a.name] = { id: a.match.id };
      else if (a.match.confidence === 'medium') acc[a.name] = { id: a.match.id };
      else acc[a.name] = { create: { type: a.suggestedType || 'bank' } };
    });
    setAccountChoices(acc);
    setCategoryChoices({});
    setReviewData(analyzed);
    setStep('review');
  };

  const handleImport = async (overrides) => {
    if (!parseResult) return;
    setStep('importing');
    // Build accountMap for service
    const accountMap = {};
    const choices = overrides?.accountChoices || accountChoices;
    const cats = overrides?.categoryChoices || categoryChoices;
    Object.keys(choices).forEach(raw => {
      const c = choices[raw];
      if (c.skip) accountMap[raw] = { skip: true };
      else if (c.id) accountMap[raw] = { id: c.id };
      else if (c.create) accountMap[raw] = { create: { name: raw, type: c.create.type } };
    });
    const result = await importService.importTransactions(parseResult.transactions, {
      accountMap,
      categoryMap: cats,
    });
    setImportResult(result);
    setStep('done');
    onImported?.();
  };

  const handleClose = () => {
    if (step === 'importing') return; // Don't close during import
    setStep('pick');
    setParseResult(null);
    setMapping({});
    setImportResult(null);
    setError('');
    setReviewData(null);
    setExistingAccounts([]);
    setAccountChoices({});
    setCategoryChoices({});
    onClose();
  };

  const updateMapping = (field, colIdx) => {
    setMapping(prev => ({ ...prev, [field]: colIdx }));
  };

  const totalIncome = parseResult?.transactions?.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) || 0;
  const totalExpense = parseResult?.transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) || 0;

  const fieldLabel = (f) => {
    const labels = { date: i18n.t('date'), amount: i18n.t('amount'), type: i18n.t('type'), category: i18n.t('category'), payee: i18n.t('payee'), note: i18n.t('note') };
    return labels[f] || f;
  };

  return (
    <SwipeModal visible={visible} onClose={handleClose}>
      {({ close }) => (
        <View>
          <Text style={st.title}>{i18n.t('importData')}</Text>

          {/* Step 1: Pick file */}
          {step === 'pick' && (
            <View>
              <Text style={st.hint}>{i18n.t('importHint')}</Text>
              {error ? (
                <View style={st.errorBox}>
                  <Feather name="alert-circle" size={16} color={colors.red} />
                  <Text style={st.errorTxt}>{error}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={st.pickBtn} onPress={handlePick} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.green} />
                ) : (
                  <>
                    <Feather name="file-plus" size={32} color={colors.green} />
                    <Text style={st.pickTxt}>{i18n.t('importSelectFile')}</Text>
                    <Text style={st.pickSub}>CSV, TSV, Excel</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={st.formatInfo}>
                <Text style={st.formatTitle}>{i18n.t('importFormats')}</Text>
                {['importFormatQaizo', 'importFormatBank', 'importFormatWallet', 'importFormatGeneric'].map(key => (
                  <View key={key} style={st.formatRow}>
                    <Feather name="check" size={14} color={colors.green} />
                    <Text style={st.formatTxt}>{i18n.t(key)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Column mapping */}
          {step === 'mapping' && parseResult && (
            <View>
              <View style={st.fileInfo}>
                <Feather name="file-text" size={20} color={colors.green} />
                <View style={{ flex: 1 }}>
                  <Text style={st.fileName}>{parseResult.fileName}</Text>
                  <Text style={st.fileMeta}>{parseResult.headers.length} {i18n.t('categories').toLowerCase()}</Text>
                </View>
              </View>

              <Text style={st.mapTitle}>{i18n.t('importMapColumns')}</Text>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {FIELDS.map(field => (
                  <View key={field} style={st.mapRow}>
                    <View style={st.mapField}>
                      <Feather name={FIELD_ICONS[field]} size={14} color={colors.green} />
                      <Text style={st.mapFieldTxt}>{fieldLabel(field)}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                      <TouchableOpacity
                        style={[st.mapChip, mapping[field] === -1 && st.mapChipSkip]}
                        onPress={() => updateMapping(field, -1)}
                      >
                        <Text style={[st.mapChipTxt, mapping[field] === -1 && { color: colors.textMuted }]}>—</Text>
                      </TouchableOpacity>
                      {parseResult.headers.map((h, idx) => {
                        const active = mapping[field] === idx;
                        const sample = parseResult.sampleRows?.[0]?.[idx] || '';
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[st.mapChip, active && st.mapChipActive]}
                            onPress={() => updateMapping(field, idx)}
                          >
                            <Text style={[st.mapChipTxt, active && { color: colors.green }]} numberOfLines={1}>
                              {h.length > 12 ? h.slice(0, 12) + '…' : h}
                            </Text>
                            {sample ? <Text style={st.mapSample} numberOfLines={1}>{sample.length > 10 ? sample.slice(0, 10) + '…' : sample}</Text> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ))}
              </ScrollView>

              <View style={st.btnRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setStep('pick')}>
                  <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.importBtn} onPress={handleApplyMapping}>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={st.importTxt}>{i18n.t('next')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && parseResult && (
            <View>
              <View style={st.fileInfo}>
                <Feather name="file-text" size={20} color={colors.green} />
                <View style={{ flex: 1 }}>
                  <Text style={st.fileName}>{parseResult.fileName}</Text>
                  <Text style={st.fileMeta}>
                    {parseResult.transactions.length} {i18n.t('transactions').toLowerCase()}
                    {parseResult.errorLines.length > 0 && ` · ${parseResult.errorLines.length} ${i18n.t('importSkipped')}`}
                  </Text>
                </View>
                {/* Allow re-mapping */}
                <TouchableOpacity onPress={() => setStep('mapping')} style={st.remapBtn}>
                  <Feather name="settings" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={st.summaryRow}>
                <View style={st.summaryItem}>
                  <Text style={st.summaryLabel}>{i18n.t('income')}</Text>
                  <Amount value={totalIncome} style={st.summaryVal} color={colors.green} />
                </View>
                <View style={st.summaryItem}>
                  <Text style={st.summaryLabel}>{i18n.t('expenses')}</Text>
                  <Amount value={-totalExpense} sign style={st.summaryVal} color={colors.red} />
                </View>
              </View>

              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                {parseResult.transactions.slice(0, 10).map((tx, idx) => (
                  <View key={idx} style={st.previewRow}>
                    <Text style={st.previewDate}>{tx.date.slice(0, 10)}</Text>
                    <Text style={st.previewName} numberOfLines={1}>{tx.recipient || catName(tx.categoryId, tx.categoryName)}</Text>
                    <Amount
                      value={tx.type === 'expense' ? -tx.amount : tx.amount}
                      sign={tx.type === 'expense'}
                      style={st.previewAmt}
                      color={tx.type === 'income' ? colors.green : colors.red}
                    />
                  </View>
                ))}
                {parseResult.transactions.length > 10 && (
                  <Text style={st.moreTxt}>+{parseResult.transactions.length - 10} {i18n.t('more').toLowerCase()}...</Text>
                )}
              </ScrollView>

              <View style={st.btnRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setStep('pick')}>
                  <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.importBtn} onPress={handleProceedToReview}>
                  <Feather name="arrow-right" size={18} color="#fff" />
                  <Text style={st.importTxt}>{i18n.t('next')} ({parseResult.transactions.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Review accounts & categories */}
          {step === 'review' && reviewData && (
            <View>
              <Text style={st.reviewSub}>{i18n.t('importReviewHint')}</Text>

              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {reviewData.accounts.length > 0 && (
                  <View style={st.reviewSection}>
                    <Text style={st.reviewTitle}>{i18n.t('importReviewAccounts')}</Text>
                    {reviewData.accounts.map(acc => {
                      const choice = accountChoices[acc.name] || {};
                      return (
                        <View key={acc.name} style={st.reviewItem}>
                          <View style={st.reviewItemHead}>
                            <Text style={st.reviewName} numberOfLines={1}>{acc.name}</Text>
                            <Text style={st.reviewCount}>×{acc.count}</Text>
                          </View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipRow}>
                            {existingAccounts.map(a => {
                              const active = choice.id === a.id;
                              return (
                                <TouchableOpacity
                                  key={a.id}
                                  style={[st.chip, active && st.chipActive]}
                                  onPress={() => setAccountChoices(p => ({ ...p, [acc.name]: { id: a.id } }))}
                                >
                                  <Text style={[st.chipTxt, active && st.chipTxtActive]} numberOfLines={1}>{a.name}</Text>
                                </TouchableOpacity>
                              );
                            })}
                            <TouchableOpacity
                              style={[st.chip, choice.create && st.chipActive]}
                              onPress={() => setAccountChoices(p => ({ ...p, [acc.name]: { create: { type: acc.suggestedType || 'bank' } } }))}
                            >
                              <Feather name="plus" size={12} color={choice.create ? colors.green : colors.textDim} />
                              <Text style={[st.chipTxt, choice.create && st.chipTxtActive]}>{i18n.t('importCreateNew')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[st.chip, choice.skip && st.chipSkipActive]}
                              onPress={() => setAccountChoices(p => ({ ...p, [acc.name]: { skip: true } }))}
                            >
                              <Feather name="x" size={12} color={choice.skip ? colors.red : colors.textDim} />
                              <Text style={[st.chipTxt, choice.skip && { color: colors.red }]}>{i18n.t('importSkip')}</Text>
                            </TouchableOpacity>
                          </ScrollView>
                          {choice.create && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipRow}>
                              {ACCOUNT_TYPES.map(t => {
                                const active = choice.create.type === t;
                                return (
                                  <TouchableOpacity
                                    key={t}
                                    style={[st.chipSm, active && st.chipActive]}
                                    onPress={() => setAccountChoices(p => ({ ...p, [acc.name]: { create: { type: t } } }))}
                                  >
                                    <Text style={[st.chipTxt, active && st.chipTxtActive]}>{i18n.t(t)}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {reviewData.otherCategories.length > 0 && (
                  <View style={st.reviewSection}>
                    <Text style={st.reviewTitle}>{i18n.t('importReviewCategories')}</Text>
                    {reviewData.otherCategories.map(cat => {
                      const chosen = categoryChoices[cat.rawName];
                      return (
                        <View key={cat.rawName} style={st.reviewItem}>
                          <View style={st.reviewItemHead}>
                            <Text style={st.reviewName} numberOfLines={1}>{cat.rawName}</Text>
                            <Text style={st.reviewCount}>×{cat.count}</Text>
                          </View>
                          {cat.samples.length > 0 && (
                            <Text style={st.reviewSamples} numberOfLines={1}>{cat.samples.join(' · ')}</Text>
                          )}
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipRow}>
                            {COMMON_CATEGORIES.map(id => {
                              const active = chosen === id;
                              return (
                                <TouchableOpacity
                                  key={id}
                                  style={[st.chipSm, active && st.chipActive]}
                                  onPress={() => setCategoryChoices(p => ({ ...p, [cat.rawName]: id }))}
                                >
                                  <Text style={[st.chipTxt, active && st.chipTxtActive]}>{i18n.t(id)}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              <View style={st.btnRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setStep('preview')}>
                  <Text style={st.cancelTxt}>{i18n.t('back')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.importBtn} onPress={() => handleImport()}>
                  <Feather name="download" size={18} color="#fff" />
                  <Text style={st.importTxt}>{i18n.t('importConfirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <View style={st.center}>
              <ActivityIndicator size="large" color={colors.green} />
              <Text style={st.importingTxt}>{i18n.t('importInProgress')}</Text>
            </View>
          )}

          {/* Step 5: Done */}
          {step === 'done' && importResult && (
            <View style={st.center}>
              <Feather name="check-circle" size={48} color={colors.green} />
              <Text style={st.doneTxt}>{i18n.t('importDone')}</Text>
              <Text style={st.doneDetail}>
                {importResult.imported} {i18n.t('importImported')}
                {importResult.skippedDuplicates > 0 && ` · ${importResult.skippedDuplicates} ${i18n.t('importDuplicates')}`}
                {importResult.skippedByUser > 0 && ` · ${importResult.skippedByUser} ${i18n.t('importSkipped')}`}
                {importResult.failed > 0 && ` · ${importResult.failed} ${i18n.t('importFailed')}`}
              </Text>
              <TouchableOpacity style={st.doneBtn} onPress={handleClose}>
                <Text style={st.doneBtnTxt}>{i18n.t('close')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SwipeModal>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: i18n.textAlign() },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 20, marginBottom: 20, textAlign: i18n.textAlign() },

  errorBox: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.redSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorTxt: { color: colors.red, fontSize: 12, fontWeight: '600', flex: 1 },
  pickBtn: { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: colors.cardBorder, borderStyle: 'dashed', marginBottom: 20, gap: 8 },
  pickTxt: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pickSub: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

  formatInfo: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 8 },
  formatTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textAlign: i18n.textAlign() },
  formatRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  formatTxt: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },

  fileInfo: { flexDirection: i18n.row(), alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  fileMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  remapBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },

  // Mapping
  mapTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textAlign: i18n.textAlign() },
  mapRow: { marginBottom: 10 },
  mapField: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 6 },
  mapFieldTxt: { color: colors.text, fontSize: 12, fontWeight: '600' },
  mapChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginEnd: 6, minWidth: 40, alignItems: 'center' },
  mapChipActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  mapChipSkip: { borderColor: colors.textMuted, backgroundColor: colors.bg2 },
  mapChipTxt: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  mapSample: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  summaryRow: { flexDirection: i18n.row(), gap: 12, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryVal: { fontSize: 16, fontWeight: '800' },

  previewRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 8 },
  previewDate: { color: colors.textMuted, fontSize: 12, fontWeight: '600', width: 70 },
  previewName: { flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  previewAmt: { fontSize: 12, fontWeight: '700' },
  moreTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '500', textAlign: 'center', paddingVertical: 8 },

  btnRow: { flexDirection: i18n.row(), gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  importBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 8 },
  importTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Review
  reviewSub: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12, textAlign: i18n.textAlign() },
  reviewSection: { marginBottom: 16 },
  reviewTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textAlign: i18n.textAlign() },
  reviewItem: { backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 8 },
  reviewItemHead: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  reviewName: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 },
  reviewCount: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginStart: 8 },
  reviewSamples: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', marginBottom: 6, textAlign: i18n.textAlign() },
  chipRow: { marginTop: 4 },
  chip: { flexDirection: i18n.row(), alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder, marginEnd: 6 },
  chipSm: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder, marginEnd: 6 },
  chipActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  chipSkipActive: { borderColor: colors.red, backgroundColor: colors.redSoft },
  chipTxt: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  chipTxtActive: { color: colors.green },

  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  importingTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  doneTxt: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  doneDetail: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  doneBtn: { backgroundColor: colors.card, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: colors.cardBorder },
  doneBtnTxt: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
