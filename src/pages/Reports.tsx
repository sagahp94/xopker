import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useReportData } from '../hooks/useReportData';
import { generateExcelReport, exportPdfFromElement, ExportConfig, DEFAULT_EXPORT_CONFIG } from '../utils/reportExport';
import { ReportFilters } from '../components/reports/ReportFilters';
import { ReportSummary } from '../components/reports/ReportSummary';
import { ReportUsageChart } from '../components/reports/ReportUsageChart';
import { ReportTable } from '../components/reports/ReportTable';
import { ReportMonthlyBreakdown } from '../components/reports/ReportMonthlyBreakdown';
import { ReportPdfModal } from '../components/reports/ReportPdfModal';
import { ReportConfigModal } from '../components/reports/ReportConfigModal';
import { ExportOverlay } from '../components/reports/ExportOverlay';

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
    exports,
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

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG);
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
        logs,
        config: exportConfig
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
    logs,
    exportConfig
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

  const handleApplyConfig = (config: ExportConfig) => {
    setExportConfig(config);
    setShowConfigModal(false);
    setShowPdfPreview(true);
  };

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
        onOpenPdfPreview={() => setShowConfigModal(true)}
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

      {/* Usage Trend Section */}
      <ReportUsageChart
        filterType={filterType}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        exports={exports}
        reportData={reportData}
        conversionRate={conversionRate}
        loading={loading}
      />

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

      {/* Config Overlay Modal before previewing */}
      {showConfigModal && (
        <ReportConfigModal
          initialConfig={exportConfig}
          filterType={filterType}
          isAdmin={user?.role === 'Admin'}
          onClose={() => setShowConfigModal(false)}
          onApplyConfig={handleApplyConfig}
        />
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
          config={exportConfig}
          onChangeConfig={() => {
            setShowPdfPreview(false);
            setShowConfigModal(true);
          }}
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
