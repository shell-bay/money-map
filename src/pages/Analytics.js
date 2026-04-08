import { useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useTransactions } from '../hooks/useTransactions';
import { useBills } from '../hooks/useBills';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useToast } from '../components/Toast';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import { generateFinancialPrediction } from '../utils/financePredictions';
import { filterTransactionsByDateRange } from '../utils/financeCalculations';
import BudgetSettingsModal from '../components/BudgetSettingsModal';
import BillModal from '../components/BillModal';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [timeRange, setTimeRange] = useState(30); // days
  const { transactions, loading, error, totalIncome, totalExpenses, balance } = useTransactions({ days: timeRange });
  const { bills, loading: billsLoading } = useBills();
  const navigate = useNavigate();
  const toast = useToast();

  // Modal states
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [editingBillId, setEditingBillId] = useState(null);

  // Get display name from user profile or fallback to email
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  // Refs for chart capturing
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);

  // Filter transactions for charts based on selected timeRange
  const chartTransactions = useMemo(() =>
    filterTransactionsByDateRange(transactions, timeRange),
    [transactions, timeRange]
  );

  // DEBUG: Verify data consistency
  console.log("All Transactions (from hook):", transactions);
  console.log("Chart Transactions (filtered by", timeRange, "days):", chartTransactions);
  console.log("Analytics Totals (from hook):", { totalIncome, totalExpenses, balance });

  // Helper function for currency formatting (defined early to avoid TDZ)
  const formatCurrency = useCallback((amount) => {
    const currencyCode = settings.currency || 'INR';
    const currencySymbols = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      AUD: 'A$',
      CAD: 'C$'
    };
    const symbol = currencySymbols[currencyCode] || currencyCode;

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount).replace(currencyCode, symbol);
  }, [settings.currency]);

  // Export to PDF
  const exportToPDF = async () => {
    // Capture charts as images
    let pieChartImg = null;
    let barChartImg = null;

    if (pieChartRef.current) {
      try {
        const canvas = await html2canvas(pieChartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        pieChartImg = canvas.toDataURL('image/png');
      } catch (err) {
        console.error('Failed to capture pie chart:', err);
      }
    }

    if (barChartRef.current) {
      try {
        const canvas = await html2canvas(barChartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        barChartImg = canvas.toDataURL('image/png');
      } catch (err) {
        console.error('Failed to capture bar chart:', err);
      }
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;


    // Helper: Add section header
    const addSectionHeader = (title, y) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(7, 94, 84);
      doc.text(title, margin, y);
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      doc.setTextColor(50, 50, 50);
      return y + 12;
    };

    // Helper: Add table header
    const addTableHeader = (headers, y) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
      doc.setTextColor(30, 30, 30);

      let x = margin + 10;
      headers.forEach((header, idx) => {
        const width = header.width || (pageWidth - 2 * margin - 20) / headers.length;
        doc.text(header.label, x + width / 2, y + 4.5, { align: 'center' });
        x += width;
      });

      return y + 7;
    };

    // Helper: Add table row
    const addTableRow = (cells, y, isEven = false) => {
      if (isEven) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, pageWidth - 2 * margin, 6, 'F');
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);

      let x = margin + 10;

      // First pass: calculate all cell heights
      const cellInfos = cells.map((cell) => {
        const width = cell.width || (pageWidth - 2 * margin - 30) / cells.length;
        const maxTextWidth = width - 10;
        const splitText = doc.splitTextToSize(cell.content, maxTextWidth);
        const lineHeight = 5;
        const cellHeight = splitText.length * lineHeight;
        return {
          width,
          splitText,
          cellHeight,
          align: cell.align || (cell.align === undefined ? false : cell.align) // preserve undefined
        };
      });

      const maxRowHeight = Math.max(6, ...cellInfos.map(info => info.cellHeight));

      // Second pass: render with proper vertical centering
      cellInfos.forEach((info, idx) => {
        const { width, splitText, cellHeight } = info;
        const align = info.align !== undefined ? info.align : (idx === cells.length - 1 ? 'right' : 'left');

        // Set color (need to get from original cells)
        const cell = cells[idx];
        if (cell.color === 'green') {
          doc.setTextColor(5, 150, 105);
        } else if (cell.color === 'red') {
          doc.setTextColor(220, 38, 38);
        } else {
          doc.setTextColor(50, 50, 50);
        }

        const lineHeight = 5;
        const startY = y + (maxRowHeight - cellHeight) / 2 + (lineHeight / 2);

        splitText.forEach((line, lineIdx) => {
          doc.text(line, x + width / 2, startY + lineIdx * lineHeight, { align });
        });

        x += width;
      });

      return y + maxRowHeight;
    };

    // Helper: Add prediction report section
    const addPredictionSection = (y) => {
      const prediction = generateFinancialPrediction(transactions, settings);

      let yPos = y;

      // Section header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(t('analytics.pdf.financialPredictions'), margin, yPos);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
      doc.setTextColor(50, 50, 50);
      yPos += 12;

      // Check if prediction data is insufficient
      if (!prediction || prediction.includes("Not enough data") || prediction.includes("Need at least 2 months")) {
        const msg = t('analytics.pdf.insufficientData');
        const maxWidth = pageWidth - 2 * margin - 12; // account for padding
        const splitMsg = doc.splitTextToSize(msg, maxWidth);
        const lineHeight = 7;
        const boxPadding = 6;
        const boxHeight = splitMsg.length * lineHeight + 2 * boxPadding;
        const boxY = yPos;

        // Draw light background box with border
        doc.setFillColor(240, 248, 255); // light blue (AliceBlue)
        doc.roundedRect(margin, boxY, pageWidth - 2 * margin, boxHeight, 4, 4, 'F');
        doc.setDrawColor(100, 200, 255);
        doc.roundedRect(margin, boxY, pageWidth - 2 * margin, boxHeight, 4, 4, 'S');

        // Draw text
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(0, 100, 200); // dark blue
        splitMsg.forEach((line, i) => {
          doc.text(line, margin + boxPadding, boxY + boxPadding + i * lineHeight);
        });

        yPos = boxY + boxHeight + 5;
        return yPos;
      }

      const lines = prediction.split('\n');
      const lineHeight = 7;

      // Map emojis to plain labels
      const emojiMap = {
        '🔮': 'PREDICTION REPORT',
        '📊': 'NEXT MONTH FORECAST',
        '📈': 'TREND ANALYSIS',
        '⚠️': 'RISK ALERTS',
        '💡': 'SMART FORECAST',
        '🎯': 'ACTION PLAN'
      };

      lines.forEach(line => {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = 20;
        }

        const trimmed = line.trim();
        if (!trimmed) {
          yPos += lineHeight / 2;
          return;
        }

        // Check for section header with emoji
        let matchedEmoji = null;
        for (const [emoji] of Object.entries(emojiMap)) {
          if (trimmed.startsWith(emoji)) {
            matchedEmoji = emoji;
            break;
          }
        }

        if (matchedEmoji) {
          // Sub-section header - wrap long text
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(7, 94, 84);
          const text = trimmed.replace(matchedEmoji, '').trim();
          const maxWidth = pageWidth - 2 * margin - 5;
          const splitText = doc.splitTextToSize(text, maxWidth);
          splitText.forEach((line, idx) => {
            if (yPos > pageHeight - 15) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, margin, yPos);
            yPos += lineHeight;
          });
        } else if (trimmed.startsWith('•')) {
          // Bullet point - wrap long text
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          const text = trimmed;
          const maxWidth = pageWidth - 2 * margin - 5; // minimal reduction for bullet space
          const splitText = doc.splitTextToSize(text, maxWidth);
          splitText.forEach((line, idx) => {
            if (yPos > pageHeight - 15) {
              doc.addPage();
              yPos = 20;
            }
            const prefix = idx === 0 ? '• ' : '  ';
            doc.text(prefix + line, margin, yPos);
            yPos += lineHeight;
          });
        } else if (trimmed.includes(':')) {
          // Key-value pair - wrap value if too long
          const colonIdx = trimmed.indexOf(':');
          const key = trimmed.substring(0, colonIdx + 1);
          const value = trimmed.substring(colonIdx + 1);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);

          // Calculate key width BEFORE changing font (key uses normal font)
          const keyWidth = doc.getStringUnitWidth(key) * 0.35;

          doc.text(key, margin, yPos);
          doc.setFont('helvetica', 'bold');

          const maxValueWidth = pageWidth - margin - (margin + keyWidth + 5);

          if (maxValueWidth > 20) {
            const splitValue = doc.splitTextToSize(value, maxValueWidth);
            doc.text(value, margin + keyWidth + 5, yPos);
            yPos += lineHeight;
            // Additional lines for wrapped value
            for (let i = 1; i < splitValue.length; i++) {
              if (yPos > pageHeight - 15) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(splitValue[i], margin + keyWidth + 5, yPos);
              yPos += lineHeight;
            }
          } else {
            doc.text(value, margin + keyWidth + 5, yPos);
            yPos += lineHeight;
          }
        } else {
          // Regular text - wrap
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          const maxWidth = pageWidth - 2 * margin - 5;
          const splitText = doc.splitTextToSize(trimmed, maxWidth);
          splitText.forEach((line) => {
            if (yPos > pageHeight - 15) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, margin, yPos);
            yPos += lineHeight;
          });
        }
      });

      yPos += 15;
      return yPos;
    };

    // ========== HEADER ==========
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, pageWidth, 25, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(t('analytics.pdfTitle'), margin, 16);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(t('analytics.monthlyReport'), margin, 24);

    const currentDate = new Date().toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    doc.setFontSize(10);
    doc.text(t('analytics.generatedOn', { date: currentDate }), pageWidth - margin, 16, { align: 'right' });
    doc.text(t('analytics.userLabel', { name: user?.displayName || user?.email?.split('@')[0] || 'User' }), pageWidth - margin, 24, { align: 'right' });

    let yPos = 35;

    // ========== REPORT DETAILS ==========
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const currencySymbol = CURRENCIES.find(c => c.code === settings?.currency)?.symbol || settings?.currency || '₹';
    doc.text(t('analytics.pdf.currency', { symbol: currencySymbol, code: settings?.currency || 'INR' }), margin, yPos);

    // Date range of transactions
    if (transactions.length > 0) {
      const validDates = transactions
        .map(tx => tx.date ? new Date(tx.date) : null)
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => a - b);
      if (validDates.length > 0) {
        const firstDate = validDates[0].toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' });
        const lastDate = validDates[validDates.length - 1].toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' });
        doc.text(t('analytics.pdf.period', { start: firstDate, end: lastDate }), pageWidth - margin, yPos, { align: 'right' });
      }
    }

    yPos += 12;
    doc.setLineWidth(0.5);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // ========== SUMMARY SECTION ==========
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 50);
    doc.text(t('analytics.pdf.financialSummary'), margin, yPos);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
    doc.setTextColor(50, 50, 50);
    yPos += 12;
    yPos += 5;

    // Summary cards
    const cardWidth = (pageWidth - 2 * margin - 40) / 3;
    const cardHeight = 28;
    const cards = [
      { label: t('dashboard.totalIncome'), value: totalIncome, color: 'green' },
      { label: t('dashboard.totalExpenses'), value: totalExpenses, color: 'red' },
      { label: t('dashboard.balance'), value: balance, color: balance >= 0 ? 'green' : 'red' }
    ];

    cards.forEach((card, idx) => {
      const x = margin + idx * (cardWidth + 12);

      doc.setFillColor(255, 255, 255);
      doc.rect(x, yPos, cardWidth, cardHeight, 'F');

      doc.setDrawColor(230, 230, 230);
      doc.rect(x, yPos, cardWidth, cardHeight);

      // Center label and value vertically within card
      // Center label and value vertically within card
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      const labelText = card.label;
      const labelLines = doc.splitTextToSize(labelText, cardWidth - 8);
      const labelHeight = labelLines.length * 4;
      const valueFontSize = 14;
      doc.setFontSize(valueFontSize);
      doc.setFont('helvetica', 'bold');
      if (card.color === 'green') doc.setTextColor(5, 150, 105);
      else doc.setTextColor(220, 38, 38);
      const valueText = formatCurrency(card.value);
      const maxValueWidth = cardWidth - 12;
      const valueLines = doc.splitTextToSize(valueText, maxValueWidth);
      const valueLineHeight = 6;
      const valueHeight = valueLines.length * valueLineHeight;
      const totalContentHeight = labelHeight + 4 + valueHeight; // 4px gap between label and value
      let contentY = yPos + (cardHeight - totalContentHeight) / 2;

      // Draw label
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      labelLines.forEach((line) => {
        doc.text(line, x + cardWidth / 2, contentY + 2, { align: 'center' });
        contentY += 4;
      });
      contentY += 4; // gap

      // Draw value
      doc.setFontSize(valueFontSize);
      doc.setFont('helvetica', 'bold');
      if (card.color === 'green') doc.setTextColor(5, 150, 105);
      else doc.setTextColor(220, 38, 38);
      valueLines.forEach((line, idx) => {
        doc.text(line, x + cardWidth / 2, contentY + idx * valueLineHeight, { align: 'center' });
      });
    });

    yPos += cardHeight + 20;

    // ========== CHARTS SECTION ==========
    if (pieChartImg || barChartImg) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(7, 94, 84);
      doc.text(t('analytics.pdf.visualInsights'), margin, yPos);
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
      doc.setTextColor(50, 50, 50);
      yPos += 12;

      const imgWidth = (pageWidth - 2 * margin - 10) / 2;
      const imgHeight = 100;

      if (yPos + imgHeight > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }

      if (pieChartImg) {
        doc.addImage(pieChartImg, 'PNG', margin, yPos, imgWidth, imgHeight);
      }
      if (barChartImg) {
        const x = pieChartImg ? margin + imgWidth + 10 : margin;
        doc.addImage(barChartImg, 'PNG', x, yPos, imgWidth, imgHeight);
      }

      yPos += imgHeight + 15;
    }

    // ========== CATEGORY BREAKDOWN ==========
    const categoryMap = new Map();
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = t.category || i18n.t('transactionList.uncategorized');
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + parseFloat(t.amount || 0));
      });

    const categoryData = Array.from(categoryMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (categoryData.length > 0) {
      yPos = addSectionHeader(t('analytics.spendingByCategory'), yPos);
      yPos += 3; // padding before table

      const categoryHeaders = [
        { label: t('dashboard.category'), width: 80 },
        { label: t('dashboard.amount'), width: 35 },
        { label: t('analytics.pdf.percentOfTotal'), width: 25 }
      ];

      yPos = addTableHeader(categoryHeaders, yPos);
      yPos += 3; // Add extra padding before table rows

      categoryData.forEach((cat, idx) => {
        if (yPos > pageHeight - 25) {
          doc.addPage();
          yPos = 20;
        }

        yPos = addTableRow([
          { content: cat.name, width: 60 },
          { content: formatCurrency(cat.value), width: 25, align: 'right', color: 'red' },
          { content: `${totalExpenses > 0 ? ((cat.value / totalExpenses) * 100).toFixed(1) : 0}%`, width: 25, align: 'right' }
        ], yPos, idx % 2 === 0);
      });

      yPos += 15;
    }

    // ========== RECENT TRANSACTIONS ==========
    const sortedTransactions = [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 50);

    if (sortedTransactions.length > 0) {
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
      }

      yPos = addSectionHeader(t('analytics.pdf.recentTransactions'), yPos);
      yPos += 3; // padding before table

      const txHeaders = [
        { label: 'Date', width: 35 },
        { label: 'Type', width: 45 },
        { label: 'Category', width: 60 },
        { label: 'Amount', width: 40 }
      ];

      yPos = addTableHeader(txHeaders, yPos);
      yPos += 3; // Add extra padding before table rows

      sortedTransactions.forEach((tx, idx) => {
        if (yPos > pageHeight - 25) {
          doc.addPage();
          yPos = 20;
        }

        const dateStr = tx.date ? new Date(tx.date).toLocaleDateString(i18n.language, {
          month: 'short',
          day: 'numeric'
        }) : 'N/A';
        const typeStr = tx.type === 'income' ? t('common.income') : t('common.expenses');
        const amountStr = formatCurrency(tx.amount);

        yPos = addTableRow([
          { content: dateStr, width: 25 },
          { content: typeStr, width: 20 },
          { content: tx.category || 'N/A', width: 40 },
          { content: (tx.type === 'income' ? '+' : '-') + amountStr, width: 25, align: 'right', color: tx.type === 'income' ? 'green' : 'red' }
        ], yPos, idx % 2 === 0);
      });

      yPos += 15;
    }

    yPos += 5; // extra padding before prediction

    // ========== PREDICTION REPORT ==========
    yPos = addPredictionSection(yPos);

    // ========== FOOTER ==========
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text(
        t('analytics.generatedBy', { year: new Date().getFullYear() }),
        margin,
        pageHeight - 10
      );
      doc.text(
        t('common.pageOf', { current: i, total: pageCount }),
        pageWidth - margin,
        pageHeight - 10,
        { align: 'right' }
      );
    }

    doc.save(`money-map-report-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.addToast('PDF report downloaded!', 'success');
  };

  // Separate income and expenses from the filtered transactions
  const { incomeTransactions, expenseTransactions } = useMemo(() => {
    const income = chartTransactions.filter(t => t.type === 'income');
    const expenses = chartTransactions.filter(t => t.type === 'expense');
    return { incomeTransactions: income, expenseTransactions: expenses };
  }, [chartTransactions]);

  // Totals are provided by the useTransactions hook (filtered to Dashboard's 30-day window by default)
  // analytics timeRange toggle affects the displayed charts/insights via chartTransactions, but hook totals remain at 30 days
  // To keep totals consistent with Dashboard, we use the hook's totals (which are based on 30 days)
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Number(((netSavings / totalIncome) * 100).toFixed(1)) : 0;

  // Prepare data for charts
  const { dailyData, categoryData, comparisonData } = useMemo(() => {
    // Daily spending/income for line chart (last 7 days)
    const dailyMap = new Map();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push(dateStr);
      dailyMap.set(dateStr, { date: dateStr, income: 0, expenses: 0 });
    }

    chartTransactions.forEach(t => {
      const txDate = new Date(t.date);
      const date = txDate.toISOString().split('T')[0];
      if (dailyMap.has(date)) {
        const entry = dailyMap.get(date);
        const amount = Number(t.amount) || 0;
        if (t.type === 'income') entry.income += amount;
        else entry.expenses += amount;
      }
    });

    const dailyData = days.map(date => {
      const entry = dailyMap.get(date);
      return {
        ...entry,
        income: Number(entry.income.toFixed(2)),
        expenses: Number(entry.expenses.toFixed(2)),
        date: new Date(date).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })
      };
    });

    // Category breakdown (expenses only) - precise arithmetic
    const categoryMap = new Map();
    expenseTransactions.forEach(t => {
      // Ensure category is a string, fallback to 'Uncategorized'
      let cat = t.category;
      if (typeof cat !== 'string' || !cat.trim()) {
        cat = i18n.t('transactionList.uncategorized');
      } else {
        cat = cat.trim();
      }
      const amount = Number(t.amount) || 0;
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + amount);
    });

    const categoryData = Array.from(categoryMap, ([name, value]) => ({
      name: typeof name === 'string' ? name : t('transactionList.uncategorized'),
      value: Number(value.toFixed(2))
    })).sort((a, b) => b.value - a.value).slice(0, 6); // Top 6 categories

    // Income vs expense comparison by month (or last 30 days if small data)
    const monthMap = new Map();
    chartTransactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { month: monthKey, income: 0, expenses: 0 });
      }
      const entry = monthMap.get(monthKey);
      const amount = Number(t.amount) || 0;
      if (t.type === 'income') entry.income += amount;
      else entry.expenses += amount;
    });

    // Round values to 2 decimals and format month label according to language
    let comparisonData = Array.from(monthMap.values())
      .map(entry => ({
        month: new Date(entry.month + '-01').toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' }),
        income: Number(entry.income.toFixed(2)),
        expenses: Number(entry.expenses.toFixed(2))
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    if (comparisonData.length === 0) {
      comparisonData = [{
        month: t('analytics.currentPeriod'),
        income: Number(totalIncome.toFixed(2)),
        expenses: Number(totalExpenses.toFixed(2))
      }];
    }

    return { dailyData, categoryData, comparisonData };
  }, [chartTransactions, expenseTransactions, totalIncome, totalExpenses, i18n, t]);

  // Category Growth Comparison (month-over-month % change)
  const { categoryGrowthData } = useMemo(() => {
    // Build monthly category data from all transactions
    const monthlyMap = new Map();
    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, new Map());
      const catMap = monthlyMap.get(monthKey);
      // Ensure category is a string
      let cat = tx.category;
      if (typeof cat !== 'string' || !cat.trim()) {
        cat = i18n.t('transactionList.uncategorized');
      } else {
        cat = cat.trim();
      }
      catMap.set(cat, (catMap.get(cat) || 0) + Number(tx.amount));
    });

    const sortedMonths = Array.from(monthlyMap.keys()).sort();
    if (sortedMonths.length < 2) {
      return { categoryGrowthData: [] };
    }

    const latestMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const latestCats = monthlyMap.get(latestMonth);
    const prevCats = monthlyMap.get(prevMonth);

    // Combine to get top 5 categories by volume
    const combined = new Map();
    [latestCats, prevCats].forEach(map => {
      map.forEach((val, cat) => {
        combined.set(cat, (combined.get(cat) || 0) + val);
      });
    });
    const topCategories = Array.from(combined.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    const growthData = topCategories.map(cat => {
      const current = latestCats.get(cat) || 0;
      const previous = prevCats.get(cat) || 0;
      const change = current - previous;
      const changePercent = previous > 0 ? Number(((change / previous) * 100).toFixed(1)) : 0;
      return {
        category: cat,
        current,
        previous,
        change,
        changePercent
      };
    });

    return { categoryGrowthData: growthData };
  }, [transactions, i18n]);

  // Next Month Prediction
  const predictionReport = useMemo(() => {
    if (transactions.length < 2) return null;
    return generateFinancialPrediction(transactions, settings);
  }, [transactions, settings]);

  // --- INSIGHTS ---
  const insights = useMemo(() => {
    const results = [];

    // 1. Highest spending category
    if (categoryData.length > 0) {
      const topCategory = categoryData[0];
      const percentOfTotal = ((topCategory.value / totalExpenses) * 100).toFixed(1);
      results.push({
        type: 'top-category',
        title: t('analytics.insights.topCategory.title'),
        text: t('analytics.insights.topCategory.text', {
          category: topCategory.name,
          percent: percentOfTotal,
          amount: formatCurrency(topCategory.value)
        })
      });
    }

    // 2. Average daily spending
    const daysWithExpenses = new Set(expenseTransactions.map(t => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })).size;
    const avgDailySpending = daysWithExpenses > 0 ? Number((totalExpenses / daysWithExpenses).toFixed(2)) : 0;
    results.push({
      type: 'avg-daily',
      title: t('analytics.insights.averageDaily.title'),
      text: t('analytics.insights.averageDaily.text', { amount: formatCurrency(avgDailySpending) })
    });

    // 3. Spending spike detection
    const avgTransaction = expenseTransactions.length > 0 ? Number((totalExpenses / expenseTransactions.length).toFixed(2)) : 0;
    const spikeThreshold = avgTransaction * 2;
    const spikeTransactions = expenseTransactions.filter(t => (Number(t.amount) || 0) > spikeThreshold);
    if (spikeTransactions.length > 0) {
      results.push({
        type: 'spikes',
        title: t('analytics.insights.spikes.title'),
        text: t('analytics.insights.spikes.text', {
          count: spikeTransactions.length,
          average: formatCurrency(avgTransaction)
        })
      });
    }

    // 4. Income spent percentage
    if (totalIncome > 0) {
      const spentPercent = Number(((totalExpenses / totalIncome) * 100).toFixed(1));
      const percentStr = spentPercent.toFixed(1);
      if (spentPercent > 80) {
        results.push({
          type: 'spent-percent',
          title: t('analytics.insights.spentPercent.title'),
          text: t('analytics.insights.spentPercent.high', { percent: percentStr })
        });
      } else {
        results.push({
          type: 'spent-percent',
          title: t('analytics.insights.spentPercent.title'),
          text: t('analytics.insights.spentPercent.normal', { percent: percentStr })
        });
      }
    }

    // 5. Weekend vs Weekday
    const weekendSpending = expenseTransactions
      .filter(t => {
        const day = new Date(t.date).getDay();
        return day === 0 || day === 6;
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const weekdaySpending = totalExpenses - weekendSpending;

    if (expenseTransactions.length >= 7) {
      const weekendAvg = Number((weekendSpending / 3.5).toFixed(2));
      const weekdayAvg = Number((weekdaySpending / 3.5).toFixed(2));
      if (weekendAvg > weekdayAvg * 1.3) {
        results.push({
          type: 'weekend-alert',
          title: t('analytics.insights.weekendAlert.title'),
          text: t('analytics.insights.weekendAlert.text', { weekendAvg: formatCurrency(weekendAvg) })
        });
      }
    }

    return results;
  }, [categoryData, totalExpenses, expenseTransactions, totalIncome, formatCurrency, t]);

  // --- SUGGESTIONS ---
  const suggestions = useMemo(() => {
    const tips = [];

    // Suggestion 1: Reduce top category
    if (categoryData.length > 0 && totalExpenses > 0) {
      const top = categoryData[0];
      const percent = Number(((top.value / totalExpenses) * 100).toFixed(1));
      if (percent > 30) {
        tips.push({
          category: top.name,
          currentPercent: percent.toFixed(1),
          suggestion: t('analytics.suggestions.reduceTopCategory.suggestion', {
            category: top.name,
            percent: Math.round(percent),
            amount: formatCurrency(Number((top.value * 0.1).toFixed(2)))
          })
        });
      }
    }

    // Suggestion 2: Multiple high categories
    if (categoryData.length >= 3) {
      const topThreeSum = categoryData.slice(0, 3).reduce((sum, c) => sum + c.value, 0);
      const percent = Math.round((topThreeSum / totalExpenses) * 100);
      if (percent > 70) {
        tips.push({
          category: 'Diversified spending',
          suggestion: t('analytics.suggestions.diversifiedSpending.suggestion', { percent })
        });
      }
    }

    // Suggestion 3: Low savings rate
    if (totalIncome > 0 && netSavings < totalIncome * 0.2) {
      tips.push({
        category: 'Savings',
        suggestion: t('analytics.suggestions.lowSavingsRate.suggestion', { rate: savingsRate })
      });
    }

    // Suggestion 4: No recent income
    if (incomeTransactions.length === 0 && timeRange >= 30) {
      tips.push({
        category: 'Income tracking',
        suggestion: t('analytics.suggestions.noIncome.suggestion')
      });
    }

    return tips;
  }, [categoryData, totalExpenses, netSavings, totalIncome, incomeTransactions, timeRange, savingsRate, formatCurrency, t]);

  // --- UNIQUE FEATURE: MONEY HEALTH SCORE ---
  const moneyHealthScore = useMemo(() => {
    let score = 50;
    let reasons = [];

    // Factor 1: Savings rate (0-30 points)
    if (totalIncome > 0) {
      const savingsRateNum = parseFloat(savingsRate);
      if (savingsRateNum >= 30) {
        score += 30;
        reasons.push(t('analytics.moneyHealthScore.savings.excellent'));
      } else if (savingsRateNum >= 20) {
        score += 20;
        reasons.push(t('analytics.moneyHealthScore.savings.good'));
      } else if (savingsRateNum >= 10) {
        score += 10;
        reasons.push(t('analytics.moneyHealthScore.savings.fair'));
      } else if (savingsRateNum > 0) {
        score += 5;
        reasons.push(t('analytics.moneyHealthScore.savings.low'));
      } else {
        reasons.push(t('analytics.moneyHealthScore.savings.none'));
      }
    } else {
      reasons.push(t('analytics.moneyHealthScore.income.noData'));
    }

    // Factor 2: Spending concentration (-20 to 0 points)
    if (categoryData.length > 0) {
      const topPercent = (categoryData[0].value / totalExpenses) * 100;
      if (topPercent > 60) {
        score -= 20;
        reasons.push(t('analytics.moneyHealthScore.concentration.high'));
      } else if (topPercent > 40) {
        score -= 10;
        reasons.push(t('analytics.moneyHealthScore.concentration.moderate'));
      }
    }

    // Factor 3: Transaction volume (0-20 points)
    const txCount = chartTransactions.length;
    if (txCount >= 50) {
      score += 20;
      reasons.push(t('analytics.moneyHealthScore.volume.high'));
    } else if (txCount >= 20) {
      score += 10;
      reasons.push(t('analytics.moneyHealthScore.volume.moderate'));
    } else if (txCount > 0) {
      score += 5;
      reasons.push(t('analytics.moneyHealthScore.volume.basic'));
    }

    // Factor 4: Income diversity (0-15 points)
    const incomeCategories = new Set(incomeTransactions.map(t => t.category).filter(Boolean)).size;
    if (incomeCategories >= 3) {
      score += 15;
      reasons.push(t('analytics.moneyHealthScore.diversity.multiple'));
    } else if (incomeCategories === 2) {
      score += 8;
      reasons.push(t('analytics.moneyHealthScore.diversity.two'));
    } else if (incomeCategories === 1 && incomeTransactions.length > 0) {
      score += 3;
      reasons.push(t('analytics.moneyHealthScore.diversity.single'));
    }

    // Factor 5: Budget adherence (0-15 points)
    if (settings.monthlyBudget > 0 && totalExpenses > 0) {
      const budgetUsedPercent = (totalExpenses / settings.monthlyBudget) * 100;
      if (budgetUsedPercent <= 80) {
        score += 15;
        reasons.push(t('analytics.moneyHealthScore.budget.within'));
      } else if (budgetUsedPercent <= 100) {
        score += 8;
        reasons.push(t('analytics.moneyHealthScore.budget.slightlyOver'));
      } else {
        reasons.push(t('analytics.moneyHealthScore.budget.over'));
      }
    } else {
      reasons.push(t('analytics.moneyHealthScore.budget.none'));
    }

    // Cap score
    score = Math.max(0, Math.min(100, score));

    // Grade
    let grade, color;
    if (score >= 80) { grade = 'Excellent'; color = 'text-green-600'; }
    else if (score >= 60) { grade = 'Good'; color = 'text-emerald-600'; }
    else if (score >= 40) { grade = 'Fair'; color = 'text-yellow-600'; }
    else if (score >= 20) { grade = 'Needs Improvement'; color = 'text-orange-600'; }
    else { grade = 'Poor'; color = 'text-red-600'; }

    return { score, grade, color, reasons };
  }, [chartTransactions.length, categoryData, totalExpenses, incomeTransactions, totalIncome, savingsRate, settings.monthlyBudget, t]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Theme detection for dark mode chart styling
  const isDark = settings.theme === 'dark';

  // Chart colors adapted for dark/light mode
  const chartColors = {
    grid: isDark ? '#374151' : '#f0f0f0', // gray-700 in dark, light in light
    axisTick: isDark ? '#9ca3af' : '#4b5563', // gray-400 vs gray-600
    tooltipBg: isDark ? '#1f2937' : '#ffffff', // gray-800 vs white
    tooltipText: isDark ? '#f9fafb' : '#111827', // gray-50 vs gray-900
    legendText: isDark ? '#d1d5db' : undefined,
    pieLabel: isDark ? '#e5e7eb' : undefined,
    healthCircleBg: isDark ? '#374151' : '#e5e7eb' // for the money health score ring
  };

  // COLORS for pie chart segments (vibrant colors work on both light/dark)
  const COLORS = ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#dc2626', '#ea580c'];

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-300">{t('analytics.loading')}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-800 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">{t('analytics.errorTitle')}</h2>
          <p className="text-gray-600 dark:text-slate-300 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  // Show empty state
  if (transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-800">
        <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="font-bold text-xl text-gray-900 dark:text-slate-100">{t('app.name')}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-200 hidden sm:block">{displayName}</span>
                <button onClick={handleLogout} className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition">{t('common.logout')}</button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 dark:bg-slate-900 dark:border-slate-700">
            <svg className="w-24 h-24 text-gray-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">{t('analytics.noData')}</h2>
            <p className="text-gray-600 dark:text-slate-300 mb-6">{t('analytics.addTransactionsPrompt')}</p>
            <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition">
              {t('common.goToDashboard')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800 pb-8">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Card with Time Range */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{t('analytics.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">{t('analytics.subtitle')}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTimeRange(t => t === 30 ? 7 : 30)}
              className="px-4 py-2 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition border border-emerald-200"
              data-tour="time-range-toggle"
            >
              {timeRange === 30 ? t('analytics.last30Days') : t('analytics.last7Days')}
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 dark:bg-slate-900 dark:border-slate-700" data-tour="analytics-income-card">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{t('analytics.income')}</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 dark:bg-slate-900 dark:border-slate-700" data-tour="analytics-expenses-card">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{t('analytics.expenses')}</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 dark:bg-slate-900 dark:border-slate-700" data-tour="analytics-net-savings-card">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{t('analytics.netSavings')}</p>
            <p className={`text-xl font-bold ${netSavings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(netSavings)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 dark:bg-slate-900 dark:border-slate-700" data-tour="analytics-savings-rate-card">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{t('analytics.savingsRate')}</p>
            <p className="text-xl font-bold text-emerald-600">{savingsRate}%</p>
          </div>
        </div>

        {/* MONEY HEALTH SCORE - Unique Feature */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900 dark:to-teal-800 rounded-xl shadow-sm p-6 mb-8 border border-emerald-200 dark:border-emerald-700">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">{t('analytics.moneyHealthScore')}</h2>
              <p className="text-gray-600 dark:text-slate-300 text-sm">{t('analytics.scoreDescription')}</p>
            </div>
            <div className="text-center md:text-right">
              <div className="inline-flex items-center gap-3">
                <div className="relative">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke={chartColors.healthCircleBg} strokeWidth="8" fill="none" />
                    <circle
                      cx="48" cy="48" r="40"
                      stroke={moneyHealthScore.score >= 60 ? '#10b981' : moneyHealthScore.score >= 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - moneyHealthScore.score / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{moneyHealthScore.score}</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className={`text-lg font-bold ${moneyHealthScore.color}`}>{t('analytics.grade.' + moneyHealthScore.grade.toLowerCase())}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-300">out of 100</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-emerald-200 dark:border-emerald-700">
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-2 font-medium">{t('analytics.scoreBreakdown')}</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-slate-300">
              {moneyHealthScore.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Next Month Prediction Panel */}
        {predictionReport && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('analytics.nextMonthPrediction')}</h3>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-gray-800 dark:text-slate-100 max-h-96 overflow-y-auto">
              {predictionReport}
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Trend */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700" data-tour="analytics-daily-chart">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('analytics.dailySpendingTrend')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fill: chartColors.axisTick, fontSize: 12 }} />
                <YAxis tick={{ fill: chartColors.axisTick, fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.grid}`, borderRadius: '8px', color: chartColors.tooltipText }}
                  labelStyle={{ color: chartColors.tooltipText }}
                />
                <Legend wrapperStyle={{ color: chartColors.legendText }} />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name={t('common.income')} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name={t('common.expenses')} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700" data-tour="analytics-category-chart">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('analytics.spendingByCategory')}</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${typeof name === 'string' ? name : t('transactionList.uncategorized')} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(value),
                      typeof name === 'string' ? name : t('transactionList.uncategorized')
                    ]}
                    contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.grid}`, borderRadius: '8px', color: chartColors.tooltipText }}
                    labelStyle={{ color: chartColors.tooltipText }}
                  />
                  <Legend wrapperStyle={{ color: chartColors.legendText }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-slate-400">{t('analytics.noExpenseData')}</div>
            )}
          </div>
        </div>

        {/* Income vs Expense Comparison */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700 mb-8" data-tour="analytics-comparison-chart">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('analytics.chart.incomeVsExpenses')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="month" tick={{ fill: chartColors.axisTick, fontSize: 12 }} />
              <YAxis tick={{ fill: chartColors.axisTick, fontSize: 12 }} tickFormatter={(value) => {
                const curr = CURRENCIES.find(c => c.code === settings.currency);
                const symbol = curr ? curr.symbol : settings.currency;
                return `${symbol}${(value/1000).toFixed(0)}k`;
              }} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.grid}`, borderRadius: '8px', color: chartColors.tooltipText }}
                labelStyle={{ color: chartColors.tooltipText }}
              />
              <Legend wrapperStyle={{ color: chartColors.legendText }} />
              <Bar dataKey="income" fill="#10b981" name={t('common.income')} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" name={t('common.expenses')} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Growth Comparison */}
        {categoryGrowthData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('analytics.categoryGrowthTitle')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryGrowthData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis type="number" tick={{ fill: chartColors.axisTick, fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="category" tick={{ fill: chartColors.axisTick, fontSize: 12 }} width={100} />
                <Tooltip
                  formatter={(value, name, props) => {
                    if (name === 'changePercent') return [`${value}%`, t('analytics.changePercent')];
                    return [formatCurrency(value), typeof props.payload.category === 'string' ? props.payload.category : t('transactionList.uncategorized')];
                  }}
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.grid}`, borderRadius: '8px', color: chartColors.tooltipText }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  itemStyle={{ color: chartColors.tooltipText }}
                />
                <Legend wrapperStyle={{ color: chartColors.legendText }} />
                <Bar dataKey="changePercent" name={t('analytics.changePercent')}>
                  {categoryGrowthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.changePercent >= 0 ? '#ef4444' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 text-center">
              {t('analytics.chart.categoryGrowthLegend')}
            </p>
          </div>
        )}

        {/* Insights Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('analytics.insights.title')}</h3>
          <div className="space-y-4">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{insight.title}</p>
                  <p className="text-gray-700 dark:text-slate-300 mt-1">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 dark:bg-slate-900 dark:border-slate-700 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('analytics.suggestions.title')}</h3>
          {suggestions.length > 0 ? (
            <div className="space-y-4">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900 rounded-lg border border-amber-200 dark:border-amber-700">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{suggestion.category}</p>
                    <p className="text-gray-700 dark:text-slate-300 mt-1">{suggestion.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="font-medium">{t('analytics.suggestions.empty.title')}</p>
              <p className="text-sm mt-1">{t('analytics.suggestions.empty.message')}</p>
            </div>
          )}
        </div>

        {/* Spending Personality (Bonus Insight) */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-xl shadow-sm p-6 border border-blue-200 dark:border-blue-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('analytics.spendingPersonality.title')}</h3>
          {(() => {
            // Determine personality based on patterns
            const topCategoryPercent = categoryData.length > 0 ? (categoryData[0].value / totalExpenses) * 100 : 0;
            const avgTxSize = expenseTransactions.length > 0 ? totalExpenses / expenseTransactions.length : 0;
            const eveningSpending = expenseTransactions.filter(t => {
              const hour = new Date(t.date).getHours();
              return hour >= 18 || hour <= 6;
            }).reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const eveningPercent = totalExpenses > 0 ? (eveningSpending / totalExpenses) * 100 : 0;

            let personalityKey, description;

            if (topCategoryPercent > 60) {
              personalityKey = 'FocusedSpender';
            } else if (eveningPercent > 50) {
              personalityKey = 'EveningSocializer';
            } else if (avgTxSize < 500 && totalExpenses > 0) {
              personalityKey = 'Micropurchaser';
            } else if (avgTxSize > 5000 && totalExpenses > 0) {
              personalityKey = 'BigTicketBuyer';
            } else if (categoryData.length >= 5) {
              personalityKey = 'VariedExplorer';
            } else {
              personalityKey = 'BalancedMaintainer';
            }

            // Get translated personality name
            const translatedPersonality = t(`analytics.spendingPersonality.personalities.${personalityKey}`);

            // Get translated description
            const descKey = `analytics.spendingPersonality.description.${personalityKey}`;
            const descValues = personalityKey === 'EveningSocializer' ? { eveningPercent: eveningPercent.toFixed(0) } : {};
            description = t(descKey, descValues);

            return (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm text-blue-600 font-medium mb-1">{translatedPersonality}</p>
                  <p className="text-gray-700 dark:text-slate-300">{description}</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Budget Goals Section */}
        <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v2m1.333 1.666c.39.39 1.053.391 1.444 0 .39-.39.391-1.053 0-1.444L10.109 8.667M21 13.333v-2m-1.333-1.666c-.39-.39-1.053-.391-1.444 0-.39.39-.391 1.053 0 1.444L13.891 15.333M3 13.333v2m1.333-1.666c-.39-.39-1.053-.391-1.444 0-.39.39-.391 1.053 0 1.444l2.221 2.221M21 10.667h-2" />
              </svg>
              {t('analytics.budgetGoals')}
            </h2>
            <button
              onClick={() => setShowBudgetModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition text-sm"
            >
              Configure
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-500 mb-1">{t('analytics.monthlyBudget')}</div>
              <div className="text-xl font-bold text-gray-900">
                {CURRENCIES.find(c => c.code === settings.currency)?.symbol || settings.currency}
                {(settings.monthlyBudget || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-500 mb-1">{t('analytics.categoryLimits')}</div>
              <div className="text-xl font-bold text-gray-900">
                {Object.keys(settings.categoryBudgets || {}).length}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {t('analytics.budgetHelp')}
          </p>
        </section>

        {/* Recurring Bills Section */}
        <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {t('analytics.recurringBills')}
            </h2>
            <button
              onClick={() => { setEditingBillId(null); setShowBillModal(true); }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition text-sm"
            >
              {t('analytics.addBill')}
            </button>
          </div>
          {billsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div>
              {t('billsSummary.loading')}
            </div>
          ) : bills.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
              {t('analytics.noBills')}
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {bills.filter(b => b.isActive).map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{bill.name}</div>
                    <div className="text-xs text-gray-500">
                      {bill.frequency} • {CURRENCIES.find(c => c.code === settings.currency)?.symbol || settings.currency}
                      {Number(bill.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • {t('common.due')}: {bill.nextDueDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingBillId(bill.id); setShowBillModal(true); }}
                      className="p-1 text-gray-500 hover:text-emerald-600"
                      title={t('common.edit')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            {t('analytics.trackBills')}
          </p>
        </section>

        {/* Export Data Section */}
        <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('analytics.exportData')}
          </h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('analytics.exportDescription')}
            </p>
            <button
              onClick={exportToPDF}
              disabled={transactions.length === 0}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {transactions.length === 0 ? t('analytics.noDataToExport') : t('analytics.downloadPdf')}
            </button>
          </div>
        </section>
      </main>

      {/* Budget Settings Modal */}
      {showBudgetModal && (
        <BudgetSettingsModal
          isOpen={showBudgetModal}
          onClose={() => setShowBudgetModal(false)}
        />
      )}

      {/* Bill Modal */}
      {showBillModal && (
        <BillModal
          isOpen={showBillModal}
          onClose={() => { setShowBillModal(false); setEditingBillId(null); }}
          billId={editingBillId}
        />
      )}
    </div>
  );
}
