import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useReportData } from '../hooks/useReportData';
import { generateExcelReport, exportPdfFromElement } from '../utils/reportExport';
import { ReportFilters } from '../components/reports/ReportFilters';
import { ReportSummary } from '../components/reports/ReportSummary';
import { ReportTable } from '../components/reports/ReportTable';
import { ReportMonthlyBreakdown } from '../components/reports/ReportMonthlyBreakdown';
import { ReportPdfModal } from '../components/reports/ReportPdfModal';
import { ExportOverlay } from '../components/reports/ExportOverlay';
import { UsageTrendChart } from '../components/UsageTrendChart';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const pdfRef = useRef<HTMLDivElement>(null);

  const {
    filterType,
    setFilterType,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    logs,
    reportData,
    monthlyBreakdown,
    conversionRate,
    loading,
    totalPeriodImports,
    totalPeriodImportsKg,
    totalPeriodExports,
    totalPeriodExportsKg,
    totalCurrentStock,
    totalCurrentStockKg,
    periodText
  } = useReportData();

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportExcel = useCallback(async () => {
    setIsExportingExcel(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      generateExcelReport({
        reportData,
        monthlyBreakdown,
        filterType,
        customStartDate,
        customEndDate,
        user,
        conversionRate,
        totalPeriodImports,
        totalPeriodImportsKg,
        totalPeriodExports,
        totalPeriodExportsKg,
        totalCurrentStock,
        totalCurrentStockKg,
        logs
      });
      toast.success('Đã xuất báo cáo Excel thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      toast.error('Có lỗi xảy ra khi xuất file Excel!');
    } finally {
      setIsExportingExcel(false);
    }
  }, [
    reportData,
    monthlyBreakdown,
    filterType,
    customStartDate,
    customEndDate,
    user,
    conversionRate,
    totalPeriodImports,
    totalPeriodImportsKg,
    totalPeriodExports,
    totalPeriodExportsKg,
    totalCurrentStock,
    totalCurrentStockKg,
    logs
  ]);

  const handleDownloadPdf = useCallback(async () => {
    if (!pdfRef.current) return;
    setExportingPdf(true);
    try {
      await exportPdfFromElement(pdfRef.current);
      toast.success('Đã tải báo cáo PDF thành công!');
    } catch (err) {
      console.error('Lỗi tạo PDF:', err);
      toast.error('Có lỗi khi tạo file PDF. Vui lòng thử lại!');
    } finally {
      setExportingPdf(false);
    }
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Filters & Header Bar */}
      <ReportFilters
        filterType={filterType}
        setFilterType={setFilterType}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        onOpenPdfPreview={() => setShowPdfPreview(true)}
      />

      {/* Summary Cards */}
      <ReportSummary
        totalPeriodImports={totalPeriodImports}
        totalPeriodImportsKg={totalPeriodImportsKg}
        totalPeriodExports={totalPeriodExports}
        totalPeriodExportsKg={totalPeriodExportsKg}
        totalCurrentStock={totalCurrentStock}
        totalCurrentStockKg={totalCurrentStockKg}
      />

      {/* Usage Trend Line Chart (Xu hướng sử dụng các loại bao) */}
      <UsageTrendChart />

      {/* Main Detailed Report Table */}
      <ReportTable
        reportData={reportData}
        conversionRate={conversionRate}
        loading={loading}
      />

      {/* Monthly Breakdown for Yearly Report */}
      {filterType === 'YEAR' && (
        <ReportMonthlyBreakdown monthlyBreakdown={monthlyBreakdown} />
      )}

      {/* PDF / Document Preview Modal */}
      {showPdfPreview && (
        <ReportPdfModal
          pdfRef={pdfRef}
          periodText={periodText}
          filterType={filterType}
          reportData={reportData}
          monthlyBreakdown={monthlyBreakdown}
          conversionRate={conversionRate}
          user={user}
          exportingPdf={exportingPdf}
          onClose={() => setShowPdfPreview(false)}
          onDownloadExcel={handleExportExcel}
          onDownloadPdf={handleDownloadPdf}
          totalPeriodImports={totalPeriodImports}
          totalPeriodImportsKg={totalPeriodImportsKg}
          totalPeriodExports={totalPeriodExports}
          totalPeriodExportsKg={totalPeriodExportsKg}
          totalCurrentStock={totalCurrentStock}
          totalCurrentStockKg={totalCurrentStockKg}
        />
      )}

      {/* Excel / PDF Processing Loading Overlays */}
      {isExportingExcel && (
        <ExportOverlay
          title="Đang Xuất Báo Cáo Excel..."
          message="Hệ thống đang tổng hợp dữ liệu các trang tính và khởi tạo file Excel. Vui lòng đợi trong giây lát."
        />
      )}

      {exportingPdf && (
        <ExportOverlay
          title="Đang Tạo File Báo Cáo PDF..."
          message="Hệ thống đang render tài liệu PDF độ phân giải cao và chuẩn hóa màu sắc. Vui lòng đợi trong giây lát."
        />
      )}
    </div>
  );
};

export default Reports;
