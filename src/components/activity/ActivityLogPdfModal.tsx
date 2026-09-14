import React, { useRef, useState } from 'react';
import {
  FileText,
  FileDown,
  Loader2,
  Download,
  X,
  FileSpreadsheet,
  Calendar,
  Layers,
  Clock,
  User,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { BAG_TYPES } from '../../constants';
import { UnifiedLog, TRANSACTION_TYPES } from '../../pages/ActivityLogs';
import { exportPdfFromElement, getUserFullName } from '../../utils/reportExport';
import { exportActivityLogsExcel, getLogBagQuantity } from '../../utils/activityLogExport';
import { CURRENT_APP_VERSION } from '../../constants/versionHistory';
import toast from 'react-hot-toast';

interface ActivityLogPdfModalProps {
  logs: UnifiedLog[];
  dateFilter: string;
  customStartDate?: string;
  customEndDate?: string;
  selectedType: string;
  conversionRate: number;
  user: any;
  getUserDisplayName: (email: string) => string;
  onClose: () => void;
}

export const ActivityLogPdfModal: React.FC<ActivityLogPdfModalProps> = ({
  logs,
  dateFilter,
  customStartDate,
  customEndDate,
  selectedType,
  conversionRate,
  user,
  getUserDisplayName,
  onClose,
}) => {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [pdfViewMode, setPdfViewMode] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');

  // Period label
  let periodText = 'Tất cả thời gian';
  if (dateFilter === 'TODAY') {
    periodText = `Hôm nay (${format(new Date(), 'dd/MM/yyyy')})`;
  } else if (dateFilter === 'THIS_WEEK') {
    periodText = 'Tuần này (7 ngày gần nhất)';
  } else if (dateFilter === 'THIS_MONTH') {
    periodText = `Tháng ${format(new Date(), 'MM/yyyy')}`;
  } else if (dateFilter === 'THIS_YEAR') {
    periodText = `Năm ${format(new Date(), 'yyyy')}`;
  } else if (dateFilter === 'CUSTOM') {
    periodText = `Từ ${customStartDate ? format(new Date(customStartDate), 'dd/MM/yyyy') : '...'} đến ${customEndDate ? format(new Date(customEndDate), 'dd/MM/yyyy') : '...'}`;
  }

  // Selected Type label
  let typeText = 'Tất cả loại giao dịch';
  if (selectedType !== 'ALL' && TRANSACTION_TYPES[selectedType]) {
    typeText = TRANSACTION_TYPES[selectedType].label;
  }

  // Group logs by day (dd/MM/yyyy)
  const dayGroups: Record<string, UnifiedLog[]> = {};
  logs.forEach(log => {
    const dayStr = format(new Date(log.timestamp), 'dd/MM/yyyy');
    if (!dayGroups[dayStr]) dayGroups[dayStr] = [];
    dayGroups[dayStr].push(log);
  });

  // Calculate day summary
  const calculateDaySummary = (dayLogs: UnifiedLog[]) => {
    const exportsByBag: Record<string, number> = {};
    const importsByBag: Record<string, number> = {};
    BAG_TYPES.forEach(b => {
      exportsByBag[b.id] = 0;
      importsByBag[b.id] = 0;
    });

    let totalExportsBao = 0;
    let totalImportsBao = 0;

    dayLogs.forEach(log => {
      const isExportType = log.transactionType === 'EXPORT' || log.transactionType === 'BORROW';
      const isImportType = log.transactionType === 'IMPORT' || log.transactionType === 'RETURN';

      if (log.items && log.items.length > 0) {
        log.items.forEach(item => {
          if (isExportType) {
            exportsByBag[item.bagTypeId] = (exportsByBag[item.bagTypeId] || 0) + item.quantity;
            totalExportsBao += item.quantity;
          } else if (isImportType) {
            importsByBag[item.bagTypeId] = (importsByBag[item.bagTypeId] || 0) + item.quantity;
            totalImportsBao += item.quantity;
          }
        });
      } else if (log.bagTypeId && log.quantity) {
        if (isExportType) {
          exportsByBag[log.bagTypeId] = (exportsByBag[log.bagTypeId] || 0) + log.quantity;
          totalExportsBao += log.quantity;
        } else if (isImportType) {
          importsByBag[log.bagTypeId] = (importsByBag[log.bagTypeId] || 0) + log.quantity;
          totalImportsBao += log.quantity;
        }
      }
    });

    return {
      exportsByBag,
      importsByBag,
      totalExportsBao,
      totalImportsBao
    };
  };

  const handleDownloadPdf = async () => {
    if (!pdfRef.current) return;
    setExportingPdf(true);
    try {
      const fileName = `NhatKy_GiaoDich_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      await exportPdfFromElement(pdfRef.current, fileName);
      toast.success('Đã xuất file PDF thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất PDF:', err);
      toast.error('Có lỗi xảy ra khi tạo file PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDownloadExcel = () => {
    try {
      exportActivityLogsExcel({
        logs,
        dateFilter,
        customStartDate,
        customEndDate,
        selectedType,
        conversionRate,
        getUserDisplayName
      });
      toast.success('Đã xuất file Excel thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất Excel:', err);
      toast.error('Có lỗi khi tạo file Excel');
    }
  };

  const formatQuantityDisplay = (bagTypeId: string, qty: number, type: string, unit?: string) => {
    if (bagTypeId === 'BAO15') {
      const isKg = type === 'EXPORT' || type === 'BORROW' || unit === 'kg';
      if (isKg) {
        const rate = conversionRate || 20;
        const bao = Number((qty / rate).toFixed(2));
        return `${qty} kg (${bao} bao)`;
      }
      return `${qty} bao (${qty * conversionRate} kg)`;
    }
    return `${qty} bao`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
        
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg tracking-tight">XEM TRƯỚC BÁO CÁO NHẬT KÝ (PDF)</h2>
              <p className="text-xs text-slate-400">Chọn mẫu hiển thị và tải báo cáo PDF</p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-800 p-1 rounded-2xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setPdfViewMode('SUMMARY')}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                pdfViewMode === 'SUMMARY'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Mẫu Danh Sách Rút Gọn
            </button>
            <button
              type="button"
              onClick={() => setPdfViewMode('DETAILED')}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                pdfViewMode === 'DETAILED'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Mẫu Bảng Chi Tiết
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {exportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tạo PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Tải File PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Document Canvas Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950/50">
          
          <div
            ref={pdfRef}
            data-pdf-content="true"
            className="mx-auto bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-xl max-w-4xl border border-slate-200 font-sans"
            style={{
              width: '100%',
              minWidth: '700px',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Top Branding Bar matching app header screenshot */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                  X
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-2xl tracking-tight text-slate-900">XỐPKER</span>
                    <span className="bg-sky-100 text-sky-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-sky-200">{CURRENT_APP_VERSION}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Hệ Thống Quản Lý Kho Bao Bì & Nhật Ký Giao Dịch</p>
                </div>
              </div>

              <div className="text-right text-xs text-slate-500">
                <p><b>Ngày xuất file:</b> {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                <p><b>Người xuất:</b> {getUserFullName(user)}</p>
              </div>
            </div>

            {/* Document Main Title */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">BÁO CÁO NHẬT KÝ GIAO DỊCH KHO</h1>
              <div className="inline-flex flex-wrap items-center justify-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-700">
                <span><b>Khoảng thời gian:</b> {periodText}</span>
                <span className="text-slate-300">•</span>
                <span><b>Loại giao dịch:</b> {typeText}</span>
                <span className="text-slate-300">•</span>
                <span><b>Tổng giao dịch:</b> <b className="text-sky-600">{logs.length} lượt</b></span>
              </div>
            </div>

            {/* Render Day Groups matching user requested style or detailed layout */}
            {pdfViewMode === 'SUMMARY' ? (
              <div className="space-y-6 font-sans">
                {Object.keys(dayGroups).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-medium border border-dashed border-slate-200 rounded-2xl">
                    Không có nhật ký giao dịch nào trong khoảng thời gian đã chọn.
                  </div>
                ) : (
                  Object.entries(dayGroups).map(([dayStr, dayLogs], idx, arr) => {
                    const bagSummaries = BAG_TYPES.map(bag => {
                      let qty = 0;
                      dayLogs.forEach(log => {
                        qty += getLogBagQuantity(log, bag.id, conversionRate);
                      });
                      return {
                        bagName: bag.name,
                        qty: Number(qty.toFixed(2))
                      };
                    }).filter(item => item.qty > 0);

                    return (
                      <div key={dayStr} className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 text-slate-900 text-sm leading-relaxed">
                        <div className="font-black text-base text-slate-900 mb-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-500" />
                          <span>Ngày {dayStr}:</span>
                        </div>

                        <div className="pl-4 space-y-1.5 font-bold">
                          {bagSummaries.length > 0 ? (
                            bagSummaries.map((b) => (
                              <div key={b.bagName} className="flex items-center gap-2 text-slate-800">
                                <span>{b.bagName}:</span>
                                <span className="text-slate-950 font-black">{b.qty} bao</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-400 italic font-normal">Không có bao nào</div>
                          )}
                        </div>

                        {idx < arr.length - 1 && (
                          <div className="mt-5 text-slate-300 tracking-widest overflow-hidden text-center select-none opacity-60">
                            --------------------------------------------------
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(dayGroups).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-medium border border-dashed border-slate-200 rounded-2xl">
                    Không có nhật ký giao dịch nào trong khoảng thời gian đã chọn.
                  </div>
                ) : (
                  Object.entries(dayGroups).map(([dayStr, dayLogs]) => {
                    const summary = calculateDaySummary(dayLogs);

                    return (
                      <div
                        key={dayStr}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                      >
                        {/* Day Header Card - Matching Screenshot */}
                        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-slate-50/80 to-white border-b border-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base sm:text-lg">
                                <Calendar className="w-5 h-5 text-amber-500" />
                                <span>NGÀY {dayStr}</span>
                              </div>

                              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                                Tổng {dayLogs.length} giao dịch
                              </span>
                            </div>
                          </div>

                          {/* Summary Box by Type */}
                          <div className="space-y-2">
                            {/* Xuất (Export) summary box in pink/red background */}
                            {summary.totalExportsBao > 0 && (
                              <div className="bg-rose-50 text-rose-900 px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-200 flex flex-wrap items-center gap-2">
                                <span className="text-rose-600 font-extrabold">Xuất:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {BAG_TYPES.map(bag => {
                                    const qty = summary.exportsByBag[bag.id];
                                    if (!qty || qty <= 0) return null;
                                    const isBao15 = bag.id === 'BAO15';
                                    const displayStr = isBao15
                                      ? `${qty} bao (${qty * conversionRate} kg)`
                                      : `${qty} bao`;
                                    return (
                                      <span key={`exp-${bag.id}`} className="bg-white/90 px-2 py-0.5 rounded text-[11px] border border-rose-200/60 shadow-2xs">
                                        {bag.name}: <b className="text-rose-700">{displayStr}</b>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Nhập (Import) summary box in green background */}
                            {summary.totalImportsBao > 0 && (
                              <div className="bg-emerald-50 text-emerald-900 px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-200 flex flex-wrap items-center gap-2">
                                <span className="text-emerald-600 font-extrabold">Nhập:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {BAG_TYPES.map(bag => {
                                    const qty = summary.importsByBag[bag.id];
                                    if (!qty || qty <= 0) return null;
                                    const isBao15 = bag.id === 'BAO15';
                                    const displayStr = isBao15
                                      ? `${qty} bao (${qty * conversionRate} kg)`
                                      : `${qty} bao`;
                                    return (
                                      <span key={`imp-${bag.id}`} className="bg-white/90 px-2 py-0.5 rounded text-[11px] border border-emerald-200/60 shadow-2xs">
                                        {bag.name}: <b className="text-emerald-700">{displayStr}</b>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Detailed Log Table for the Day */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-2.5 px-3">Thời Gian</th>
                                <th className="py-2.5 px-3">Loại Giao Dịch</th>
                                <th className="py-2.5 px-3">Chi Tiết Sản Phẩm</th>
                                <th className="py-2.5 px-3">Người Thực Hiện</th>
                                <th className="py-2.5 px-3">Ghi Chú / Thiết Bị</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {dayLogs.map((log) => {
                                const typeInfo = TRANSACTION_TYPES[log.transactionType] || {
                                  label: log.transactionType,
                                  color: 'text-slate-700',
                                  bg: 'bg-slate-100 border-slate-200',
                                  icon: Info
                                };

                                return (
                                  <tr key={log.id} className="hover:bg-slate-50/50">
                                    {/* Time */}
                                    <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                                    </td>

                                    {/* Type Badge */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={`inline-block px-2.5 py-1 rounded-md font-extrabold text-[11px] border ${typeInfo.bg} ${typeInfo.color}`}>
                                        {typeInfo.label}
                                      </span>
                                    </td>

                                    {/* Product items */}
                                    <td className="py-2.5 px-3 font-medium text-slate-800">
                                      {log.items && log.items.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {log.items.map((item, idx) => (
                                            <span key={idx} className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold text-[11px] border border-slate-200">
                                              {item.bagName || item.bagTypeId}: <span className="text-amber-700">{formatQuantityDisplay(item.bagTypeId, item.quantity, log.transactionType, item.unit)}</span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : log.bagTypeId ? (
                                        <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold text-[11px] border border-slate-200">
                                          {log.bagTypeId}: <span className="text-amber-700">{formatQuantityDisplay(log.bagTypeId, log.quantity || 0, log.transactionType)}</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic">Thao tác hệ thống</span>
                                      )}
                                    </td>

                                    {/* User */}
                                    <td className="py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">
                                      {getUserDisplayName(log.userEmail)}
                                    </td>

                                    {/* Notes / Device */}
                                    <td className="py-2.5 px-3 text-slate-600 max-w-[200px]">
                                      {log.notes || (log.deviceInfo !== 'Không có thông tin' ? log.deviceInfo : '') || '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer Signature Box for Official Reports */}
            <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-2 text-center text-xs text-slate-600">
              <div>
                <p className="font-bold text-slate-800 mb-12">NGƯỜI LẬP BÁO CÁO</p>
                <p className="italic text-slate-400">(Ký và ghi rõ họ tên)</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 mb-12">XÁC NHẬN CỦA QUẢN LÝ KHO</p>
                <p className="italic text-slate-400">(Ký và ghi rõ họ tên)</p>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Bottom Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500 font-medium">
            Số lượng bản ghi: <b className="text-slate-800 dark:text-slate-200">{logs.length} nhật ký</b>
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {exportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Tải Xuống PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
