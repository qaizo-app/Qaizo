// src/components/ToastProvider.js
// Глобальный провайдер тостов — useToast() из любого экрана
import { createContext, useCallback, useContext, useState } from 'react';
import Toast from './Toast';

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const show = useCallback((message, type = 'success', duration = 2500) => {
    setToast({ visible: true, message, type, duration });
  }, []);

  const hide = useCallback(() => {
    setToast(t => ({ ...t, visible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} duration={toast.duration} onHide={hide} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
