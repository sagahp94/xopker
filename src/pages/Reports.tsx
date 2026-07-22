import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { BAG_TYPES, DEFAULT_SETTINGS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { 
  FileDown, 
  Package, 
  ArrowDownLeft, 
  ArrowUpRight, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  TrendingUp,
  Clock,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  ClipboardList,
  Printer,
  X,
  Download,
  FileText,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../components/Layout';

interface BagReport {
  bagTypeId: string;
  name: string;
  currentStock: number; // in native units (kg for BAO15, bao for others)
  totalImport: number; // in native units in period
  totalExport: number; // total outbound in period (Direct Export + Borrowed Out)
  totalUsage: number; // direct usage (exports) in period
  avgDailyUsage: number; // average daily direct usage (based on 30-day window)
  daysRemaining: number | null; // null if no usage, 0 if out of stock
  depletionDate: string | null;
  rawBorrows: number;
}

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState('MONTH');
  const [logs, setLogs] = useState<any[]>([]);
  const [reportData, setReportData] = useState<BagReport[]>([]);
  const [conversionRate, setConversionRate] = useState(DEFAULT_SETTINGS.bao15ConversionRate);
  const [loading, setLoading] = useState(false);

  // PDF Export States & Ref
  const pdfRef = useRef<HTMLDivElement>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const getPeriodText = () => {
    const now = new Date();
    if (filterType === 'TODAY') {
      return `Hôm nay (${format(now, 'dd/MM/yyyy')})`;
    } else if (filterType === 'WEEK') {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      return `Tuần này (${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')})`;
    } else if (filterType === 'MONTH') {
      return `Tháng ${format(now, 'MM/yyyy')}`;
    } else if (filterType === 'YEAR') {
      return `Năm ${format(now, 'yyyy')}`;
    }
    return '';
  };

  const handleDownloadPdf = async () => {
    if (!pdfRef.current) return;
    setExportingPdf(true);
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`BaoCao_Kho_Xop_${format(new Date(), 'ddMMyyyy_HHmm')}.pdf`);
    } catch (err) {
      console.error('Lỗi xuất PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let start = startOfDay(now).getTime();
      let end = endOfDay(now).getTime();

      if (filterType === 'WEEK') {
        start = startOfWeek(now).getTime();
        end = endOfWeek(now).getTime();
      } else if (filterType === 'MONTH') {
        start = startOfMonth(now).getTime();
        end = endOfMonth(now).getTime();
      } else if (filterType === 'YEAR') {
        start = startOfYear(now).getTime();
        end = endOfYear(now).getTime();
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
      BAG_TYPES.forEach(b => stockMap[b.id] = 0);
      inventorySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.bagTypeId && stockMap[data.bagTypeId] !== undefined) {
          stockMap[data.bagTypeId] += (data.quantity || 0);
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
      BAG_TYPES.forEach(b => periodImportsMap[b.id] = 0);
      importsSnap.forEach(doc => {
        const data = doc.data();
        if (data.bagTypeId && periodImportsMap[data.bagTypeId] !== undefined) {
          const qty = Number(data.quantity || 0);
          // Store import as is in 'bao'
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
      BAG_TYPES.forEach(b => periodExportsMap[b.id] = 0);
      exportsSnap.forEach(doc => {
        const data = doc.data();
        if (data.bagTypeId && periodExportsMap[data.bagTypeId] !== undefined) {
          periodExportsMap[data.bagTypeId] += Number(data.quantity || 0);
        }
      });

      // 6. Fetch borrowings (loans outbound) in range
      const borrowsQ = query(
        collection(db, 'borrowReturns'),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end)
      );
      const borrowsSnap = await getDocs(borrowsQ);
      const periodBorrowsMap: Record<string, number> = {};
      BAG_TYPES.forEach(b => periodBorrowsMap[b.id] = 0);
      borrowsSnap.forEach(doc => {
        const data = doc.data();
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
      BAG_TYPES.forEach(b => thirtyDaysExportsMap[b.id] = 0);
      exports30DaysSnap.forEach(doc => {
        const data = doc.data();
        if (data.bagTypeId && thirtyDaysExportsMap[data.bagTypeId] !== undefined) {
          thirtyDaysExportsMap[data.bagTypeId] += Number(data.quantity || 0);
        }
      });

      // Calculate days spanned in last 30 days
      const earliestExportTimestamp = exports30DaysSnap.docs.reduce((min, doc) => {
        const ts = doc.data().timestamp;
        return ts < min ? ts : min;
      }, Date.now());
      const daysSpanned = Math.max(1, Math.min(30, Math.ceil((Date.now() - earliestExportTimestamp) / (24 * 60 * 60 * 1000))));

      // 8. Compile report data
      const calculatedReports: BagReport[] = BAG_TYPES.map(bag => {
        const currentStock = stockMap[bag.id] || 0; // in bao
        const totalImport = periodImportsMap[bag.id] || 0; // in bao
        
        // periodExportsMap stores quantity in KG for BAO15, but in BAO for other bag types
        const rawExports = periodExportsMap[bag.id] || 0;
        const totalUsage = bag.id === 'BAO15' ? (currentRate > 0 ? rawExports / currentRate : 0) : rawExports; // in bao

        const rawBorrows = periodBorrowsMap[bag.id] || 0; // in bao
        const totalExport = totalUsage + rawBorrows; // in bao
        
        // Calculate daily average usage from the 30-day window
        const total30DayExportRaw = thirtyDaysExportsMap[bag.id] || 0;
        const total30DayExportInBao = bag.id === 'BAO15' ? (currentRate > 0 ? total30DayExportRaw / currentRate : 0) : total30DayExportRaw;
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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterType]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const now = new Date();
    let cycleName = 'Tháng';
    let timeRangeStr = '';

    if (filterType === 'TODAY') {
      cycleName = 'Ngày';
      timeRangeStr = format(now, 'dd/MM/yyyy');
    } else if (filterType === 'WEEK') {
      cycleName = 'Tuần';
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      timeRangeStr = `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
    } else if (filterType === 'MONTH') {
      cycleName = 'Tháng';
      timeRangeStr = format(now, 'MM/yyyy');
    } else if (filterType === 'YEAR') {
      cycleName = 'Năm';
      timeRangeStr = format(now, 'yyyy');
    }

    // 1. Primary Sheet: Consolidated double-row structure (pure numeric values for easy copy/paste)
    const excelRows: any[] = [];

    reportData.forEach((item, index) => {
      const w = getBagWeightKg(item.bagTypeId, conversionRate);
      const stockKg = item.currentStock * w;
      const importKg = item.totalImport * w;
      const exportKg = item.totalExport * w;
      const dailyKg = item.avgDailyUsage * w;

      const depletionStatus = item.daysRemaining === null 
        ? 'An toàn' 
        : item.daysRemaining === 0 
          ? 'Hết hàng' 
          : `Còn ~${Math.ceil(item.daysRemaining)} ngày (${item.depletionDate})`;

      // Row 1: Unit = bao
      excelRows.push({
        'STT': index + 1,
        'Tên Loại Bao': item.name,
        'Đơn Vị Tính': 'bao',
        'Tồn Kho': item.currentStock,
        'Nhập Trong Kỳ': item.totalImport,
        'Xuất Trong Kỳ': item.totalExport,
        'TB Sử Dụng/Ngày': Number(item.avgDailyUsage.toFixed(1)),
        'Dự Báo Hết Stock': depletionStatus
      });

      // Row 2: Unit = kg
      excelRows.push({
        'STT': '',
        'Tên Loại Bao': `${item.name} (${w}kg/bao)`,
        'Đơn Vị Tính': 'kg',
        'Tồn Kho': stockKg,
        'Nhập Trong Kỳ': importKg,
        'Xuất Trong Kỳ': exportKg,
        'TB Sử Dụng/Ngày': Number(dailyKg.toFixed(1)),
        'Dự Báo Hết Stock': depletionStatus
      });
    });

    // Total Rows in Excel
    excelRows.push({
      'STT': '',
      'Tên Loại Bao': 'TỔNG CỘNG',
      'Đơn Vị Tính': 'bao',
      'Tồn Kho': totalCurrentStock,
      'Nhập Trong Kỳ': totalPeriodImports,
      'Xuất Trong Kỳ': totalPeriodExports,
      'TB Sử Dụng/Ngày': '',
      'Dự Báo Hết Stock': ''
    });

    excelRows.push({
      'STT': '',
      'Tên Loại Bao': 'TỔNG CỘNG',
      'Đơn Vị Tính': 'kg',
      'Tồn Kho': totalCurrentStockKg,
      'Nhập Trong Kỳ': totalPeriodImportsKg,
      'Xuất Trong Kỳ': totalPeriodExportsKg,
      'TB Sử Dụng/Ngày': '',
      'Dự Báo Hết Stock': ''
    });

    const wsSummary = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "BaoCao_TongHop");

    // 2. Sheet 2: Unit = "bao" only
    const baoRows = reportData.map((item, index) => ({
      'STT': index + 1,
      'Chu kỳ': cycleName,
      'Thời gian': timeRangeStr,
      'Loại Túi': item.name,
      'Đơn Vị Tính': 'bao',
      'Tồn Kho': item.currentStock,
      'Số lượng Nhập': item.totalImport,
      'Số lượng Xuất': item.totalExport,
      'TB Dùng/Ngày': Number(item.avgDailyUsage.toFixed(1))
    }));
    const wsBao = XLSX.utils.json_to_sheet(baoRows);
    XLSX.utils.book_append_sheet(wb, wsBao, "BaoCao_Theo_Bao");

    // 3. Sheet 3: Unit = "kg" only
    const kgRows = reportData.map((item, index) => {
      const w = getBagWeightKg(item.bagTypeId, conversionRate);
      return {
        'STT': index + 1,
        'Chu kỳ': cycleName,
        'Thời gian': timeRangeStr,
        'Loại Túi': item.name,
        'Đơn Vị Tính': 'kg',
        'Tồn Kho': item.currentStock * w,
        'Số lượng Nhập': item.totalImport * w,
        'Số lượng Xuất': item.totalExport * w,
        'TB Dùng/Ngày': Number((item.avgDailyUsage * w).toFixed(1))
      };
    });
    const wsKg = XLSX.utils.json_to_sheet(kgRows);
    XLSX.utils.book_append_sheet(wb, wsKg, "BaoCao_Theo_Kg");

    // 4. Sheet 4: Detailed Transaction Logs (Admin only)
    if (user?.role === 'Admin') {
      const logsData = logs.map(log => ({
        'Thời gian': format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm'),
        'Loại': log.transactionType,
        'Người thực hiện': log.userEmail,
        'Thiết bị': log.deviceInfo
      }));
      const ws2 = XLSX.utils.json_to_sheet(logsData);
      XLSX.utils.book_append_sheet(wb, ws2, "LichSu_ChiTiet");
    }

    XLSX.writeFile(wb, `BaoCao_Xopker_${format(new Date(), 'ddMMyyyy')}.xlsx`);
  };

  // High-level statistics counts for overview cards and report preview
  const getBagWeightKg = (bagTypeId: string, rate: number): number => {
    if (bagTypeId === 'BAO15') return rate || 20;
    return 20;
  };

  const totalPeriodImports = reportData.reduce((sum, item) => sum + item.totalImport, 0);
  const totalPeriodImportsKg = reportData.reduce((sum, item) => sum + (item.totalImport * getBagWeightKg(item.bagTypeId, conversionRate)), 0);

  const totalPeriodExports = reportData.reduce((sum, item) => sum + item.totalExport, 0);
  const totalPeriodExportsKg = reportData.reduce((sum, item) => sum + (item.totalExport * getBagWeightKg(item.bagTypeId, conversionRate)), 0);

  const totalPeriodUsage = reportData.reduce((sum, item) => sum + item.totalUsage, 0);
  const totalPeriodUsageKg = reportData.reduce((sum, item) => sum + (item.totalUsage * getBagWeightKg(item.bagTypeId, conversionRate)), 0);

  const totalCurrentStock = reportData.reduce((sum, item) => sum + item.currentStock, 0);
  const totalCurrentStockKg = reportData.reduce((sum, item) => sum + (item.currentStock * getBagWeightKg(item.bagTypeId, conversionRate)), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 pb-28 sm:pb-8">
      {/* Header Block */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <ClipboardList className="w-5.5 h-5.5 text-indigo-500" /> Báo Cáo & Dự Báo Kho
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">Theo dõi lượng nhập, xuất, sử dụng và dự đoán thời gian hết hàng</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold outline-none focus:border-indigo-500 cursor-pointer text-slate-800 dark:text-slate-100"
          >
            <option value="TODAY">Hôm nay</option>
            <option value="WEEK">Tuần này</option>
            <option value="MONTH">Tháng này</option>
            <option value="YEAR">Năm nay</option>
          </select>
          
          <button 
            onClick={() => setShowPdfPreview(true)} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm cursor-pointer shadow-md active:scale-95"
          >
            <FileText className="w-4 h-4" />
            Xuất Báo Cáo
          </button>
        </div>
      </div>

      {/* Visual Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Nhập (Kỳ lọc)</p>
            <p className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {totalPeriodImports.toLocaleString('vi-VN')} <span className="text-xs font-bold text-emerald-600">bao</span>
              <span className="text-xs font-medium text-slate-400 block sm:inline sm:ml-1.5">(~{totalPeriodImportsKg.toLocaleString('vi-VN')} kg)</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Xuất (Kỳ lọc)</p>
            <p className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {totalPeriodExports.toLocaleString('vi-VN')} <span className="text-xs font-bold text-indigo-600">bao</span>
              <span className="text-xs font-medium text-slate-400 block sm:inline sm:ml-1.5">(~{totalPeriodExportsKg.toLocaleString('vi-VN')} kg)</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Tồn Kho Hiện Tại</p>
            <p className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {totalCurrentStock.toLocaleString('vi-VN')} <span className="text-xs font-bold text-amber-600">bao</span>
              <span className="text-xs font-medium text-slate-400 block sm:inline sm:ml-1.5">(~{totalCurrentStockKg.toLocaleString('vi-VN')} kg)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Analysis and Forecast Board */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/15">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
              <Layers className="w-4.5 h-4.5 text-indigo-500" /> Số Liệu Chi Tiết & Dự Báo Stock
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">Mức sử dụng TB được tính dựa trên dữ liệu 30 ngày qua</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 font-medium text-sm sm:text-base">Đang phân tích số liệu hệ thống...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Loại Bao</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Tồn Kho (Bao / Kg)</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Đã Nhập</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Đã Xuất</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">TB Dùng/Ngày</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Dự Báo Hết Hàng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportData.map(item => {
                  const weightPerBag = getBagWeightKg(item.bagTypeId, conversionRate);
                  const stockKg = item.currentStock * weightPerBag;
                  const importKg = item.totalImport * weightPerBag;
                  const exportKg = item.totalExport * weightPerBag;
                  const avgDailyKg = item.avgDailyUsage * weightPerBag;

                  const isCritical = item.daysRemaining !== null && item.daysRemaining <= 5;
                  const isWarning = item.daysRemaining !== null && item.daysRemaining > 5 && item.daysRemaining <= 15;

                  return (
                    <tr key={item.bagTypeId} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Bag Type Name */}
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white text-sm sm:text-base whitespace-nowrap">
                        {item.name}
                        {item.bagTypeId === 'BAO15' && (
                          <span className="block text-[10px] text-slate-400 font-medium normal-case mt-0.5">Bao 16 ({weightPerBag}kg/bao)</span>
                        )}
                      </td>
                      
                      {/* Current Stock */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-black inline-block",
                          item.currentStock === 0 
                            ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400" 
                            : isCritical 
                              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400" 
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        )}>
                          {item.currentStock.toLocaleString('vi-VN')} bao
                          <span className="text-[10px] font-medium opacity-75 block">({stockKg.toLocaleString('vi-VN')} kg)</span>
                        </span>
                      </td>

                      {/* Total Import in Period */}
                      <td className="py-4 px-4 text-center font-bold text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">
                        {item.totalImport > 0 ? (
                          <div>
                            <span className="text-emerald-600 dark:text-emerald-400">+{item.totalImport.toLocaleString('vi-VN')} bao</span>
                            <span className="block text-[11px] text-slate-400 font-normal">(+{importKg.toLocaleString('vi-VN')} kg)</span>
                          </div>
                        ) : '0'}
                      </td>

                      {/* Total Export in Period */}
                      <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 text-sm whitespace-nowrap">
                        {item.totalExport > 0 ? (
                          <div>
                            <span>-{item.totalExport.toLocaleString('vi-VN')} bao</span>
                            <span className="block text-[11px] text-slate-400 font-normal">(-{exportKg.toLocaleString('vi-VN')} kg)</span>
                          </div>
                        ) : '0'}
                      </td>

                      {/* Average Daily Usage */}
                      <td className="py-4 px-4 text-center text-slate-500 text-sm font-semibold whitespace-nowrap">
                        {item.avgDailyUsage > 0 ? (
                          <div>
                            <span>{item.avgDailyUsage.toFixed(1)} bao/ngày</span>
                            <span className="block text-[11px] text-slate-400 font-normal">(~{avgDailyKg.toFixed(1)} kg/ngày)</span>
                          </div>
                        ) : '0'}
                      </td>

                      {/* Forecast / Predictions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {item.daysRemaining === null ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> An toàn (Vô hạn)
                          </span>
                        ) : item.daysRemaining === 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5" /> Đã hết stock
                          </span>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
                              isCritical 
                                ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400" 
                                : isWarning 
                                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400" 
                                  : "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                            )}>
                              <Clock className="w-3.5 h-3.5" /> Còn ~ {Math.ceil(item.daysRemaining)} ngày
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium mt-1">Dự kiến hết: {item.depletionDate}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF & Excel Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[100] flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-slate-100 dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 relative my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Bar */}
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Xem Trước Báo Cáo
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Kỳ báo cáo: <span className="font-bold text-slate-800 dark:text-slate-200">{getPeriodText()}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Download Excel Option */}
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <FileDown className="w-4 h-4" />
                  Tải Về Excel
                </button>

                {/* Download PDF Option */}
                <button
                  onClick={handleDownloadPdf}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {exportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang Tạo PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Tải Về PDF
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Document Preview Canvas Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-8 bg-slate-200 dark:bg-slate-950 flex justify-center">
              {/* Printable PDF/Excel Document Container (Strictly light/white paper styling for export) */}
              <div 
                ref={pdfRef} 
                className="bg-white text-slate-900 p-6 sm:p-10 w-full max-w-3xl shadow-xl border border-slate-300 rounded-sm font-sans text-xs space-y-6"
                style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                {/* PDF Header Section (Cleaned: No national motto, no department info) */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                      HỆ THỐNG QUẢN LÝ KHO BAO XỐP (XOPKER)
                    </h2>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Báo Cáo Nhập - Xuất - Tồn Kho & Dự Báo Cạn Stock
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-mono font-bold">Mã BC: RPT-{format(new Date(), 'yyyyMMdd-HHmm')}</p>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">Ngày tạo: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>

                {/* Report Main Title */}
                <div className="text-center my-4 space-y-1">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                    BÁO CÁO NHẬP - XUẤT - TỒN KHO & DỰ BÁO CẠN STOCK
                  </h1>
                  <p className="text-xs font-bold text-slate-600">
                    Kỳ Báo Cáo: <span className="text-indigo-700 uppercase">{getPeriodText()}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Người lập báo cáo: <span className="font-semibold text-slate-800">{user?.email || 'Hệ thống'}</span>
                  </p>
                </div>

                {/* Summary Box (KG and Bao) */}
                <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Tổng Nhập Trong Kỳ</span>
                    <span className="text-sm font-black text-emerald-700 block">{totalPeriodImports.toLocaleString('vi-VN')} bao</span>
                    <span className="text-[11px] font-semibold text-emerald-800/80">(~{totalPeriodImportsKg.toLocaleString('vi-VN')} kg)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Tổng Xuất Trong Kỳ</span>
                    <span className="text-sm font-black text-indigo-700 block">{totalPeriodExports.toLocaleString('vi-VN')} bao</span>
                    <span className="text-[11px] font-semibold text-indigo-800/80">(~{totalPeriodExportsKg.toLocaleString('vi-VN')} kg)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Tồn Kho Hiện Tại</span>
                    <span className="text-sm font-black text-amber-700 block">{totalCurrentStock.toLocaleString('vi-VN')} bao</span>
                    <span className="text-[11px] font-semibold text-amber-800/80">(~{totalCurrentStockKg.toLocaleString('vi-VN')} kg)</span>
                  </div>
                </div>

                {/* Detailed Table (Split into 2 rows per bag type: bao & kg with pure numbers for easy copy/paste) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                        <th className="py-2 px-1.5 border-r border-slate-300 text-center w-7">STT</th>
                        <th className="py-2 px-2 border-r border-slate-300">Tên Loại Bao</th>
                        <th className="py-2 px-1.5 border-r border-slate-300 text-center w-14">Đơn Vị</th>
                        <th className="py-2 px-1.5 border-r border-slate-300 text-center">Tồn Kho</th>
                        <th className="py-2 px-1.5 border-r border-slate-300 text-center">Nhập</th>
                        <th className="py-2 px-1.5 border-r border-slate-300 text-center">Xuất</th>
                        <th className="py-2 px-1.5 border-r border-slate-300 text-center">TB Dùng/Ngày</th>
                        <th className="py-2 px-2 text-center">Dự Báo Cạn Kho</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {reportData.map((item, index) => {
                        const w = getBagWeightKg(item.bagTypeId, conversionRate);
                        const stockKg = item.currentStock * w;
                        const importKg = item.totalImport * w;
                        const exportKg = item.totalExport * w;
                        const dailyKg = item.avgDailyUsage * w;

                        return (
                          <React.Fragment key={`pdf-group-${item.bagTypeId}`}>
                            {/* Row 1: Unit = bao */}
                            <tr className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                              <td rowSpan={2} className="py-2 px-1.5 border-r border-b border-slate-300 text-center font-bold align-middle">
                                {index + 1}
                              </td>
                              <td rowSpan={2} className="py-2 px-2 border-r border-b border-slate-300 font-bold text-slate-900 align-middle">
                                {item.name}
                                <span className="block text-[9px] font-normal text-slate-500">({w}kg/bao)</span>
                              </td>
                              <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold text-indigo-700 bg-indigo-50/40">
                                bao
                              </td>
                              <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold text-slate-900">
                                {item.currentStock.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-1.5 px-2 border-r border-slate-300 text-center font-semibold text-emerald-700">
                                {item.totalImport.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-1.5 px-2 border-r border-slate-300 text-center font-semibold text-indigo-700">
                                {item.totalExport.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-700">
                                {item.avgDailyUsage > 0 ? item.avgDailyUsage.toFixed(1) : '0'}
                              </td>
                              <td rowSpan={2} className="py-2 px-2 border-b border-slate-300 text-center font-medium text-[10px] align-middle">
                                {item.daysRemaining === null ? (
                                  <span className="text-emerald-700 font-bold">An toàn</span>
                                ) : item.daysRemaining === 0 ? (
                                  <span className="text-red-700 font-black">HẾT HÀNG</span>
                                ) : (
                                  <span className={item.daysRemaining <= 5 ? 'text-red-600 font-bold' : 'text-slate-700'}>
                                    Còn ~{Math.ceil(item.daysRemaining)} ngày<br />({item.depletionDate})
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* Row 2: Unit = kg */}
                            <tr className={index % 2 === 0 ? 'bg-white/80' : 'bg-slate-50/90'}>
                              <td className="py-1.5 px-2 border-r border-b border-slate-300 text-center font-bold text-amber-700 bg-amber-50/40">
                                kg
                              </td>
                              <td className="py-1.5 px-2 border-r border-b border-slate-300 text-center font-bold text-amber-800">
                                {stockKg.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-1.5 px-2 border-r border-b border-slate-300 text-center text-slate-600">
                                {importKg.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-1.5 px-2 border-r border-b border-slate-300 text-center text-slate-600">
                                {exportKg.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-1.5 px-2 border-r border-b border-slate-300 text-center text-slate-600">
                                {dailyKg > 0 ? dailyKg.toFixed(1) : '0'}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}

                      {/* Total Rows */}
                      <tr className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-400">
                        <td colSpan={2} rowSpan={2} className="py-3 px-2 border-r border-slate-300 text-right uppercase text-[10px] align-middle">
                          TỔNG CỘNG:
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-indigo-900 font-bold">
                          bao
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-900">
                          {totalCurrentStock.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-emerald-800">
                          {totalPeriodImports.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-indigo-800">
                          {totalPeriodExports.toLocaleString('vi-VN')}
                        </td>
                        <td colSpan={2} rowSpan={2} className="py-3 px-2 text-center text-slate-600 italic font-normal text-[10px] align-middle">
                          Tỷ lệ quy đổi tính theo cài đặt hệ thống
                        </td>
                      </tr>
                      <tr className="bg-slate-200 text-slate-900 font-black">
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-amber-900 font-bold">
                          kg
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-amber-900">
                          {totalCurrentStockKg.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-emerald-800">
                          {totalPeriodImportsKg.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-indigo-800">
                          {totalPeriodExportsKg.toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Notes & Signatures */}
                <div className="pt-4 border-t border-slate-300 space-y-6">
                  <p className="text-[10px] text-slate-500 italic">
                    * Ghi chú: Định mức hao hụt trung bình ngày dựa trên số liệu xuất dùng thực tế trong 30 ngày gần nhất. Các ô số liệu chỉ chứa con số thuần túy (không kèm ký tự đơn vị) giúp dễ dàng copy và xử lý dữ liệu Excel.
                  </p>

                  <div className="grid grid-cols-2 gap-8 text-center pt-2">
                    <div>
                      <p className="font-bold text-slate-900 uppercase text-[11px]">NGƯỜI LẬP BÁO CÁO</p>
                      <p className="text-[10px] text-slate-500 italic">(Ký & ghi rõ họ tên)</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800 text-xs">{user?.email || 'Hệ thống'}</p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 uppercase text-[11px]">QUẢN LÝ / GIÁM SÁT KHO</p>
                      <p className="text-[10px] text-slate-500 italic">(Ký & ghi rõ họ tên)</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800 text-xs">Xác nhận của quản lý</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
