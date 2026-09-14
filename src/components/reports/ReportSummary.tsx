import React from 'react';
import { ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react';

interface ReportSummaryProps {
  totalPeriodImports: number;
  totalPeriodImportsKg: number;
  totalPeriodExports: number;
  totalPeriodExportsKg: number;
  totalCurrentStock: number;
  totalCurrentStockKg: number;
}

export const ReportSummary: React.FC<ReportSummaryProps> = React.memo(({
  totalPeriodImports,
  totalPeriodImportsKg,
  totalPeriodExports,
  totalPeriodExportsKg,
  totalCurrentStock,
  totalCurrentStockKg
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
          <ArrowDownLeft className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Nhập (Kỳ lọc)</p>
          <p className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
            {totalPeriodImports.toLocaleString('vi-VN')} <span className="text-xs font-bold text-emerald-600">bao</span>
            <span className="text-xs font-medium text-slate-400 block sm:inline sm:ml-1.5">
              (~{totalPeriodImportsKg.toLocaleString('vi-VN')} kg)
            </span>
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
            <span className="text-xs font-medium text-slate-400 block sm:inline sm:ml-1.5">
              (~{totalPeriodExportsKg.toLocaleString('vi-VN')} kg)
            </span>
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
            <span className="text-xs font-medium text-slate-400 block sm:inline sm:ml-1.5">
              (~{totalCurrentStockKg.toLocaleString('vi-VN')} kg)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
});

ReportSummary.displayName = 'ReportSummary';
