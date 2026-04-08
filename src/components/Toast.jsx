import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onClose }) {
  const { message, type, duration } = toast;
  const { t } = useTranslation();

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  }[type] || 'bg-gray-500';

  const icon = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
    warning: '⚠'
  }[type] || '•';

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 pointer-events-auto transition-all duration-300 transform animate-slide-in`}
      role="alert"
      aria-live="polite"
    >
      <span className="font-bold text-lg">{icon}</span>
      <p className="flex-1 text-sm">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 text-white hover:text-gray-200 font-bold text-lg leading-none"
        aria-label={t('common.close')}
      >
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
