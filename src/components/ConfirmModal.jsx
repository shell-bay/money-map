import { useEffect, useCallback } from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger' }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter') onConfirm();
  }, [onClose, onConfirm]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const confirmColors = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    primary: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
  };

  const cancelColors = 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-slide-in">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition focus:outline-none focus:ring-2 ${cancelColors}`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition focus:outline-none focus:ring-2 ${confirmColors[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
