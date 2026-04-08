import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBills } from '../hooks/useBills';
import { useSettings } from '../hooks/useSettings';

function BillsSummary() {
  const { t } = useTranslation();
  const { getUpcomingBills, loading, error } = useBills();
  const { settings } = useSettings();
  const upcomingBills = useMemo(() => getUpcomingBills(7), [getUpcomingBills]);

  // Determine currency symbol based on settings
  const currencySymbol = settings?.currency === 'USD' ? '$' :
                         settings?.currency === 'EUR' ? '€' :
                         settings?.currency === 'GBP' ? '£' :
                         settings?.currency === 'JPY' ? '¥' :
                         settings?.currency === 'AUD' ? 'A$' :
                         settings?.currency === 'CAD' ? 'C$' : '₹';

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
          <span className="text-sm text-gray-600">{t('billsSummary.loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl shadow-sm p-6 border border-red-200">
        <p className="text-red-700 text-sm">{t('billsSummary.errorLoading')}</p>
      </div>
    );
  }

  if (upcomingBills.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {t('billsSummary.upcomingBills')}
        </h3>
        <p className="text-gray-500 text-sm">{t('billsSummary.noBillsDue')}</p>
      </div>
    );
  }

  const totalDue = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {t('billsSummary.upcomingBills')}
        </h3>
        <span className="text-sm font-medium text-amber-600">
          {currencySymbol}{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="space-y-3">
        {upcomingBills.map((bill) => {
          const dueDate = new Date(bill.nextDueDate);
          const today = new Date();
          const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
          const isOverdue = daysLeft < 0;
          const isUrgent = daysLeft <= 2;

          return (
            <div
              key={bill.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-200' : isUrgent ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-gray-900 ${isOverdue ? 'text-red-700' : ''}`}>
                    {bill.name}
                  </span>
                  {isOverdue && (
                    <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{t('billsSummary.overdue')}</span>
                  )}
                  {isUrgent && !isOverdue && (
                    <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">{t('billsSummary.dueSoon')}</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {bill.frequency} • {bill.category}
                </div>
              </div>

              <div className="text-right">
                <div className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {currencySymbol}{Number(bill.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                  {t(isOverdue ? 'billsSummary.daysOverdue' : 'billsSummary.daysLeft', { count: isOverdue ? Math.abs(daysLeft) : daysLeft })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {t('billsSummary.showingBills', { count: upcomingBills.length })}
        </p>
      </div>
    </div>
  );
}

export default memo(BillsSummary);
