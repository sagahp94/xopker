import React, { useState } from 'react';
import { Settings2, CheckSquare, Square, Eye, X, Check, Filter, Layers, FileCheck } from 'lucide-react';
import { BAG_TYPES } from '../../constants';
import { ExportConfig, DEFAULT_EXPORT_CONFIG } from '../../utils/reportExport';

interface ReportConfigModalProps {
  initialConfig: ExportConfig;
  filterType: string;
  isAdmin: boolean;
  onClose: () => void;
  onApplyConfig: (config: ExportConfig) => void;
}

export const ReportConfigModal: React.FC<ReportConfigModalProps> = ({
  initialConfig,
  filterType,
  isAdmin,
  onClose,
  onApplyConfig,
}) => {
  const [config, setConfig] = useState<ExportConfig>(initialConfig || DEFAULT_EXPORT_CONFIG);

  const toggleIndicator = (key: keyof Omit<ExportConfig, 'unitFormat' | 'selectedBagTypes' | 'includeMonthlyBreakdown' | 'includeTransactionLogs'>) => {
    setConfig(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAllBags = () => {
    if (config.selectedBagTypes.length === BAG_TYPES.length) {
      setConfig(prev => ({ ...prev, selectedBagTypes: [] }));
    } else {
      setConfig(prev => ({ ...prev, selectedBagTypes: BAG_TYPES.map(b => b.id) }));
    }
  };

  const toggleBagType = (bagId: string) => {
    setConfig(prev => {
      const exists = prev.selectedBagTypes.includes(bagId);
      if (exists) {
        return {
          ...prev,
          selectedBagTypes: prev.selectedBagTypes.filter(id => id !== bagId),
        };
      } else {
        return {
          ...prev,
          selectedBagTypes: [...prev.selectedBagTypes, bagId],
        };
      }
    });
  };

  const applyPresetBasic = () => {
    setConfig({
      ...DEFAULT_EXPORT_CONFIG,
      showCurrentStock: true,
      showImports: true,
      showExports: true,
      showBorrows: false,
      showDailyUsage: false,
      showDepletionForecast: false,
      unitFormat: 'BOTH',
      selectedBagTypes: BAG_TYPES.map(b => b.id),
    });
  };

  const applyPresetFull = () => {
    setConfig({
      ...DEFAULT_EXPORT_CONFIG,
      selectedBagTypes: BAG_TYPES.map(b => b.id),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.selectedBagTypes.length === 0) {
      alert('Vui lòng chọn ít nhất 1 loại bao xốp để xuất báo cáo!');
      return;
    }
    const hasAtLeastOneIndicator =
      config.showCurrentStock ||
      config.showImports ||
      config.showExports ||
      config.showBorrows ||
      config.showDailyUsage ||
      config.showDepletionForecast;

    if (!hasAtLeastOneIndicator) {
      alert('Vui lòng chọn ít nhất 1 chỉ số báo cáo cần xuất!');
      return;
    }

    onApplyConfig(config);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 relative my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                Tùy Chọn Dữ Liệu Báo Cáo
              </h3>
              <p className="text-xs text-indigo-200 font-medium">
                Chọn chỉ số, đơn vị tính và các loại bao cần xuất trước khi xem trước
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Presets Quick Bar */}
          <div className="flex items-center justify-between gap-2 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Cấu hình nhanh:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyPresetBasic}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                Cơ Bản (Tồn & Xuất)
              </button>
              <button
                type="button"
                onClick={applyPresetFull}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                Đầy Đủ
              </button>
            </div>
          </div>

          {/* Section 1: Indicators to Include */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-500" /> Các Chỉ Số Dữ Liệu Báo Cáo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Tồn kho hiện tại */}
              <button
                type="button"
                onClick={() => toggleIndicator('showCurrentStock')}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.showCurrentStock
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <span className="text-xs font-bold">1. Tồn Kho Hiện Tại</span>
                {config.showCurrentStock ? (
                  <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Lượng nhập kho */}
              <button
                type="button"
                onClick={() => toggleIndicator('showImports')}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.showImports
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <span className="text-xs font-bold">2. Lượng Nhập Trong Kỳ</span>
                {config.showImports ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Lượng xuất kho / sử dụng */}
              <button
                type="button"
                onClick={() => toggleIndicator('showExports')}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.showExports
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-900 dark:text-indigo-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <span className="text-xs font-bold">3. Lượng Xuất / Sử Dụng</span>
                {config.showExports ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Vay / trả kho */}
              <button
                type="button"
                onClick={() => toggleIndicator('showBorrows')}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.showBorrows
                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-900 dark:text-purple-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <span className="text-xs font-bold">4. Vay / Trả Kho Bãi</span>
                {config.showBorrows ? (
                  <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Trung bình sử dụng / ngày */}
              <button
                type="button"
                onClick={() => toggleIndicator('showDailyUsage')}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.showDailyUsage
                    ? 'bg-sky-500/10 border-sky-500/40 text-sky-900 dark:text-sky-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <span className="text-xs font-bold">5. TB Sử Dụng / Ngày</span>
                {config.showDailyUsage ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Dự báo cạn kho */}
              <button
                type="button"
                onClick={() => toggleIndicator('showDepletionForecast')}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.showDepletionForecast
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <span className="text-xs font-bold">6. Dự Báo Ngày Cạn Stock</span>
                {config.showDepletionForecast ? (
                  <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>

            </div>
          </div>

          {/* Section 2: Unit format */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-500" /> Đơn Vị Hiển Thị
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, unitFormat: 'BOTH' }))}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  config.unitFormat === 'BOTH'
                    ? 'bg-indigo-600 text-white border-indigo-600 font-extrabold shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold">Hiển Thị Cả 2</span>
                <span className="text-[10px] opacity-80 font-normal">(Bao & Kg)</span>
              </button>

              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, unitFormat: 'BAO' }))}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  config.unitFormat === 'BAO'
                    ? 'bg-indigo-600 text-white border-indigo-600 font-extrabold shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold">Chỉ Bao</span>
                <span className="text-[10px] opacity-80 font-normal">(Số lượng bao)</span>
              </button>

              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, unitFormat: 'KG' }))}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  config.unitFormat === 'KG'
                    ? 'bg-indigo-600 text-white border-indigo-600 font-extrabold shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold">Chỉ Kg</span>
                <span className="text-[10px] opacity-80 font-normal">(Trọng lượng kg)</span>
              </button>

            </div>
          </div>

          {/* Section 3: Filter Bag Types */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" /> Chọn Các Loại Bao Xốp Cần Xuất
              </label>
              <button
                type="button"
                onClick={handleSelectAllBags}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                {config.selectedBagTypes.length === BAG_TYPES.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BAG_TYPES.map(bag => {
                const isChecked = config.selectedBagTypes.includes(bag.id);
                return (
                  <button
                    key={bag.id}
                    type="button"
                    onClick={() => toggleBagType(bag.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                    }`}
                  >
                    <span className="text-xs font-extrabold">{bag.name}</span>
                    {isChecked ? (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Extra Options */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Tùy Chọn Mở Rộng File
            </label>
            
            {filterType === 'YEAR' && (
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeMonthlyBreakdown}
                  onChange={e => setConfig(prev => ({ ...prev, includeMonthlyBreakdown: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Kèm Bảng Chi Tiết 12 Tháng Trong Năm (Trang tính/mục riêng)
                </span>
              </label>
            )}

            {isAdmin && (
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeTransactionLogs}
                  onChange={e => setConfig(prev => ({ ...prev, includeTransactionLogs: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Kèm Trang Lịch Sử Nhật Ký Giao Dịch Chi Tiết (Dành cho Admin)
                </span>
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy Bỏ
            </button>

            <button
              type="submit"
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-sky-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black px-6 py-2.5 rounded-full text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-indigo-500/25 border border-indigo-300/30 cursor-pointer active:scale-95"
            >
              <Eye className="w-4 h-4" />
              Xem Trước Báo Cáo
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
