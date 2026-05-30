// src/components/StatementScannerModal.js
// Multi-step modal: pick image(s) → analyzing → review (3 sections) → saving.
// Account is implicit (passed via props from AccountHistoryScreen).
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import { catColor, catName } from '../utils/categoryName';
import { sym } from '../utils/currency';
import { reconcile } from '../utils/statementReconcile';
import { categorize } from '../utils/statementCategorize';
import AddTransactionModal from './AddTransactionModal';
import Amount from './Amount';
import CategoryPickerModal, { CatIcon, DEFAULT_GROUPS, getCatIcon } from './CategoryPickerModal';
import RowText from './RowText';
import StatementReviewSection from './StatementReviewSection';
import StatementSimilarCard from './StatementSimilarCard';
import SwipeModal from './SwipeModal';

export default function StatementScannerModal({ visible, onClose, accountId, accountCurrency, onSaved }) {
  const [step, setStep] = useState('pick');           // 'pick' | 'analyzing' | 'review' | 'saving' | 'done'
  const [images, setImages] = useState([]);            // [{ uri, base64 }]
  const [results, setResults] = useState([]);          // ReconcileResult[]
  const [catGuess, setCatGuess] = useState({});        // id → CategoryGuess (for 'new' results)
  const [rowState, setRowState] = useState({});        // id → { checked, decision, categoryId, date, amount, editorSaved }
  const [error, setError] = useState('');
  const [editCatIdx, setEditCatIdx] = useState(null);  // index of result whose category is being edited
  const [editorIdx, setEditorIdx] = useState(null);    // index of result open in the full AddTransactionModal
  const [progress, setProgress] = useState({ current: 0, total: 0 }); // bulk-save progress
  const [summary, setSummary] = useState({ added: 0, failed: 0, editorAdded: 0 }); // shown on 'done' screen
  const [catGroups, setCatGroups] = useState(DEFAULT_GROUPS);                       // built-in + user's custom categories — needed to render the right icon/colour for custom-category chips on rows

  const st = createSt();

  // Reset on each open
  useEffect(() => {
    if (visible) {
      setStep('pick');
      setImages([]);
      setResults([]);
      setCatGuess({});
      setRowState({});
      setError('');
      // Refresh categories every open — the user might have added a custom
      // category since the last scan.
      dataService.getCategories().then(saved => { if (saved && saved.length > 0) setCatGroups(saved); }).catch(() => {});
    }
  }, [visible]);

  const pickImage = async (useCamera) => {
    try {
      const options = { base64: true, quality: 0.85, allowsEditing: false, exif: false };
      const res = useCamera
        ? await (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { setError(i18n.t('cameraPermission')); return null; }
            return ImagePicker.launchCameraAsync(options);
          })()
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!res || res.canceled || !res.assets?.[0]?.base64) return;
      setImages(prev => [...prev, { uri: res.assets[0].uri, base64: res.assets[0].base64 }]);
      setError('');
    } catch (e) {
      if (__DEV__) console.error('statement pickImage:', e);
      setError(i18n.t('scanFailed'));
    }
  };

  const analyze = async () => {
    if (images.length === 0) return;
    setStep('analyzing');
    setError('');
    try {
      const base64List = images.map(i => i.base64);
      const extracted = await aiService.scanStatement(base64List, accountCurrency);
      if (!extracted || extracted.length === 0) {
        setError(i18n.t('statementNoneFound'));
        setStep('pick');
        return;
      }

      // Existing-tx window must cover the statement period. Credit-card
      // billing cycles often surface transactions 60-90 days old, so 60 days
      // is too tight — matched-but-out-of-window rows end up labelled "New"
      // by mistake. 180 days = 6 months is the safe default.
      const cutoffExist = new Date(); cutoffExist.setDate(cutoffExist.getDate() - 180);
      const cutoffHist  = new Date(); cutoffHist.setMonth(cutoffHist.getMonth() - 6);
      const [allTx, allRec] = await Promise.all([dataService.getTransactions(), dataService.getRecurring()]);
      const existing = allTx.filter(t => t.account === accountId && (t.date || '').slice(0, 10) >= cutoffExist.toISOString().slice(0, 10));
      const recurring = allRec.filter(r => r.account === accountId && r.isActive);
      const history = allTx.filter(t => (t.date || '').slice(0, 10) >= cutoffHist.toISOString().slice(0, 10));

      const reconciled = reconcile(extracted, existing, recurring);

      // For 'new' kind — guess a category up-front so the user can review it
      const guesses = {};
      const initial = {};
      reconciled.forEach((r, i) => {
        if (r.kind === 'new') {
          const g = categorize(r.extracted.payee, history, allRec);
          guesses[i] = g;
          initial[i] = {
            checked: r.extracted.confidence !== 'low',
            categoryId: g.categoryId,
            date: r.extracted.date,
            amount: r.extracted.amount,
          };
        } else if (r.kind === 'similar') {
          initial[i] = { decision: null }; // user must choose: 'same' | 'new'
        } else if (r.kind === 'recurring') {
          initial[i] = { checked: true, decision: null }; // 'confirm' | 'separate'
        }
        // 'exact' rows have no checkbox state — they appear collapsed in the Already section.
      });
      setCatGuess(guesses);
      setRowState(initial);
      setResults(reconciled);
      setStep('review');
    } catch (e) {
      if (__DEV__) console.error('statement analyze:', e);
      setError(i18n.t('statementParseFailed'));
      setStep('pick');
    }
  };

  const toggleRow = (i) => setRowState(s => ({ ...s, [i]: { ...s[i], checked: !s[i]?.checked } }));
  const setRowField = (i, field, value) => setRowState(s => ({ ...s, [i]: { ...s[i], [field]: value } }));

  const setSimilarDecision = (i, decision) => setRowState(s => ({ ...s, [i]: { ...s[i], decision, checked: decision === 'new' } }));
  const setRecurringDecision = (i, decision) => setRowState(s => ({ ...s, [i]: { ...s[i], decision, checked: true } }));

  // Counter — how many will actually be added when "Save" is pressed
  const saveCount = useMemo(() => {
    let n = 0;
    results.forEach((r, i) => {
      const s = rowState[i] || {};
      if (s.editorSaved) return;                                 // already saved through the editor
      if (r.kind === 'new' && s.checked) n++;
      if (r.kind === 'similar' && s.decision === 'new') n++;
      if (r.kind === 'recurring' && s.decision != null) n++;     // either confirm or separate counts
    });
    return n;
  }, [results, rowState]);

  const save = async () => {
    // Pre-count the rows we will actually save so the progress bar is honest
    let total = 0, editorAdded = 0;
    results.forEach((r, i) => {
      const s = rowState[i] || {};
      if (s.editorSaved) { editorAdded++; return; }
      if (r.kind === 'new' && s.checked) total++;
      else if (r.kind === 'similar' && s.decision === 'new') total++;
      else if (r.kind === 'recurring' && s.decision != null) total++;
    });

    // Nothing left to save in this loop — go straight to the summary (the
    // editor-saved rows are already in Firestore, so this still counts as a
    // successful import).
    if (total === 0) {
      const result = { added: editorAdded, failed: 0, editorAdded };
      setSummary(result);
      setStep('done');
      onSaved && onSaved({ added: editorAdded, failed: 0 });
      return;
    }

    setProgress({ current: 0, total });
    setStep('saving');
    let ok = 0, fail = 0;
    // dataService.addTransaction swallows Firestore errors and returns null.
    // Without this check we'd happily increment ok++ on a row that never
    // landed (e.g. icon: undefined → invalid-argument rejected). The counter
    // and the done-summary need to reflect actual writes, otherwise the user
    // sees "Added 12" but their account shows nothing — exactly the bug they
    // hit on the credit-card scan.
    // Truthy = success: addTransaction returns the new doc (object) on success
    // and null on Firestore reject; confirmRecurring returns true/false. Both
    // collapse cleanly under a plain truthy check.
    const errors = [];                                          // [{ payee, reason }] surfaced on the done screen
    const recordWrite = (res, label) => {
      if (res) ok++;
      else { fail++; errors.push({ payee: label, reason: 'returned falsy' }); if (__DEV__) console.warn('statement save: row returned', res, 'for', label); }
    };
    // Hard timeout per row so a single hanging Firestore call cannot freeze
    // the whole import at "0 of N" — exactly what users hit on credit-card
    // statements. Anything that does not resolve within 12s is treated as a
    // failure and we move on.
    const withTimeout = (p, label) => Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout-12s:' + label)), 12000)),
    ]);
    // Strip undefined values so Firestore does not reject the write whole —
    // RN Firebase throws "Unsupported field value: undefined" otherwise.
    const clean = (obj) => {
      const out = {};
      for (const k of Object.keys(obj)) { if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k]; }
      return out;
    };
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const s = rowState[i] || {};
      if (s.editorSaved) continue;                              // already saved through the editor
      const label = r.extracted?.payee || `row ${i}`;
      try {
        if (r.kind === 'new' && s.checked) {
          const cfg = getCatIcon(s.categoryId, catGroups);   // works for both built-in and custom categories
          const isCharge = r.extracted.amount < 0;
          const amt = Number(s.amount ?? r.extracted.amount);
          if (!Number.isFinite(amt)) throw new Error('invalid-amount');
          const payload = clean({
            type: isCharge ? 'expense' : 'income',
            amount: Math.abs(amt),
            categoryId: s.categoryId || 'other',
            categoryName: catName(s.categoryId || 'other'),
            icon: cfg.icon || 'circle',
            recipient: r.extracted.payee || '',
            note: r.extracted.notes || '',
            currency: accountCurrency || sym(),
            date: new Date(s.date || r.extracted.date).toISOString(),
            account: accountId,
            tags: [],
          });
          if (__DEV__) console.log('[statement save] adding', payload);
          const res = await withTimeout(dataService.addTransaction(payload), label);
          recordWrite(res, label);
        } else if (r.kind === 'similar' && s.decision === 'new') {
          // No category guess for similar matches; fall back to 'other'
          const amt = Number(r.extracted.amount);
          if (!Number.isFinite(amt)) throw new Error('invalid-amount');
          const payload = clean({
            type: amt < 0 ? 'expense' : 'income',
            amount: Math.abs(amt),
            categoryId: 'other',
            recipient: r.extracted.payee || '',
            note: r.extracted.notes || '',
            currency: accountCurrency || sym(),
            date: new Date(r.extracted.date).toISOString(),
            account: accountId,
            tags: [],
          });
          if (__DEV__) console.log('[statement save] adding (similar→new)', payload);
          const res = await withTimeout(dataService.addTransaction(payload), label);
          recordWrite(res, label);
        } else if (r.kind === 'recurring' && s.decision === 'confirm') {
          const res = await withTimeout(dataService.confirmRecurring(r.recurring.id, {
            amount: Math.abs(Number(r.extracted.amount) || 0),
            date: new Date(r.extracted.date).toISOString(),
          }), label);
          recordWrite(res, label);
        } else if (r.kind === 'recurring' && s.decision === 'separate') {
          const amt = Number(r.extracted.amount);
          if (!Number.isFinite(amt)) throw new Error('invalid-amount');
          const payload = clean({
            type: amt < 0 ? 'expense' : 'income',
            amount: Math.abs(amt),
            categoryId: 'other',
            recipient: r.extracted.payee || '',
            note: r.extracted.notes || '',
            currency: accountCurrency || sym(),
            date: new Date(r.extracted.date).toISOString(),
            account: accountId,
            tags: [],
          });
          if (__DEV__) console.log('[statement save] adding (recurring→separate)', payload);
          const res = await withTimeout(dataService.addTransaction(payload), label);
          recordWrite(res, label);
        }
      } catch (e) {
        if (__DEV__) console.error('[statement save] row failed:', label, e);
        fail++;
        errors.push({ payee: label, reason: e?.message || String(e) });
      }
      setProgress(p => ({ ...p, current: p.current + 1 }));
    }
    // Show a real summary instead of silently closing — gives the user
    // confidence that work actually landed (and which rows failed).
    const result = { added: ok + editorAdded, failed: fail, editorAdded, errors };
    setSummary(result);
    setStep('done');
    onSaved && onSaved({ added: ok + editorAdded, failed: fail });
  };

  // ---------------------------------------------------------------- Render
  return (
    <>
    <SwipeModal visible={visible} onClose={onClose}>
      {({ close }) => (
        <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={st.title}>{i18n.t('importStatementTitle')}</Text>

          {error ? (
            <View style={st.errCard}>
              <Feather name="alert-circle" size={16} color={colors.red} />
              <RowText style={st.errTxt}>{error}</RowText>
            </View>
          ) : null}

          {/* PICK */}
          {step === 'pick' && (
            <View>
              {images.length > 0 && (
                <View style={st.thumbRow}>
                  {images.map((img, i) => (
                    <View key={i} style={st.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={st.thumb} resizeMode="cover" />
                      <TouchableOpacity style={st.thumbX} onPress={() => setImages(p => p.filter((_, j) => j !== i))}>
                        <Feather name="x" size={12} color={colors.bg} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={st.pickRow}>
                <TouchableOpacity style={st.pickBtn} onPress={() => pickImage(true)} activeOpacity={0.7}>
                  <Feather name="camera" size={24} color={colors.green} />
                  <Text style={st.pickBtnTxt}>{i18n.t('takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.pickBtn} onPress={() => pickImage(false)} activeOpacity={0.7}>
                  <Feather name="image" size={24} color={colors.blue} />
                  <Text style={st.pickBtnTxt}>{i18n.t('fromGallery')}</Text>
                </TouchableOpacity>
              </View>
              {images.length > 0 && (
                <TouchableOpacity style={st.actionBtn} onPress={analyze} activeOpacity={0.7}>
                  <Feather name="search" size={16} color={colors.bg} />
                  <Text style={st.actionBtnTxt}>{i18n.t('scanReceiptAction')} ({images.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ANALYZING */}
          {step === 'analyzing' && (
            <View style={st.center}>
              <ActivityIndicator size="large" color={colors.green} />
              <Text style={st.centerTxt}>{i18n.t('analyzingStatement')}</Text>
            </View>
          )}

          {/* REVIEW */}
          {step === 'review' && (() => {
            const news     = results.map((r, i) => ({ r, i })).filter(x => x.r.kind === 'new');
            const similars = results.map((r, i) => ({ r, i })).filter(x => x.r.kind === 'similar' || x.r.kind === 'recurring');
            const exacts   = results.map((r, i) => ({ r, i })).filter(x => x.r.kind === 'exact');

            return (
              <View>
                <StatementReviewSection
                  title={i18n.t('statementSectionNew')}
                  count={news.length}
                  accent={colors.green}
                  defaultOpen={true}
                >
                  {news.map(({ r, i }) => {
                    const s = rowState[i] || {};
                    if (s.editorSaved) return (
                      <View key={i} style={st.doneRow}><Feather name="check-circle" size={14} color={colors.green} /><Text style={st.doneTxt}>{r.extracted.payee}</Text></View>
                    );
                    const cat = s.categoryId || 'other';
                    const c = getCatIcon(cat, catGroups);     // handles custom categories (icon + colour from user-defined groups)
                    const guessSource = catGuess[i]?.source;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={st.newRow}
                        onPress={() => toggleRow(i)}
                        onLongPress={() => setEditorIdx(i)}        // long-press → open full editor (lets user change type to 'transfer' etc.)
                        delayLongPress={350}
                        activeOpacity={0.7}
                      >
                        <Feather name={s.checked ? 'check-square' : 'square'} size={18} color={s.checked ? colors.green : colors.textMuted} />
                        <TouchableOpacity style={[st.catChip, { backgroundColor: (c.color || catColor(cat)) + '20' }]} onPress={() => setEditCatIdx(i)}>
                          <CatIcon icon={c.icon || 'tag'} size={12} color={c.color || catColor(cat)} />
                          <Text style={[st.catChipTxt, { color: c.color || catColor(cat) }]} numberOfLines={1}>{catName(cat)}</Text>
                        </TouchableOpacity>
                        <RowText style={st.newPayee} numberOfLines={1}>
                          {r.extracted.payee}
                          {guessSource && guessSource !== 'fallback' ? <Text style={st.srcHint}>  · {i18n.t('statementSource' + guessSource.charAt(0).toUpperCase() + guessSource.slice(1))}</Text> : null}
                        </RowText>
                        <Amount value={r.extracted.amount} sign style={st.newAmount} color={r.extracted.amount < 0 ? colors.red : colors.green} />
                        {/* Edit pencil → full editor (needed when the row is a transfer or wrong type). Long-press on the whole row works too, but the icon is the discoverable affordance. */}
                        <TouchableOpacity onPress={() => setEditorIdx(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="edit-2" size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </StatementReviewSection>

                <StatementReviewSection
                  title={i18n.t('statementSectionSimilar')}
                  count={similars.length}
                  accent={colors.yellow}
                  defaultOpen={true}
                >
                  {similars.map(({ r, i }) => {
                    const s = rowState[i] || {};
                    if (s.editorSaved) return (
                      <View key={i} style={st.doneRow}><Feather name="check-circle" size={14} color={colors.green} /><Text style={st.doneTxt}>{r.extracted.payee}</Text></View>
                    );
                    if (r.kind === 'recurring') {
                      return (
                        <StatementSimilarCard
                          key={i}
                          extracted={r.extracted}
                          candidate={r.recurring}
                          isRecurring
                          onSame={() => setEditorIdx(i)}                        // "Separate" — open editor so user can adjust before adding
                          onNew={() => setRecurringDecision(i, 'confirm')}      // "Confirm" — direct confirmRecurring (uses extracted amount/date as override)
                        />
                      );
                    }
                    // 'similar'
                    const candidate = r.candidates[0]; // show first candidate; if multiple, future polish can iterate
                    return (
                      <StatementSimilarCard
                        key={i}
                        extracted={r.extracted}
                        candidate={candidate}
                        isRecurring={false}
                        onSame={() => setSimilarDecision(i, 'same')}             // "Skip" — direct skip
                        onNew={() => setEditorIdx(i)}                            // "Add" — open editor so user can adjust (incl. type=transfer) before adding
                      />
                    );
                  })}
                </StatementReviewSection>

                <StatementReviewSection
                  title={i18n.t('statementSectionAlreadyIn')}
                  count={exacts.length}
                  accent={colors.textMuted}
                  defaultOpen={false}
                >
                  {exacts.map(({ r, i }) => (
                    <View key={i} style={st.exactRow}>
                      <Text style={st.exactDate}>{r.extracted.date}</Text>
                      <RowText style={st.exactPayee} numberOfLines={1}>{r.extracted.payee}</RowText>
                      <Amount value={r.extracted.amount} sign style={st.exactAmount} />
                    </View>
                  ))}
                </StatementReviewSection>
              </View>
            );
          })()}

          {step === 'saving' && (
            <View style={st.center}>
              <ActivityIndicator size="large" color={colors.green} />
              <Text style={st.centerTxt}>
                {i18n.t('statementSavingProgress')
                  .replace('{current}', String(progress.current))
                  .replace('{total}', String(progress.total))}
              </Text>
            </View>
          )}

          {step === 'done' && (
            <View style={st.center}>
              <Feather name="check-circle" size={48} color={summary.added > 0 ? colors.green : colors.red} />
              <Text style={st.doneTitle}>{i18n.t('statementDoneTitle')}</Text>
              <Text style={st.doneSummary}>
                {i18n.t('statementDoneAdded').replace('{count}', String(summary.added))}
              </Text>
              {summary.failed > 0 && (
                <>
                  <Text style={st.doneFail}>
                    {i18n.t('statementDoneFailed').replace('{count}', String(summary.failed))}
                  </Text>
                  {(summary.errors || []).slice(0, 5).map((er, idx) => (
                    <Text key={idx} style={st.doneErrLine}>· {er.payee} — {er.reason}</Text>
                  ))}
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer Save button (only in review) */}
        {step === 'review' && (() => {
          const editorAdded = Object.values(rowState).filter(s => s?.editorSaved).length;
          const totalToSave = saveCount + editorAdded;          // editor-saved rows count toward the "Save N" total
          return (
            <View style={st.footer}>
              <TouchableOpacity
                style={[st.actionBtn, totalToSave === 0 && { opacity: 0.4 }]}
                onPress={save}
                disabled={totalToSave === 0}
                activeOpacity={0.7}
              >
                <Feather name="check" size={16} color={colors.bg} />
                <Text style={st.actionBtnTxt}>{i18n.t('statementSaveBtn').replace('{count}', String(totalToSave))}</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Footer Close button (only on done summary) */}
        {step === 'done' && (
          <View style={st.footer}>
            <TouchableOpacity style={st.actionBtn} onPress={() => onClose && onClose()} activeOpacity={0.7}>
              <Feather name="check" size={16} color={colors.bg} />
              <Text style={st.actionBtnTxt}>{i18n.t('statementDoneClose')}</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      )}
    </SwipeModal>

    {/* Category picker for editing a "new" row's category */}
    <CategoryPickerModal
      visible={editCatIdx != null}
      onClose={() => setEditCatIdx(null)}
      type={results[editCatIdx]?.extracted.amount < 0 ? 'expense' : 'income'}
      onSelect={(id) => { setRowField(editCatIdx, 'categoryId', id); setEditCatIdx(null); }}
    />

    {/* Full transaction editor — opened from a doubtful row so the user can change ANY field, including type=transfer */}
    {editorIdx != null && results[editorIdx] && (() => {
      const ex = results[editorIdx].extracted;
      const guess = catGuess[editorIdx];
      const prefill = {
        amount: String(Math.abs(ex.amount || 0)),
        recipient: ex.payee || '',
        date: ex.date,
        type: (ex.amount || 0) < 0 ? 'expense' : 'income',
        note: ex.notes || '',
        categoryId: guess?.categoryId,
        showMore: true,
      };
      return (
        <AddTransactionModal
          visible={true}
          onClose={() => setEditorIdx(null)}
          onSave={() => {
            const idx = editorIdx;
            setRowState(s => ({ ...s, [idx]: { ...(s[idx] || {}), editorSaved: true, checked: false, decision: null } }));
            setEditorIdx(null);
          }}
          preselectedAccount={accountId}
          prefill={prefill}
        />
      );
    })()}
    </>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: i18n.textAlign() },
  errCard: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.redSoft, borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: colors.red + '30' },
  errTxt: { color: colors.red, fontSize: 12, fontWeight: '600' },
  pickRow: { flexDirection: i18n.row(), gap: 12, marginBottom: 14 },
  pickBtn: { flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 14, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder, gap: 8 },
  pickBtnTxt: { color: colors.text, fontSize: 13, fontWeight: '600' },
  thumbRow: { flexDirection: i18n.row(), gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 70, height: 90, borderRadius: 10, backgroundColor: colors.bg2 },
  thumbX: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center' },
  actionBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  actionBtnTxt: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  centerTxt: { color: colors.textDim, fontSize: 13 },
  newRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
  catChip: { flexDirection: i18n.row(), alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: 110 },
  catChipTxt: { fontSize: 11, fontWeight: '700' },
  newPayee: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: i18n.textAlign() },
  srcHint: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  newAmount: { fontSize: 13, fontWeight: '700' },
  exactRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4, opacity: 0.6 },
  exactDate: { color: colors.textMuted, fontSize: 11, minWidth: 64 },
  exactPayee: { color: colors.textDim, fontSize: 12, textAlign: i18n.textAlign() },
  exactAmount: { fontSize: 12, color: colors.textDim },
  doneRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, opacity: 0.7 },
  doneTxt: { color: colors.green, fontSize: 13, fontWeight: '600', textAlign: i18n.textAlign() },
  doneTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  doneSummary: { color: colors.textDim, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  doneFail: { color: colors.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  doneErrLine: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
  footer: { paddingVertical: 12 },
});
