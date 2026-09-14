import React from 'react';
import { FileText, FileDown, Loader2, Download, X, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  BagReport,
  MonthlyBreakdownItem,
  ExportConfig,
  getBagWeightKg,
  getUserFullName
} from '../../utils/reportExport';

interface ReportPdfModalProps {
  pdfRef: React.RefObject<HTMLDivElement>;
  periodText: string;
  filterType: string;
  reportData: BagReport[];
  monthlyBreakdown: MonthlyBreakdownItem[];
  conversionRate: number;
  user: any;
  exportingPdf: boolean;
  onClose: () => void;
  onDownloadExcel: () => void;
  onDownloadPdf: () => void;
  onChangeConfig?: () => void;
  config: ExportConfig;
  totalPeriodImports: number;
  totalPeriodImportsKg: number;
  totalPeriodExports: number;
  totalPeriodExportsKg: number;
  totalCurrentStock: number;
  totalCurrentStockKg: number;
}

export const ReportPdfModal: React.FC<ReportPdfModalProps> = React.memo(({
  pdfRef,
  periodText,
  filterType,
  reportData,
  monthlyBreakdown,
  conversionRate,
  user,
  exportingPdf,
  onClose,
  onDownloadExcel,
  onDownloadPdf,
  onChangeConfig,
  config,
  totalPeriodImports,
  totalPeriodImportsKg,
  totalPeriodExports,
  totalPeriodExportsKg,
  totalCurrentStock,
  totalCurrentStockKg
}) => {
  // Filter bag types based on selectedBagTypes in config
  const activeBagTypes = config.selectedBagTypes || [];
  const filteredReportData = reportData.filter(item => activeBagTypes.includes(item.bagTypeId));

  // Re-calculate totals for filtered items
  const filteredImportsBao = filteredReportData.reduce((acc, curr) => acc + curr.totalImport, 0);
  const filteredImportsKg = filteredReportData.reduce((acc, curr) => acc + (curr.totalImport * getBagWeightKg(curr.bagTypeId, conversionRate)), 0);
  const filteredExportsBao = filteredReportData.reduce((acc, curr) => acc + curr.totalExport, 0);
  const filteredExportsKg = filteredReportData.reduce((acc, curr) => acc + (curr.totalExport * getBagWeightKg(curr.bagTypeId, conversionRate)), 0);
  const filteredStockBao = filteredReportData.reduce((acc, curr) => acc + curr.currentStock, 0);
  const filteredStockKg = filteredReportData.reduce((acc, curr) => acc + (curr.currentStock * getBagWeightKg(curr.bagTypeId, conversionRate)), 0);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[100] flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="bg-slate-100 dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 relative my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Bar */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Xem Trước Báo Cáo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Kỳ báo cáo: <span className="font-bold text-slate-800 dark:text-slate-200">{periodText}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit config button */}
            {onChangeConfig && (
              <button
                type="button"
                onClick={onChangeConfig}
                className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3.5 py-2.5 rounded-full text-xs transition-all cursor-pointer border border-slate-300 dark:border-slate-600 active:scale-95"
                title="Thay đổi dữ liệu cần xuất"
              >
                <Settings2 className="w-4 h-4 text-indigo-500" />
                Sửa Tùy Chọn
              </button>
            )}

            {/* Download Excel Option */}
            <button
              type="button"
              onClick={onDownloadExcel}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-700 hover:from-emerald-600 hover:to-teal-800 text-white font-extrabold px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-emerald-500/25 border border-emerald-300/40 backdrop-blur-md cursor-pointer active:scale-95"
            >
              <FileDown className="w-4 h-4" />
              Tải Excel
            </button>

            {/* Download PDF Option */}
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={exportingPdf}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-500 via-pink-600 to-rose-700 hover:from-rose-600 hover:to-pink-800 text-white font-extrabold px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-rose-500/25 border border-rose-300/40 backdrop-blur-md cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {exportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang Tạo PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Tải PDF
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview Canvas Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 bg-slate-200 dark:bg-slate-950 flex justify-center items-start">
          <div className="w-full overflow-x-auto flex justify-center py-2">
            {/* Printable PDF/Excel Document Container */}
            <div
              ref={pdfRef}
              data-pdf-content="true"
              className="bg-white text-slate-900 p-8 w-[800px] min-w-[800px] shadow-xl border border-slate-300 rounded-sm font-sans text-xs space-y-6"
              style={{
                color: '#0f172a',
                backgroundColor: '#ffffff'
              }}
            >
              {/* PDF Header Section */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                    HỆ THỐNG QUẢN LÝ KHO BAO XỐP (XOPKER)
                  </h2>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    Báo Cáo Nhập - Xuất - Tồn Kho & Dự Báo Cạn Stock
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-mono font-bold">
                    Mã BC: RPT-{format(new Date(), 'yyyyMMdd-HHmm')}
                  </p>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">
                    Ngày tạo: {format(new Date(), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Report Main Title */}
              <div className="text-center my-4 space-y-1">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                  BÁO CÁO NHẬP - XUẤT - TỒN KHO & DỰ BÁO CẠN STOCK
                </h1>
                <p className="text-xs font-bold text-slate-600">
                  Kỳ Báo Cáo: <span className="text-indigo-700 uppercase">{periodText}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Người lập báo cáo: <span className="font-semibold text-slate-800">{getUserFullName(user)}</span>
                </p>
              </div>

              {/* Summary Box */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                {config.showImports && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Tổng Nhập Trong Kỳ</span>
                    {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                      <span className="text-sm font-black text-emerald-700 block">
                        {filteredImportsBao.toLocaleString('vi-VN')} bao
                      </span>
                    )}
                    {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                      <span className="text-[11px] font-semibold text-emerald-800/80 block">
                        (~{filteredImportsKg.toLocaleString('vi-VN')} kg)
                      </span>
                    )}
                  </div>
                )}

                {config.showExports && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Tổng Xuất Trong Kỳ</span>
                    {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                      <span className="text-sm font-black text-indigo-700 block">
                        {filteredExportsBao.toLocaleString('vi-VN')} bao
                      </span>
                    )}
                    {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                      <span className="text-[11px] font-semibold text-indigo-800/80 block">
                        (~{filteredExportsKg.toLocaleString('vi-VN')} kg)
                      </span>
                    )}
                  </div>
                )}

                {config.showCurrentStock && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Tồn Kho Hiện Tại</span>
                    {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                      <span className="text-sm font-black text-amber-700 block">
                        {filteredStockBao.toLocaleString('vi-VN')} bao
                      </span>
                    )}
                    {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                      <span className="text-[11px] font-semibold text-amber-800/80 block">
                        (~{filteredStockKg.toLocaleString('vi-VN')} kg)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Detailed Transposed Table */}
              <div>
                <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                      <th className="py-2.5 px-3 border-r border-slate-300 text-center w-36 whitespace-nowrap">
                        Chỉ Số Báo Cáo
                      </th>
                      <th className="py-2.5 px-2 border-r border-slate-300 text-center w-16 whitespace-nowrap">
                        Đơn Vị
                      </th>
                      {filteredReportData.map((item) => {
                        const w = getBagWeightKg(item.bagTypeId, conversionRate);
                        return (
                          <th
                            key={`head-${item.bagTypeId}`}
                            className="py-2.5 px-2.5 border-r border-slate-300 text-center whitespace-nowrap"
                          >
                            <span className="block font-black text-slate-900">{item.name}</span>
                            <span className="block text-[9.5px] font-normal text-slate-500">({w}kg/bao)</span>
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-3 bg-slate-200/90 text-slate-900 border-slate-300 text-center font-black whitespace-nowrap">
                        TỔNG CỘNG
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    
                    {/* 1. TỒN KHO HIỆN TẠI */}
                    {config.showCurrentStock && (
                      <>
                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                          <tr className="bg-white">
                            <td className="py-2 px-3 border-r border-slate-300 text-center font-black text-slate-900 bg-slate-50">
                              Tồn Kho (bao)
                            </td>
                            <td className="py-2 px-2 border-r border-slate-300 text-center font-bold text-indigo-700 bg-indigo-50/50">
                              bao
                            </td>
                            {filteredReportData.map((item) => (
                              <td
                                key={`stock-bao-${item.bagTypeId}`}
                                className="py-2 px-2.5 border-r border-slate-300 text-center font-bold text-slate-900"
                              >
                                {item.currentStock.toLocaleString('vi-VN')}
                              </td>
                            ))}
                            <td className="py-2 px-3 bg-slate-100 border-slate-300 text-center font-black text-slate-900">
                              {filteredStockBao.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}

                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                          <tr className="bg-slate-50/30">
                            <td className="py-2 px-3 border-r border-b border-slate-300 text-center font-semibold text-slate-700 bg-slate-50">
                              Tồn Kho (kg)
                            </td>
                            <td className="py-2 px-2 border-r border-b border-slate-300 text-center font-bold text-amber-700 bg-amber-50/50">
                              kg
                            </td>
                            {filteredReportData.map((item) => {
                              const w = getBagWeightKg(item.bagTypeId, conversionRate);
                              return (
                                <td
                                  key={`stock-kg-${item.bagTypeId}`}
                                  className="py-2 px-2.5 border-r border-b border-slate-300 text-center font-semibold text-amber-800"
                                >
                                  {(item.currentStock * w).toLocaleString('vi-VN')}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-center font-black text-amber-900">
                              {filteredStockKg.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* 2. NHẬP TRONG KỲ */}
                    {config.showImports && (
                      <>
                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                          <tr className="bg-white">
                            <td className="py-2 px-3 border-r border-slate-300 text-center font-black text-slate-900 bg-slate-50">
                              Nhập Trong Kỳ (bao)
                            </td>
                            <td className="py-2 px-2 border-r border-slate-300 text-center font-bold text-indigo-700 bg-indigo-50/50">
                              bao
                            </td>
                            {filteredReportData.map((item) => (
                              <td
                                key={`import-bao-${item.bagTypeId}`}
                                className="py-2 px-2.5 border-r border-slate-300 text-center font-bold text-emerald-700"
                              >
                                {item.totalImport > 0 ? item.totalImport.toLocaleString('vi-VN') : '0'}
                              </td>
                            ))}
                            <td className="py-2 px-3 bg-slate-100 border-slate-300 text-center font-black text-emerald-800">
                              {filteredImportsBao.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}

                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                          <tr className="bg-slate-50/30">
                            <td className="py-2 px-3 border-r border-b border-slate-300 text-center font-semibold text-slate-700 bg-slate-50">
                              Nhập Trong Kỳ (kg)
                            </td>
                            <td className="py-2 px-2 border-r border-b border-slate-300 text-center font-bold text-amber-700 bg-amber-50/50">
                              kg
                            </td>
                            {filteredReportData.map((item) => {
                              const w = getBagWeightKg(item.bagTypeId, conversionRate);
                              return (
                                <td
                                  key={`import-kg-${item.bagTypeId}`}
                                  className="py-2 px-2.5 border-r border-b border-slate-300 text-center font-medium text-emerald-800"
                                >
                                  {item.totalImport > 0 ? (item.totalImport * w).toLocaleString('vi-VN') : '0'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-center font-black text-emerald-900">
                              {filteredImportsKg.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* 3. XUẤT TRONG KỲ */}
                    {config.showExports && (
                      <>
                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                          <tr className="bg-white">
                            <td className="py-2 px-3 border-r border-slate-300 text-center font-black text-slate-900 bg-slate-50">
                              Xuất Trong Kỳ (bao)
                            </td>
                            <td className="py-2 px-2 border-r border-slate-300 text-center font-bold text-indigo-700 bg-indigo-50/50">
                              bao
                            </td>
                            {filteredReportData.map((item) => (
                              <td
                                key={`export-bao-${item.bagTypeId}`}
                                className="py-2 px-2.5 border-r border-slate-300 text-center font-bold text-indigo-700"
                              >
                                {item.totalExport > 0 ? item.totalExport.toLocaleString('vi-VN') : '0'}
                              </td>
                            ))}
                            <td className="py-2 px-3 bg-slate-100 border-slate-300 text-center font-black text-indigo-800">
                              {filteredExportsBao.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}

                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                          <tr className="bg-slate-50/30">
                            <td className="py-2 px-3 border-r border-b border-slate-300 text-center font-semibold text-slate-700 bg-slate-50">
                              Xuất Trong Kỳ (kg)
                            </td>
                            <td className="py-2 px-2 border-r border-b border-slate-300 text-center font-bold text-amber-700 bg-amber-50/50">
                              kg
                            </td>
                            {filteredReportData.map((item) => {
                              const w = getBagWeightKg(item.bagTypeId, conversionRate);
                              return (
                                <td
                                  key={`export-kg-${item.bagTypeId}`}
                                  className="py-2 px-2.5 border-r border-b border-slate-300 text-center font-medium text-indigo-800"
                                >
                                  {item.totalExport > 0 ? (item.totalExport * w).toLocaleString('vi-VN') : '0'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-center font-black text-indigo-900">
                              {filteredExportsKg.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* 4. VAY TRẢ KHO */}
                    {config.showBorrows && (
                      <>
                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                          <tr className="bg-white">
                            <td className="py-2 px-3 border-r border-slate-300 text-center font-black text-slate-900 bg-slate-50">
                              Vay / Trả Kho (bao)
                            </td>
                            <td className="py-2 px-2 border-r border-slate-300 text-center font-bold text-purple-700 bg-purple-50/50">
                              bao
                            </td>
                            {filteredReportData.map((item) => (
                              <td
                                key={`borrow-bao-${item.bagTypeId}`}
                                className="py-2 px-2.5 border-r border-slate-300 text-center font-bold text-purple-700"
                              >
                                {item.rawBorrows ? item.rawBorrows.toLocaleString('vi-VN') : '0'}
                              </td>
                            ))}
                            <td className="py-2 px-3 bg-slate-100 border-slate-300 text-center font-black text-purple-800">
                              {filteredReportData.reduce((acc, curr) => acc + (curr.rawBorrows || 0), 0).toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}

                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                          <tr className="bg-slate-50/30">
                            <td className="py-2 px-3 border-r border-b border-slate-300 text-center font-semibold text-slate-700 bg-slate-50">
                              Vay / Trả Kho (kg)
                            </td>
                            <td className="py-2 px-2 border-r border-b border-slate-300 text-center font-bold text-amber-700 bg-amber-50/50">
                              kg
                            </td>
                            {filteredReportData.map((item) => {
                              const w = getBagWeightKg(item.bagTypeId, conversionRate);
                              return (
                                <td
                                  key={`borrow-kg-${item.bagTypeId}`}
                                  className="py-2 px-2.5 border-r border-b border-slate-300 text-center font-medium text-purple-800"
                                >
                                  {item.rawBorrows ? ((item.rawBorrows || 0) * w).toLocaleString('vi-VN') : '0'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-center font-black text-purple-900">
                              {filteredReportData.reduce((acc, curr) => acc + ((curr.rawBorrows || 0) * getBagWeightKg(curr.bagTypeId, conversionRate)), 0).toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* 5. TRUNG BÌNH DÙNG / NGÀY */}
                    {config.showDailyUsage && (
                      <>
                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'BAO') && (
                          <tr className="bg-white">
                            <td className="py-2 px-3 border-r border-slate-300 text-center font-black text-slate-900 bg-slate-50">
                              TB Dùng / Ngày (bao)
                            </td>
                            <td className="py-2 px-2 border-r border-slate-300 text-center font-bold text-indigo-700 bg-indigo-50/50">
                              bao
                            </td>
                            {filteredReportData.map((item) => (
                              <td
                                key={`daily-bao-${item.bagTypeId}`}
                                className="py-2 px-2.5 border-r border-slate-300 text-center font-semibold text-slate-700"
                              >
                                {item.avgDailyUsage > 0 ? item.avgDailyUsage.toFixed(1) : '0'}
                              </td>
                            ))}
                            <td className="py-2 px-3 bg-slate-100 border-slate-300 text-center text-slate-400 font-bold">
                              -
                            </td>
                          </tr>
                        )}

                        {(config.unitFormat === 'BOTH' || config.unitFormat === 'KG') && (
                          <tr className="bg-slate-50/30">
                            <td className="py-2 px-3 border-r border-b border-slate-300 text-center font-semibold text-slate-700 bg-slate-50">
                              TB Dùng / Ngày (kg)
                            </td>
                            <td className="py-2 px-2 border-r border-b border-slate-300 text-center font-bold text-amber-700 bg-amber-50/50">
                              kg
                            </td>
                            {filteredReportData.map((item) => {
                              const w = getBagWeightKg(item.bagTypeId, conversionRate);
                              return (
                                <td
                                  key={`daily-kg-${item.bagTypeId}`}
                                  className="py-2 px-2.5 border-r border-b border-slate-300 text-center font-medium text-slate-600"
                                >
                                  {item.avgDailyUsage > 0 ? (item.avgDailyUsage * w).toFixed(1) : '0'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-center text-slate-400 font-bold">
                              -
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* 6. DỰ BÁO CẠN KHO */}
                    {config.showDepletionForecast && (
                      <tr className="bg-white">
                        <td className="py-2.5 px-3 border-r border-slate-300 text-center font-black text-slate-900 bg-slate-50">
                          Dự Báo Cạn Kho
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-bold text-slate-500 bg-slate-100/60">
                          Thời gian
                        </td>
                        {filteredReportData.map((item) => (
                          <td
                            key={`depletion-${item.bagTypeId}`}
                            className="py-2.5 px-2 border-r border-slate-300 text-center font-medium text-[10.5px]"
                          >
                            {item.daysRemaining === null ? (
                              <span className="text-emerald-700 font-bold px-1.5 py-0.5 bg-emerald-50 rounded">
                                An toàn
                              </span>
                            ) : item.daysRemaining === 0 ? (
                              <span className="text-red-700 font-black px-1.5 py-0.5 bg-red-50 rounded">
                                HẾT HÀNG
                              </span>
                            ) : (
                              <span className={item.daysRemaining <= 5 ? 'text-red-600 font-bold' : 'text-slate-800'}>
                                Còn ~{Math.ceil(item.daysRemaining)}d
                                <span className="block text-[9px] text-slate-500 font-normal">
                                  ({item.depletionDate})
                                </span>
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="py-2.5 px-3 bg-slate-100 border-slate-300 text-center text-slate-400 font-bold">
                          -
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Monthly breakdown table in PDF export for Yearly filter */}
              {filterType === 'YEAR' && config.includeMonthlyBreakdown && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-900 border-b border-slate-300 pb-1">
                    BẢNG CHI TIẾT SỐ LIỆU THEO 12 THÁNG TRONG NĂM {format(new Date(), 'yyyy')}
                  </h3>
                  <table className="w-full text-left border-collapse border border-slate-300 text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center">Tháng</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center">Tổng Nhập (bao)</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center">Tổng Nhập (kg)</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center">Tổng Xuất (bao)</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center">Tổng Xuất (kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {monthlyBreakdown.map((item) => (
                        <tr key={item.month} className={item.month % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold">
                            {item.monthName}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center text-emerald-700 font-semibold">
                            {item.totalImportBao.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center text-emerald-800">
                            {Math.round(item.totalImportKg).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center text-indigo-700 font-semibold">
                            {item.totalExportBao.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center text-indigo-800">
                            {Math.round(item.totalExportKg).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes & Signatures */}
              <div className="pt-4 border-t border-slate-300 space-y-6">
                <p className="text-[10px] text-slate-500 italic">
                  * Ghi chú: Định mức hao hụt trung bình ngày dựa trên số liệu xuất dùng thực tế trong 30 ngày gần
                  nhất. Các ô số liệu chỉ chứa con số thuần túy (không kèm ký tự đơn vị) giúp dễ dàng copy và xử lý dữ
                  liệu Excel.
                </p>

                <div className="flex justify-end pt-2 pr-6">
                  <div className="text-center w-56">
                    <p className="font-bold text-slate-900 uppercase text-[11px]">NGƯỜI LẬP BÁO CÁO</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký & ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-bold text-slate-800 text-xs">{getUserFullName(user)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ReportPdfModal.displayName = 'ReportPdfModal';
