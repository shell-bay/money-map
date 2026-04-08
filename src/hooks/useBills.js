import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { getUserBillsCollection } from '../firebase';
import {
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { validateBill, BILL_FREQUENCIES, DEFAULT_REMINDER_DAYS } from '../models/financeModels';

export function useBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set up real-time listener for user's bills
  useEffect(() => {
    if (!user) {
      setBills([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const billsRef = getUserBillsCollection(user.uid);
      // Order by nextDueDate ascending (nearest due first)
      const q = query(billsRef, orderBy('nextDueDate', 'asc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((doc) => {
            const billData = doc.data();
            // Convert Firestore timestamp to ISO string if needed
            return {
              id: doc.id,
              ...billData
            };
          });
          setBills(data);
          setLoading(false);
        },
        (err) => {
          console.error('Bills listener error:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  // Add a new bill
  const addBill = useCallback(async (billData) => {
    if (!user) throw new Error('User not authenticated');

    // Validate bill data
    const validation = validateBill(billData);
    if (!validation.valid) {
      throw new Error(`Invalid bill data: ${validation.errors.join(', ')}`);
    }

    const billsRef = getUserBillsCollection(user.uid);
    const newData = {
      ...billData,
      amount: Number(billData.amount),
      reminderDays: billData.reminderDays ?? DEFAULT_REMINDER_DAYS,
      isActive: billData.isActive !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(billsRef, newData);
    } catch (err) {
      console.error('Add bill error:', err);
      throw err;
    }
  }, [user]);

  // Delete a bill
  const deleteBill = useCallback(async (billId) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const billRef = doc(getUserBillsCollection(user.uid), billId);
      await deleteDoc(billRef);
    } catch (err) {
      console.error('Delete bill error:', err);
      throw err;
    }
  }, [user]);

  // Update a bill
  const updateBill = useCallback(async (billId, updates) => {
    if (!user) throw new Error('User not authenticated');

    // Validate if amount or frequency is being updated
    if (updates.amount !== undefined || updates.frequency !== undefined || updates.nextDueDate !== undefined) {
      const currentBill = bills.find(b => b.id === billId);
      const mergedBill = { ...currentBill, ...updates };
      const validation = validateBill(mergedBill);
      if (!validation.valid) {
        throw new Error(`Invalid bill data: ${validation.errors.join(', ')}`);
      }
    }

    try {
      const billRef = doc(getUserBillsCollection(user.uid), billId);
      await updateDoc(billRef, {
        ...updates,
        amount: updates.amount ? Number(updates.amount) : updates.amount,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Update bill error:', err);
      throw err;
    }
  }, [user, bills]);

  // Toggle bill active status
  const toggleBillActive = useCallback(async (billId, isActive) => {
    await updateBill(billId, { isActive });
  }, [updateBill]);

  // Mark bill as paid (update next due date based on frequency)
  const markBillAsPaid = useCallback(async (billId, paidDate = new Date().toISOString().split('T')[0]) => {
    if (!user) throw new Error('User not authenticated');

    const bill = bills.find(b => b.id === billId);
    if (!bill) throw new Error('Bill not found');

    const nextDueDate = bill.frequency
      ? window.calculateNextDueDate ? window.calculateNextDueDate(paidDate, bill.frequency) : paidDate // Fallback
      : paidDate;

    await updateBill(billId, {
      nextDueDate,
      lastPaidDate: paidDate,
      updatedAt: serverTimestamp()
    });
  }, [user, bills, updateBill]);

  // Get upcoming bills (due in next N days)
  const getUpcomingBills = useCallback((daysThreshold = 7) => {
    const today = new Date();
    return bills.filter(bill => {
      if (!bill.isActive) return false;
      const dueDate = new Date(bill.nextDueDate);
      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= daysThreshold;
    }).sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
  }, [bills]);

  // Get overdue bills
  const getOverdueBills = useCallback(() => {
    const today = new Date();
    return bills.filter(bill => {
      if (!bill.isActive) return false;
      const dueDate = new Date(bill.nextDueDate);
      return dueDate < today;
    });
  }, [bills]);

  // Calculate total monthly recurring expenses (bills)
  const totalMonthlyBills = useMemo(() => {
    return bills.reduce((sum, bill) => {
      if (!bill.isActive) return sum;
      const amount = Number(bill.amount) || 0;
      // Convert to monthly equivalent
      let monthlyAmount = amount;
      switch (bill.frequency) {
        case BILL_FREQUENCIES.WEEKLY:
          monthlyAmount = amount * 4.33; // Average weeks per month
          break;
        case BILL_FREQUENCIES.QUARTERLY:
          monthlyAmount = amount / 3;
          break;
        case BILL_FREQUENCIES.YEARLY:
          monthlyAmount = amount / 12;
          break;
        case BILL_FREQUENCIES.MONTHLY:
        default:
          monthlyAmount = amount;
      }
      return sum + monthlyAmount;
    }, 0);
  }, [bills]);

  return {
    bills,
    loading,
    error,
    addBill,
    deleteBill,
    updateBill,
    toggleBillActive,
    markBillAsPaid,
    getUpcomingBills,
    getOverdueBills,
    totalMonthlyBills
  };
}