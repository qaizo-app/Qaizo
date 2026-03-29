// src/components/ImportModal.js
// Modal for importing transactions from CSV/Excel files with column mapping
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import importService from '../services/importService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';
import SwipeModal from './SwipeModal';

const FIELDS = ['date', 'amount', 'type', 'category', 'payee', 'note'];
const FIELD_ICONS = { date: 'calendar', amount: 'dollar-sign', type: 'tag', category: 'grid', payee: 'user', note: 'file-text' };

export default function ImportModal({ visible, onClose, onImported }) {
  const [step, setStep] = useState('pick'); // pick, mapping, preview, importing, done
  const [parseResult, setParseResult] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const handleImport = async () => {
    if (!parseResult) return;
    setStep('importing');
    const result = await importService.importTransactions(parseResult.transactions);
    setImportResult(result);
    setStep('done');
    onImported?.();
  };

  const handleClose = () => {
    setStep('pick');
    setParseResult(null);
    setMapping({});
    setImportResult(null);
    setError('');
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
                  <Text style={[st.summaryVal, { color: colors.green }]}>+{totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                </View>
                <View style={st.summaryItem}>
                  <Text style={st.summaryLabel}>{i18n.t('expenses')}</Text>
                  <Text style={[st.summaryVal, { color: colors.red }]}>-{totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                </View>
              </View>

              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                {parseResult.transactions.slice(0, 10).map((tx, idx) => (
                  <View key={idx} style={st.previewRow}>
                    <Text style={st.previewDate}>{tx.date.slice(0, 10)}</Text>
                    <Text style={st.previewName} numberOfLines={1}>{tx.recipient || i18n.t(tx.categoryId)}</Text>
                    <Text style={[st.previewAmt, { color: tx.type === 'income' ? colors.green : colors.red }]}>
                      {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}
                    </Text>
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
                <TouchableOpacity style={st.importBtn} onPress={handleImport}>
                  <Feather name="download" size={18} color="#fff" />
                  <Text style={st.importTxt}>{i18n.t('importConfirm')} ({parseResult.transactions.length})</Text>
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
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 20, textAlign: i18n.textAlign() },

  errorBox: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.redSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorTxt: { color: colors.red, fontSize: 13, fontWeight: '600', flex: 1 },
  pickBtn: { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: colors.cardBorder, borderStyle: 'dashed', marginBottom: 20, gap: 8 },
  pickTxt: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pickSub: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

  formatInfo: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 8 },
  formatTitle: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textAlign: i18n.textAlign() },
  formatRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  formatTxt: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },

  fileInfo: { flexDirection: i18n.row(), alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  fileMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  remapBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },

  // Mapping
  mapTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textAlign: i18n.textAlign() },
  mapRow: { marginBottom: 10 },
  mapField: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 6 },
  mapFieldTxt: { color: colors.text, fontSize: 13, fontWeight: '600' },
  mapChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginEnd: 6, minWidth: 40, alignItems: 'center' },
  mapChipActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  mapChipSkip: { borderColor: colors.textMuted, backgroundColor: colors.bg2 },
  mapChipTxt: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  mapSample: { color: colors.textMuted, fontSize: 9, marginTop: 2 },

  summaryRow: { flexDirection: i18n.row(), gap: 12, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  summaryVal: { fontSize: 16, fontWeight: '800' },

  previewRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 8 },
  previewDate: { color: colors.textMuted, fontSize: 11, fontWeight: '600', width: 70 },
  previewName: { flex: 1, color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  previewAmt: { fontSize: 13, fontWeight: '700' },
  moreTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '500', textAlign: 'center', paddingVertical: 8 },

  btnRow: { flexDirection: i18n.row(), gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  importBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 8 },
  importTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  importingTxt: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  doneTxt: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  doneDetail: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  doneBtn: { backgroundColor: colors.card, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: colors.cardBorder },
  doneBtnTxt: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
