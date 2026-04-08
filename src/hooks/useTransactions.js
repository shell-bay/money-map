import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { getUserTransactionsCollection } from '../firebase';
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
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateBalance,
  calculateTransactionCount,
  calculateAverageTransaction,
  filterTransactionsByDateRange
} from '../utils/financeCalculations';

export function useTransactions(options = {}) {
  const { days = 30 } = options;
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  // Set up real-time listener for user's transactions (fetch all)
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const transactionsRef = getUserTransactionsCollection(user.uid);
      // Query all transactions ordered by date desc (no date filter, no limit)
      const q = query(transactionsRef, orderBy('date', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          setTransactions(data);
          setLoading(false);
        },
        (err) => {
          console.error('Firestore listener error:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;

      return () => {
        unsubscribe();
        unsubscribeRef.current = null;
      };
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  // Add a new transaction
  const addTransaction = useCallback(async (transactionData) => {
    if (!user) throw new Error('User not authenticated');

    const transactionsRef = getUserTransactionsCollection(user.uid);
    const newData = {
      ...transactionData,
      amount: Number(transactionData.amount),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(transactionsRef, newData);
      // onSnapshot will automatically update the UI
    } catch (err) {
      console.error('Add transaction error:', err);
      throw err;
    }
  }, [user]);

  // Delete a transaction
  const deleteTransaction = useCallback(async (transactionId) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const transactionRef = doc(getUserTransactionsCollection(user.uid), transactionId);
      await deleteDoc(transactionRef);
      // onSnapshot will automatically update the UI
    } catch (err) {
      console.error('Delete transaction error:', err);
      throw err;
    }
  }, [user]);

  // Update a transaction
  const updateTransaction = useCallback(async (transactionId, updates) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const transactionRef = doc(getUserTransactionsCollection(user.uid), transactionId);
      await updateDoc(transactionRef, {
        ...updates,
        amount: updates.amount ? Number(updates.amount) : updates.amount,
        updatedAt: serverTimestamp()
      });
      // onSnapshot will automatically update the UI
    } catch (err) {
      console.error('Update transaction error:', err);
      throw err;
    }
  }, [user]);

  // Clear all transactions (optimized batch delete)
  const clearAllTransactions = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');

    try {
      // If we have many transactions, use batch delete in chunks
      const batchSize = 500;
      let remaining = [...transactions];

      while (remaining.length > 0) {
        const batch = remaining.slice(0, batchSize);
        await Promise.all(
          batch.map((tx) => {
            const transactionRef = doc(getUserTransactionsCollection(user.uid), tx.id);
            return deleteDoc(transactionRef);
          })
        );
        remaining = remaining.slice(batchSize);
      }
      // onSnapshot will automatically update the UI to empty array
    } catch (err) {
      console.error('Clear transactions error:', err);
      throw err;
    }
  }, [user, transactions]);

  // Filter transactions for the selected time window (for totals)
  const filteredTransactions = useMemo(
    () => filterTransactionsByDateRange(transactions, days),
    [transactions, days]
  );

  // Totals for filtered time window (used by Dashboard and Analytics)
  const totalIncome = useMemo(
    () => calculateTotalIncome(filteredTransactions),
    [filteredTransactions]
  );

  const totalExpenses = useMemo(
    () => calculateTotalExpenses(filteredTransactions),
    [filteredTransactions]
  );

  const balance = useMemo(
    () => calculateBalance(filteredTransactions),
    [filteredTransactions]
  );

  // Statistics based on ALL transactions (for other uses)
  const transactionCount = useMemo(
    () => calculateTransactionCount(transactions),
    [transactions]
  );

  const avgTransaction = useMemo(
    () => calculateAverageTransaction(transactions),
    [transactions]
  );

  // No-op loadMore for API compatibility (pagination not used with date filter)
  const loadMore = useCallback(async () => {
    // Since we fetch all transactions in the date range, there's nothing more to load
    console.log('loadMore called but all data is already loaded');
  }, []);

  // Static compatibility flags
  const hasMore = false;
  const loadingMore = false;

  return {
    transactions,
    loading,
    error,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    clearAllTransactions,
    totalIncome,
    totalExpenses,
    balance,
    transactionCount,
    avgTransaction,
    hasMore,
    loadingMore,
    loadMore
  };
}
