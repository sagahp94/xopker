import React from 'react';
import { ClipboardList, Calendar, FileText } from 'lucide-react';
import { differenceInCalendarDays, addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '../Layout';

interface ReportFiltersProps {
  filterType: string;
  setFilterType: (type: string) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  onOpenPdfPreview: () => void;
}

export const ReportFilters: React.FC<ReportFiltersProps> = React.memo(({
  filterType,
  setFilterType,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  onOpenPdfPreview
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
          <ClipboardList className="w-5.5 h-5.5 text-indigo-500" /> Báo Cáo & Dự Báo Kho
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
          Theo dõi lượng nhập, xuất, sử dụng và dự đoán thời gian hết hàng
        </p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto">
        {/* Preset Buttons Bar */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <button
            type="button"
            onClick={() => setFilterType('TODAY')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              filterType === 'TODAY'
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => setFilterType('WEEK')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              filterType === 'WEEK'
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Tuần này
          </button>
          <button
            type="button"
            onClick={() => setFilterType('MONTH')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              filterType === 'MONTH'
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Tháng này
          </button>
          <button
            type="button"
            onClick={() => setFilterType('YEAR')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              filterType === 'YEAR'
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Năm nay
          </button>
          <button
            type="button"
            onClick={() => setFilterType('CUSTOM')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              filterType === 'CUSTOM'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Tùy chọn ngày
          </button>
        </div>

        {filterType === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 bg-indigo-50/90 dark:bg-indigo-950/50 p-2 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 shadow-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Từ:</span>
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
                className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>
            <span className="text-indigo-400 font-bold hidden sm:inline">➔</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Đến:</span>
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
                className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold px-1 hidden sm:inline">
              (Tối đa 31 ngày)
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenPdfPreview}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-full font-extrabold transition-all duration-300 text-xs sm:text-sm cursor-pointer shadow-lg shadow-indigo-500/20 border border-sky-300/30 backdrop-blur-md active:scale-95"
        >
          <FileText className="w-4 h-4" />
          Xuất Báo Cáo
        </button>
      </div>
    </div>
  );
});

ReportFilters.displayName = 'ReportFilters';
