import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBills } from '../hooks/useBills';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../components/Toast';
import { BILL_FREQUENCIES, DEFAULT_REMINDER_DAYS } from '../models/financeModels';
import { useConfirm } from '../hooks/useConfirm';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

export default function BillModal({ isOpen, onClose, billId = null }) {
  const { t } = useTranslation();
  const { addBill, updateBill, bills } = useBills();
  const { settings } = useSettings();
  const toast = useToast();
  const { confirm, Modal: ConfirmModal } = useConfirm();

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: '',
    frequency: BILL_FREQUENCIES.MONTHLY,
    nextDueDate: new Date().toISOString().split('T')[0],
    reminderDays: DEFAULT_REMINDER_DAYS,
    isActive: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing bill data if editing
  useEffect(() => {
    if (isOpen && billId) {
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        setFormData({
          name: bill.name || '',
          amount: bill.amount?.toString() || '',
          category: bill.category || '',
          frequency: bill.frequency || BILL_FREQUENCIES.MONTHLY,
          nextDueDate: bill.nextDueDate || new Date().toISOString().split('T')[0],
          reminderDays: bill.reminderDays ?? DEFAULT_REMINDER_DAYS,
          isActive: bill.isActive !== false
        });
      }
    } else if (isOpen && !billId) {
      // Reset to defaults for new bill
      setFormData({
        name: '',
        amount: '',
        category: '',
        frequency: BILL_FREQUENCIES.MONTHLY,
        nextDueDate: new Date().toISOString().split('T')[0],
        reminderDays: DEFAULT_REMINDER_DAYS,
        isActive: true
      });
    }
  }, [isOpen, billId, bills]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError(t('billModal.errorNameRequired'));
      return;
    }
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(t('billModal.errorAmountPositive'));
      return;
    }
    if (!formData.category.trim()) {
      setError(t('billModal.errorCategoryRequired'));
      return;
    }
    if (!Object.values(BILL_FREQUENCIES).includes(formData.frequency)) {
      setError(t('billModal.errorInvalidFrequency'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.nextDueDate)) {
      setError(t('billModal.errorInvalidDate'));
      return;
    }

    setSaving(true);
    try {
      const billData = {
        ...formData,
        amount: amountNum
      };

      if (billId) {
        await updateBill(billId, billData);
        toast.addToast(t('billModal.billUpdated'), 'success');
      } else {
        await addBill(billData);
        toast.addToast(t('billModal.billAdded'), 'success');
      }
      onClose();
    } catch (err) {
      setError(err.message);
      toast.addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!billId) return;
    const confirmed = await confirm({
      title: t('confirm.deleteBill.title'),
      message: t('confirm.deleteBill.message', { name: formData.name }),
      confirmLabel: t('confirm.deleteBill.confirmLabel'),
      cancelLabel: t('confirm.deleteBill.cancelLabel'),
      variant: 'danger'
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      await updateBill(billId, { isActive: false }); // Soft delete
      toast.addToast(t('billModal.billDeleted'), 'success');
      onClose();
    } catch (err) {
      toast.addToast(t('billModal.failedToDelete', { message: err.message }), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {billId ? t('billModal.editBill') : t('billModal.addBill')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label={t('common.close')}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('billModal.billName')}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder={t('billModal.placeholderBillName')}
            />
          </div>

          {/* Amount & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('billModal.amount')} ({CURRENCIES.find(c => c.code === settings.currency)?.symbol || settings.currency})
              </label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder={t('billModal.amountPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('billModal.category')}
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder={t('billModal.categoryPlaceholder')}
              />
            </div>
          </div>

          {/* Frequency & Next Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('billModal.frequency')}
              </label>
              <select
                name="frequency"
                value={formData.frequency}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {Object.entries(BILL_FREQUENCIES).map(([key, value]) => (
                  <option key={key} value={value}>
                    {key.charAt(0) + key.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('billModal.nextDueDate')}
              </label>
              <input
                type="date"
                name="nextDueDate"
                value={formData.nextDueDate}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Reminder Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('billModal.reminder')}
            </label>
            <input
              type="number"
              name="reminderDays"
              min="0"
              max="30"
              value={formData.reminderDays}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{t('billModal.active')}</p>
              <p className="text-sm text-gray-500">{t('billModal.activeDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-emerald-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-200">
            {billId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
              >
                {t('billModal.delete')}
              </button>
            )}
            <div className={`flex gap-3 ${billId ? '' : 'ml-auto'}`}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {saving ? t('common.saving') : (billId ? t('common.save') : t('billModal.addBill'))}
              </button>
            </div>
          </div>
        </form>

        <ConfirmModal />
      </div>
    </div>
  );
}
