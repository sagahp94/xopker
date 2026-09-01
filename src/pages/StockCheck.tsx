import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction, getDocs, query, getDoc, writeBatch, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import toast from 'react-hot-toast';
import { cn } from '../components/Layout';
import { 
  RefreshCcw, 
  Lock, 
  Unlock, 
  Calendar, 
  AlertCircle, 
  History, 
  User, 
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';

interface StockState {
  systemQty: number;
  actualQty: string;
}

export const StockCheck: React.FC = () => {
  const { user } = useAuth();
  const { isDemoMode, notifyDemoChange } = useDemo();
  const [departmentId] = useState(SYSTEM_DEPARTMENTS[0].id);
  const [stocks, setStocks] = useState<Record<BagTypeID, StockState>>({
    BAO15: { systemQty: 0, actualQty: '' },
    BAO20: { systemQty: 0, actualQty: '' },
    BAO25: { systemQty: 0, actualQty: '' },
    BAO30: { systemQty: 0, actualQty: '' },
    BAO37: { systemQty: 0, actualQty: '' },
  });
  const [conversionRate, setConversionRate] = useState(DEFAULT_SETTINGS.bao15ConversionRate);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<BagTypeID | null>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Date check
  const today = new Date();
  const STOCK_CHECK_DAYS = [1, 19, 20, 21];
  const isStockCheckDay = STOCK_CHECK_DAYS.includes(today.getDate());
  const [bypassDateCheck, setBypassDateCheck] = useState(false);
  const [showBypassConfirm, setShowBypassConfirm] = useState(false);

  // Admin Hidden Menu States
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'INIT' | 'RESET'>('INIT');
  
  // Reset state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetClearHistory, setResetClearHistory] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Init state
  const [initValues, setInitValues] = useState<Record<BagTypeID, string>>({
    BAO15: '0',
    BAO20: '0',
    BAO25: '0',
    BAO30: '0',
    BAO37: '0',
  });
  const [initDate, setInitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [initClearHistory, setInitClearHistory] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const isAdjustAllowed = isStockCheckDay || (bypassDateCheck && (user?.role === 'Admin' || user?.role === 'Manager'));

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getBagName = (id: string) => {
    return BAG_TYPES.find(b => b.id === id)?.name || id;
  };

  const fetchSystemStocks = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        const demoStocks = demoStore.getStocks();
        const demoSettings = demoStore.getSettings();
        setConversionRate(demoSettings.bao15ConversionRate || DEFAULT_SETTINGS.bao15ConversionRate);
        const newStocks = { ...stocks };
        BAG_TYPES.forEach(b => {
          newStocks[b.id].systemQty = demoStocks[b.id] || 0;
        });
        setStocks(newStocks);
        setLoading(false);
        return;
      }

      // Get global settings for conversion rate
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      let currentRate = DEFAULT_SETTINGS.bao15ConversionRate;
      if (settingsDoc.exists()) {
        currentRate = settingsDoc.data().bao15ConversionRate || currentRate;
        setConversionRate(currentRate);
      }

      // Fetch inventory documents for direct department ID
      const snap = await getDocs(collection(db, 'inventory'));
      
      const newStocks = { ...stocks };
      // Reset system qty first
      Object.keys(newStocks).forEach(k => {
        newStocks[k as BagTypeID].systemQty = 0;
      });

      snap.forEach(d => {
        const data = d.data();
        if (data.departmentId === departmentId && data.bagTypeId && newStocks[data.bagTypeId as BagTypeID]) {
          const qty = data.quantity || 0;
          newStocks[data.bagTypeId as BagTypeID].systemQty = qty;
        }
      });
      
      setStocks(newStocks);
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu tồn kho');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      if (isDemoMode) {
        setHistory(demoStore.getStockChecks());
        setLoadingHistory(false);
        return;
      }

      const q = query(collection(db, 'stockChecks'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });

      // Filtering for Staff vs. Admin/Manager
      if (user?.role === 'Staff') {
        if (list.length > 0) {
          // Get the latest check's date
          const latestDate = new Date(list[0].timestamp);
          const latestDateStr = `${latestDate.getDate()}/${latestDate.getMonth() + 1}/${latestDate.getFullYear()}`;
          
          const filtered = list.filter(item => {
            const itemDate = new Date(item.timestamp);
            const itemDateStr = `${itemDate.getDate()}/${itemDate.getMonth() + 1}/${itemDate.getFullYear()}`;
            return itemDateStr === latestDateStr;
          });
          setHistory(filtered);
        } else {
          setHistory([]);
        }
      } else {
        // Manager and Admin see all history
        setHistory(list);
      }
    } catch (error) {
      console.error('Error fetching stock check history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSystemStocks();
    fetchHistory();
  }, [departmentId, user, isDemoMode]);

  const handleActualChange = (bagId: BagTypeID, value: string) => {
    setStocks(prev => ({
      ...prev,
      [bagId]: { ...prev[bagId], actualQty: value }
    }));
  };

  const handleAdjust = async (bagId: BagTypeID) => {
    if (!isAdjustAllowed) {
      toast.error('Chưa đến kỳ kiểm kê (chỉ khả dụng vào ngày 1, 19, 20, 21 hàng tháng)');
      return;
    }

    const actualInBao = Number(stocks[bagId].actualQty);
    if (stocks[bagId].actualQty === '' || isNaN(actualInBao) || actualInBao < 0) {
      toast.error('Vui lòng nhập số lượng thực tế hợp lệ');
      return;
    }

    if (actualInBao === stocks[bagId].systemQty) {
      toast.success('Tồn kho đã khớp, không cần điều chỉnh');
      return;
    }

    setIsSubmitting(bagId);
    try {
      if (isDemoMode) {
        demoStore.stockCheckAdjust(bagId, actualInBao, user);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Điều chỉnh tồn kho thành công!');
        setStocks(prev => ({
          ...prev,
          [bagId]: { systemQty: actualInBao, actualQty: '' }
        }));
        fetchHistory();
        setIsSubmitting(null);
        return;
      }

      await runTransaction(db, async (t) => {
        const settingsRef = doc(db, 'settings', 'global');
        const settingsDoc = await t.get(settingsRef);
        let currentRate = DEFAULT_SETTINGS.bao15ConversionRate;
        if (settingsDoc.exists()) {
          currentRate = settingsDoc.data().bao15ConversionRate || currentRate;
        }

        const inventoryId = `${departmentId}_${bagId}`;
        const inventoryRef = doc(db, 'inventory', inventoryId);
        const invDoc = await t.get(inventoryRef);
        
        const currentQtyInDb = invDoc.exists() ? invDoc.data().quantity || 0 : 0;
        
        // Stock quantities are stored in 'bao' for all types
        const actualInDb = actualInBao;
        const diffInDb = actualInDb - currentQtyInDb;

        t.set(inventoryRef, {
          id: inventoryId,
          departmentId,
          bagTypeId: bagId,
          quantity: actualInDb,
          updatedAt: Date.now()
        }, { merge: true });

        const txRef = doc(collection(db, 'stockChecks'));
        t.set(txRef, {
          id: txRef.id,
          type: 'CHECK',
          departmentId,
          bagTypeId: bagId,
          systemQuantity: currentQtyInDb,
          actualQuantity: actualInDb,
          difference: diffInDb,
          timestamp: Date.now(),
          userId: user?.uid,
          userEmail: user?.email,
          conversionRateAtTime: conversionRate,
        });

        const logRef = doc(collection(db, 'activityLogs'));
        t.set(logRef, {
          id: logRef.id,
          userId: user?.uid,
          userEmail: user?.email,
          timestamp: Date.now(),
          deviceInfo: navigator.userAgent,
          transactionType: 'CHECK',
          beforeData: { quantity: currentQtyInDb },
          afterData: { quantity: actualInDb, difference: diffInDb },
          conversionRateAtTime: conversionRate,
        });
      });

      toast.success('Điều chỉnh tồn kho thành công!');
      // Update local state with the user-entered actual amount in bao
      setStocks(prev => ({
        ...prev,
        [bagId]: { systemQty: actualInBao, actualQty: '' }
      }));
      // Reload history list
      fetchHistory();

    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi điều chỉnh tồn kho');
    } finally {
      setIsSubmitting(null);
    }
  };

  // Admin Reset Stock to Default (0)
  const handleAdminResetStock = async () => {
    setIsResetting(true);
    try {
      if (isDemoMode) {
        demoStore.adminResetStock(resetClearHistory, user);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Đã reset toàn bộ tồn kho về 0 thành công!');
        setShowResetConfirm(false);
        setShowAdminMenu(false);
        fetchSystemStocks();
        fetchHistory();
        setIsResetting(false);
        return;
      }

      const batch = writeBatch(db);

      // Set quantity to 0 for all BAG_TYPES in inventory
      BAG_TYPES.forEach(bag => {
        const invId = `${departmentId}_${bag.id}`;
        const invRef = doc(db, 'inventory', invId);
        batch.set(invRef, {
          id: invId,
          departmentId,
          bagTypeId: bag.id,
          quantity: 0,
          updatedAt: Date.now()
        }, { merge: true });
      });

      // Clear stock check history if option checked
      if (resetClearHistory) {
        const historySnap = await getDocs(collection(db, 'stockChecks'));
        historySnap.forEach(d => {
          batch.delete(doc(db, 'stockChecks', d.id));
        });
      }

      // Record activity log
      const logRef = doc(collection(db, 'activityLogs'));
      batch.set(logRef, {
        id: logRef.id,
        userId: user?.uid,
        userEmail: user?.email,
        timestamp: Date.now(),
        deviceInfo: navigator.userAgent,
        transactionType: 'ADMIN_RESET_STOCK',
        note: resetClearHistory ? 'Reset toàn bộ tồn kho về 0 và xóa lịch sử kiểm kê' : 'Reset toàn bộ tồn kho về 0',
        afterData: { quantity: 0 }
      });

      await batch.commit();

      toast.success('Đã reset toàn bộ tồn kho về 0 thành công!');
      setShowResetConfirm(false);
      setShowAdminMenu(false);
      fetchSystemStocks();
      fetchHistory();
    } catch (error: any) {
      console.error("Error resetting stock:", error);
      toast.error(error.message || 'Lỗi khi reset tồn kho');
    } finally {
      setIsResetting(false);
    }
  };

  // Admin Initialize New Stock Baseline
  const handleAdminInitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInitializing(true);
    try {
      const initDateTime = initDate ? new Date(initDate) : new Date();
      const now = new Date();
      initDateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      const timestamp = initDateTime.getTime();

      const initSummary: Record<string, number> = {};
      BAG_TYPES.forEach(bag => {
        initSummary[bag.id] = Math.max(0, Number(initValues[bag.id] || 0));
      });

      if (isDemoMode) {
        demoStore.adminInitStock(initSummary, timestamp, initClearHistory, user);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Khởi tạo dữ liệu kho mới thành công!');
        setShowAdminMenu(false);
        fetchSystemStocks();
        fetchHistory();
        setIsInitializing(false);
        return;
      }

      const batch = writeBatch(db);

      // Clear stock check history if option checked
      if (initClearHistory) {
        const historySnap = await getDocs(collection(db, 'stockChecks'));
        historySnap.forEach(d => {
          batch.delete(doc(db, 'stockChecks', d.id));
        });
      }

      BAG_TYPES.forEach(bag => {
        const qty = initSummary[bag.id] || 0;
        
        const invId = `${departmentId}_${bag.id}`;
        const invRef = doc(db, 'inventory', invId);
        
        batch.set(invRef, {
          id: invId,
          departmentId,
          bagTypeId: bag.id,
          quantity: qty,
          updatedAt: timestamp
        }, { merge: true });

        // Record initial stock check entry for this initialization
        const txRef = doc(collection(db, 'stockChecks'));
        batch.set(txRef, {
          id: txRef.id,
          type: 'INIT',
          departmentId,
          bagTypeId: bag.id,
          systemQuantity: 0,
          actualQuantity: qty,
          difference: qty,
          timestamp,
          userId: user?.uid,
          userEmail: user?.email,
          note: `Khởi tạo kho mới (${initDate}) bởi Admin`
        });
      });

      // Record activity log
      const logRef = doc(collection(db, 'activityLogs'));
      batch.set(logRef, {
        id: logRef.id,
        userId: user?.uid,
        userEmail: user?.email,
        timestamp,
        deviceInfo: navigator.userAgent,
        transactionType: 'ADMIN_INIT_STOCK',
        note: 'Khởi tạo dữ liệu kho mới',
        afterData: initSummary
      });

      await batch.commit();

      toast.success('Khởi tạo dữ liệu kho mới thành công!');
      setShowAdminMenu(false);
      fetchSystemStocks();
      fetchHistory();
    } catch (error: any) {
      console.error("Error initializing stock:", error);
      toast.error(error.message || 'Lỗi khi khởi tạo kho mới');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-28 sm:pb-8">
      {/* Active Check Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
              Kiểm Kê
              {!isAdjustAllowed && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 normal-case flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Bị khóa
                </span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">So sánh và điều chỉnh tồn kho của các loại bao xốp</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin Menu Trigger Button */}
            {user?.role === 'Admin' && (
              <button 
                onClick={() => setShowAdminMenu(!showAdminMenu)}
                className={cn(
                  "px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-xs",
                  showAdminMenu 
                    ? "bg-rose-600 text-white shadow-rose-600/20" 
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                )}
                title="Menu ẩn dành riêng cho Admin"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Menu Admin</span>
              </button>
            )}

            <button 
              onClick={() => { fetchSystemStocks(); fetchHistory(); }}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 hover:text-indigo-600 transition-colors"
              title="Làm mới dữ liệu"
            >
              <RefreshCcw className={cn("w-4 h-4 sm:w-5 sm:h-5", (loading || loadingHistory) && "animate-spin text-indigo-500")} />
            </button>
          </div>
        </div>

        {/* Admin Hidden Menu Control Panel */}
        {user?.role === 'Admin' && showAdminMenu && (
          <div className="mb-8 p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-rose-50/90 via-slate-50 to-amber-50/80 dark:from-rose-950/30 dark:via-slate-900 dark:to-amber-950/20 border-2 border-rose-300 dark:border-rose-900/60 shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between pb-3.5 border-b border-rose-200/80 dark:border-rose-900/40 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white uppercase text-sm sm:text-base flex items-center gap-2">
                    Công Cụ Admin (Kho)
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white uppercase tracking-wider">
                      ADMIN
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Khởi tạo lại dữ liệu kho mới hoặc reset tồn kho về mặc định
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAdminMenu(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Tabs */}
            <div className="flex bg-slate-100/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-full p-1.5 mb-5 border border-slate-200/80 dark:border-slate-700/80 max-w-fit">
              <button
                type="button"
                onClick={() => setActiveAdminTab('INIT')}
                className={cn(
                  "px-4 py-2.5 rounded-full font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all duration-300 cursor-pointer backdrop-blur-md",
                  activeAdminTab === 'INIT'
                    ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25 border border-sky-300/40 ring-2 ring-sky-400/30"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Sparkles className="w-4 h-4" />
                Khởi Tạo Kho Mới
              </button>
              <button
                type="button"
                onClick={() => setActiveAdminTab('RESET')}
                className={cn(
                  "px-4 py-2.5 rounded-full font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all duration-300 cursor-pointer backdrop-blur-md",
                  activeAdminTab === 'RESET'
                    ? "bg-gradient-to-r from-rose-500 to-amber-600 text-white shadow-lg shadow-rose-500/25 border border-rose-300/40 ring-2 ring-rose-400/30"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <RotateCcw className="w-4 h-4" />
                Reset Về 0
              </button>
            </div>

            {/* Tab 1: Khởi Tạo Kho Mới */}
            {activeAdminTab === 'INIT' && (
              <form onSubmit={handleAdminInitStock} className="space-y-4">
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-200 text-xs font-semibold">
                  💡 Nhập số lượng ban đầu và chọn ngày khởi tạo cho đợt kho mới. Sau khi khởi tạo, hệ thống sẽ lưu tồn kho mới và tạo bản ghi lịch sử.
                </div>

                {/* Date Picker Input */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Ngày Khởi Tạo Tồn Kho
                  </label>
                  <input 
                    type="date" 
                    value={initDate}
                    onChange={(e) => setInitDate(e.target.value)}
                    className="w-full sm:w-64 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all shadow-2xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {BAG_TYPES.map(bag => (
                    <div key={bag.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 uppercase truncate">
                        {bag.name}
                      </label>
                      <div className="relative">
                        <input 
                          type="number"
                          min="0"
                          step={bag.id === 'BAO15' ? "0.1" : "1"}
                          value={initValues[bag.id] || ''}
                          onChange={e => setInitValues({ ...initValues, [bag.id]: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-black text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          placeholder="0"
                          required
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">bao</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="checkbox" 
                    id="initClearHistory"
                    checked={initClearHistory}
                    onChange={e => setInitClearHistory(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="initClearHistory" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    Đồng thời xóa toàn bộ lịch sử kiểm kê cũ
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isInitializing}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-full transition-all duration-300 shadow-lg shadow-indigo-500/25 border border-sky-300/30 backdrop-blur-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  {isInitializing ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" /> Đang khởi tạo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Khởi Tạo Dữ Liệu Kho Mới
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Tab 2: Reset Kho Về 0 */}
            {activeAdminTab === 'RESET' && (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs font-semibold">
                  ⚠️ <strong>Lưu ý:</strong> Thao tác này sẽ đưa tất cả các loại bao tồn kho về <strong>0 bao</strong>.
                </div>

                <div className="flex items-center gap-2 py-0.5">
                  <input 
                    type="checkbox" 
                    id="resetClearHistory"
                    checked={resetClearHistory}
                    onChange={e => setResetClearHistory(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <label htmlFor="resetClearHistory" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    Đồng thời xóa toàn bộ lịch sử kiểm kê cũ
                  </label>
                </div>

                {!showResetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="px-6 py-3 bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-black text-xs sm:text-sm rounded-full transition-all duration-300 shadow-lg shadow-rose-500/25 border border-rose-300/30 backdrop-blur-md cursor-pointer flex items-center gap-2 active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset Tồn Kho Về 0
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-rose-400/50 space-y-2.5">
                    <p className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                      Xác nhận reset toàn bộ số liệu tồn kho về 0?
                    </p>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleAdminResetStock}
                        disabled={isResetting}
                        className="px-5 py-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 disabled:opacity-50 text-white font-black text-xs rounded-full transition-all duration-300 flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/20 border border-rose-300/30 backdrop-blur-md active:scale-95"
                      >
                        {isResetting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Đồng Ý Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-4 py-2 bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 backdrop-blur-md transition-all cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lock Notice Banner */}
        {!isAdjustAllowed ? (
          <div className="space-y-4 mb-6">
            <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/30 backdrop-blur-xl border border-amber-200/80 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md shadow-amber-900/5">
              <div className="flex gap-3 items-start sm:items-center">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5 sm:mt-0" />
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">Chưa đến kỳ kiểm kê</p>
                  <p className="text-xs sm:text-sm mt-0.5 opacity-90 font-medium">Chức năng này chỉ khả dụng vào ngày 1, 19, 20, 21 hàng tháng. Hôm nay là ngày {today.getDate()}/{today.getMonth() + 1}.</p>
                </div>
              </div>
              
              {/* Simulation toggle button for Admin/Manager */}
              {(user?.role === 'Admin' || user?.role === 'Manager') && !showBypassConfirm && (
                <button
                  type="button"
                  onClick={() => setShowBypassConfirm(true)}
                  className="self-start sm:self-center px-4 py-2 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-orange-600/30 text-amber-900 dark:text-amber-200 border border-amber-400/60 dark:border-amber-500/60 rounded-full text-xs font-black backdrop-blur-md transition-all duration-300 shadow-md shadow-amber-500/10 flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" /> Bỏ qua khóa (Kiểm thử)
                </button>
              )}
            </div>

            {/* 2nd Confirmation Glassmorphism Warning Card matching Settings style */}
            {(user?.role === 'Admin' || user?.role === 'Manager') && showBypassConfirm && (
              <div className="bg-amber-500/10 dark:bg-amber-500/15 rounded-3xl p-5 sm:p-7 border border-amber-500/30 backdrop-blur-xl shadow-xl shadow-amber-500/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2.5 sm:p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">Xác Nhận Mở Khóa Kiểm Kê Tồn Kho</h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 font-medium leading-relaxed">
                      Hệ thống hiện đang trong thời gian khóa kiểm kê. Bạn có chắc chắn muốn <strong className="text-amber-600 dark:text-amber-400">BỎ QUA GIỚI HẠN NGÀY KIỂM KÊ</strong> để thực hiện điều chỉnh số liệu kho trực tiếp (dành cho mục đích kiểm thử)?
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 sm:pl-14">
                  <button
                    type="button"
                    onClick={() => {
                      setBypassDateCheck(true);
                      setShowBypassConfirm(false);
                      toast.success('Đã mở khóa kiểm kê tồn kho!');
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs sm:text-sm rounded-full transition-all duration-300 shadow-lg shadow-amber-500/25 border border-amber-300/40 backdrop-blur-md cursor-pointer flex items-center gap-2 active:scale-95"
                  >
                    <Unlock className="w-4 h-4" /> ĐỒNG Ý MỞ KHÓA
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBypassConfirm(false)}
                    className="px-5 py-3 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs sm:text-sm rounded-full border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md transition-all cursor-pointer active:scale-95"
                  >
                    HỦY BỎ
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          isStockCheckDay ? (
            <div className="p-4 sm:p-5 rounded-3xl bg-sky-50/70 dark:bg-sky-950/30 backdrop-blur-xl border border-sky-200/80 dark:border-sky-900/50 text-sky-800 dark:text-sky-300 flex items-center gap-3 mb-6 shadow-md shadow-sky-900/5">
              <Calendar className="w-5 h-5 shrink-0 text-sky-500" />
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-sky-900 dark:text-sky-200">Hôm nay là kỳ kiểm kê</p>
                <p className="text-xs sm:text-sm mt-0.5 opacity-90 font-medium">Hệ thống mở cổng điều chỉnh tồn kho vào ngày 1, 19, 20, 21 hàng tháng. Vui lòng kiểm tra và nhập thực tế.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 backdrop-blur-xl border border-emerald-200/80 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shadow-md shadow-emerald-900/5">
              <div className="flex gap-3 items-center">
                <Unlock className="w-5 h-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">Đã kích hoạt chế độ kiểm thử</p>
                  <p className="text-xs sm:text-sm mt-0.5 opacity-90 font-medium">Bỏ qua giới hạn ngày kiểm kê để Admin/Manager thực hiện điều chỉnh tồn kho.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBypassDateCheck(false)}
                className="self-start sm:self-center px-4 py-2 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-600/20 hover:from-emerald-500/30 hover:to-teal-600/30 text-emerald-900 dark:text-emerald-200 border border-emerald-400/60 dark:border-emerald-500/60 rounded-full text-xs font-black backdrop-blur-md transition-all duration-300 shadow-md shadow-emerald-500/10 cursor-pointer active:scale-95 shrink-0"
              >
                Khôi phục Khóa
              </button>
            </div>
          )
        )}

        {/* Stock Items Form / Read-Only List */}
        <div className="space-y-4">
          {BAG_TYPES.map(bag => {
            const state = stocks[bag.id];
            const isBao15 = bag.id === 'BAO15';
            const unit = 'bao';
            const actualVal = Number(state.actualQty);
            const hasInput = state.actualQty !== '';
            const diff = hasInput ? actualVal - state.systemQty : 0;
            
            const displaySystemQty = state.systemQty;
            const displayDiff = diff;
            
            return (
              <div key={bag.id} className="p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row md:items-center gap-4 transition-all hover:border-slate-200 dark:hover:border-slate-700">
                
                <div className="md:w-36 shrink-0 flex justify-between items-center md:block">
                  <h3 className="font-black text-slate-800 dark:text-slate-200 text-base sm:text-lg">{bag.name}</h3>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-0.5">
                    Hệ thống: {displaySystemQty} {unit}
                    {isBao15 && (
                      <span className="normal-case font-medium text-slate-400 dark:text-slate-400 ml-1">
                        (≈ {displaySystemQty * conversionRate} kg)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1 relative">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step={isBao15 ? "0.1" : "1"}
                        placeholder={isAdjustAllowed ? `Nhập thực tế (${unit})...` : 'Chưa đến kỳ nhập liệu'}
                        value={state.actualQty}
                        onChange={e => handleActualChange(bag.id, e.target.value)}
                        disabled={!isAdjustAllowed}
                        className={cn(
                          "w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 sm:py-3 text-base sm:text-lg font-bold outline-none",
                          isAdjustAllowed 
                            ? "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
                            : "opacity-60 cursor-not-allowed bg-slate-100/50 dark:bg-slate-850"
                        )}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-bold text-slate-400">
                        {unit}
                      </div>
                    </div>
                  </div>

                  {isAdjustAllowed ? (
                    <>
                      <div className="flex items-center justify-between sm:justify-center sm:flex-col sm:w-28 shrink-0 py-1 px-3 sm:p-0 bg-white dark:bg-slate-900 sm:bg-transparent rounded-lg border sm:border-0 border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Chênh lệch</span>
                        {hasInput ? (
                          <span className={cn(
                            "text-base sm:text-xl font-black",
                            diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-slate-500"
                          )}>
                            {displayDiff > 0 ? '+' : ''}{displayDiff}
                          </span>
                        ) : (
                          <span className="text-base sm:text-xl font-black text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAdjust(bag.id)}
                        disabled={!hasInput || isSubmitting === bag.id}
                        className="px-6 py-3.5 bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-900 text-white disabled:text-slate-400 dark:disabled:text-slate-600 font-black rounded-full transition-all duration-300 shadow-xl shadow-indigo-500/25 border border-sky-300/30 backdrop-blur-md disabled:shadow-none text-sm sm:text-base whitespace-nowrap active:scale-95 cursor-pointer"
                      >
                        {isSubmitting === bag.id ? 'ĐANG LƯU...' : 'ĐIỀU CHỈNH'}
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-2 px-4 bg-slate-100/50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-slate-400 text-xs sm:text-sm font-semibold shrink-0 gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Khóa điều chỉnh
                    </div>
                  )}
                </div>
                
              </div>
            );
          })}
        </div>
      </div>

      {/* History Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              Lịch sử Kiểm Kê
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {user?.role === 'Staff' 
                ? 'Hiển thị dữ liệu kỳ kiểm kê gần nhất của hệ thống' 
                : 'Hiển thị toàn bộ lịch sử các lần kiểm kê hệ thống'}
            </p>
          </div>
          <div className="self-start">
            {user?.role === 'Staff' ? (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Kỳ kiểm kê gần nhất
              </span>
            ) : (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Toàn bộ lịch sử ({user?.role})
              </span>
            )}
          </div>
        </div>

        {loadingHistory ? (
          <div className="py-12 text-center text-slate-400 font-medium">
            <RefreshCcw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
            Đang tải lịch sử kiểm kê...
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20">
            <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            Chưa có dữ liệu kiểm kê nào được ghi nhận.
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 text-slate-400 uppercase text-[10px] sm:text-xs font-black tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="py-4 px-4 whitespace-nowrap">Thời gian</th>
                    <th className="py-4 px-4 whitespace-nowrap">Loại Bao</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">Hệ Thống</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">Thực Tế</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">Chênh Lệch</th>
                    <th className="py-4 px-4 whitespace-nowrap">Người Thực Hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map((item) => {
                    const diff = item.difference || 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                          {formatDate(item.timestamp)}
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                          {getBagName(item.bagTypeId)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          {item.systemQuantity?.toLocaleString('vi-VN')} bao
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white">
                          {item.actualQuantity?.toLocaleString('vi-VN')} bao
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-black",
                            diff > 0 
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" 
                              : diff < 0 
                                ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400" 
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          )}>
                            {diff > 0 ? '+' : ''}{diff.toLocaleString('vi-VN')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-[160px] truncate" title={item.userEmail}>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{item.userEmail || 'Hệ thống'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-3">
              {history.map((item) => {
                const diff = item.difference || 0;
                return (
                  <div key={item.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {getBagName(item.bagTypeId)}
                      </span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-black",
                        diff > 0 
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" 
                          : diff < 0 
                            ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400" 
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      )}>
                        Lệch: {diff > 0 ? '+' : ''}{diff.toLocaleString('vi-VN')} bao
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Hệ Thống</span>
                        <span className="font-black text-slate-700 dark:text-slate-300">{item.systemQuantity?.toLocaleString('vi-VN')} bao</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Thực Tế</span>
                        <span className="font-black text-slate-900 dark:text-white">{item.actualQuantity?.toLocaleString('vi-VN')} bao</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>{formatDate(item.timestamp)}</span>
                      <span className="truncate max-w-[140px] font-medium text-slate-500">{item.userEmail?.split('@')[0]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

