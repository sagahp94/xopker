import React from 'react';
import { Layers, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../Layout';
import { BagReport, getBagWeightKg } from '../../utils/reportExport';
import { isLowStock, getLowStockThreshold } from '../../constants';

interface ReportTableProps {
  reportData: BagReport[];
  conversionRate: number;
  loading: boolean;
}

export const ReportTable: React.FC<ReportTableProps> = React.memo(({
  reportData,
  conversionRate,
  loading
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/15">
        <div>
          <h3 className="text-base font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-indigo-500" /> Số Liệu Chi Tiết & Dự Báo Stock
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">
            Mức sử dụng TB được tính dựa trên dữ liệu 30 ngày qua
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 font-medium text-sm sm:text-base">
          Đang phân tích số liệu hệ thống...
        </div>
      ) : (
        <div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                {reportData.map((item) => {
                  const weightPerBag = getBagWeightKg(item.bagTypeId, conversionRate);
                  const stockKg = item.currentStock * weightPerBag;
                  const importKg = item.totalImport * weightPerBag;
                  const exportKg = item.totalExport * weightPerBag;
                  const avgDailyKg = item.avgDailyUsage * weightPerBag;

                  const isCritical = item.daysRemaining !== null && item.daysRemaining <= 5;
                  const isWarning = item.daysRemaining !== null && item.daysRemaining > 5 && item.daysRemaining <= 15;
                  const isLowThreshold = isLowStock(item.bagTypeId, item.currentStock);

                  return (
                    <tr
                      key={item.bagTypeId}
                      className={cn(
                        "hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors",
                        isLowThreshold && "bg-red-50/20 dark:bg-red-950/10"
                      )}
                    >
                      {/* Bag Type Name */}
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white text-sm sm:text-base whitespace-nowrap">
                        {item.name}
                        {item.bagTypeId === 'BAO15' && (
                          <span className="block text-[10px] text-slate-400 font-medium normal-case mt-0.5">
                            Bao 16 ({weightPerBag}kg/bao)
                          </span>
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-black inline-block",
                            isLowThreshold || item.currentStock === 0
                              ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-1 ring-red-400/50"
                              : isCritical
                              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {item.currentStock.toLocaleString('vi-VN')} bao
                          <span className="text-[10px] font-medium opacity-75 block">
                            ({stockKg.toLocaleString('vi-VN')} kg)
                          </span>
                        </span>
                      </td>

                      {/* Total Import in Period */}
                      <td className="py-4 px-4 text-center font-bold text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">
                        {item.totalImport > 0 ? (
                          <div>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              +{item.totalImport.toLocaleString('vi-VN')} bao
                            </span>
                            <span className="block text-[11px] text-slate-400 font-normal">
                              (+{importKg.toLocaleString('vi-VN')} kg)
                            </span>
                          </div>
                        ) : (
                          '0'
                        )}
                      </td>

                      {/* Total Export in Period */}
                      <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 text-sm whitespace-nowrap">
                        {item.totalExport > 0 ? (
                          <div>
                            <span>-{item.totalExport.toLocaleString('vi-VN')} bao</span>
                            <span className="block text-[11px] text-slate-400 font-normal">
                              (-{exportKg.toLocaleString('vi-VN')} kg)
                            </span>
                          </div>
                        ) : (
                          '0'
                        )}
                      </td>

                      {/* Average Daily Usage */}
                      <td className="py-4 px-4 text-center text-slate-500 text-sm font-semibold whitespace-nowrap">
                        {item.avgDailyUsage > 0 ? (
                          <div>
                            <span>{item.avgDailyUsage.toFixed(1)} bao/ngày</span>
                            <span className="block text-[11px] text-slate-400 font-normal">
                              (~{avgDailyKg.toFixed(1)} kg/ngày)
                            </span>
                          </div>
                        ) : (
                          '0'
                        )}
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
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
                                isCritical
                                  ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                                  : isWarning
                                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                                  : "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                              )}
                            >
                              <Clock className="w-3.5 h-3.5" /> Còn ~ {Math.ceil(item.daysRemaining)} ngày
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium mt-1">
                              Dự kiến hết: {item.depletionDate}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden p-4 space-y-3.5">
            {reportData.map((item) => {
              const weightPerBag = getBagWeightKg(item.bagTypeId, conversionRate);
              const stockKg = item.currentStock * weightPerBag;
              const importKg = item.totalImport * weightPerBag;
              const exportKg = item.totalExport * weightPerBag;
              const avgDailyKg = item.avgDailyUsage * weightPerBag;
              const isLowThreshold = isLowStock(item.bagTypeId, item.currentStock);

              return (
                <div
                  key={item.bagTypeId}
                  className={cn(
                    "p-4 rounded-2xl border transition-all space-y-3",
                    isLowThreshold
                      ? "bg-red-500/10 dark:bg-red-950/20 border-red-400/80 ring-1 ring-red-400/30"
                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white">{item.name}</h4>
                      <p className="text-[11px] text-slate-400 font-medium">{weightPerBag}kg/bao</p>
                    </div>
                    {isLowThreshold ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                        <AlertTriangle className="w-3 h-3" /> Cảnh báo tồn tối thiểu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold">
                        An toàn
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Tồn Kho</span>
                      <p className="font-black text-sm text-slate-800 dark:text-slate-100 mt-0.5">
                        {item.currentStock.toLocaleString('vi-VN')} bao
                      </p>
                      <span className="text-[10px] text-slate-400">({stockKg.toLocaleString('vi-VN')} kg)</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Đã Nhập (Kỳ)</span>
                      <p className="font-black text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{item.totalImport.toLocaleString('vi-VN')} bao
                      </p>
                      <span className="text-[10px] text-slate-400">(+{importKg.toLocaleString('vi-VN')} kg)</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Đã Xuất (Kỳ)</span>
                      <p className="font-black text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">
                        -{item.totalExport.toLocaleString('vi-VN')} bao
                      </p>
                      <span className="text-[10px] text-slate-400">(-{exportKg.toLocaleString('vi-VN')} kg)</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">TB Dùng/Ngày</span>
                      <p className="font-black text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                        {item.avgDailyUsage.toFixed(1)} bao
                      </p>
                      <span className="text-[10px] text-slate-400">(~{avgDailyKg.toFixed(1)} kg)</span>
                    </div>
                  </div>

                  {item.depletionDate && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-slate-500">Dự báo hết stock:</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">{item.depletionDate}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ReportTable.displayName = 'ReportTable';
