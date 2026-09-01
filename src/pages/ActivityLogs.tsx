import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, where } from 'firebase/firestore';
import { BAG_TYPES, formatMainName, DEFAULT_SETTINGS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import { format, isSameDay, differenceInCalendarDays, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { 
  History, 
  Calendar, 
  User, 
  Smartphone, 
  Search, 
  Filter, 
  X, 
  CheckCircle2, 
  Package, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowRightLeft, 
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  Info,
  Download,
  FileSpreadsheet,
  FileText,
  FileDown
} from 'lucide-react';
import { cn } from '../components/Layout';
import { exportActivityLogsExcel } from '../utils/activityLogExport';
import { ActivityLogPdfModal } from '../components/activity/ActivityLogPdfModal';

export const TRANSACTION_TYPES: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  EXPORT: { 
    label: 'Xuất Kho', 
    color: 'text-rose-600 dark:text-rose-400', 
    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50',
    icon: ArrowUpRight
  },
  IMPORT: { 
    label: 'Nhập Kho', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50',
    icon: ArrowDownLeft
  },
  BORROW: { 
    label: 'Vay Kho', 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
    icon: ArrowRightLeft
  },
  RETURN: { 
    label: 'Trả Kho', 
    color: 'text-teal-600 dark:text-teal-400', 
    bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/50',
    icon: CheckCircle2
  },
  CHECK: { 
    label: 'Kiểm Kê', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/50',
    icon: ClipboardCheck
  },
  STOCK_CHECK: { 
    label: 'Kiểm Kê', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/50',
    icon: ClipboardCheck
  },
  SETTINGS: { 
    label: 'Cài Đặt', 
    color: 'text-slate-600 dark:text-slate-400', 
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    icon: Info
  },
  USER_MANAGEMENT: { 
    label: 'Quản Lý User', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/50',
    icon: User
  },
};

export interface UnifiedLog {
  id: string;
  timestamp: number;
  transactionType: string;
  userEmail: string;
  deviceInfo?: string;
  bagTypeId?: string;
  quantity?: number;
  items?: { bagTypeId: string; bagName: string; quantity: number; unit: string }[];
  beforeData?: any;
  afterData?: any;
  notes?: string;
  lenderId?: string;
  borrowerId?: string;
}

export const ActivityLogs: React.FC = () => {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const isAdmin = user?.role === 'Admin';

  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [conversionRate, setConversionRate] = useState<number>(DEFAULT_SETTINGS.bao15ConversionRate);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL'); // ALL, TODAY, THIS_WEEK, THIS_MONTH, THIS_YEAR, CUSTOM
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-01'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Modal Detail state
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Accordion state for day sections
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDay = (dayStr: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayStr]: !prev[dayStr]
    }));
  };

  const getBagName = (id?: string) => {
    if (!id) return '';
    return BAG_TYPES.find(b => b.id === id)?.name || id;
  };

  const formatQuantity = (
    bagTypeId?: string,
    qty?: number,
    transactionType?: string,
    unitHint?: string
  ) => {
    if (!bagTypeId || qty === undefined || qty === null) return '0 bao';
    if (bagTypeId !== 'BAO15') return `${qty} bao`;

    const rate = conversionRate || 20;
    const isExportOrBorrowOrKg = transactionType === 'EXPORT' || transactionType === 'BORROW' || unitHint === 'kg';
    if (isExportOrBorrowOrKg) {
      const inBao = Number((qty / rate).toFixed(2));
      return `${qty} kg (${inBao} bao)`;
    } else {
      const inKg = qty * rate;
      return `${qty} bao (${inKg} kg)`;
    }
  };

  const getUserDisplayName = (email: string) => {
    if (!email) return 'Hệ thống';
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === 'hệ thống' || cleanEmail === 'he thong') return 'Hệ thống';
    
    const fullNameOrEmail = (userMap[cleanEmail] && userMap[cleanEmail] !== 'Chưa đăng nhập')
      ? userMap[cleanEmail]
      : email;

    return formatMainName(fullNameOrEmail);
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        const demoLogs = demoStore.getActivityLogs();
        demoLogs.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(demoLogs as any);
        setLoading(false);
        return;
      }
      // 0. Fetch user map for display names & conversion rate
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists() && settingsSnap.data().bao15ConversionRate) {
          setConversionRate(settingsSnap.data().bao15ConversionRate);
        }

        const userSnap = await getDocs(collection(db, 'users'));
        const uMap: Record<string, string> = {};
        userSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.email) {
            const emailKey = d.email.trim().toLowerCase();
            if (d.displayName && d.displayName !== 'Chưa đăng nhập') {
              uMap[emailKey] = d.displayName;
            }
          }
        });
        setUserMap(uMap);
      } catch (err) {
        console.error("Error fetching settings/users map:", err);
      }

      // 1. Determine timestamp constraints based on dateFilter
      let startTimestamp: number | null = null;
      let endTimestamp: number | null = null;
      const now = new Date();

      if (dateFilter === 'TODAY') {
        const s = new Date(); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setHours(23, 59, 59, 999);
        startTimestamp = s.getTime();
        endTimestamp = e.getTime();
      } else if (dateFilter === 'THIS_WEEK') {
        const s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setHours(23, 59, 59, 999);
        startTimestamp = s.getTime();
        endTimestamp = e.getTime();
      } else if (dateFilter === 'THIS_MONTH') {
        const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startTimestamp = s.getTime();
        endTimestamp = e.getTime();
      } else if (dateFilter === 'THIS_YEAR') {
        const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        startTimestamp = s.getTime();
        endTimestamp = e.getTime();
      } else if (dateFilter === 'CUSTOM') {
        if (customStartDate) {
          const s = new Date(customStartDate); s.setHours(0, 0, 0, 0);
          startTimestamp = s.getTime();
        }
        if (customEndDate) {
          const e = new Date(customEndDate); e.setHours(23, 59, 59, 999);
          endTimestamp = e.getTime();
        }
      }

      const buildRangeQuery = (collName: string) => {
        const constraints: any[] = [];
        if (startTimestamp !== null) {
          constraints.push(where('timestamp', '>=', startTimestamp));
        }
        if (endTimestamp !== null) {
          constraints.push(where('timestamp', '<=', endTimestamp));
        }
        constraints.push(orderBy('timestamp', 'desc'));
        if (startTimestamp === null && endTimestamp === null) {
          constraints.push(limit(150));
        }
        return query(collection(db, collName), ...constraints);
      };

      // 1. Fetch from activityLogs
      const activitySnap = await getDocs(buildRangeQuery('activityLogs'));
      const activityData: UnifiedLog[] = activitySnap.docs.map(docSnap => {
        const d = docSnap.data();
        let items: { bagTypeId: string; bagName: string; quantity: number; unit: string }[] = [];

        if (d.bagTypeId && d.quantity !== undefined) {
          items.push({
            bagTypeId: d.bagTypeId,
            bagName: getBagName(d.bagTypeId),
            quantity: Math.abs(d.quantity),
            unit: 'bao'
          });
        } else if (d.beforeData && d.afterData) {
          // Calculate diff if available
          const diff = (d.afterData.quantity || 0) - (d.beforeData.quantity || 0);
          if (d.bagTypeId) {
            items.push({
              bagTypeId: d.bagTypeId,
              bagName: getBagName(d.bagTypeId),
              quantity: Math.abs(diff),
              unit: 'bao'
            });
          }
        }

        return {
          id: docSnap.id,
          timestamp: d.timestamp || Date.now(),
          transactionType: d.transactionType || 'EXPORT',
          userEmail: d.userEmail || 'Hệ thống',
          deviceInfo: d.deviceInfo || 'Không có thông tin',
          bagTypeId: d.bagTypeId,
          quantity: d.quantity,
          items,
          beforeData: d.beforeData,
          afterData: d.afterData,
          notes: d.notes,
          conversionRateAtTime: d.conversionRateAtTime
        };
      });

      // 2. Fetch from exports
      const exportsSnap = await getDocs(buildRangeQuery('exports'));
      const exportsData: UnifiedLog[] = exportsSnap.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: `exp_${docSnap.id}`,
          timestamp: d.timestamp || Date.now(),
          transactionType: 'EXPORT',
          userEmail: d.userEmail || 'Hệ thống',
          deviceInfo: d.deviceInfo || 'Không có thông tin',
          bagTypeId: d.bagTypeId,
          quantity: d.quantity,
          items: [{
            bagTypeId: d.bagTypeId,
            bagName: getBagName(d.bagTypeId),
            quantity: d.quantity || 0,
            unit: d.bagTypeId === 'BAO15' ? 'kg' : 'bao'
          }],
          notes: d.notes,
          conversionRateAtTime: d.conversionRateAtTime
        };
      });

      // 3. Fetch from imports
      const importsSnap = await getDocs(buildRangeQuery('imports'));
      const importsData: UnifiedLog[] = importsSnap.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: `imp_${docSnap.id}`,
          timestamp: d.timestamp || Date.now(),
          transactionType: 'IMPORT',
          userEmail: d.userEmail || 'Hệ thống',
          deviceInfo: d.deviceInfo || 'Không có thông tin',
          bagTypeId: d.bagTypeId,
          quantity: d.quantity,
          items: [{
            bagTypeId: d.bagTypeId,
            bagName: getBagName(d.bagTypeId),
            quantity: d.quantity || 0,
            unit: 'bao'
          }],
          notes: d.notes,
          conversionRateAtTime: d.conversionRateAtTime
        };
      });

      // 4. Fetch from borrowReturns
      const borrowsSnap = await getDocs(buildRangeQuery('borrowReturns'));
      const borrowsData: UnifiedLog[] = borrowsSnap.docs.map(docSnap => {
        const d = docSnap.data();
        const type = d.quantityReturned && d.quantityReturned > 0 ? 'RETURN' : 'BORROW';
        const qty = type === 'RETURN' ? d.quantityReturned : d.quantityBorrowed;
        return {
          id: `bor_${docSnap.id}`,
          timestamp: d.timestamp || Date.now(),
          transactionType: type,
          userEmail: d.createdByEmail || d.userEmail || 'Hệ thống',
          deviceInfo: 'Không có thông tin',
          bagTypeId: d.bagTypeId,
          quantity: qty,
          items: [{
            bagTypeId: d.bagTypeId,
            bagName: getBagName(d.bagTypeId),
            quantity: qty || 0,
            unit: 'bao'
          }],
          lenderId: d.lendingDepartmentId,
          borrowerId: d.borrowingDepartmentId,
          conversionRateAtTime: d.conversionRateAtTime
        };
      });

      // Merge and deduplicate records intelligently
      // Primary transaction records (from imports, exports, borrowReturns) carry the user-selected timestamp
      const primaryList = [...importsData, ...exportsData, ...borrowsData];
      const map = new Map<string, UnifiedLog>();
      const matchedPrimaryIds = new Set<string>();

      // 1. Add all primary records first
      primaryList.forEach(p => {
        const key = `${Math.floor(p.timestamp / 1000)}_${p.transactionType}_${p.userEmail}_${p.bagTypeId || ''}`;
        map.set(key, p);
      });

      // 2. Process activityData entries
      activityData.forEach(act => {
        const exactKey = `${Math.floor(act.timestamp / 1000)}_${act.transactionType}_${act.userEmail}_${act.bagTypeId || ''}`;
        if (map.has(exactKey)) {
          // Exact timestamp match
          const existing = map.get(exactKey)!;
          if (act.deviceInfo && act.deviceInfo !== 'Không có thông tin') {
            existing.deviceInfo = act.deviceInfo;
          }
          if (act.beforeData) existing.beforeData = act.beforeData;
          if (act.afterData) existing.afterData = act.afterData;
          if (act.notes) existing.notes = act.notes;
        } else {
          // Look for an unmatched primary record with identical transaction details
          const matchedPrimary = primaryList.find(p => 
            !matchedPrimaryIds.has(p.id) &&
            p.transactionType === act.transactionType &&
            p.userEmail === act.userEmail &&
            p.bagTypeId === act.bagTypeId &&
            p.quantity === act.quantity
          );

          if (matchedPrimary) {
            // Merge activity log info into primary transaction
            matchedPrimaryIds.add(matchedPrimary.id);
            if (act.deviceInfo && act.deviceInfo !== 'Không có thông tin') {
              matchedPrimary.deviceInfo = act.deviceInfo;
            }
            if (act.beforeData) matchedPrimary.beforeData = act.beforeData;
            if (act.afterData) matchedPrimary.afterData = act.afterData;
            if (act.notes) matchedPrimary.notes = act.notes;
          } else {
            // Independent activity log (e.g., settings, login, stock check, etc.)
            map.set(exactKey, act);
          }
        }
      });

      const result = Array.from(map.values());
      result.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(result);

    } catch (e) {
      console.error('Error fetching logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [dateFilter, customStartDate, customEndDate]);

  // Filter logic
  const filteredLogs = logs.filter(log => {
    // Type filter
    if (selectedType !== 'ALL' && log.transactionType !== selectedType) {
      return false;
    }

    // Date filter
    const logDate = new Date(log.timestamp);
    const now = new Date();

    if (dateFilter === 'TODAY') {
      if (!isSameDay(logDate, now)) return false;
    } else if (dateFilter === 'THIS_WEEK') {
      const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      if (log.timestamp < oneWeekAgo) return false;
    } else if (dateFilter === 'THIS_MONTH') {
      if (logDate.getMonth() !== now.getMonth() || logDate.getFullYear() !== now.getFullYear()) {
        return false;
      }
    } else if (dateFilter === 'THIS_YEAR') {
      if (logDate.getFullYear() !== now.getFullYear()) return false;
    } else if (dateFilter === 'CUSTOM') {
      if (customStartDate) {
        const sDate = new Date(customStartDate);
        sDate.setHours(0, 0, 0, 0);
        if (log.timestamp < sDate.getTime()) return false;
      }
      if (customEndDate) {
        const eDate = new Date(customEndDate);
        eDate.setHours(23, 59, 59, 999);
        if (log.timestamp > eDate.getTime()) return false;
      }
    }

    // Search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const typeLabel = TRANSACTION_TYPES[log.transactionType]?.label.toLowerCase() || '';
      const email = log.userEmail.toLowerCase();
      const userName = getUserDisplayName(log.userEmail).toLowerCase();
      const bagName = getBagName(log.bagTypeId).toLowerCase();
      const device = (log.deviceInfo || '').toLowerCase();

      return email.includes(term) || userName.includes(term) || typeLabel.includes(term) || bagName.includes(term) || (isAdmin && device.includes(term));
    }

    return true;
  });

  // Group logs by Date (formatted string "dd/MM/yyyy")
  const groupedByDay = filteredLogs.reduce((acc, log) => {
    const dayStr = format(new Date(log.timestamp), 'dd/MM/yyyy');
    if (!acc[dayStr]) {
      acc[dayStr] = [];
    }
    acc[dayStr].push(log);
    return acc;
  }, {} as Record<string, UnifiedLog[]>);

  // Helper to compute daily totals for a day's logs
  const calculateDaySummary = (dayLogs: UnifiedLog[]) => {
    const exportsByBag: Record<string, number> = {};
    const importsByBag: Record<string, number> = {};
    BAG_TYPES.forEach(b => {
      exportsByBag[b.id] = 0;
      importsByBag[b.id] = 0;
    });

    let totalExportsCount = 0;
    let totalImportsCount = 0;

    dayLogs.forEach(log => {
      const isExportType = log.transactionType === 'EXPORT' || log.transactionType === 'BORROW';
      const isImportType = log.transactionType === 'IMPORT' || log.transactionType === 'RETURN';

      if (log.items && log.items.length > 0) {
        log.items.forEach(item => {
          if (isExportType) {
            exportsByBag[item.bagTypeId] = (exportsByBag[item.bagTypeId] || 0) + item.quantity;
            totalExportsCount += item.quantity;
          } else if (isImportType) {
            importsByBag[item.bagTypeId] = (importsByBag[item.bagTypeId] || 0) + item.quantity;
            totalImportsCount += item.quantity;
          }
        });
      } else if (log.bagTypeId && log.quantity) {
        if (isExportType) {
          exportsByBag[log.bagTypeId] = (exportsByBag[log.bagTypeId] || 0) + log.quantity;
          totalExportsCount += log.quantity;
        } else if (isImportType) {
          importsByBag[log.bagTypeId] = (importsByBag[log.bagTypeId] || 0) + log.quantity;
          totalImportsCount += log.quantity;
        }
      }
    });

    return {
      exportsByBag,
      importsByBag,
      totalExportsCount,
      totalImportsCount,
      totalLogsCount: dayLogs.length
    };
  };

  const handleDownloadExcel = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast.error('Không có dữ liệu nhật ký phù hợp để tải xuống');
      return;
    }

    try {
      exportActivityLogsExcel({
        logs: filteredLogs,
        dateFilter,
        customStartDate,
        customEndDate,
        selectedType,
        conversionRate,
        getUserDisplayName
      });
      toast.success('Đã xuất file nhật ký thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất file nhật ký:', err);
      toast.error('Có lỗi xảy ra khi tải file nhật ký');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 pb-28 sm:pb-8">
      {/* Header Block */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase flex items-center gap-2.5">
            <History className="w-6 h-6 text-amber-500" /> Lịch Sử Nhật Ký Hoạt Động
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Theo dõi chi tiết tất cả giao dịch kho, thao tác xuất nhập và hoạt động hệ thống
          </p>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download PDF Button */}
          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-full shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
            title="Tải xuống báo cáo Nhật ký định dạng PDF với giao diện thiết kế giống trang Nhật Ký"
          >
            <FileDown className="w-4 h-4" />
            <span>Tải Báo Cáo PDF</span>
          </button>

          {/* Download Excel Button */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-full shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
            title="Tải file Excel nhật ký giao dịch và tổng số lượng các loại bao"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Tải Excel ({filteredLogs.length})</span>
          </button>

          {/* Search box */}
          <div className="relative flex-1 sm:flex-initial min-w-[200px]">
            <Search className="w-4 h-4 text-sky-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm email, loại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/70 dark:bg-slate-800/70 border border-sky-400/30 rounded-full text-xs sm:text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 text-slate-800 dark:text-slate-100 font-medium backdrop-blur-md transition-all shadow-xs"
            />
          </div>

          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white/70 dark:bg-slate-800/70 border border-sky-400/40 rounded-full px-4 py-2.5 text-xs sm:text-sm font-bold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 text-slate-800 dark:text-slate-100 cursor-pointer backdrop-blur-md shadow-xs transition-all"
          >
            <option value="ALL">Tất cả loại giao dịch</option>
            <option value="EXPORT">Xuất Kho</option>
            <option value="IMPORT">Nhập Kho</option>
            <option value="BORROW">Vay Kho</option>
            <option value="RETURN">Trả Kho</option>
            <option value="CHECK">Kiểm Kê</option>
          </select>

          {/* Date filter */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white/70 dark:bg-slate-800/70 border border-sky-400/40 rounded-full px-4 py-2.5 text-xs sm:text-sm font-bold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 text-slate-800 dark:text-slate-100 cursor-pointer backdrop-blur-md shadow-xs transition-all"
            >
              <option value="ALL">Tất cả thời gian</option>
              <option value="TODAY">Hôm nay</option>
              <option value="THIS_WEEK">Tuần này</option>
              <option value="THIS_MONTH">Tháng này</option>
              <option value="THIS_YEAR">Năm nay</option>
              <option value="CUSTOM">📅 Tùy chọn khoảng thời gian</option>
            </select>

            {dateFilter === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-2 bg-indigo-50/90 dark:bg-indigo-950/50 p-1.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 shadow-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase px-1">Từ</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setCustomStartDate(newStart);
                      if (newStart && customEndDate) {
                        const s = new Date(newStart);
                        const eDate = new Date(customEndDate);
                        if (!isNaN(s.getTime()) && !isNaN(eDate.getTime())) {
                          if (eDate < s) {
                            setCustomEndDate(newStart);
                          } else if (differenceInCalendarDays(eDate, s) > 30) {
                            toast.error('Khoảng thời gian tối đa lựa chọn là 31 ngày');
                            setCustomEndDate(format(addDays(s, 30), 'yyyy-MM-dd'));
                          }
                        }
                      }
                    }}
                    className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase px-1">Đến</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      if (customStartDate && newEnd) {
                        const s = new Date(customStartDate);
                        const eDate = new Date(newEnd);
                        if (!isNaN(s.getTime()) && !isNaN(eDate.getTime())) {
                          if (eDate < s) {
                            toast.error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
                            setCustomEndDate(customStartDate);
                            return;
                          }
                          if (differenceInCalendarDays(eDate, s) > 30) {
                            toast.error('Khoảng thời gian tối đa lựa chọn là 31 ngày');
                            setCustomEndDate(format(addDays(s, 30), 'yyyy-MM-dd'));
                            return;
                          }
                        }
                      }
                      setCustomEndDate(newEnd);
                    }}
                    className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold px-1 hidden sm:inline">(Tối đa 31 ngày)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Activity Log Grouped List */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-500 font-medium border border-slate-200 dark:border-slate-800">
            <History className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            Đang tải nhật ký hoạt động hệ thống...
          </div>
        ) : Object.keys(groupedByDay).length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-500 font-medium border border-slate-200 dark:border-slate-800">
            Không tìm thấy dữ liệu nhật ký phù hợp với bộ lọc
          </div>
        ) : (
          (Object.entries(groupedByDay) as [string, UnifiedLog[]][]).map(([dayStr, dayLogs]) => {
            const summary = calculateDaySummary(dayLogs);
            const isExpanded = !!expandedDays[dayStr];

            return (
              <div key={dayStr} className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
                {/* Day Summary Header (Clickable to Expand/Collapse) */}
                <div 
                  onClick={() => toggleDay(dayStr)}
                  className="p-4 sm:p-5 cursor-pointer bg-slate-50/80 dark:bg-slate-800/30 hover:bg-amber-50/50 dark:hover:bg-slate-800/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-amber-500 shrink-0" />
                    <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Ngày {dayStr}
                    </h3>
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/50">
                      Tổng {summary.totalLogsCount} giao dịch
                    </span>
                  </div>

                  {/* Summary Pills of Imported / Exported bags */}
                  <div className="flex flex-wrap items-center gap-2">
                    {summary.totalExportsCount > 0 && (
                      <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 px-3 py-1 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5">
                        <span className="text-rose-600 dark:text-rose-400">Xuất:</span>
                        <div className="flex flex-wrap gap-1">
                          {BAG_TYPES.map(bag => {
                            const qty = summary.exportsByBag[bag.id];
                            if (!qty || qty <= 0) return null;
                            const isBao15 = bag.id === 'BAO15';
                            const displayStr = isBao15 
                              ? `${qty} kg (${Number((qty / conversionRate).toFixed(2))} bao)` 
                              : `${qty} bao`;
                            return (
                              <span key={`exp-sum-${bag.id}`} className="bg-white/80 dark:bg-black/30 px-1.5 py-0.5 rounded text-[11px]">
                                {bag.name}: <b>{displayStr}</b>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {summary.totalImportsCount > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 px-3 py-1 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1.5">
                        <span className="text-emerald-600 dark:text-emerald-400">Nhập:</span>
                        <div className="flex flex-wrap gap-1">
                          {BAG_TYPES.map(bag => {
                            const qty = summary.importsByBag[bag.id];
                            if (!qty || qty <= 0) return null;
                            const isBao15 = bag.id === 'BAO15';
                            const displayStr = isBao15 
                              ? `${qty} bao (${qty * conversionRate} kg)` 
                              : `${qty} bao`;
                            return (
                              <span key={`imp-sum-${bag.id}`} className="bg-white/80 dark:bg-black/30 px-1.5 py-0.5 rounded text-[11px]">
                                {bag.name}: <b>{displayStr}</b>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportActivityLogsExcel({
                          logs: dayLogs,
                          dateFilter: 'CUSTOM',
                          customStartDate: format(new Date(dayLogs[0].timestamp), 'yyyy-MM-dd'),
                          customEndDate: format(new Date(dayLogs[0].timestamp), 'yyyy-MM-dd'),
                          selectedType,
                          conversionRate,
                          getUserDisplayName
                        });
                        toast.success(`Đã tải nhật ký ngày ${dayStr}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0 ml-auto md:ml-2"
                      title="Tải file Excel nhật ký ngày này"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tải Ngày {dayStr}</span>
                    </button>

                    <div className="flex items-center gap-1.5 text-xs font-black text-sky-600 dark:text-sky-300 bg-gradient-to-r from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 px-4 py-2 rounded-full border border-sky-400/50 shadow-md backdrop-blur-md shrink-0 transition-all duration-300 hover:border-sky-400 group-hover:scale-102">
                      <span>{isExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Table of logs for the day */}
                {isExpanded && (
                  <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800">
                          <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thời Gian</th>
                          <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Loại Giao Dịch</th>
                          <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chi Tiết Sản Phẩm</th>
                          <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Người Thực Hiện</th>
                          {/* Device Info column: ONLY FOR ADMIN */}
                          {isAdmin && (
                            <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thông Tin Thiết Bị</th>
                          )}
                          <th className="py-3 px-4 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dayLogs.map((log) => {
                          const typeInfo = TRANSACTION_TYPES[log.transactionType] || {
                            label: log.transactionType,
                            color: 'text-slate-600',
                            bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200',
                            icon: Info
                          };
                          const IconComp = typeInfo.icon;

                          return (
                            <tr
                              key={log.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer group"
                            >
                              {/* Timestamp */}
                              <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm whitespace-nowrap">
                                {format(new Date(log.timestamp), 'HH:mm:ss')}
                              </td>

                              {/* Transaction Type Badge in Vietnamese */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-xs border shadow-2xs",
                                  typeInfo.bg,
                                  typeInfo.color
                                )}>
                                  <IconComp className="w-3.5 h-3.5" />
                                  {typeInfo.label}
                                </span>
                              </td>

                              {/* Product Bag Details */}
                              <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                                {log.items && log.items.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {log.items.map((item, idx) => (
                                      <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-bold text-xs">
                                        {item.bagName || item.bagTypeId}: <span className="text-amber-600 dark:text-amber-400">{formatQuantity(item.bagTypeId, item.quantity, log.transactionType, item.unit)}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : log.bagTypeId ? (
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-bold text-xs">
                                    {getBagName(log.bagTypeId)}: <span className="text-amber-600 dark:text-amber-400">{formatQuantity(log.bagTypeId, log.quantity || 0, log.transactionType)}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">Thao tác hệ thống</span>
                                )}
                              </td>

                              {/* User Email / Display Name */}
                              <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm whitespace-nowrap">
                                {getUserDisplayName(log.userEmail)}
                              </td>

                              {/* Device Info (Admin ONLY) */}
                              {isAdmin && (
                                <td className="py-3.5 px-4 text-slate-400 text-xs max-w-[180px] truncate" title={log.deviceInfo}>
                                  {log.deviceInfo || 'Không có thông tin'}
                                </td>
                              )}

                              {/* Action Arrow */}
                              <td className="py-3.5 px-4 text-right">
                                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors inline-block" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Detailed Transaction Modal (Open on Row Click) */}
      {selectedLog && (
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-amber-500/30 dark:border-amber-500/25 relative animate-in zoom-in-95 duration-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Banner */}
            <div className="flex items-center gap-3.5 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/30 shadow-lg shadow-amber-500/10 backdrop-blur-md">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Chi Tiết Nhật Ký</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">Mã giao dịch: <span className="font-mono text-amber-600 dark:text-amber-400">{selectedLog.id}</span></p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              {/* Transaction Type & Time Banner */}
              <div className="grid grid-cols-2 gap-3 bg-white/60 dark:bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-extrabold block tracking-wider">Thời Gian</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 mt-1 block">
                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-extrabold block tracking-wider">Loại Giao Dịch</span>
                  <div className="mt-1">
                    {(() => {
                      const typeInfo = TRANSACTION_TYPES[selectedLog.transactionType] || { label: selectedLog.transactionType, color: 'text-slate-600', bg: 'bg-slate-100' };
                      return (
                        <span className={cn("inline-block px-3 py-1 rounded-full font-black text-xs shadow-2xs border border-amber-400/30", typeInfo.bg, typeInfo.color)}>
                          {typeInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Items / Bag List Banner */}
              <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs">
                <span className="text-slate-400 text-[10px] uppercase font-extrabold block mb-2.5 tracking-wider">Danh Sách Bao & Số Lượng</span>
                {selectedLog.items && selectedLog.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLog.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-2xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.bagName || item.bagTypeId}</span>
                        <span className="font-black text-amber-600 dark:text-amber-400 text-sm">{formatQuantity(item.bagTypeId, item.quantity, selectedLog.transactionType, item.unit)}</span>
                      </div>
                    ))}
                  </div>
                ) : selectedLog.bagTypeId ? (
                  <div className="flex justify-between items-center bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-2xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{getBagName(selectedLog.bagTypeId)}</span>
                    <span className="font-black text-amber-600 dark:text-amber-400 text-sm">{formatQuantity(selectedLog.bagTypeId, selectedLog.quantity || 0, selectedLog.transactionType)}</span>
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-xs font-medium">Thao tác hệ thống không kèm sản phẩm bao xốp</p>
                )}
              </div>

              {/* Person in charge / User Banner */}
              <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs">
                <span className="text-slate-400 text-[10px] uppercase font-extrabold block tracking-wider">Người Thực Hiện</span>
                <span className="font-black text-slate-900 dark:text-white text-sm mt-0.5 block">{getUserDisplayName(selectedLog.userEmail)}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mt-0.5">{selectedLog.userEmail}</span>
              </div>

              {/* Device Info (ADMIN ONLY) Banner */}
              {isAdmin && (
                <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs">
                  <span className="text-slate-400 text-[10px] uppercase font-extrabold block tracking-wider">Thông Tin Thiết Bị (Chỉ Admin)</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-1.5 break-all bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md">
                    {selectedLog.deviceInfo || 'Không có thông tin thiết bị'}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black px-7 py-3 rounded-full text-xs sm:text-sm shadow-lg shadow-amber-500/20 border border-amber-300/30 backdrop-blur-md transition-all cursor-pointer active:scale-95"
              >
                ĐÓNG CỬA SỔ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log PDF Modal Preview & Download */}
      {showPdfModal && (
        <ActivityLogPdfModal
          logs={filteredLogs}
          dateFilter={dateFilter}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          selectedType={selectedType}
          conversionRate={conversionRate}
          user={user}
          getUserDisplayName={getUserDisplayName}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
};
