import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../components/Toast';
import { useConfirm } from '../hooks/useConfirm';

export default function BudgetSettingsModal({ isOpen, onClose }) {
  const { settings, updateSetting } = useSettings();
  const toast = useToast();
  const { confirm, Modal: ConfirmModal } = useConfirm();

  const [monthlyBudget, setMonthlyBudget] = useState(settings.monthlyBudget || 0);
  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMonthlyBudget(settings.monthlyBudget || 0);
      setCategoryBudgets(settings.categoryBudgets || {});
      setNewCategoryName('');
    }
  }, [isOpen, settings.monthlyBudget, settings.categoryBudgets]);

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categoryBudgets[trimmed]) {
      toast.addToast('Category already exists', 'error');
      setNewCategoryName('');
      return;
    }
    setCategoryBudgets(prev => ({
      ...prev,
      [trimmed]: 0
    }));
    setNewCategoryName('');
  };

  const handleRemoveCategory = (category) => {
    setCategoryBudgets(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const handleCategoryBudgetChange = (category, value) => {
    const numValue = parseFloat(value) || 0;
    setCategoryBudgets(prev => ({
      ...prev,
      [category]: numValue
    }));
  };

  const handleSave = async () => {
    // Validate
    if (monthlyBudget < 0) {
      toast.addToast('Monthly budget must be non-negative', 'error');
      return;
    }
    for (const [cat, amount] of Object.entries(categoryBudgets)) {
      if (amount < 0) {
        toast.addToast(`Budget for ${cat} must be non-negative`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      // Save both monthlyBudget and categoryBudgets
      await updateSetting('monthlyBudget', monthlyBudget);
      await updateSetting('categoryBudgets', categoryBudgets);
      toast.addToast('Budget settings saved!', 'success');
      onClose();
    } catch (err) {
      toast.addToast('Failed to save: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: 'Reset Budgets',
      message: 'Clear all budget settings?',
      confirmLabel: 'Clear',
      cancelLabel: 'Cancel',
      variant: 'warning'
    });
    if (!confirmed) return;

    setMonthlyBudget(0);
    setCategoryBudgets({});
    await updateSetting('monthlyBudget', 0);
    await updateSetting('categoryBudgets', {});
    toast.addToast('Budgets cleared', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Budget Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-2xl"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="space-y-6">
          {/* Monthly Total Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Total Monthly Budget
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-slate-400">
                {settings.currency === 'INR' ? '₹' : settings.currency === 'USD' ? '$' : settings.currency === 'EUR' ? '€' : settings.currency}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="e.g., 50000"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Set your total spending limit for the month
            </p>
          </div>

          {/* Category Budgets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Category Budgets
              </label>
            </div>

            {/* Add Category Form */}
            <div className="flex items-center gap-2 mb-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                className="flex-1 px-3 py-2 border border-emerald-200 dark:border-emerald-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                placeholder="Enter new category name..."
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
              >
                Add
              </button>
            </div>

            {Object.keys(categoryBudgets).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
                No category budgets set. Add categories above to allocate specific budgets.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Object.entries(categoryBudgets).map(([category, amount]) => (
                  <div key={category} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => {
                          const newCat = e.target.value.trim();
                          if (!newCat) return;
                          const next = { ...categoryBudgets };
                          delete next[category];
                          next[newCat] = amount;
                          setCategoryBudgets(next);
                        }}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        placeholder="Category"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-slate-400 text-sm">
                        {settings.currency === 'INR' ? '₹' : settings.currency === 'USD' ? '$' : settings.currency === 'EUR' ? '€' : settings.currency}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => handleCategoryBudgetChange(category, e.target.value)}
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveCategory(category)}
                      className="text-red-500 hover:text-red-600 dark:hover:text-red-400 p-1 transition"
                      title="Remove category"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Set spending limits for individual categories. Leave as 0 for no limit.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-slate-700 mt-6">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition disabled:opacity-50"
            disabled={saving}
          >
            Clear All
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Budgets'}
            </button>
          </div>
        </div>
      </div>
      <ConfirmModal />
    </div>
  );
}
