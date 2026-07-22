import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID } from '../types';
import { startOfDay, endOfDay } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Package, RefreshCcw } from 'lucide-react';
import { cn } from '../components/Layout';

interface StockSummary {
  [key: string]: number;
}

export const Dashboard: React.FC = () => {
  const [stock, setStock] = useState<StockSummary>({});
  const [conversionRate, setConversionRate] = useState(DEFAULT_SETTINGS.bao15ConversionRate);
  const [todayExports, setTodayExports] = useState(0);
  const [todayImports, setTodayImports] = useState(0);
  const [activeBorrows, setActiveBorrows] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get settings
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      let currentRate = DEFAULT_SETTINGS.bao15ConversionRate;
      if (settingsDoc.exists()) {
        currentRate = settingsDoc.data().bao15ConversionRate || currentRate;
        setConversionRate(currentRate);
      }

      // Get Stock
      const inventorySnapshot = await getDocs(collection(db, 'inventory'));
      const newStock: StockSummary = {};
      BAG_TYPES.forEach(b => newStock[b.id] = 0);
      
      inventorySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.bagTypeId && newStock[data.bagTypeId] !== undefined) {
          newStock[data.bagTypeId] += (data.quantity || 0);
        }
      });
      setStock(newStock);

      // Get Today's Stats
      const todayStart = startOfDay(new Date()).getTime();
      const todayEnd = endOfDay(new Date()).getTime();

      const exportsQ = query(
        collection(db, 'exports'),
        where('timestamp', '>=', todayStart),
        where('timestamp', '<=', todayEnd)
      );
      const exportsSnap = await getDocs(exportsQ);
      setTodayExports(exportsSnap.size);

      const importsQ = query(
        collection(db, 'imports'),
        where('timestamp', '>=', todayStart),
        where('timestamp', '<=', todayEnd)
      );
      const importsSnap = await getDocs(importsQ);
      setTodayImports(importsSnap.size);

      // Get active borrows
      const borrowsQ = query(
        collection(db, 'borrowReturns'),
        where('status', 'in', ['OPEN', 'PARTIAL'])
      );
      const borrowsSnap = await getDocs(borrowsQ);
      setActiveBorrows(borrowsSnap.size);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 pb-28 sm:pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase">Tổng Quan</h1>
        <button onClick={fetchDashboardData} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <RefreshCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500 mb-2">
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Loại Bao</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{BAG_TYPES.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-500 mb-2">
            <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Nhập Mới</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{todayImports}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 sm:gap-2 text-indigo-500 mb-2">
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Đã Xuất</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{todayExports}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 sm:gap-2 text-amber-500 mb-2">
            <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Vay/Nợ</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{activeBorrows}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 sm:mb-6">Tồn Kho Hiện Tại</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {BAG_TYPES.map(bag => {
            const qty = stock[bag.id] || 0;
            const isBao15 = bag.id === 'BAO15';
            
            return (
              <div key={bag.id} className={cn(
                "p-3.5 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between border transition-all",
                isBao15 ? "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/50" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700",
                ((isBao15 && qty < 50) || (!isBao15 && qty < 10)) && "ring-2 ring-amber-400 border-transparent"
              )}>
                <div>
                  <h3 className={cn("font-bold text-sm sm:text-base", isBao15 ? "text-indigo-900 dark:text-indigo-100" : "text-slate-700 dark:text-slate-300")}>
                    {bag.name}
                  </h3>
                  {isBao15 && qty < 50 && <span className="text-[10px] text-amber-500 font-bold uppercase mt-1 block">Tồn thấp!</span>}
                  {!isBao15 && qty < 10 && <span className="text-[10px] text-amber-500 font-bold uppercase mt-1 block">Tồn thấp!</span>}
                </div>
                <div className="text-right">
                  <p className={cn("text-lg sm:text-xl font-black", isBao15 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-100")}>
                    {qty.toLocaleString('vi-VN')} <span className="text-xs sm:text-sm font-medium opacity-70">bao</span>
                  </p>
                  {isBao15 && (
                    <p className="text-[10px] sm:text-xs text-slate-500 italic mt-0.5 font-medium">
                      ≈ {(qty * conversionRate).toLocaleString('vi-VN')} kg
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
