// src/components/currentAccount.js
// Tiny pub-sub for the "currently-focused account" — lets AppNavigator's
// global "+" know which account the user is inside, so the AddTransactionModal
// can pre-select it. AccountHistoryScreen sets it on focus and clears on blur.
//
// Plain module-level state (with subscribers) instead of React Context to avoid
// splitting AppNavigator just to read a context.
import { useEffect, useState } from 'react';

let _accountId = null;
const _subs = new Set();

export function setCurrentAccountId(id) {
  _accountId = id || null;
  _subs.forEach(fn => fn(_accountId));
}

export function getCurrentAccountId() {
  return _accountId;
}

export function useCurrentAccountId() {
  const [v, setV] = useState(_accountId);
  useEffect(() => {
    _subs.add(setV);
    return () => { _subs.delete(setV); };
  }, []);
  return v;
}
