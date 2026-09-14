import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { BagReport, MonthlyBreakdownItem, getBagWeightKg, getPeriodText } from '../utils/reportExport';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';

export interface ExportRecord {
  id: string;
  timestamp: number;
  bagTypeId?: string;
  quantity?: number;
  conversionRateAtTime?: number;
  items?: Array<{ bagTypeId: string; quantity: number }>;
}

export function useReportData() {
  const { isDemoMode } = useDemo();
  const [filterType, setFilterType] = useState('MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [logs, setLogs] = useState<any[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [reportData, setReportData] = useState<BagReport[]>([]);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthlyBreakdownItem[]>([]);
  const [conversionRate, setConversionRate] = useState(DEFAULT_SETTINGS.bao15ConversionRate);
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let start = startOfDay(now).getTime();
      let end = endOfDay(now).getTime();

      if (filterType === 'WEEK') {
        start = startOfWeek(now, { weekStartsOn: 1 }).getTime();
        end = endOfWeek(now, { weekStartsOn: 1 }).getTime();
      } else if (filterType === 'MONTH') {
        start = startOfMonth(now).getTime();
        end = endOfMonth(now).getTime();
      } else if (filterType === 'YEAR') {
        start = startOfYear(now).getTime();
        end = endOfYear(now).getTime();
      } else if (filterType === 'CUSTOM') {
        if (customStartDate) {
          const sDate = new Date(customStartDate);
          if (!isNaN(sDate.getTime())) {
            start = startOfDay(sDate).getTime();
          }
        }
        if (customEndDate) {
          const eDate = new Date(customEndDate);
          if (!isNaN(eDate.getTime())) {
            end = endOfDay(eDate).getTime();
          }
        }
      }

      if (isDemoMode) {
        const demoSettings = demoStore.getSettings();
        const currentRate = demoSettings.bao15ConversionRate || DEFAULT_SETTINGS.bao15ConversionRate;
        setConversionRate(currentRate);

        const demoLogs = demoStore.getActivityLogs().filter(l => l.timestamp >= start && l.timestamp <= end);
        demoLogs.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(demoLogs);

        const stockMap = demoStore.getInventory();
        const demoImports = demoStore.getImports().filter(i => i.timestamp >= start && i.timestamp <= end);
        const demoExports = demoStore.getExports().filter(e => e.timestamp >= start && e.timestamp <= end);
        setExports(demoExports.map(d => ({
          id: d.id,
          timestamp: Number(d.timestamp) || Date.now(),
          bagTypeId: d.bagTypeId,
          quantity: Number(d.quantity) || 0,
          conversionRateAtTime: d.conversionRateAtTime ? Number(d.conversionRateAtTime) : undefined,
          items: (d as any).items,
        })));
        const demoBorrows = demoStore.getBorrowReturns().filter(b => b.timestamp >= start && b.timestamp <= end);

        const periodImportsMap: Record<string, number> = {};
        const periodExportsMap: Record<string, number> = {};
        const periodBorrowsMap: Record<string, number> = {};
        BAG_TYPES.forEach(b => {
          periodImportsMap[b.id] = 0;
          periodExportsMap[b.id] = 0;
          periodBorrowsMap[b.id] = 0;
        });

        demoImports.forEach(data => {
          if (data.bagTypeId && periodImportsMap[data.bagTypeId] !== undefined) {
            periodImportsMap[data.bagTypeId] += Number(data.quantity || 0);
          }
        });

        demoExports.forEach(data => {
          if (data.bagTypeId && periodExportsMap[data.bagTypeId] !== undefined) {
            const docRate = data.conversionRateAtTime || currentRate;
            const rawQty = Number(data.quantity || 0);
            const qtyBao = data.bagTypeId === 'BAO15' ? (docRate > 0 ? rawQty / docRate : 0) : rawQty;
            periodExportsMap[data.bagTypeId] += qtyBao;
          }
        });

        demoBorrows.forEach(data => {
          if (data.bagTypeId && periodBorrowsMap[data.bagTypeId] !== undefined) {
            periodBorrowsMap[data.bagTypeId] += Number(data.quantityBorrowed || 0);
          }
        });

        const calculatedReports: BagReport[] = BAG_TYPES.map(bag => {
          const currentStock = stockMap[bag.id] || 0;
          const totalImport = periodImportsMap[bag.id] || 0;
          const totalUsage = periodExportsMap[bag.id] || 0;
          const rawBorrows = periodBorrowsMap[bag.id] || 0;
          const totalExport = totalUsage + rawBorrows;
          const avgDailyUsage = totalExport / 30;

          return {
            bagTypeId: bag.id,
            name: bag.name,
            currentStock,
            totalImport,
            totalExport,
            totalUsage,
            rawBorrows,
            avgDailyUsage,
            daysRemaining: avgDailyUsage > 0 ? currentStock / avgDailyUsage : 0,
            depletionDate: currentStock === 0 ? 'Đã hết stock' : null
          };
        });

        setReportData(calculatedReports);
        setLoading(false);
        return;
      }

      // 1. Fetch settings to get conversion rate
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      let currentRate = DEFAULT_SETTINGS.bao15ConversionRate;
      if (settingsDoc.exists()) {
        currentRate = settingsDoc.data().bao15ConversionRate || currentRate;
        setConversionRate(currentRate);
      }

      // 2. Fetch all activity logs in range
      const qLogs = query(
        collection(db, 'activityLogs'),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end)
      );
      const logsSnap = await getDocs(qLogs);
      const activityData = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      activityData.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setLogs(activityData);

      // 3. Fetch current stock from 'inventory'
      const inventorySnapshot = await getDocs(collection(db, 'inventory'));
      const stockMap: Record<string, number> = {};
      BAG_TYPES.forEach(b => (stockMap[b.id] = 0));
      inventorySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.bagTypeId && stockMap[data.bagTypeId] !== undefined) {
          if (!data.departmentId || data.departmentId === SYSTEM_DEPARTMENTS[0].id) {
            stockMap[data.bagTypeId] = data.quantity || 0;
          }
        }
      });

      // 4. Fetch imports in range
      const importsQ = query(
        collection(db, 'imports'),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end)
      );
      const importsSnap = await getDocs(importsQ);
      const periodImportsMap: Record<string, number> = {};
      BAG_TYPES.forEach(b => (periodImportsMap[b.id] = 0));
      importsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.bagTypeId && periodImportsMap[data.bagTypeId] !== undefined) {
          const qty = Number(data.quantity || 0);
          periodImportsMap[data.bagTypeId] += qty;
        }
      });

      // 5. Fetch exports (direct usage) in range
      const exportsQ = query(
        collection(db, 'exports'),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end)
      );
      const exportsSnap = await getDocs(exportsQ);
      const periodExportsMap: Record<string, number> = {};
      BAG_TYPES.forEach(b => (periodExportsMap[b.id] = 0));
      const exportsList: ExportRecord[] = [];
      exportsSnap.forEach(docSnap => {
        const data = docSnap.data();
        exportsList.push({
          id: docSnap.id,
          timestamp: Number(data.timestamp) || Date.now(),
          bagTypeId: data.bagTypeId,
          quantity: Number(data.quantity) || 0,
          conversionRateAtTime: data.conversionRateAtTime ? Number(data.conversionRateAtTime) : undefined,
          items: data.items,
        });
        if (data.bagTypeId && periodExportsMap[data.bagTypeId] !== undefined) {
          const docRate =
            data.conversionRateAtTime && Number(data.conversionRateAtTime) > 0
              ? Number(data.conversionRateAtTime)
              : currentRate;
          const rawQty = Number(data.quantity || 0);
          const qtyBao = data.bagTypeId === 'BAO15' ? (docRate > 0 ? rawQty / docRate : 0) : rawQty;
          periodExportsMap[data.bagTypeId] += qtyBao;
        }
      });
      setExports(exportsList);

      // 6. Fetch borrowings (loans outbound) in range
      const borrowsQ = query(
        collection(db, 'borrowReturns'),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end)
      );
      const borrowsSnap = await getDocs(borrowsQ);
      const periodBorrowsMap: Record<string, number> = {};
      BAG_TYPES.forEach(b => (periodBorrowsMap[b.id] = 0));
      borrowsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.bagTypeId && periodBorrowsMap[data.bagTypeId] !== undefined) {
          periodBorrowsMap[data.bagTypeId] += Number(data.quantityBorrowed || 0);
        }
      });

      // 7. Fetch exports in last 30 days for STABLE average daily usage rate
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const exports30DaysQ = query(
        collection(db, 'exports'),
        where('timestamp', '>=', thirtyDaysAgo)
      );
      const exports30DaysSnap = await getDocs(exports30DaysQ);
      const thirtyDaysExportsMap: Record<string, number> = {};
      BAG_TYPES.forEach(b => (thirtyDaysExportsMap[b.id] = 0));
      exports30DaysSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.bagTypeId && thirtyDaysExportsMap[data.bagTypeId] !== undefined) {
          const docRate =
            data.conversionRateAtTime && Number(data.conversionRateAtTime) > 0
              ? Number(data.conversionRateAtTime)
              : currentRate;
          const rawQty = Number(data.quantity || 0);
          const qtyBao = data.bagTypeId === 'BAO15' ? (docRate > 0 ? rawQty / docRate : 0) : rawQty;
          thirtyDaysExportsMap[data.bagTypeId] += qtyBao;
        }
      });

      // Calculate days spanned in last 30 days
      const earliestExportTimestamp = exports30DaysSnap.docs.reduce((min, docSnap) => {
        const ts = docSnap.data().timestamp;
        return ts < min ? ts : min;
      }, Date.now());
      const daysSpanned = Math.max(1, Math.min(30, Math.ceil((Date.now() - earliestExportTimestamp) / (24 * 60 * 60 * 1000))));

      // 8. Compile report data
      const calculatedReports: BagReport[] = BAG_TYPES.map(bag => {
        const currentStock = stockMap[bag.id] || 0; // in bao
        const totalImport = periodImportsMap[bag.id] || 0; // in bao
        const totalUsage = periodExportsMap[bag.id] || 0; // in bao
        const rawBorrows = periodBorrowsMap[bag.id] || 0; // in bao
        const totalExport = totalUsage + rawBorrows; // in bao

        const total30DayExportInBao = thirtyDaysExportsMap[bag.id] || 0;
        const avgDailyUsage = total30DayExportInBao / daysSpanned; // in bao/day

        let daysRemaining: number | null = null;
        let depletionDateStr: string | null = null;

        if (avgDailyUsage > 0) {
          daysRemaining = currentStock / avgDailyUsage;
          const depTime = Date.now() + daysRemaining * 24 * 60 * 60 * 1000;
          depletionDateStr = format(new Date(depTime), 'dd/MM/yyyy');
        } else if (currentStock === 0) {
          daysRemaining = 0;
          depletionDateStr = 'Đã hết stock';
        }

        return {
          bagTypeId: bag.id,
          name: bag.name,
          currentStock,
          totalImport,
          totalExport,
          totalUsage,
          rawBorrows,
          avgDailyUsage,
          daysRemaining,
          depletionDate: depletionDateStr
        };
      });

      setReportData(calculatedReports);

      // 9. Compile monthly breakdown for yearly report
      const breakdownList: MonthlyBreakdownItem[] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: `Tháng ${(i + 1).toString().padStart(2, '0')}`,
        totalImportBao: 0,
        totalImportKg: 0,
        totalExportBao: 0,
        totalExportKg: 0,
        importsByBag: {},
        exportsByBag: {}
      }));

      importsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.timestamp && data.bagTypeId) {
          const m = new Date(data.timestamp).getMonth();
          if (m >= 0 && m < 12) {
            const docRate =
              data.conversionRateAtTime && Number(data.conversionRateAtTime) > 0
                ? Number(data.conversionRateAtTime)
                : currentRate;
            const qty = Number(data.quantity || 0);
            const w = getBagWeightKg(data.bagTypeId, docRate);
            breakdownList[m].importsByBag[data.bagTypeId] =
              (breakdownList[m].importsByBag[data.bagTypeId] || 0) + qty;
            breakdownList[m].totalImportBao += qty;
            breakdownList[m].totalImportKg += qty * w;
          }
        }
      });

      exportsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.timestamp && data.bagTypeId) {
          const m = new Date(data.timestamp).getMonth();
          if (m >= 0 && m < 12) {
            const docRate =
              data.conversionRateAtTime && Number(data.conversionRateAtTime) > 0
                ? Number(data.conversionRateAtTime)
                : currentRate;
            const rawQty = Number(data.quantity || 0);
            const qtyBao = data.bagTypeId === 'BAO15' ? (docRate > 0 ? rawQty / docRate : 0) : rawQty;
            const w = getBagWeightKg(data.bagTypeId, docRate);
            const qtyKg = qtyBao * w;

            breakdownList[m].exportsByBag[data.bagTypeId] =
              (breakdownList[m].exportsByBag[data.bagTypeId] || 0) + qtyBao;
            breakdownList[m].totalExportBao += qtyBao;
            breakdownList[m].totalExportKg += qtyKg;
          }
        }
      });

      setMonthlyBreakdown(breakdownList);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, customStartDate, customEndDate, isDemoMode]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Aggregated totals memoization
  const totalPeriodImports = useMemo(() => reportData.reduce((sum, item) => sum + item.totalImport, 0), [reportData]);
  const totalPeriodImportsKg = useMemo(
    () => reportData.reduce((sum, item) => sum + item.totalImport * getBagWeightKg(item.bagTypeId, conversionRate), 0),
    [reportData, conversionRate]
  );

  const totalPeriodExports = useMemo(() => reportData.reduce((sum, item) => sum + item.totalExport, 0), [reportData]);
  const totalPeriodExportsKg = useMemo(
    () => reportData.reduce((sum, item) => sum + item.totalExport * getBagWeightKg(item.bagTypeId, conversionRate), 0),
    [reportData, conversionRate]
  );

  const totalPeriodUsage = useMemo(() => reportData.reduce((sum, item) => sum + item.totalUsage, 0), [reportData]);
  const totalPeriodUsageKg = useMemo(
    () => reportData.reduce((sum, item) => sum + item.totalUsage * getBagWeightKg(item.bagTypeId, conversionRate), 0),
    [reportData, conversionRate]
  );

  const totalCurrentStock = useMemo(() => reportData.reduce((sum, item) => sum + item.currentStock, 0), [reportData]);
  const totalCurrentStockKg = useMemo(
    () => reportData.reduce((sum, item) => sum + item.currentStock * getBagWeightKg(item.bagTypeId, conversionRate), 0),
    [reportData, conversionRate]
  );

  const periodText = useMemo(
    () => getPeriodText(filterType, customStartDate, customEndDate),
    [filterType, customStartDate, customEndDate]
  );

  return {
    filterType,
    setFilterType,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    logs,
    exports,
    reportData,
    monthlyBreakdown,
    conversionRate,
    loading,
    refetch: fetchReports,
    totalPeriodImports,
    totalPeriodImportsKg,
    totalPeriodExports,
    totalPeriodExportsKg,
    totalPeriodUsage,
    totalPeriodUsageKg,
    totalCurrentStock,
    totalCurrentStockKg,
    periodText
  };
}
