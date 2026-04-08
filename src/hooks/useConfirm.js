import { useState, useCallback, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';

export function useConfirm() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'danger'
  });
  const resolveRef = useRef(null);
  const isOpenRef = useRef(false);

  const confirm = useCallback((options) => {
    if (isOpenRef.current) {
      // Another confirm dialog is already open
      return Promise.resolve(false);
    }
    isOpenRef.current = true;
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen: true,
        title: options.title || 'Confirm',
        message: options.message || 'Are you sure?',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || 'danger'
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    isOpenRef.current = false;
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  }, []);

  const handleConfirm = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    isOpenRef.current = false;
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  }, []);

  const Modal = useCallback(() => (
    <ConfirmModal
      isOpen={state.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
    />
  ), [state.isOpen, state.title, state.message, state.confirmLabel, state.cancelLabel, state.variant, handleClose, handleConfirm]);

  return { confirm, Modal };
}
