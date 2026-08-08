import React from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { MonthlyBreakdownItem } from '../../utils/reportExport';

interface ReportMonthlyBreakdownProps {
  monthlyBreakdown: MonthlyBreakdownItem[];
}

export const ReportMonthlyBreakdown: React.FC<ReportMonthlyBreakdownProps> = React.memo(({
  monthlyBreakdown
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/40 dark:bg-indigo-950/20">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" /> Số Liệu Chi Tiết Nhập - Xuất 12 Tháng Trong Năm
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Tổng hợp sản lượng thực tế từng tháng trong năm {format(new Date(), 'yyyy')}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/40 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 text-center">Tháng</th>
              <th className="py-3 px-4 text-center">Tổng Nhập (Bao)</th>
              <th className="py-3 px-4 text-center">Tổng Nhập (Kg)</th>
              <th className="py-3 px-4 text-center">Tổng Xuất (Bao)</th>
              <th className="py-3 px-4 text-center">Tổng Xuất (Kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {monthlyBreakdown.map((item) => (
              <tr key={item.month} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 text-center">{item.monthName}</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  {item.totalImportBao > 0 ? `${item.totalImportBao.toLocaleString('vi-VN')} bao` : '0'}
                </td>
                <td className="py-3 px-4 text-center text-emerald-800 dark:text-emerald-300 font-medium">
                  {item.totalImportKg > 0 ? `~${Math.round(item.totalImportKg).toLocaleString('vi-VN')} kg` : '0 kg'}
                </td>
                <td className="py-3 px-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                  {item.totalExportBao > 0 ? `${item.totalExportBao.toLocaleString('vi-VN')} bao` : '0'}
                </td>
                <td className="py-3 px-4 text-center text-indigo-800 dark:text-indigo-300 font-medium">
                  {item.totalExportKg > 0 ? `~${Math.round(item.totalExportKg).toLocaleString('vi-VN')} kg` : '0 kg'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

ReportMonthlyBreakdown.displayName = 'ReportMonthlyBreakdown';
