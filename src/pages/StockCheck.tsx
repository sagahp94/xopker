import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction, getDocs, query, getDoc } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID } from '../types';
import { useAuth } from '../contexts/AuthContext';
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
  ChevronRight
} from 'lucide-react';

interface StockState {
  systemQty: number;
  actualQty: string;
}

export const StockCheck: React.FC = () => {
  const { user } = useAuth();
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
  const isStockCheckDay = today.getDate() === 20;
  const [bypassDateCheck, setBypassDateCheck] = useState(false);

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
      const snap = await getDocs(collection(db, 'stockChecks'));
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });

      // Sort in-memory desc by timestamp
      list.sort((a, b) => b.timestamp - a.timestamp);

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
  }, [departmentId, user]);

  const handleActualChange = (bagId: BagTypeID, value: string) => {
    setStocks(prev => ({
      ...prev,
      [bagId]: { ...prev[bagId], actualQty: value }
    }));
  };

  const handleAdjust = async (bagId: BagTypeID) => {
    if (!isAdjustAllowed) {
      toast.error('Chưa đến kỳ kiểm kê (chỉ khả dụng vào ngày 20 hàng tháng)');
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
          afterData: { quantity: actualInDb, difference: diffInDb }
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
          <button 
            onClick={() => { fetchSystemStocks(); fetchHistory(); }}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <RefreshCcw className={cn("w-4 h-4 sm:w-5 sm:h-5", (loading || loadingHistory) && "animate-spin text-indigo-500")} />
          </button>
        </div>

        {/* Lock Notice Banner */}
        {!isAdjustAllowed ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex gap-3 items-start sm:items-center">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5 sm:mt-0" />
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">Chưa đến kỳ kiểm kê</p>
                <p className="text-xs sm:text-sm mt-0.5 opacity-90">Chức năng này chỉ khả dụng vào ngày 20 hàng tháng. Hôm nay là ngày {today.getDate()}/{today.getMonth() + 1}.</p>
              </div>
            </div>
            
            {/* Simulation toggle for Admin/Manager testing */}
            {(user?.role === 'Admin' || user?.role === 'Manager') && (
              <button
                onClick={() => setBypassDateCheck(true)}
                className="self-start sm:self-center px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
              >
                <Unlock className="w-3.5 h-3.5" /> Bỏ qua khóa (Kiểm thử)
              </button>
            )}
          </div>
        ) : (
          isStockCheckDay ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/30 text-indigo-800 dark:text-indigo-300 flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 shrink-0 text-indigo-500" />
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">Hôm nay là kỳ kiểm kê</p>
                <p className="text-xs sm:text-sm mt-0.5 opacity-90">Hệ thống mở cổng điều chỉnh tồn kho cho ngày 20 hàng tháng. Vui lòng kiểm tra và nhập thực tế.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex gap-3 items-center">
                <Unlock className="w-5 h-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">Đã kích hoạt chế độ kiểm thử</p>
                  <p className="text-xs sm:text-sm mt-0.5 opacity-90">Bỏ qua giới hạn ngày 20 để Admin/Manager thực hiện điều chỉnh tồn kho.</p>
                </div>
              </div>
              <button
                onClick={() => setBypassDateCheck(false)}
                className="self-start sm:self-center px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-300 rounded-xl text-xs font-bold transition-colors"
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
                        onClick={() => handleAdjust(bag.id)}
                        disabled={!hasInput || isSubmitting === bag.id}
                        className="px-5 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-600 font-black rounded-xl transition-all shadow-md shadow-indigo-600/10 disabled:shadow-none text-sm sm:text-base whitespace-nowrap"
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
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
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
        )}
      </div>
    </div>
  );
};

