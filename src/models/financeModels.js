/**
 * Finance Models and Schemas for Money Map
 * These constants define the structure of financial data entities
 */

// Bill frequencies
export const BILL_FREQUENCIES = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly'
};

// Default bill reminder days before due date
export const DEFAULT_REMINDER_DAYS = 3;

// Recurring Bill Schema
// Stored in: users/{userId}/bills/{billId}
export const BillSchema = {
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100
  },
  amount: {
    type: 'number',
    required: true,
    min: 0
  },
  category: {
    type: 'string',
    required: true
  },
  frequency: {
    type: 'string',
    required: true,
    enum: Object.values(BILL_FREQUENCIES)
  },
  nextDueDate: {
    type: 'string',
    required: true,
    pattern: '^\\d{4}-\\d{2}-\\d{2}$' // ISO date YYYY-MM-DD
  },
  reminderDays: {
    type: 'number',
    required: false,
    min: 0,
    max: 30,
    default: DEFAULT_REMINDER_DAYS
  },
  isActive: {
    type: 'boolean',
    required: false,
    default: true
  }
};

// Budget Settings Schema
// Stored in: users/{userId} document (merged with existing settings)
export const BudgetSchema = {
  monthlyBudget: {
    type: 'number',
    required: false,
    min: 0
  },
  categoryBudgets: {
    type: 'object',
    required: false,
    // Dynamic keys: { [categoryName]: number }
    // Each category budget must be >= 0
  }
};

// Notification Preferences Schema
// Added to user settings document
export const NotificationPreferencesSchema = {
  billReminders: {
    type: 'boolean',
    required: false,
    default: true
  },
  overspendingAlerts: {
    type: 'boolean',
    required: false,
    default: true
  },
  savingsMilestones: {
    type: 'boolean',
    required: false,
    default: true
  },
  weeklySummary: {
    type: 'boolean',
    required: false,
    default: false
  }
};

// Validation functions

/**
 * Validates a bill object against schema
 * @param {Object} bill - Bill data to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateBill(bill) {
  const errors = [];

  if (!bill.name || typeof bill.name !== 'string' || bill.name.trim().length === 0) {
    errors.push('Bill name is required');
  }

  if (bill.amount === undefined || isNaN(Number(bill.amount)) || Number(bill.amount) < 0) {
    errors.push('Valid amount is required');
  }

  if (!bill.category || typeof bill.category !== 'string') {
    errors.push('Category is required');
  }

  if (!BILL_FREQUENCIES[Object.values(BILL_FREQUENCIES).includes(bill.frequency) ? bill.frequency : null]) {
    errors.push(`Frequency must be one of: ${Object.values(BILL_FREQUENCIES).join(', ')}`);
  }

  if (!bill.nextDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(bill.nextDueDate)) {
    errors.push('Next due date must be in YYYY-MM-DD format');
  } else {
    // Check if date is valid
    const date = new Date(bill.nextDueDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid due date');
    }
  }

  if (bill.reminderDays !== undefined && (Number(bill.reminderDays) < 0 || Number(bill.reminderDays) > 30)) {
    errors.push('Reminder days must be between 0 and 30');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates budget settings
 * @param {Object} budgets - { monthlyBudget, categoryBudgets }
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateBudgets(budgets) {
  const errors = [];

  if (budgets.monthlyBudget !== undefined && (isNaN(Number(budgets.monthlyBudget)) || Number(budgets.monthlyBudget) < 0)) {
    errors.push('Monthly budget must be a positive number');
  }

  if (budgets.categoryBudgets) {
    Object.entries(budgets.categoryBudgets).forEach(([category, amount]) => {
      if (isNaN(Number(amount)) || Number(amount) < 0) {
        errors.push(`Category budget for "${category}" must be a positive number`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculates the next due date based on frequency and current date
 * @param {string} currentDate - ISO date string (YYYY-MM-DD)
 * @param {string} frequency - One of BILL_FREQUENCIES
 * @returns {string} - Next due date (YYYY-MM-DD)
 */
export function calculateNextDueDate(currentDate, frequency) {
  const date = new Date(currentDate);
  switch (frequency) {
    case BILL_FREQUENCIES.WEEKLY:
      date.setDate(date.getDate() + 7);
      break;
    case BILL_FREQUENCIES.MONTHLY:
      date.setMonth(date.getMonth() + 1);
      break;
    case BILL_FREQUENCIES.QUARTERLY:
      date.setMonth(date.getMonth() + 3);
      break;
    case BILL_FREQUENCIES.YEARLY:
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      // If frequency is not recognized, keep the same date
      // Validation should have caught this earlier
      break;
  }
  return date.toISOString().split('T')[0];
}

/**
 * Checks if a bill is due within the next N days
 * @param {string} dueDate - ISO date string
 * @param {number} daysThreshold - Number of days to check
 * @returns {boolean}
 */
export function isBillDueSoon(dueDate, daysThreshold = 7) {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= daysThreshold;
}

/**
 * Formats a bill for display
 * @param {Object} bill - Bill object
 * @param {string} currencySymbol - Currency symbol (e.g., '₹')
 * @returns {Object} - Formatted display data
 */
export function formatBillForDisplay(bill, currencySymbol = '₹') {
  const amountFormatted = currencySymbol + Number(bill.amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const dueDate = new Date(bill.nextDueDate);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  return {
    id: bill.id,
    name: bill.name,
    amount: bill.amount,
    amountFormatted,
    category: bill.category,
    frequency: bill.frequency,
    nextDueDate: bill.nextDueDate,
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    isDueSoon: isBillDueSoon(bill.nextDueDate, 7),
    reminderDays: bill.reminderDays || DEFAULT_REMINDER_DAYS,
    isActive: bill.isActive !== false
  };
}

// Default values
export const DEFAULT_BILL = {
  name: '',
  amount: 0,
  category: 'Other',
  frequency: BILL_FREQUENCIES.MONTHLY,
  nextDueDate: new Date().toISOString().split('T')[0],
  reminderDays: DEFAULT_REMINDER_DAYS,
  isActive: true
};

export const DEFAULT_BUDGETS = {
  monthlyBudget: 0,
  categoryBudgets: {}
};

export const DEFAULT_NOTIFICATION_PREFS = {
  billReminders: true,
  overspendingAlerts: true,
  savingsMilestones: true,
  weeklySummary: false
};
