import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { BAG_TYPES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { format, isSameDay } from 'date-fns';
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
  Info
} from 'lucide-react';
import { cn } from '../components/Layout';

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
  const isAdmin = user?.role === 'Admin';

  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL'); // ALL, TODAY, THIS_WEEK, THIS_MONTH

  // Modal Detail state
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null);

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

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch from activityLogs
      const activityQ = query(collection(db, 'activityLogs'));
      const activitySnap = await getDocs(activityQ);
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
          notes: d.notes
        };
      });

      // 2. Fetch from exports (to ensure no missing transactions)
      const exportsQ = query(collection(db, 'exports'));
      const exportsSnap = await getDocs(exportsQ);
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
          notes: d.notes
        };
      });

      // 3. Fetch from imports
      const importsQ = query(collection(db, 'imports'));
      const importsSnap = await getDocs(importsQ);
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
          notes: d.notes
        };
      });

      // 4. Fetch from borrowReturns
      const borrowsQ = query(collection(db, 'borrowReturns'));
      const borrowsSnap = await getDocs(borrowsQ);
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
          borrowerId: d.borrowingDepartmentId
        };
      });

      // Merge and deduplicate by close timestamp & type & bagTypeId if duplicate exists
      const allMerged = [...activityData, ...exportsData, ...importsData, ...borrowsData];
      
      // Deduplicate entries with same timestamp + transactionType + userEmail
      const map = new Map<string, UnifiedLog>();
      allMerged.forEach(item => {
        const key = `${Math.floor(item.timestamp / 1000)}_${item.transactionType}_${item.userEmail}_${item.bagTypeId || ''}`;
        if (!map.has(key)) {
          map.set(key, item);
        } else {
          // Merge items list if needed
          const existing = map.get(key)!;
          if (item.deviceInfo && item.deviceInfo !== 'Không có thông tin') {
            existing.deviceInfo = item.deviceInfo;
          }
          if (item.items && item.items.length > 0 && (!existing.items || existing.items.length === 0)) {
            existing.items = item.items;
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
  }, []);

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
    }

    // Search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const typeLabel = TRANSACTION_TYPES[log.transactionType]?.label.toLowerCase() || '';
      const email = log.userEmail.toLowerCase();
      const bagName = getBagName(log.bagTypeId).toLowerCase();
      const device = (log.deviceInfo || '').toLowerCase();

      return email.includes(term) || typeLabel.includes(term) || bagName.includes(term) || (isAdmin && device.includes(term));
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

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:flex-initial min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm email, loại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm outline-none focus:border-amber-500 text-slate-800 dark:text-slate-100 font-medium"
            />
          </div>

          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-amber-500 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <option value="ALL">Tất cả loại giao dịch</option>
            <option value="EXPORT">Xuất Kho</option>
            <option value="IMPORT">Nhập Kho</option>
            <option value="BORROW">Vay Kho</option>
            <option value="RETURN">Trả Kho</option>
            <option value="CHECK">Kiểm Kê</option>
          </select>

          {/* Date filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-amber-500 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <option value="ALL">Tất cả thời gian</option>
            <option value="TODAY">Hôm nay</option>
            <option value="THIS_WEEK">Tuần này</option>
            <option value="THIS_MONTH">Tháng này</option>
          </select>
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
                            return (
                              <span key={`exp-sum-${bag.id}`} className="bg-white/80 dark:bg-black/30 px-1.5 py-0.5 rounded text-[11px]">
                                {bag.name}: <b>{qty} bao</b>
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
                            return (
                              <span key={`imp-sum-${bag.id}`} className="bg-white/80 dark:bg-black/30 px-1.5 py-0.5 rounded text-[11px]">
                                {bag.name}: <b>{qty} bao</b>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 shadow-2xs shrink-0 ml-auto md:ml-2">
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
                                        {item.bagName || item.bagTypeId}: <span className="text-amber-600 dark:text-amber-400">{item.quantity} bao</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : log.bagTypeId ? (
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-bold text-xs">
                                    {getBagName(log.bagTypeId)}: <span className="text-amber-600 dark:text-amber-400">{log.quantity || 0} bao</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">Thao tác hệ thống</span>
                                )}
                              </td>

                              {/* User Email */}
                              <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                                {log.userEmail}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Chi Tiết Nhật Ký</h3>
                <p className="text-xs text-slate-400 font-medium">Mã giao dịch: {selectedLog.id}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              {/* Transaction Type & Time */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Thời Gian</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Loại Giao Dịch</span>
                  <div className="mt-0.5">
                    {(() => {
                      const typeInfo = TRANSACTION_TYPES[selectedLog.transactionType] || { label: selectedLog.transactionType, color: 'text-slate-600', bg: 'bg-slate-100' };
                      return (
                        <span className={cn("inline-block px-2.5 py-0.5 rounded-md font-black text-xs", typeInfo.bg, typeInfo.color)}>
                          {typeInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Items / Bag List */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-2">Những bao xuất/nhập & Số lượng</span>
                {selectedLog.items && selectedLog.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLog.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.bagName || item.bagTypeId}</span>
                        <span className="font-black text-amber-600 dark:text-amber-400 text-sm">{item.quantity} bao</span>
                      </div>
                    ))}
                  </div>
                ) : selectedLog.bagTypeId ? (
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{getBagName(selectedLog.bagTypeId)}</span>
                    <span className="font-black text-amber-600 dark:text-amber-400 text-sm">{selectedLog.quantity || 0} bao</span>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Thao tác hệ thống không kèm sản phẩm bao xốp</p>
                )}
              </div>

              {/* Person in charge / User */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Người Thực Hiện</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{selectedLog.userEmail}</span>
              </div>

              {/* Device Info (ADMIN ONLY) */}
              {isAdmin && (
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Thông Tin Thiết Bị (Chỉ Admin)</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1 break-all bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    {selectedLog.deviceInfo || 'Không có thông tin thiết bị'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-800 dark:bg-slate-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
