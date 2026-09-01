import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { BAG_TYPES, getLowStockThreshold } from '../constants';
import { ArrowDownRight, ArrowUpRight, Package, RefreshCcw, AlertTriangle, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '../components/Layout';
import { useAppData } from '../contexts/AppDataContext';

export const Dashboard: React.FC = () => {
  const { stock, todayExports, todayImports, activeBorrows, latestLogTimestamp, missingDataDays, refreshAppData } = useAppData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    const startTime = Date.now();
    await refreshAppData();
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
    }
    setRefreshing(false);
  };

  return (
    <div className="space-y-3.5 sm:space-y-5 pb-28 sm:pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Tổng Quan</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Theo dõi thời gian thực số lượng tồn kho & giao dịch</p>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCcw className={`w-3.5 h-3.5 text-indigo-500 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
      </div>

      {/* Cảnh báo đỏ khi thiếu dữ liệu Nhật ký quá 2 ngày */}
      {missingDataDays > 2 && (
        <div 
          id="missing-data-red-alert"
          className="bg-red-500/10 dark:bg-red-950/40 border-2 border-red-500/70 dark:border-red-500/80 rounded-2xl p-4 sm:p-5 shadow-md shadow-red-500/10 transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-2.5 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 shrink-0 mt-0.5 ring-2 ring-red-500/30">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Cảnh Báo Dữ Liệu
                </span>
                {latestLogTimestamp && (
                  <span className="text-xs font-semibold text-red-600/90 dark:text-red-400/90">
                    (Ngày nhập cuối trong Nhật ký: <span className="font-bold underline">{format(new Date(latestLogTimestamp), 'dd/MM/yyyy')}</span>)
                  </span>
                )}
              </div>

              {/* Exact required warning text */}
              <p className="text-sm sm:text-base font-extrabold text-red-600 dark:text-red-400 tracking-tight leading-snug">
                Hiện tại đang thiếu dữ liệu {missingDataDays} ngày. Vui lòng kiểm tra và bổ sung!
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-red-200 dark:border-red-900/60">
                <Link
                  to="/import"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Bổ sung Nhập Kho</span>
                </Link>
                <Link
                  to="/fast-export"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800/80 hover:bg-red-50 dark:hover:bg-red-950/60 active:scale-95 text-red-700 dark:text-red-300 text-xs font-bold transition-all"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Bổ sung Xuất Kho</span>
                </Link>
                <Link
                  to="/activity"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold underline underline-offset-4 transition-all ml-auto"
                >
                  <span>Xem Nhật Ký Hoạt Động</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 4 Compact Stat Cards: Loại bao, Nhập mới, Đã xuất, Vay nợ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Loại Bao</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{BAG_TYPES.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Nhập Mới (Hôm Nay)</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{todayImports}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-indigo-500">
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Đã Xuất (Hôm Nay)</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{todayExports}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-amber-500">
            <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Vay/Nợ Đang Mở</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{activeBorrows}</p>
        </div>
      </div>

      {/* Tồn Kho Hiện Tại */}
      <div 
        className={cn(
          "bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border space-y-3 relative transition-all duration-300",
          refreshing 
            ? "border-indigo-500 dark:border-indigo-400 ring-4 ring-indigo-500/30 shadow-lg shadow-indigo-500/20 scale-[1.005]" 
            : "border-slate-200 dark:border-slate-800 shadow-xs"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Tồn Kho Hiện Tại</h3>
            {refreshing && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Đang làm mới dữ liệu...
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {BAG_TYPES.map(bag => {
            const qty = stock[bag.id] || 0;
            const threshold = getLowStockThreshold(bag.id);
            const isLow = qty <= threshold;
            
            return (
              <div 
                key={bag.id} 
                className={cn(
                  "p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between h-full",
                  isLow 
                    ? "bg-red-500/10 dark:bg-red-950/30 border-red-500/60 dark:border-red-500/70 shadow-xs shadow-red-500/10 ring-1 ring-red-500/30" 
                    : "bg-slate-50/50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/70"
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h3 className={cn(
                      "font-bold text-xs sm:text-sm tracking-tight", 
                      isLow 
                        ? "text-red-600 dark:text-red-400" 
                        : "text-slate-800 dark:text-slate-100"
                    )}>
                      {bag.name}
                    </h3>
                  </div>
                  
                  {isLow && (
                    <div className="p-1 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tồn:</span>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg sm:text-xl font-black tracking-tight", 
                      isLow 
                        ? "text-red-600 dark:text-red-400" 
                        : "text-slate-900 dark:text-slate-100"
                    )}>
                      {qty.toLocaleString('vi-VN')} <span className="text-[11px] font-semibold opacity-75">bao</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};



